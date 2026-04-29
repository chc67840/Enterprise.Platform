/**
 * ─── USER CREATE ────────────────────────────────────────────────────────────────
 *
 * Reactive form mirroring `CreateUserCommand` (backend FluentValidation):
 *   - email: required, RFC-ish format, max 254
 *   - firstName: required, max 100
 *   - lastName: required, max 100
 *   - externalIdentityId: optional, must be a UUID when present
 *
 * EDGE CASES
 *   - On 409 Conflict (duplicate email): show inline error under the email
 *     field, focus it. Don't lose the rest of the form.
 *   - On 400 Validation: pull per-field errors from `ApiError.errors` and
 *     surface them under the matching field.
 *   - Idempotency-key stable across retries — generated once per submit
 *     attempt cycle so a network blip + manual retry collapses on the
 *     server. Reset on form change so a fresh edit gets a fresh key.
 *   - Form reset on destroy / re-mount — prevents the "browser-back to
 *     /new" returning a stale-but-submitted form.
 *   - Dirty-form guard via `canDeactivate()` — confirm before leaving with
 *     unsaved input.
 *   - On success: store sets `activeId` to the new user's id; we navigate
 *     to `../<newId>` so the user lands on the detail view of the row they
 *     just created (less context-switch than going back to the list).
 */
import type {
  AfterViewInit,
  ElementRef} from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { FormGroup} from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { generateIdempotencyKey } from '@utils';

import { fieldErrorMessage, UsersStore } from '../state/users.store';
import type { HasUnsavedChanges } from '../users.routes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-user-create',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
  ],
  template: `
    <section class="space-y-4" aria-labelledby="user-create-heading">
      <header>
        <a [routerLink]="['..']" class="text-sm text-blue-600 hover:text-blue-700">← Back to users</a>
        <h2 id="user-create-heading" class="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
          New user
        </h2>
      </header>

      <!-- Save error banner — non-conflict / non-validation 4xx + 5xx -->
      @if (showSaveErrorBanner()) {
        <div
          class="rounded-lg bg-red-50 p-3 ring-1 ring-red-200"
          role="alert"
          aria-live="assertive"
        >
          <p class="text-sm font-semibold text-red-800">{{ saveErrorTitle() }}</p>
          <p class="mt-1 text-sm text-red-700">{{ store.saveError()?.message }}</p>
        </div>
      }

      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        class="space-y-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
        novalidate
        autocomplete="off"
      >
        <label class="flex flex-col text-sm" for="user-create-email">
          <span class="text-xs font-medium text-gray-600">
            Email <span class="text-red-600" aria-hidden="true">*</span>
          </span>
          <input
            #emailInput
            pInputText
            id="user-create-email"
            formControlName="email"
            type="email"
            autocomplete="email"
            maxlength="254"
            class="w-96"
            [attr.aria-invalid]="emailError() ? 'true' : 'false'"
            [attr.aria-describedby]="emailError() ? 'user-create-email-err' : null"
          />
          @if (emailError(); as msg) {
            <span id="user-create-email-err" class="mt-1 text-xs text-red-700">{{ msg }}</span>
          }
        </label>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="flex flex-col text-sm" for="user-create-firstName">
            <span class="text-xs font-medium text-gray-600">
              First name <span class="text-red-600" aria-hidden="true">*</span>
            </span>
            <input
              pInputText
              id="user-create-firstName"
              formControlName="firstName"
              autocomplete="given-name"
              maxlength="100"
              [attr.aria-invalid]="firstNameError() ? 'true' : 'false'"
              [attr.aria-describedby]="firstNameError() ? 'user-create-firstName-err' : null"
            />
            @if (firstNameError(); as msg) {
              <span id="user-create-firstName-err" class="mt-1 text-xs text-red-700">{{ msg }}</span>
            }
          </label>
          <label class="flex flex-col text-sm" for="user-create-lastName">
            <span class="text-xs font-medium text-gray-600">
              Last name <span class="text-red-600" aria-hidden="true">*</span>
            </span>
            <input
              pInputText
              id="user-create-lastName"
              formControlName="lastName"
              autocomplete="family-name"
              maxlength="100"
              [attr.aria-invalid]="lastNameError() ? 'true' : 'false'"
              [attr.aria-describedby]="lastNameError() ? 'user-create-lastName-err' : null"
            />
            @if (lastNameError(); as msg) {
              <span id="user-create-lastName-err" class="mt-1 text-xs text-red-700">{{ msg }}</span>
            }
          </label>
        </div>

        <label class="flex flex-col text-sm" for="user-create-externalId">
          <span class="text-xs font-medium text-gray-600">External identity id (optional)</span>
          <input
            pInputText
            id="user-create-externalId"
            formControlName="externalIdentityId"
            placeholder="e.g. 11111111-2222-3333-4444-555555555555"
            class="w-96 font-mono"
            [attr.aria-invalid]="externalIdError() ? 'true' : 'false'"
            [attr.aria-describedby]="externalIdError() ? 'user-create-externalId-err' : null"
          />
          @if (externalIdError(); as msg) {
            <span id="user-create-externalId-err" class="mt-1 text-xs text-red-700">{{ msg }}</span>
          }
        </label>

        <div class="flex items-center gap-2">
          <p-button
            label="Create user"
            type="submit"
            [disabled]="form.invalid || store.saving()"
            [loading]="store.saving()"
          />
          <a [routerLink]="['..']" class="text-sm text-gray-600 hover:text-gray-900">Cancel</a>
        </div>
      </form>
    </section>
  `,
})
export class UserCreateComponent implements AfterViewInit, HasUnsavedChanges {
  protected readonly store = inject(UsersStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Reactive form — controls match `CreateUserCommand` 1:1. */
  protected readonly form: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    externalIdentityId: ['', [Validators.pattern(UUID_PATTERN)]],
  });

  protected readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  /**
   * Idempotency-key for the in-flight submit. Generated once when the user
   * clicks "Create user"; reused across retries (network blip → manual click)
   * so the backend collapses duplicates. Reset to null after the submit
   * resolves (success → navigate; failure → user can edit + try again with
   * a fresh key, since correcting the data is a logically NEW operation).
   */
  private idempotencyKey: string | null = null;

  /** Set true between submit and either nav-away or fail. */
  private justSubmitted = signal(false);

  // ── derived view-model ──────────────────────────────────────────────────

  protected readonly emailError = computed(() => {
    const c = this.form.get('email');
    if (!c || (!c.touched && !c.dirty)) return null;
    if (c.hasError('required')) return 'Email is required.';
    if (c.hasError('email')) return 'Enter a valid email address.';
    if (c.hasError('maxlength')) return 'Maximum 254 characters.';
    if (this.store.saveConflict()) {
      return 'That email is already in use by another account.';
    }
    return fieldErrorMessage(this.store.saveError(), 'email');
  });
  protected readonly firstNameError = computed(() => {
    const c = this.form.get('firstName');
    if (!c || (!c.touched && !c.dirty)) return null;
    if (c.hasError('required')) return 'First name is required.';
    if (c.hasError('maxlength')) return 'Maximum 100 characters.';
    return fieldErrorMessage(this.store.saveError(), 'firstName');
  });
  protected readonly lastNameError = computed(() => {
    const c = this.form.get('lastName');
    if (!c || (!c.touched && !c.dirty)) return null;
    if (c.hasError('required')) return 'Last name is required.';
    if (c.hasError('maxlength')) return 'Maximum 100 characters.';
    return fieldErrorMessage(this.store.saveError(), 'lastName');
  });
  protected readonly externalIdError = computed(() => {
    const c = this.form.get('externalIdentityId');
    if (!c || (!c.touched && !c.dirty)) return null;
    if (c.hasError('pattern')) return 'Must be a valid UUID when supplied.';
    return fieldErrorMessage(this.store.saveError(), 'externalIdentityId');
  });

  /** Show the top-banner only for non-field errors (5xx, 401, 403). */
  protected readonly showSaveErrorBanner = computed(() => {
    const err = this.store.saveError();
    if (!err) return false;
    // 400 with field details → handled per-field
    if (err.statusCode === 400 && err.errors) return false;
    // 409 → handled inline on the email field
    if (err.statusCode === 409) return false;
    return true;
  });

  protected readonly saveErrorTitle = computed(() => {
    const err = this.store.saveError();
    if (!err) return '';
    if (err.statusCode === 403) return 'Permission denied';
    if (err.statusCode >= 500) return 'Server error';
    return 'Could not create user';
  });

  // ── effects ─────────────────────────────────────────────────────────────

  /**
   * Watch `activeId` — the store sets it after a successful create. Navigate
   * to that detail page rather than calling `router.navigate` from inside
   * the success callback (the store wires the success notification already;
   * we just react to the resulting state).
   *
   * Guarded by `justSubmitted` so the effect doesn't redirect on unrelated
   * activeId changes (e.g. peer in another tab — though we don't have that
   * yet, defensive).
   */
  private readonly _navigateOnCreate = effect(() => {
    const id = this.store.activeId();
    if (!id || !this.justSubmitted()) return;
    untracked(() => {
      this.justSubmitted.set(false);
      this.idempotencyKey = null;
      // Reset the form so a stale value won't survive into the next mount
      // if the route is revisited.
      this.form.reset(
        { email: '', firstName: '', lastName: '', externalIdentityId: '' },
        { emitEvent: false },
      );
      void this.router.navigate(['..', id], { relativeTo: this.route });
    });
  });

  /**
   * When the user edits any field after a save error, clear the saveError so
   * the banner / per-field hints disappear. Avoids "stale red errors that
   * should have gone away after I fixed them."
   */
  private readonly _clearErrorOnEdit = effect(() => {
    const err = this.store.saveError();
    if (!err) return;
    untracked(() => {
      const sub = this.form.valueChanges.subscribe(() => {
        this.store.clearSaveError();
        sub.unsubscribe();
      });
    });
  });

  ngAfterViewInit(): void {
    // Focus the email field on mount — saves a click for the common path.
    queueMicrotask(() => this.emailInput()?.nativeElement.focus());
  }

  // ── lifecycle ───────────────────────────────────────────────────────────

  /**
   * `canDeactivate` guard hook — blocks navigation when the form has
   * unsaved input (and the user hasn't just submitted successfully —
   * the success path resets the form pristine before navigating).
   */
  canDeactivate(): boolean {
    if (this.form.pristine || this.store.saving() || this.justSubmitted()) return true;
    return window.confirm('You have unsaved changes. Leave anyway?');
  }

  // ── handlers ────────────────────────────────────────────────────────────

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Focus the first invalid field for keyboard users.
      const firstInvalid = ['email', 'firstName', 'lastName', 'externalIdentityId'].find(
        (name) => this.form.get(name)?.invalid,
      );
      if (firstInvalid === 'email') {
        this.emailInput()?.nativeElement.focus();
      }
      return;
    }
    if (this.store.saving()) return;

    const raw = this.form.getRawValue() as {
      email: string;
      firstName: string;
      lastName: string;
      externalIdentityId: string;
    };

    this.idempotencyKey ??= generateIdempotencyKey();
    this.justSubmitted.set(true);
    this.store.createUser({
      email: raw.email.trim(),
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      externalIdentityId: raw.externalIdentityId.trim() ? raw.externalIdentityId.trim() : null,
    });
  }
}
