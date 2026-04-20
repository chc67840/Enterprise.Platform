/**
 * ─── CORRELATION CONTEXT ────────────────────────────────────────────────────────
 *
 * WHY
 *   Browsers lack a standardised `AsyncContext` / `AsyncLocalStorage` the way
 *   Node does, so we can't implicitly propagate a correlation id across
 *   promise chains. This service is a pragmatic middle ground:
 *
 *     - `correlationInterceptor` calls `setActive(id)` immediately when it
 *       stamps the outbound request. Code that runs synchronously in the same
 *       task — log emissions, error toasts, RxJS operators scheduled
 *       microtask-after — sees the id via `active()`.
 *     - `clearActive()` is called at the end of the interceptor pipeline.
 *     - A stack (`pushActive` / `popActive`) supports the (uncommon) case of
 *       nested requests inside the same synchronous call path — when request
 *       B starts inside request A's subscriber chain, A's id is restored on
 *       completion rather than being overwritten.
 *
 * LIMITATIONS WE ACCEPT
 *   Concurrent XHRs scheduled across microtasks can race on the "active" id.
 *   In practice this means that log records emitted between two overlapping
 *   requests may attribute to whichever request set `active` last — not a
 *   correctness problem, just an attribution fuzziness that's acceptable for
 *   support pivots (the id is always *a* valid request id from the session).
 *   Full-fidelity per-request correlation waits for `AsyncContext` in V8 or
 *   an equivalent explicit passing, neither of which is worth the ergonomics
 *   cost yet.
 *
 * RELATED
 *   Architecture §3.4 — correlation strategy
 *   `correlation.interceptor.ts` — producer
 *   `logger.service.ts`          — consumer
 */
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CorrelationContextService {
  /** Current active id (last caller to `setActive` / `pushActive` wins). */
  private current: string | null = null;

  /** Stack of prior ids so `pushActive` / `popActive` nests correctly. */
  private readonly stack: string[] = [];

  /** Returns the active correlation id, or `null` if none is set. */
  active(): string | null {
    return this.current;
  }

  /** Overwrites the current id without stacking. Used by the interceptor. */
  setActive(id: string | null): void {
    this.current = id;
  }

  /**
   * Stacks a new id as active. Returns a disposer that restores the previous
   * active id — safe to use inside try/finally:
   *
   *   ```ts
   *   const restore = ctx.pushActive(id);
   *   try { ... } finally { restore(); }
   *   ```
   */
  pushActive(id: string): () => void {
    if (this.current !== null) {
      this.stack.push(this.current);
    }
    this.current = id;
    return () => {
      this.current = this.stack.pop() ?? null;
    };
  }

  /** Clears the active id. Callers should prefer the `pushActive` disposer. */
  clearActive(): void {
    this.current = null;
    this.stack.length = 0;
  }
}
