/**
 * ─── USER DEACTIVATE DIALOG ─────────────────────────────────────────────────────
 *
 * A small confirm-with-reason dialog for the deactivate row action. Reuses
 * the schema-form for its single `reason` field — proves the schema kit
 * scales down to single-input use cases, not just full forms.
 *
 * Activation goes through a plain ConfirmationService (no reason needed) so
 * that path stays in the data table; this component is just the deactivate
 * variant which has the audit-trail reason.
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
import { deactivateReasonSchema } from './user-form-schema';

interface ReasonPayload {
  reason: string;
}

@Component({
  selector: 'app-user-deactivate-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, SchemaFormComponent],
  template: `
    <dph-dialog
      [(visible)]="visible"
      [config]="{
        header: 'Deactivate user',
        subheader: subheader(),
        width: 'min(520px, 92vw)',
        closable: !store.saving(),
        dismissableMask: !store.saving(),
        closeOnEscape: !store.saving(),
      }"
    >
      <ng-container slot="content">
        @if (showServerErrorBanner()) {
          <div class="user-deact-dialog__banner" role="alert" aria-live="assertive">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            <p>{{ store.saveError()?.message }}</p>
          </div>
        }
        <p class="user-deact-dialog__lede">
          They will lose access immediately and any active sessions will be
          revoked on the next request.
        </p>
        <dph-schema-form
          #form
          [schema]="schema"
          [apiError]="store.saveError()"
          [submitting]="store.saving()"
          submitLabel="Deactivate user"
          cancelLabel="Cancel"
          (submit)="onSubmit($event)"
          (cancel)="onCancel()"
        />
      </ng-container>
    </dph-dialog>
  `,
  styles: [
    `
      .user-deact-dialog__lede {
        margin: 0 0 1rem 0;
        font-size: 0.875rem;
        color: var(--ep-text-secondary, #4b5563);
      }
      .user-deact-dialog__banner {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        padding: 0.625rem 0.875rem;
        background: var(--ep-surface-danger, #fef2f2);
        border: 1px solid var(--ep-border-danger, #fecaca);
        border-radius: 0.5rem;
        color: var(--ep-text-danger, #991b1b);
        font-size: 0.8125rem;
      }
      .user-deact-dialog__banner p {
        margin: 0;
      }
    `,
  ],
})
export class UserDeactivateDialogComponent {
  // ── Inputs / two-way ─────────────────────────────────────────────────
  readonly visible = model<boolean>(false);
  readonly user = input.required<UserDto | null>();

  // ── Outputs ──────────────────────────────────────────────────────────
  readonly deactivated = output<UserDto>();

  // ── Wiring ───────────────────────────────────────────────────────────
  protected readonly store = inject(UsersStore);
  private readonly form = viewChild<SchemaFormComponent>('form');

  protected readonly schema = deactivateReasonSchema();
  private readonly inFlight = signal(false);

  protected readonly subheader = computed(() => {
    const u = this.user();
    return u ? `${u.firstName} ${u.lastName} — ${u.email}` : '';
  });

  protected readonly showServerErrorBanner = computed(() => {
    const err = this.store.saveError();
    if (!err) return false;
    if (err.statusCode === 400 && err.errors) return false;
    return true;
  });

  // ── Effects ──────────────────────────────────────────────────────────

  private readonly _completionWatcher = effect(() => {
    const saving = this.store.saving();
    if (!this.inFlight() || saving) return;
    untracked(() => {
      const err = this.store.saveError();
      this.inFlight.set(false);
      if (err) return;
      const u = this.user();
      if (u) this.deactivated.emit(u);
      this.visible.set(false);
    });
  });

  private readonly _openReset = effect(() => {
    if (!this.visible()) return;
    untracked(() => {
      this.inFlight.set(false);
      this.store.clearSaveError();
      this.form()?.focusFirst();
    });
  });

  // ── Handlers ─────────────────────────────────────────────────────────

  protected onSubmit(value: Record<string, unknown>): void {
    const u = this.user();
    if (!u) return;
    const payload = value as unknown as ReasonPayload;
    this.inFlight.set(true);
    this.store.deactivateUser({
      id: u.id,
      request: { reason: payload.reason },
    });
  }

  protected onCancel(): void {
    if (this.store.saving()) return;
    this.visible.set(false);
  }
}
