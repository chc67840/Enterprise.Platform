/**
 * ─── CacheInvalidationBus — UNIT TESTS ─────────────────────────────────────────
 *
 * Proves:
 *   - `publish` delivers to subscribers that filtered on the same entity.
 *   - Subscribers on DIFFERENT entities do NOT receive the event.
 *   - `events$()` (no filter) delivers everything.
 *   - `actionsFor$` narrows to action strings.
 *   - `at` is auto-stamped when the caller omits it.
 */
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CacheInvalidationBus,
  type CacheInvalidationEvent,
} from './cache-invalidation-bus.service';

describe('CacheInvalidationBus', () => {
  let bus: CacheInvalidationBus;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    bus = TestBed.inject(CacheInvalidationBus);
  });

  it('delivers events to same-entity subscribers', () => {
    const received: CacheInvalidationEvent[] = [];
    bus.events$('users').subscribe((e) => received.push(e));

    bus.publish({ entity: 'users', action: 'created', id: 'u1' });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      entity: 'users',
      action: 'created',
      id: 'u1',
    });
    expect(typeof received[0]?.at).toBe('number');
  });

  it('does NOT deliver events to peer-entity subscribers', () => {
    const users: CacheInvalidationEvent[] = [];
    const roles: CacheInvalidationEvent[] = [];
    bus.events$('users').subscribe((e) => users.push(e));
    bus.events$('roles').subscribe((e) => roles.push(e));

    bus.publish({ entity: 'roles', action: 'deleted', id: 'r1' });

    expect(users).toHaveLength(0);
    expect(roles).toHaveLength(1);
  });

  it('unfiltered events$() receives every event', () => {
    const all: CacheInvalidationEvent[] = [];
    bus.events$().subscribe((e) => all.push(e));

    bus.publish({ entity: 'users', action: 'created' });
    bus.publish({ entity: 'roles', action: 'updated' });

    expect(all.map((e) => e.entity)).toEqual(['users', 'roles']);
  });

  it('actionsFor$ narrows to the action string', () => {
    const actions: string[] = [];
    bus.actionsFor$('users').subscribe((a) => actions.push(a));

    bus.publish({ entity: 'users', action: 'created' });
    bus.publish({ entity: 'roles', action: 'updated' });
    bus.publish({ entity: 'users', action: 'deleted' });

    expect(actions).toEqual(['created', 'deleted']);
  });

  it('stamps `at` with Date.now when the caller omits it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T10:00:00Z'));
    const received: CacheInvalidationEvent[] = [];
    bus.events$('users').subscribe((e) => received.push(e));

    bus.publish({ entity: 'users', action: 'created' });
    expect(received[0]?.at).toBe(new Date('2026-04-21T10:00:00Z').getTime());

    vi.useRealTimers();
  });
});
