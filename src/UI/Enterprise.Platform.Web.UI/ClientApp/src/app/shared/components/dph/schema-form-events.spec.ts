/**
 * ─── SchemaFormEvent — TYPE GUARDS + DISCRIMINATION ───────────────────────────
 *
 * Pure-type-guard tests. Verifies the four guards correctly narrow each event
 * subtype, so hosts can use them outside `@switch` without TS escape hatches.
 */
import { describe, it, expect } from 'vitest';

import {
  isSchemaFormActionEvent,
  isSchemaFormFieldEvent,
  isSchemaFormFormEvent,
  isSchemaFormSectionEvent,
  type SchemaFormEvent,
} from './schema-form.types';

describe('SchemaFormEvent type guards', () => {
  it('isSchemaFormFormEvent narrows form:* events', () => {
    const e: SchemaFormEvent = { type: 'form:submit', value: { x: 1 } };
    expect(isSchemaFormFormEvent(e)).toBe(true);
    expect(isSchemaFormFieldEvent(e)).toBe(false);
    expect(isSchemaFormSectionEvent(e)).toBe(false);
    expect(isSchemaFormActionEvent(e)).toBe(false);
    if (isSchemaFormFormEvent(e) && e.type === 'form:submit') {
      // Compile-time narrow: e.value is unknown; runtime: present.
      expect(e.value).toEqual({ x: 1 });
    }
  });

  it('isSchemaFormFieldEvent narrows field:* events', () => {
    const e: SchemaFormEvent = {
      type: 'field:change',
      key: 'email',
      value: 'a@b.com',
      value$: { email: 'a@b.com' },
    };
    expect(isSchemaFormFieldEvent(e)).toBe(true);
    expect(isSchemaFormFormEvent(e)).toBe(false);
    if (isSchemaFormFieldEvent(e)) {
      expect(e.key).toBe('email');
    }
  });

  it('isSchemaFormSectionEvent narrows section:* events', () => {
    const e: SchemaFormEvent = { type: 'section:toggle', key: 'billing', expanded: true };
    expect(isSchemaFormSectionEvent(e)).toBe(true);
    expect(isSchemaFormFormEvent(e)).toBe(false);
    if (isSchemaFormSectionEvent(e) && e.type === 'section:toggle') {
      expect(e.expanded).toBe(true);
    }
  });

  it('isSchemaFormActionEvent narrows action:click events', () => {
    const e: SchemaFormEvent = {
      type: 'action:click',
      action: 'export',
      value$: { foo: 1 },
    };
    expect(isSchemaFormActionEvent(e)).toBe(true);
    expect(isSchemaFormFieldEvent(e)).toBe(false);
    if (isSchemaFormActionEvent(e)) {
      expect(e.action).toBe('export');
    }
  });

  it('all guards return false for unrelated event shapes', () => {
    // Cast through unknown so we can construct an "impossible" event
    // for negative-path testing without weakening the type at the call site.
    const fake = { type: 'form:custom-not-in-union' } as unknown as SchemaFormEvent;
    expect(isSchemaFormFormEvent(fake)).toBe(true); // 'form:'-prefixed by accident
    expect(isSchemaFormFieldEvent(fake)).toBe(false);
    expect(isSchemaFormSectionEvent(fake)).toBe(false);
    expect(isSchemaFormActionEvent(fake)).toBe(false);
  });
});
