/**
 * ─── withPersistence(options) ──────────────────────────────────────────────────
 *
 * Opt-in snapshot-persistence for a signal store. On every state change the
 * serializable subset is written to `localStorage` / `sessionStorage`. On
 * store construction the saved snapshot is hydrated back.
 *
 * USAGE
 *   ```ts
 *   const PreferencesStore = signalStore(
 *     withState({ theme: 'light', sidebarCollapsed: false, _ephemeral: null }),
 *     withPersistence<PreferencesState>({
 *       key: 'preferences',
 *       storage: 'local',
 *       pick: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
 *     }),
 *   );
 *   ```
 *
 * TYPING CAVEAT
 *   Generic `signalStoreFeature`s that OBSERVE parent-store state (rather
 *   than contribute their own) have a type-erasure seam in ngrx-signals 21.
 *   The internal casts below narrow the opaque feature-graph node to the
 *   caller's declared state shape — the public API stays strongly typed via
 *   the `TState` generic on `PersistenceOptions`.
 *
 * FAILURE MODES
 *   Quota exceeded, JSON parse failure, and storage availability are all
 *   swallowed with a warn-level log. A broken persistence layer must never
 *   block the feature's primary flow; the user experiences the degraded
 *   "didn't restore last time" state, not a white screen.
 */
import {
  getState,
  patchState,
  signalStoreFeature,
  withHooks,
  withMethods,
  type StateSource,
  type WritableStateSource,
} from '@ngrx/signals';
import { effect, inject } from '@angular/core';

import { LoggerService } from '@core/services/logger.service';

export type PersistenceStorage = 'local' | 'session' | 'indexedDb';

export interface PersistenceOptions<TState extends object> {
  /** Storage key — prefixed `ep-store:` so stores share no globals. */
  readonly key: string;

  /** Backing store. Defaults to `local`. */
  readonly storage?: PersistenceStorage;

  /**
   * Returns the serializable slice of state to persist. Identity `(s) => s`
   * persists everything; supply a narrow `pick` to exclude transient flags.
   */
  readonly pick: (state: TState) => Partial<TState>;
}

const KEY_PREFIX = 'ep-store:';

function fullKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

function pickBackend(
  kind: PersistenceStorage,
  log: LoggerService,
): Storage | null {
  if (typeof window === 'undefined') return null;
  if (kind === 'indexedDb') {
    log.warn('store.persistence.idb.fallback', {
      reason: 'IDB driver not yet implemented; using localStorage',
    });
    return window.localStorage;
  }
  return kind === 'session' ? window.sessionStorage : window.localStorage;
}

/**
 * Opaque feature-graph node. The caller's `TState` is carried through the
 * public API via the `PersistenceOptions<TState>` generic; internally we
 * narrow via `unknown` cast to the `StateSource<TState>` / `WritableStateSource<TState>`
 * shapes required by `getState` / `patchState`.
 */
type StoreNode = Record<string, unknown>;

export function withPersistence<TState extends object>(
  options: PersistenceOptions<TState>,
) {
  return signalStoreFeature(
    withMethods((store: StoreNode) => {
      const log = inject(LoggerService);
      const backend = pickBackend(options.storage ?? 'local', log);

      return {
        /** Clears the persisted snapshot. Does not touch in-memory state. */
        clearPersistedState(): void {
          if (!backend) return;
          try {
            backend.removeItem(fullKey(options.key));
          } catch (err) {
            log.warn('store.persistence.clear.failed', { key: options.key, err });
          }
        },

        /** Force an immediate save — rarely needed (effect below auto-saves). */
        savePersistedState(): void {
          if (!backend) return;
          try {
            const current = getState(store as StateSource<TState>) as TState;
            const snapshot = options.pick(current);
            backend.setItem(fullKey(options.key), JSON.stringify(snapshot));
          } catch (err) {
            log.warn('store.persistence.save.failed', { key: options.key, err });
          }
        },
      };
    }),
    withHooks({
      onInit(store: StoreNode) {
        const log = inject(LoggerService);
        const backend = pickBackend(options.storage ?? 'local', log);
        if (!backend) return;

        // Hydrate on boot.
        try {
          const raw = backend.getItem(fullKey(options.key));
          if (raw !== null) {
            const snapshot = JSON.parse(raw) as Partial<TState>;
            patchState(store as WritableStateSource<TState>, snapshot);
          }
        } catch (err) {
          log.warn('store.persistence.hydrate.failed', { key: options.key, err });
        }

        // Save on every subsequent state mutation.
        effect(() => {
          try {
            const current = getState(store as StateSource<TState>) as TState;
            const snapshot = options.pick(current);
            backend.setItem(fullKey(options.key), JSON.stringify(snapshot));
          } catch (err) {
            log.warn('store.persistence.save.failed', { key: options.key, err });
          }
        });
      },
    }),
  );
}
