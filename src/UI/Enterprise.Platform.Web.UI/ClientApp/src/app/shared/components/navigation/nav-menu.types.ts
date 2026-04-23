/**
 * ─── NAV MENU TYPES ────────────────────────────────────────────────────────────
 *
 * Generic, framework-agnostic shape that drives every nav variant
 * (`TopNavHorizontalComponent`, `TopNavWithSidebarComponent`,
 * `TopNavCompactComponent`).
 *
 * Why a project-owned shape (instead of leaning on PrimeNG's `MenuItem`):
 *   1. The contract is stable across PrimeNG major upgrades — `MenuItem` has
 *      shifted shape twice in the v17→v21 line, our DTO doesn't.
 *   2. Authorization metadata (`requiredPermissions` / `requiredRoles` /
 *      `featureFlag`) is first-class — `MenuItem.visible` is too coarse for
 *      our claims-based gating.
 *   3. We can swap the rendering layer (PrimeNG → Material → custom) without
 *      changing the menu source. The mapper is the only thing that moves.
 *
 * The mapper at `nav-menu-mapper.ts` is the single bridge from this shape
 * to PrimeNG's `MenuItem` when the rendering layer needs it.
 */

/** Discriminator for the kind of nav node. */
export type NavMenuItemKind = 'link' | 'group' | 'action' | 'separator';

/**
 * One node in the nav tree. Links navigate via Angular's router; groups hold
 * children; actions emit a command; separators render a divider.
 *
 * Authorization fields are optional — when present, the mapper hides items
 * whose requirements the current user doesn't meet. Hiding (vs disabling) is
 * deliberate: leaking the existence of unreachable areas is itself an
 * information disclosure risk in regulated domains (HIPAA / SOX / GDPR).
 */
export interface NavMenuItem {
  /** Stable id used for `track` and analytics. Required. */
  readonly id: string;

  /** What this node is. Drives both the mapper and the renderer. */
  readonly kind: NavMenuItemKind;

  /** User-facing label. Optional only for `'separator'`. */
  readonly label?: string;

  /**
   * PrimeIcons class (e.g. `'pi pi-home'`) or a leading svg-icon name. Free-form
   * string so a renderer can decide how to interpret it; the supplied variants
   * assume the PrimeIcons convention.
   */
  readonly icon?: string;

  /**
   * Router target for `kind: 'link'`. May be a string (`'/dashboard'`) or an
   * array (`['/users', userId]`). Ignored for non-link kinds.
   */
  readonly routerLink?: string | readonly (string | number)[];

  /**
   * `external: true` opens the link in a new tab via plain `<a href>` — used
   * for Help / Docs / status pages that live outside the SPA. Defaults to false.
   */
  readonly external?: boolean;

  /** Children for `kind: 'group'`. Ignored otherwise. */
  readonly children?: readonly NavMenuItem[];

  /** Command for `kind: 'action'` (e.g. "Open command palette"). */
  readonly command?: () => void;

  /**
   * Optional badge (count, "New", "Beta"). Rendered next to the label;
   * variants decide whether to show it on collapsed sidebars.
   */
  readonly badge?: string | number;

  /** Visual hint for the badge — falls back to the variant's default. */
  readonly badgeSeverity?: 'info' | 'success' | 'warning' | 'danger' | 'secondary';

  /** Tooltip text for icon-only renders (collapsed sidebar / compact bar). */
  readonly tooltip?: string;

  /**
   * ANY-of permission gate. Item shows iff user has at least one of these
   * permissions, OR the user is bypass-flagged. Empty/undefined = no gate.
   */
  readonly requiredPermissions?: readonly string[];

  /** ANY-of role gate. Empty/undefined = no gate. */
  readonly requiredRoles?: readonly string[];

  /**
   * Feature-flag key. Item shows iff the flag is enabled. Resolution is the
   * mapper's responsibility; the menu source just declares the dependency.
   */
  readonly featureFlag?: string;

  /**
   * Disabled for non-authorization reasons (e.g. data isn't ready yet). For
   * authorization-driven hiding, prefer `requiredPermissions` so the item
   * disappears entirely.
   */
  readonly disabled?: boolean;
}

/**
 * Logo + product-name pair shown on the left of every variant. Kept generic
 * so a tenant rebrand or a child-app embed can override per host.
 */
export interface NavBranding {
  /** Short product name shown next to the logo. */
  readonly productName: string;

  /** Optional sub-label (tenant name, environment ribbon). */
  readonly productSubLabel?: string;

  /**
   * Logo source — can be an `<img src>` URL or null to render an icon-glyph
   * fallback (`logoIcon`). When both are set, image wins.
   */
  readonly logoSrc?: string | null;

  /**
   * PrimeIcons class to render when no `logoSrc` is supplied. Defaults to
   * `'pi pi-bolt'` in the variant components.
   */
  readonly logoIcon?: string;

  /** Where the logo links to. Defaults to `/`. */
  readonly homeRouterLink?: string;
}

/** Identifier for the supplied nav variant — useful for analytics + tests. */
export type NavVariant = 'horizontal' | 'with-sidebar' | 'compact';
