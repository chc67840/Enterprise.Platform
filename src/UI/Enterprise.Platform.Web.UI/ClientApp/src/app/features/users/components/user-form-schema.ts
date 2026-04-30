/**
 * ─── USER — FORM SCHEMA ─────────────────────────────────────────────────────────
 *
 * Two factories, one source of truth. The CREATE schema mirrors
 * `CreateUserCommand` 1:1 (email, firstName, lastName, externalIdentityId);
 * the EDIT schema drops `externalIdentityId` (immutable post-create) and
 * keeps email + firstName + lastName since both can change.
 *
 * The same schema is consumed by the dialog regardless of mode — the host
 * just swaps which factory produced it.
 */
import type { FormSchema } from '@shared/components/dph';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_FIELD = {
  key: 'email',
  label: 'Email',
  type: 'email' as const,
  placeholder: 'name@example.com',
  autocomplete: 'email',
  required: true,
  maxLength: 254,
  trim: true,
  prefixIcon: 'pi pi-envelope',
  validators: { required: true, email: true, maxLength: 254 },
  serverErrorKeys: ['Email'],
};

const FIRST_NAME_FIELD = {
  key: 'firstName',
  label: 'First name',
  type: 'text' as const,
  autocomplete: 'given-name',
  required: true,
  maxLength: 100,
  trim: true,
  validators: { required: true, maxLength: 100 },
  serverErrorKeys: ['FirstName'],
};

const LAST_NAME_FIELD = {
  key: 'lastName',
  label: 'Last name',
  type: 'text' as const,
  autocomplete: 'family-name',
  required: true,
  maxLength: 100,
  trim: true,
  validators: { required: true, maxLength: 100 },
  serverErrorKeys: ['LastName'],
};

/** Schema for the "Create user" dialog. */
export function createUserSchema(): FormSchema {
  return {
    columns: 2,
    gap: 'md',
    fields: [
      { ...EMAIL_FIELD, columnSpan: 'full' },
      FIRST_NAME_FIELD,
      LAST_NAME_FIELD,
      {
        key: 'externalIdentityId',
        label: 'External identity id (optional)',
        type: 'text',
        placeholder: '11111111-2222-3333-4444-555555555555',
        maxLength: 36,
        nullIfEmpty: true,
        trim: true,
        columnSpan: 'full',
        validators: {
          pattern: { value: UUID_PATTERN, message: 'Must be a valid UUID when supplied.' },
        },
        serverErrorKeys: ['ExternalIdentityId'],
      },
    ],
  };
}

/** Schema for the "Edit user" dialog. Email + name only — externalIdentityId is immutable. */
export function editUserSchema(): FormSchema {
  return {
    columns: 2,
    gap: 'md',
    disableSubmitWhenPristine: true,
    fields: [
      { ...EMAIL_FIELD, columnSpan: 'full' },
      FIRST_NAME_FIELD,
      LAST_NAME_FIELD,
    ],
  };
}

/** Schema for the deactivation reason dialog. */
export function deactivateReasonSchema(): FormSchema {
  return {
    columns: 1,
    gap: 'sm',
    fields: [
      {
        key: 'reason',
        label: 'Reason for deactivating',
        type: 'textarea',
        placeholder: 'e.g. Off-boarded on 2026-04-29 — keep audit trail.',
        rows: 3,
        required: true,
        maxLength: 500,
        trim: true,
        validators: { required: true, maxLength: 500 },
        hint: 'This reason is recorded in the audit log for compliance.',
      },
    ],
  };
}
