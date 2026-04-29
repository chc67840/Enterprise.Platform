/**
 * ─── DATA TABLE DEMO — comprehensive showcase ───────────────────────────────────
 *
 * One page, many sections — every flag the wrapper exposes, with realistic
 * data shapes (users, orders, tickers, support tickets, audit log).
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { interval, of, throwError, type Observable } from 'rxjs';
import { delay, take } from 'rxjs/operators';

import {
  DataTableComponent,
  LiveDataTableComponent,
  RemoteDataSource,
  ToastService,
  type ColumnDef,
  type DataSource,
  type TableConfig,
  type TablePage,
  type TableQuery,
} from '@shared/components/dph';

const SECTION_STYLES = `
  :host { display: block; }
  .dph-section { padding: 1.25rem; border: 1px solid var(--ep-color-neutral-200); border-radius: var(--ep-radius-lg); background: #fff; margin-bottom: 1rem; }
  .dph-section h3 { margin: 0 0 0.25rem; font-size: 0.9375rem; font-weight: 600; color: var(--ep-color-neutral-900); }
  .dph-section p { margin: 0 0 0.875rem; font-size: 0.8125rem; color: var(--ep-color-neutral-600); }
  .dph-section h3 .pill { display: inline-block; margin-left: 0.5rem; padding: 0.0625rem 0.5rem; background: var(--ep-color-primary-50); color: var(--ep-color-primary-800); border-radius: 9999px; font-size: 0.625rem; font-weight: 700; vertical-align: middle; }
  code { background: var(--ep-color-neutral-100); padding: 0.125rem 0.25rem; border-radius: 4px; font-size: 0.75rem; }
  .row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .row > button {
    padding: 0.375rem 0.625rem; border: 1px solid var(--ep-color-neutral-300);
    background: #fff; border-radius: var(--ep-radius-md); cursor: pointer; font-size: 0.75rem;
  }
  .row > button:hover { background: var(--ep-color-neutral-50); }
`;

// ─── Realistic data factories ───────────────────────────────────────────────

interface DemoUser extends Record<string, unknown> {
  id: number;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
  status: 'active' | 'pending' | 'inactive' | 'banned';
  isVerified: boolean;
  rating: number;
  progress: number;
  salary: number;
  joinedAt: string;
  lastSeen: string;
  tags: string[];
  tickets: number;
  trend: number[];
  bio: string;
  team: string[];
  homepage: string;
  phone: string;
}

const ROLES = ['Admin', 'Developer', 'Designer', 'Manager', 'Analyst', 'QA', 'Support', 'Marketing'];
const STATUSES: Array<'active' | 'pending' | 'inactive' | 'banned'> = ['active', 'pending', 'inactive', 'banned'];
const TAGS_POOL = ['frontend', 'backend', 'devops', 'mobile', 'design', 'product', 'pm', 'sre', 'security', 'data'];

function generateUsers(n: number): readonly DemoUser[] {
  const out: DemoUser[] = [];
  for (let i = 1; i <= n; i++) {
    const role = ROLES[i % ROLES.length] as string;
    const status = STATUSES[i % STATUSES.length] as 'active' | 'pending' | 'inactive' | 'banned';
    const first = ['Jane', 'John', 'Alice', 'Bob', 'Carla', 'Dave', 'Erin', 'Frank', 'Gita', 'Henry', 'Ivy', 'James'][i % 12]!;
    const last = ['Doe', 'Smith', 'Wong', 'Brown', 'Diaz', 'Lee', 'Patel', 'Khan', 'Garcia', 'Singh', 'Park'][i % 11]!;
    const name = `${first} ${last}`;
    const tagCount = (i % 4) + 1;
    out.push({
      id: i,
      name,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@acme.com`,
      avatarUrl: `https://i.pravatar.cc/64?u=${i}`,
      role,
      status,
      isVerified: i % 3 !== 0,
      rating: 1 + (i % 5),
      progress: (i * 13) % 101,
      salary: 50000 + (i % 10) * 7500 + (i % 5) * 2000,
      joinedAt: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      lastSeen: new Date(Date.now() - (i % 30) * 3_600_000).toISOString(),
      tags: TAGS_POOL.slice(i % 8, (i % 8) + tagCount),
      tickets: i % 17,
      trend: Array.from({ length: 12 }, (_, k) => 50 + Math.sin((i + k) * 0.6) * 30 + Math.random() * 8),
      bio: 'Builds things. Loves coffee. Cat enthusiast. Once shipped a feature on a Friday night.',
      team: [`${first} ${last}`, ROLES[(i + 1) % ROLES.length]!, ROLES[(i + 2) % ROLES.length]!, ROLES[(i + 3) % ROLES.length]!],
      homepage: `https://acme.com/people/${i}`,
      phone: `+1-555-${String(1000 + i).slice(0, 3)}-${String(2000 + i).slice(0, 4)}`,
    });
  }
  return out;
}

interface OrderLine extends Record<string, unknown> {
  sku: string;
  product: string;
  qty: number;
  unitPrice: number;
  total: number;
  shipments: Shipment[];
}

interface Shipment extends Record<string, unknown> {
  trackingNo: string;
  carrier: string;
  status: 'preparing' | 'in-transit' | 'delivered';
  eta: string;
}

interface DemoOrder extends Record<string, unknown> {
  id: string;
  customer: string;
  email: string;
  total: number;
  status: 'paid' | 'pending' | 'shipped' | 'cancelled';
  placedAt: string;
  lines: OrderLine[];
}

function generateOrders(n: number): readonly DemoOrder[] {
  const customers = ['Acme Corp', 'Globex Inc', 'Initech', 'Umbrella', 'Soylent', 'Wayne Enterprises', 'Cyberdyne', 'Stark Industries'];
  const products = ['Widget Pro', 'Gizmo Ultra', 'Sprocket Plus', 'Cog 3000', 'Doohickey X', 'Thingamajig'];
  const statuses: Array<DemoOrder['status']> = ['paid', 'pending', 'shipped', 'cancelled'];
  const out: DemoOrder[] = [];
  for (let i = 1; i <= n; i++) {
    const lineCount = (i % 4) + 1;
    const lines: OrderLine[] = [];
    for (let j = 0; j < lineCount; j++) {
      const qty = ((i + j) % 5) + 1;
      const unitPrice = 19.99 + ((i + j) % 7) * 5;
      const shipCount = (j % 2) + 1;
      const shipments: Shipment[] = Array.from({ length: shipCount }, (_, k) => ({
        trackingNo: `1Z${String(i).padStart(4, '0')}${String(j).padStart(2, '0')}${k}`,
        carrier: ['UPS', 'FedEx', 'USPS', 'DHL'][(i + j + k) % 4]!,
        status: ['preparing', 'in-transit', 'delivered'][(i + j + k) % 3]! as Shipment['status'],
        eta: new Date(Date.now() + (k + 1) * 86_400_000 * 2).toISOString().slice(0, 10),
      }));
      lines.push({
        sku: `SKU-${1000 + i * 10 + j}`,
        product: products[(i + j) % products.length]!,
        qty,
        unitPrice,
        total: qty * unitPrice,
        shipments,
      });
    }
    const total = lines.reduce((acc, l) => acc + l.total, 0);
    out.push({
      id: `ORD-${String(2024_00_000 + i).slice(0, 8)}`,
      customer: customers[i % customers.length]!,
      email: `orders@${customers[i % customers.length]!.toLowerCase().replace(/\s+/g, '')}.com`,
      total,
      status: statuses[i % statuses.length]!,
      placedAt: new Date(Date.now() - i * 60_000 * 90).toISOString().slice(0, 10),
      lines,
    });
  }
  return out;
}

interface Ticker extends Record<string, unknown> {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  history: number[];
}

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX', 'AMD', 'INTC', 'IBM', 'ORCL'];

function generateTickers(): Ticker[] {
  return SYMBOLS.map((sym, i) => {
    const price = 100 + i * 17 + Math.random() * 50;
    const change = (Math.random() - 0.45) * 5;
    return {
      id: sym,
      symbol: sym,
      name: `${sym} Holdings`,
      price,
      change,
      changePct: (change / price) * 100,
      volume: Math.floor(Math.random() * 1_000_000),
      history: Array.from({ length: 20 }, () => price + (Math.random() - 0.5) * 10),
    };
  });
}

// ─── MAIN DEMO COMPONENT ────────────────────────────────────────────────────

@Component({
  selector: 'app-demo-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DataTableComponent, LiveDataTableComponent],
  template: `
    <!-- ── 1. EVERYTHING AT ONCE ───────────────────────────────────── -->
    <div class="dph-section">
      <h3>Universal showcase <span class="pill">17 cell types · filters · multi-sort · chooser · density · export</span></h3>
      <p>
        Toolbar (search, refresh, density, chooser, export), all column filter types (text / number / date /
        boolean / enum / multi-enum), multi-sort (Ctrl+click), pin-left ID column, frozen actions, mobile-priority
        hide, sparkline / rating / progress / chips / avatar-group / status-dot / multi-line / link / image cells.
      </p>
      <dph-data-table
        [config]="universalConfig"
        [data]="users()"
        [(selection)]="selectedUsers"
        (rowClick)="open($event.row)"
        (actionClick)="action($event)"
        (bulkAction)="bulk($event)"
        (cellEdit)="edit($event)"
      />
    </div>

    <!-- ── 2. ASYNC + DATA SOURCE + ERROR + RETRY ──────────────────── -->
    <div class="dph-section">
      <h3>Async / DataSource <span class="pill">simulated 700ms latency · cancellation · retry</span></h3>
      <p>
        Switch to server-mode by passing <code>[dataSource]</code> instead of <code>[data]</code>. The component
        owns the query pipeline (cancel + race-guard built-in). Click "Force error" to see the error state and
        the retry button.
      </p>
      <div class="row">
        <button (click)="forceError = true; bumpAsync()">Force error next reload</button>
        <button (click)="forceError = false; bumpAsync()">Reload OK</button>
        <button (click)="latency = 2200; bumpAsync()">Slow (2.2s)</button>
        <button (click)="latency = 250; bumpAsync()">Fast (250ms)</button>
      </div>
      <dph-data-table
        [config]="asyncConfig"
        [dataSource]="asyncSource()"
        (queryChange)="queryLog.set($event)"
      />
      <details style="margin-top:0.5rem;">
        <summary style="cursor:pointer; font-size:0.75rem;">Last query payload</summary>
        <pre style="font-size:0.6875rem; background: var(--ep-color-neutral-50); padding: 0.5rem; border-radius: 4px;">{{ queryLog() | json }}</pre>
      </details>
    </div>

    <!-- ── 3. NESTED TABLES (3-level recursion) ───────────────────── -->
    <div class="dph-section">
      <h3>Nested tables <span class="pill">orders → line items → shipments</span></h3>
      <p>
        Click the chevron to expand an order. Each line item itself expands to show its shipments — the
        component recursively renders <code>&lt;dph-data-table&gt;</code> via <code>nestedConfig</code> /
        <code>nestedData</code>. Same pattern works to N levels deep.
      </p>
      <dph-data-table [config]="ordersConfig" [data]="orders()" />
    </div>

    <!-- ── 4. INLINE EDIT (cell mode) ──────────────────────────────── -->
    <div class="dph-section">
      <h3>Inline edit <span class="pill">double-click a cell</span></h3>
      <p>
        Cells with <code>editable: true</code> become inputs on double-click. Enter commits, Esc cancels,
        blur commits. The component emits <code>(cellEdit)</code> with old + new value — host applies the patch.
      </p>
      <dph-data-table
        [config]="editConfig"
        [data]="editableUsers()"
        (cellEdit)="commitEdit($event)"
      />
    </div>

    <!-- ── 5. MOBILE CARDS (auto below 640px) ──────────────────────── -->
    <div class="dph-section">
      <h3>Responsive — card layout on mobile <span class="pill">resize browser to ≤640px</span></h3>
      <p>
        With <code>responsiveMode: 'cards'</code> the table swaps to a vertical card stack on small screens.
        Each card auto-renders <strong>label : value</strong> pairs from the column defs (or supply a custom
        <code>cardTemplate</code>).
      </p>
      <dph-data-table [config]="cardConfig" [data]="users().slice(0, 5)" />
    </div>

    <!-- ── 6. BULK + EXPORT ─────────────────────────────────────────── -->
    <div class="dph-section">
      <h3>Bulk actions + CSV export <span class="pill">select rows → toolbar appears</span></h3>
      <p>
        Multi-select rows and a sticky bulk toolbar slides in. Buttons in the main toolbar trigger CSV
        download (built-in, RFC 4180 quoting, UTF-8 BOM for Excel) — XLSX/PDF emit <code>(exportRequest)</code>
        for the host to handle.
      </p>
      <dph-data-table
        [config]="bulkConfig"
        [data]="users().slice(0, 12)"
        [(selection)]="bulkSelected"
        (bulkAction)="onBulkDemo($event)"
      />
    </div>

    <!-- ── 7. LIVE / REAL-TIME (raw signals alternative) ──────────── -->
    <div class="dph-section">
      <h3>Live data table <span class="pill">raw signals · virtual scroll · real-time</span></h3>
      <p>
        Alternative to the main table for streaming scenarios. Pure signal reactivity, custom virtual scroll,
        new-row flash animation. Click "Add ticker" to simulate a websocket feed — new rows light up briefly
        and a "N new — scroll to top" toast appears in the footer.
      </p>
      <div class="row">
        <button (click)="addTicker()">+ Add ticker</button>
        <button (click)="bumpTickers()">Bump prices</button>
        <button (click)="autoFeed()">Toggle auto-feed</button>
        <span style="font-size:0.75rem; color: var(--ep-color-neutral-500);">{{ tickers().length }} rows</span>
      </div>
      <dph-live-data-table
        [columns]="tickerColumns"
        [rows]="tickers()"
        [rowHeight]="40"
        height="320px"
        [highlightNew]="true"
      />
    </div>

    <!-- ── 8. STATES PANEL ─────────────────────────────────────────── -->
    <div class="dph-section">
      <h3>Loading + empty + error states</h3>
      <p>Three demo tables side-by-side showing the three terminal states.</p>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 1rem;">
        <div>
          <strong style="font-size: 0.75rem;">Initial loading (skeleton)</strong>
          <dph-data-table [config]="basicConfig" [data]="users().slice(0, 3)" [loading]="true" />
        </div>
        <div>
          <strong style="font-size: 0.75rem;">Empty</strong>
          <dph-data-table [config]="basicConfig" [data]="[]" />
        </div>
        <div>
          <strong style="font-size: 0.75rem;">Error</strong>
          <dph-data-table
            [config]="errorConfig"
            [data]="[]"
            [error]="'Connection timed out (504). The server took too long to respond.'"
          />
        </div>
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoDataTableComponent {
  protected readonly toast = inject(ToastService);

  // ── State ────────────────────────────────────────────────────────────
  protected readonly users = signal<readonly DemoUser[]>(generateUsers(48));
  protected readonly orders = signal<readonly DemoOrder[]>(generateOrders(7));
  protected readonly editableUsers = signal<DemoUser[]>([...generateUsers(6)] as DemoUser[]);
  protected readonly tickers = signal<Ticker[]>(generateTickers());
  protected readonly queryLog = signal<TableQuery | null>(null);

  protected readonly tickerColumns: readonly ColumnDef<Ticker>[] = [
    { field: 'symbol', header: 'Symbol', width: '6rem' },
    { field: 'name', header: 'Name', width: '1fr' },
    { field: 'price', header: 'Price', type: 'currency', align: 'right', width: '8rem' },
    {
      field: 'changePct',
      header: 'Δ %',
      type: 'badge',
      align: 'right',
      width: '6rem',
      format: (v) => `${(v as number).toFixed(2)}%`,
      cellOptions: {
        badgeSeverityMap: {},
      },
    },
    { field: 'history', header: 'Trend', type: 'sparkline', width: '8rem' },
    { field: 'volume', header: 'Volume', type: 'number', align: 'right', width: '8rem' },
  ];

  protected selectedUsers: DemoUser[] = [];
  protected bulkSelected: DemoUser[] = [];
  protected forceError = false;
  protected latency = 700;
  private asyncSeed = 0;

  // ── ASYNC source — recreated on bumpAsync() so DataSource swap re-fires
  protected readonly asyncSource = signal<DataSource<DemoUser>>(this.makeAsyncSource());

  protected bumpAsync(): void {
    this.asyncSeed++;
    this.asyncSource.set(this.makeAsyncSource());
  }

  private makeAsyncSource(): DataSource<DemoUser> {
    return new RemoteDataSource<DemoUser>((q: TableQuery) => {
      if (this.forceError) return throwError(() => new Error('Simulated server failure (500)'));
      const all = this.users();
      const start = (q.page - 1) * q.pageSize;
      const slice = all.slice(start, start + q.pageSize);
      const page: TablePage<DemoUser> = { rows: slice, total: all.length };
      return of(page).pipe(delay(this.latency)) as Observable<TablePage<DemoUser>>;
    });
  }

  // ── 1. UNIVERSAL CONFIG ──────────────────────────────────────────
  protected readonly universalConfig: TableConfig<DemoUser> = {
    idField: 'id',
    selectionMode: 'multiple',
    sortable: true,
    multiSort: true,
    pagination: true,
    pageSizes: [10, 25, 50],
    defaultPageSize: 10,
    striped: true,
    densitySelector: true,
    persistSelection: true,
    responsiveMode: 'priority',
    caption: 'All users',
    toolbar: { search: true, refresh: true, export: true, chooser: true, density: true, searchPlaceholder: 'Find a user…' },
    columns: [
      { field: 'id',        header: '#',       type: 'number',   sortable: true, frozen: 'left', width: '4rem',   align: 'right', priority: 'high' },
      {
        field: 'name', header: 'User', sortable: true, width: '14rem', priority: 'high',
        type: 'avatar', filterable: true, filter: { type: 'text', placeholder: 'Search name', defaultOp: 'contains' },
      },
      {
        field: 'role', header: 'Role', sortable: true, width: '8rem', priority: 'high',
        filterable: true, filter: { type: 'enum', options: ROLES.map((r) => ({ label: r, value: r })) },
      },
      {
        field: 'tags', header: 'Tags', type: 'chips', width: '12rem', priority: 'medium',
        cellOptions: { maxChips: 2, chipSeverity: () => 'info' },
        filterable: true, filter: { type: 'multi-enum', options: TAGS_POOL.map((t) => ({ label: t, value: t })) },
      },
      {
        field: 'status', header: 'Status', type: 'status-dot', width: '7rem', sortable: true, priority: 'high',
        cellOptions: { statusLabels: { active: 'Active', pending: 'Pending', inactive: 'Inactive', banned: 'Banned' } },
        filterable: true, filter: { type: 'enum', options: STATUSES.map((s) => ({ label: s, value: s })) },
      },
      { field: 'isVerified', header: 'Verified', type: 'boolean', align: 'center', width: '5rem', priority: 'medium', filterable: true, filter: { type: 'boolean' } },
      { field: 'rating', header: 'Rating', type: 'rating', width: '7rem', priority: 'low', cellOptions: { ratingMax: 5 } },
      {
        field: 'progress', header: 'Onboarding', type: 'progress', width: '8rem', priority: 'low',
        cellOptions: { progressMax: 100, progressShowValue: true },
        filterable: true, filter: { type: 'range', min: 0, max: 100 },
      },
      {
        field: 'salary', header: 'Salary', type: 'currency', align: 'right', sortable: true, width: '8rem', priority: 'low',
        aggregator: 'avg',
        filterable: true, filter: { type: 'number', defaultOp: 'gte' },
      },
      {
        field: 'joinedAt', header: 'Joined', type: 'date', sortable: true, width: '7rem', priority: 'medium',
        filterable: true, filter: { type: 'date', defaultOp: 'after' },
      },
      { field: 'trend', header: 'Activity', type: 'sparkline', width: '6rem', priority: 'low', exportable: false },
      { field: 'team', header: 'Team', type: 'avatar-group', width: '6rem', priority: 'low', cellOptions: { maxAvatars: 3 } },
      { field: 'tickets', header: 'Tickets', type: 'number', sortable: true, width: '6rem', align: 'right', priority: 'low', aggregator: 'sum' },
      {
        field: 'homepage', header: 'Web', type: 'link', width: '6rem', priority: 'low',
        cellOptions: { hrefField: 'homepage', target: '_blank', external: true },
        format: () => '→',
      },
    ],
    rowSeverity: (r: DemoUser) => (r.status === 'banned' ? 'danger' : r.status === 'pending' ? 'warning' : null),
    rowActions: [
      { key: 'view', label: 'View', icon: 'pi pi-eye' },
      { key: 'edit', label: 'Edit', icon: 'pi pi-pencil' },
      { key: 'archive', label: 'Archive', icon: 'pi pi-folder' },
      { key: 'delete', label: 'Delete', icon: 'pi pi-trash', severity: 'danger' },
    ],
    rowActionsMax: 2,
    bulkActions: [
      { key: 'export', label: 'Export', icon: 'pi pi-download' },
      { key: 'archive', label: 'Archive', icon: 'pi pi-folder' },
      { key: 'delete', label: 'Delete', icon: 'pi pi-trash', severity: 'danger', confirm: true, confirmMessage: 'Delete selected users? This cannot be undone.' },
    ],
    emptyMessage: 'No users found.',
    emptyAfterFilterMessage: 'No users match your filters. Adjust filters or clear them all.',
    emptyIcon: 'pi pi-users',
    exportFilename: 'users',
  };

  // ── 2. ASYNC CONFIG ──────────────────────────────────────────────
  protected readonly asyncConfig: TableConfig<DemoUser> = {
    idField: 'id',
    sortable: true,
    pagination: true,
    pageSizes: [5, 10, 20],
    defaultPageSize: 10,
    striped: true,
    skeletonRows: 8,
    columns: [
      { field: 'id', header: '#', type: 'number', width: '4rem', align: 'right' },
      { field: 'name', header: 'Name', sortable: true },
      { field: 'email', header: 'Email', type: 'email' },
      { field: 'role', header: 'Role', sortable: true, width: '8rem' },
      { field: 'salary', header: 'Salary', type: 'currency', align: 'right', sortable: true, width: '8rem' },
    ],
    errorMessage: 'Could not load users',
    errorRetryLabel: 'Try again',
  };

  // ── 3. ORDERS / NESTED ───────────────────────────────────────────
  protected readonly ordersConfig: TableConfig<DemoOrder> = {
    idField: 'id',
    pagination: true,
    pageSizes: [5, 10, 25],
    defaultPageSize: 5,
    expandable: true,
    striped: true,
    sortable: true,
    columns: [
      { field: 'id', header: 'Order', sortable: true, width: '12rem' },
      { field: 'customer', header: 'Customer', sortable: true },
      { field: 'placedAt', header: 'Placed', type: 'date', sortable: true, width: '8rem' },
      { field: 'status', header: 'Status', type: 'badge', sortable: true, width: '7rem' },
      { field: 'total', header: 'Total', type: 'currency', align: 'right', sortable: true, width: '7rem', aggregator: 'sum' },
    ],
    nestedData: (row) => row.lines as readonly Record<string, unknown>[],
    nestedConfig: () => this.lineConfig as unknown as TableConfig<Record<string, unknown>>,
  };

  protected readonly lineConfig: TableConfig<OrderLine> = {
    idField: 'sku',
    expandable: true,
    columns: [
      { field: 'sku', header: 'SKU', width: '8rem' },
      { field: 'product', header: 'Product' },
      { field: 'qty', header: 'Qty', type: 'number', align: 'right', width: '5rem' },
      { field: 'unitPrice', header: 'Unit', type: 'currency', align: 'right', width: '6rem' },
      { field: 'total', header: 'Subtotal', type: 'currency', align: 'right', width: '7rem', aggregator: 'sum' },
    ],
    size: 'sm',
    nestedData: (row) => row.shipments as readonly Record<string, unknown>[],
    nestedConfig: () => this.shipmentConfig as unknown as TableConfig<Record<string, unknown>>,
  };

  protected readonly shipmentConfig: TableConfig<Shipment> = {
    idField: 'trackingNo',
    columns: [
      { field: 'trackingNo', header: 'Tracking #', width: '12rem' },
      { field: 'carrier', header: 'Carrier', width: '6rem' },
      { field: 'status', header: 'Status', type: 'badge', width: '8rem' },
      { field: 'eta', header: 'ETA', type: 'date', width: '8rem' },
    ],
    size: 'sm',
  };

  // ── 4. INLINE EDIT ───────────────────────────────────────────────
  protected readonly editConfig: TableConfig<DemoUser> = {
    idField: 'id',
    inlineEdit: 'cell',
    striped: true,
    columns: [
      { field: 'name', header: 'Name', editable: true, editor: 'text' },
      { field: 'email', header: 'Email', editable: true, editor: 'text', type: 'email' },
      {
        field: 'role', header: 'Role', editable: true, editor: 'select',
        editorOptions: ROLES.map((r) => ({ label: r, value: r })),
      },
      { field: 'salary', header: 'Salary', type: 'currency', align: 'right', editable: true, editor: 'number' },
      { field: 'isVerified', header: 'Verified', type: 'boolean', align: 'center', editable: true, editor: 'boolean' },
    ],
    size: 'sm',
  };

  // ── 5. MOBILE CARDS ──────────────────────────────────────────────
  protected readonly cardConfig: TableConfig<DemoUser> = {
    idField: 'id',
    responsiveMode: 'cards',
    columns: [
      { field: 'name', header: 'Name', type: 'avatar' },
      { field: 'role', header: 'Role' },
      { field: 'status', header: 'Status', type: 'status-dot' },
      { field: 'salary', header: 'Salary', type: 'currency' },
      { field: 'joinedAt', header: 'Joined', type: 'date' },
    ],
    rowActions: [
      { key: 'edit', label: 'Edit', icon: 'pi pi-pencil' },
      { key: 'delete', label: 'Delete', icon: 'pi pi-trash', severity: 'danger' },
    ],
  };

  // ── 6. BULK + EXPORT ─────────────────────────────────────────────
  protected readonly bulkConfig: TableConfig<DemoUser> = {
    idField: 'id',
    selectionMode: 'multiple',
    pagination: false,
    striped: true,
    toolbar: { export: true, refresh: false },
    columns: [
      { field: 'name', header: 'Name', type: 'avatar' },
      { field: 'role', header: 'Role' },
      { field: 'status', header: 'Status', type: 'badge' },
      { field: 'salary', header: 'Salary', type: 'currency', align: 'right' },
    ],
    bulkActions: [
      { key: 'email', label: 'Email selected', icon: 'pi pi-envelope' },
      { key: 'export', label: 'Export CSV', icon: 'pi pi-download' },
      { key: 'archive', label: 'Archive', icon: 'pi pi-folder', severity: 'warning' },
      { key: 'delete', label: 'Delete', icon: 'pi pi-trash', severity: 'danger', confirm: true },
    ],
    exportFilename: 'selected-users',
  };

  // ── 7. BASIC + 8. ERROR ──────────────────────────────────────────
  protected readonly basicConfig: TableConfig<DemoUser> = {
    idField: 'id',
    skeletonRows: 4,
    pagination: false,
    columns: [
      { field: 'name', header: 'Name' },
      { field: 'role', header: 'Role' },
      { field: 'status', header: 'Status', type: 'badge' },
    ],
    emptyIcon: 'pi pi-inbox',
    emptyMessage: 'Nothing here yet.',
  };

  protected readonly errorConfig: TableConfig<DemoUser> = {
    ...this.basicConfig,
    errorMessage: 'Failed to load',
    errorRetryLabel: 'Retry',
  };

  // ── Live ticker controls ─────────────────────────────────────────
  private autoFeedSub: { unsubscribe: () => void } | null = null;

  protected addTicker(): void {
    const i = this.tickers().length;
    const sym = `EP${1000 + i}`;
    const price = 50 + Math.random() * 200;
    const change = (Math.random() - 0.45) * 5;
    this.tickers.update((rows) => [
      {
        id: sym,
        symbol: sym,
        name: `${sym} Holdings`,
        price,
        change,
        changePct: (change / price) * 100,
        volume: Math.floor(Math.random() * 1_000_000),
        history: Array.from({ length: 20 }, () => price + (Math.random() - 0.5) * 10),
      } as Ticker,
      ...rows,
    ]);
  }

  protected bumpTickers(): void {
    this.tickers.update((rows) =>
      rows.map((r) => {
        const change = (Math.random() - 0.45) * 5;
        const price = Math.max(1, r.price + change);
        return {
          ...r,
          price,
          change,
          changePct: (change / price) * 100,
          history: [...r.history.slice(1), price],
        };
      }),
    );
  }

  protected autoFeed(): void {
    if (this.autoFeedSub) {
      this.autoFeedSub.unsubscribe();
      this.autoFeedSub = null;
      return;
    }
    this.autoFeedSub = interval(900)
      .pipe(take(50))
      .subscribe(() => {
        if (Math.random() < 0.3) this.addTicker();
        else this.bumpTickers();
      });
  }

  // ── Event handlers ───────────────────────────────────────────────
  protected open(row: DemoUser): void {
    this.toast.info('Row clicked', `${row.name} (${row.email})`);
  }
  protected action(e: { action: string; row: DemoUser }): void {
    this.toast.info(`Action: ${e.action}`, e.row.name);
  }
  protected bulk(e: { action: string; rows: readonly DemoUser[] }): void {
    this.toast.success(`Bulk ${e.action}`, `${e.rows.length} rows affected`);
  }
  protected onBulkDemo(e: { action: string; rows: readonly DemoUser[] }): void {
    this.toast.success(`Bulk ${e.action}`, `${e.rows.length} selected`);
  }
  protected edit(e: { row: DemoUser; field: string; oldValue: unknown; newValue: unknown }): void {
    this.toast.info('Cell edited', `${e.field}: ${String(e.oldValue)} → ${String(e.newValue)}`);
  }
  protected commitEdit(e: { row: DemoUser; field: string; newValue: unknown }): void {
    this.editableUsers.update((rows) =>
      rows.map((r) => (r.id === e.row.id ? ({ ...r, [e.field]: e.newValue } as DemoUser) : r)),
    );
    this.toast.success('Saved', `${e.field} updated`);
  }
}
