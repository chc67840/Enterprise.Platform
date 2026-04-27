# 09 — Loading, Empty, Error UI States

Every list/detail page goes through the same four states. The pattern is the same in every feature.

```
loading  →  populated  (happy path)
         →  empty       (loaded but zero results)
         →  error       (loaded but failed)
```

## The canonical four-branch template

```html
@if (store.loading()) {
  <app-skeleton-list />
} @else if (store.error()) {
  <app-error-state
    [error]="store.error()"
    (retry)="store.loadList()"
  />
} @else if (store.isEmpty()) {
  <app-empty-state
    title="No users yet"
    message="Get started by creating your first user."
    actionLabel="New user"
    (action)="goCreate()"
  />
} @else {
  <p-table [value]="store.items()" ...>
    @for (u of store.items(); track u.id) {
      <tr>...</tr>
    } @empty {
      <!-- redundant safety net — `store.isEmpty()` already covers this -->
    }
  </p-table>
}
```

Order matters: **loading → error → empty → populated**. Loading wins so we never show "no data" while the load is still in progress.

## State signals from the store

The store exposes the three flags + the items signal. Components read them directly — no local copies.

```ts
// users.store.ts — relevant signals
loading: boolean
error:   ApiError | null
isEmpty: computed(() => store.ids().length === 0 && !store.loading())
items:   computed(() => /* materialized list */)
```

`isEmpty` is critical — it's "loaded AND empty," not just "items.length === 0." Without the `&& !loading` clause, the empty state flashes for a frame on every reload.

## Skeleton placeholder components

A skeleton is a low-fidelity gray-shape preview that mirrors the layout of the populated state. It signals "loading is happening" without spinners (which become irritating at scale) and reserves layout space (preventing CLS jank when content swaps in).

We don't have a skeleton component library yet — Phase A defers this. When the first skeleton lands, it goes here:

```
src/app/shared/components/skeleton/
├── skeleton.component.ts                  ← <app-skeleton variant="card" />
├── skeleton-list.component.ts             ← <app-skeleton-list rows="5" />
└── skeleton-table.component.ts            ← <app-skeleton-table cols="4" rows="5" />
```

Each skeleton component:
- Renders gray rectangles with a subtle pulse animation (respect `prefers-reduced-motion`)
- Uses brand-token colors (`--ep-color-neutral-200` background, `--ep-color-neutral-100` highlight)
- Has fixed heights matching the populated row heights (avoids CLS)

For now, while skeletons aren't built, use a centered loading message:

```html
@if (store.loading()) {
  <div class="flex justify-center py-12 text-sm text-gray-500">
    <i class="pi pi-spin pi-spinner mr-2"></i> Loading…
  </div>
}
```

Replace with `<app-skeleton-list />` when the component lands.

## Empty state component

A persistent empty state is a feature affordance — give the user a clear next step.

```
src/app/shared/components/empty-state/
└── empty-state.component.ts
```

API:

```ts
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-12 text-center">
      @if (icon()) { <i [class]="icon()" class="mb-4 text-5xl text-gray-300" aria-hidden="true"></i> }
      <h2 class="text-lg font-semibold text-gray-900">{{ title() }}</h2>
      @if (message()) { <p class="mt-2 max-w-sm text-sm text-gray-600">{{ message() }}</p> }
      @if (actionLabel()) {
        <button (click)="action.emit()" class="mt-6 ...">{{ actionLabel() }}</button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly icon = input<string>('pi pi-inbox');
  readonly actionLabel = input<string>('');
  readonly action = output<void>();
}
```

Use it everywhere a list is empty:

```html
@else if (store.isEmpty()) {
  <app-empty-state
    title="No users found"
    message="Try adjusting your filters or create a new user."
    icon="pi pi-users"
    actionLabel="New user"
    (action)="goCreate()"
  />
}
```

## Error state component

```
src/app/shared/components/error-state/
└── error-state.component.ts
```

```ts
@Component({
  selector: 'app-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <i class="pi pi-exclamation-triangle mb-4 text-5xl text-amber-500" aria-hidden="true"></i>
      <h2 class="text-lg font-semibold text-gray-900">{{ title() }}</h2>
      <p class="mt-2 max-w-sm text-sm text-gray-600">{{ subtitle() }}</p>
      @if (showRetry()) {
        <button (click)="retry.emit()" class="mt-6 ...">Try again</button>
      }
    </div>
  `,
})
export class ErrorStateComponent {
  readonly error = input<ApiError | null>(null);
  readonly title = input<string>('Something went wrong');
  readonly subtitle = input<string>('We couldn\'t load this. Please try again.');
  readonly showRetry = input<boolean>(true);
  readonly retry = output<void>();
}
```

The error interceptor ALSO shows a toast for the same error. Inline error state + toast might feel redundant for transient errors but is the right shape for blocking errors (page can't continue without successful load).

## `@defer` for below-fold content

```html
@defer (on viewport; prefetch on idle) {
  <app-heavy-widget [data]="widgetData()" />
} @placeholder {
  <app-skeleton variant="card" />
} @loading (minimum 300ms) {
  <app-skeleton variant="card" />
} @error {
  <app-error-state title="Couldn't load this widget" />
}
```

- **`@placeholder`** — shown immediately, before the chunk starts downloading
- **`@loading`** — shown while the chunk is actively downloading (kicks in on `on viewport`)
- **`minimum 300ms`** — prevents skeleton-flicker on fast connections; the skeleton stays visible at least 300ms even if content lands sooner. Improves perceived smoothness.
- **`prefetch on idle`** — browser fetches the chunk during idle time before the user scrolls; near-instant when they scroll into view

We use `@defer` sparingly today — only `SessionExpiringDialog` in `app-shell`. Add to feature pages with heavy widgets when the dashboard or detail pages grow.

## Skeleton vs. spinner — when to use which

| Use skeleton when | Use spinner when |
|---|---|
| Replacing a known shape (table, card, form) | Action button is processing (Save, Submit) |
| First load of a page | Modal action in flight |
| Below-fold content via `@defer` | Toast / progress bar context |
| Re-loads of a list (small skeleton) | Brief, no shape to mirror |

A spinner inside a button (with the button disabled) for mutations:

```html
<button [disabled]="store.saving()" (click)="save()">
  @if (store.saving()) { <i class="pi pi-spin pi-spinner mr-2"></i> }
  Save
</button>
```

## Cumulative Layout Shift (CLS) — why skeletons matter

A list that goes from "Loading..." (1 line) to a populated table (50 rows) causes the page to jump. The footer shifts down 1500px. CLS is bad UX and bad SEO.

Skeletons reserve the same space the populated content will use:
- 5-row skeleton-list = ~5 × 56px = 280px
- Populated 5-row list = ~5 × 56px = 280px
- Zero shift on swap

Always reserve space.

## Checklist for any new page

```
□ Render branches: loading → error → empty → populated (in that order)
□ Loading state uses skeleton matching populated layout (not just a spinner)
□ Empty state has a clear next action ("Create your first X")
□ Error state has a Try Again button that calls store.loadX() again
□ store.isEmpty includes && !loading (no flash of empty during reload)
□ @defer on below-fold widgets with @placeholder + @loading minimum 300ms
□ Mutation buttons show inline spinner + disabled state via store.saving()
```
