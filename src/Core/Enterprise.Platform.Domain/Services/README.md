# Domain Services

> **What this folder is for.** Domain Services in the DDD sense — operations
> that don't belong inside any single Aggregate but ARE pure domain logic
> (business invariants, cross-aggregate rules, domain-language calculations).

## When to put a class here

A class belongs in `Domain/Services/` when ALL of these are true:

1. **It encodes a business rule the domain expert would recognize**
   ("you can't lock a grant while child allocations are in-flight",
    "interest accrues at the rate active on the posting date").
2. **The rule spans multiple aggregates OR has nowhere obvious to live**
   inside a single aggregate root.
3. **It has zero infrastructure dependencies** — no EF Core, no HttpClient,
   no Logger (that's not a domain concern), no IOptions, no IDateTimeProvider.
   If you reach for `DateTime.UtcNow`, accept it as a parameter.
4. **It's stateless** (or holds only immutable computed state). Domain
   services are typically registered as singletons.

## When something does NOT belong here

| Goes here? | Use case | Where it actually goes |
|---|---|---|
| ❌ | "Send the user a notification when X happens" | `Application/Features/.../Handlers` (Application Service) |
| ❌ | "Save these entities atomically" | `Application/Features/.../Handlers` + `IUnitOfWork` |
| ❌ | "Render a PDF of the grant statement" | `Application/Abstractions/IPdfGenerator` |
| ❌ | "Send an email" | `Application/Common/Interfaces/IEmailService` |
| ❌ | "Read the user's profile from Microsoft Graph" | `Web.UI/Services/Graph/GraphUserProfileService` |
| ❌ | "Audit this access" | `Application/Common/Interfaces/IAuditWriter` |
| ✅ | "Compute the effective tax rate given a jurisdiction + date" | here |
| ✅ | "Validate that a grant lock can transition from `Pending` → `Active`" | here |
| ✅ | "Calculate the priority of a task across competing factors" | here |

## The three flavours of "service"

| Service kind | Lives in | What it does | Example |
|---|---|---|---|
| **Domain Service** | `Domain/Services/` | Pure business invariant; no infrastructure | `IGrantLockingPolicy.CanLock(grant, allocations)` |
| **Application Service** | `Application/Features/...` (handler files) | Use-case orchestration; uses Repositories, raises events | `LockGrantHandler.Handle(LockGrantCommand)` |
| **Infrastructure Service** | `Infrastructure/...` | External system adapter | `SmtpEmailService`, `RedisCache`, `BlobFileStorage` |

A Domain Service may be CALLED FROM an Application Service. The reverse is
forbidden — Domain doesn't know about Application.

## Naming conventions

- Interface: `I{BusinessConcept}Policy` or `I{BusinessConcept}Calculator` or
  `I{BusinessConcept}Service` — pick the suffix that best names the role.
- Implementation: `{BusinessConcept}Policy`, etc.
- One file per service.
- File-scoped namespace: `Enterprise.Platform.Domain.Services`.
- Sealed by default.

## DI registration

Domain Services have NO infrastructure dependencies, so they're typically
registered as **singletons** in the host's composition root:

```csharp
// In Infrastructure/DependencyInjection.cs (or per-host extension)
services.AddSingleton<IGrantLockingPolicy, GrantLockingPolicy>();
```

If a service needs `IDateTimeProvider` or similar abstraction, accept it as
a constructor dependency — the abstraction lives in `Application/Abstractions/`,
the implementation in `Infrastructure/`.

## Example

See [`IExamplePricingPolicy.cs`](IExamplePricingPolicy.cs) for the canonical
shape. Delete or replace when the first real Domain Service ships.

## Why this folder exists

The reference architecture comparison
([`../../../../Docs/Architecture/Architecture-Comparison-Analysis.md`](../../../../Docs/Architecture/Architecture-Comparison-Analysis.md))
flagged that we had implicit Domain Services scattered across handlers /
aggregates. Formalizing them in their own folder:

- Makes the DDD pattern explicit for new contributors
- Gives a clear home for cross-aggregate rules
- Keeps the Domain ring pure (no infrastructure leaking in)
