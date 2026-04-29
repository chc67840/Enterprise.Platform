/**
 * ─── USER DETAIL ────────────────────────────────────────────────────────────────
 *
 * Reads the `:id` route param + drives `UsersStore.loadById`. Renders the user
 * fields plus action panels for rename, change email, activate / deactivate.
 *
 * EDGE-CASE BEHAVIOUR
 *   - 404 on load → toast + auto-navigate back to /users (not "user not found"
 *     forever). Distinguish from network errors which surface a retry button.
 *   - Confirmation dialog before deactivate (destructive). Cancel preserves
 *     the typed reason; confirm submits.
 *   - Char counter on the deactivate-reason field (max 500). Counter goes
 *     amber at 90% and red over the cap.
 *   - Dirty-form guard — `canDeactivate()` prompts before navigating away
 *     with unsaved rename / email / reason changes.
 *   - Idempotency-key stable across retry — generated once per submit cycle
 *     so a network blip + retry collapses on the server.
 *   - Form seeding via `effect()` (not `queueMicrotask`) so the initial
 *     paint waits for the input binding (NG0950 prevention; the original
 *     queueMicrotask version raced the parent's input binding under
 *     fast renders).
 *   - Permission-aware buttons — `users:write` for rename/email,
 *     `users:deactivate` and `users:activate` for the activation toggle.
 *     Without the right permission the entire panel is hidden (defense-in-
 *     depth; the route guard plus the API server-side check are the
 *     primary enforcement).
 *
 * Form validation mirrors the backend FluentValidation:
 *   - first/last name: required, max 100
 *   - email: required, RFC-ish format, max 254
 *   - reason (deactivate): required, max 500
 */
import type {
  OnInit} from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import type {
  FormGroup} from '@angular/forms';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';

import { AuthStore } from '@core/auth/auth.store';
import { NotificationService } from '@core/services/notification.service';
import { generateIdempotencyKey } from '@utils';

import { USER_PERMISSIONS } from '../data/user.permissions';
import { fieldErrorMessage, UsersStore } from '../state/users.store';
import type { HasUnsavedChanges } from '../users.routes';

const REASON_MAX = 500;
const REASON_WARN_THRESHOLD = Math.floor(REASON_MAX * 0.9);

@Component({
  selector: 'app-user-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    ConfirmDialogModule,
    InputTextModule,
    TagModule,
  ],
  template: `
    <p-confirmDialog
      header="Deactivate user"
      icon="pi pi-exclamation-triangle"
      [style]="{ width: '420px' }"
    />

    <section class="space-y-4" aria-labelledby="user-detail-heading">
      <header>
        <a
          [routerLink]="['..']"
          class="text-sm text-blue-600 hover:text-blue-700"
        >
          ← Back to users
        </a>
        @if (user(); as u) {
          <h2
            id="user-detail-heading"
            class="mt-2 text-2xl font-semibold tracking-tight text-gray-900"
          >
            {{ u.firstName }} {{ u.lastName }}
            @if (u.isActive) {
              <p-tag value="Active" severity="success" class="ml-2 align-middle" />
            } @else {
              <p-tag value="Inactive" severity="secondary" class="ml-2 align-middle" />
            }
            @if (u.isDeleted) {
              <p-tag value="Deleted" severity="danger" class="ml-1 align-middle" />
            }
          </h2>
          <p class="mt-1 font-mono text-sm text-gray-600">{{ u.email }}</p>
        } @else if (store.loadingDetail()) {
          <h2 id="user-detail-heading" class="sr-only">Loading user</h2>
          <p class="mt-2 text-sm text-gray-500" aria-live="polite">Loading…</p>
        } @else if (store.detailError(); as err) {
          <h2 id="user-detail-heading" class="sr-only">User load failed</h2>
          <div
            class="mt-2 rounded-lg bg-red-50 p-4 ring-1 ring-red-200"
            role="alert"
            aria-live="assertive"
          >
            <p class="text-sm font-semibold text-red-800">Could not load user.</p>
            <p class="mt-1 text-sm text-red-700">{{ err.message }}</p>
            <button
              type="button"
              class="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              (click)="retryLoad()"
            >
              Retry
            </button>
          </div>
        }
      </header>

      @if (user(); as u) {
        <!-- Read-only metadata -->
        <div class="grid gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:grid-cols-2">
          <div>
            <div class="text-xs font-medium uppercase tracking-wider text-gray-500">Created</div>
            <div class="mt-1 text-sm text-gray-900">{{ u.createdAt | date: 'medium' }} by {{ u.createdBy }}</div>
          </div>
          <div>
            <div class="text-xs font-medium uppercase tracking-wider text-gray-500">Last login</div>
            <div class="mt-1 text-sm text-gray-900">
              {{ u.lastLoginAt ? (u.lastLoginAt | date: 'medium') : '—' }}
            </div>
          </div>
          <div>
            <div class="text-xs font-medium uppercase tracking-wider text-gray-500">External identity</div>
            <div class="mt-1 font-mono text-sm text-gray-700">{{ u.externalIdentityId ?? '—' }}</div>
          </div>
          <div>
            <div class="text-xs font-medium uppercase tracking-wider text-gray-500">User id</div>
            <div class="mt-1 font-mono text-sm text-gray-700">{{ u.id }}</div>
          </div>
        </div>

        <!-- Save error banner — visible above the forms when the last
             mutation failed (toast is suppressed because the store sets
             saveError on the inline channel). -->
        @if (store.saveError(); as err) {
          <div
            class="rounded-lg bg-red-50 p-3 ring-1 ring-red-200"
            role="alert"
            aria-live="assertive"
          >
            <p class="text-sm font-semibold text-red-800">{{ saveErrorTitle() }}</p>
            <p class="mt-1 text-sm text-red-700">{{ err.message }}</p>
          </div>
        }

        <!-- Rename -->
        @if (canWrite()) {
          <form
            [formGroup]="renameForm"
            (ngSubmit)="onRename()"
            class="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
          >
            <div class="text-sm font-semibold text-gray-900">Rename</div>
            <div class="flex flex-wrap items-end gap-2">
              <label class="flex flex-col text-sm" for="user-detail-firstName">
                <span class="text-xs font-medium text-gray-600">First name</span>
                <input
                  pInputText
                  id="user-detail-firstName"
                  formControlName="firstName"
                  class="w-48"
                  maxlength="100"
                  [attr.aria-describedby]="renameFirstNameError() ? 'user-detail-firstName-err' : null"
                />
                @if (renameFirstNameError(); as msg) {
                  <span id="user-detail-firstName-err" class="mt-1 text-xs text-red-700">{{ msg }}</span>
                }
              </label>
              <label class="flex flex-col text-sm" for="user-detail-lastName">
                <span class="text-xs font-medium text-gray-600">Last name</span>
                <input
                  pInputText
                  id="user-detail-lastName"
                  formControlName="lastName"
                  class="w-48"
                  maxlength="100"
                  [attr.aria-describedby]="renameLastNameError() ? 'user-detail-lastName-err' : null"
                />
                @if (renameLastNameError(); as msg) {
                  <span id="user-detail-lastName-err" class="mt-1 text-xs text-red-700">{{ msg }}</span>
                }
              </label>
              <p-button
                label="Save"
                type="submit"
                [disabled]="renameForm.invalid || store.saving() || renameForm.pristine"
                [loading]="store.saving()"
                size="small"
              />
            </div>
          </form>
        }

        <!-- Change email -->
        @if (canWrite()) {
          <form
            [formGroup]="emailForm"
            (ngSubmit)="onChangeEmail()"
            class="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
          >
            <div class="text-sm font-semibold text-gray-900">Change email</div>
            <div class="flex flex-wrap items-end gap-2">
              <label class="flex flex-col text-sm" for="user-detail-email">
                <span class="text-xs font-medium text-gray-600">New email</span>
                <input
                  pInputText
                  id="user-detail-email"
                  formControlName="email"
                  type="email"
                  autocomplete="email"
                  class="w-72"
                  maxlength="254"
                  [attr.aria-describedby]="emailError() ? 'user-detail-email-err' : null"
                />
                @if (emailError(); as msg) {
                  <span id="user-detail-email-err" class="mt-1 text-xs text-red-700">{{ msg }}</span>
                }
              </label>
              <p-button
                label="Save"
                type="submit"
                [disabled]="emailForm.invalid || store.saving() || emailForm.pristine"
                [loading]="store.saving()"
                size="small"
              />
            </div>
          </form>
        }

        <!-- Activation toggle -->
        @if (canToggleActivation()) {
          <div class="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div class="text-sm font-semibold text-gray-900">Activation</div>
            @if (u.isActive) {
              @if (canDeactivateUser()) {
                <form
                  [formGroup]="deactivateForm"
                  (ngSubmit)="onDeactivate()"
                  class="flex flex-wrap items-end gap-2"
                >
                  <label class="flex flex-col text-sm" for="user-detail-reason">
                    <span class="text-xs font-medium text-gray-600">
                      Reason for deactivating
                      <span
                        class="ml-1 text-xs"
                        [class.text-gray-400]="reasonLength() <= reasonWarnThreshold"
                        [class.text-amber-600]="reasonLength() > reasonWarnThreshold && reasonLength() <= reasonMax"
                        [class.text-red-600]="reasonLength() > reasonMax"
                      >
                        {{ reasonLength() }}/{{ reasonMax }}
                      </span>
                    </span>
                    <input
                      pInputText
                      id="user-detail-reason"
                      formControlName="reason"
                      class="w-96"
                      [attr.maxlength]="reasonMax"
                      [attr.aria-describedby]="reasonError() ? 'user-detail-reason-err' : null"
                    />
                    @if (reasonError(); as msg) {
                      <span id="user-detail-reason-err" class="mt-1 text-xs text-red-700">{{ msg }}</span>
                    }
                  </label>
                  <p-button
                    label="Deactivate"
                    type="submit"
                    severity="danger"
                    [disabled]="deactivateForm.invalid || store.saving()"
                    [loading]="store.saving()"
                    size="small"
                  />
                </form>
              } @else {
                <p class="text-sm text-gray-500">You don't have permission to deactivate users.</p>
              }
            } @else {
              @if (canActivateUser()) {
                <p-button
                  label="Activate user"
                  severity="success"
                  size="small"
                  [disabled]="store.saving()"
                  [loading]="store.saving()"
                  (onClick)="onActivate()"
                />
              } @else {
                <p class="text-sm text-gray-500">You don't have permission to activate users.</p>
              }
            }
          </div>
        }
      }
    </section>
  `,
})
export class UserDetailComponent implements OnInit, HasUnsavedChanges {
  /** Route-bound id (Angular 16+ `withComponentInputBinding` style). */
  readonly id = input.required<string>();

  protected readonly store = inject(UsersStore);
  private readonly auth = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);

  /** Convenience selector — re-renders any time `entities[id]` changes. */
  protected readonly user = computed(() => this.store.entities()[this.id()] ?? null);

  protected readonly canWrite = computed(() =>
    this.auth.hasAllPermissions(USER_PERMISSIONS.WRITE),
  );
  protected readonly canDeactivateUser = computed(() =>
    this.auth.hasAllPermissions(USER_PERMISSIONS.DEACTIVATE),
  );
  protected readonly canActivateUser = computed(() =>
    this.auth.hasAllPermissions(USER_PERMISSIONS.ACTIVATE),
  );
  protected readonly canToggleActivation = computed(
    () => this.canDeactivateUser() || this.canActivateUser(),
  );

  protected readonly renameForm: FormGroup = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
  });

  protected readonly emailForm: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  protected readonly deactivateForm: FormGroup = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(REASON_MAX)]],
  });

  /**
   * Per-submit-cycle idempotency keys. Generated once when the form submit
   * starts and reused across retry attempts for the same logical save —
   * lets the backend's IdempotencyEndpointFilter collapse duplicates.
   */
  private renameKey: string | null = null;
  private emailKey: string | null = null;
  private activationKey: string | null = null;

  /**
   * Reactive char counter for the deactivate reason. Subscribed via
   * `valueChanges.subscribe` would force RxJS plumbing; we use
   * `.value` reads from a `signal()` mirror updated by `valueChanges`.
   */
  private readonly _reasonValue = signal<string>('');
  protected readonly reasonLength = computed(() => this._reasonValue().length);
  protected readonly reasonMax = REASON_MAX;
  protected readonly reasonWarnThreshold = REASON_WARN_THRESHOLD;

  protected readonly renameFirstNameError = computed(() => {
    const c = this.renameForm.get('firstName');
    if (!c || (!c.touched && !c.dirty)) return null;
    if (c.hasError('required')) return 'First name is required.';
    if (c.hasError('maxlength')) return 'Maximum 100 characters.';
    return fieldErrorMessage(this.store.saveError(), 'firstName');
  });
  protected readonly renameLastNameError = computed(() => {
    const c = this.renameForm.get('lastName');
    if (!c || (!c.touched && !c.dirty)) return null;
    if (c.hasError('required')) return 'Last name is required.';
    if (c.hasError('maxlength')) return 'Maximum 100 characters.';
    return fieldErrorMessage(this.store.saveError(), 'lastName');
  });
  protected readonly emailError = computed(() => {
    const c = this.emailForm.get('email');
    if (!c || (!c.touched && !c.dirty)) return null;
    if (c.hasError('required')) return 'Email is required.';
    if (c.hasError('email')) return 'Enter a valid email address.';
    if (c.hasError('maxlength')) return 'Maximum 254 characters.';
    if (this.store.saveConflict()) return 'That email is already in use by another account.';
    return fieldErrorMessage(this.store.saveError(), 'email');
  });
  protected readonly reasonError = computed(() => {
    const c = this.deactivateForm.get('reason');
    if (!c || (!c.touched && !c.dirty)) return null;
    if (c.hasError('required')) return 'Reason is required.';
    if (c.hasError('maxlength')) return `Maximum ${REASON_MAX} characters.`;
    return null;
  });

  protected readonly saveErrorTitle = computed(() => {
    const err = this.store.saveError();
    if (!err) return '';
    if (err.statusCode === 409) return 'Conflict';
    if (err.statusCode === 403) return 'Permission denied';
    if (err.statusCode === 400) return 'Validation failed';
    return 'Save failed';
  });

  /**
   * Watches the store's `notFound` flag — set by `loadById` when the API
   * returns 404. Toast + navigate back to /users so the user lands somewhere
   * useful, not on a permanent "user not found" page.
   *
   * Effect (not `ngOnInit` callback) so it survives route param changes
   * within the same component instance.
   */
  private readonly _notFoundEffect = effect(() => {
    if (this.store.notFound()) {
      untracked(() => {
        this.notify.warn('User not found', 'They may have been deleted.');
        void this.router.navigate(['/users']);
      });
    }
  });

  /**
   * Seeds the rename + email forms whenever the user materialises. Replaces
   * the prior `queueMicrotask(seed)` (caused NG0950-style races on fast
   * renders — input binding hadn't completed when the microtask ran).
   *
   * `untracked` around `patchValue` so this effect doesn't re-fire on
   * its own writes.
   */
  private readonly _seedFormsEffect = effect(() => {
    const u = this.user();
    if (!u) return;
    untracked(() => {
      this.renameForm.patchValue(
        { firstName: u.firstName, lastName: u.lastName },
        { emitEvent: false },
      );
      this.renameForm.markAsPristine();
      this.emailForm.patchValue({ email: u.email }, { emitEvent: false });
      this.emailForm.markAsPristine();
    });
  });

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.store.loadById(this.id());

    // Mirror the deactivate-reason value to a signal so `reasonLength` is
    // reactive without needing to call `markForCheck` on every keystroke.
    // `takeUntilDestroyed` ties the subscription to the component lifetime.
    this.deactivateForm
      .get('reason')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value: unknown) => {
        this._reasonValue.set(typeof value === 'string' ? value : '');
      });
  }

  // ── lifecycle ───────────────────────────────────────────────────────────

  /**
   * `canDeactivate` guard hook — blocks navigation when any inline form has
   * unsaved edits. Browser back / sidebar nav fires this; the user sees a
   * native confirm() (kept simple — Angular doesn't natively have a
   * blocking promise dialog without injecting `ConfirmationService` from
   * outside the route).
   */
  canDeactivate(): boolean {
    const dirty =
      this.renameForm.dirty || this.emailForm.dirty || this.deactivateForm.dirty;
    if (!dirty || this.store.saving()) return true;
    return window.confirm('You have unsaved changes. Leave anyway?');
  }

  // ── action handlers ─────────────────────────────────────────────────────

  protected onRename(): void {
    if (this.renameForm.invalid || this.renameForm.pristine) return;
    this.renameKey ??= generateIdempotencyKey();
    this.store.renameUser({
      id: this.id(),
      request: this.renameForm.getRawValue() as { firstName: string; lastName: string },
    });
    // Clear the key after a microtask so a subsequent "edit again, save"
    // gets a fresh key. The ngrx rxMethod resolves synchronously on the
    // tap-error path; clearing here is safe.
    Promise.resolve().then(() => {
      this.renameKey = null;
      // Mark pristine ONLY if the save succeeded — saveError clears means OK.
      if (!this.store.saveError()) this.renameForm.markAsPristine();
    });
  }

  protected onChangeEmail(): void {
    if (this.emailForm.invalid || this.emailForm.pristine) return;
    this.emailKey ??= generateIdempotencyKey();
    this.store.changeEmail({
      id: this.id(),
      request: this.emailForm.getRawValue() as { email: string },
    });
    Promise.resolve().then(() => {
      this.emailKey = null;
      if (!this.store.saveError()) this.emailForm.markAsPristine();
    });
  }

  protected onActivate(): void {
    if (this.store.saving()) return;
    this.activationKey ??= generateIdempotencyKey();
    this.store.activateUser(this.id());
    Promise.resolve().then(() => {
      this.activationKey = null;
    });
  }

  /**
   * Two-step deactivate: validate the reason, then ask
   * `ConfirmationService.confirm` with destructive styling. The dialog's
   * accept callback dispatches the actual mutation; the reject callback is
   * a no-op (typed reason stays in the form).
   */
  protected onDeactivate(): void {
    if (this.deactivateForm.invalid || this.store.saving()) return;
    const reason = (this.deactivateForm.getRawValue() as { reason: string }).reason;
    const u = this.user();
    if (!u) return;

    this.confirm.confirm({
      message: `Deactivate ${u.firstName} ${u.lastName}? They will lose access immediately and any active sessions will be revoked on next request.`,
      acceptLabel: 'Deactivate',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      defaultFocus: 'reject',
      accept: () => {
        this.activationKey ??= generateIdempotencyKey();
        this.store.deactivateUser({
          id: this.id(),
          request: { reason },
        });
        Promise.resolve().then(() => {
          this.activationKey = null;
          if (!this.store.saveError()) {
            this.deactivateForm.reset({ reason: '' });
          }
        });
      },
    });
  }

  protected retryLoad(): void {
    this.store.loadById(this.id());
  }
}
