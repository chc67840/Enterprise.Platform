/**
 * ─── DPH UI KIT — SCHEMA-DRIVEN FORM TYPES ──────────────────────────────────────
 *
 * Declarative form description consumed by `dph-schema-form`. A `FormSchema`
 * lets a feature describe its form once and get back:
 *   - A typed `FormGroup` built from the field list
 *   - dph-input rendering with consistent labels / errors / hints
 *   - Server-side validation mapping (RFC 7807 `errors[field]` → field UI)
 *   - Submit-time value normalization (`trim`, `nullIfEmpty`)
 *
 * NAMING CONVENTIONS
 *   - `key`    is the FormGroup control name AND the API field name, so it
 *              must match the backend payload contract exactly.
 *   - `label`  is purely visual; safe to translate, never sent to the API.
 *   - Server-error mapping is case-insensitive (`Email` and `email` both
 *     resolve to the `email` field) so PascalCase ProblemDetails and
 *     camelCase JSON validators both work without per-field config.
 */
import type { Size } from './dph.types';

/** Renderable input types — subset of `InputConfig.type` that schema-form supports. */
export type SchemaFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'tel'
  | 'url'
  | 'search'
  | 'textarea'
  | 'number';

/**
 * Validators for a single field. Each entry can either be a value (using the
 * default error message) or a `{ value, message }` pair to override it.
 */
export interface FieldValidatorSpec {
  readonly required?: boolean | string;
  readonly minLength?: number | { readonly value: number; readonly message: string };
  readonly maxLength?: number | { readonly value: number; readonly message: string };
  readonly pattern?: RegExp | { readonly value: RegExp; readonly message: string };
  readonly email?: boolean | string;
  readonly min?: number | { readonly value: number; readonly message: string };
  readonly max?: number | { readonly value: number; readonly message: string };
}

/** Single field definition. */
export interface SchemaField {
  readonly key: string;
  readonly label: string;
  readonly type: SchemaFieldType;

  // Display
  readonly placeholder?: string;
  readonly hint?: string;
  readonly autocomplete?: string;
  readonly prefixIcon?: string;
  readonly suffixIcon?: string;
  readonly rows?: number;

  // Behavior
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly clearable?: boolean;

  // Validation
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly validators?: FieldValidatorSpec;

  // Submit-time normalization
  /** Trim leading/trailing whitespace from the submitted value. Default `true` for string fields. */
  readonly trim?: boolean;
  /** Replace empty string with `null` on submit. Default `false`. */
  readonly nullIfEmpty?: boolean;

  // Defaults / layout
  readonly defaultValue?: string | number | null;
  readonly columnSpan?: 1 | 2 | 3 | 4 | 'full';

  /**
   * Additional server-error keys that should map to this field. The field's
   * own `key` is always tried (camelCase + PascalCase variants); add more here
   * when the backend uses a different field name (e.g. `[\"emailAddress\"]`
   * for a UI field keyed `email`).
   */
  readonly serverErrorKeys?: readonly string[];

  /**
   * Optional override for the field-error message rendered for a specific
   * server `code` (e.g. mapping `EP.Conflict` on `email` to a custom string).
   * The host can also handle this via `apiErrorOverride` on the form input.
   */
  readonly statusErrorMessages?: Readonly<Record<number, string>>;
}

/** Top-level schema shape — describes the whole form. */
export interface FormSchema {
  readonly fields: readonly SchemaField[];
  readonly columns?: 1 | 2 | 3 | 4;
  readonly gap?: Size;
  /** Default `trim` for every string field (per-field can override). */
  readonly trim?: boolean;
  /** When `true`, an unchanged form refuses to emit submit (the action is no-op). */
  readonly disableSubmitWhenPristine?: boolean;
}

/**
 * Mapping from API `errors[key]` → field key. Built from the schema once at
 * component construction so per-field error lookup is a constant-time read.
 */
export type ServerErrorIndex = Readonly<Record<string, string>>;

// ─── Event channel (P1.1) ────────────────────────────────────────────────────
//
// Single discriminated-union output replaces per-event @Output proliferation.
// Hosts subscribe via `(onEvent)="handle($event)"` and switch on `event.type`.
//
// WHY ONE CHANNEL
//   As schemas grow (sections, accordions, conditional fields, action bars in
//   P1.4), the number of distinct events scales linearly. Per-event @Output
//   declarations would force every host to subscribe to every event it might
//   eventually care about. A single channel:
//     - Adds new event kinds without breaking existing hosts.
//     - Lets hosts opt INTO the kinds they care about via `@switch`.
//     - Makes logging / replay / analytics integration trivial — pipe every
//       form interaction through one funnel.
//
// TYPE GUARDS
//   `isFormEvent`, `isFieldEvent`, etc. let hosts narrow without `@switch`
//   pattern matching (which doesn't currently narrow discriminated unions in
//   Angular templates).
//
// MIGRATION
//   `SchemaFormComponent` keeps its existing `(submit) (cancel) (valueChange)`
//   outputs DURING the deprecation period — the new `(onEvent)` channel emits
//   IN ADDITION to those, so existing code keeps working. Once all consumers
//   migrate, the legacy outputs can be deleted in a single PR.

/**
 * Form-level events fired by the schema-form orchestrator. The `value$`
 * carries the cleaned current form values (after `trim` / `nullIfEmpty`)
 * so consumers don't need to re-derive them.
 */
export type SchemaFormFormEvent<T = Record<string, unknown>> =
  | { readonly type: 'form:submit'; readonly value: T }
  | { readonly type: 'form:cancel' }
  | { readonly type: 'form:reset' }
  | { readonly type: 'form:patch'; readonly value$: T };

/**
 * Field-level events fired by individual field controls inside the form.
 * `key` is the field's `SchemaField.key`; `value$` is the snapshot of the
 * full form's cleaned value at the time the event fired (handy for
 * conditional logic without re-injecting the form ref).
 */
export type SchemaFormFieldEvent<T = Record<string, unknown>> =
  | { readonly type: 'field:change'; readonly key: string; readonly value: unknown; readonly value$: T }
  | { readonly type: 'field:blur';   readonly key: string; readonly value$: T }
  | { readonly type: 'field:focus';  readonly key: string };

/**
 * Section / orchestration events — declared up front so future enhancements
 * (collapsible sections in P1.4, action bars, multi-step nav in P2.2) emit
 * through the same channel.
 */
export type SchemaFormSectionEvent =
  | { readonly type: 'section:toggle'; readonly key: string; readonly expanded: boolean }
  | { readonly type: 'section:tab-change'; readonly key: string; readonly index: number };

export type SchemaFormActionEvent = {
  readonly type: 'action:click';
  readonly action: string;
  readonly value$: Readonly<Record<string, unknown>>;
};

/** Discriminated union of every event the schema-form emits. */
export type SchemaFormEvent<T = Record<string, unknown>> =
  | SchemaFormFormEvent<T>
  | SchemaFormFieldEvent<T>
  | SchemaFormSectionEvent
  | SchemaFormActionEvent;

/** Type guard — narrows to form-level events. */
export const isSchemaFormFormEvent = <T>(
  event: SchemaFormEvent<T>,
): event is SchemaFormFormEvent<T> => event.type.startsWith('form:');

/** Type guard — narrows to field-level events. */
export const isSchemaFormFieldEvent = <T>(
  event: SchemaFormEvent<T>,
): event is SchemaFormFieldEvent<T> => event.type.startsWith('field:');

/** Type guard — narrows to section orchestration events. */
export const isSchemaFormSectionEvent = <T>(
  event: SchemaFormEvent<T>,
): event is SchemaFormSectionEvent => event.type.startsWith('section:');

/** Type guard — narrows to action-bar events. */
export const isSchemaFormActionEvent = <T>(
  event: SchemaFormEvent<T>,
): event is SchemaFormActionEvent => event.type === 'action:click';
