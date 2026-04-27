/**
 * ─── DPH UI KIT — public surface ────────────────────────────────────────────────
 *
 * Single import point for the entire UI Kit:
 *   import { ButtonComponent, DialogComponent, ToastService } from '@shared/components/dph';
 *
 * Tree-shaking is per-symbol, so unused components don't ship in a feature
 * bundle. New primitives land here as they're built.
 */

// Phase A — foundation
export { ButtonComponent } from './button.component';
export { DialogComponent } from './dialog.component';
export { ToastService } from './toast.service';

// Phase B — forms
export { InputComponent } from './input.component';
export { FieldErrorComponent } from './field-error.component';
export { FloatLabelComponent } from './float-label.component';
export { FormLayoutComponent } from './form-layout.component';
export { DrawerComponent } from './drawer.component';

// Phase C — data
export { DataTableComponent } from './data-table.component';
export { ListComponent } from './list.component';
export { TreeComponent } from './tree.component';
export { PanelComponent } from './panel.component';

// Phase D — rich content
export { AvatarComponent } from './avatar.component';
export { ImageComponent } from './image.component';
export { GalleryComponent } from './gallery.component';
export { InlineMessageComponent } from './inline-message.component';
export { StepsComponent } from './steps.component';
export { DropdownMenuComponent } from './dropdown-menu.component';
export { ContextMenuComponent } from './context-menu.component';
export { PopoverComponent } from './popover.component';
export { TooltipDirective } from './tooltip.directive';
export { FileUploadComponent } from './file-upload.component';
export { FileListComponent } from './file-list.component';
export { FilePreviewComponent } from './file-preview.component';

// Shared types
export type {
  AvatarConfig,
  ButtonConfig,
  ColumnDef,
  ContextMenuConfig,
  DialogConfig,
  DrawerConfig,
  DropdownMenuConfig,
  FieldErrorConfig,
  FileItem,
  FileUploadConfig,
  FloatLabelConfig,
  FormLayoutConfig,
  FormSection,
  GalleryConfig,
  ImageConfig,
  InlineMessageConfig,
  InputConfig,
  ListConfig,
  MenuItem,
  MessageDescriptor,
  OptionItem,
  PaginationState,
  PanelConfig,
  PopoverConfig,
  RowAction,
  Severity,
  Size,
  SortDirection,
  SortState,
  StepsConfig,
  TableConfig,
  TreeConfig,
  TreeNode,
  Variant,
} from './dph.types';
