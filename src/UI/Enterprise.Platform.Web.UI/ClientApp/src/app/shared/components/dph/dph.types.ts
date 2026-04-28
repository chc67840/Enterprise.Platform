/**
 * ─── DPH UI KIT — SHARED TYPES ──────────────────────────────────────────────────
 *
 * Every config interface used by the dph-* components in this folder. One
 * file so consumers only ever import from `@shared/components/dph` (the
 * barrel re-exports these). Type-only — zero runtime cost.
 *
 * Naming convention: friendly + consistent. `clearable` not `showClear`,
 * `idField` not `dataKey`, `loadingText` not `loadingLabel`. Common-word
 * names beat acronyms.
 *
 * `appendTo` is INTENTIONALLY OMITTED from public configs — every overlay
 * defaults to `appendTo: 'body'` internally (no foot-gun).
 */
import type { TemplateRef } from '@angular/core';

// ─── Primitives ──────────────────────────────────────────────────────────────

/** Severity used by buttons, messages, badges, banners. */
export type Severity = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Size used by inputs, buttons, tables, lists. */
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Visual variant. */
export type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'link' | 'danger';

/** Sort direction. */
export type SortDirection = 'asc' | 'desc' | null;

// ─── Option, pagination, sort ────────────────────────────────────────────────

export interface OptionItem {
  readonly label: string;
  readonly value: unknown;
  readonly icon?: string;
  readonly disabled?: boolean;
  readonly badge?: string;
  readonly styleClass?: string;
  readonly items?: readonly OptionItem[];
}

export interface PaginationState {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly pageSizes: readonly number[];
}

export interface SortState {
  readonly field: string;
  readonly direction: SortDirection;
}

// ─── Files (upload + media) ──────────────────────────────────────────────────

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

// ─── Tree ────────────────────────────────────────────────────────────────────

export interface TreeNode<T = unknown> {
  readonly key: string;
  readonly label: string;
  readonly data?: T;
  readonly icon?: string;
  readonly children?: readonly TreeNode<T>[];
  readonly leaf?: boolean;
  readonly selectable?: boolean;
  readonly expanded?: boolean;
  readonly styleClass?: string;
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly routePath?: string;
  readonly externalUrl?: string;
  readonly badge?: string;
  readonly badgeSeverity?: Severity;
  readonly disabled?: boolean;
  readonly separator?: boolean;
  readonly items?: readonly MenuItem[];
  readonly command?: () => void;
  readonly queryParams?: Record<string, string>;
  readonly requiredPermission?: string;
  readonly visible?: boolean;
}

// ─── Table ───────────────────────────────────────────────────────────────────

/** All column cell renderers. */
export type CellType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'badge'
  | 'avatar'
  | 'avatar-group'
  | 'link'
  | 'email'
  | 'phone'
  | 'image'
  | 'rating'
  | 'progress'
  | 'sparkline'
  | 'chips'
  | 'multi-line'
  | 'status-dot'
  | 'json'
  | 'actions'
  | 'custom';

/** Filter operator vocabulary — superset across all filter types. */
export type FilterOp =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'between'
  | 'before'
  | 'after'
  | 'on'
  | 'dateRange'
  | 'inLast'
  | 'is'
  | 'isNot'
  | 'in'
  | 'notIn'
  | 'isEmpty'
  | 'isNotEmpty';

/** Column filter type — drives which UI control + which ops are exposed. */
export type FilterType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'enum'
  | 'multi-enum'
  | 'range';

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
  readonly value2?: unknown;
}

export interface ColumnFilter {
  readonly field: string;
  readonly value: FilterValue | null;
}

/** Type-specific render options — keep all here, ignored when irrelevant. */
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
  readonly progressShowValue?: boolean;
  readonly sparklineColor?: string;
  readonly maxLines?: number;
  readonly statusColors?: Record<string, string>;
  readonly statusLabels?: Record<string, string>;
  readonly maxAvatars?: number;
  readonly badgeSeverityMap?: Record<string, Severity>;
}

export interface ColumnDef<T = unknown> {
  readonly field: string;
  readonly header: string;
  readonly type?: CellType;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly filter?: FilterDef;
  readonly frozen?: 'left' | 'right' | null;
  readonly width?: string;
  readonly minWidth?: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly visible?: boolean;
  readonly toggleable?: boolean;
  readonly priority?: 'high' | 'medium' | 'low';
  readonly exportable?: boolean;
  readonly cssClass?: string | ((row: T) => string);
  readonly format?: (value: unknown, row: T) => string;
  readonly cellOptions?: CellOptions;
  readonly editable?: boolean | ((row: T) => boolean);
  readonly editor?: 'text' | 'number' | 'select' | 'date' | 'boolean';
  readonly editorOptions?: readonly OptionItem[];
  readonly aggregator?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  readonly tooltip?: (value: unknown, row: T) => string | null;
  readonly help?: string;
}

/** Multi-sort state — order in array determines priority. */
export interface MultiSortState {
  readonly fields: readonly SortState[];
}

/** Query envelope passed to a DataSource on every reload. */
export interface TableQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: readonly SortState[];
  readonly filters: readonly ColumnFilter[];
  readonly globalFilter?: string;
  readonly cursor?: string;
}

export interface TablePage<T> {
  readonly rows: readonly T[];
  readonly total: number;
  readonly nextCursor?: string;
  readonly prevCursor?: string;
}

/**
 * Parent of a server-mode async data source — provides rows on demand.
 * `_T` is the row type (kept on the public surface even though the lazily-typed
 * `unknown` return is what the kit consumes — concrete `DataTableSource<T>`
 * narrows to `Observable<TablePage<T>>`).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface DataSource<_T> {
  load(query: TableQuery): unknown;
}

export interface RowAction<T = unknown> {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly severity?: Severity;
  readonly disabled?: boolean | ((row: T) => boolean);
  readonly visible?: boolean | ((row: T) => boolean);
  readonly requiredPermission?: string;
}

// ─── Message / Toast ─────────────────────────────────────────────────────────

export interface MessageDescriptor {
  readonly id?: string;
  readonly severity: Severity;
  readonly summary: string;
  readonly detail?: string;
  readonly life?: number;
  readonly sticky?: boolean;
  readonly closable?: boolean;
  readonly icon?: string;
}

// ─── Form layout ─────────────────────────────────────────────────────────────

export interface FormSection {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly icon?: string;
  readonly columns?: 1 | 2 | 3 | 4;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
}

export interface FormLayoutConfig {
  readonly variant: 'grid' | 'stacked' | 'inline' | 'wizard' | 'tabbed';
  readonly columns?: 1 | 2 | 3 | 4;
  readonly gap?: Size;
  readonly labelPosition?: 'top' | 'left' | 'floating';
  readonly labelWidth?: string;
  readonly sections?: readonly FormSection[];
  readonly dense?: boolean;
  readonly readonly?: boolean;
  readonly showRequiredIndicator?: boolean;
}

// ─── Input ───────────────────────────────────────────────────────────────────

export interface InputConfig {
  readonly type:
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | 'tel'
    | 'url'
    | 'search'
    | 'textarea'
    | 'mask'
    | 'color'
    | 'range';
  readonly label?: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly prefixIcon?: string;
  readonly suffixIcon?: string;
  readonly prefixText?: string;
  readonly suffixText?: string;
  readonly maxLength?: number;
  readonly showCounter?: boolean;
  readonly rows?: number;
  readonly autoResize?: boolean;
  readonly mask?: string;
  readonly slotChar?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly locale?: string;
  readonly currency?: string;
  readonly clearable?: boolean;
  readonly readonly?: boolean;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly size?: Size;
  readonly variant?: 'outlined' | 'filled';
  readonly floatLabel?: boolean;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
  readonly autocomplete?: string;
  readonly loading?: boolean;
}

export interface FloatLabelConfig {
  readonly label: string;
  readonly variant?: 'in' | 'on' | 'over';
  readonly labelId?: string;
}

export interface FieldErrorConfig {
  readonly errors: readonly string[];
  readonly touched?: boolean;
  readonly dirty?: boolean;
  readonly showAll?: boolean;
  readonly icon?: boolean;
  readonly id?: string;
}

// ─── Button ──────────────────────────────────────────────────────────────────

export interface ButtonConfig {
  readonly variant?: Variant | 'icon';
  readonly size?: Size;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly loadingText?: string;
  readonly icon?: string;
  readonly iconPosition?: 'left' | 'right';
  readonly fullWidth?: boolean;
  readonly rounded?: boolean;
  readonly raised?: boolean;
  readonly badge?: string;
  readonly badgeSeverity?: Severity;
  readonly ariaLabel?: string;
  readonly tooltip?: string;
}

// ─── Table ───────────────────────────────────────────────────────────────────

export interface BulkAction {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly severity?: Severity;
  readonly confirm?: boolean;
  readonly confirmMessage?: string;
}

export interface TableToolbarConfig {
  readonly search?: boolean;
  readonly searchPlaceholder?: string;
  readonly refresh?: boolean;
  readonly export?: boolean;
  readonly chooser?: boolean;
  readonly density?: boolean;
}

export interface TableConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly columns: readonly ColumnDef<T>[];
  readonly idField: string;

  // Selection
  readonly selectionMode?: 'single' | 'multiple' | null;
  readonly persistSelection?: boolean;

  // Sorting / filtering
  readonly sortable?: boolean;
  readonly multiSort?: boolean;
  readonly filterable?: boolean;
  readonly globalFilter?: boolean;
  readonly globalFilterFields?: readonly string[];

  // Pagination
  readonly pagination?: boolean;
  readonly pageSizes?: readonly number[];
  readonly defaultPageSize?: number;
  readonly cursorMode?: boolean;

  // Actions
  readonly rowActions?: readonly RowAction<T>[];
  readonly rowActionsMax?: number;
  readonly bulkActions?: readonly BulkAction[];

  // Layout / scroll
  readonly resizable?: boolean;
  readonly scrollable?: boolean;
  readonly scrollHeight?: string;
  readonly virtualScroll?: boolean;
  readonly virtualScrollItemSize?: number;
  readonly stickyHeader?: boolean;
  readonly stickyFooter?: boolean;
  readonly responsiveMode?: 'scroll' | 'stack' | 'cards' | 'priority';

  // Visual
  readonly striped?: boolean;
  readonly gridLines?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly density?: 'sm' | 'md' | 'lg';
  readonly densitySelector?: boolean;
  readonly caption?: string;
  readonly captionTemplate?: TemplateRef<unknown>;
  readonly toolbar?: TableToolbarConfig;

  // Empty / loading / error
  readonly emptyMessage?: string;
  readonly emptyIcon?: string;
  readonly emptyAfterFilterMessage?: string;
  readonly errorMessage?: string;
  readonly errorRetryLabel?: string;
  readonly skeletonRows?: number;

  // Row features
  readonly expandable?: boolean;
  readonly rowDetailTemplate?: TemplateRef<{ $implicit: T; index: number }>;
  readonly groupBy?: string;
  readonly groupHeaderTemplate?: TemplateRef<{ $implicit: { key: string; rows: readonly T[] } }>;
  readonly showGroupTotals?: boolean;
  readonly inlineEdit?: 'cell' | 'row' | null;
  readonly rowClass?: (row: T) => string;
  readonly rowSeverity?: (row: T) => Severity | null;

  // Nested tables (recursive — render a sub-table inside the row detail)
  readonly nestedConfig?: (row: T) => TableConfig<Record<string, unknown>> | null;
  readonly nestedData?: (row: T) => readonly Record<string, unknown>[] | null;

  // Footer / aggregators
  readonly footerTemplate?: TemplateRef<{ rows: readonly T[]; totals: Record<string, unknown> }>;

  // Mobile card view
  readonly cardTemplate?: TemplateRef<{ $implicit: T; index: number }>;

  // Export
  readonly exportable?: boolean;
  readonly exportFilename?: string;

  // Persistence
  readonly stateKey?: string;
  readonly persistState?: 'url' | 'localStorage' | 'both' | null;

  // Custom column rendering
  readonly customColumnTemplates?: Record<string, TemplateRef<{ $implicit: T; value: unknown }>>;
}

// ─── List ────────────────────────────────────────────────────────────────────

export interface ListConfig<T = unknown> {
  readonly variant: 'simple' | 'ordered' | 'data' | 'selectable' | 'checklist' | 'draggable';
  readonly itemTemplate?: TemplateRef<{ $implicit: T; index: number; selected: boolean }>;
  readonly emptyMessage?: string;
  readonly dividers?: boolean;
  readonly striped?: boolean;
  readonly compact?: boolean;
  readonly skeletonCount?: number;
  readonly virtualScroll?: boolean;
  readonly virtualScrollItemSize?: number;
  readonly selectionMode?: 'single' | 'multiple' | null;
  readonly idField?: string;
  readonly filterable?: boolean;
  readonly filterPlaceholder?: string;
  readonly groupBy?: string;
  readonly maxHeight?: string;
}

// ─── Tree ────────────────────────────────────────────────────────────────────

export interface TreeConfig<T = unknown> {
  readonly selectionMode?: 'single' | 'multiple' | 'checkbox' | null;
  readonly filter?: boolean;
  readonly filterMode?: 'lenient' | 'strict';
  readonly filterPlaceholder?: string;
  readonly scrollable?: boolean;
  readonly scrollHeight?: string;
  readonly virtualScroll?: boolean;
  readonly virtualScrollItemSize?: number;
  readonly lazy?: boolean;
  readonly indentation?: number;
  readonly nodeTemplate?: TemplateRef<{ $implicit: TreeNode<T> }>;
  readonly emptyMessage?: string;
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export interface PanelConfig {
  readonly variant?: 'default' | 'elevated' | 'flat' | 'ghost' | 'glass';
  readonly header?: string;
  readonly subheader?: string;
  readonly icon?: string;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly closable?: boolean;
  readonly loading?: boolean;
  readonly loadingContent?: 'skeleton' | 'spinner' | 'overlay';
  readonly padding?: 'none' | 'sm' | 'md' | 'lg';
  readonly borderRadius?: 'sm' | 'md' | 'lg' | 'xl';
  readonly footerAlign?: 'left' | 'center' | 'right' | 'between';
}

// ─── Overlays ────────────────────────────────────────────────────────────────

export interface DialogConfig {
  readonly header?: string;
  readonly subheader?: string;
  readonly width?: string;
  readonly maxHeight?: string;
  readonly position?:
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'topleft'
    | 'topright'
    | 'bottomleft'
    | 'bottomright';
  readonly modal?: boolean;
  readonly dismissableMask?: boolean;
  readonly closable?: boolean;
  readonly draggable?: boolean;
  readonly resizable?: boolean;
  readonly maximizable?: boolean;
  readonly closeOnEscape?: boolean;
  readonly footerAlign?: 'left' | 'center' | 'right' | 'between';
  readonly contentPadding?: boolean;
  readonly loading?: boolean;
}

export interface DrawerConfig {
  readonly position: 'left' | 'right' | 'top' | 'bottom';
  readonly width?: string;
  readonly height?: string;
  readonly modal?: boolean;
  readonly dismissableMask?: boolean;
  readonly closable?: boolean;
  readonly showCloseInHeader?: boolean;
  readonly header?: string;
  readonly closeOnEscape?: boolean;
}

export interface PopoverConfig {
  readonly trigger?: 'click' | 'hover' | 'focus';
  readonly position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  readonly offset?: number;
  readonly showDelay?: number;
  readonly hideDelay?: number;
  readonly dismissable?: boolean;
  readonly maxWidth?: string;
}

// ─── Media ───────────────────────────────────────────────────────────────────

export interface ImageConfig {
  readonly src: string;
  readonly alt: string;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  readonly loading?: 'lazy' | 'eager';
  readonly fallbackSrc?: string;
  readonly fallbackIcon?: string;
  readonly preview?: boolean;
  readonly skeleton?: boolean;
  readonly rounded?: boolean | 'full';
  readonly aspectRatio?: '1/1' | '4/3' | '16/9' | '3/2' | 'auto';
}

export interface AvatarConfig {
  readonly src?: string;
  readonly name?: string;
  readonly label?: string;
  readonly icon?: string;
  readonly size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  readonly shape?: 'circle' | 'square';
  readonly badge?: {
    readonly value?: string;
    readonly severity?: Severity;
    readonly position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  };
  readonly bgColor?: string;
  readonly textColor?: string;
}

export interface GalleryConfig {
  readonly items: readonly { src: string; alt: string; thumbnail?: string; caption?: string }[];
  readonly columns?: 2 | 3 | 4 | 5;
  readonly gap?: Size;
  readonly aspect?: '1/1' | '4/3' | '16/9';
  readonly lightbox?: boolean;
  readonly lazy?: boolean;
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export interface DropdownMenuConfig {
  readonly items: readonly MenuItem[];
  readonly trigger?: 'click' | 'hover';
}

export interface ContextMenuConfig {
  readonly items: readonly MenuItem[];
  readonly global?: boolean;
}

// ─── Steps / Wizard ──────────────────────────────────────────────────────────

export type StepState =
  | 'pending'
  | 'active'
  | 'complete'
  | 'error'
  | 'warning'
  | 'skipped'
  | 'disabled'
  | 'loading';

export type StepsVariant =
  | 'horizontal'
  | 'vertical'
  | 'pill-bar'
  | 'progress'
  | 'cards'
  | 'split'
  | 'accordion'
  | 'dots';

export interface StepDescriptor {
  readonly key: string;
  readonly label: string;
  readonly icon?: string;
  readonly description?: string;
  readonly state?: StepState;
  readonly errorCount?: number;
  readonly optional?: boolean;
  readonly children?: readonly StepDescriptor[];
  readonly when?: () => boolean;
  readonly help?: string;
  readonly badge?: { readonly value: string; readonly severity?: Severity };
  readonly time?: number;
  readonly routePath?: string;
}

export interface StepsConfig {
  readonly steps: readonly StepDescriptor[];
  readonly activeIndex: number;
  readonly activeKey?: string;
  readonly variant?: StepsVariant;
  readonly orientation?: 'horizontal' | 'vertical';
  readonly readonly?: boolean;
  readonly showLabels?: boolean;
  readonly showConnectors?: boolean;
  readonly showProgress?: boolean;
  readonly showHelp?: boolean;
  readonly allowFreeNav?: boolean;
  readonly mobileMode?: 'collapse' | 'dots' | 'drawer';
  readonly animateConnectors?: boolean;
  readonly compact?: boolean;
}

export interface WizardButtonsConfig {
  readonly showBack?: boolean;
  readonly showNext?: boolean;
  readonly showCancel?: boolean;
  readonly showSkip?: boolean;
  readonly showFinish?: boolean;
  readonly backLabel?: string;
  readonly nextLabel?: string;
  readonly cancelLabel?: string;
  readonly skipLabel?: string;
  readonly finishLabel?: string;
  readonly nextDisabled?: boolean;
  readonly nextLoading?: boolean;
  readonly isLast?: boolean;
  readonly isFirst?: boolean;
  readonly canSkip?: boolean;
  readonly sticky?: boolean;
}

// ─── Message / inline ────────────────────────────────────────────────────────

export interface InlineMessageConfig {
  readonly severity: Severity;
  readonly summary?: string;
  readonly detail?: string;
  readonly icon?: string;
  readonly closable?: boolean;
  readonly life?: number;
  readonly actions?: readonly { label: string; key: string; variant?: Variant }[];
  readonly compact?: boolean;
  readonly filled?: boolean;
  readonly rounded?: boolean;
}

// ─── File upload ─────────────────────────────────────────────────────────────

export interface FileUploadConfig {
  readonly variant: 'dropzone' | 'button' | 'inline';
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly maxFileSize?: number;
  readonly maxFiles?: number;
  readonly minFileSize?: number;
  readonly autoUpload?: boolean;
  readonly showPreview?: boolean;
  readonly showProgress?: boolean;
  readonly showFileList?: boolean;
  readonly customUpload?: boolean;
  readonly uploadUrl?: string;
  readonly headers?: Record<string, string>;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly hint?: string;
  readonly icon?: string;
}
