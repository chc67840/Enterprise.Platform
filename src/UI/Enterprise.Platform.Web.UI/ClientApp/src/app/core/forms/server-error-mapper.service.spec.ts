/**
 * ─── ServerErrorMapperService — UNIT TESTS ─────────────────────────────────────
 *
 * Proves the contract that Phase-6 form consumers depend on:
 *   - Flat fields get their `server` error set to the first message.
 *   - Full message list preserved under `server.all`.
 *   - Nested groups (`address.postalCode`) resolve correctly.
 *   - Array-index paths (`items[0].name`) resolve correctly.
 *   - Unknown paths go into `unmatched` rather than throwing.
 *   - valueChanges clears the `server` key on that specific control.
 *   - Existing validator errors (`required`, `email`) are preserved under the
 *     server error until typing clears the server key.
 */
import {
  FormArray,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ServerErrorMapperService,
  type ServerValidationError,
} from './server-error-mapper.service';

describe('ServerErrorMapperService', () => {
  let mapper: ServerErrorMapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    mapper = TestBed.inject(ServerErrorMapperService);
  });

  function makeForm(): FormGroup {
    return new FormGroup({
      email: new FormControl('', [Validators.required]),
      address: new FormGroup({
        postalCode: new FormControl(''),
      }),
      roles: new FormArray([
        new FormGroup({ name: new FormControl('') }),
        new FormGroup({ name: new FormControl('') }),
      ]),
    });
  }

  it('projects a first-message onto a flat field', () => {
    const form = makeForm();
    mapper.apply(form, {
      statusCode: 422,
      message: 'Validation failed',
      errors: { email: ['Email already in use.', 'Backup hint.'] },
    });

    const err = form.get('email')?.errors?.['server'] as ServerValidationError;
    expect(err.message).toBe('Email already in use.');
    expect(err.all).toEqual(['Email already in use.', 'Backup hint.']);
  });

  it('resolves nested paths (address.postalCode)', () => {
    const form = makeForm();
    mapper.apply(form, {
      statusCode: 422,
      message: 'Validation failed',
      errors: { 'address.postalCode': ['Must be 5 digits.'] },
    });

    const err = form.get('address.postalCode')?.errors?.['server'] as ServerValidationError;
    expect(err.message).toBe('Must be 5 digits.');
  });

  it('resolves indexed array paths (roles[1].name)', () => {
    const form = makeForm();
    mapper.apply(form, {
      statusCode: 422,
      message: 'Validation failed',
      errors: { 'roles[1].name': ['Required.'] },
    });

    const err = form.get('roles.1.name')?.errors?.['server'] as ServerValidationError;
    expect(err.message).toBe('Required.');
  });

  it('collects unmatched paths without throwing', () => {
    const form = makeForm();
    const result = mapper.apply(form, {
      statusCode: 422,
      message: 'Validation failed',
      errors: {
        email: ['Email already in use.'],
        nonexistentField: ['Something else.'],
        'roles[99].name': ['Out of range.'],
      },
    });

    expect(result.matched).toContain('email');
    expect(result.unmatched).toContain('nonexistentField');
    expect(result.unmatched).toContain('roles[99].name');
  });

  it('auto-clears the server error on the next valueChanges', () => {
    const form = makeForm();
    mapper.apply(form, {
      statusCode: 422,
      message: 'Validation failed',
      errors: { email: ['Email already in use.'] },
    });

    const emailCtrl = form.get('email')!;
    expect(emailCtrl.errors?.['server']).toBeDefined();

    // User starts typing → the `server` error vanishes.
    emailCtrl.setValue('test@example.com');
    expect(emailCtrl.errors?.['server']).toBeUndefined();
  });

  it('preserves co-existing validator errors under the server key', () => {
    const form = makeForm();
    // `email` is required + currently empty → `required` is present.
    form.get('email')?.updateValueAndValidity();
    expect(form.get('email')?.errors?.['required']).toBe(true);

    mapper.apply(form, {
      statusCode: 422,
      message: 'Validation failed',
      errors: { email: ['Email already in use.'] },
    });

    expect(form.get('email')?.errors?.['required']).toBe(true);
    expect(form.get('email')?.errors?.['server']).toBeDefined();
  });

  it('returns empty results when the 422 has no errors dictionary', () => {
    const form = makeForm();
    const result = mapper.apply(form, {
      statusCode: 422,
      message: 'Validation failed',
    });
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([]);
  });
});
