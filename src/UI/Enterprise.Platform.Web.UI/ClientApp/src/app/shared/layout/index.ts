/**
 * ─── shared/layout — barrel ─────────────────────────────────────────────────────
 *
 * Public surface for the platform's chrome layer. Domain teams import only
 * from here so the internal file layout stays free to refactor.
 *
 * Today (after F.1) this barrel re-exports the type system only. Phases
 * F.2 – F.6 will add the implementing components (`PlatformNavbarComponent`,
 * `NavMenuComponent`, `UserMenuButtonComponent`, `NotificationBellComponent`,
 * `QuickActionsComponent`, `PlatformFooterComponent`, plus the per-domain
 * config factories) — every new export lands here, keeping import paths
 * stable (`@shared/layout`).
 */

export type {
  // ── shared primitives ────────────────────────────────────────────────────
  ComplianceBadge,
  DomainChromeConfig,
  EnvBadge,
  IconClass,
  LanguageOption,
  NavActionEvent,
  NavActionSource,
  NavBadge,
  NavLogoutEvent,
  NavPermission,
  NavSearchEvent,
  NavTenantSwitchEvent,
  Routes,
  RoutePath,
  SocialLink,
  SocialPlatform,
  TenantOption,
  UserProfile,

  // ── nav menu ─────────────────────────────────────────────────────────────
  NavActiveMatchStrategy,
  NavMenuConfig,
  NavMenuItem,
  NavMenuLeaf,
  NavMenuSection,
  NavMenuVariant,

  // ── navbar zones + composite ─────────────────────────────────────────────
  NavbarConfig,
  NavLeftZoneConfig,
  NavLogoConfig,
  NavRightZoneConfig,
  NavTenantSwitcherConfig,

  // ── right-zone widgets ───────────────────────────────────────────────────
  MarketDescriptor,
  NavAiAssistantConfig,
  NavBellWidgetConfig,
  NavClockConfig,
  NavGlobalSearchConfig,
  NavHelpConfig,
  NavLanguageSwitcherConfig,
  NavMarketStatusConfig,
  NavQuickActionsConfig,
  NavRightZoneWidgetBase,
  NavShiftStatusConfig,
  NavThemeToggleConfig,
  NavUserMenuConfig,
  QuickAction,
  UserMenuAction,
  UserMenuDivider,
  UserMenuItem,
  UserMenuLink,

  // ── notification + message DTO ───────────────────────────────────────────
  NavNotification,
  NavNotificationLevel,

  // ── footer ───────────────────────────────────────────────────────────────
  FooterBottomBarConfig,
  FooterComplianceConfig,
  FooterConfig,
  FooterLink,
  FooterLinkColumn,
  FooterLogoConfig,
  FooterNewsletterConfig,
  FooterVariant,
} from './models/nav.models';

// ── F.2 components ─────────────────────────────────────────────────────────
export { PlatformNavbarComponent } from './components/platform-navbar/platform-navbar.component';
export { NavMenuComponent } from './components/nav-menu/nav-menu.component';
export { NotificationBellComponent } from './components/notification-bell/notification-bell.component';
export { UserMenuButtonComponent } from './components/user-menu-button/user-menu-button.component';

// ── F.3 widgets ────────────────────────────────────────────────────────────
export { LanguageSwitcherComponent } from './components/widgets/language-switcher.component';
export { NavClockComponent } from './components/widgets/nav-clock.component';
export { QuickActionsComponent } from './components/widgets/quick-actions.component';
export { ThemeToggleButtonComponent } from './components/widgets/theme-toggle-button.component';

// ── F.5 footer ─────────────────────────────────────────────────────────────
export { PlatformFooterComponent as PlatformFooterV2Component } from './components/platform-footer/platform-footer.component';

// ── F.7 providers (dynamic config sources) ────────────────────────────────
export {
  NAVBAR_CONFIG_PROVIDER,
  StaticNavbarConfigProvider,
  BackendNavbarConfigProvider,
} from './providers';
export type { NavbarConfigContext, NavbarConfigProvider } from './providers';
