/**
 * ─── DPH UI KIT — SCHEMA-FORM PURE HELPERS ──────────────────────────────────────
 *
 * Validator construction, default-value derivation, and server-error mapping.
 * Lives outside the component so the helpers stay easy to unit-test (no
 * Angular bootstrap required) and the component file stays focused on
 * orchestration.
 *
 * Updated 2026-05-01-v2 — adapts to the discriminated `SchemaField` union.
 * Each helper switches on `field.type` and reads only the props that the
 * narrowed variant actually carries.
 */
import { Validators, type ValidatorFn, type AsyncValidatorFn } from '@angular/forms';

import type { ApiError } from '@core/models';

import {
  isSchemaField,
  isSchemaWidget,
  isSectionsLayout,
  isTabsLayout,
  isWizardLayout,
  type FormSchema,
  type SchemaField,
  type SchemaItem,
  type SchemaWhenContext,
} from './schema-form.types';

/**
 * Resolve every `SchemaField` in the schema regardless of layout shape.
 * `layout > items > fields` precedence; widgets are filtered out (they
 * don't bind to FormControls).
 */
export function collectFields(schema: FormSchema): readonly SchemaField[] {
  return collectItems(schema).filter(isSchemaField);
}

/**
 * Resolve every `SchemaItem` in document order. Used by the renderer; the
 * orchestrator usually wants the field-only view (`collectFields`).
 */
export function collectItems(schema: FormSchema): readonly SchemaItem[] {
  if (schema.layout) {
    if (isSectionsLayout(schema.layout)) {
      return schema.layout.sections.flatMap((s) => s.items);
    }
    if (isTabsLayout(schema.layout)) {
      return schema.layout.tabs.flatMap((t) => t.items);
    }
    if (isWizardLayout(schema.layout)) {
      return schema.layout.steps.flatMap((s) => s.items);
    }
  }
  if (schema.items?.length) return schema.items;
  if (schema.fields?.length) return schema.fields;
  return [];
}

/** Default value for a freshly-constructed FormControl, by field type. */
export function defaultValueFor(field: SchemaField): unknown {
  switch (field.type) {
    case 'number':       return null;
    case 'checkbox':     return false;
    case 'switch':       return false;
    case 'multiselect':  return [];
    case 'select':       return null;
    case 'radio':        return null;
    case 'date':         return null;
    case 'datetime':     return null;
    case 'time':         return null;
    case 'file':         return [];
    case 'tree-select':  return field.treeSelectionMode === 'single' ? null : [];
    case 'table-picker': return field.tableConfig.selectionMode === 'multiple' ? [] : null;
    case 'autocomplete': return field.multiple ? [] : null;
    case 'currency':     return null;
    case 'mask':         return '';
    case 'color':        return null;
    case 'range':        return field.rangeMode ? null : 0;
    default:             return '';
  }
}

/** Build the Angular validator list from the field's `validators` spec. */
export function collectValidators(field: SchemaField): {
  readonly sync: ValidatorFn[];
  readonly async: AsyncValidatorFn[];
} {
  const sync: ValidatorFn[] = [];
  const v = field.validators ?? {};
  if (field.required || v.required) {
    if (field.type === 'checkbox' && (v.mustBeTrue ?? field.required)) {
      sync.push(Validators.requiredTrue);
    } else {
      sync.push(Validators.required);
    }
  }
  if (v.email || field.type === 'email') sync.push(Validators.email);

  // String length — only meaningful for text-like fields, but TS can't prove
  // that without narrowing; we just push validators if the spec asks for it.
  const minLen = unwrapValue(v.minLength) ?? readMinLength(field);
  if (minLen !== undefined) sync.push(Validators.minLength(minLen));
  const maxLen = unwrapValue(v.maxLength) ?? readMaxLength(field);
  if (maxLen !== undefined) sync.push(Validators.maxLength(maxLen));

  const pattern = unwrapValue(v.pattern);
  if (pattern !== undefined) sync.push(Validators.pattern(pattern));

  const min = unwrapValue(v.min);
  if (min !== undefined) sync.push(Validators.min(min));
  const max = unwrapValue(v.max);
  if (max !== undefined) sync.push(Validators.max(max));

  const minSel = unwrapValue(v.minSelected);
  if (minSel !== undefined) sync.push(minSelectedValidator(minSel));
  const maxSel = unwrapValue(v.maxSelected);
  if (maxSel !== undefined) sync.push(maxSelectedValidator(maxSel));

  // Host escape hatches — composed AFTER the built-ins so a custom
  // override can short-circuit (e.g. accept value the standard rules reject).
  if (v.custom?.length) sync.push(...v.custom);

  const async: AsyncValidatorFn[] = v.async?.length ? [...v.async] : [];

  return { sync, async };
}

function readMinLength(field: SchemaField): number | undefined {
  if (field.type === 'text' || field.type === 'email' || field.type === 'password' ||
      field.type === 'tel'  || field.type === 'url'   || field.type === 'search'   ||
      field.type === 'textarea' || field.type === 'number') {
    return field.minLength;
  }
  return undefined;
}

function readMaxLength(field: SchemaField): number | undefined {
  if (field.type === 'text' || field.type === 'email' || field.type === 'password' ||
      field.type === 'tel'  || field.type === 'url'   || field.type === 'search'   ||
      field.type === 'textarea' || field.type === 'number') {
    return field.maxLength;
  }
  return undefined;
}

export function minSelectedValidator(min: number): ValidatorFn {
  return (control) => {
    const value = control.value;
    const length = Array.isArray(value) ? value.length : 0;
    return length >= min ? null : { minSelected: { requiredLength: min, actualLength: length } };
  };
}

export function maxSelectedValidator(max: number): ValidatorFn {
  return (control) => {
    const value = control.value;
    const length = Array.isArray(value) ? value.length : 0;
    return length <= max ? null : { maxSelected: { requiredLength: max, actualLength: length } };
  };
}

export function unwrapValue<T>(spec: T | { value: T; message: string } | undefined): T | undefined {
  if (spec === undefined) return undefined;
  if (typeof spec === 'object' && spec !== null && 'value' in spec) {
    return (spec as { value: T }).value;
  }
  return spec as T;
}

export function specMessage(
  spec:
    | boolean
    | string
    | number
    | RegExp
    | { value: unknown; message: string }
    | undefined,
  fallback: string,
): string {
  if (spec === undefined || spec === null) return fallback;
  if (typeof spec === 'string') return spec;
  if (typeof spec === 'object' && 'message' in (spec as object)) {
    return (spec as { message: string }).message;
  }
  return fallback;
}

export function defaultConflictField(schema: FormSchema): string | null {
  const fields = collectFields(schema);
  return fields.find((f) => f.key === 'email')?.key ?? null;
}

export function serverFieldMessage(
  err: ApiError,
  field: SchemaField,
  index: Readonly<Record<string, string>>,
): string | null {
  if (!err.errors) return null;
  const candidates: string[] = [field.key, ...(field.serverErrorKeys ?? [])];
  for (const cand of candidates) {
    const direct = err.errors[cand];
    if (direct?.[0]) return direct[0];
    const titlecased = err.errors[cand.charAt(0).toUpperCase() + cand.slice(1)];
    if (titlecased?.[0]) return titlecased[0];
  }
  for (const apiKey of Object.keys(err.errors)) {
    if (index[apiKey.toLowerCase()] === field.key) {
      const messages = err.errors[apiKey];
      if (messages?.[0]) return messages[0];
    }
  }
  return null;
}

/** Stable track key for `@for` over `SchemaItem` — prefers field.key, widget.id. */
export function itemTrackKey(item: SchemaItem): string {
  if (isSchemaWidget(item)) return `w:${item.id}`;
  return `f:${item.key}`;
}

/**
 * Evaluate a `when` predicate. Returns `true` when the predicate is absent
 * or accepts the context — i.e. items default to visible.
 */
export function evalWhen(
  predicate: ((ctx: SchemaWhenContext) => boolean) | undefined,
  ctx: SchemaWhenContext,
): boolean {
  return predicate ? !!predicate(ctx) : true;
}
