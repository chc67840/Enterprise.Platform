/* eslint-disable */
// @ts-nocheck
// ╔═════════════════════════════════════════════════════════════════════════════╗
// ║                                                                             ║
// ║   master-config.models.ts                                                   ║
// ║   ─────────────────────────                                                 ║
// ║   Canonical, consolidated TypeScript model surface for the entire SPA.      ║
// ║   This file is REFERENCE ONLY — it is excluded from the Angular build       ║
// ║   (`@ts-nocheck`) and serves as a single-page index of every config /       ║
// ║   model / contract type the SPA emits or consumes.                          ║
// ║                                                                             ║
// ║   Use it to:                                                                ║
// ║     • Onboard new engineers to the type surface in 30 minutes               ║
// ║     • Detect duplication when adding a new shape ("does X already exist?")  ║
// ║     • Trace a wire shape end-to-end (TS interface → C# record)              ║
// ║     • Audit drift between SPA, BFF, and Api tiers                           ║
// ║                                                                             ║
// ║   PAIRED WITH                                                               ║
// ║     Docs/Architecture/MasterConfigModels.cs — the .NET mirror.              ║
// ║                                                                             ║
// ║   AUTHORITY                                                                 ║
// ║     Each section cites its real on-disk source-of-truth file in the         ║
// ║     header comment. When a definition here diverges from the live source,   ║
// ║     the LIVE SOURCE WINS — open a PR to update this file.                   ║
// ║                                                                             ║
// ║   GENERATED — 2026-04-30 (manual consolidation)                             ║
// ║                                                                             ║
// ╚═════════════════════════════════════════════════════════════════════════════╝
//
// ─── TABLE OF CONTENTS ───────────────────────────────────────────────────────────
//
//   FLAGS                  Cross-tier inconsistencies — read first
//   §1   Primitives        Severity, Size, Variant, RoutePath, IconClass, etc.
//   §2   Base entity       BaseEntity (audit + concurrency)
//   §3   HTTP envelopes    PagedResponse, ApiResponse, ApiError, QueryParams
//   §4   Auth + session    CurrentUser, EffectivePermissions, AuthState
//   §5   Routing metadata  RouteMetadata, BreadcrumbItem, PageHeaderConfig
//   §6   Layout / chrome   NavbarConfig hierarchy, FooterConfig hierarchy
//   §7   DPH UI Kit        TableConfig, FormSchema, ChartWidgetConfig, etc.
//   §8   Feature DTOs      User feature canonical (template for new aggregates)
//   §9   Runtime config    RuntimeConfig (window.__EP_RUNTIME__ holder)
//
// ═════════════════════════════════════════════════════════════════════════════════
//
// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃                                FLAGS                                        ┃
// ┃        ─── KNOWN INCONSISTENCIES — RESOLVE BEFORE EXTENDING ───              ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
//
//   F1 ▸ Severity vocabulary — THREE divergent shapes across the tree:
//        • DPH UI Kit (dph.types.ts)         : 'success' | 'warning' | 'danger' | 'info' | 'neutral'
//        • Chrome wire (NavBadgeDto.variant) : 'info' | 'success' | 'warning' | 'danger' | 'secondary'
//        • .NET ErrorSeverity                : Info | Warning | Critical (numeric)
//        Action — pick one canonical SPA vocabulary; map at the chrome boundary.
//        Recommended: keep DPH as canonical UI vocab (`neutral` is meaningful);
//        normalise PrimeNG `'secondary'` → `'neutral'` in NavbarConfigService.
//
//   F2 RESOLVED 2026-04-30 (disambiguation, not consolidation) ▸
//        On second analysis these are two DIFFERENT concepts, not duplicates:
//        • DPH (dph.types.ts)             : 'asc' | 'desc' | null    (TRI-STATE
//          — UI column-click cycle; `null` means "unsorted" and is local to
//          the data-table; never reaches the wire).
//        • Core (query-params.model.ts)   : 'asc' | 'desc'           (WIRE
//          format; sent on the `sortDir` query string).
//        • .NET (SortDirection.cs)        : Asc | Desc               (.NET
//          enum; serialises as PascalCase by default — BFF maps to camelCase).
//        Both SPA types now carry cross-reference doc-comments naming the
//        other and pointing to this flag. Adding a new value on either side
//        requires updating both.
//
//   F3 ▸ Pagination envelope — FOUR shapes in flight:
//        • SPA generic (api-response.model.ts) : PagedResponse<T> = { data, total, page, pageSize, totalPages, hasNext, hasPrev }
//        • SPA users-feature (user.types.ts)   : ListUsersResponse  = { items, pageNumber, pageSize, totalCount }
//        • .NET wire (PaginationMeta)          : { TotalCount, PageSize, PageNumber, NextCursor, PreviousCursor }
//        • .NET wire (PagedResult<T>)          : { Items, PageNumber, PageSize, TotalCount } (no envelope)
//        Action — pick ONE wire envelope. The user feature emits `PagedResult<T>`
//        directly; everything else uses `PagedResponse<T>` with derived fields.
//        Recommended: keep .NET `PagedResult<T>` raw on the wire; have the SPA
//        BaseApiService translate to the derived `PagedResponse<T>` once, so
//        feature stores never see two shapes.
//
//   F4 ▸ Multi-tenant claim ↔ stripped reality:
//        Project description mentions "Multi-tenant (TenantId on everything)"
//        BUT per memory `project_phase1_singletenant_done.md` (2026-04-25)
//        tenancy was stripped from backend + frontend. `AuditableEntity` doc
//        comment confirms "Single-tenant: no tenant-scoped variant exists
//        post-2026-04-25 strip."
//        Residual stubs: `NavTenantSwitcherConfigDto`, `TenantOptionDto`,
//        `tenantId?` properties in `AuthState`. These are wire-allowed but
//        unused — every backend value emits `Enabled = false` for tenant
//        switcher. To re-introduce multi-tenancy: add `TenantId` to
//        `AuditableEntity`, restore `ICurrentUserService.TenantId`, route
//        all queries through tenant filter, AND populate the chrome stubs.
//
//   F5 ▸ UserDto vs BaseEntity drift:
//        SPA `UserDto` (user.types.ts) extends `Record<string, unknown>`
//        instead of `BaseEntity` (so it can satisfy the dph-data-table
//        generic constraint). Side-effect: it does NOT carry `version` for
//        optimistic concurrency. .NET `UserDto` (DtoGen) likewise omits
//        `RowVersion` even though the entity has one. Both store/read flows
//        therefore CANNOT round-trip an `If-Match` header end-to-end.
//        Action — either add `version: string | null` to UserDto + emit
//        `RowVersion` from DtoGen, OR document that the user aggregate
//        forgoes optimistic concurrency (last-write-wins). Today it's neither.
//
//   F6 RESOLVED 2026-04-30 ▸ Hand-mirrored TS constants now live in
//        `src/app/core/http/http-headers.constants.ts` (re-exported from
//        the `@core/http` barrel). All four wire headers + the SPA-only
//        headers (X-Skip-Error-Handling, X-XSRF-TOKEN, X-Requested-With,
//        X-Content-Type-Options) + XSRF cookie name are constants now;
//        callsites in correlationInterceptor, errorInterceptor,
//        securityInterceptor, and usersApiService refactored to use them.
//        ▲ DRIFT GUARD : when renaming a wire header on the server, also
//        update the TS file in the same PR. Architecture.Tests doesn't
//        diff the two files yet — manual cross-check until it does.
//
//   F7 RESOLVED 2026-04-30 ▸ Promoted to
//        `src/Contracts/Enterprise.Platform.Contracts/DTOs/Auth/EffectivePermissionsDto.cs`.
//        AuthController.MePermissions now returns the contract DTO; the
//        old `Web.UI.Controllers.Models.EffectivePermissions` record (which
//        carried a redundant `TenantId: null` field per F4) was deleted.
//        SPA `EffectivePermissions` interface stays as the hand-mirror.
//
//   F8 ▸ CurrentUser is a narrow SPA projection:
//        SPA `CurrentUser` is `{ displayName, email }`. .NET `SessionInfoDto`
//        carries far more (id, tenantId, roles, permissions, chrome). The
//        SPA deliberately picks two fields. Document this projection rule
//        ("anything UI-only stays in CurrentUser; auth state lives in AuthStore").
//
// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 1 — PRIMITIVES
// ─────────────────────────
// WHAT  : Building-block scalar types reused everywhere downstream.
// WHY   : Avoids the proliferation of bespoke string-literal unions in feature code.
// WHERE : Live in `shared/components/dph/dph.types.ts` (canonical for UI vocab) and
//         `shared/layout/models/nav.models.ts` (chrome-specific primitives).

// ─── Sizing scale — used by inputs, buttons, tables, drawers ─────────────────────
//   SOURCE : src/app/shared/components/dph/dph.types.ts
//   USAGE  : Components map `size` to data-attributes for SCSS; never inline px.
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// ─── Visual variant — drives chrome/colour treatment ────────────────────────────
//   SOURCE : src/app/shared/components/dph/dph.types.ts
//   NOTE   : `'danger'` is BOTH a variant (red button) AND a severity. Resolved
//            by keeping them in distinct fields; never collapse.
export type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'link' | 'danger';

// ─── Severity (UI vocabulary) — see FLAGS §F1 ───────────────────────────────────
//   SOURCE : src/app/shared/components/dph/dph.types.ts
//   CANONICAL : This is the SPA's preferred severity vocabulary.
//   MAPPING   : Chrome wire (`'secondary'`) → normalise to `'neutral'` on hydration.
export type Severity = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// ─── Sort direction — see FLAGS §F2 ─────────────────────────────────────────────
//   PREFERRED : The non-nullable form below; treat `null` as "no sort".
//   USAGE     : Stores hold `SortConfig | null`; nullable inside SortConfig is
//               a duplicate concept and should be removed.
export type SortDirection = 'asc' | 'desc';

// Permitted in dph.types.ts only; do NOT introduce in new code:
// export type SortDirectionWithNull = 'asc' | 'desc' | null;  // ▲ DEPRECATED — see F2

// ─── Router target — accepts every shape Router.navigate consumes ───────────────
//   SOURCE : src/app/shared/layout/models/nav.models.ts
//   WHY    : String-only would force every dynamic link through urlTreeFor() boilerplate.
export type RoutePath = string | readonly (string | number)[] | unknown; // UrlTree (untyped here to avoid Angular import)

// ─── PrimeIcons class string ────────────────────────────────────────────────────
//   FORMAT : `'pi pi-bell'`. Free-form so a future renderer can swap icon set.
export type IconClass = string;

// ─── Environment ribbon ─────────────────────────────────────────────────────────
//   USAGE : Shown next to brand mark; `'production'` means hide.
export type EnvBadge = 'dev' | 'staging' | 'uat' | 'production';

// ─── Generic option item — selects, multiselects, autocompletes, dropdowns ──────
export interface OptionItem {
  readonly label: string;
  readonly value: unknown;
  readonly icon?: IconClass;
  readonly disabled?: boolean;
  readonly badge?: string;
  readonly styleClass?: string;
  readonly items?: readonly OptionItem[]; // Group children
}

// ─── File item — uploads, attachments, media galleries ──────────────────────────
export interface FileItem {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly url?: string;
  readonly previewUrl?: string;
  readonly uploadProgress?: number;
  readonly status: 'pending' | 'uploading' | 'complete' | 'error';
  readonly error?: string;
}

// ─── Tree node — for `<dph-tree>` and tree-select pickers ───────────────────────
export interface TreeNode<T = unknown> {
  readonly key: string;
  readonly label: string;
  readonly data?: T;
  readonly icon?: IconClass;
  readonly children?: readonly TreeNode<T>[];
  readonly leaf?: boolean;
  readonly selectable?: boolean;
  readonly expanded?: boolean;
  readonly styleClass?: string;
}

// ─── Authorization gate — applies to nav items, footer items, menu items ────────
//   SOURCE : src/app/shared/layout/models/nav.models.ts
//   POLICY : ALL fields optional. Empty gate = "everyone sees it" (fail-open).
//   ORDER  : 1) featureFlag → 2) roles (ANY-of) → 3) requiredPolicy.
//   HIDE-VS-DISABLE : Permission failure HIDES; for disabled-but-visible use
//                     `disabled?: boolean` on the consuming type.
export interface NavPermission {
  readonly requiredPolicy?: string;
  readonly featureFlag?: string;
  readonly roles?: readonly string[];
}

// ─── Visual badge — nav items, footer links, table cells ────────────────────────
export interface NavBadge {
  readonly value: string | number;
  readonly variant: 'info' | 'success' | 'warning' | 'danger' | 'secondary'; // ▲ Chrome vocab — see F1
  readonly pulse?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 2 — BASE ENTITY
// ─────────────────────────
// WHAT  : Mirror of the .NET `AuditableEntity` shape that every persisted entity
//         (User, etc.) carries on the wire.
// WHY   : Stores normalise on `id`; `version` round-trips for optimistic concurrency.
// WHERE : src/app/core/models/entity.model.ts

export interface BaseEntity {
  readonly id: string;
  readonly createdAt?: string;       // ISO-8601 UTC instant
  readonly createdBy?: string;       // User id or 'system'
  readonly modifiedAt?: string;
  readonly modifiedBy?: string;
  readonly isActive?: boolean;       // Distinct from `isDeleted` (server hides)
  readonly version?: string;         // Opaque base64 RowVersion → If-Match header
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 3 — HTTP ENVELOPES
// ─────────────────────────
// WHAT  : Standard wire shapes for paged lists, single resources, errors, and
//         list-query parameters.
// WHY   : Strong end-to-end typing in BaseApiService, consistent error handling
//         in errorInterceptor, consistent query-string serialisation.
// WHERE : src/app/core/models/{api-response,query-params}.model.ts

// ─── Paged list (generic; SEE F3) ───────────────────────────────────────────────
//   USAGE  : `BaseApiService<T>.getAll()` returns `Observable<PagedResponse<T>>`.
//   DRIFT  : The user feature uses `ListUsersResponse` instead — see §8.
export interface PagedResponse<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

// ─── Single-resource envelope ───────────────────────────────────────────────────
export interface ApiResponse<T> {
  readonly data: T;
  readonly message?: string;
  readonly success: boolean; // Always true on 2xx; sanity bit for older clients
}

// ─── Normalised error — produced by errorInterceptor from any 4xx/5xx ──────────
//   ORIGIN  : RFC-7807 ProblemDetails | legacy `{message, code}` | bare HttpErrorResponse
//   USAGE   : Stores + components ONLY ever see this shape; never raw HttpErrorResponse.
export interface ApiError {
  readonly message: string;
  readonly statusCode: number;
  readonly code?: string;                                              // ErrorCodes.* (machine-readable)
  readonly errors?: Readonly<Record<string, readonly string[]>>;       // 422 field errors
  readonly correlationId?: string;
  readonly timestamp?: string;
}

// ─── List query parameters — uniform paging/search/sort/filter knobs ───────────
//   SERIALIZATION : page=N&pageSize=N&q=text&sortBy=field&sortDir=asc|desc&<filterKey>=v
//   PAGE INDEXING : 1-based to match .NET PagedResult convention.
export interface SortConfig {
  readonly field: string;
  readonly direction: SortDirection;
}

export interface PaginationParams {
  readonly page: number;     // 1-based
  readonly pageSize: number; // Server caps (typical 100, user feature 200)
}

export interface SearchParams {
  readonly query?: string;
}

export interface QueryParams extends PaginationParams, SearchParams {
  readonly sort?: SortConfig;
  readonly filters?: Readonly<Record<string, unknown>>;
}

export const DEFAULT_QUERY_PARAMS: QueryParams = {
  page: 1,
  pageSize: 20,
  query: '',
  filters: {},
};

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 4 — AUTH + SESSION
// ─────────────────────────
// WHAT  : Two separate concerns kept distinct on purpose:
//          • CurrentUser — UI-display projection of the BFF session.
//          • EffectivePermissions — authoritative authorization payload.
// WHY   : Header avatar can render before permissions hydrate; gating UI never
//         derives from token claims (SPA doesn't see tokens in BFF topology).
// WHERE : src/app/core/models/auth.model.ts, src/app/core/auth/auth.store.ts

// ─── Display projection of /api/auth/session ────────────────────────────────────
//   SEE F8 — deliberately narrow; richer state lives in AuthStore.
export interface CurrentUser {
  readonly displayName: string;
  readonly email: string;
}

// ─── Authoritative permission payload (GET /api/v1/me/permissions) ──────────────
//   SEE F7 — has no .NET DTO mirror.
//   PERMISSION FORMAT : `<aggregate>.<action>` lower-case dot-separated
//                       (e.g. `'users.read'`, `'reports.export'`).
//                       Compared CASE-INSENSITIVELY by RbacPolicyProvider.
export interface EffectivePermissions {
  readonly roles: readonly string[];        // Coarse labels — mirror of `roles` claim
  readonly permissions: readonly string[];  // Fine-grained dot-form strings
  readonly bypass: boolean;                 // Server-granted short-circuit (replaces 'super:admin')
  readonly ttlSeconds?: number;             // Cache lifetime; default 5 min if omitted
}

// ─── AuthStore signal-state shape ───────────────────────────────────────────────
//   SOURCE : src/app/core/auth/auth.store.ts (NgRx Signals)
//   NOTES  : `tenantId` field present BUT always null per F4 (tenancy stripped).
export interface AuthState {
  readonly userId: string | null;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly tenantId: string | null;          // ▲ Always null today (F4)
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly bypass: boolean;
  readonly status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  readonly error: ApiError | null;
  readonly loadedAt: number | null;          // epoch ms
  readonly ttlSeconds: number;
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 5 — ROUTING METADATA
// ─────────────────────────
// WHAT  : Strongly-typed shape for `Route.data`, plus breadcrumb + page-header
//         contracts the SubNavOrchestrator + breadcrumbResolver consume.
// WHY   : One declarative source drives navigation visibility, route activation,
//         breadcrumb generation, page headers, AND command palette indexing.
// WHERE : src/app/core/models/route-metadata.model.ts,
//         src/app/shared/layout/sub-nav/sub-nav.types.ts

// ─── Per-route metadata — attach to Route.data via `satisfies RouteMetadata` ────
//   USAGE :
//     {
//       path: 'users',
//       data: {
//         label: 'Users', icon: 'pi-users', breadcrumb: 'Users',
//         requiredPermissions: ['users.read'], featureFlag: 'users.enabled',
//         showInNav: true,
//       } satisfies RouteMetadata,
//       canActivate: [authGuard, permissionGuard('users.read')],
//       loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES),
//     }
export interface RouteMetadata {
  readonly label?: string;
  readonly icon?: IconClass;
  readonly breadcrumb?: string | ((params: Readonly<Record<string, string>>) => string);
  readonly requiredPermissions?: readonly string[];   // AND-semantics
  readonly requiredRoles?: readonly string[];          // OR-semantics
  readonly featureFlag?: string;
  readonly showInNav?: boolean;
  readonly group?: string;                              // 'platform' | 'admin' | 'support' | …
  readonly preload?: boolean;                           // CustomPreloader hint
  readonly pageHeader?: PageHeaderConfig;               // Static default; PageHeaderService can override
}

// ─── Page-header configuration ──────────────────────────────────────────────────
export interface PageHeaderConfig {
  readonly title: string;
  readonly subtitle?: string;
  readonly icon?: IconClass;
  readonly actions?: readonly PageHeaderAction[];
  readonly tabs?: readonly PageHeaderTab[];
}

export interface PageHeaderAction {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconClass;
  readonly variant?: Variant;
  readonly severity?: Severity;
  readonly disabled?: boolean;
  readonly permission?: NavPermission;
  readonly actionKey: string;        // Dispatched on click
}

export interface PageHeaderTab {
  readonly id: string;
  readonly label: string;
  readonly routePath: RoutePath;
  readonly icon?: IconClass;
  readonly badge?: NavBadge;
  readonly permission?: NavPermission;
}

// ─── Breadcrumb item ─────────────────────────────────────────────────────────────
export interface BreadcrumbItem {
  readonly label: string;
  readonly routePath?: RoutePath;
  readonly icon?: IconClass;
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 6 — LAYOUT / CHROME
// ─────────────────────────
// WHAT  : The whole-platform navbar + footer config. Hydrated from the BFF
//         (`/api/auth/session` returns `chrome.navbar` + `chrome.footer`) and
//         consumed by `<platform-navbar>` + `<platform-footer>`.
// WHY   : Domain teams build a literal config; they never touch chrome components.
// MIRROR: Every interface here has a corresponding `*Dto` C# record in
//         Enterprise.Platform.Contracts/DTOs/Chrome/ChromeDtos.cs.
//         A contract test in Architecture.Tests fails CI on key drift.
// WHERE : src/app/shared/layout/models/nav.models.ts

// ─── Tenant + language primitives ───────────────────────────────────────────────
export interface TenantOption {
  readonly id: string;
  readonly displayName: string;
  readonly domain?: string;
  readonly envBadge?: EnvBadge;
}

export interface LanguageOption {
  readonly code: string;       // BCP-47 (e.g. 'en', 'fr-CA')
  readonly label: string;      // In the target language ('Français' not 'French')
  readonly flagEmoji?: string;
}

export interface UserProfile {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly avatarUrl?: string | null;
  readonly role?: string;
  readonly orgName?: string;
}

// ─── Nav menu structures ────────────────────────────────────────────────────────
export type NavActiveMatchStrategy = 'exact' | 'prefix' | 'prefix-with-redirect';

export interface NavMenuLeaf {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconClass;
  readonly routePath?: RoutePath;
  readonly externalUrl?: string;
  readonly badge?: NavBadge;
  readonly permission?: NavPermission;
  readonly analyticsTag?: string;
  readonly disabled?: boolean;
  readonly tooltip?: string;
  readonly description?: string;
}

export interface NavMenuSection {
  readonly heading: string;
  readonly subheading?: string;
  readonly leaves: readonly NavMenuLeaf[];
}

export interface NavMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconClass;
  readonly routePath?: RoutePath;
  readonly externalUrl?: string;
  readonly badge?: NavBadge;
  readonly permission?: NavPermission;
  readonly children?: readonly NavMenuSection[];   // present ⇒ mega panel
  readonly analyticsTag?: string;
  readonly disabled?: boolean;
  readonly tooltip?: string;
}

export interface NavMenuConfig {
  readonly variant: 'flat' | 'mega' | 'icon' | 'tabs';
  readonly items: readonly NavMenuItem[];
  readonly activeMatchStrategy: NavActiveMatchStrategy;
  readonly collapseBreakpoint?: number;
}

// ─── Left zone ──────────────────────────────────────────────────────────────────
export interface NavLogoConfig {
  readonly imageSrc?: string;
  readonly alt: string;
  readonly brandName?: string;
  readonly subLabel?: string;
  readonly homeRoute: string;
  readonly envBadge?: EnvBadge;
}

export interface NavTenantSwitcherConfig {
  readonly enabled: boolean;                       // ▲ Always false today — see F4
  readonly currentTenant: TenantOption;
  readonly availableTenants: readonly TenantOption[];
  readonly permission?: NavPermission;
}

export interface NavLeftZoneConfig {
  readonly logo: NavLogoConfig;
  readonly tenantSwitcher?: NavTenantSwitcherConfig;
}

export interface NavCenterZoneConfig {
  readonly menu: NavMenuConfig;
}

// ─── Right zone widgets ─────────────────────────────────────────────────────────
export interface NavClockConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly timezone?: string;       // IANA — defaults to user's local
  readonly format: '12h' | '24h';
  readonly showTimezone?: boolean;
}

export interface MarketDescriptor {
  readonly symbol: string;
  readonly label: string;
  readonly tradingHours?: { readonly open: string; readonly close: string };
}

export interface NavMarketStatusConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly markets?: readonly MarketDescriptor[];
}

export interface NavShiftStatusConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly label?: string;
}

export interface NavGlobalSearchConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly placeholder?: string;
  readonly searchRoute?: string;
  readonly commandPaletteMode?: boolean;
}

export interface NavAiAssistantConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly label?: string;
  readonly icon?: IconClass;
  readonly actionKey: string;
}

export interface QuickAction {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconClass;
  readonly actionKey: string;
  readonly permission?: NavPermission;
  readonly badge?: NavBadge;
  readonly shortcut?: string;
}

export interface NavQuickActionsConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly label?: string;
  readonly icon?: IconClass;
  readonly actions: readonly QuickAction[];
}

export interface NavBellWidgetConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly maxBadgeCount?: number;
  readonly viewAllRoute?: string;
}

export interface NavHelpConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly docsUrl?: string;
  readonly label?: string;
  readonly icon?: IconClass;
}

export interface NavThemeToggleConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly includeSystem?: boolean;
}

export interface NavLanguageSwitcherConfig {
  readonly enabled: boolean;
  readonly permission?: NavPermission;
  readonly languages: readonly LanguageOption[];
}

// ─── User-menu items (discriminated union) ──────────────────────────────────────
//   WIRE  : ChromeDtos.cs flattens this to UserMenuItemDto with `kind` discriminator.
//           Every variant-specific field is nullable on the wire.
export type UserMenuItem =
  | { readonly kind: 'link';     readonly id: string; readonly label: string; readonly icon?: IconClass; readonly routePath?: RoutePath; readonly externalUrl?: string; readonly permission?: NavPermission; readonly disabled?: boolean }
  | { readonly kind: 'divider';  readonly id: string }
  | { readonly kind: 'action';   readonly id: string; readonly label: string; readonly icon?: IconClass; readonly actionKey: string; readonly isLogout?: boolean; readonly permission?: NavPermission; readonly disabled?: boolean };

export interface NavUserMenuConfig {
  readonly enabled: boolean;
  readonly showNameInHeader: boolean;
  readonly showRoleInHeader: boolean;
  readonly menuItems: readonly UserMenuItem[];
}

export interface NavRightZoneConfig {
  readonly clock?: NavClockConfig;
  readonly marketStatus?: NavMarketStatusConfig;
  readonly shiftStatus?: NavShiftStatusConfig;
  readonly globalSearch?: NavGlobalSearchConfig;
  readonly aiAssistant?: NavAiAssistantConfig;
  readonly quickActions?: NavQuickActionsConfig;
  readonly messages?: NavBellWidgetConfig;
  readonly notifications?: NavBellWidgetConfig;
  readonly help?: NavHelpConfig;
  readonly themeToggle?: NavThemeToggleConfig;
  readonly languageSwitcher?: NavLanguageSwitcherConfig;
  readonly userMenu: NavUserMenuConfig;
}

// ─── Top-level navbar config ────────────────────────────────────────────────────
export interface NavbarConfig {
  readonly leftZone: NavLeftZoneConfig;
  readonly centerZone: NavCenterZoneConfig;
  readonly rightZone: NavRightZoneConfig;
  readonly sticky?: boolean;
  readonly glassMorphism?: boolean;
  readonly heightPx?: number;
}

// ─── Footer ────────────────────────────────────────────────────────────────────
export interface FooterLink {
  readonly label: string;
  readonly routePath?: RoutePath;
  readonly externalUrl?: string;
  readonly icon?: IconClass;
  readonly badge?: NavBadge;
}

export interface FooterLinkColumn {
  readonly heading: string;
  readonly links: readonly FooterLink[];
}

export interface FooterNewsletterConfig {
  readonly enabled: boolean;
  readonly heading?: string;
  readonly placeholder?: string;
  readonly submitLabel?: string;
  readonly actionKey?: string;
}

export interface FooterComplianceConfig {
  readonly badges?: readonly ('soc2' | 'hipaa' | 'iso27001' | 'gdpr' | 'pci' | 'eeoc' | 'finra')[];
  readonly disclaimer?: string;
  readonly cookieConsent?: boolean;
}

export interface SocialLink {
  readonly platform: string;   // 'twitter' | 'linkedin' | 'github' | …
  readonly url: string;
}

export interface FooterBottomBarConfig {
  readonly copyrightOwner: string;
  readonly copyrightYear?: number;
  readonly appVersion?: string;
  readonly buildId?: string;
  readonly statusPageUrl?: string;
  readonly links?: readonly FooterLink[];
  readonly languageSwitcher?: NavLanguageSwitcherConfig;
}

export interface FooterLogoConfig {
  readonly imageSrc?: string;
  readonly alt: string;
  readonly brandName?: string;
}

export interface FooterConfig {
  readonly variant: 'full' | 'minimal' | 'app';
  readonly logo?: FooterLogoConfig;
  readonly tagline?: string;
  readonly columns?: readonly FooterLinkColumn[];
  readonly social?: readonly SocialLink[];
  readonly newsletter?: FooterNewsletterConfig;
  readonly compliance?: FooterComplianceConfig;
  readonly bottomBar: FooterBottomBarConfig;
}

// ─── Composite chrome (what the BFF sends in SessionInfo.chrome) ────────────────
export interface ChromeConfig {
  readonly navbar: NavbarConfig;
  readonly footer: FooterConfig;
}

// ─── Nav-action dispatcher event ────────────────────────────────────────────────
//   USAGE : Single `(navAction)="dispatch($event)"` output on platform-navbar.
//           Host switches on `actionKey` to route to feature handlers.
export interface NavActionEvent {
  readonly source: 'menu' | 'widget' | 'user-menu' | 'footer' | 'quick-action';
  readonly actionKey: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 7 — DPH UI KIT
// ─────────────────────────
// WHAT  : Config types for every dph-* component in shared/components/dph.
// WHY   : Components are pure consumers of declarative config; feature code
//         never touches PrimeNG `pt` API directly.
// WHERE : src/app/shared/components/dph/{dph,schema-form,chart-widget}.types.ts

// ─── Pagination + sort state (table) ────────────────────────────────────────────
export interface PaginationState {
  readonly page: number;       // 1-based
  readonly pageSize: number;
  readonly total: number;
  readonly pageSizes: readonly number[];
}

export interface SortState {
  readonly field: string;
  readonly direction: SortDirection;   // ▲ Strict — `null` deprecated, see F2
}

// ─── Menu item — for `<dph-menu>`, `<dph-context-menu>`, etc. ───────────────────
export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconClass;
  readonly routePath?: string;
  readonly externalUrl?: string;
  readonly badge?: string;
  readonly badgeSeverity?: Severity;
  readonly disabled?: boolean;
  readonly separator?: boolean;
  readonly items?: readonly MenuItem[];
  readonly command?: () => void;
  readonly queryParams?: Readonly<Record<string, string>>;
  readonly requiredPermission?: string;
  readonly visible?: boolean;
}

// ─── Table — column / cell / filter vocabulary ──────────────────────────────────
export type CellType =
  | 'text' | 'number' | 'currency' | 'date' | 'datetime'
  | 'boolean' | 'badge' | 'avatar' | 'avatar-group' | 'link'
  | 'email' | 'phone' | 'image' | 'rating' | 'progress'
  | 'sparkline' | 'chips' | 'multi-line' | 'status-dot'
  | 'json' | 'actions' | 'custom';

export type FilterOp =
  | 'contains' | 'notContains' | 'equals' | 'notEquals'
  | 'startsWith' | 'endsWith'
  | 'lt' | 'lte' | 'gt' | 'gte' | 'between'
  | 'before' | 'after' | 'on' | 'dateRange' | 'inLast'
  | 'is' | 'isNot' | 'in' | 'notIn'
  | 'isEmpty' | 'isNotEmpty';

export type FilterType = 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'multi-enum' | 'range';

export interface FilterDef {
  readonly type: FilterType;
  readonly options?: readonly OptionItem[];
  readonly placeholder?: string;
  readonly debounceMs?: number;
  readonly mode?: 'instant' | 'apply';
  readonly ops?: readonly FilterOp[];
  readonly defaultOp?: FilterOp;
  readonly min?: number;
  readonly max?: number;
}

export interface FilterValue {
  readonly op: FilterOp;
  readonly value: unknown;
  readonly value2?: unknown;       // For 'between' / 'dateRange'
}

export interface ColumnFilter {
  readonly field: string;
  readonly value: FilterValue | null;
}

export interface CellOptions {
  readonly currencyCode?: string;
  readonly dateFormat?: string;
  readonly hrefField?: string;
  readonly target?: '_blank' | '_self';
  readonly external?: boolean;
  readonly imageWidth?: string;
  readonly imageHeight?: string;
  readonly imageFallback?: string;
  readonly maxChips?: number;
  readonly chipSeverity?: (value: unknown) => Severity;
  readonly ratingMax?: number;
  readonly progressMax?: number;
}

export interface ColumnDef<T = unknown> {
  readonly field: string;
  readonly header: string;
  readonly type?: CellType;
  readonly width?: string;                 // CSS — '12rem', '20%'
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly filter?: FilterDef;
  readonly hidden?: boolean;
  readonly frozen?: 'left' | 'right' | false;
  readonly options?: CellOptions;
  readonly render?: (row: T) => string;    // Custom string renderer
}

export interface TableConfig<T extends Record<string, unknown>> {
  readonly idField: keyof T;
  readonly columns: readonly ColumnDef<T>[];
  readonly pagination?: PaginationState;
  readonly sort?: SortState;
  readonly filters?: readonly ColumnFilter[];
  readonly selection?: 'none' | 'single' | 'multiple';
  readonly density?: 'compact' | 'normal' | 'comfortable';
  readonly stickyHeader?: boolean;
  readonly loading?: boolean;
  readonly loadingText?: string;
  readonly emptyText?: string;
  readonly rowClass?: (row: T) => string | null;
}

// ─── Schema-form (declarative forms) ────────────────────────────────────────────
//   SOURCE : src/app/shared/components/dph/schema-form.types.ts
//   USAGE  : `<dph-schema-form [schema]="schema" [model]="model" (onEvent)="handle($event)"/>`
export type SchemaFieldType = 'text' | 'email' | 'password' | 'tel' | 'url' | 'search' | 'textarea' | 'number';

export interface FieldValidatorSpec {
  readonly required?: boolean | string;
  readonly minLength?: number | { readonly value: number; readonly message: string };
  readonly maxLength?: number | { readonly value: number; readonly message: string };
  readonly pattern?: RegExp | { readonly value: RegExp; readonly message: string };
  readonly email?: boolean | string;
  readonly min?: number | { readonly value: number; readonly message: string };
  readonly max?: number | { readonly value: number; readonly message: string };
}

export interface SchemaField {
  readonly key: string;             // FormGroup control name + API field name (must match exactly)
  readonly label: string;
  readonly type: SchemaFieldType;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly autocomplete?: string;
  readonly prefixIcon?: IconClass;
  readonly suffixIcon?: IconClass;
  readonly rows?: number;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly clearable?: boolean;
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly validators?: FieldValidatorSpec;
  readonly trim?: boolean;            // Default true for strings
  readonly nullIfEmpty?: boolean;     // Default false
  readonly defaultValue?: string | number | null;
  readonly columnSpan?: 1 | 2 | 3 | 4 | 'full';
  readonly serverErrorKeys?: readonly string[];
  readonly statusErrorMessages?: Readonly<Record<number, string>>;
}

export interface FormSchema {
  readonly fields: readonly SchemaField[];
  readonly columns?: 1 | 2 | 3 | 4;
  readonly gap?: Size;
  readonly trim?: boolean;
  readonly disableSubmitWhenPristine?: boolean;
}

export type ServerErrorIndex = Readonly<Record<string, string>>;

// ─── SchemaFormEvent — single discriminated-union output (P1.1) ─────────────────
//   USAGE : `(onEvent)="handle($event)"` — switch on `event.type`.
export type SchemaFormEvent =
  | { readonly type: 'form:submit';     readonly value: Readonly<Record<string, unknown>>; readonly raw: Readonly<Record<string, unknown>> }
  | { readonly type: 'form:cancel' }
  | { readonly type: 'form:reset' }
  | { readonly type: 'form:dirty';      readonly dirty: boolean }
  | { readonly type: 'form:valid';      readonly valid: boolean }
  | { readonly type: 'field:change';    readonly key: string; readonly value: unknown }
  | { readonly type: 'field:blur';      readonly key: string }
  | { readonly type: 'field:focus';     readonly key: string }
  | { readonly type: 'section:expand';  readonly id: string }
  | { readonly type: 'section:collapse'; readonly id: string }
  | { readonly type: 'action';          readonly key: string; readonly payload?: Readonly<Record<string, unknown>> };

// ─── Chart widget ──────────────────────────────────────────────────────────────
//   SOURCE : src/app/shared/components/dph/chart-widget.types.ts
export type ChartWidgetType = 'bar' | 'line' | 'doughnut' | 'pie' | 'radar' | 'polarArea';

export interface ChartWidgetDataset {
  readonly label: string;
  readonly data: readonly number[];
  readonly type?: 'bar' | 'line';     // Per-row override for combo charts
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly fill?: boolean;
  readonly tension?: number;
  readonly yAxisID?: string;
}

export interface ChartWidgetConfig {
  readonly type: ChartWidgetType;
  readonly title?: string;
  readonly subtitle?: string;
  readonly labels: readonly string[];
  readonly datasets: readonly ChartWidgetDataset[];
  readonly height?: string;            // CSS — defaults '300px'
  readonly showLegend?: boolean;
  readonly legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  readonly stacked?: boolean;
  readonly aspectRatio?: number;
  readonly maintainAspectRatio?: boolean;
}

export type CssVarReader = (name: string) => string;

// ─── Drawer — `<dph-drawer>` (P1.2) ────────────────────────────────────────────
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type DrawerPosition = 'right' | 'bottom' | 'left' | 'top';

export interface DrawerConfig {
  readonly visible: boolean;
  readonly position?: DrawerPosition;
  readonly size?: DrawerSize;
  readonly modal?: boolean;
  readonly closeOnEscape?: boolean;
  readonly dismissable?: boolean;
  readonly title?: string;
  readonly icon?: IconClass;
}

// ─── Confirm dialog (P0.5) ──────────────────────────────────────────────────────
//   USAGE : `await confirmService.confirm({...}) → boolean`
export interface ConfirmConfig {
  readonly title: string;
  readonly message: string;
  readonly icon?: IconClass;
  readonly severity?: Severity;
  readonly acceptLabel?: string;
  readonly rejectLabel?: string;
  readonly acceptVariant?: Variant;
  readonly destructive?: boolean;
}

// ─── Input — generic single-line / textarea / number input ──────────────────────
export type InputType =
  | 'text' | 'email' | 'password' | 'tel' | 'url' | 'search'
  | 'number' | 'textarea';

export interface InputConfig {
  readonly type?: InputType;
  readonly size?: Size;
  readonly variant?: 'outlined' | 'filled';
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly clearable?: boolean;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly autocomplete?: string;
  readonly prefixIcon?: IconClass;
  readonly suffixIcon?: IconClass;
  readonly rows?: number;
  readonly hint?: string;
}

// ─── Button ─────────────────────────────────────────────────────────────────────
export interface ButtonConfig {
  readonly label?: string;
  readonly icon?: IconClass;
  readonly iconPosition?: 'left' | 'right';
  readonly variant?: Variant;
  readonly severity?: Severity;
  readonly size?: Size;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly fullWidth?: boolean;
  readonly tooltip?: string;
}

// ─── Steps / wizard ─────────────────────────────────────────────────────────────
export interface StepDef {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: IconClass;
  readonly disabled?: boolean;
  readonly children?: readonly StepDef[];   // Sub-steps (split + horizontal variants)
}

export interface StepsConfig {
  readonly variant: 'horizontal' | 'vertical' | 'split';
  readonly steps: readonly StepDef[];
  readonly activeIndex: number;
  readonly clickableSteps?: boolean;
  readonly showProgress?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 8 — FEATURE DTOs (USERS — CANONICAL TEMPLATE)
// ─────────────────────────
// WHAT  : Wire shapes for the User aggregate. Use these as a template when
//         scaffolding a new feature (db-first pivot recipe — see
//         project_phase_dbfirst_done memory).
// WHY   : Mirrors the .NET DtoGen output. Property NAMES are the contract;
//         shape/order isn't (JSON is field-name addressed).
// WHERE : src/app/features/users/data/user.types.ts

// ─── User — server-side shape ───────────────────────────────────────────────────
//   IMPORTANT — see F5 :
//     • Extends `Record<string, unknown>` (NOT `BaseEntity`) — required for
//       dph-data-table generic constraint at runtime.
//     • Lacks `version` despite the entity having `RowVersion` — optimistic
//       concurrency NOT round-trippable for users today.
export interface UserDto extends Record<string, unknown> {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly externalIdentityId: string | null;
  readonly isActive: boolean;
  readonly lastLoginAt: string | null;       // ISO-8601 UTC string
  readonly isDeleted: boolean;
  readonly deletedAt: string | null;
  readonly deletedBy: string | null;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly modifiedAt: string | null;
  readonly modifiedBy: string | null;
  // ▲ Missing: readonly version: string | null; (see F5)
}

// ─── List query / response ──────────────────────────────────────────────────────
//   ▲ DRIFT FLAG (F3) : Different shape from generic `PagedResponse<T>`.
//                       Mirror of .NET `PagedResult<UserDto>` on the wire.
export interface ListUsersParams {
  readonly page: number;       // 1-based
  readonly pageSize: number;   // Backend caps at 200
  readonly search: string | null;
  readonly activeOnly: boolean | null;
}

export interface ListUsersResponse {
  readonly items: readonly UserDto[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number | null;
}

export const DEFAULT_LIST_USERS_PARAMS: ListUsersParams = {
  page: 1,
  pageSize: 25,
  search: null,
  activeOnly: null,
};

// ─── Command bodies (POST/PUT) ──────────────────────────────────────────────────
//   IDEMPOTENCY : Create + state-changing commands ride `X-Idempotency-Key` header
//                 (UUID v4). The bare `Idempotency-Key` form is invisible to the
//                 IdempotencyEndpointFilter and 400s — see memory feedback_idempotency_header_name.
export interface CreateUserRequest {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly externalIdentityId: string | null;
}

export interface RenameUserRequest {
  readonly firstName: string;
  readonly lastName: string;
}

export interface ChangeUserEmailRequest {
  readonly email: string;
}

export interface DeactivateUserRequest {
  readonly reason: string;
}

// ─── User permission strings — must match server-side dot-form ──────────────────
//   SOURCE  : src/app/features/users/data/user.permissions.ts (mirror of
//             Enterprise.Platform.Application.Features.Users.UserPermissions).
//   FORMAT  : `users.<action>` (lower-case, dot-separated). Compared case-insensitively.
//   HISTORY : Earlier `users:read` colon form was normalised platform-wide
//             2026-04-29 — see memory reference_user_module_e2e_done.
//   ACTION VOCABULARY (the only legal values):
//     • read       — list + detail
//     • create     — provision a new user
//     • write      — rename + change email (mutating existing profile fields)
//     • activate   — restore sign-in
//     • deactivate — suspend sign-in
//   activate / deactivate are SPLIT from write because HIPAA/SOX treat
//   activation-state changes as a distinct privileged action.
export const USER_PERMISSIONS = {
  READ:       'users.read',
  CREATE:     'users.create',
  WRITE:      'users.write',
  DEACTIVATE: 'users.deactivate',
  ACTIVATE:   'users.activate',
} as const;

export type UserPermissionKey = typeof USER_PERMISSIONS[keyof typeof USER_PERMISSIONS];

// ═════════════════════════════════════════════════════════════════════════════════
//
// SECTION 9 — RUNTIME CONFIG
// ─────────────────────────
// WHAT  : The runtime-injected config blob (`window.__EP_RUNTIME__`) — emitted
//         by index.html before the SPA boots. Source of truth for environment-
//         derived values (api base URL, feature flags, telemetry endpoints).
// WHY   : Keeps a single Angular build deployable to dev/staging/prod without
//         a rebuild — the host swaps the config blob.
// WHERE : src/runtime-config-holder.ts (init guard) + src/app/core/config/

export interface RuntimeConfig {
  readonly environment: 'development' | 'staging' | 'production';
  readonly apiBaseUrl: string;                 // e.g. '/api/proxy/v1'
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly telemetry: {
    readonly enabled: boolean;
    readonly applicationInsightsConnectionString?: string;  // Stripped Phase 3 — kept for shape
  };
  readonly auth: {
    readonly sessionEndpoint: string;          // '/api/auth/session'
    readonly antiforgeryEndpoint: string;      // '/api/antiforgery/token'
    readonly logoutEndpoint: string;           // '/api/auth/logout'
  };
  readonly buildId?: string;
  readonly version?: string;
}

// ═════════════════════════════════════════════════════════════════════════════════
//
//                                ─── END OF FILE ───
//
// REVIEW CADENCE  Quarterly. When a section's source-of-truth file changes shape,
//                 update this consolidated view in the same PR.
// CONTRACT TESTS  Architecture.Tests verify the chrome §6 keys against ChromeDtos.cs.
//                 Other sections rely on PR review until generated bridges land.
// CHANGELOG       Each FLAG closure should add a `RESOLVED <date>` line above the
//                 flag entry rather than deleting the flag, so the audit trail
//                 stays visible to future readers.
// ═════════════════════════════════════════════════════════════════════════════════
