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
export { DataTableComponent, LocalDataSource } from './data-table.component';
export { LiveDataTableComponent } from './live-data-table.component';
export { CellRendererComponent as DphCellComponent } from './data-table/cell-renderer.component';
export { ColumnFilterComponent as DphColumnFilterComponent } from './data-table/column-filter.component';
export { ColumnChooserComponent as DphColumnChooserComponent } from './data-table/column-chooser.component';
export { BulkToolbarComponent as DphBulkToolbarComponent } from './data-table/bulk-action-toolbar.component';
export { RemoteDataSource } from './data-table/data-source';
export type { DataTableSource } from './data-table/data-source';
export { ListComponent } from './list.component';
export { TreeComponent } from './tree.component';
export { PanelComponent } from './panel.component';

// Phase D — rich content
export { AvatarComponent } from './avatar.component';
export { ImageComponent } from './image.component';
export { GalleryComponent } from './gallery.component';
export { InlineMessageComponent } from './inline-message.component';
export { StepsComponent } from './steps.component';
export { WizardButtonsComponent } from './wizard-buttons.component';
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
  BulkAction,
  ButtonConfig,
  CellOptions,
  CellType,
  ColumnDef,
  ColumnFilter,
  ContextMenuConfig,
  DataSource,
  DialogConfig,
  DrawerConfig,
  DropdownMenuConfig,
  FieldErrorConfig,
  FileItem,
  FileUploadConfig,
  FilterDef,
  FilterOp,
  FilterType,
  FilterValue,
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
  MultiSortState,
  OptionItem,
  PaginationState,
  PanelConfig,
  PopoverConfig,
  RowAction,
  Severity,
  Size,
  SortDirection,
  SortState,
  StepDescriptor,
  StepState,
  StepsConfig,
  StepsVariant,
  TableConfig,
  TablePage,
  TableQuery,
  TableToolbarConfig,
  TreeConfig,
  TreeNode,
  Variant,
  WizardButtonsConfig,
} from './dph.types';
