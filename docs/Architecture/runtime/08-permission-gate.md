# 08 — Permission Gate

Three layers of defense, each cheap, each independently bypassable. Follow all three.

```
1. Route guard       (canActivate) — blocks page entry
2. Render-time gate  (visibility) — hides UI elements the user can't act on
3. API authorization (server) — the only one that actually enforces. UI gates are UX, not security.
```

## Layer 1 — Route guards

Two guards, both functional, both compose left-to-right under AND semantics.

### `authGuard`

```ts
// core/guards/auth.guard.ts
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};
```

Pure synchronous signal read. `auth.isAuthenticated()` is a `computed()` derived from the cookie session probe (run once during APP_INITIALIZER). Zero network. The `returnUrl` query param lets the login page send the user back to where they were trying to go.

Applied at the shell level in `app.routes.ts`:

```ts
{
  path: '',
  canActivate: [authGuard],
  children: [/* dashboard, users, etc. */],
}
```

So everything inside the app shell requires authentication. The `/auth/login` route lives OUTSIDE this parent — public.

### `permissionGuard(...policies)` and `anyPermissionGuard(...policies)`

```ts
// core/guards/permission.guard.ts (excerpt)
export function permissionGuard(...requiredPermissions: string[]): CanActivateFn {
  return () => {
    const store = inject(AuthStore);
    const router = inject(Router);
    if (requiredPermissions.length === 0) return true;
    return store.hasAllPermissions(...requiredPermissions)
      ? true
      : router.createUrlTree(['/error/forbidden']);
  };
}

export function anyPermissionGuard(...requiredPermissions: string[]): CanActivateFn {
  return () => {
    const store = inject(AuthStore);
    const router = inject(Router);
    if (requiredPermissions.length === 0) return true;
    return store.hasAnyPermission(...requiredPermissions)
      ? true
      : router.createUrlTree(['/error/forbidden']);
  };
}
```

Two semantics:
- **`permissionGuard('a', 'b')`** — AND. User must have ALL listed permissions.
- **`anyPermissionGuard('a', 'b')`** — OR. User must have AT LEAST ONE.

AND is the default because most route actions map to a single permission; compound requirements are rare and clearer when expressed explicitly.

### Composing on a route

```ts
// users.routes.ts (hypothetical edit route)
{
  path: ':id/edit',
  canActivate: [authGuard, permissionGuard('users:update')],
  loadComponent: () => import('./views/user-edit.component').then(m => m.UserEditComponent),
}
```

Guards run left-to-right. `authGuard` first (cheap), `permissionGuard` second. If auth fails, permission never runs.

### Why guards check `AuthStore.permissions()` not raw token roles

Token roles are coarse labels assigned in your IdP (Azure AD, Auth0). The backend translates roles → effective permissions per request. The `AuthStore` mirrors that translated set so the UI gates with the same logic the API will enforce. If the backend says "users:read", the UI uses "users:read" — never "User" or "ROLE_USER".

`AuthStore.permissions()` is hydrated automatically on login by `AuthService.triggerHydrationOnLogin`. By the time a guarded route is mounted, permissions are loaded.

## Layer 2 — Render-time visibility

Routes guard PAGE ENTRY. Inside a page, individual buttons/menu items still need to be hidden when the user lacks a specific permission.

### Pattern: `@if` guard around the affordance

```html
@if (auth.hasAnyPermission('users:update')) {
  <button (click)="edit(u)">Edit</button>
}

@if (auth.hasAllPermissions('users:delete', 'users:audit')) {
  <button (click)="delete(u)" class="danger">Delete</button>
}
```

`AuthStore.hasAnyPermission(...)` and `hasAllPermissions(...)` are pure signal reads — zero cost. Inject `AuthStore` once in the page component and use it directly.

### Pattern: filter inside `computed`

For lists where each row's actions depend on permission:

```ts
protected readonly visibleActions = computed(() => {
  const acts: Action[] = [];
  if (this.auth.hasAnyPermission('users:update')) acts.push({ key: 'edit', label: 'Edit' });
  if (this.auth.hasAnyPermission('users:delete')) acts.push({ key: 'delete', label: 'Delete' });
  return acts;
});
```

### Already done at the chrome layer

`NavMenuComponent.permissionAllowed()` filters menu items at render time using the same `AuthStore` — so users never see nav links to pages they can't enter. See `shared/layout/components/nav-menu/nav-menu.component.ts`.

### Why HIDE not DISABLE?

When a user lacks permission, hide the button entirely. Don't render it disabled.

Disabled buttons:
- Reveal that the action exists (information disclosure)
- Encourage support tickets ("why is this disabled?")
- Don't say WHY they're disabled

Hidden buttons disappear cleanly. If the user genuinely needs the action, they can request the permission through whatever request-access flow exists. Don't tease.

## Layer 3 — API authorization

The UI gates are UX. The backend is the security boundary. Every endpoint validates the token's permissions independently — even if a malicious user hits the URL directly with a forged request, the backend rejects it.

This is documented in `Architecture/06-Security-Attack-Prevention.md`. As feature authors, you don't write API auth logic — you trust the backend's policy enforcement and you design UI gates to match what the backend will accept.

## Forbidden page

When `permissionGuard` rejects, the user lands at `/error/forbidden` (declared at the top level of `app.routes.ts`):

```ts
{
  path: 'error',
  loadComponent: () => import('./layouts/error-layout/error-layout.component').then(m => m.ErrorLayoutComponent),
  children: [
    {
      path: 'forbidden',
      title: 'Access denied',
      loadComponent: () => import('./features/error-pages/forbidden/forbidden.component').then(m => m.ForbiddenComponent),
    },
    // server-error, offline, maintenance...
  ],
}
```

The forbidden page shows a generic "you don't have access" message + a "Return home" link. Doesn't say WHICH permission was missing — that would help an attacker map the policy surface. If a legit user hits this, the support flow takes over.

## Checklist when adding permissions to a new feature

```
□ Backend endpoints exist and enforce the permissions you'll declare
□ Permission strings match what AuthStore.permissions() yields (coordinate with backend)
□ Page route declares canActivate: [authGuard, permissionGuard(...)] for restricted pages
□ Sub-pages (edit, delete) declare canActivate with the SPECIFIC permission, not the parent's
□ Inside pages, every action button is wrapped in @if (auth.hasAnyPermission(...)) or hasAllPermissions
□ Test: user without permission → /error/forbidden
□ Test: user with permission → page renders normally
□ Test: action button HIDDEN (not disabled) when user lacks the action's permission
□ NEVER show "you don't have permission to X" inline error messages — hide the affordance
```

## Optional extensions

- **`featureFlagGuard(flagName)`** — gates routes behind feature flags. Not built today (no FeatureFlagService); add when first flag-driven feature lands.
- **Tenant-bound permissions** — currently single-tenant. Re-introduce when multi-tenant returns; permissions become `tenantId + permission` pairs.
- **Resource-level authorization** — e.g. "can edit THIS user but not THAT user." Push to backend via `403 Forbidden` on the specific request; UI doesn't try to predict it.
