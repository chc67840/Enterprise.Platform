# Event Handler Chains

> **What this doc is for.** Documenting the cascade of business events
> that fire when a use case completes. Without this, "why did this audit
> row appear?" is reverse-engineered from anonymous handler registrations.
> With this, anyone can trace a chain forward from a trigger or backward
> from an effect.
>
> **Convention origin.** Adopted from the
> [`Architecture-Comparison-Analysis`](Architecture-Comparison-Analysis.md)
> recommendation #20 — the reference architecture made handler chains
> visible (e.g. `LDR → Cost → Retro → Cost acct.`); we adopted the practice
> for our outbox/integration-event pipeline.

## 1. Two kinds of events in `Enterprise.Platform`

| Kind | Lives in | Dispatched by | Listened by |
|---|---|---|---|
| **Domain Event** | `Domain/Events/` | Aggregate methods (raised then collected) | In-process handlers in `Application/Features/` |
| **Integration Event** | `Application/Common/Events/` (planned: `IntegrationEvents/`) | Outbox pattern via `Infrastructure/Messaging/Outbox/` | In-process or cross-process handlers; broker-agnostic |

Domain events fire **synchronously, in the same transaction** as the
aggregate save. Integration events fire **after commit**, drained by the
Worker host's `OutboxProcessorJob`.

## 2. Documentation convention

Each event handler MUST carry an XML doc block with three sections:

```csharp
/// <summary>
/// One-line summary of what this handler DOES.
/// </summary>
/// <remarks>
/// <b>Triggered by:</b>
///   - <see cref="OrderPlacedDomainEvent"/> (raised by Order.Place())
///   - <see cref="OrderRevisedDomainEvent"/> (raised by Order.Revise())
///
/// <b>Raises (downstream events):</b>
///   - <see cref="InventoryReservedIntegrationEvent"/> (when SKU is in stock)
///   - <see cref="OrderBackorderedIntegrationEvent"/> (when SKU is OOS)
///
/// <b>Reads:</b>
///   - InventoryRepository (Sku → quantity-on-hand)
///
/// <b>Writes:</b>
///   - InventoryReservation rows
///   - OutboxMessages (the downstream events above)
/// </remarks>
public sealed class ReserveInventoryOnOrderPlacedHandler { ... }
```

The four sections (**Triggered by / Raises / Reads / Writes**) let any
reader trace causality both directions without spelunking through
registration code.

## 3. Chain visualization template

For complex multi-step business workflows (financial postings, multi-stage
approvals, compensating transactions), produce a chain diagram in this
doc using the template below. **One section per chain.**

### Template

```markdown
### Chain: {Trigger Verb} {Aggregate}

**Business goal.** Plain-English description of what this chain achieves.

**Trigger.** What kicks it off (UI action, scheduled job, inbound webhook).

**Sequence.**

\`\`\`
{TriggerEvent}
    ↓
[Handler #1: {ClassName}]
    raises → {DownstreamEvent}
    ↓
[Handler #2: {ClassName}]
    raises → {DownstreamEvent}
    ↓
[Handler #3: {ClassName}]
    end of chain
\`\`\`

**Compensation.** What happens on failure of step N (rollback strategy,
poison-message handling, manual-intervention escalation).

**Idempotency.** How re-processing the same trigger is made safe (dedup keys,
state guards).

**Observability.** Where to look for traces / logs / metrics tied to this
chain.

**Last reviewed.** YYYY-MM-DD by {name} — chain still accurate?
```

## 4. Live chains (real chains documented as they ship)

> No production chains are documented here yet — the platform's first real
> business domain hasn't shipped. This section will populate as features
> land. Each live chain MUST follow the template above.

## 5. Example chain (illustrative — synthetic)

### Chain: Place Order

**Business goal.** When a customer places an order, reserve inventory,
charge the payment method, and notify the warehouse, all atomically.

**Trigger.** `POST /api/v1/orders` invokes `PlaceOrderCommandHandler`.

**Sequence.**

```
PlaceOrderCommand                                         (Application)
    ↓
[PlaceOrderCommandHandler]                                (Application/Features/Orders/)
    ├─ Order.Place()                                      (Aggregate method)
    │     ↓ raises (in-transaction)
    │   OrderPlacedDomainEvent
    │     ↓
    │   [ReserveInventoryOnOrderPlacedHandler]            (Application — sync, in-tx)
    │     ↓ raises
    │   InventoryReservedDomainEvent
    │     ↓
    │   [ChargePaymentOnInventoryReservedHandler]         (Application — sync, in-tx)
    │     ↓ raises
    │   PaymentChargedDomainEvent
    │     ↓
    │   [WriteToOutbox: OrderConfirmedIntegrationEvent]   (writes outbox row)
    └─ db.SaveChangesAsync (single transaction commits everything above)
    ↓
                                                          (after commit, Worker drains outbox)
OutboxProcessorJob picks up OrderConfirmedIntegrationEvent
    ↓
[NotifyWarehouseOnOrderConfirmedIntegrationHandler]       (Application — runs in Worker)
    side-effect: HTTP call to warehouse system
    ↓
[SendOrderConfirmationEmailHandler]                       (Application — runs in Worker)
    side-effect: INotificationService.NotifyAsync (email)
    ↓
end of chain
```

**Compensation.** If any step inside the transaction fails, the entire
transaction rolls back — Order is not persisted, no outbox event, no
side-effects fired. Failures in post-commit handlers (warehouse call,
email) retry up to 5 times (see `OutboxProcessorJob`); poison messages
land in `OutboxMessages` with `AttemptCount = 5` and `LastError` populated
for manual triage.

**Idempotency.**

- `PlaceOrderCommand` carries an `X-Idempotency-Key` header → de-duplicated
  by `IIdempotencyStore`.
- Outbox events carry their `Id` (UUID) → consumer handlers check for
  prior processing.

**Observability.**

- Single `X-Correlation-ID` traverses Browser → BFF → Api → Worker logs.
- Distributed trace (W3C `traceparent`) spans across hosts via OpenTelemetry.
- Metrics: `ep.bff.session.created`, `ep.api.token.audience_matched`,
  custom business counter `ep.api.orders.placed`.

**Last reviewed.** 2026-04-23 — example/synthetic; replace with real chain
when first real workflow ships.

## 6. How to add a new chain

1. Implement the handlers per the per-handler XML-doc convention (§ 2).
2. Add a new `### Chain: {…}` section in this file using the template (§ 3).
3. PR the doc change in the **same commit** as the handler code so the doc
   never goes stale relative to the implementation.
4. When refactoring, the `Last reviewed` line + any out-of-date sequence
   becomes the canary that the doc needs an update.

## 7. Tooling (future)

The handler XML-doc convention makes it possible to **auto-generate** the
chain diagrams from compiled assemblies via a small Roslyn analyzer. Out
of scope today; track in TODO.

---

**Companion docs:**
- [`Architecture-Comparison-Analysis.md`](Architecture-Comparison-Analysis.md) — origin of this convention
- [`../Recreation/05-Backend-Request-Flow.md`](../Recreation/05-Backend-Request-Flow.md) — how dispatcher + behaviors invoke handlers
- [`../Recreation/08-Database-And-Persistence.md`](../Recreation/08-Database-And-Persistence.md) — outbox-pattern implementation
