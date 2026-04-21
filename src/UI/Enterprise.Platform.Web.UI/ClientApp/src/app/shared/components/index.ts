/**
 * Barrel for `@shared/components/*`.
 *
 * Feature code imports shared primitives through this path:
 *   `import { PageHeaderComponent, EmptyStateComponent } from '@shared/components';`
 *
 * Directive barrel lives alongside at `@shared/directives`; keep them
 * separate so templates importing a single directive don't drag in every
 * primitive's component class.
 */
export { PageHeaderComponent } from './page-header/page-header.component';
export type { Breadcrumb } from './page-header/page-header.component';
export { EmptyStateComponent } from './empty-state/empty-state.component';
export { ErrorStateComponent } from './error-state/error-state.component';
export { LoadingOverlayComponent } from './loading-overlay/loading-overlay.component';
export { GlobalProgressBarComponent } from './global-progress-bar/global-progress-bar.component';
export { StatusBadgeComponent } from './status-badge/status-badge.component';
export type { StatusVariant } from './status-badge/status-badge.component';
export { SkeletonCardComponent } from './skeleton-card/skeleton-card.component';
export type { SkeletonVariant } from './skeleton-card/skeleton-card.component';

// Existing primitives (Phase 2–3) kept in this barrel for discoverability.
export { SessionExpiringDialogComponent } from './session-expiring-dialog/session-expiring-dialog.component';
export { RouterErrorBoundaryComponent } from './router-error-boundary/router-error-boundary.component';
