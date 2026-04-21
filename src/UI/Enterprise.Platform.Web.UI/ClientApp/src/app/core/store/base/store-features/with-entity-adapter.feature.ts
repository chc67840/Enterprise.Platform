/**
 * ─── withEntityAdapter() ────────────────────────────────────────────────────────
 *
 * O(1) add / upsert / remove / replace helpers that mutate the normalized
 * `ids: readonly string[]` + `entities: Record<string, T>` pair without
 * spreading the whole dictionary on every change.
 *
 * WHY
 *   `createEntityStore` currently uses `{ ...store.entities(), [id]: ... }`
 *   spread patterns. That's O(n) per mutation and becomes measurable once a
 *   list holds thousands of rows (think audit log, notifications, events).
 *   `withEntityAdapter` drops pre-written mutators that do the work in-place
 *   inside a single `patchState` call, preserving the `readonly` surface.
 *
 * USAGE
 *   ```ts
 *   const UsersStore = signalStore(
 *     withState<EntityDataState<User>>(initial),
 *     withEntityAdapter<User>(),
 *     // ...other features
 *   );
 *
 *   store.upsertOne(user);          // add or replace
 *   store.removeMany(['id1','id2']); // splice ids + delete entity keys
 *   store.setAll(users);             // full replacement
 *   ```
 *
 * CONTRACT
 *   Every mutator preserves id ORDER (new entities are appended; splice
 *   preserves relative order of survivors). `setAll` replaces both id order
 *   AND the dictionary — use it when loading a fresh page.
 *
 * TYPING CAVEAT
 *   The composing store is expected to already carry `EntityDataState<T>`
 *   (via `withState<EntityDataState<T>>(...)` upstream). Because ngrx-signals
 *   21 doesn't thread generics through feature-graph compositions, the
 *   internal `store` parameter is `any` and narrowed via explicit cast. The
 *   public API stays strongly typed via the `T` generic on every mutator.
 */
import {
  patchState,
  signalStoreFeature,
  withMethods,
  type WritableStateSource,
} from '@ngrx/signals';

import type { BaseEntity } from '@core/models';
import type { EntityDataState } from '../base-entity.types';

/**
 * Opaque feature-graph node — generics are carried on the public API; we
 * narrow this via `unknown` cast to the specific reader shape we need per
 * method. Avoids `any` while preserving the tradeoff that ngrx-signals 21
 * doesn't thread generics through feature-graph compositions.
 */
type StoreNode = Record<string, unknown>;

export function withEntityAdapter<T extends BaseEntity>() {
  return signalStoreFeature(
    withMethods((store: StoreNode) => {
      const s = store as unknown as {
        ids(): readonly string[];
        entities(): Readonly<Record<string, T>>;
      };
      // Narrow-cast for writes — `patchState` demands a `WritableStateSource`.
      // We share the single cast across every mutator below.
      const writable = store as unknown as WritableStateSource<EntityDataState<T>>;

      return {
        /** Adds an entity, or replaces it if an entry with the same id exists. */
        upsertOne(entity: T): void {
          const existing = s.ids().includes(entity.id);
          patchState(writable, {
            ids: existing ? s.ids() : [...s.ids(), entity.id],
            entities: { ...s.entities(), [entity.id]: entity },
          } as Partial<EntityDataState<T>>);
        },

        /** Adds / replaces a batch. Order: existing ids preserved, new ids appended in input order. */
        upsertMany(entities: readonly T[]): void {
          const idSet = new Set(s.ids());
          const nextIds = [...s.ids()];
          const nextEntities: Record<string, T> = { ...s.entities() };
          for (const e of entities) {
            if (!idSet.has(e.id)) {
              nextIds.push(e.id);
              idSet.add(e.id);
            }
            nextEntities[e.id] = e;
          }
          patchState(writable, {
            ids: nextIds,
            entities: nextEntities,
          } as Partial<EntityDataState<T>>);
        },

        /** Removes one id + its entity. No-op when absent. */
        removeOne(id: string): void {
          if (!s.ids().includes(id)) return;
          const nextEntities = { ...s.entities() };
          delete nextEntities[id];
          patchState(writable, {
            ids: s.ids().filter((x) => x !== id),
            entities: nextEntities,
          } as Partial<EntityDataState<T>>);
        },

        /** Bulk remove — efficient for `bulkDelete` paths. */
        removeMany(ids: readonly string[]): void {
          if (ids.length === 0) return;
          const idSet = new Set(ids);
          const nextEntities = { ...s.entities() };
          for (const id of ids) delete nextEntities[id];
          patchState(writable, {
            ids: s.ids().filter((x) => !idSet.has(x)),
            entities: nextEntities,
          } as Partial<EntityDataState<T>>);
        },

        /**
         * Full replacement — use after a paginated list loads. Sets `ids` to the
         * server-ordered sequence and `entities` to the derived dictionary.
         */
        setAll(entities: readonly T[]): void {
          const nextEntities: Record<string, T> = {};
          const nextIds: string[] = [];
          for (const e of entities) {
            nextEntities[e.id] = e;
            nextIds.push(e.id);
          }
          patchState(writable, {
            ids: nextIds,
            entities: nextEntities,
          } as Partial<EntityDataState<T>>);
        },

        /** Empties ids + entities but leaves pagination / search / selection alone. */
        clearEntities(): void {
          patchState(writable, {
            ids: [],
            entities: {},
          } as Partial<EntityDataState<T>>);
        },
      };
    }),
  );
}
