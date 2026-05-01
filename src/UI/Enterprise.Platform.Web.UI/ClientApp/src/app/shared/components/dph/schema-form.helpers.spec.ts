/**
 * ─── Schema-form helpers — unit tests ───────────────────────────────────────────
 *
 * Pure helpers, no Angular bootstrap. Verifies layout→items→fields fallback,
 * type-narrowed defaultValueFor, validator collection, item track keys, and
 * the `when` predicate evaluator.
 */
import { describe, expect, it } from 'vitest';

import {
  collectFields,
  collectItems,
  defaultValueFor,
  collectValidators,
  evalWhen,
  itemTrackKey,
  unwrapValue,
} from './schema-form.helpers';
import type {
  CheckboxField,
  CurrencyField,
  FormSchema,
  MaskField,
  MultiSelectField,
  RangeField,
  SchemaItem,
  SelectField,
  SwitchField,
  TextLikeField,
  TreeSelectField,
} from './schema-form.types';

const text = (key: string, label: string): TextLikeField => ({ key, label, type: 'text' });
const email = (key: string, label: string): TextLikeField => ({ key, label, type: 'email' });
const sel = (key: string, opts: readonly { label: string; value: unknown }[]): SelectField => ({
  key, label: key, type: 'select', options: opts,
});
const ms = (key: string, opts: readonly { label: string; value: unknown }[]): MultiSelectField => ({
  key, label: key, type: 'multiselect', options: opts,
});
const cb = (key: string): CheckboxField => ({ key, label: key, type: 'checkbox' });
const sw = (key: string): SwitchField => ({ key, label: key, type: 'switch' });
const tree = (key: string): TreeSelectField => ({ key, label: key, type: 'tree-select', treeNodes: [] });
const rng = (key: string, range: boolean): RangeField => ({
  key, label: key, type: 'range', rangeMode: range,
});
const cur = (key: string, c = 'USD'): CurrencyField => ({ key, label: key, type: 'currency', currency: c });
const mask = (key: string): MaskField => ({ key, label: key, type: 'mask', mask: '999-99-9999' });

describe('collectItems / collectFields', () => {
  it('returns empty when nothing supplied', () => {
    expect(collectItems({})).toEqual([]);
    expect(collectFields({})).toEqual([]);
  });

  it('legacy `fields` is honoured when no items / layout', () => {
    const schema: FormSchema = { fields: [text('a', 'A'), text('b', 'B')] };
    expect(collectFields(schema).map((f) => f.key)).toEqual(['a', 'b']);
  });

  it('`items` wins over legacy `fields`', () => {
    const schema: FormSchema = {
      fields: [text('legacy', 'L')],
      items: [text('a', 'A'), text('b', 'B')],
    };
    expect(collectFields(schema).map((f) => f.key)).toEqual(['a', 'b']);
  });

  it('`layout: sections` flattens sections.items', () => {
    const schema: FormSchema = {
      layout: {
        kind: 'sections',
        sections: [
          { id: 's1', items: [text('a', 'A'), text('b', 'B')] },
          { id: 's2', items: [text('c', 'C')] },
        ],
      },
    };
    expect(collectFields(schema).map((f) => f.key)).toEqual(['a', 'b', 'c']);
  });

  it('`layout: tabs` flattens tabs.items', () => {
    const schema: FormSchema = {
      layout: {
        kind: 'tabs',
        tabs: [
          { id: 't1', label: 'T1', items: [text('a', 'A')] },
          { id: 't2', label: 'T2', items: [text('b', 'B'), text('c', 'C')] },
        ],
      },
    };
    expect(collectFields(schema).map((f) => f.key)).toEqual(['a', 'b', 'c']);
  });

  it('`layout: wizard` flattens steps.items', () => {
    const schema: FormSchema = {
      layout: {
        kind: 'wizard',
        steps: [
          { key: 'k1', label: 'S1', items: [text('a', 'A')] },
          { key: 'k2', label: 'S2', items: [email('b', 'B')] },
        ],
      },
    };
    expect(collectFields(schema).map((f) => f.key)).toEqual(['a', 'b']);
  });

  it('widgets are excluded from `collectFields`', () => {
    const schema: FormSchema = {
      items: [
        text('a', 'A'),
        { kind: 'heading', id: 'h1', text: 'Hello' } as SchemaItem,
        text('b', 'B'),
        { kind: 'spacer', id: 'sp1' } as SchemaItem,
      ],
    };
    const fieldKeys = collectFields(schema).map((f) => f.key);
    expect(fieldKeys).toEqual(['a', 'b']);
    expect(collectItems(schema)).toHaveLength(4);
  });
});

describe('defaultValueFor — discriminated narrowing', () => {
  it('text-like fields default to empty string', () => {
    expect(defaultValueFor(text('a', 'A'))).toBe('');
    expect(defaultValueFor(email('e', 'E'))).toBe('');
    expect(defaultValueFor({ key: 'x', label: 'X', type: 'textarea' } as TextLikeField)).toBe('');
  });

  it('number defaults to null', () => {
    expect(defaultValueFor({ key: 'n', label: 'N', type: 'number' } as TextLikeField)).toBeNull();
  });

  it('boolean fields default to false', () => {
    expect(defaultValueFor(cb('agree'))).toBe(false);
    expect(defaultValueFor(sw('on'))).toBe(false);
  });

  it('multi-pick fields default to empty array', () => {
    expect(defaultValueFor(ms('m', []))).toEqual([]);
    expect(defaultValueFor({ key: 'f', label: 'F', type: 'file' } as never)).toEqual([]);
  });

  it('range honours rangeMode for default value shape', () => {
    expect(defaultValueFor(rng('r1', false))).toBe(0);
    expect(defaultValueFor(rng('r2', true))).toBeNull();
  });

  it('tree-select honours selectionMode', () => {
    expect(defaultValueFor({ ...tree('t1'), treeSelectionMode: 'single' })).toBeNull();
    expect(defaultValueFor({ ...tree('t2'), treeSelectionMode: 'multiple' })).toEqual([]);
  });

  it('mask defaults to empty string, currency/color to null', () => {
    expect(defaultValueFor(mask('m'))).toBe('');
    expect(defaultValueFor(cur('c'))).toBeNull();
    expect(defaultValueFor({ key: 'col', label: 'Col', type: 'color' })).toBeNull();
  });
});

describe('collectValidators', () => {
  it('text field with required + email types both contribute Validators.required and Validators.email', () => {
    const v = collectValidators({ ...email('e', 'E'), required: true });
    expect(v.sync).toHaveLength(2);
    expect(v.async).toHaveLength(0);
  });

  it('checkbox + mustBeTrue uses requiredTrue, not required', () => {
    const v = collectValidators({ ...cb('terms'), required: true, validators: { mustBeTrue: true } });
    expect(v.sync).toHaveLength(1);
  });

  it('custom + async validators are forwarded', () => {
    const customFn = () => null;
    const asyncFn = () => Promise.resolve(null);
    const v = collectValidators({
      ...text('a', 'A'),
      validators: { custom: [customFn], async: [asyncFn] },
    });
    expect(v.sync).toContain(customFn);
    expect(v.async).toContain(asyncFn);
  });

  it('minSelected / maxSelected emit array-aware validators with the right error keys', () => {
    const v = collectValidators({ ...ms('m', []), validators: { minSelected: 2, maxSelected: 5 } });
    expect(v.sync).toHaveLength(2);
    const ctrlBelow = { value: ['x'] } as never;
    const ctrlAbove = { value: ['1', '2', '3', '4', '5', '6'] } as never;
    expect(v.sync[0]!(ctrlBelow)).toEqual({ minSelected: { requiredLength: 2, actualLength: 1 } });
    expect(v.sync[1]!(ctrlAbove)).toEqual({ maxSelected: { requiredLength: 5, actualLength: 6 } });
  });
});

describe('itemTrackKey', () => {
  it('prefixes field keys with f: and widget ids with w:', () => {
    expect(itemTrackKey(text('email', 'Email'))).toBe('f:email');
    expect(itemTrackKey({ kind: 'heading', id: 'h1', text: 'X' } as SchemaItem)).toBe('w:h1');
  });
});

describe('evalWhen', () => {
  it('returns true when predicate is undefined', () => {
    expect(evalWhen(undefined, { value$: {}, dirty: false, touched: false })).toBe(true);
  });

  it('forwards the context to the predicate', () => {
    const calls: unknown[] = [];
    const pred = (ctx: { value$: unknown }) => {
      calls.push(ctx);
      return ctx.value$ !== null;
    };
    expect(evalWhen(pred, { value$: { x: 1 }, dirty: true, touched: false })).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe('unwrapValue', () => {
  it('returns undefined for undefined', () => {
    expect(unwrapValue(undefined)).toBeUndefined();
  });
  it('returns plain value when not a {value, message}', () => {
    expect(unwrapValue(5)).toBe(5);
    expect(unwrapValue(true)).toBe(true);
  });
  it('unwraps {value, message} to value', () => {
    expect(unwrapValue({ value: 10, message: 'ten please' })).toBe(10);
    expect(unwrapValue({ value: /abc/, message: 'no' })).toEqual(/abc/);
  });
});
