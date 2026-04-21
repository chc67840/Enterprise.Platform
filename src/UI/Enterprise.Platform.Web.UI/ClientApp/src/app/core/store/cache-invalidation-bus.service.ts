/**
 * ─── CacheInvalidationBus ──────────────────────────────────────────────────────
 *
 * Tiny root-provided event bus that lets one store announce "I mutated data
 * of entity X" so peer stores can mark themselves stale and refetch on next
 * view.
 *
 * WHY
 *   Entity stores aren't siblings — they're independent route-scoped
 *   instances with no direct references. But their data is coupled in the
 *   real world: deleting a Role should mark the Users list stale because
 *   users carry roles; creating a Tenant should invalidate cached
 *   permission lookups, etc.
 *
 *   A root-scoped RxJS `Subject` plus a publisher / subscriber pair per
 *   store keeps the coupling declarative + loose. No store reaches into
 *   another; they all talk to the bus.
 *
 * USAGE
 *   ```ts
 *   // Publisher (inside a store's mutation method):
 *   bus.publish({ entity: 'users', action: 'updated', id });
 *
 *   // Subscriber (inside a store that cares):
 *   bus.events$('roles').subscribe(() => this.invalidate());
 *   ```
 *
 *   `events$(entity)` returns an Observable filtered to the given entity
 *   name. A bare `events$()` with no filter yields every event — useful for
 *   debug overlays but not a normal store consumer pattern.
 *
 * DESIGN NOTES
 *   - `entity` is a string (e.g. `'users'`). Convention: lowercased plural
 *     that matches the feature slice name + the API endpoint's base.
 *   - Bus is synchronous (`Subject`, not `ReplaySubject`). Late subscribers
 *     don't replay history — they see future events only. That matches the
 *     "invalidate peers on NEXT write" contract.
 */
import { Injectable } from '@angular/core';
import { Subject, filter, map, type Observable } from 'rxjs';

export type CacheAction = 'created' | 'updated' | 'deleted';

export interface CacheInvalidationEvent {
  /** Feature/entity slice name (e.g. `'users'`, `'roles'`). */
  readonly entity: string;
  /** Which mutation triggered the invalidation. */
  readonly action: CacheAction;
  /** Optional id of the specific record. Absent for bulk operations. */
  readonly id?: string;
  /** Epoch ms when the event was emitted — for dedupe on replay debug views. */
  readonly at: number;
}

@Injectable({ providedIn: 'root' })
export class CacheInvalidationBus {
  private readonly subject = new Subject<CacheInvalidationEvent>();

  /** Fire-and-forget publish. Stamps `at` if the caller omits it. */
  publish(event: Omit<CacheInvalidationEvent, 'at'> & { at?: number }): void {
    this.subject.next({
      ...event,
      at: event.at ?? Date.now(),
    });
  }

  /**
   * Subscribe to every event (no filter). Rarely correct for feature stores
   * — prefer the filtered overload below.
   */
  events$(): Observable<CacheInvalidationEvent>;

  /** Subscribe to events for a single entity slice. */
  events$(entity: string): Observable<CacheInvalidationEvent>;

  events$(entity?: string): Observable<CacheInvalidationEvent> {
    if (entity === undefined) {
      return this.subject.asObservable();
    }
    return this.subject.pipe(filter((e) => e.entity === entity));
  }

  /**
   * Convenience — observable of just the ACTIONS for the given entity. Use
   * when the subscriber only needs to know "something changed" and will
   * re-fetch wholesale regardless of action.
   */
  actionsFor$(entity: string): Observable<CacheAction> {
    return this.events$(entity).pipe(map((e) => e.action));
  }
}
