# 10 — Test Scaffolding

Three spec files per feature. One per layer. Each tests its layer in isolation; cross-layer integration is verified by E2E (Playwright, separate suite).

```
data/<feature>-api.service.spec.ts    ← HTTP boundary contract
state/<feature>.store.spec.ts         ← state transitions
views/*.component.spec.ts             ← smoke specs (renders, dispatches)
```

## Test runner — Vitest

We use Vitest via `@angular/build:unit-test` (Angular 21+). Specs live next to source. Globals enabled (no `import { describe, it, expect }`).

```ts
// vitest.config.ts (excerpt — already configured)
export default defineConfig({
  resolve: { alias: { '@core': r('src/app/core'), /* ... */ } },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
});
```

Coverage thresholds are per-tier (interceptors 80%, guards 90%, store 75%). Features have a 40% baseline so feature additions don't break CI before tests exist.

## Spec 1 — Api service

Validates the HTTP boundary contract: URL, params, headers, response parsing.

```ts
// features/users/data/users-api.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_BASE_URL } from '@core/http/api-config.token';

import { UsersApiService } from './users-api.service';
import { DEFAULT_LIST_PARAMS } from './user.types';

describe('UsersApiService', () => {
  let service: UsersApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
        UsersApiService,
      ],
    });
    service = TestBed.inject(UsersApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list — sends GET with paging params', () => {
    service.list({ ...DEFAULT_LIST_PARAMS, page: 2, search: 'jane' }).subscribe();

    const req = http.expectOne(
      (r) => r.url === 'http://api.test/users' && r.method === 'GET',
    );
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('25');
    expect(req.request.params.get('search')).toBe('jane');
    req.flush({ items: [], pageNumber: 2, pageSize: 25, totalCount: 0 });
  });

  it('list — parses valid response via Zod', (done) => {
    service.list(DEFAULT_LIST_PARAMS).subscribe((resp) => {
      expect(resp.items).toHaveLength(1);
      expect(resp.items[0]?.email).toBe('jane@example.com');
      done();
    });

    http.expectOne('http://api.test/users?page=1&pageSize=25').flush({
      items: [{
        id: '11111111-1111-1111-1111-111111111111',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        externalIdentityId: null,
        isActive: true,
        lastLoginAt: null,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        createdAt: '2026-04-26T00:00:00+00:00',
        createdBy: 'system',
        modifiedAt: null,
        modifiedBy: null,
      }],
      pageNumber: 1,
      pageSize: 25,
      totalCount: 1,
    });
  });

  it('list — rejects malformed response (Zod throws)', (done) => {
    service.list(DEFAULT_LIST_PARAMS).subscribe({
      error: (err) => {
        expect(err.name).toBe('ZodError');
        done();
      },
    });
    http.expectOne('http://api.test/users?page=1&pageSize=25').flush({
      items: [{ id: 'not-a-uuid' }],   // missing required fields
      pageNumber: 1, pageSize: 25, totalCount: 1,
    });
  });

  it('create — sends POST with Idempotency-Key header', () => {
    service.create({ email: 'a@b.c', firstName: 'A', lastName: 'B', externalIdentityId: null }).subscribe();
    const req = http.expectOne('http://api.test/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    req.flush({ /* valid UserDto */ });
  });

  it('create — honors caller-supplied Idempotency-Key', () => {
    service.create(
      { email: 'a@b.c', firstName: 'A', lastName: 'B', externalIdentityId: null },
      { idempotencyKey: 'fixed-key-123' },
    ).subscribe();
    const req = http.expectOne('http://api.test/users');
    expect(req.request.headers.get('Idempotency-Key')).toBe('fixed-key-123');
    req.flush({ /* valid UserDto */ });
  });
});
```

What this catches:
- URL drift (someone refactors the route)
- Param shape changes (page → pageNumber)
- Schema drift (Zod throws → loud failure, not silent undefined)
- Header omissions (Idempotency-Key missed on a new mutation)

## Spec 2 — Store

Validates state transitions: setting flags, normalizing responses, error capture.

```ts
// features/users/state/users.store.spec.ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { NotificationService } from '@core/services/notification.service';

import { UsersApiService } from '../data/users-api.service';
import { UsersStore } from './users.store';

describe('UsersStore', () => {
  let store: InstanceType<typeof UsersStore>;
  let api: { list: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn>; /* ... */ };

  beforeEach(() => {
    api = { list: vi.fn(), getById: vi.fn(), create: vi.fn(), rename: vi.fn(), changeEmail: vi.fn(), activate: vi.fn(), deactivate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        UsersStore,
        { provide: UsersApiService, useValue: api },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    store = TestBed.inject(UsersStore);
  });

  it('initial state', () => {
    expect(store.ids()).toEqual([]);
    expect(store.entities()).toEqual({});
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.isEmpty()).toBe(true);
  });

  it('loadList — flips loading then populates ids/entities/total on success', () => {
    api.list.mockReturnValue(of({
      items: [
        { id: '1', firstName: 'A', lastName: 'B', email: 'a@b.c', /* ... */ } as any,
      ],
      pageNumber: 1, pageSize: 25, totalCount: 1,
    }));

    store.loadList();

    expect(api.list).toHaveBeenCalledOnce();
    expect(store.loading()).toBe(false);   // settled synchronously since `of` is sync
    expect(store.ids()).toEqual(['1']);
    expect(store.entities()['1']?.firstName).toBe('A');
    expect(store.total()).toBe(1);
    expect(store.error()).toBeNull();
  });

  it('loadList — captures ApiError on failure, clears loading', () => {
    api.list.mockReturnValue(throwError(() => ({ code: 'X', message: 'boom' })));
    store.loadList();
    expect(store.loading()).toBe(false);
    expect(store.error()?.code).toBe('X');
  });

  it('isEmpty — true only when not loading AND no items', () => {
    expect(store.isEmpty()).toBe(true);             // initial: empty + not loading
    api.list.mockReturnValue(of({ items: [], pageNumber: 1, pageSize: 25, totalCount: 0 }));
    store.loadList();
    expect(store.isEmpty()).toBe(true);             // loaded + still empty
  });

  it('createUser — fires success notification + caches new user', () => {
    api.create.mockReturnValue(of({ id: '99', firstName: 'X', /* ... */ } as any));
    const notify = TestBed.inject(NotificationService);
    store.createUser({ email: 'x@y.z', firstName: 'X', lastName: 'Y', externalIdentityId: null });
    expect(store.entities()['99']?.firstName).toBe('X');
    expect(store.activeId()).toBe('99');
    expect(notify.success).toHaveBeenCalled();
  });
});
```

What this catches:
- State transitions out of order (loading flag stuck true after error)
- Computed signal regression (`isEmpty` always returns true)
- Notification side effects missed
- Active id not set after create

## Spec 3 — View component (smoke)

Validates the component renders, accepts inputs, emits outputs. Doesn't simulate full user flow — that's E2E.

```ts
// features/users/views/users-list.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { UsersStore } from '../state/users.store';
import { UsersListComponent } from './users-list.component';

describe('UsersListComponent', () => {
  let mockStore: { items: any; loading: any; error: any; isEmpty: any; loadList: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockStore = {
      items: signal([]),
      loading: signal(false),
      error: signal(null),
      isEmpty: signal(true),
      loadList: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UsersStore, useValue: mockStore },
      ],
    });
  });

  it('renders without crashing', () => {
    const fixture = TestBed.createComponent(UsersListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('calls store.loadList on construction', () => {
    TestBed.createComponent(UsersListComponent);
    expect(mockStore.loadList).toHaveBeenCalledOnce();
  });

  it('shows empty state when store.isEmpty is true', () => {
    mockStore.isEmpty.set(true);
    const fixture = TestBed.createComponent(UsersListComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text.toLowerCase()).toContain('no users');
  });
});
```

What this catches:
- Template syntax errors (compile fails immediately)
- Missing imports in `@Component({ imports: [...] })`
- Constructor side-effect missing (loadList not called)
- Empty-state copy regression

What NOT to test in unit specs:
- Click → router navigation (E2E)
- Form submit → API call → toast (E2E)
- Visual layout / styling (visual regression suite)

## Setup files

`src/test-setup.ts` runs before every spec — sets up Angular's test bed:

```ts
import '@analogjs/vitest-angular/setup-zoneless';
// Provides setUpTestBed(...) for zoneless testing
```

This file is configured in `vitest.config.ts` `setupFiles`. Don't add per-spec setup unless absolutely necessary; spec files should be self-contained.

## Conventions

- **`describe('ServiceName', () => { ... })`** — one outer describe per file, matches the source file's primary export
- **`it('does X — produces Y when Z', ...)`** — descriptive name; em-dash separates "what" from "context"
- **Mock services with `vi.fn()` + `useValue`** — not `vi.mock()` (path-based mocking is brittle in Vitest with Angular)
- **`done` callback for async assertions in observables** — or `firstValueFrom(...)` + `await`. Avoid raw `setTimeout`s.
- **No spec for trivial files** — `*.types.ts`, `*.schemas.ts` (the api service spec exercises the schemas already), barrel `index.ts`, `*.config.ts`
- **Coverage exclusions** — `vitest.config.ts` already excludes `*.spec.ts`, `*.types.ts`, `*.config.ts`, `index.ts` files

## When you add a new feature

```
□ Created data/<feature>-api.service.spec.ts
   □ Tests every method's URL + params + Idempotency-Key
   □ Tests Zod parse success + failure paths
□ Created state/<feature>.store.spec.ts
   □ Initial state assertion
   □ Each rxMethod's success path (state after `flush`)
   □ Each rxMethod's error path (error captured, flags cleared)
   □ Computed signals (especially isEmpty edge cases)
□ Created views/*.component.spec.ts (one per page component)
   □ Renders without crashing
   □ Constructor side effects fired
   □ Empty / error / loading branches each rendered
□ Run vitest run → all pass
□ Run vitest --coverage → no regression in tier thresholds
```

## Optional extensions

- **`@analogjs/vitest-angular/component-testing`** — spin up real PrimeNG components in tests. Useful for testing complex form interactions; heavier than smoke specs.
- **Playwright E2E** — separate suite under `e2e/`. Tests the full URL-to-render path. Build when first multi-step user flow needs regression coverage.
- **Visual regression** — `@playwright/test` + screenshot diffs. Build when chrome / theme changes start causing accidental visual breaks.
- **Mutation testing** — Stryker for finding spec gaps. Premium tooling; revisit when coverage is high but bugs still slip through.
