/**
 * ─── DPH UI KIT — SCHEMA-DRIVEN FORM TYPES ──────────────────────────────────────
 *
 * Declarative form description consumed by `dph-schema-form`. A `FormSchema<T>`
 * lets a feature describe its form once and get back:
 *   - A typed `FormGroup` built from the field list
 *   - Per-type DPH renderer dispatch (17 field types · 6 widget kinds)
 *   - Local validation message mapping
 *   - Server-side validation mapping (RFC 7807 `errors[field]` → field UI)
 *   - Submit-time value normalization (`trim`, `nullIfEmpty`)
 *   - Optional structured layouts (sections / tabs / wizard) with per-step
 *     validation gating and rich event channel
 *
 * NAMING CONVENTIONS
 *   - `key`    is the FormGroup control name AND the API field name, so it
 *              must match the backend payload contract exactly.
 *   - `label`  is purely visual; safe to translate, never sent to the API.
 *   - Server-error mapping is case-insensitive (`Email` and `email` both
 *     resolve to the `email` field) so PascalCase ProblemDetails and
 *     camelCase JSON validators both work without per-field config.
 *
 * TYPE SAFETY (2026-05-01-v2 brutal-review pass)
 *   - `SchemaField` is a DISCRIMINATED UNION on `type`. Each variant declares
 *     ONLY the props that make sense for that field — a `text` field can no
 *     longer carry `options` / `mask` / `currency` etc.
 *   - `FormSchema<T>` parameterises the field-key vocabulary. Pass your
 *     command/DTO type and field keys are constrained to `keyof T & string`:
 *       const schema: FormSchema<CreateUserCommand> = { fields: [...] };
 *     Without `T` (legacy callers), keys are plain `string` — fully
 *     backward compatible.
 */
import type { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';

import type { ChartWidgetConfig } from './chart-widget.types';
import type {
  ImageConfig,
  OptionItem,
  Severity,
  Size,
  StepsVariant,
  TableConfig,
  TreeConfig,
  TreeNode,
  WizardButtonsConfig,
} from './dph.types';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — generic key extraction + when-predicate
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve the allowed field-key vocabulary for a given consumer type.
 * `Record<string, unknown>` (default) keeps `key: string` permissive;
 * a specific DTO type narrows keys to `keyof T & string`.
 */
export type FieldKeyOf<T> = T extends Record<string, unknown>
  ? Extract<keyof T, string>
  : string;

/** Context object passed to `when` predicates — kept open for additional facets. */
export interface SchemaWhenContext<T = Record<string, unknown>> {
  /** Current cleaned form value (after trim / nullIfEmpty). */
  readonly value$: T;
  /** Dirty / touched flags so predicates can scope by interaction state. */
  readonly dirty: boolean;
  readonly touched: boolean;
}

/**
 * Pure predicate evaluated on every form-state tick. Return `false` to
 * exclude the item from rendering AND from validation gating (its control
 * is removed from the FormGroup until the predicate flips back).
 */
export type SchemaWhenPredicate<T = Record<string, unknown>> = (
  ctx: SchemaWhenContext<T>,
) => boolean;

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD TYPES — discriminated union
// ═══════════════════════════════════════════════════════════════════════════════

export type SchemaSpan = 1 | 2 | 3 | 4 | 'full';

/**
 * Validators for a single field. Each entry can be a value (using the
 * default error message) or a `{ value, message }` pair to override it.
 *
 * `custom`/`async` are escape hatches — host-supplied Angular validator
 * functions that compose with the built-in ones.
 */
export interface FieldValidatorSpec {
  readonly required?: boolean | string;
  readonly minLength?: number | { readonly value: number; readonly message: string };
  readonly maxLength?: number | { readonly value: number; readonly message: string };
  readonly pattern?: RegExp | { readonly value: RegExp; readonly message: string };
  readonly email?: boolean | string;
  readonly min?: number | { readonly value: number; readonly message: string };
  readonly max?: number | { readonly value: number; readonly message: string };

  // Multiselect cardinality
  readonly minSelected?: number | { readonly value: number; readonly message: string };
  readonly maxSelected?: number | { readonly value: number; readonly message: string };

  // File-upload constraints
  readonly accept?: string | { readonly value: string; readonly message: string };
  readonly maxFileSize?: number | { readonly value: number; readonly message: string };
  readonly maxFiles?: number | { readonly value: number; readonly message: string };

  // Checkbox terms-of-service / GDPR consent
  readonly mustBeTrue?: boolean | string;

  /** Host-supplied synchronous validators. Composed with the built-ins. */
  readonly custom?: readonly ValidatorFn[];
  /** Host-supplied async validators (e.g. server-side uniqueness check). */
  readonly async?: readonly AsyncValidatorFn[];
}

/** Common props shared by every field variant. */
interface BaseField<K extends string = string> {
  readonly key: K;
  readonly label: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly required?: boolean;
  readonly columnSpan?: SchemaSpan;
  readonly validators?: FieldValidatorSpec;
  /** Submit-time normalization — defaults to `true` for string fields. */
  readonly trim?: boolean;
  /** Submit-time normalization — replace empty string with `null`. */
  readonly nullIfEmpty?: boolean;
  readonly serverErrorKeys?: readonly string[];
  readonly statusErrorMessages?: Readonly<Record<number, string>>;
  /**
   * Pure predicate driving conditional visibility. `false` → field is hidden
   * AND its control is removed from the FormGroup until the predicate flips.
   */
  readonly when?: SchemaWhenPredicate;
}

export interface TextLikeField<K extends string = string> extends BaseField<K> {
  readonly type: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search' | 'textarea' | 'number';
  readonly autocomplete?: string;
  readonly prefixIcon?: string;
  readonly suffixIcon?: string;
  readonly rows?: number;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly clearable?: boolean;
  readonly defaultValue?: string | number | null;
  readonly step?: number;
}

export interface SelectField<K extends string = string> extends BaseField<K> {
  readonly type: 'select';
  readonly options: readonly OptionItem[];
  readonly clearable?: boolean;
  readonly filterable?: boolean;
  readonly emptyOptionsText?: string;
  readonly defaultValue?: unknown;
}

export interface MultiSelectField<K extends string = string> extends BaseField<K> {
  readonly type: 'multiselect';
  readonly options: readonly OptionItem[];
  readonly filterable?: boolean;
  readonly chipDisplay?: boolean;
  readonly emptyOptionsText?: string;
  readonly defaultValue?: readonly unknown[];
}

export interface RadioField<K extends string = string> extends BaseField<K> {
  readonly type: 'radio';
  readonly options: readonly OptionItem[];
  readonly defaultValue?: unknown;
}

export interface CheckboxField<K extends string = string> extends BaseField<K> {
  readonly type: 'checkbox';
  readonly defaultValue?: boolean;
}

export interface SwitchField<K extends string = string> extends BaseField<K> {
  readonly type: 'switch';
  readonly defaultValue?: boolean;
}

export interface DateField<K extends string = string> extends BaseField<K> {
  readonly type: 'date' | 'datetime' | 'time';
  readonly clearable?: boolean;
  readonly inlineCalendar?: boolean;
  readonly minDate?: Date | string;
  readonly maxDate?: Date | string;
  readonly disabledDates?: readonly (Date | string)[];
  readonly showSeconds?: boolean;
  readonly hourFormat?: '12' | '24';
  readonly defaultValue?: Date | string | null;
}

export interface FileField<K extends string = string> extends BaseField<K> {
  readonly type: 'file';
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly fileVariant?: 'dropzone' | 'button' | 'inline';
  readonly defaultValue?: readonly unknown[];
}

export interface TreeSelectField<K extends string = string> extends BaseField<K> {
  readonly type: 'tree-select';
  readonly treeNodes: readonly TreeNode<unknown>[];
  readonly treeSelectionMode?: 'single' | 'multiple' | 'checkbox' | null;
  readonly treeConfig?: TreeConfig<unknown>;
  readonly defaultValue?: string | readonly string[] | null;
}

export interface TablePickerField<K extends string = string> extends BaseField<K> {
  readonly type: 'table-picker';
  readonly tableConfig: TableConfig<Record<string, unknown>>;
  readonly tableRows?: readonly Record<string, unknown>[];
  readonly defaultValue?: unknown;
}

export interface AutocompleteField<K extends string = string> extends BaseField<K> {
  readonly type: 'autocomplete';
  readonly optionsLoader: (q: string) => Promise<readonly OptionItem[]> | readonly OptionItem[];
  readonly autocompleteDebounceMs?: number;
  readonly multiple?: boolean;
  readonly clearable?: boolean;
  readonly emptyOptionsText?: string;
  readonly defaultValue?: unknown;
}

export interface CurrencyField<K extends string = string> extends BaseField<K> {
  readonly type: 'currency';
  readonly currency: string;
  readonly locale?: string;
  readonly clearable?: boolean;
  readonly step?: number;
  readonly defaultValue?: number | null;
}

export interface MaskField<K extends string = string> extends BaseField<K> {
  readonly type: 'mask';
  readonly mask: string;
  readonly slotChar?: string;
  readonly defaultValue?: string;
}

export interface ColorField<K extends string = string> extends BaseField<K> {
  readonly type: 'color';
  readonly colorFormat?: 'hex' | 'rgb' | 'hsb';
  readonly defaultValue?: string | null;
}

export interface RangeField<K extends string = string> extends BaseField<K> {
  readonly type: 'range';
  readonly rangeMode?: boolean;
  readonly rangeStep?: number;
  readonly defaultValue?: number | readonly [number, number] | null;
}

/** Discriminated union of every field variant. */
export type SchemaField<K extends string = string> =
  | TextLikeField<K>
  | SelectField<K>
  | MultiSelectField<K>
  | RadioField<K>
  | CheckboxField<K>
  | SwitchField<K>
  | DateField<K>
  | FileField<K>
  | TreeSelectField<K>
  | TablePickerField<K>
  | AutocompleteField<K>
  | CurrencyField<K>
  | MaskField<K>
  | ColorField<K>
  | RangeField<K>;

/** Convenience — every field's `type` literal. */
export type SchemaFieldType = SchemaField['type'];

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE B — Display widgets (read-only, no FormControl value)
// ═══════════════════════════════════════════════════════════════════════════════

interface BaseWidget {
  readonly id: string;
  readonly columnSpan?: SchemaSpan;
  /** Same predicate semantics as fields — `false` skips the widget entirely. */
  readonly when?: SchemaWhenPredicate;
}

export interface SchemaWidgetMessage extends BaseWidget {
  readonly kind: 'message';
  readonly severity: Severity;
  readonly summary?: string;
  readonly detail?: string;
  readonly icon?: string;
  readonly closable?: boolean;
}

export interface SchemaWidgetChart extends BaseWidget {
  readonly kind: 'chart';
  readonly config: ChartWidgetConfig;
}

export interface SchemaWidgetImage extends BaseWidget {
  readonly kind: 'image';
  readonly config: ImageConfig;
}

export interface SchemaWidgetDivider extends BaseWidget {
  readonly kind: 'divider';
  readonly orientation?: 'horizontal' | 'vertical';
  readonly label?: string;
}

export interface SchemaWidgetHeading extends BaseWidget {
  readonly kind: 'heading';
  readonly text: string;
  readonly level?: 2 | 3 | 4 | 5 | 6;
  readonly subtitle?: string;
  readonly icon?: string;
}

export interface SchemaWidgetSpacer extends BaseWidget {
  readonly kind: 'spacer';
  readonly size?: Size;
}

/** Discriminated union of every non-field element. */
export type SchemaWidget =
  | SchemaWidgetMessage
  | SchemaWidgetChart
  | SchemaWidgetImage
  | SchemaWidgetDivider
  | SchemaWidgetHeading
  | SchemaWidgetSpacer;

/**
 * `SchemaItem` is the universal schema entry — either an input field
 * (FormControl-bound) or a display widget (read-only). Discriminated by
 * the presence of `'kind'` (widgets carry it; fields don't).
 */
export type SchemaItem<K extends string = string> = SchemaField<K> | SchemaWidget;

/** Type guard — narrows to a display widget. */
export const isSchemaWidget = <K extends string>(item: SchemaItem<K>): item is SchemaWidget =>
  'kind' in item && typeof (item as { kind?: unknown }).kind === 'string';

/** Type guard — narrows to a FormControl-bound field. */
export const isSchemaField = <K extends string>(item: SchemaItem<K>): item is SchemaField<K> =>
  !isSchemaWidget(item);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE C — Layout variants (sections / tabs / wizard)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FormSchemaSection<K extends string = string> {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly icon?: string;
  readonly badge?: { readonly value: string; readonly severity?: Severity };
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly columns?: 1 | 2 | 3 | 4;
  readonly items: readonly SchemaItem<K>[];
  /** Hide the entire section based on form state. */
  readonly when?: SchemaWhenPredicate;
}

export interface FormSchemaSectionsLayout<K extends string = string> {
  readonly kind: 'sections';
  readonly sections: readonly FormSchemaSection<K>[];
}

export interface FormSchemaTab<K extends string = string> {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly badge?: { readonly value: string; readonly severity?: Severity };
  readonly disabled?: boolean;
  readonly items: readonly SchemaItem<K>[];
  readonly when?: SchemaWhenPredicate;
}

export interface FormSchemaTabsLayout<K extends string = string> {
  readonly kind: 'tabs';
  readonly tabs: readonly FormSchemaTab<K>[];
  readonly defaultTabId?: string;
}

export interface FormSchemaStep<K extends string = string> {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: string;
  readonly help?: string;
  readonly optional?: boolean;
  readonly items: readonly SchemaItem<K>[];
  readonly skipValidation?: boolean;
  /** Hide the step based on form state — same semantics as field `when`. */
  readonly when?: SchemaWhenPredicate;
}

export interface FormSchemaWizardLayout<K extends string = string> {
  readonly kind: 'wizard';
  readonly steps: readonly FormSchemaStep<K>[];
  readonly variant?: StepsVariant;
  readonly orientation?: 'horizontal' | 'vertical';
  readonly buttons?: WizardButtonsConfig;
  readonly initialStep?: number;
  readonly validatePerStep?: boolean;
  readonly allowBackNav?: boolean;
}

/** Discriminated union of every layout option. */
export type FormSchemaLayout<K extends string = string> =
  | FormSchemaSectionsLayout<K>
  | FormSchemaTabsLayout<K>
  | FormSchemaWizardLayout<K>;

/** Type guards — let host code narrow to a specific layout shape. */
export const isSectionsLayout = <K extends string>(
  l: FormSchemaLayout<K>,
): l is FormSchemaSectionsLayout<K> => l.kind === 'sections';
export const isTabsLayout = <K extends string>(
  l: FormSchemaLayout<K>,
): l is FormSchemaTabsLayout<K> => l.kind === 'tabs';
export const isWizardLayout = <K extends string>(
  l: FormSchemaLayout<K>,
): l is FormSchemaWizardLayout<K> => l.kind === 'wizard';

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-FIELD VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FormGroup-level validator. Receives the cleaned values, returns the error
 * message string (rendered against the listed fields) OR `null` when valid.
 * Targeted fields get the rule's `id` registered as a control error so the
 * field-level error renderer surfaces it.
 */
export interface CrossFieldRule {
  readonly id: string;
  readonly fields: readonly string[];
  readonly validate: (values: Readonly<Record<string, unknown>>) => string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION BAR — declarative per-action buttons
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Buttons that emit `action:click` on the event channel instead of
 * triggering submit / cancel directly. Useful for "Save as draft", "Submit
 * and continue", "Validate without saving", etc.
 */
export interface SchemaActionDescriptor {
  readonly key: string;
  readonly label: string;
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'link' | 'danger';
  readonly icon?: string;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly hideOnInvalid?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FormSchema — top-level shape (generic over the value type)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Top-level schema shape.
 *
 * USAGE
 *   // Permissive (legacy) — keys are plain `string`:
 *   const schema: FormSchema = { fields: [{ key: 'anything', ... }] };
 *
 *   // Typed — keys must come from `keyof CreateUserCommand`:
 *   const schema: FormSchema<CreateUserCommand> = { fields: [...] };
 *   // → typo in `key: 'emial'` is a COMPILE error.
 *
 * BACKWARD COMPATIBILITY (2026-05-01)
 *   Resolution order at render time:
 *     1. `layout` — when set, renders the structured layout
 *     2. `items`  — when set (and no layout), renders flat
 *     3. `fields` — fallback for legacy schemas
 */
export interface FormSchema<T = Record<string, unknown>> {
  /** Legacy — flat field list. Prefer `items` or `layout` for new schemas. */
  readonly fields?: readonly SchemaField<FieldKeyOf<T>>[];
  /** Phase B — flat list of fields + widgets in document order. */
  readonly items?: readonly SchemaItem<FieldKeyOf<T>>[];
  /** Phase C — structured layout (sections / tabs / wizard). */
  readonly layout?: FormSchemaLayout<FieldKeyOf<T>>;

  readonly columns?: 1 | 2 | 3 | 4;
  readonly gap?: Size;
  readonly trim?: boolean;
  readonly disableSubmitWhenPristine?: boolean;

  /** FormGroup-level validators (cross-field, conditional). */
  readonly crossFieldValidators?: readonly CrossFieldRule[];

  /** Declarative action-bar buttons emitted via `action:click`. */
  readonly actions?: readonly SchemaActionDescriptor[];
}

/**
 * Mapping from API `errors[key]` → field key. Built from the schema once at
 * component construction so per-field error lookup is a constant-time read.
 */
export type ServerErrorIndex = Readonly<Record<string, string>>;

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT CHANNEL (P1.1 + Phase C wizard events + tab change)
// ═══════════════════════════════════════════════════════════════════════════════

export type SchemaFormFormEvent<T = Record<string, unknown>> =
  | { readonly type: 'form:submit'; readonly value: T }
  | { readonly type: 'form:cancel' }
  | { readonly type: 'form:reset' }
  | { readonly type: 'form:patch'; readonly value$: T };

export type SchemaFormFieldEvent<T = Record<string, unknown>> =
  | { readonly type: 'field:change'; readonly key: string; readonly value: unknown; readonly value$: T }
  | { readonly type: 'field:blur';   readonly key: string; readonly value$: T }
  | { readonly type: 'field:focus';  readonly key: string };

export type SchemaFormSectionEvent =
  /** Toggle a collapsible section. `expanded === true` means the body is shown. */
  | { readonly type: 'section:toggle'; readonly key: string; readonly expanded: boolean }
  /**
   * Tab changed — emitted ONLY by `FormSchemaTabsLayout` consumers.
   * The legacy `section:tab-change` is preserved for back-compat but
   * `tab:change` is the canonical name and what new code should subscribe to.
   */
  | { readonly type: 'tab:change'; readonly id: string; readonly index: number }
  /** @deprecated 2026-05-01 — use `'tab:change'` instead. */
  | { readonly type: 'section:tab-change'; readonly key: string; readonly index: number };

export type SchemaFormActionEvent<T = Record<string, unknown>> = {
  readonly type: 'action:click';
  readonly action: string;
  readonly value$: T;
};

export type SchemaFormWizardEvent<T = Record<string, unknown>> =
  | { readonly type: 'step:advance'; readonly from: string; readonly to: string; readonly value$: T }
  | { readonly type: 'step:back';    readonly from: string; readonly to: string; readonly value$: T }
  | { readonly type: 'step:jump';    readonly from: string; readonly to: string; readonly value$: T }
  | { readonly type: 'step:complete'; readonly key: string; readonly value$: T }
  | { readonly type: 'step:cancel';  readonly key: string }
  | { readonly type: 'step:skip';    readonly from: string; readonly to: string; readonly value$: T };

/** Discriminated union of every event the schema-form emits. */
export type SchemaFormEvent<T = Record<string, unknown>> =
  | SchemaFormFormEvent<T>
  | SchemaFormFieldEvent<T>
  | SchemaFormSectionEvent
  | SchemaFormActionEvent<T>
  | SchemaFormWizardEvent<T>;

export const isSchemaFormFormEvent = <T>(
  event: SchemaFormEvent<T>,
): event is SchemaFormFormEvent<T> => event.type.startsWith('form:');

export const isSchemaFormFieldEvent = <T>(
  event: SchemaFormEvent<T>,
): event is SchemaFormFieldEvent<T> => event.type.startsWith('field:');

export const isSchemaFormSectionEvent = <T>(
  event: SchemaFormEvent<T>,
): event is SchemaFormSectionEvent =>
  event.type.startsWith('section:') || event.type === 'tab:change';

export const isSchemaFormActionEvent = <T>(
  event: SchemaFormEvent<T>,
): event is SchemaFormActionEvent<T> => event.type === 'action:click';

export const isSchemaFormWizardEvent = <T>(
  event: SchemaFormEvent<T>,
): event is SchemaFormWizardEvent<T> => event.type.startsWith('step:');

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS — composite shorthands
// ═══════════════════════════════════════════════════════════════════════════════

/** Re-export so consumers don't have to reach into `@angular/forms` types. */
export type { ValidatorFn, AsyncValidatorFn, ValidationErrors, AbstractControl };
