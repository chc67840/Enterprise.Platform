/**
 * ─── USERS LIST ─────────────────────────────────────────────────────────────────
 *
 * PrimeNG Table with:
 *   - server-side pagination (uses backend `pageNumber`/`pageSize`)
 *   - debounced search across email + display name
 *   - active-only filter toggle
 *   - row click → navigate to detail
 *
 * The store is feature-scoped (provided by `users.routes.ts`); this component
 * subscribes via `inject(UsersStore)` and reads its signals directly in the
 * template. No manual change-detection plumbing — `OnPush` plus signals is
 * the path the rest of the codebase uses.
 */
import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule, type TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { UsersStore } from '../state/users.store';
import type { ListUsersParams } from '../data/user.types';

@Component({
  selector: 'app-users-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    TableModule,
    TagModule,
  ],
  template: `
    <section class="space-y-4">
      <header class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight text-gray-900">Users</h2>
          <p class="mt-1 text-sm text-gray-500">{{ store.total() }} total · {{ pageInfo() }}</p>
        </div>
        <a
          routerLink="new"
          class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          New user
        </a>
      </header>

      <!-- Filters: search + active-only -->
      <div class="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
        <input
          pInputText
          type="search"
          [(ngModel)]="searchInput"
          (ngModelChange)="onSearchChanged($event)"
          placeholder="Search email or name…"
          aria-label="Search users"
          class="w-64"
        />
        <label class="flex items-center gap-2 text-sm text-gray-700">
          <p-checkbox
            [(ngModel)]="activeOnlyInput"
            (onChange)="onActiveOnlyChanged($event.checked)"
            [binary]="true"
            inputId="active-only"
          />
          <span>Active only</span>
        </label>

        @if (store.error(); as err) {
          <span class="ml-auto text-sm text-red-700">
            {{ err.message }}
          </span>
        }
      </div>

      <!-- Table -->
      <p-table
        [value]="store.items()"
        [loading]="store.loading()"
        [lazy]="true"
        [paginator]="true"
        [rows]="store.listParams().pageSize"
        [totalRecords]="store.total()"
        [first]="firstRowIndex()"
        [rowsPerPageOptions]="[10, 25, 50, 100]"
        (onPage)="onPageChange($event)"
        styleClass="p-datatable-sm"
        responsiveLayout="scroll"
        dataKey="id"
        emptyMessage="No users match the current filters."
      >
        <ng-template pTemplate="header">
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Status</th>
            <th>Last login</th>
            <th class="w-1"></th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-user>
          <tr>
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
                class="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Open
              </a>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </section>
  `,
})
export class UsersListComponent implements OnInit {
  protected readonly store = inject(UsersStore);
  private readonly router = inject(Router);

  // ── filter inputs (two-way bound to template) ───────────────────────────
  /** Live value of the search box. Debounced before the store call. */
  protected searchInput = '';
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

  /** Human-readable "showing 26–50" snippet for the header. */
  protected readonly pageInfo = computed(() => {
    const params = this.store.listParams();
    const total = this.store.total();
    if (total === 0) return 'no rows';
    const start = (params.page - 1) * params.pageSize + 1;
    const end = Math.min(params.page * params.pageSize, total);
    return `showing ${start}–${end}`;
  });

  /**
   * Debounce the URL-bound query state so we don't ship a request per keystroke.
   * Uses an effect for completeness (not strictly necessary today) — leaves a
   * hook for syncing search/page back to the URL via `Router.navigate` later.
   */
  private readonly _searchEffect = effect(() => {
    void this.store.listParams();   // explicit dependency for future sync
  });

  /** Reset to the first page on user-initiated filter changes. */
  protected onSearchChanged(value: string): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.applyFilters({ search: value.trim() || null, page: 1 });
    }, 250);
  }

  protected onActiveOnlyChanged(checked: boolean): void {
    this.applyFilters({ activeOnly: checked ? true : null, page: 1 });
  }

  protected onPageChange(event: TablePageEvent): void {
    // PrimeNG passes 0-based `first` + chosen `rows`. Translate.
    const page = Math.floor(event.first / event.rows) + 1;
    this.applyFilters({ page, pageSize: event.rows });
  }

  ngOnInit(): void {
    this.store.loadList();
  }

  private applyFilters(override: Partial<ListUsersParams>): void {
    this.store.loadList(override);
  }
}
