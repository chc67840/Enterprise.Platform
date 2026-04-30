namespace Enterprise.Platform.Contracts.DTOs.Chrome;

/// <summary>
/// JSON wire shape for the platform's navbar + footer config emitted by
/// <c>GET /api/auth/session</c> after a successful Entra login. The SPA's
/// <c>NavbarConfigService</c> consumes this 1:1 — every property name + casing
/// here MUST round-trip through the SPA's TypeScript interface in
/// <c>shared/layout/models/nav.models.ts</c>.
/// </summary>
/// <remarks>
/// <para>
/// <b>Hand-mirror, not codegen.</b> No NSwag / openapi-typescript wired today;
/// the TS interfaces are the original source-of-truth and these C# records
/// were authored to match them. The contract test in
/// <c>Enterprise.Platform.Architecture.Tests</c> diffs the C# property names
/// against the TS interface keys and fails CI when one side drifts.
/// </para>
/// <para>
/// <b>RoutePath simplification.</b> The TS type accepts <c>string |
/// readonly (string | number)[] | UrlTree</c>. The wire format reduces this
/// to <c>string</c> only — every static config in <c>domains/</c> uses
/// string-form route paths, and the SPA's renderer normalises any consumer.
/// </para>
/// <para>
/// <b>Discriminated unions on the wire.</b> The TS <c>UserMenuItem</c> union
/// (link / divider / action) serialises to <see cref="UserMenuItemDto"/> —
/// a flat record with a <c>Kind</c> discriminator and every per-variant field
/// nullable. The SPA's TS type system narrows on <c>kind</c> at parse time;
/// the wire format stays simple and System.Text.Json-friendly without
/// <c>[JsonPolymorphic]</c> attribute gymnastics.
/// </para>
/// <para>
/// <b>Badge value typing.</b> The TS type allows <c>string | number</c>; the
/// wire format normalises to <c>string</c> ("99" rather than 99). The SPA's
/// renderer casts on the way in. Avoids JSON-polymorphism complexity for a
/// rarely-numeric field that only displays.
/// </para>
/// </remarks>
public sealed record ChromeConfigDto(
    NavbarConfigDto Navbar,
    FooterConfigDto Footer);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Shared primitives
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>Authorization gate. All fields optional — empty = "no gate".</summary>
public sealed record NavPermissionDto(
    string? RequiredPolicy,
    string? FeatureFlag,
    IReadOnlyList<string>? Roles);

/// <summary>Visual badge decoration on a nav / footer item.</summary>
/// <param name="Value">Display string ("Live", "Beta", "99"). Numbers serialise as their string form.</param>
/// <param name="Variant">PrimeNG severity vocabulary: info / success / warning / danger / secondary.</param>
/// <param name="Pulse">When true the badge pulses — reserved for live-data signals.</param>
public sealed record NavBadgeDto(
    string Value,
    string Variant,
    bool? Pulse);

/// <summary>One language entry in the language-switcher widget.</summary>
public sealed record LanguageOptionDto(
    string Code,
    string Label,
    string? FlagEmoji);

/// <summary>Tenant entry in the tenant switcher dropdown.</summary>
public sealed record TenantOptionDto(
    string Id,
    string DisplayName,
    string? Domain,
    string? EnvBadge);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Nav menu items
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>Leaf row inside a mega-menu section.</summary>
public sealed record NavMenuLeafDto(
    string Id,
    string Label,
    string? Icon,
    string? RoutePath,
    string? ExternalUrl,
    NavBadgeDto? Badge,
    NavPermissionDto? Permission,
    string? AnalyticsTag,
    bool? Disabled,
    string? Tooltip,
    string? Description);

/// <summary>One column of a mega menu — heading + leaves.</summary>
public sealed record NavMenuSectionDto(
    string Heading,
    string? Subheading,
    IReadOnlyList<NavMenuLeafDto> Leaves);

/// <summary>Top-level nav item. <c>Children</c> set ⇒ mega panel; absent ⇒ flat link.</summary>
public sealed record NavMenuItemDto(
    string Id,
    string Label,
    string? Icon,
    string? RoutePath,
    string? ExternalUrl,
    NavBadgeDto? Badge,
    NavPermissionDto? Permission,
    IReadOnlyList<NavMenuSectionDto>? Children,
    string? AnalyticsTag,
    bool? Disabled,
    string? Tooltip);

/// <summary>Centre-zone menu config.</summary>
public sealed record NavMenuConfigDto(
    string Variant,                               // 'flat' | 'mega' | 'icon' | 'tabs'
    IReadOnlyList<NavMenuItemDto> Items,
    string ActiveMatchStrategy,                   // 'exact' | 'prefix' | 'prefix-with-redirect'
    int? CollapseBreakpoint);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Left zone
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>Brand mark + product name + env badge.</summary>
public sealed record NavLogoConfigDto(
    string? ImageSrc,
    string Alt,
    string? BrandName,
    string? SubLabel,
    string HomeRoute,
    string? EnvBadge);

/// <summary>Tenant-switcher widget config.</summary>
public sealed record NavTenantSwitcherConfigDto(
    bool Enabled,
    TenantOptionDto CurrentTenant,
    IReadOnlyList<TenantOptionDto> AvailableTenants,
    NavPermissionDto? Permission);

/// <summary>Composite for the left zone (logo + optional tenant switcher).</summary>
public sealed record NavLeftZoneConfigDto(
    NavLogoConfigDto Logo,
    NavTenantSwitcherConfigDto? TenantSwitcher);

/// <summary>Wrapper so the wire shape matches <c>centerZone: { menu: NavMenuConfig }</c>.</summary>
public sealed record NavCenterZoneConfigDto(NavMenuConfigDto Menu);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Right zone widgets
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>IANA-timezone clock widget.</summary>
public sealed record NavClockConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    string? Timezone,
    string Format,                                // '12h' | '24h'
    bool? ShowTimezone);

/// <summary>Trading-hours descriptor for the market-status widget.</summary>
public sealed record MarketDescriptorDto(
    string Symbol,
    string Label,
    MarketTradingHoursDto? TradingHours);

/// <summary>Trading-hours sub-record (open + close).</summary>
public sealed record MarketTradingHoursDto(string Open, string Close);

/// <summary>Finance market-status pill widget.</summary>
public sealed record NavMarketStatusConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    IReadOnlyList<MarketDescriptorDto>? Markets);

/// <summary>Healthcare / HR shift-status widget.</summary>
public sealed record NavShiftStatusConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    string? Label);

/// <summary>Global search / command palette widget.</summary>
public sealed record NavGlobalSearchConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    string? Placeholder,
    string? SearchRoute,
    bool? CommandPaletteMode);

/// <summary>AI assistant launcher widget.</summary>
public sealed record NavAiAssistantConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    string? Label,
    string? Icon,
    string ActionKey);

/// <summary>One quick action inside the quick-actions widget.</summary>
public sealed record QuickActionDto(
    string Id,
    string Label,
    string? Icon,
    string ActionKey,
    NavPermissionDto? Permission,
    NavBadgeDto? Badge,
    string? Shortcut);

/// <summary>Quick-actions widget config.</summary>
public sealed record NavQuickActionsConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    string? Label,
    string? Icon,
    IReadOnlyList<QuickActionDto> Actions);

/// <summary>Bell-and-popover widget — used by both messages + notifications slots.</summary>
public sealed record NavBellWidgetConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    int? MaxBadgeCount,
    string? ViewAllRoute);

/// <summary>Help button widget.</summary>
public sealed record NavHelpConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    string? DocsUrl,
    string? Label,
    string? Icon);

/// <summary>Theme-toggle widget.</summary>
public sealed record NavThemeToggleConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    bool? IncludeSystem);

/// <summary>Language-switcher widget.</summary>
public sealed record NavLanguageSwitcherConfigDto(
    bool Enabled,
    NavPermissionDto? Permission,
    IReadOnlyList<LanguageOptionDto> Languages);

/// <summary>
/// Flat shape for the TS <c>UserMenuItem</c> union (link | divider | action).
/// Discriminate on <see cref="Kind"/> at the SPA boundary; per-variant fields
/// stay nullable so the wire format is stable.
/// </summary>
public sealed record UserMenuItemDto(
    string Kind,                                  // 'link' | 'divider' | 'action'
    string Id,
    string? Label,
    string? Icon,
    NavPermissionDto? Permission,
    bool? Disabled,
    // link variant
    string? RoutePath,
    string? ExternalUrl,
    // action variant
    string? ActionKey,
    bool? IsLogout);

/// <summary>User-menu dropdown config.</summary>
public sealed record NavUserMenuConfigDto(
    bool Enabled,
    bool ShowNameInHeader,
    bool ShowRoleInHeader,
    IReadOnlyList<UserMenuItemDto> MenuItems);

/// <summary>Composite for the right zone — every widget except UserMenu is optional.</summary>
public sealed record NavRightZoneConfigDto(
    NavClockConfigDto? Clock,
    NavMarketStatusConfigDto? MarketStatus,
    NavShiftStatusConfigDto? ShiftStatus,
    NavGlobalSearchConfigDto? GlobalSearch,
    NavAiAssistantConfigDto? AiAssistant,
    NavQuickActionsConfigDto? QuickActions,
    NavBellWidgetConfigDto? Messages,
    NavBellWidgetConfigDto? Notifications,
    NavHelpConfigDto? Help,
    NavThemeToggleConfigDto? ThemeToggle,
    NavLanguageSwitcherConfigDto? LanguageSwitcher,
    NavUserMenuConfigDto UserMenu);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Top-level NavbarConfig
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>Whole-navbar config returned to the SPA.</summary>
public sealed record NavbarConfigDto(
    NavLeftZoneConfigDto LeftZone,
    NavCenterZoneConfigDto CenterZone,
    NavRightZoneConfigDto RightZone,
    bool? Sticky,
    bool? GlassMorphism,
    int? HeightPx);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Footer
// ═══════════════════════════════════════════════════════════════════════════════

/// <summary>Single footer link.</summary>
public sealed record FooterLinkDto(
    string Label,
    string? RoutePath,
    string? ExternalUrl,
    string? Icon,
    NavBadgeDto? Badge);

/// <summary>One column of footer links.</summary>
public sealed record FooterLinkColumnDto(
    string Heading,
    IReadOnlyList<FooterLinkDto> Links);

/// <summary>Newsletter-signup widget shown in the footer top section.</summary>
public sealed record FooterNewsletterConfigDto(
    bool Enabled,
    string? Heading,
    string? Placeholder,
    string? SubmitLabel,
    string? ActionKey);

/// <summary>Compliance certifications + disclaimer + cookie-consent prompt.</summary>
public sealed record FooterComplianceConfigDto(
    IReadOnlyList<string>? Badges,                // 'soc2' | 'hipaa' | 'iso27001' | 'gdpr' | 'pci' | 'eeoc' | 'finra'
    string? Disclaimer,
    bool? CookieConsent);

/// <summary>Social-media shortcut entry.</summary>
public sealed record SocialLinkDto(
    string Platform,                              // 'twitter' | 'linkedin' | 'github' | …
    string Url);

/// <summary>Footer bottom-bar copyright + version + legal links.</summary>
public sealed record FooterBottomBarConfigDto(
    string CopyrightOwner,
    int? CopyrightYear,
    string? AppVersion,
    string? BuildId,
    string? StatusPageUrl,
    IReadOnlyList<FooterLinkDto>? Links,
    NavLanguageSwitcherConfigDto? LanguageSwitcher);

/// <summary>Footer logo (text + optional image).</summary>
public sealed record FooterLogoConfigDto(
    string? ImageSrc,
    string Alt,
    string? BrandName);

/// <summary>Whole-footer config returned to the SPA.</summary>
public sealed record FooterConfigDto(
    string Variant,                               // 'full' | 'minimal' | 'app'
    FooterLogoConfigDto? Logo,
    string? Tagline,
    IReadOnlyList<FooterLinkColumnDto>? Columns,
    IReadOnlyList<SocialLinkDto>? Social,
    FooterNewsletterConfigDto? Newsletter,
    FooterComplianceConfigDto? Compliance,
    FooterBottomBarConfigDto BottomBar);
