/**
 * ─── USER DETAIL ────────────────────────────────────────────────────────────────
 *
 * Reads the `:id` route param + drives `UsersStore.loadById`. Renders the user
 * fields plus four action panels (rename, change email, activate / deactivate)
 * — each is a small inline form rather than a separate route, since the
 * actions are short-form and the user expects to stay on the same page.
 *
 * Form validation mirrors the backend FluentValidation:
 *   - first/last name: required, max 100
 *   - email: required, RFC-ish format, max 254
 *   - reason (deactivate): required, max 500
 *
 * Mismatches trip Angular's `Validators.*` first; the backend's reciprocal
 * validation is the authoritative gate (server returns 400 with field
 * details which the global error interceptor toasts).
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';

import { UsersStore } from '../state/users.store';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    TagModule,
  ],
  template: `
    <section class="space-y-4">
      <header>
        <a
          [routerLink]="['..']"
          class="text-sm text-blue-600 hover:text-blue-700"
        >
          ← Back to users
        </a>
        @if (user(); as u) {
          <h2 class="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
            {{ u.firstName }} {{ u.lastName }}
            @if (u.isActive) {
              <p-tag value="Active" severity="success" class="ml-2 align-middle" />
            } @else {
              <p-tag value="Inactive" severity="secondary" class="ml-2 align-middle" />
            }
          </h2>
          <p class="mt-1 font-mono text-sm text-gray-600">{{ u.email }}</p>
        } @else if (store.loadingDetail()) {
          <p class="mt-2 text-sm text-gray-500">Loading…</p>
        } @else {
          <p class="mt-2 text-sm text-red-700">User not found.</p>
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

        <!-- Rename -->
        <form
          [formGroup]="renameForm"
          (ngSubmit)="onRename()"
          class="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
        >
          <div class="text-sm font-semibold text-gray-900">Rename</div>
          <div class="flex flex-wrap items-end gap-2">
            <label class="flex flex-col text-sm">
              <span class="text-xs font-medium text-gray-600">First name</span>
              <input pInputText formControlName="firstName" class="w-48" maxlength="100" />
            </label>
            <label class="flex flex-col text-sm">
              <span class="text-xs font-medium text-gray-600">Last name</span>
              <input pInputText formControlName="lastName" class="w-48" maxlength="100" />
            </label>
            <p-button
              label="Save"
              type="submit"
              [disabled]="renameForm.invalid || store.saving()"
              size="small"
            />
          </div>
        </form>

        <!-- Change email -->
        <form
          [formGroup]="emailForm"
          (ngSubmit)="onChangeEmail()"
          class="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
        >
          <div class="text-sm font-semibold text-gray-900">Change email</div>
          <div class="flex flex-wrap items-end gap-2">
            <label class="flex flex-col text-sm">
              <span class="text-xs font-medium text-gray-600">New email</span>
              <input pInputText formControlName="email" type="email" class="w-72" maxlength="254" />
            </label>
            <p-button
              label="Save"
              type="submit"
              [disabled]="emailForm.invalid || store.saving()"
              size="small"
            />
          </div>
        </form>

        <!-- Activation toggle -->
        <div class="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div class="text-sm font-semibold text-gray-900">Activation</div>
          @if (u.isActive) {
            <form
              [formGroup]="deactivateForm"
              (ngSubmit)="onDeactivate()"
              class="flex flex-wrap items-end gap-2"
            >
              <label class="flex flex-col text-sm">
                <span class="text-xs font-medium text-gray-600">Reason for deactivating</span>
                <input pInputText formControlName="reason" class="w-96" maxlength="500" />
              </label>
              <p-button
                label="Deactivate"
                type="submit"
                severity="danger"
                [disabled]="deactivateForm.invalid || store.saving()"
                size="small"
              />
            </form>
          } @else {
            <p-button
              label="Activate user"
              severity="success"
              size="small"
              [disabled]="store.saving()"
              (onClick)="onActivate()"
            />
          }
        </div>
      }
    </section>
  `,
})
export class UserDetailComponent implements OnInit {
  /** Route-bound id (Angular 16+ `withComponentInputBinding` style). */
  readonly id = input.required<string>();

  protected readonly store = inject(UsersStore);
  private readonly fb = inject(FormBuilder);

  /** Convenience selector — re-renders any time `entities[id]` changes. */
  protected readonly user = computed(() => this.store.entities()[this.id()] ?? null);

  protected readonly renameForm: FormGroup = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
  });

  protected readonly emailForm: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  protected readonly deactivateForm: FormGroup = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.store.loadById(this.id());

    // Seed the rename + email forms whenever the user materialises so the
    // user can click "Save" without retyping the existing values.
    const seed = (): void => {
      const u = this.user();
      if (!u) return;
      this.renameForm.patchValue({ firstName: u.firstName, lastName: u.lastName }, { emitEvent: false });
      this.emailForm.patchValue({ email: u.email }, { emitEvent: false });
    };
    queueMicrotask(seed);                         // wait for first signal materialise
  }

  protected onRename(): void {
    if (this.renameForm.invalid) return;
    this.store.renameUser({
      id: this.id(),
      request: this.renameForm.getRawValue() as { firstName: string; lastName: string },
    });
  }

  protected onChangeEmail(): void {
    if (this.emailForm.invalid) return;
    this.store.changeEmail({
      id: this.id(),
      request: this.emailForm.getRawValue() as { email: string },
    });
  }

  protected onActivate(): void {
    this.store.activateUser(this.id());
  }

  protected onDeactivate(): void {
    if (this.deactivateForm.invalid) return;
    this.store.deactivateUser({
      id: this.id(),
      request: this.deactivateForm.getRawValue() as { reason: string },
    });
    this.deactivateForm.reset({ reason: '' });
  }
}
