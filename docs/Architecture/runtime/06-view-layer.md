# 06 — View Layer

Page components live in `views/`. One file per route. Standalone, OnPush, signal-input — same shape as every other component in the app.

## Anatomy

```ts
@Component({
  selector: 'app-users-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [/* PrimeNG modules + shared components used in the template */],
  template: `...`,
  // Sibling SCSS file via styleUrl — the inline `styles: []` pattern was
  // retired in the 2026-04-29 SCSS migration; see Demo/scss-migration-audit.md.
  styleUrl: './users-list.component.scss',
})
export class UsersListComponent {
  // 1. INJECTIONS
  protected readonly store = inject(UsersStore);   // protected — template needs it
  private   readonly router = inject(Router);

  // 2. INPUTS (route params via withComponentInputBinding, or [config] from parent)
  // List view typically has no inputs — it owns the URL.
  // Detail view: `readonly id = input.required<string>();`

  // 3. OUTPUTS (rare on page components — they're usually leaves)

  // 4. LOCAL STATE (signals only — no class properties)
  // Most state lives in the store. Local signals only for ephemeral UI:
  // protected readonly showDeleteConfirm = signal(false);

  // 5. EFFECTS (signal-driven side effects)
  constructor() {
    this.store.loadList();   // kick off the load
  }

  // 6. EVENT HANDLERS
  protected open(id: string): void {
    void this.router.navigate(['/users', id]);
  }
}
```

## Decisions

### Page components inject the store; sub-components receive data via inputs

A page component is the integration point for one URL. It injects the store, reads its signals, fires its methods. Sub-components (list rows, edit forms) take signal inputs and emit outputs — they don't know about the store.

This keeps sub-components testable in isolation (no DI setup) and reusable (same row component for any list of users).

### Signal inputs (`input.required<T>()` / `input<T>(default)`)

```ts
readonly id = input.required<string>();              // required, no default
readonly variant = input<'flat' | 'mega'>('flat');   // optional with default
```

NEVER use `@Input()` decorators. Signal inputs:
- Are reactive — putting them in `computed()` or `effect()` automatically tracks changes
- Type-narrow correctly with `input.required<T>` (no `T | undefined` ambiguity)
- Survive zoneless change detection cleanly

For route params, declare them as required signal inputs and rely on `withComponentInputBinding()` (set in `provideRouter`):

```ts
// Route: { path: ':id', component: UserDetailComponent }
// Component:
readonly id = input.required<string>();   // populated automatically from /:id
```

No `ActivatedRoute.paramMap.subscribe(...)`. No `inject(ActivatedRoute)`.

### Outputs (`output<T>()`)

```ts
readonly action = output<NavActionEvent>();
readonly logout = output<NavLogoutEvent>();
```

NEVER use `@Output() new EventEmitter<T>()`. `output<T>()`:
- Is a function with `.emit(value)` (same calling convention)
- Auto-cleans on destroy
- Plays nicely with the parent's `(action)="onAction($event)"` template binding

### Effects vs. ngOnInit vs. constructor

| Where | When |
|---|---|
| **Constructor** | Synchronous setup that must run before the first render. Subscribing to `route.data`, kicking off `store.loadList()`. |
| **`effect(() => ...)`** | Signal-driven side effects. Watch a signal, do something. Auto-tracks dependencies. |
| **`ngOnInit`** | Avoid in zoneless. Constructor + effects cover everything. |
| **`afterNextRender(() => ...)`** | DOM access that needs the rendered tree (rare; ViewChild signal works for most cases). |

```ts
// Effect example: when route param changes, reload
constructor() {
  effect(() => {
    const id = this.id();   // tracks the route param signal
    this.store.loadById(id);
  });
}
```

### Template control flow — `@if`/`@for`/`@switch`

NEVER use `*ngIf` / `*ngFor` / `*ngSwitch`. The `@if`/`@for` block syntax:
- Has explicit `track` keyword on `@for` (compile error if you forget)
- Supports `@empty` block on `@for`
- Supports `@placeholder` / `@loading` / `@error` on `@defer`
- Compiles to ~30% smaller bundle than the structural directives

```html
@if (store.loading()) {
  <app-skeleton variant="list" />
} @else if (store.isEmpty()) {
  <app-empty-state title="No users" message="..." />
} @else {
  <p-table [value]="store.items()" ...>
    @for (u of store.items(); track u.id) {
      <tr (click)="open(u.id)">
        <td>{{ u.firstName }} {{ u.lastName }}</td>
      </tr>
    }
  </p-table>
}
```

See `09-empty-skeleton-states.md` for the full pattern.

### Page header — set via PageHeaderService for dynamic titles

The sub-nav orchestrator picks up `data.pageHeader` from the route automatically. For dynamic titles (entity name from API), inject `PageHeaderService`:

```ts
constructor() {
  effect(() => {
    const u = this.store.active();
    if (!u) return;
    inject(PageHeaderService).set({
      title: `${u.firstName} ${u.lastName}`,
      subtitle: u.email,
      badge: { label: u.isActive ? 'ACTIVE' : 'INACTIVE', variant: u.isActive ? 'success' : 'neutral' },
      backRoute: '/users',
      primaryAction: { label: 'Edit', actionKey: 'users.edit' },
    });
  });
}
```

`PageHeaderService` auto-clears on `NavigationStart`, so the next page sees a clean slate. See `Architecture/UI-Sub-Nav-Zone.md`.

### Action emit → app-shell dispatcher

Page-header CTAs emit `actionKey` strings. These bubble through `<app-sub-nav-orchestrator (action)="...">` → `<app-app-shell>.onPageHeaderAction(actionKey)` → `onNavAction({ source: 'menu', actionKey })`. The shell's `onNavAction` switch dispatches to routes:

```ts
// app-shell.component.ts
switch (e.actionKey) {
  case 'auth.logout':   return this.authService.logout();
  case 'help.open':     return void this.router.navigateByUrl('/help');
  case 'nav.home':      return void this.router.navigateByUrl('/');
  case 'users.create':  return void this.router.navigateByUrl('/users/new');
  // ...
}
```

For feature-specific actions that need access to the feature's store (e.g. `users.edit` → call `store.beginEdit(id)`), handle them in the page component instead of the shell. The shell handles only navigation actions.

### NEVER do these in a page component

```ts
// ❌ Constructor injection
constructor(private store: UsersStore) {}

// ❌ Class property mutation (won't trigger CD in zoneless)
private user: UserDto | null = null;
loadUser() { this.api.get(id).subscribe(u => this.user = u); }

// ❌ Manual subscribe + unsubscribe (use signals or async pipe)
private sub: Subscription;
ngOnInit() { this.sub = this.foo$.subscribe(...); }
ngOnDestroy() { this.sub.unsubscribe(); }

// ❌ NgModule decorators
@NgModule({ ... })

// ❌ Decorator-based inputs
@Input() user!: UserDto;

// ❌ Structural directives
<div *ngIf="user"><div *ngFor="let item of items">

// ❌ Render own <h1> when route has data.pageHeader
<h1>Users</h1>
```

## Optional extensions

- **`@defer (on viewport)`** for below-fold widgets in dense dashboards. Costs are documented in `09`.
- **`@let`** for binding a value once per template (Angular 19+). Useful when reading the same signal 3+ times in a template.
- **Reactive Forms** for non-trivial create/edit forms. Don't go template-driven for anything beyond a single-input search box. Forms feature has its own conventions (next time someone needs them, document here).
- **CDK overlay** for custom modals beyond what PrimeNG dialogs cover.
