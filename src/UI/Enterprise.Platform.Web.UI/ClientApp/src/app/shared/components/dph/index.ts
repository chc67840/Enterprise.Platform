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
export { SchemaFormComponent } from './schema-form.component';
export { DrawerComponent } from './drawer.component';

// Phase B+ (2026-05-01) — schema-form field renderers
export { SelectComponent } from './select.component';
export type { SelectFieldConfig } from './select.component';
export { MultiSelectComponent } from './multi-select.component';
export type { MultiSelectFieldConfig } from './multi-select.component';
export { CheckboxComponent } from './checkbox.component';
export type { CheckboxFieldConfig } from './checkbox.component';
export { SwitchComponent } from './switch.component';
export type { SwitchFieldConfig } from './switch.component';
export { RadioGroupComponent } from './radio-group.component';
export type { RadioGroupFieldConfig } from './radio-group.component';
export { DatePickerComponent } from './date-picker.component';
export type { DatePickerFieldConfig, DatePickerKind } from './date-picker.component';

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
export { ChartWidgetComponent } from './chart-widget.component';
export type { ChartWidgetConfig, ChartWidgetDataset, ChartWidgetType } from './chart-widget.types';
export { buildChartData, buildChartOptions, paletteColor } from './chart-widget.builder';
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
  DrawerSize,
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

export type {
  FormSchema,
  SchemaField,
  SchemaFieldType,
  FieldValidatorSpec,
  ServerErrorIndex,
  // P1.1 — single-channel event union + per-kind subtypes for pattern matching
  SchemaFormEvent,
  SchemaFormFormEvent,
  SchemaFormFieldEvent,
  SchemaFormSectionEvent,
  SchemaFormActionEvent,
} from './schema-form.types';
export {
  isSchemaFormFormEvent,
  isSchemaFormFieldEvent,
  isSchemaFormSectionEvent,
  isSchemaFormActionEvent,
} from './schema-form.types';
