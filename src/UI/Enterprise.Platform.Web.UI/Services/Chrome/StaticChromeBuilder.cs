using System.Security.Claims;
using Enterprise.Platform.Application.Features.Users;
using Enterprise.Platform.Contracts.DTOs.Chrome;

namespace Enterprise.Platform.Web.UI.Services.Chrome;

/// <summary>
/// Phase 1 <see cref="IChromeBuilder"/> — returns a single hardcoded chrome
/// config built once at construction. Mirrors the SPA's offline fallback in
/// <c>shared/layout/chrome-fallback.ts</c>; the SPA's hand-mirrored TS shape
/// must round-trip through this exact JSON without surprise.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why pre-compute in the constructor.</b> The config is immutable per the
/// service lifetime and free of per-request state. Building it once at startup
/// avoids paying the allocation cost on every <c>/api/auth/session</c> call —
/// even at Phase 1 cost (~zero) the pattern lines up Phase 2's caching layer.
/// </para>
/// <para>
/// <b>Branding.</b> Generic "Enterprise Platform" labels — when a deployment
/// wants industry-specific branding (Finance / Healthcare / HR), edit this
/// builder OR replace the binding with a different <see cref="IChromeBuilder"/>
/// implementation. No code outside this file should hard-code chrome content.
/// </para>
/// </remarks>
public sealed class StaticChromeBuilder : IChromeBuilder
{
    private readonly ChromeConfigDto _config;

    /// <summary>Constructs the builder + materialises the singleton chrome config.</summary>
    public StaticChromeBuilder()
    {
        _config = BuildStaticConfig();
    }

    /// <inheritdoc />
    public Task<ChromeConfigDto> BuildAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        // Phase 1 ignores the principal — every authenticated user sees the
        // same chrome. Phase 2 will filter NavMenuItem[] by claims.
        _ = user;
        _ = cancellationToken;
        return Task.FromResult(_config);
    }

    // ── private helpers ─────────────────────────────────────────────────────

    private static ChromeConfigDto BuildStaticConfig() => new(
        Navbar: BuildNavbar(),
        Footer: BuildFooter());

    private static NavbarConfigDto BuildNavbar() => new(
        LeftZone: new NavLeftZoneConfigDto(
            Logo: new NavLogoConfigDto(
                // Served from `ClientApp/public/logo.svg` — Angular's `assets[]`
                // glob (`{ "input": "public", "glob": "**/*" }`) copies it to
                // the deployment root. Files placed under `src/assets/` are
                // NOT picked up — that path isn't in the build config.
                ImageSrc: "/rounded_logo_svg.svg",
                Alt: "Enterprise Platform — home",
                BrandName: "Enterprise Platform",
                SubLabel: "Workspace",
                HomeRoute: "/dashboard",
                EnvBadge: "staging"),
            TenantSwitcher: null),
        CenterZone: new NavCenterZoneConfigDto(
            Menu: new NavMenuConfigDto(
                // 'sidebar' moves the menu out of the top bar and into a
                // vertical rail rendered by <app-platform-side-nav> on the
                // SPA side. The top bar then surfaces a hamburger toggle
                // anchored to the left zone. See the NavMenuVariant doc
                // in shared/layout/models/nav.models.ts for the full
                // variant matrix.
                Variant: "sidebar",
                ActiveMatchStrategy: "prefix-with-redirect",
                CollapseBreakpoint: 1024,
                Items:
                [
                    NavItem(id: "dash",     label: "Dashboard", icon: "pi pi-home",       route: "/dashboard"),
                    UsersFlat(),
                    NavItem(id: "reports",  label: "Reports",   icon: "pi pi-chart-bar",  route: "/reports"),
                    NavItem(id: "settings", label: "Settings",  icon: "pi pi-cog",        route: "/settings"),
                    UiDemoMenu(),
                ])),
        RightZone: new NavRightZoneConfigDto(
            Clock: new NavClockConfigDto(
                Enabled: true,
                Permission: null,
                Timezone: null,                     // browser-local
                Format: "24h",
                ShowTimezone: true),
            MarketStatus: null,
            ShiftStatus: null,
            GlobalSearch: new NavGlobalSearchConfigDto(
                Enabled: true,
                Permission: null,
                Placeholder: "Search…",
                SearchRoute: null,
                CommandPaletteMode: true),
            AiAssistant: null,
            QuickActions: null,
            Messages: null,
            Notifications: new NavBellWidgetConfigDto(
                Enabled: true,
                Permission: null,
                MaxBadgeCount: 99,
                ViewAllRoute: "/notifications"),
            Help: new NavHelpConfigDto(
                Enabled: true,
                Permission: null,
                DocsUrl: null,
                Label: "Help",
                Icon: null),
            ThemeToggle: new NavThemeToggleConfigDto(
                Enabled: true,
                Permission: null,
                IncludeSystem: true),
            LanguageSwitcher: null,
            UserMenu: new NavUserMenuConfigDto(
                Enabled: true,
                ShowNameInHeader: true,
                ShowRoleInHeader: false,
                MenuItems:
                [
                    UserMenuLink(id: "profile", label: "Profile",      icon: "pi pi-user",        route: "/profile"),
                    UserMenuLink(id: "org",     label: "Organization", icon: "pi pi-building",    route: "/organization"),
                    UserMenuLink(id: "billing", label: "Billing",      icon: "pi pi-credit-card", route: "/billing"),
                    UserMenuDivider("div-1"),
                    UserMenuAction(id: "shortcuts", label: "Keyboard shortcuts", icon: "pi pi-keyboard", actionKey: "help.shortcuts"),
                    UserMenuAction(id: "whats-new", label: "What's new",          icon: "pi pi-star",     actionKey: "help.whatsNew"),
                    UserMenuDivider("div-2"),
                    UserMenuLogout(id: "sign-out", label: "Sign out", icon: "pi pi-sign-out", actionKey: "auth.logout"),
                ])),
        Sticky: true,
        GlassMorphism: true,
        HeightPx: 64);

    private static FooterConfigDto BuildFooter() => new(
        Variant: "full",
        Logo: new FooterLogoConfigDto(
            ImageSrc: null,
            Alt: "Enterprise Platform",
            BrandName: "Enterprise Platform"),
        Tagline: "Workspace",
        Columns:
        [
            new FooterLinkColumnDto(
                Heading: "Product",
                Links:
                [
                    new FooterLinkDto("Dashboard", "/dashboard", null, null, null),
                    new FooterLinkDto("Users",     "/users",     null, null, null),
                    new FooterLinkDto("Reports",   "/reports",   null, null, null),
                ]),
            new FooterLinkColumnDto(
                Heading: "Support",
                Links:
                [
                    new FooterLinkDto("Help",    null, "https://docs.example.com", null, null),
                    new FooterLinkDto("Contact", null, "mailto:support@example.com", null, null),
                ]),
            new FooterLinkColumnDto(
                Heading: "Legal",
                Links:
                [
                    new FooterLinkDto("Privacy", null, "https://example.com/privacy", null, null),
                    new FooterLinkDto("Terms",   null, "https://example.com/terms",   null, null),
                ]),
        ],
        Social: null,
        Newsletter: null,
        Compliance: new FooterComplianceConfigDto(
            Badges: ["soc2", "gdpr"],
            Disclaimer: null,
            CookieConsent: true),
        BottomBar: new FooterBottomBarConfigDto(
            CopyrightOwner: "Enterprise Platform Inc.",
            CopyrightYear: null,
            AppVersion: null,
            BuildId: null,
            StatusPageUrl: null,
            Links:
            [
                new FooterLinkDto("Privacy",       null, "https://example.com/privacy",       null, null),
                new FooterLinkDto("Terms",         null, "https://example.com/terms",         null, null),
                new FooterLinkDto("Accessibility", null, "https://example.com/accessibility", null, null),
            ],
            LanguageSwitcher: null));

    // ── factories — keep per-item construction terse + readable ────────────

    private static NavMenuItemDto NavItem(string id, string label, string icon, string route) => new(
        Id: id,
        Label: label,
        Icon: icon,
        RoutePath: route,
        ExternalUrl: null,
        Badge: null,
        Permission: null,
        Children: null,
        AnalyticsTag: null,
        Disabled: null,
        Tooltip: null);

    /// <summary>
    /// Users top-level link — flat navigation straight to the list page where
    /// every CRUD entry point lives (row click → detail, "New user" CTA in
    /// the page header → create form). The dropdown variant tested earlier
    /// added click-friction without UX payoff for a single-section menu;
    /// reverted 2026-04-29 in favour of the flat link.
    /// </summary>
    /// <remarks>
    /// Permission gate uses <see cref="UserPermissions.Read"/> — the same
    /// gate the route guard enforces, so the menu item only appears when the
    /// user can actually reach <c>/users</c>. Defense-in-depth: the SPA's
    /// <c>NavMenuComponent</c> filters this out client-side AND the route
    /// guard checks server-hydrated permissions before activation.
    /// </remarks>
    private static NavMenuItemDto UsersFlat() => new(
        Id: "users",
        Label: "Users",
        Icon: "pi pi-users",
        RoutePath: "/users",
        ExternalUrl: null,
        Badge: null,
        Permission: new NavPermissionDto(
            RequiredPolicy: UserPermissions.Read,
            FeatureFlag: null,
            Roles: null),
        Children: null,
        AnalyticsTag: "nav.users",
        Disabled: null,
        Tooltip: null);

    /// <summary>
    /// "UI Demo" parent with mega-menu sections covering every DPH UI Kit
    /// category. Surfaces the permanent UI Kit reference (lives at
    /// <c>/demo/ui-kit</c>) inside the navbar so engineers can find variants
    /// + edge-cases without leaving the running app. The "Kitchen Sink" entry
    /// points at the all-in-one showcase — every component on a single
    /// scrollable page.
    /// </summary>
    /// <remarks>
    /// No permission gate: the UI Kit is documentation, not a feature.
    /// Hide it in production by either (a) editing this builder or
    /// (b) wrapping the route group in a feature flag at build time.
    /// </remarks>
    private static NavMenuItemDto UiDemoMenu() => new(
        Id: "ui-demo",
        Label: "UI Demo",
        Icon: "pi pi-palette",
        RoutePath: "/demo/ui-kit",
        ExternalUrl: null,
        Badge: null,
        Permission: null,
        Children:
        [
            new NavMenuSectionDto(
                Heading: "Overview",
                Subheading: "Get started",
                Leaves:
                [
                    UiDemoLeaf("ui-kit-home",     "Overview",      "pi pi-th-large",        "/demo/ui-kit",                "Landing — every category at a glance"),
                    UiDemoLeaf("ui-kit-sink",     "Kitchen Sink",  "pi pi-objects-column", "/demo/ui-kit/kitchen-sink",   "All primitives on a single page"),
                    UiDemoLeaf("ui-kit-tokens",   "Design Tokens", "pi pi-palette",         "/demo/ui-kit/tokens",         "Color · spacing · density · motion"),
                ]),
            new NavMenuSectionDto(
                Heading: "Forms & Inputs",
                Subheading: "Build any form fast",
                Leaves:
                [
                    UiDemoLeaf("ui-kit-button",  "Buttons",      "pi pi-bolt",     "/demo/ui-kit/button",       "7 variants × 5 sizes + states"),
                    UiDemoLeaf("ui-kit-input",   "Inputs",       "pi pi-pencil",   "/demo/ui-kit/input",        "Text · email · password · textarea"),
                    UiDemoLeaf("ui-kit-form",    "Form Layout",  "pi pi-th-large", "/demo/ui-kit/form-layout",  "Grid / inline / wizard layouts"),
                    UiDemoLeaf("ui-kit-schema",  "Schema Form",  "pi pi-clone",    "/demo/ui-kit/schema-form",  "Declarative — schema → typed FormGroup"),
                    UiDemoLeaf("ui-kit-file",    "File Upload",  "pi pi-paperclip","/demo/ui-kit/file",         "Dropzone / button + preview"),
                ]),
            new NavMenuSectionDto(
                Heading: "Components",
                Subheading: "Display, navigation, overlays",
                Leaves:
                [
                    UiDemoLeaf("ui-kit-table",    "Data Table",       "pi pi-table",            "/demo/ui-kit/data-table", "17 cell types · multi-sort · async"),
                    UiDemoLeaf("ui-kit-chart",    "Charts",           "pi pi-chart-bar",        "/demo/ui-kit/chart",      "Theme-aware Chart.js wrapper"),
                    UiDemoLeaf("ui-kit-overlay",  "Overlays",         "pi pi-window-restore",   "/demo/ui-kit/overlay",    "Dialog · Drawer · Popover · Tooltip"),
                    UiDemoLeaf("ui-kit-confirm",  "Confirm Dialog",   "pi pi-question-circle",  "/demo/ui-kit/confirm",    "Promise-based ask() / askDestructive()"),
                    UiDemoLeaf("ui-kit-message",  "Messages + Toast", "pi pi-comment",          "/demo/ui-kit/message",    "Inline · toast · banners"),
                    UiDemoLeaf("ui-kit-list",     "Lists",            "pi pi-list",             "/demo/ui-kit/list",       "Simple · selectable · checklist"),
                    UiDemoLeaf("ui-kit-tree",     "Trees",            "pi pi-sitemap",          "/demo/ui-kit/tree",       "Hierarchical with selection · filter"),
                    UiDemoLeaf("ui-kit-panel",    "Panels",           "pi pi-window-maximize",  "/demo/ui-kit/panel",      "Cards: default · elevated · flat · ghost"),
                    UiDemoLeaf("ui-kit-media",    "Media",            "pi pi-image",            "/demo/ui-kit/media",      "Image · Avatar · Gallery"),
                    UiDemoLeaf("ui-kit-menu",     "Menus",            "pi pi-bars",             "/demo/ui-kit/menu",       "Dropdown · Context"),
                    UiDemoLeaf("ui-kit-steps",    "Steps + Wizard",   "pi pi-step-forward",     "/demo/ui-kit/steps",      "8 variants · sub-steps · validation"),
                ]),
        ],
        AnalyticsTag: "nav.uiDemo",
        Disabled: null,
        Tooltip: "Reference catalogue — every UI Kit primitive with all variants");

    private static NavMenuLeafDto UiDemoLeaf(string id, string label, string icon, string route, string description) => new(
        Id: id,
        Label: label,
        Icon: icon,
        RoutePath: route,
        ExternalUrl: null,
        Badge: null,
        Permission: null,
        AnalyticsTag: null,
        Disabled: null,
        Tooltip: null,
        Description: description);

    private static UserMenuItemDto UserMenuLink(string id, string label, string icon, string route) => new(
        Kind: "link",
        Id: id,
        Label: label,
        Icon: icon,
        Permission: null,
        Disabled: null,
        RoutePath: route,
        ExternalUrl: null,
        ActionKey: null,
        IsLogout: null);

    private static UserMenuItemDto UserMenuDivider(string id) => new(
        Kind: "divider",
        Id: id,
        Label: null,
        Icon: null,
        Permission: null,
        Disabled: null,
        RoutePath: null,
        ExternalUrl: null,
        ActionKey: null,
        IsLogout: null);

    private static UserMenuItemDto UserMenuAction(string id, string label, string icon, string actionKey) => new(
        Kind: "action",
        Id: id,
        Label: label,
        Icon: icon,
        Permission: null,
        Disabled: null,
        RoutePath: null,
        ExternalUrl: null,
        ActionKey: actionKey,
        IsLogout: null);

    private static UserMenuItemDto UserMenuLogout(string id, string label, string icon, string actionKey) => new(
        Kind: "action",
        Id: id,
        Label: label,
        Icon: icon,
        Permission: null,
        Disabled: null,
        RoutePath: null,
        ExternalUrl: null,
        ActionKey: actionKey,
        IsLogout: true);
}
