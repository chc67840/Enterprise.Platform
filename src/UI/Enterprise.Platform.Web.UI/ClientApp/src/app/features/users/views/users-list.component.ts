/**
 * ─── USERS LIST ─────────────────────────────────────────────────────────────────
 *
 * Generic dph-data-table driving the users page. Replaces the hand-rolled
 * PrimeNG table + per-column markup with a config-driven definition (one
 * `TableConfig<UserDto>`) and a `RemoteDataSource<UserDto>` that proxies the
 * existing `UsersApiService.list`.
 *
 * CRUD UX (post-refactor):
 *   - Create     → "New user" toolbar button opens `UserFormDialogComponent`
 *                  in `mode='create'`.
 *   - Edit       → row action "Edit" opens the same dialog in `mode='edit'`.
 *   - Activate   → row action confirms via `ConfirmationService` (no reason
 *                  needed; activation is recoverable) → `store.activateUser`.
 *   - Deactivate → row action opens `UserDeactivateDialogComponent` to
 *                  capture a reason for the audit log → `store.deactivateUser`.
 *
 * STATE OWNERSHIP
 *   The dph-data-table owns its own list lifecycle (loading + error UI). The
 *   store is the source of truth for entity mutations and post-mutation cache
 *   (`entities` + `activeId`); list pages flow straight from `api.list` into
 *   the table without touching the store, which avoided the duplicate-HTTP
 *   trap an earlier draft of this file fell into.
 *
 *   Cross-cutting refresh after a mutation is handled by `bumpRefreshTick`
 *   which the data-table's effect picks up via its query inputs (page bump),
 *   re-firing the fetcher.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DestroyRef } from '@angular/core';
import { type Observable, map } from 'rxjs';

import { AuthStore } from '@core/auth/auth.store';
import { ConfirmDialogService } from '@core/services/confirm-dialog.service';
import { NotificationService } from '@core/services/notification.service';
import {
  DataTableComponent,
  RemoteDataSource,
  type ColumnDef,
  type TableConfig,
  type TablePage,
  type TableQuery,
} from '@shared/components/dph';

import { UserFormDialogComponent, type UserFormMode } from '../components/user-form-dialog.component';
import { UserDeactivateDialogComponent } from '../components/user-deactivate-dialog.component';
import { USER_PERMISSIONS } from '../data/user.permissions';
import type { UserDto } from '../data/user.types';
import { UsersApiService } from '../data/users-api.service';
import { UsersStore } from '../state/users.store';

const PAGE_SIZES = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];
const DEFAULT_PAGE_SIZE: PageSize = 25;

const ACTION = {
  EDIT: 'edit',
  ACTIVATE: 'activate',
  DEACTIVATE: 'deactivate',
} as const;

@Component({
  selector: 'app-users-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogModule,
    DataTableComponent,
    UserFormDialogComponent,
    UserDeactivateDialogComponent,
  ],
  template: `
    <p-confirmDialog
      header="Activate user"
      icon="pi pi-check-circle"
      [style]="{ width: '420px' }"
    />

    <section class="users-list" aria-labelledby="users-list-heading">
      <h2 id="users-list-heading" class="sr-only">Users list</h2>

      <header class="users-list__header">
        <p class="users-list__lede" aria-live="polite">{{ summary() }}</p>
        @if (canCreate()) {
          <button
            type="button"
            class="users-list__cta"
            (click)="openCreate()"
          >
            <i class="pi pi-plus" aria-hidden="true"></i>
            New user
          </button>
        }
      </header>

      <dph-data-table
        [config]="tableConfig"
        [dataSource]="dataSource"
        [totalRecords]="serverTotal()"
        [(page)]="page"
        [(pageSize)]="pageSize"
        (rowClick)="onRowClick($event)"
        (actionClick)="onRowAction($event)"
        (queryChange)="onQueryChange($event)"
      />
    </section>

    <app-user-form-dialog
      [(visible)]="formDialogOpen"
      [mode]="formDialogMode()"
      [user]="formDialogUser()"
      (saved)="onFormSaved()"
    />

    <app-user-deactivate-dialog
      [(visible)]="deactivateDialogOpen"
      [user]="selectedUser()"
      (deactivated)="onDeactivated()"
    />
  `,
  styles: [
    `
      .users-list {
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
      }
      .users-list__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .users-list__lede {
        margin: 0;
        font-size: 0.875rem;
        color: var(--ep-text-secondary, #4b5563);
      }
      .users-list__cta {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 0.875rem;
        background: var(--ep-color-primary, #1b3f73);
        color: #fff;
        font-size: 0.875rem;
        font-weight: 600;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
      }
      .users-list__cta:hover {
        background: var(--ep-color-primary-700, #16335c);
      }
    `,
  ],
})
export class UsersListComponent implements OnInit {
  protected readonly store = inject(UsersStore);
  private readonly api = inject(UsersApiService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly notify = inject(NotificationService);

  // ── Permission selectors ─────────────────────────────────────────────
  protected readonly canCreate = computed(() =>
    this.auth.hasAllPermissions(USER_PERMISSIONS.CREATE),
  );
  protected readonly canWrite = computed(() =>
    this.auth.hasAllPermissions(USER_PERMISSIONS.WRITE),
  );
  protected readonly canActivate = computed(() =>
    this.auth.hasAllPermissions(USER_PERMISSIONS.ACTIVATE),
  );
  protected readonly canDeactivate = computed(() =>
    this.auth.hasAllPermissions(USER_PERMISSIONS.DEACTIVATE),
  );

  // ── Dialog state ─────────────────────────────────────────────────────
  protected readonly formDialogOpen = signal(false);
  protected readonly formDialogMode = signal<UserFormMode>('create');
  protected readonly formDialogUser = signal<UserDto | null>(null);

  protected readonly deactivateDialogOpen = signal(false);
  protected readonly selectedUser = signal<UserDto | null>(null);

  // ── Data table state ─────────────────────────────────────────────────
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(DEFAULT_PAGE_SIZE);
  protected readonly serverTotal = signal(0);

  // ── Derived ──────────────────────────────────────────────────────────
  protected readonly summary = computed(() => {
    const total = this.serverTotal();
    if (total === 0) return 'No users.';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(this.page() * this.pageSize(), total);
    return `${total} total · showing ${start}–${end}`;
  });

  // ── Data source — translates dph TableQuery → UsersApiService.list ───
  protected readonly dataSource = new RemoteDataSource<UserDto>(
    (q: TableQuery): Observable<TablePage<UserDto>> => {
      const search =
        typeof q.globalFilter === 'string' && q.globalFilter.trim().length > 0
          ? q.globalFilter.trim()
          : null;
      return this.api
        .list({ page: q.page, pageSize: q.pageSize, search, activeOnly: null })
        .pipe(
          map((resp) => {
            const total = resp.totalCount ?? resp.items.length;
            this.serverTotal.set(total);
            return { rows: [...resp.items], total };
          }),
        );
    },
  );

  // ── Table column definitions ─────────────────────────────────────────
  private readonly columns: readonly ColumnDef<UserDto>[] = [
    {
      field: 'email',
      header: 'Email',
      type: 'email',
      width: '24rem',
      cssClass: 'font-mono text-sm',
    },
    { field: 'firstName', header: 'First name', type: 'text' },
    { field: 'lastName', header: 'Last name', type: 'text' },
    {
      field: 'isActive',
      header: 'Status',
      type: 'badge',
      width: '7rem',
      align: 'center',
      cellOptions: {
        badgeSeverityMap: { true: 'success', false: 'neutral' },
      },
      format: (value) => (value ? 'Active' : 'Inactive'),
    },
    {
      field: 'lastLoginAt',
      header: 'Last login',
      type: 'datetime',
      width: '12rem',
    },
  ];

  protected readonly tableConfig: TableConfig<UserDto> = {
    columns: this.columns,
    idField: 'id',
    pagination: true,
    pageSizes: [...PAGE_SIZES],
    defaultPageSize: DEFAULT_PAGE_SIZE,
    sortable: false,
    filterable: false,
    globalFilter: true,
    globalFilterFields: ['email', 'firstName', 'lastName'],
    striped: true,
    size: 'md',
    densitySelector: false,
    toolbar: {
      search: true,
      searchPlaceholder: 'Search email or name…',
      refresh: true,
    },
    emptyMessage: 'No users yet.',
    emptyAfterFilterMessage: 'No users match the current filters.',
    rowActions: [
      {
        key: ACTION.EDIT,
        label: 'Edit',
        icon: 'pi pi-pencil',
        severity: 'info',
        visible: () => this.canWrite(),
      },
      {
        key: ACTION.DEACTIVATE,
        label: 'Deactivate',
        icon: 'pi pi-ban',
        severity: 'danger',
        visible: (row) => row.isActive && this.canDeactivate(),
      },
      {
        key: ACTION.ACTIVATE,
        label: 'Activate',
        icon: 'pi pi-check-circle',
        severity: 'success',
        visible: (row) => !row.isActive && this.canActivate(),
      },
    ],
  };

  // ── Lifecycle ────────────────────────────────────────────────────────

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParams as Record<string, string | undefined>;
    const pageNum = Number(qp['page']);
    if (Number.isFinite(pageNum) && pageNum >= 1) this.page.set(Math.floor(pageNum));
    const sizeNum = Number(qp['size']);
    if (PAGE_SIZES.includes(sizeNum as PageSize)) this.pageSize.set(sizeNum as PageSize);

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.syncFromUrl(params as Record<string, string | undefined>));
  }

  // ── Handlers ─────────────────────────────────────────────────────────

  protected openCreate(): void {
    this.formDialogMode.set('create');
    this.formDialogUser.set(null);
    this.formDialogOpen.set(true);
  }

  protected onRowClick(event: { row: UserDto }): void {
    if (this.canWrite()) this.openEdit(event.row);
  }

  protected onRowAction(event: { action: string; row: UserDto }): void {
    switch (event.action) {
      case ACTION.EDIT:
        this.openEdit(event.row);
        break;
      case ACTION.DEACTIVATE:
        this.openDeactivate(event.row);
        break;
      case ACTION.ACTIVATE:
        void this.confirmActivate(event.row);
        break;
    }
  }

  protected onQueryChange(query: TableQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: query.page === 1 ? null : String(query.page),
        size: query.pageSize === DEFAULT_PAGE_SIZE ? null : String(query.pageSize),
        q: query.globalFilter ? query.globalFilter : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onFormSaved(): void {
    this.refreshList();
  }

  protected onDeactivated(): void {
    this.refreshList();
  }

  // ── Internals ────────────────────────────────────────────────────────

  private openEdit(user: UserDto): void {
    this.formDialogMode.set('edit');
    this.formDialogUser.set(user);
    this.formDialogOpen.set(true);
  }

  private openDeactivate(user: UserDto): void {
    this.selectedUser.set(user);
    this.deactivateDialogOpen.set(true);
  }

  private async confirmActivate(user: UserDto): Promise<void> {
    const confirmed = await this.confirm.ask({
      severity: 'success',
      header: 'Activate user',
      message: `Activate ${user.firstName} ${user.lastName}? They will regain access immediately.`,
      acceptLabel: 'Activate',
      rejectLabel: 'Cancel',
      defaultFocus: 'reject',
    });
    if (!confirmed) return;
    this.store.activateUser(user.id);
    this.notify.info('Activating user', `${user.firstName} ${user.lastName} will be activated.`);
    // Schedule a refresh once the activation roundtrip likely completes.
    // The store fires its toast on success and refreshAfterMutation
    // pulls the row; the page-flip re-renders the table.
    queueMicrotask(() => this.refreshList());
  }

  /**
   * Trigger a re-fetch by toggling the page signal and restoring it. The
   * dph-data-table watches its query inputs (page / pageSize / sort / filters /
   * globalFilter) — any change re-runs the data-source fetcher. The
   * one-tick toggle is invisible to the user (no second render lands).
   */
  private refreshList(): void {
    const current = this.page();
    this.page.set(current === 1 ? 2 : 1);
    queueMicrotask(() => this.page.set(current));
  }

  private syncFromUrl(qp: Record<string, string | undefined>): void {
    const pageNum = Number(qp['page']);
    if (Number.isFinite(pageNum) && pageNum >= 1 && pageNum !== this.page()) {
      this.page.set(Math.floor(pageNum));
    }
    const sizeNum = Number(qp['size']);
    if (PAGE_SIZES.includes(sizeNum as PageSize) && sizeNum !== this.pageSize()) {
      this.pageSize.set(sizeNum as PageSize);
    }
  }
}
