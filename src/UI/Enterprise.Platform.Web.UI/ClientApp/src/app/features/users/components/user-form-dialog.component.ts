/**
 * ─── USER FORM DIALOG ───────────────────────────────────────────────────────────
 *
 * Modal that replaces the prior `/users/new` and `/users/:id` routes. Modes:
 *
 *   - `create` — fields email/firstName/lastName/externalIdentityId. Submits
 *     `UsersStore.createUser`. Closes on success; conflict (409) keeps the
 *     dialog open with a per-field message under "Email".
 *
 *   - `edit`   — fields email/firstName/lastName. The dialog determines which
 *     subset actually changed (rename vs change-email) and dispatches via
 *     `UsersStore.updateUser`, which fires the relevant API calls in parallel.
 *     Pristine submits are blocked by the schema's `disableSubmitWhenPristine`
 *     flag, so a no-op save is impossible.
 *
 * EDGE CASES PRESERVED FROM THE OLD VIEWS
 *   - Idempotency-key cycling — every submit cycle gets a fresh key (the
 *     api-service generates per-call keys; the store coordinator passes
 *     suppressGlobalError so we render errors inline).
 *   - Save-error banner suppressed when the error is per-field (400 with
 *     `errors`, or 409 on email) — those become inline messages instead.
 *   - Auto-close on success watches `saving + saveError` instead of the
 *     activeId hack the old `UserCreateComponent` used.
 *
 * The dialog OWNS its visibility via a `model<boolean>()`; the parent uses
 * two-way binding (`[(visible)]`) to open / close it.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import {
  DialogComponent,
  SchemaFormComponent,
} from '@shared/components/dph';

import type { UserDto } from '../data/user.types';
import { UsersStore } from '../state/users.store';
import { createUserSchema, editUserSchema } from './user-form-schema';

export type UserFormMode = 'create' | 'edit';

interface CreatePayload {
  email: string;
  firstName: string;
  lastName: string;
  externalIdentityId: string | null;
}

interface EditPayload {
  email: string;
  firstName: string;
  lastName: string;
}

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, SchemaFormComponent],
  template: `
    <dph-dialog
      [(visible)]="visible"
      [config]="{
        header: dialogHeader(),
        subheader: dialogSubheader(),
        width: 'min(560px, 92vw)',
        closable: !store.saving(),
        dismissableMask: !store.saving(),
        closeOnEscape: !store.saving(),
      }"
      (closed)="onDialogClosed()"
    >
      <ng-container slot="content">
        @if (showServerErrorBanner()) {
          <div class="user-form-dialog__banner" role="alert" aria-live="assertive">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            <div>
              <p class="user-form-dialog__banner-title">{{ serverErrorTitle() }}</p>
              <p class="user-form-dialog__banner-msg">{{ store.saveError()?.message }}</p>
            </div>
          </div>
        }

        <dph-schema-form
          #form
          [schema]="schema()"
          [initialValue]="initialValue()"
          [apiError]="store.saveError()"
          [submitting]="store.saving()"
          [submitLabel]="submitLabel()"
          cancelLabel="Cancel"
          [conflictMessage]="conflictMessage()"
          conflictField="email"
          (submit)="onSubmit($event)"
          (cancel)="onCancel()"
        />
      </ng-container>
    </dph-dialog>
  `,
  styles: [
    `
      .user-form-dialog__banner {
        display: flex;
        gap: 0.625rem;
        margin-bottom: 1rem;
        padding: 0.75rem 1rem;
        background: var(--ep-surface-danger, #fef2f2);
        border: 1px solid var(--ep-border-danger, #fecaca);
        border-radius: 0.5rem;
        color: var(--ep-text-danger, #991b1b);
      }
      .user-form-dialog__banner i {
        font-size: 1.125rem;
        margin-top: 0.125rem;
      }
      .user-form-dialog__banner-title {
        margin: 0;
        font-weight: 600;
        font-size: 0.875rem;
      }
      .user-form-dialog__banner-msg {
        margin: 0.125rem 0 0 0;
        font-size: 0.8125rem;
      }
    `,
  ],
})
export class UserFormDialogComponent {
  // ── Inputs / two-way ─────────────────────────────────────────────────
  readonly visible = model<boolean>(false);
  readonly mode = input<UserFormMode>('create');
  readonly user = input<UserDto | null>(null);

  // ── Outputs ──────────────────────────────────────────────────────────
  readonly saved = output<UserDto>();

  // ── Wiring ───────────────────────────────────────────────────────────
  protected readonly store = inject(UsersStore);
  private readonly form = viewChild<SchemaFormComponent>('form');

  /**
   * Snapshot of saving + saveError captured when submit fires. Used to
   * detect the saving→idle transition and decide success vs failure
   * without hooking into rxMethod completion (which the store doesn't expose).
   */
  private readonly inFlight = signal(false);

  // ── Schema + initial values ──────────────────────────────────────────

  protected readonly schema = computed(() =>
    this.mode() === 'create' ? createUserSchema() : editUserSchema(),
  );

  protected readonly initialValue = computed<Readonly<Record<string, unknown>>>(() => {
    if (this.mode() === 'create') {
      return { email: '', firstName: '', lastName: '', externalIdentityId: '' };
    }
    const u = this.user();
    return u
      ? { email: u.email, firstName: u.firstName, lastName: u.lastName }
      : { email: '', firstName: '', lastName: '' };
  });

  protected readonly dialogHeader = computed(() =>
    this.mode() === 'create' ? 'Create user' : 'Edit user',
  );

  protected readonly dialogSubheader = computed(() => {
    if (this.mode() === 'create') return 'Provision a new platform account.';
    const u = this.user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  });

  protected readonly submitLabel = computed(() =>
    this.mode() === 'create' ? 'Create user' : 'Save changes',
  );

  /** Message rendered under the email field on 409 Conflict. */
  protected readonly conflictMessage = computed(() => {
    const err = this.store.saveError();
    if (!err || err.statusCode !== 409) return null;
    return 'That email is already in use by another account.';
  });

  /** Show the top-banner for non-field errors (5xx, 401, 403). */
  protected readonly showServerErrorBanner = computed(() => {
    const err = this.store.saveError();
    if (!err) return false;
    if (err.statusCode === 400 && err.errors) return false;
    if (err.statusCode === 409) return false;
    return true;
  });

  protected readonly serverErrorTitle = computed(() => {
    const err = this.store.saveError();
    if (!err) return '';
    if (err.statusCode === 403) return 'Permission denied';
    if (err.statusCode >= 500) return 'Server error';
    return 'Could not save changes';
  });

  // ── Effects ──────────────────────────────────────────────────────────

  /**
   * Watch saving + saveError after a submit lands. When `saving` flips back
   * to false AND there's no saveError, the operation succeeded — close the
   * dialog and emit `saved`. If saveError is present, keep the dialog open
   * so the user can retry / fix.
   */
  private readonly _completionWatcher = effect(() => {
    const saving = this.store.saving();
    if (!this.inFlight() || saving) return;
    untracked(() => {
      const err = this.store.saveError();
      this.inFlight.set(false);
      if (err) return; // user fixes + retries; dialog stays open
      const id =
        this.mode() === 'create' ? this.store.activeId() : (this.user()?.id ?? null);
      const dto = id ? this.store.entities()[id] : null;
      if (dto) this.saved.emit(dto);
      this.visible.set(false);
    });
  });

  /** Reset transient state whenever the dialog opens. */
  private readonly _openReset = effect(() => {
    if (!this.visible()) return;
    untracked(() => {
      this.inFlight.set(false);
      this.store.clearSaveError();
      // Microtask so the dph-input has finished its init render.
      this.form()?.focusFirst();
    });
  });

  // ── Handlers ─────────────────────────────────────────────────────────

  protected onSubmit(value: Record<string, unknown>): void {
    if (this.mode() === 'create') {
      this.dispatchCreate(value as unknown as CreatePayload);
    } else {
      this.dispatchEdit(value as unknown as EditPayload);
    }
  }

  protected onCancel(): void {
    if (this.store.saving()) return;
    this.visible.set(false);
  }

  protected onDialogClosed(): void {
    // Belt-and-suspenders: clear save error when the dialog closes for any
    // reason so re-opening doesn't surface stale red.
    this.store.clearSaveError();
  }

  // ── Internals ────────────────────────────────────────────────────────

  private dispatchCreate(value: CreatePayload): void {
    this.inFlight.set(true);
    this.store.createUser({
      email: value.email,
      firstName: value.firstName,
      lastName: value.lastName,
      externalIdentityId:
        value.externalIdentityId && value.externalIdentityId.length > 0
          ? value.externalIdentityId
          : null,
    });
  }

  private dispatchEdit(value: EditPayload): void {
    const u = this.user();
    if (!u) return;

    const nameChanged =
      value.firstName !== u.firstName || value.lastName !== u.lastName;
    const emailChanged = value.email !== u.email;

    if (!nameChanged && !emailChanged) {
      this.visible.set(false);
      return;
    }

    this.inFlight.set(true);
    this.store.updateUser({
      id: u.id,
      rename: nameChanged
        ? { firstName: value.firstName, lastName: value.lastName }
        : undefined,
      emailRequest: emailChanged ? { email: value.email } : undefined,
    });
  }
}
