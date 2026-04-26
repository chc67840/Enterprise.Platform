/**
 * ─── USER CREATE ────────────────────────────────────────────────────────────────
 *
 * Reactive form mirroring `CreateUserCommand` (backend FluentValidation):
 *   - email: required, RFC-ish format, max 254
 *   - firstName: required, max 100
 *   - lastName: required, max 100
 *   - externalIdentityId: optional, must be a UUID when present
 *
 * On success: store sets `activeId` to the new user's id, then we navigate
 * to `../<newId>` so the user lands on the detail view of the row they just
 * created (less context-switch than going back to the list).
 */
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { UsersStore } from '../state/users.store';

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
    <section class="space-y-4">
      <header>
        <a [routerLink]="['..']" class="text-sm text-blue-600 hover:text-blue-700">← Back to users</a>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-gray-900">New user</h2>
      </header>

      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        class="space-y-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
      >
        <label class="flex flex-col text-sm">
          <span class="text-xs font-medium text-gray-600">Email <span class="text-red-600">*</span></span>
          <input pInputText formControlName="email" type="email" maxlength="254" class="w-96" />
          @if (showError('email')) {
            <span class="mt-1 text-xs text-red-700">A valid email is required.</span>
          }
        </label>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="flex flex-col text-sm">
            <span class="text-xs font-medium text-gray-600">First name <span class="text-red-600">*</span></span>
            <input pInputText formControlName="firstName" maxlength="100" />
            @if (showError('firstName')) {
              <span class="mt-1 text-xs text-red-700">First name is required.</span>
            }
          </label>
          <label class="flex flex-col text-sm">
            <span class="text-xs font-medium text-gray-600">Last name <span class="text-red-600">*</span></span>
            <input pInputText formControlName="lastName" maxlength="100" />
            @if (showError('lastName')) {
              <span class="mt-1 text-xs text-red-700">Last name is required.</span>
            }
          </label>
        </div>

        <label class="flex flex-col text-sm">
          <span class="text-xs font-medium text-gray-600">External identity id (optional)</span>
          <input
            pInputText
            formControlName="externalIdentityId"
            placeholder="e.g. 11111111-2222-3333-4444-555555555555"
            class="w-96 font-mono"
          />
          @if (showError('externalIdentityId')) {
            <span class="mt-1 text-xs text-red-700">Must be a valid UUID when supplied.</span>
          }
        </label>

        <div class="flex items-center gap-2">
          <p-button
            label="Create user"
            type="submit"
            [disabled]="form.invalid || store.saving()"
          />
          <a [routerLink]="['..']" class="text-sm text-gray-600 hover:text-gray-900">Cancel</a>
        </div>
      </form>
    </section>
  `,
})
export class UserCreateComponent {
  protected readonly store = inject(UsersStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly form: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    externalIdentityId: ['', [Validators.pattern(UUID_PATTERN)]],
  });

  /**
   * Watches `activeId` — the store sets it after a successful create. We
   * navigate to that detail page rather than calling `router.navigate` from
   * inside the success callback (the store wires the success notification
   * already; we just react to the resulting state).
   */
  private readonly _navigateOnCreate = effect(() => {
    const id = this.store.activeId();
    if (id && this.justSubmitted) {
      this.justSubmitted = false;
      void this.router.navigate(['..', id], { relativeTo: this.route });
    }
  });

  /** Set true between submit and navigate so we don't redirect on unrelated activeId changes. */
  private justSubmitted = false;

  private readonly route = inject(ActivatedRoute);

  protected showError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control && control.invalid && (control.touched || control.dirty));
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue() as {
      email: string;
      firstName: string;
      lastName: string;
      externalIdentityId: string;
    };

    this.justSubmitted = true;
    this.store.createUser({
      email: raw.email,
      firstName: raw.firstName,
      lastName: raw.lastName,
      externalIdentityId: raw.externalIdentityId.trim() ? raw.externalIdentityId.trim() : null,
    });
  }
}
