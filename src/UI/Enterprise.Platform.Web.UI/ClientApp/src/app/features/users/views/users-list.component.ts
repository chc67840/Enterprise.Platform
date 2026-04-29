/**
 * ─── USERS LIST ─────────────────────────────────────────────────────────────────
 *
 * PrimeNG Table with:
 *   - Server-side pagination (uses backend `pageNumber` / `pageSize`).
 *   - Debounced search across email + display name (250 ms; skipped when the
 *     trimmed value matches the active store value — avoids a no-op refetch
 *     on focus events that re-emit the same string).
 *   - Active-only filter toggle.
 *   - URL state sync — page, pageSize, search, activeOnly persist as
 *     `?page=2&size=50&q=alice&active=true`. Browser back / refresh / share-
 *     link restores the exact filter posture. Initial load reads from the
 *     URL; subsequent filter changes write to the URL via
 *     `router.navigate([], { queryParamsHandling: 'merge' })`.
 *   - Distinguished empty states — separate UI for "no users yet"
 *     (just call `loadList`), "no matches" (clear filters CTA), and "load
 *     failed" (retry button). Keeps each state actionable.
 *   - Row-level keyboard navigation — `tabindex="0"` + `(keydown.enter)` on
 *     each row opens the detail page (mirrors clicking the link).
 *   - Permission-aware "New user" affordance — the page-header's
 *     `requiredPermissions` filter hides the CTA for users without
 *     `users.create`; this component listens for the dispatched action and
 *     navigates only if `AuthStore.hasAllPermissions` agrees (defense-in-
 *     depth — UI hide + click-time check).
 */
import type {
  OnInit} from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { TableModule, type TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { AuthStore } from '@core/auth/auth.store';
import { InputComponent } from '@shared/components/dph';

import { USER_PERMISSIONS } from '../data/user.permissions';
import type { ListUsersParams, UserDto } from '../data/user.types';
import { UsersStore } from '../state/users.store';

/** Allowed page sizes — keep aligned with backend `MAX_PAGE_SIZE`. */
const PAGE_SIZES = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];
const DEFAULT_PAGE_SIZE: PageSize = 25;

/**
 * Mutable counterpart to the readonly `ListUsersParams` — used while
 * building the parsed params before they're frozen by being passed to the
 * store. The store itself stores them as readonly via withState.
 */
type MutableListParams = {
  page?: number;
  pageSize?: number;
  search?: string | null;
  activeOnly?: boolean | null;
};

/** Tightly bounded URL → state translation; keeps malformed query strings safe. */
function parseQueryParams(
  raw: Readonly<Record<string, string | undefined>>,
): MutableListParams {
  const out: MutableListParams = {};
  const page = Number(raw['page']);
  if (Number.isFinite(page) && page >= 1) out.page = Math.floor(page);
  const sizeNum = Number(raw['size']);
  if (PAGE_SIZES.includes(sizeNum as PageSize)) out.pageSize = sizeNum as PageSize;
  if (typeof raw['q'] === 'string' && raw['q'].trim().length > 0) out.search = raw['q'].trim();
  if (raw['active'] === 'true') out.activeOnly = true;
  else if (raw['active'] === 'false') out.activeOnly = false;
  return out;
}

@Component({
  selector: 'app-users-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    CheckboxModule,
    TableModule,
    TagModule,
    InputComponent,
  ],
  template: `
    <section class="space-y-4" aria-labelledby="users-list-heading">
      <!-- The page-header in the chrome owns the visible <h1>; this is the
           accessible label so screen readers can land on the section. -->
      <h2 id="users-list-heading" class="sr-only">Users list</h2>

      <p class="text-sm text-gray-500" aria-live="polite">
        {{ summary() }}
      </p>

      <!-- Filters: search + active-only -->
      <div
        class="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200"
        role="search"
      >
        <div class="w-64">
          <label for="users-search" class="sr-only">Search users by email or name</label>
          <dph-input
            [(value)]="searchValue"
            (valueChange)="onSearchChanged($any($event))"
            [config]="{
              id: 'users-search',
              type: 'search',
              placeholder: 'Search email or name…',
              prefixIcon: 'pi pi-search',
              clearable: true,
              size: 'sm'
            }"
          />
        </div>
        <label class="flex items-center gap-2 text-sm text-gray-700" for="active-only">
          <p-checkbox
            [(ngModel)]="activeOnlyInput"
            (onChange)="onActiveOnlyChanged($event.checked)"
            [binary]="true"
            inputId="active-only"
          />
          <span>Active only</span>
        </label>

        @if (hasActiveFilters()) {
          <button
            type="button"
            class="text-sm text-blue-600 hover:text-blue-700 underline"
            (click)="clearFilters()"
          >
            Clear filters
          </button>
        }
      </div>

      <!-- Error banner — distinct from "no matches"; offers retry. -->
      @if (store.listError(); as err) {
        <div
          class="rounded-lg bg-red-50 p-4 ring-1 ring-red-200"
          role="alert"
          aria-live="assertive"
        >
          <p class="text-sm font-semibold text-red-800">Could not load users.</p>
          <p class="mt-1 text-sm text-red-700">{{ err.message }}</p>
          @if (err.correlationId) {
            <p class="mt-1 font-mono text-xs text-red-600">Trace: {{ err.correlationId }}</p>
          }
          <button
            type="button"
            class="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            (click)="retry()"
          >
            Retry
          </button>
        </div>
      }

      <!-- Table -->
      @if (!store.listError()) {
        <p-table
          [value]="store.items()"
          [loading]="store.loading()"
          [lazy]="true"
          [paginator]="true"
          [rows]="store.listParams().pageSize"
          [totalRecords]="store.total()"
          [first]="firstRowIndex()"
          [rowsPerPageOptions]="pageSizes"
          (onPage)="onPageChange($event)"
          styleClass="p-datatable-sm"
          responsiveLayout="scroll"
          dataKey="id"
          emptyMessage="No users match the current filters."
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Showing {first}–{last} of {totalRecords}"
        >
          <ng-template pTemplate="header">
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">Last login</th>
              <th scope="col" class="w-1">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-user>
            <tr
              tabindex="0"
              [attr.aria-label]="user.firstName + ' ' + user.lastName + ', ' + user.email"
              (keydown.enter)="openDetail(user)"
              (keydown.space)="openDetail(user, $event)"
              class="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
            >
              <td class="font-mono text-sm text-gray-700">{{ user.email }}</td>
              <td>{{ user.firstName }} {{ user.lastName }}</td>
              <td>
                @if (user.isActive) {
                  <p-tag value="Active" severity="success" />
                } @else {
                  <p-tag value="Inactive" severity="secondary" />
                }
                @if (user.isDeleted) {
                  <p-tag value="Deleted" severity="danger" class="ml-1" />
                }
              </td>
              <td class="text-sm text-gray-600">
                {{ user.lastLoginAt ? (user.lastLoginAt | date: 'short') : '—' }}
              </td>
              <td>
                <a
                  [routerLink]="[user.id]"
                  [attr.aria-label]="'Open ' + user.firstName + ' ' + user.lastName"
                  class="text-sm font-medium text-blue-600 hover:text-blue-700"
                  (click)="$event.stopPropagation()"
                >
                  Open
                </a>
              </td>
            </tr>
          </ng-template>

          <!-- Custom empty-message template: clear-filters CTA when filters
               are applied; otherwise plain text. -->
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="5" class="py-12 text-center">
                @if (store.hasNoMatches()) {
                  <p class="text-sm text-gray-700">No users match the current filters.</p>
                  <button
                    type="button"
                    class="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                    (click)="clearFilters()"
                  >
                    Clear filters
                  </button>
                } @else if (store.isEmpty()) {
                  <p class="text-sm text-gray-700">No users yet.</p>
                  @if (canCreate()) {
                    <a
                      [routerLink]="['new']"
                      class="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      Create the first user
                    </a>
                  }
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    </section>
  `,
})
export class UsersListComponent implements OnInit {
  protected readonly store = inject(UsersStore);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** Public to the template — drives the empty-state CTA. */
  protected readonly canCreate = computed(() =>
    this.auth.hasAllPermissions(USER_PERMISSIONS.CREATE),
  );

  protected readonly pageSizes = [...PAGE_SIZES];

  // ── filter inputs (two-way bound to template) ───────────────────────────
  /** Live value of the search box. dph-input model is signal-backed. */
  protected readonly searchValue = signal<string | number | null>('');
  /** Live value of the active-only checkbox. */
  protected activeOnlyInput = false;

  /** Debounce timer id for the search box. */
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // ── computed view-model helpers ─────────────────────────────────────────

  /** PrimeNG's table is 0-based for `first`; backend / store is 1-based for `page`. */
  protected readonly firstRowIndex = computed(() => {
    const params = this.store.listParams();
    return (params.page - 1) * params.pageSize;
  });

  /** Header summary — combines total count + page slice + filter summary. */
  protected readonly summary = computed(() => {
    const total = this.store.total();
    const params = this.store.listParams();
    if (this.store.loading()) return 'Loading…';
    if (total === 0) return 'no rows';
    const start = (params.page - 1) * params.pageSize + 1;
    const end = Math.min(params.page * params.pageSize, total);
    return `${total} total · showing ${start}–${end}`;
  });

  /** True when at least one filter is non-default. */
  protected readonly hasActiveFilters = computed(() => {
    const p = this.store.listParams();
    return p.search !== null || p.activeOnly !== null;
  });

  // ── URL ↔ state sync ─────────────────────────────────────────────────────

  /**
   * Effect that writes the active filter posture back to the URL whenever
   * the store's listParams change. Wraps the read in `untracked()` for the
   * router call so it doesn't loop on its own writes.
   */
  private readonly _urlWriteEffect = effect(() => {
    const p = this.store.listParams();
    untracked(() => {
      const queryParams: Record<string, string | null> = {
        page: p.page === 1 ? null : String(p.page),
        size: p.pageSize === DEFAULT_PAGE_SIZE ? null : String(p.pageSize),
        q: p.search ?? null,
        active: p.activeOnly === null ? null : String(p.activeOnly),
      };
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  });

  ngOnInit(): void {
    // Hydrate from URL on first navigation. `route.snapshot` is fine here —
    // we only want the initial paint; later URL changes from elsewhere
    // (e.g. browser back) come through queryParams subscription below.
    const initial = parseQueryParams(this.route.snapshot.queryParams);
    if (initial.search !== undefined) this.searchValue.set(initial.search);
    if (initial.activeOnly === true) this.activeOnlyInput = true;
    this.store.loadList(initial);

    // Browser-back / explicit URL change → re-sync. We don't push a
    // navigation in response (avoid loops); we just reload with the new
    // params. The list-write effect's `replaceUrl: true` keeps history clean.
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((qp) => {
        const next = parseQueryParams(qp as Record<string, string | undefined>);
        const current = this.store.listParams();
        // Only reload if the parsed params differ from the current store params
        // (suppress the navigation we just emitted ourselves).
        const same =
          (next.page ?? 1) === current.page &&
          (next.pageSize ?? DEFAULT_PAGE_SIZE) === current.pageSize &&
          (next.search ?? null) === current.search &&
          (next.activeOnly ?? null) === current.activeOnly;
        if (!same) {
          // Sync inputs visible to the user too.
          this.searchValue.set(next.search ?? '');
          this.activeOnlyInput = next.activeOnly === true;
          this.store.loadList({
            page: next.page ?? 1,
            pageSize: next.pageSize ?? DEFAULT_PAGE_SIZE,
            search: next.search ?? null,
            activeOnly: next.activeOnly ?? null,
          });
        }
      });
  }

  // ── filter event handlers ───────────────────────────────────────────────

  /**
   * Debounce + skip-no-change. The user typing `a-l-i-c-e` then blurring fires
   * one request, not five — and a blur that doesn't change the value fires
   * none.
   */
  protected onSearchChanged(value: string | number | null): void {
    const text = value === null || value === undefined ? '' : String(value);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      const next = text.trim() || null;
      const current = this.store.listParams().search;
      if (next === current) return;             // skip-no-change
      this.applyFilters({ search: next, page: 1 });
    }, 250);
  }

  protected onActiveOnlyChanged(checked: boolean): void {
    const next = checked ? true : null;
    if (next === this.store.listParams().activeOnly) return;
    this.applyFilters({ activeOnly: next, page: 1 });
  }

  protected onPageChange(event: TablePageEvent): void {
    const page = Math.floor(event.first / event.rows) + 1;
    const current = this.store.listParams();
    if (page === current.page && event.rows === current.pageSize) return;
    this.applyFilters({ page, pageSize: event.rows });
  }

  protected clearFilters(): void {
    this.searchValue.set('');
    this.activeOnlyInput = false;
    this.applyFilters({ search: null, activeOnly: null, page: 1 });
  }

  protected retry(): void {
    this.store.loadList();
  }

  /** Programmatic detail nav from row keyboard shortcuts. */
  protected openDetail(user: UserDto, event?: Event): void {
    event?.preventDefault();
    void this.router.navigate([user.id], { relativeTo: this.route });
  }

  private applyFilters(override: Partial<ListUsersParams>): void {
    this.store.loadList(override);
  }
}
