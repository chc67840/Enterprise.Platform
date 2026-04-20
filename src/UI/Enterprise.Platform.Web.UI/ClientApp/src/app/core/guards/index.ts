/** Barrel for `@core/guards/*`. */
export { authGuard } from './auth.guard';
export { permissionGuard, anyPermissionGuard } from './permission.guard';
export { roleGuard } from './role.guard';
export { unsavedChangesGuard } from './unsaved-changes.guard';
export type { HasUnsavedChanges } from './unsaved-changes.guard';
