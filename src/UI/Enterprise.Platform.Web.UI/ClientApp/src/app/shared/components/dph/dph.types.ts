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

export interface ColumnDef<T = unknown> {
  readonly field: string;
  readonly header: string;
  readonly type?:
    | 'text'
    | 'number'
    | 'currency'
    | 'date'
    | 'datetime'
    | 'boolean'
    | 'badge'
    | 'avatar'
    | 'actions'
    | 'custom';
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly frozen?: 'left' | 'right' | null;
  readonly width?: string;
  readonly minWidth?: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly visible?: boolean;
  readonly exportable?: boolean;
  readonly cssClass?: string | ((row: T) => string);
  readonly format?: (value: unknown, row: T) => string;
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

export interface TableConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly columns: readonly ColumnDef<T>[];
  readonly idField: string;
  readonly selectionMode?: 'single' | 'multiple' | null;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly globalFilter?: boolean;
  readonly globalFilterFields?: readonly string[];
  readonly pagination?: boolean;
  readonly pageSizes?: readonly number[];
  readonly defaultPageSize?: number;
  readonly rowActions?: readonly RowAction<T>[];
  readonly bulkActions?: readonly { key: string; label: string; icon: string; severity?: Severity }[];
  readonly expandable?: boolean;
  readonly resizable?: boolean;
  readonly scrollable?: boolean;
  readonly scrollHeight?: string;
  readonly virtualScroll?: boolean;
  readonly virtualScrollItemSize?: number;
  readonly striped?: boolean;
  readonly gridLines?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly emptyMessage?: string;
  readonly emptyIcon?: string;
  readonly caption?: string;
  readonly exportable?: boolean;
  readonly exportFilename?: string;
  readonly stateKey?: string;
  readonly skeletonRows?: number;
  readonly rowClass?: (row: T) => string;
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

export interface StepsConfig {
  readonly steps: readonly {
    readonly label: string;
    readonly routePath?: string;
    readonly icon?: string;
    readonly description?: string;
  }[];
  readonly activeIndex: number;
  readonly readonly?: boolean;
  readonly variant?: 'horizontal' | 'vertical';
  readonly showLabels?: boolean;
  readonly showConnectors?: boolean;
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
