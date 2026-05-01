/**
 * ─── DPH UI KIT — SCHEMA-DRIVEN FORM ────────────────────────────────────────────
 *
 * Renders a form from a declarative `FormSchema`. One source of truth, four
 * concerns handled:
 *   1. FormGroup construction (controls + validators) from the field list.
 *   2. Field rendering via `dph-input` with consistent label / hint / errors.
 *   3. Local validation message mapping (required / email / maxLength / pattern).
 *   4. Server-side validation mapping (RFC 7807 `errors[key]` → field UI), with
 *      case-insensitive key match.
 *
 * Submit transforms (per-field `trim` / `nullIfEmpty`) run before
 * `(submit)` emits, so the host receives a payload that matches the API's
 * expected shape — no per-form `.trim()` boilerplate.
 *
 *   <dph-schema-form
 *     [schema]="schema"
 *     [initialValue]="initial()"
 *     [apiError]="store.saveError()"
 *     [submitting]="store.saving()"
 *     [submitLabel]="'Create user'"
 *     (submit)="onSubmit($event)"
 *     (cancel)="onCancel()"
 *   />
 *
 * The hosting component does NOT need to build a FormGroup — the schema is
 * the only thing it owns. Hosts that need imperative control (focus, reset,
 * mark pristine) can use a `viewChild()` + the public methods exposed below.
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';
import type { AbstractControl, FormGroup, ValidatorFn } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import type { ApiError } from '@core/models';

import { ButtonComponent } from './button.component';
import { CheckboxComponent, type CheckboxFieldConfig } from './checkbox.component';
import { DatePickerComponent, type DatePickerFieldConfig } from './date-picker.component';
import { FileUploadComponent } from './file-upload.component';
import { FormLayoutComponent } from './form-layout.component';
import { InputComponent } from './input.component';
import { MultiSelectComponent, type MultiSelectFieldConfig } from './multi-select.component';
import { RadioGroupComponent, type RadioGroupFieldConfig } from './radio-group.component';
import { SelectComponent, type SelectFieldConfig } from './select.component';
import { SwitchComponent, type SwitchFieldConfig } from './switch.component';
import type { FileItem, FileUploadConfig } from './dph.types';
import type { FormSchema, SchemaField, SchemaFormEvent } from './schema-form.types';

@Component({
  selector: 'dph-schema-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputComponent,
    FormLayoutComponent,
    ButtonComponent,
    SelectComponent,
    MultiSelectComponent,
    CheckboxComponent,
    SwitchComponent,
    RadioGroupComponent,
    DatePickerComponent,
    FileUploadComponent,
  ],
  template: `
    <form
      [formGroup]="form()"
      (ngSubmit)="onSubmit()"
      novalidate
      autocomplete="off"
      class="dph-schema-form"
    >
      <dph-form-layout
        [config]="{
          variant: 'grid',
          columns: schema().columns ?? 1,
          gap: schema().gap ?? 'md',
        }"
      >
        @for (field of schema().fields; track field.key) {
          <div
            class="dph-schema-form__field"
            [attr.data-span]="spanFor(field)"
            [attr.data-type]="field.type"
          >
            @switch (field.type) {
              @case ('select') {
                <dph-select
                  [config]="selectConfigFor(field)"
                  [value]="valueFor(field.key)"
                  (valueChange)="onFieldChange(field.key, $event)"
                  (blur)="onFieldBlur(field.key)"
                />
              }
              @case ('multiselect') {
                <dph-multi-select
                  [config]="multiSelectConfigFor(field)"
                  [value]="multiValueFor(field.key)"
                  (valueChange)="onFieldChange(field.key, $event)"
                  (blur)="onFieldBlur(field.key)"
                />
              }
              @case ('radio') {
                <dph-radio-group
                  [config]="radioConfigFor(field)"
                  [value]="valueFor(field.key)"
                  (valueChange)="onFieldChange(field.key, $event)"
                />
              }
              @case ('checkbox') {
                <dph-checkbox
                  [config]="checkboxConfigFor(field)"
                  [value]="booleanValueFor(field.key)"
                  (valueChange)="onFieldChange(field.key, $event)"
                />
              }
              @case ('switch') {
                <dph-switch
                  [config]="switchConfigFor(field)"
                  [value]="booleanValueFor(field.key)"
                  (valueChange)="onFieldChange(field.key, $event)"
                />
              }
              @case ('date') {
                <dph-date-picker
                  [config]="dateConfigFor(field, 'date')"
                  [value]="dateValueFor(field.key)"
                  (valueChange)="onFieldChange(field.key, $event)"
                  (blur)="onFieldBlur(field.key)"
                />
              }
              @case ('datetime') {
                <dph-date-picker
                  [config]="dateConfigFor(field, 'datetime')"
                  [value]="dateValueFor(field.key)"
                  (valueChange)="onFieldChange(field.key, $event)"
                  (blur)="onFieldBlur(field.key)"
                />
              }
              @case ('time') {
                <dph-date-picker
                  [config]="dateConfigFor(field, 'time')"
                  [value]="dateValueFor(field.key)"
                  (valueChange)="onFieldChange(field.key, $event)"
                  (blur)="onFieldBlur(field.key)"
                />
              }
              @case ('file') {
                <dph-file-upload
                  [config]="fileConfigFor(field)"
                  [files]="fileValueFor(field.key)"
                  (filesChange)="onFieldChange(field.key, $event)"
                />
              }
              @default {
                <dph-input
                  #firstField
                  [config]="inputConfigFor(field)"
                  [value]="valueFor(field.key)"
                  (valueChange)="onFieldChange(field.key, $event)"
                  (blur)="onFieldBlur(field.key)"
                />
              }
            }
          </div>
        }

        <ng-container slot="actions">
          @if (showActions()) {
            <div class="dph-schema-form__actions">
              @if (showCancel()) {
                <dph-button
                  variant="ghost"
                  size="md"
                  type="button"
                  [disabled]="submitting()"
                  [label]="cancelLabel()"
                  (clicked)="onCancel()"
                />
              }
              <dph-button
                variant="primary"
                size="md"
                type="submit"
                [loading]="submitting()"
                [disabled]="submitDisabled()"
                [label]="submitLabel()"
              />
            </div>
          }
        </ng-container>
      </dph-form-layout>
    </form>
  `,
  styleUrl: './schema-form.component.scss',
})
export class SchemaFormComponent {
  // ── Inputs ────────────────────────────────────────────────────────────
  readonly schema = input.required<FormSchema>();
  readonly initialValue = input<Readonly<Record<string, unknown>> | null>(null);
  readonly apiError = input<ApiError | null>(null);
  readonly submitting = input<boolean>(false);
  readonly submitLabel = input<string>('Save');
  readonly cancelLabel = input<string>('Cancel');
  readonly showActions = input<boolean>(true);
  readonly showCancel = input<boolean>(true);
  /** Optional override for the email-conflict (409) message on a specific field key. */
  readonly conflictMessage = input<string | null>(null);
  /** Field key the conflict message targets (defaults to "email" if a field with that key exists). */
  readonly conflictField = input<string | null>(null);

  // ── Outputs ───────────────────────────────────────────────────────────
  /**
   * @deprecated since 2026-04-30 (P1.1) — prefer `(onEvent)` and switch on
   * `event.type === 'form:submit'`. Kept during deprecation window so
   * existing hosts keep working; remove once all consumers migrate.
   */
  readonly submit = output<Record<string, unknown>>();
  /** @deprecated since 2026-04-30 (P1.1) — prefer `(onEvent)` `'form:cancel'`. */
  readonly cancel = output<void>();
  /** @deprecated since 2026-04-30 (P1.1) — prefer `(onEvent)` `'form:patch'`. */
  readonly valueChange = output<Record<string, unknown>>();

  /**
   * Single-channel event output. Hosts subscribe via:
   *
   *     <dph-schema-form ... (onEvent)="handle($event)" />
   *
   *     handle(event: SchemaFormEvent): void {
   *       switch (event.type) {
   *         case 'form:submit': this.save(event.value); break;
   *         case 'form:cancel': this.close(); break;
   *         case 'field:change': this.audit(event.key, event.value); break;
   *       }
   *     }
   *
   * The narrowing type guards (`isSchemaFormFormEvent`, etc.) live in
   * `schema-form.types.ts` for hosts that prefer guard-based filtering
   * over `@switch`.
   */
  readonly onEvent = output<SchemaFormEvent>();

  // ── Internals ─────────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);

  /** First focusable input — used by `focusFirst()`. */
  private readonly firstField = viewChild<ElementRef<HTMLElement>>('firstField');

  /**
   * The FormGroup is rebuilt whenever the schema reference changes. Hosts
   * that need to swap modes (create ↔ edit) just emit a new schema; the
   * component takes care of the rest.
   */
  protected readonly form = computed<FormGroup>(() => buildFormGroup(this.fb, this.schema()));

  /** Touched / dirty / value tracking — re-evaluates as the form mutates. */
  private readonly _formStateTick = signal(0);

  /** Flag flipped by `onSubmit()` so child errors show even if not yet touched. */
  protected readonly submitAttempted = signal(false);

  // ── Effects ───────────────────────────────────────────────────────────

  /** Reset the form's values whenever the host swaps `initialValue`. */
  private readonly _seedValuesEffect = effect(() => {
    const init = this.initialValue();
    const form = this.form();
    untracked(() => {
      const next: Record<string, unknown> = {};
      for (const field of this.schema().fields) {
        next[field.key] =
          init?.[field.key] ??
          field.defaultValue ??
          defaultValueFor(field);
      }
      form.reset(next, { emitEvent: false });
      this.submitAttempted.set(false);
      this._formStateTick.set(0);
    });
  });

  /**
   * Subscribe to value changes so the template re-renders error state lazily.
   * `onCleanup` unsubscribes when the schema (and thus the form) is swapped or
   * the component destroys, preventing zombie subscriptions on every rebuild.
   *
   * Emits BOTH the legacy `(valueChange)` (deprecated) and the new
   * `(onEvent)` `'form:patch'` so hosts can migrate independently.
   */
  private readonly _trackValueChanges = effect((onCleanup) => {
    const form = this.form();
    const sub = form.valueChanges.subscribe(() => {
      this._formStateTick.update((n) => n + 1);
      const raw = form.getRawValue() as Record<string, unknown>;
      this.valueChange.emit(raw);
      this.onEvent.emit({ type: 'form:patch', value$: raw });
    });
    onCleanup(() => sub.unsubscribe());
  });

  // ── Computed view-model ───────────────────────────────────────────────

  protected readonly submitDisabled = computed<boolean>(() => {
    if (this.submitting()) return true;
    if (!this.schema().disableSubmitWhenPristine) return false;
    // tick ensures we re-evaluate on every value change
    this._formStateTick();
    return this.form().pristine;
  });

  /**
   * Build a server-error index — `errors[key.toLowerCase()]` → field key.
   * Every field's own `key` and `serverErrorKeys` contribute. Recomputed
   * when the schema changes.
   */
  protected readonly serverErrorIndex = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const field of this.schema().fields) {
      out[field.key.toLowerCase()] = field.key;
      for (const alt of field.serverErrorKeys ?? []) {
        out[alt.toLowerCase()] = field.key;
      }
    }
    return out;
  });

  // ── Public API (for parents that need imperative control) ─────────────

  /** Programmatically focus the first input. Call after dialog open. */
  focusFirst(): void {
    queueMicrotask(() => {
      const el = this.firstField()?.nativeElement;
      const input = el?.querySelector?.('input,textarea,select') as HTMLElement | null;
      input?.focus();
    });
  }

  /** Mark the form as pristine (e.g. after a successful save where the dialog stays open). */
  markPristine(): void {
    this.form().markAsPristine();
    this._formStateTick.update((n) => n + 1);
  }

  /** Re-emit the current cleaned values, e.g. after the host updates a related field. */
  resubmit(): void {
    if (this.form().valid) this.submit.emit(this.cleanedValue());
  }

  // ── Template helpers ──────────────────────────────────────────────────

  protected spanFor(field: SchemaField): number | string {
    const span = field.columnSpan ?? 1;
    return span === 'full' ? this.schema().columns ?? 1 : span;
  }

  protected valueFor(key: string): string | number | null {
    // Tick read makes this binding re-evaluate on every form-state change.
    this._formStateTick();
    const v = this.form().controls[key]?.value;
    if (v === undefined || v === null) return null;
    return v as string | number | null;
  }

  /** Typed accessors for the new field renderers. Each ticks the same signal. */
  protected booleanValueFor(key: string): boolean {
    this._formStateTick();
    return !!this.form().controls[key]?.value;
  }

  protected multiValueFor(key: string): readonly unknown[] | null {
    this._formStateTick();
    const v = this.form().controls[key]?.value;
    return Array.isArray(v) ? (v as readonly unknown[]) : null;
  }

  protected dateValueFor(key: string): Date | null {
    this._formStateTick();
    const v = this.form().controls[key]?.value;
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'string') {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  protected fileValueFor(key: string): FileItem[] {
    this._formStateTick();
    const v = this.form().controls[key]?.value;
    // Returned mutable to satisfy dph-file-upload's [(files)] model contract.
    return Array.isArray(v) ? ([...v] as FileItem[]) : [];
  }

  protected onFieldChange(key: string, value: unknown): void {
    const ctrl = this.form().controls[key];
    if (!ctrl) return;
    if (ctrl.value === value) return;
    ctrl.setValue(value, { emitEvent: true });
    ctrl.markAsDirty();
    // P1.1 event channel — emits AFTER setValue so `value$` reflects the
    // new state. valueChange-effect will also fire `form:patch` shortly.
    this.onEvent.emit({
      type: 'field:change',
      key,
      value,
      value$: this.form().getRawValue() as Record<string, unknown>,
    });
  }

  protected onFieldBlur(key: string): void {
    this.form().controls[key]?.markAsTouched();
    this._formStateTick.update((n) => n + 1);
    this.onEvent.emit({
      type: 'field:blur',
      key,
      value$: this.form().getRawValue() as Record<string, unknown>,
    });
  }

  // ── Phase A — per-type config builders ───────────────────────────────
  //
  // Each helper materialises the typed config object the matching renderer
  // expects. `errors` + `invalid` flow uniformly via `errorsFor()` so
  // server-side errors apply identically across every field type.

  protected selectConfigFor(field: SchemaField): SelectFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label,
      placeholder: field.placeholder,
      hint: field.hint,
      options: field.options ?? [],
      required: field.required,
      disabled: field.disabled,
      readonly: field.readonly,
      clearable: field.clearable ?? !field.required,
      filterable: field.filterable ?? (field.options?.length ?? 0) > 8,
      emptyOptionsText: field.emptyOptionsText,
      id: `dph-schema-${field.key}`,
      name: field.key,
      errors,
      invalid: errors.length > 0,
    };
  }

  protected multiSelectConfigFor(field: SchemaField): MultiSelectFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label,
      placeholder: field.placeholder,
      hint: field.hint,
      options: field.options ?? [],
      required: field.required,
      disabled: field.disabled,
      readonly: field.readonly,
      filterable: field.filterable ?? (field.options?.length ?? 0) > 8,
      chipDisplay: field.chipDisplay,
      emptyOptionsText: field.emptyOptionsText,
      id: `dph-schema-${field.key}`,
      name: field.key,
      errors,
      invalid: errors.length > 0,
    };
  }

  protected radioConfigFor(field: SchemaField): RadioGroupFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label,
      hint: field.hint,
      options: field.options ?? [],
      required: field.required,
      disabled: field.disabled,
      readonly: field.readonly,
      id: `dph-schema-${field.key}`,
      name: field.key,
      errors,
      invalid: errors.length > 0,
    };
  }

  protected checkboxConfigFor(field: SchemaField): CheckboxFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label,
      hint: field.hint,
      required: field.required,
      disabled: field.disabled,
      readonly: field.readonly,
      id: `dph-schema-${field.key}`,
      name: field.key,
      errors,
      invalid: errors.length > 0,
    };
  }

  protected switchConfigFor(field: SchemaField): SwitchFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label,
      hint: field.hint,
      required: field.required,
      disabled: field.disabled,
      readonly: field.readonly,
      id: `dph-schema-${field.key}`,
      name: field.key,
      errors,
      invalid: errors.length > 0,
    };
  }

  protected dateConfigFor(field: SchemaField, kind: 'date' | 'datetime' | 'time'): DatePickerFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      kind,
      label: field.label,
      placeholder: field.placeholder,
      hint: field.hint,
      required: field.required,
      disabled: field.disabled,
      readonly: field.readonly,
      clearable: field.clearable ?? !field.required,
      inlineCalendar: field.inlineCalendar,
      minDate: field.minDate,
      maxDate: field.maxDate,
      disabledDates: field.disabledDates,
      showSeconds: field.showSeconds,
      hourFormat: field.hourFormat,
      id: `dph-schema-${field.key}`,
      name: field.key,
      errors,
      invalid: errors.length > 0,
    };
  }

  protected fileConfigFor(field: SchemaField): FileUploadConfig {
    return {
      variant: field.fileVariant ?? 'dropzone',
      accept: field.accept,
      multiple: field.multiple ?? false,
      autoUpload: false,
      showPreview: true,
      showFileList: true,
      disabled: field.disabled,
      label: field.label,
      hint: field.hint,
    };
  }

  /**
   * Shared helper — pulls error strings + ticks the form-state signal so
   * every config helper above re-evaluates on each form-state change.
   */
  private fieldErrors(field: SchemaField): readonly string[] {
    this._formStateTick();
    const ctrl = this.form().controls[field.key];
    return this.errorsFor(field, ctrl);
  }

  protected inputConfigFor(field: SchemaField): {
    /**
     * Narrowed to the primitive set `dph-input` accepts. Only the @default
     * branch of the schema-form @switch reaches this helper, so the field
     * type is guaranteed to be one of these eight values.
     */
    type: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search' | 'textarea' | 'number';
    label: string;
    placeholder?: string;
    hint?: string;
    prefixIcon?: string;
    suffixIcon?: string;
    rows?: number;
    autocomplete?: string;
    maxLength?: number;
    required?: boolean;
    readonly?: boolean;
    disabled?: boolean;
    clearable?: boolean;
    id: string;
    name: string;
    errors: readonly string[];
    invalid: boolean;
  } {
    // Touch the tick signal so the template re-evaluates when controls change.
    this._formStateTick();
    const ctrl = this.form().controls[field.key];
    const errors = this.errorsFor(field, ctrl);
    return {
      type: field.type as 'text' | 'email' | 'password' | 'tel' | 'url' | 'search' | 'textarea' | 'number',
      label: field.label,
      placeholder: field.placeholder,
      hint: field.hint,
      prefixIcon: field.prefixIcon,
      suffixIcon: field.suffixIcon,
      rows: field.rows,
      autocomplete: field.autocomplete,
      maxLength: field.maxLength,
      required: field.required,
      readonly: field.readonly,
      disabled: field.disabled,
      clearable: field.clearable ?? false,
      id: `dph-schema-${field.key}`,
      name: field.key,
      errors,
      invalid: errors.length > 0,
    };
  }

  // ── Submit ────────────────────────────────────────────────────────────

  protected onSubmit(): void {
    this.submitAttempted.set(true);
    this._formStateTick.update((n) => n + 1);
    const form = this.form();
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    if (this.submitting()) return;
    if (this.submitDisabled()) return;
    const value = this.cleanedValue();
    this.submit.emit(value);
    this.onEvent.emit({ type: 'form:submit', value });
  }

  protected onCancel(): void {
    this.cancel.emit();
    this.onEvent.emit({ type: 'form:cancel' });
  }

  /**
   * Programmatically reset the form back to its initial seeded values.
   * Emits `form:reset` on the event channel for hosts that need to react.
   */
  reset(): void {
    const init = this.initialValue();
    const next: Record<string, unknown> = {};
    for (const field of this.schema().fields) {
      next[field.key] = init?.[field.key] ?? field.defaultValue ?? defaultValueFor(field);
    }
    this.form().reset(next, { emitEvent: false });
    this.submitAttempted.set(false);
    this._formStateTick.set(0);
    this.onEvent.emit({ type: 'form:reset' });
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private cleanedValue(): Record<string, unknown> {
    const raw = this.form().getRawValue() as Record<string, unknown>;
    const trimDefault = this.schema().trim ?? true;
    const out: Record<string, unknown> = {};
    for (const field of this.schema().fields) {
      const v = raw[field.key];
      if (typeof v === 'string') {
        const trimEnabled = field.trim ?? trimDefault;
        const trimmed = trimEnabled ? v.trim() : v;
        out[field.key] = field.nullIfEmpty && trimmed === '' ? null : trimmed;
      } else {
        out[field.key] = v;
      }
    }
    return out;
  }

  private errorsFor(field: SchemaField, ctrl: AbstractControl | undefined): readonly string[] {
    if (!ctrl) return [];
    const showLocal =
      this.submitAttempted() || ctrl.touched || ctrl.dirty;

    const messages: string[] = [];

    // 1. Local validators (only after touch / dirty / submit-attempt)
    if (showLocal && ctrl.errors) {
      const validators = field.validators ?? {};
      if (ctrl.errors['required']) {
        messages.push(specMessage(validators.required, `${field.label} is required.`));
      }
      if (ctrl.errors['email']) {
        messages.push(specMessage(validators.email, 'Enter a valid email address.'));
      }
      if (ctrl.errors['minlength']) {
        const min = ctrl.errors['minlength'].requiredLength as number;
        messages.push(specMessage(validators.minLength, `Minimum ${min} characters.`));
      }
      if (ctrl.errors['maxlength']) {
        const max = ctrl.errors['maxlength'].requiredLength as number;
        messages.push(specMessage(validators.maxLength, `Maximum ${max} characters.`));
      }
      if (ctrl.errors['pattern']) {
        messages.push(specMessage(validators.pattern, `${field.label} format is invalid.`));
      }
      if (ctrl.errors['min']) {
        const min = ctrl.errors['min'].min as number;
        messages.push(specMessage(validators.min, `Must be at least ${min}.`));
      }
      if (ctrl.errors['max']) {
        const max = ctrl.errors['max'].max as number;
        messages.push(specMessage(validators.max, `Must be at most ${max}.`));
      }
      if (ctrl.errors['minSelected']) {
        const min = ctrl.errors['minSelected'].requiredLength as number;
        messages.push(specMessage(validators.minSelected, `Select at least ${min}.`));
      }
      if (ctrl.errors['maxSelected']) {
        const max = ctrl.errors['maxSelected'].requiredLength as number;
        messages.push(specMessage(validators.maxSelected, `Select at most ${max}.`));
      }
    }

    // 2. Server-side errors (always visible — the user already submitted)
    const apiErr = this.apiError();
    if (apiErr) {
      // Conflict (409) on a specific field — host-supplied message takes priority.
      const conflictMsg = this.conflictMessage();
      const conflictField = this.conflictField() ?? defaultConflictField(this.schema());
      if (apiErr.statusCode === 409 && conflictMsg && conflictField === field.key) {
        messages.push(conflictMsg);
      }

      const fieldMsg = serverFieldMessage(apiErr, field, this.serverErrorIndex());
      if (fieldMsg) messages.push(fieldMsg);

      // Per-field statusErrorMessages override — host can pre-declare them.
      const statusOverride = field.statusErrorMessages?.[apiErr.statusCode];
      if (statusOverride && messages.indexOf(statusOverride) === -1) {
        messages.push(statusOverride);
      }
    }

    return messages;
  }
}

// ── Pure helpers ───────────────────────────────────────────────────────

function buildFormGroup(fb: FormBuilder, schema: FormSchema): FormGroup {
  const controls: Record<string, [unknown, ValidatorFn[]]> = {};
  for (const field of schema.fields) {
    const validators = collectValidators(field);
    controls[field.key] = [field.defaultValue ?? defaultValueFor(field), validators];
  }
  return fb.nonNullable.group(controls) as FormGroup;
}

function defaultValueFor(field: SchemaField): unknown {
  switch (field.type) {
    case 'number':              return null;
    case 'checkbox':            return false;
    case 'switch':              return false;
    case 'multiselect':         return [];
    case 'select':              return null;
    case 'radio':               return null;
    case 'date':                return null;
    case 'datetime':            return null;
    case 'time':                return null;
    case 'file':                return [];
    default:                    return '';
  }
}

function collectValidators(field: SchemaField): ValidatorFn[] {
  const out: ValidatorFn[] = [];
  const v = field.validators ?? {};
  if (field.required || v.required) {
    // checkbox required = must be true (terms-of-service style); other types
    // use the standard "value must be present" required.
    if (field.type === 'checkbox' && (v.mustBeTrue ?? field.required)) {
      out.push(Validators.requiredTrue);
    } else {
      out.push(Validators.required);
    }
  }
  if (v.email || field.type === 'email') out.push(Validators.email);
  const minLen = unwrapValue(v.minLength) ?? field.minLength;
  if (minLen !== undefined) out.push(Validators.minLength(minLen));
  const maxLen = unwrapValue(v.maxLength) ?? field.maxLength;
  if (maxLen !== undefined) out.push(Validators.maxLength(maxLen));
  const pattern = unwrapValue(v.pattern);
  if (pattern !== undefined) out.push(Validators.pattern(pattern));
  const min = unwrapValue(v.min);
  if (min !== undefined) out.push(Validators.min(min));
  const max = unwrapValue(v.max);
  if (max !== undefined) out.push(Validators.max(max));

  // Multiselect cardinality validators — bespoke since Validators.minLength
  // counts string chars, not array length.
  const minSel = unwrapValue(v.minSelected);
  if (minSel !== undefined) out.push(minSelectedValidator(minSel));
  const maxSel = unwrapValue(v.maxSelected);
  if (maxSel !== undefined) out.push(maxSelectedValidator(maxSel));

  return out;
}

function minSelectedValidator(min: number): ValidatorFn {
  return (control) => {
    const value = control.value;
    const length = Array.isArray(value) ? value.length : 0;
    return length >= min ? null : { minSelected: { requiredLength: min, actualLength: length } };
  };
}

function maxSelectedValidator(max: number): ValidatorFn {
  return (control) => {
    const value = control.value;
    const length = Array.isArray(value) ? value.length : 0;
    return length <= max ? null : { maxSelected: { requiredLength: max, actualLength: length } };
  };
}

function unwrapValue<T>(spec: T | { value: T; message: string } | undefined): T | undefined {
  if (spec === undefined) return undefined;
  if (typeof spec === 'object' && spec !== null && 'value' in spec) {
    return (spec as { value: T }).value;
  }
  return spec as T;
}

function specMessage(
  spec:
    | boolean
    | string
    | number
    | RegExp
    | { value: unknown; message: string }
    | undefined,
  fallback: string,
): string {
  if (spec === undefined || spec === null) return fallback;
  if (typeof spec === 'string') return spec;
  if (typeof spec === 'object' && 'message' in (spec as object)) {
    return (spec as { message: string }).message;
  }
  return fallback;
}

function defaultConflictField(schema: FormSchema): string | null {
  return schema.fields.find((f) => f.key === 'email')?.key ?? null;
}

function serverFieldMessage(
  err: ApiError,
  field: SchemaField,
  index: Readonly<Record<string, string>>,
): string | null {
  if (!err.errors) return null;
  // Try the field's own key (lowercase) and any aliases via the index.
  const candidates: string[] = [field.key, ...(field.serverErrorKeys ?? [])];
  for (const cand of candidates) {
    const direct = err.errors[cand];
    if (direct?.[0]) return direct[0];
    const titlecased = err.errors[cand.charAt(0).toUpperCase() + cand.slice(1)];
    if (titlecased?.[0]) return titlecased[0];
  }
  // Fall back to the index — if the API returned `Email` and our field is `email`.
  for (const apiKey of Object.keys(err.errors)) {
    if (index[apiKey.toLowerCase()] === field.key) {
      const messages = err.errors[apiKey];
      if (messages?.[0]) return messages[0];
    }
  }
  return null;
}
