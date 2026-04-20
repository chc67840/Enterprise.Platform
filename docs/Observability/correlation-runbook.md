# Correlation ID — end-to-end verification runbook

> **Scope.** Proves that a request emitted from the Angular SPA reaches the
> backend with the same `X-Correlation-ID` header, and that a single trace
> in Application Insights stitches both tiers via that id plus the W3C
> `traceparent` distributed-tracing id.
>
> **Companion references:**
> `Docs/Architecture/UI-Architecture.md` §3.4 ·
> `Docs/Implementation/UI-Foundation-TODO.md` Phase 3.4 ·
> SPA: `src/UI/Enterprise.Platform.Web.UI/ClientApp/src/app/core/interceptors/correlation.interceptor.ts` ·
> Backend: `src/Infrastructure/Enterprise.Platform.Infrastructure/Observability/StructuredLoggingSetup.cs` +
> `src/API/Enterprise.Platform.Api/Middleware/CorrelationIdMiddleware.cs`.

---

## 1. Automated unit verification

- SPA: `src/app/core/interceptors/correlation.interceptor.spec.ts` — 5 specs
  assert header mint / pass-through, `CorrelationContextService.active()`
  reflects the id mid-flight, and clears on both success and error paths.
- Backend: `Api.Tests/Endpoints/HealthEndpointsTests.cs::Correlation_id_header_echoed_on_response`
  asserts the backend echoes the supplied `X-Correlation-ID` header on the
  response.

These two suites together prove the contract at each tier boundary.

## 2. Manual end-to-end verification (single smoke)

Requires: running Api (`dotnet run --project src/API/Enterprise.Platform.Api`)
+ running SPA (`npm start` in `ClientApp/`).

1. Open the SPA at `http://localhost:4200` and sign in.
2. Open browser devtools → Network tab. Find any `/api/v1/*` request. Copy
   the value of the outbound `X-Correlation-ID` header.
3. Open the Api console log (`dotnet run` output). Find the structured log
   record for that same path. Confirm it carries the copied value in its
   `CorrelationId` property. Example (Serilog JSON formatter):

   ```json
   { "@t": "…", "@mt": "HTTP {Method} {Path}",
     "Method": "GET", "Path": "/api/v1/me/permissions",
     "CorrelationId": "<pasted-from-network-tab>", … }
   ```

4. If App Insights is wired (runtime config has a connection string),
   navigate to the workspace → Transaction Search → paste the id — both
   the SPA `trackEvent` record and the Api `ILogger` record appear in the
   same trace.

## 3. Common failure modes

| Symptom | Likely cause |
|---|---|
| Backend log has blank `CorrelationId` | `CorrelationIdMiddleware` not registered, or registered after `UseRouting` such that the header never reaches it. |
| Two different ids — one on request, one on response | `errorInterceptor` or another middleware minted a second one. Check interceptor chain order (Architecture §4.3) — correlation must be slot #2. |
| ids match, but App Insights shows no stitch | `enableCorsCorrelation` is `false` on the SDK config. Set to `true` in `TelemetryService.init` (already default in Phase 3.1). |
| SPA console logs show `correlationId: undefined` | Log emitted outside an HTTP request. `CorrelationContextService.active()` is only populated during interceptor flight — acceptable for ambient logs. |

## 4. Contract invariants (defended by specs)

- Slot #2 in the functional chain (after MSAL, before tenant).
- Existing header passes through; unset header is minted.
- `CorrelationContextService` active id is set before `next(req)` and
  cleared via RxJS `finalize` on both success + error.
- LoggerService stamps `correlationId` on every structured record when an
  active id exists.
