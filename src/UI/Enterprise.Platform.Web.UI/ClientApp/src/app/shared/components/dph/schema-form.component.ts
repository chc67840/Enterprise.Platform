/**
 * ─── DPH UI KIT — SCHEMA-DRIVEN FORM ────────────────────────────────────────────
 *
 * Renders a form from a declarative `FormSchema<T>`. One source of truth, eight
 * concerns handled:
 *   1. FormGroup construction (controls + validators) from the resolved
 *      field list — works equally for legacy `fields[]`, the new flat
 *      `items[]`, or a structured `layout` (sections / tabs / wizard).
 *   2. Field rendering — single `@switch` dispatcher routes each field type
 *      to the right DPH renderer (15 discriminated variants).
 *   3. Display-widget rendering (Phase B) — message / chart / image /
 *      divider / heading / spacer items embedded between fields.
 *   4. Layout variants (Phase C) — `sections` (collapsible panels), `tabs`
 *      (PrimeNG Tabs), `wizard` (Steps + WizardButtons + per-step gating).
 *   5. Conditional rendering — every item / step honours an optional
 *      `when?: (ctx) => boolean` predicate; `false` removes the control
 *      from the FormGroup until the predicate flips.
 *   6. Cross-field validation — `crossFieldValidators[]` runs at FormGroup
 *      level and decorates targeted fields with the rule's error.
 *   7. Action bar — declarative buttons emit `action:click` on the channel.
 *   8. Server-side validation mapping (RFC 7807 `errors[key]` → field UI),
 *      with case-insensitive key match.
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
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  type AsyncValidatorFn,
  type ValidatorFn,
} from '@angular/forms';
import { TabsModule } from 'primeng/tabs';

import type { ApiError } from '@core/models';

import { AutocompleteComponent, type AutocompleteFieldConfig } from './autocomplete.component';
import { ButtonComponent } from './button.component';
import { ChartWidgetComponent } from './chart-widget.component';
import { CheckboxComponent, type CheckboxFieldConfig } from './checkbox.component';
import { ColorComponent, type ColorFieldConfig } from './color.component';
import { CurrencyComponent, type CurrencyFieldConfig } from './currency.component';
import { DatePickerComponent, type DatePickerFieldConfig } from './date-picker.component';
import { FileUploadComponent } from './file-upload.component';
import { FormLayoutComponent } from './form-layout.component';
import { ImageComponent } from './image.component';
import { InlineMessageComponent } from './inline-message.component';
import { InputComponent } from './input.component';
import { MaskComponent, type MaskFieldConfig } from './mask.component';
import { MultiSelectComponent, type MultiSelectFieldConfig } from './multi-select.component';
import { PanelComponent } from './panel.component';
import { RadioGroupComponent, type RadioGroupFieldConfig } from './radio-group.component';
import { RangeComponent, type RangeFieldConfig, type RangeValue } from './range.component';
import { SelectComponent, type SelectFieldConfig } from './select.component';
import { StepsComponent } from './steps.component';
import { SwitchComponent, type SwitchFieldConfig } from './switch.component';
import { TablePickerComponent, type TablePickerFieldConfig } from './table-picker.component';
import { TreeSelectComponent, type TreeSelectFieldConfig } from './tree-select.component';
import { WizardButtonsComponent } from './wizard-buttons.component';

import type {
  FileItem,
  FileUploadConfig,
  InlineMessageConfig,
  PanelConfig,
  StepDescriptor,
  StepsConfig,
  WizardButtonsConfig,
} from './dph.types';
import {
  isSchemaField,
  isSchemaWidget,
  isSectionsLayout,
  isTabsLayout,
  isWizardLayout,
  type AutocompleteField,
  type CheckboxField,
  type ColorField,
  type CrossFieldRule,
  type CurrencyField,
  type DateField,
  type FileField,
  type FormSchema,
  type FormSchemaSection,
  type FormSchemaStep,
  type FormSchemaTab,
  type MaskField,
  type MultiSelectField,
  type RadioField,
  type RangeField,
  type SchemaActionDescriptor,
  type SchemaField,
  type SchemaFormEvent,
  type SchemaItem,
  type SchemaWhenContext,
  type SchemaWidgetMessage,
  type SelectField,
  type SwitchField,
  type TablePickerField,
  type TextLikeField,
  type TreeSelectField,
} from './schema-form.types';
import {
  collectFields,
  collectItems,
  defaultConflictField,
  defaultValueFor,
  collectValidators,
  evalWhen,
  itemTrackKey,
  serverFieldMessage,
  specMessage,
  unwrapValue,
} from './schema-form.helpers';

type LayoutKind = 'flat' | 'sections' | 'tabs' | 'wizard';

@Component({
  selector: 'dph-schema-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TabsModule,
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
    TreeSelectComponent,
    TablePickerComponent,
    AutocompleteComponent,
    CurrencyComponent,
    MaskComponent,
    ColorComponent,
    RangeComponent,
    InlineMessageComponent,
    ChartWidgetComponent,
    ImageComponent,
    PanelComponent,
    StepsComponent,
    WizardButtonsComponent,
  ],
  template: `
    <form
      #formRoot
      [formGroup]="form()"
      (ngSubmit)="onSubmit()"
      novalidate
      autocomplete="off"
      class="dph-schema-form"
      [attr.data-layout]="layoutKind()"
    >
      @switch (layoutKind()) {
        @case ('flat') {
          <dph-form-layout
            [config]="{
              variant: 'grid',
              columns: schema().columns ?? 1,
              gap: schema().gap ?? 'md',
            }"
          >
            @for (item of resolvedItems(); track itemKey(item)) {
              <ng-container *ngTemplateOutlet="itemTpl; context: { $implicit: item }" />
            }
            <ng-container slot="actions">
              <ng-container *ngTemplateOutlet="actionsTpl" />
            </ng-container>
          </dph-form-layout>
        }

        @case ('sections') {
          <div class="dph-schema-form__sections">
            @for (sec of visibleSections(); track sec.id) {
              <dph-panel
                [config]="sectionPanelConfig(sec)"
                (collapsedChange)="onSectionToggle(sec.id, !$event)"
              >
                <dph-form-layout
                  [config]="{
                    variant: 'grid',
                    columns: sec.columns ?? schema().columns ?? 1,
                    gap: schema().gap ?? 'md',
                  }"
                >
                  @for (item of visibleItems(sec.items); track itemKey(item)) {
                    <ng-container *ngTemplateOutlet="itemTpl; context: { $implicit: item }" />
                  }
                </dph-form-layout>
              </dph-panel>
            }
          </div>
          <ng-container *ngTemplateOutlet="actionsTpl" />
        }

        @case ('tabs') {
          <p-tabs
            [value]="activeTabId()"
            (valueChange)="onTabChange($any($event))"
            class="dph-schema-form__tabs"
          >
            <p-tablist>
              @for (t of visibleTabs(); track t.id) {
                <p-tab [value]="t.id" [disabled]="!!t.disabled">
                  @if (t.icon) { <i [class]="t.icon" class="mr-2" aria-hidden="true"></i> }
                  {{ t.label }}
                  @if (t.badge) {
                    <span
                      class="dph-schema-form__tab-badge"
                      [attr.data-severity]="t.badge.severity || 'neutral'"
                    >{{ t.badge.value }}</span>
                  }
                </p-tab>
              }
            </p-tablist>
            <p-tabpanels>
              @for (t of visibleTabs(); track t.id) {
                <p-tabpanel [value]="t.id">
                  <dph-form-layout
                    [config]="{
                      variant: 'grid',
                      columns: schema().columns ?? 1,
                      gap: schema().gap ?? 'md',
                    }"
                  >
                    @for (item of visibleItems(t.items); track itemKey(item)) {
                      <ng-container *ngTemplateOutlet="itemTpl; context: { $implicit: item }" />
                    }
                  </dph-form-layout>
                </p-tabpanel>
              }
            </p-tabpanels>
          </p-tabs>
          <ng-container *ngTemplateOutlet="actionsTpl" />
        }

        @case ('wizard') {
          <dph-steps
            [config]="stepsConfig()"
            (stepClick)="onStepStripClick($any($event))"
            class="dph-schema-form__steps"
          />
          @if (activeStep(); as step) {
            <dph-form-layout
              [config]="{
                variant: 'grid',
                columns: schema().columns ?? 1,
                gap: schema().gap ?? 'md',
              }"
            >
              @for (item of visibleItems(step.items); track itemKey(item)) {
                <ng-container *ngTemplateOutlet="itemTpl; context: { $implicit: item }" />
              }
            </dph-form-layout>
          }
          <dph-wizard-buttons
            [config]="wizardButtonsConfig()"
            (back)="onWizardBack()"
            (next)="onWizardNext()"
            (finish)="onWizardFinish()"
            (cancel)="onWizardCancel()"
            (skip)="onWizardSkip()"
          />
        }
      }
    </form>

    <!-- ────────────────────────────────────────────────────────────────
         Item template — renders ONE field or widget. Shared across layouts.
         ────────────────────────────────────────────────────────────── -->
    <ng-template #itemTpl let-item>
      @if (isWidgetItem(item)) {
        <div
          class="dph-schema-form__widget"
          [attr.data-span]="spanForItem(item)"
          [attr.data-widget]="$any(item).kind"
        >
          @switch ($any(item).kind) {
            @case ('message') {
              <dph-inline-message [config]="messageConfig($any(item))" />
            }
            @case ('chart') {
              <dph-chart-widget [config]="$any(item).config" />
            }
            @case ('image') {
              <dph-image [config]="$any(item).config" />
            }
            @case ('divider') {
              <div class="dph-schema-form__divider" [attr.data-orientation]="$any(item).orientation || 'horizontal'">
                @if ($any(item).orientation !== 'vertical') {
                  @if ($any(item).label) {
                    <span class="dph-schema-form__divider-label">{{ $any(item).label }}</span>
                  } @else {
                    <hr class="dph-schema-form__divider-line" />
                  }
                }
              </div>
            }
            @case ('heading') {
              <div class="dph-schema-form__heading" [attr.data-level]="$any(item).level || 2">
                @if ($any(item).icon) {
                  <i [class]="$any(item).icon" class="dph-schema-form__heading-icon" aria-hidden="true"></i>
                }
                <div class="dph-schema-form__heading-text">
                  <strong [attr.role]="'heading'" [attr.aria-level]="$any(item).level || 2">{{ $any(item).text }}</strong>
                  @if ($any(item).subtitle) {
                    <span class="dph-schema-form__heading-subtitle">{{ $any(item).subtitle }}</span>
                  }
                </div>
              </div>
            }
            @case ('spacer') {
              <div class="dph-schema-form__spacer" [attr.data-size]="$any(item).size || 'md'" aria-hidden="true"></div>
            }
          }
        </div>
      } @else {
        <div
          class="dph-schema-form__field"
          [attr.data-span]="spanForItem(item)"
          [attr.data-type]="$any(item).type"
          [attr.data-field-key]="$any(item).key"
        >
          @switch ($any(item).type) {
            @case ('select') {
              <dph-select
                [config]="selectConfigFor($any(item))"
                [value]="valueFor($any(item).key)"
                (valueChange)="onFieldChange($any(item).key, $event)"
                (blur)="onFieldBlur($any(item).key)"
              />
            }
            @case ('multiselect') {
              <dph-multi-select
                [config]="multiSelectConfigFor($any(item))"
                [value]="multiValueFor($any(item).key)"
                (valueChange)="onFieldChange($any(item).key, $event)"
                (blur)="onFieldBlur($any(item).key)"
              />
            }
            @case ('radio') {
              <dph-radio-group
                [config]="radioConfigFor($any(item))"
                [value]="valueFor($any(item).key)"
                (valueChange)="onValueChangeAndBlur($any(item).key, $event)"
              />
            }
            @case ('checkbox') {
              <dph-checkbox
                [config]="checkboxConfigFor($any(item))"
                [value]="booleanValueFor($any(item).key)"
                (valueChange)="onValueChangeAndBlur($any(item).key, $event)"
              />
            }
            @case ('switch') {
              <dph-switch
                [config]="switchConfigFor($any(item))"
                [value]="booleanValueFor($any(item).key)"
                (valueChange)="onValueChangeAndBlur($any(item).key, $event)"
              />
            }
            @case ('date') {
              <dph-date-picker
                [config]="dateConfigFor($any(item), 'date')"
                [value]="dateValueFor($any(item).key)"
                (valueChange)="onFieldChange($any(item).key, $event)"
                (blur)="onFieldBlur($any(item).key)"
              />
            }
            @case ('datetime') {
              <dph-date-picker
                [config]="dateConfigFor($any(item), 'datetime')"
                [value]="dateValueFor($any(item).key)"
                (valueChange)="onFieldChange($any(item).key, $event)"
                (blur)="onFieldBlur($any(item).key)"
              />
            }
            @case ('time') {
              <dph-date-picker
                [config]="dateConfigFor($any(item), 'time')"
                [value]="dateValueFor($any(item).key)"
                (valueChange)="onFieldChange($any(item).key, $event)"
                (blur)="onFieldBlur($any(item).key)"
              />
            }
            @case ('file') {
              <dph-file-upload
                [config]="fileConfigFor($any(item))"
                [files]="fileValueFor($any(item).key)"
                (filesChange)="onValueChangeAndBlur($any(item).key, $event)"
              />
            }
            @case ('tree-select') {
              <dph-tree-select
                [config]="treeSelectConfigFor($any(item))"
                [value]="treeValueFor($any(item).key)"
                (valueChange)="onValueChangeAndBlur($any(item).key, $event)"
              />
            }
            @case ('table-picker') {
              <dph-table-picker
                [config]="tablePickerConfigFor($any(item))"
                [value]="valueFor($any(item).key)"
                (valueChange)="onValueChangeAndBlur($any(item).key, $event)"
              />
            }
            @case ('autocomplete') {
              <dph-autocomplete
                [config]="autocompleteConfigFor($any(item))"
                [value]="valueFor($any(item).key)"
                (valueChange)="onFieldChange($any(item).key, $event)"
                (blur)="onFieldBlur($any(item).key)"
              />
            }
            @case ('currency') {
              <dph-currency
                [config]="currencyConfigFor($any(item))"
                [value]="numberValueFor($any(item).key)"
                (valueChange)="onFieldChange($any(item).key, $event)"
                (blur)="onFieldBlur($any(item).key)"
              />
            }
            @case ('mask') {
              <dph-mask
                [config]="maskConfigFor($any(item))"
                [value]="stringValueFor($any(item).key)"
                (valueChange)="onFieldChange($any(item).key, $event)"
                (blur)="onFieldBlur($any(item).key)"
              />
            }
            @case ('color') {
              <dph-color
                [config]="colorConfigFor($any(item))"
                [value]="stringValueFor($any(item).key)"
                (valueChange)="onValueChangeAndBlur($any(item).key, $event)"
              />
            }
            @case ('range') {
              <dph-range
                [config]="rangeConfigFor($any(item))"
                [value]="rangeValueFor($any(item).key)"
                (valueChange)="onValueChangeAndBlur($any(item).key, $event)"
              />
            }
            @default {
              <dph-input
                [config]="inputConfigFor($any(item))"
                [value]="valueFor($any(item).key)"
                (valueChange)="onFieldChange($any(item).key, $event)"
                (blur)="onFieldBlur($any(item).key)"
              />
            }
          }
        </div>
      }
    </ng-template>

    <!-- ────────────────────────────────────────────────────────────────
         Submit / cancel + custom action-bar buttons.
         ────────────────────────────────────────────────────────────── -->
    <ng-template #actionsTpl>
      @if (showActions() && layoutKind() !== 'wizard') {
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
          @for (action of customActions(); track action.key) {
            <dph-button
              [variant]="action.variant || 'secondary'"
              size="md"
              type="button"
              [icon]="action.icon || ''"
              [disabled]="!!action.disabled || submitting()"
              [loading]="!!action.loading"
              [label]="action.label"
              (clicked)="onActionClick(action.key)"
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
    </ng-template>
  `,
  styleUrl: './schema-form.component.scss',
})
export class SchemaFormComponent<T = Record<string, unknown>> {
  // ── Inputs ────────────────────────────────────────────────────────────
  readonly schema = input.required<FormSchema<T>>();
  readonly initialValue = input<Readonly<Partial<T>> | null>(null);
  readonly apiError = input<ApiError | null>(null);
  readonly submitting = input<boolean>(false);
  readonly submitLabel = input<string>('Save');
  readonly cancelLabel = input<string>('Cancel');
  readonly showActions = input<boolean>(true);
  readonly showCancel = input<boolean>(true);
  readonly conflictMessage = input<string | null>(null);
  readonly conflictField = input<string | null>(null);

  // ── Outputs ───────────────────────────────────────────────────────────
  readonly submit = output<T>();
  readonly cancel = output<void>();
  readonly valueChange = output<T>();
  readonly onEvent = output<SchemaFormEvent<T>>();

  // ── Internals ─────────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly formRoot = viewChild<ElementRef<HTMLFormElement>>('formRoot');

  /** Resolved field-only view of the schema. */
  protected readonly resolvedFields = computed<readonly SchemaField[]>(
    () => collectFields(this.schema() as FormSchema),
  );

  /** Flat document-order view that includes widgets — used by the renderer. */
  protected readonly resolvedItems = computed<readonly SchemaItem[]>(
    () => collectItems(this.schema() as FormSchema),
  );

  /** Layout shape — drives template @switch. */
  protected readonly layoutKind = computed<LayoutKind>(() => {
    const layout = this.schema().layout;
    if (!layout) return 'flat';
    if (isSectionsLayout(layout)) return 'sections';
    if (isTabsLayout(layout)) return 'tabs';
    if (isWizardLayout(layout)) return 'wizard';
    return 'flat';
  });

  protected readonly sections = computed<readonly FormSchemaSection[]>(() => {
    const l = this.schema().layout;
    return l && isSectionsLayout(l) ? (l.sections as readonly FormSchemaSection[]) : [];
  });

  protected readonly tabs = computed<readonly FormSchemaTab[]>(() => {
    const l = this.schema().layout;
    return l && isTabsLayout(l) ? (l.tabs as readonly FormSchemaTab[]) : [];
  });

  protected readonly steps = computed<readonly FormSchemaStep[]>(() => {
    const l = this.schema().layout;
    return l && isWizardLayout(l) ? (l.steps as readonly FormSchemaStep[]) : [];
  });

  /**
   * The FormGroup is rebuilt whenever the schema reference changes. A
   * second effect (below) reconciles controls when conditional `when`
   * predicates flip — adding / removing controls live without rebuilding.
   */
  protected readonly form = computed<FormGroup>(() =>
    buildFormGroup(this.fb, this.resolvedFields(), this.schema().crossFieldValidators),
  );

  /** Form-state tick — bumped on every value change. Scope: fine-grained re-eval. */
  private readonly _formStateTick = signal(0);

  protected readonly submitAttempted = signal(false);
  protected readonly activeTabId = signal<string | number | undefined>(undefined);
  protected readonly activeStepIdx = signal<number>(0);
  protected readonly collapsedSections = signal<ReadonlyMap<string, boolean>>(new Map());

  /** Action-bar action state — keyed by action.key, set by `setActionLoading`. */
  protected readonly actionLoading = signal<ReadonlyMap<string, boolean>>(new Map());

  // ── Effects ───────────────────────────────────────────────────────────

  private readonly _seedValuesEffect = effect(() => {
    const init = this.initialValue();
    const schema = this.schema();
    const form = this.form();
    untracked(() => {
      const next: Record<string, unknown> = {};
      for (const field of this.resolvedFields()) {
        next[field.key] =
          (init as Readonly<Record<string, unknown>> | null)?.[field.key] ??
          (field as { defaultValue?: unknown }).defaultValue ??
          defaultValueFor(field);
      }
      form.reset(next, { emitEvent: false });
      this.submitAttempted.set(false);
      this._formStateTick.set(0);

      const layout = schema.layout;
      if (layout) {
        if (isTabsLayout(layout)) {
          const firstEnabled = layout.tabs.find((t) => !t.disabled);
          this.activeTabId.set(layout.defaultTabId ?? firstEnabled?.id);
        }
        if (isWizardLayout(layout)) {
          this.activeStepIdx.set(layout.initialStep ?? 0);
        }
        if (isSectionsLayout(layout)) {
          const m = new Map<string, boolean>();
          for (const sec of layout.sections) {
            if (sec.collapsible && sec.defaultCollapsed) m.set(sec.id, true);
          }
          this.collapsedSections.set(m);
        }
      }
    });
  });

  /**
   * Reconcile FormGroup controls against `when` predicates. Hidden fields
   * are removed from the FormGroup so they don't block submit; reappearing
   * fields are re-added with their default value. Runs on every value tick.
   */
  private readonly _reconcileConditionalControls = effect(() => {
    this._formStateTick();
    const form = this.form();
    untracked(() => {
      const ctx = this.whenContext();
      for (const field of this.resolvedFields()) {
        const visible = evalWhen(field.when, ctx);
        const has = form.controls[field.key] !== undefined;
        if (visible && !has) {
          const seedRaw = (this.initialValue() as Readonly<Record<string, unknown>> | null)?.[field.key];
          const seed = seedRaw ?? (field as { defaultValue?: unknown }).defaultValue ?? defaultValueFor(field);
          const validators = collectValidators(field);
          form.addControl(
            field.key,
            this.fb.control(seed, { validators: validators.sync, asyncValidators: validators.async }),
            { emitEvent: false },
          );
        } else if (!visible && has) {
          form.removeControl(field.key, { emitEvent: false });
        }
      }
    });
  });

  /** Subscribe to value changes — emits `(valueChange)` + `form:patch`. */
  private readonly _trackValueChanges = effect((onCleanup) => {
    const form = this.form();
    const sub = form.valueChanges.subscribe(() => {
      this._formStateTick.update((n) => n + 1);
      const raw = form.getRawValue() as T;
      this.valueChange.emit(raw);
      this.onEvent.emit({ type: 'form:patch', value$: raw });
    });
    onCleanup(() => sub.unsubscribe());
  });

  // ── Visibility filtering ─────────────────────────────────────────────

  protected whenContext(): SchemaWhenContext<Record<string, unknown>> {
    const form = this.form();
    return {
      value$: form.getRawValue() as Record<string, unknown>,
      dirty: form.dirty,
      touched: form.touched,
    };
  }

  protected visibleSections = computed<readonly FormSchemaSection[]>(() => {
    this._formStateTick();
    const ctx = this.whenContext();
    return this.sections().filter((s) => evalWhen(s.when, ctx));
  });

  protected visibleTabs = computed<readonly FormSchemaTab[]>(() => {
    this._formStateTick();
    const ctx = this.whenContext();
    return this.tabs().filter((t) => evalWhen(t.when, ctx));
  });

  protected visibleSteps = computed<readonly FormSchemaStep[]>(() => {
    this._formStateTick();
    const ctx = this.whenContext();
    return this.steps().filter((s) => evalWhen(s.when, ctx));
  });

  protected visibleItems(items: readonly SchemaItem[]): readonly SchemaItem[] {
    this._formStateTick();
    const ctx = this.whenContext();
    return items.filter((i) => evalWhen(i.when, ctx));
  }

  // ── Computed view-model ───────────────────────────────────────────────

  protected readonly submitDisabled = computed<boolean>(() => {
    if (this.submitting()) return true;
    if (!this.schema().disableSubmitWhenPristine) return false;
    this._formStateTick();
    return this.form().pristine;
  });

  protected readonly serverErrorIndex = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const field of this.resolvedFields()) {
      out[field.key.toLowerCase()] = field.key;
      for (const alt of field.serverErrorKeys ?? []) {
        out[alt.toLowerCase()] = field.key;
      }
    }
    return out;
  });

  protected readonly customActions = computed<readonly SchemaActionDescriptor[]>(() => {
    this._formStateTick();
    const list = this.schema().actions ?? [];
    if (!list.length) return [];
    const loading = this.actionLoading();
    const invalid = !this.form().valid;
    return list
      .filter((a) => !(a.hideOnInvalid && invalid))
      .map((a) => (loading.get(a.key) ? { ...a, loading: true } : a));
  });

  protected readonly activeStep = computed<FormSchemaStep | null>(() => {
    const all = this.visibleSteps();
    if (!all.length) return null;
    const idx = Math.max(0, Math.min(this.activeStepIdx(), all.length - 1));
    return all[idx] ?? null;
  });

  protected readonly stepsConfig = computed<StepsConfig>(() => {
    const layout = this.schema().layout;
    const wizardLayout = layout && isWizardLayout(layout) ? layout : null;
    const stepsList = this.visibleSteps();

    this._formStateTick();
    const stepDescriptors: StepDescriptor[] = stepsList.map((s, i) => {
      const errs = this.errorCountForStep(s);
      const state = errs > 0 && this.submitAttempted()
        ? 'error'
        : i < this.activeStepIdx()
          ? 'complete'
          : i === this.activeStepIdx()
            ? 'active'
            : 'pending';
      return {
        key: s.key,
        label: s.label,
        description: s.description,
        icon: s.icon,
        help: s.help,
        optional: s.optional,
        errorCount: errs,
        state,
      };
    });

    return {
      steps: stepDescriptors,
      activeIndex: this.activeStepIdx(),
      variant: wizardLayout?.variant ?? 'horizontal',
      orientation: wizardLayout?.orientation ?? 'horizontal',
      allowFreeNav: wizardLayout?.allowBackNav ?? true,
      showLabels: true,
      showProgress: true,
    };
  });

  protected readonly wizardButtonsConfig = computed<WizardButtonsConfig>(() => {
    const layout = this.schema().layout;
    const override = layout && isWizardLayout(layout) ? layout.buttons : undefined;
    const idx = this.activeStepIdx();
    const total = this.visibleSteps().length;
    const step = this.activeStep();
    return {
      ...override,
      isFirst: idx === 0,
      isLast: idx >= total - 1,
      canSkip: !!step?.optional,
      nextLoading: this.submitting() && idx >= total - 1,
    };
  });

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Programmatically focus the first interactive control. Generalised for
   * Phase D — queries the form root for any focusable element rather than
   * relying on a `dph-input` template ref.
   */
  focusFirst(): void {
    queueMicrotask(() => {
      const root = this.formRoot()?.nativeElement;
      const sel =
        'input:not([type=hidden]):not([disabled]),' +
        'textarea:not([disabled]),' +
        'select:not([disabled]),' +
        '[tabindex]:not([tabindex="-1"])';
      const el = root?.querySelector(sel) as HTMLElement | null;
      el?.focus();
    });
  }

  /** Focus the first invalid field after a failed submit. WCAG-friendly default. */
  focusFirstError(): void {
    queueMicrotask(() => {
      const root = this.formRoot()?.nativeElement;
      const el = root?.querySelector('[aria-invalid="true"]') as HTMLElement | null;
      const focusable = el?.querySelector?.('input,textarea,select') as HTMLElement | null;
      (focusable ?? el)?.focus?.();
    });
  }

  markPristine(): void {
    this.form().markAsPristine();
    this._formStateTick.update((n) => n + 1);
  }

  resubmit(): void {
    if (this.form().valid) this.submit.emit(this.cleanedValue());
  }

  reset(): void {
    const init = this.initialValue() as Readonly<Record<string, unknown>> | null;
    const next: Record<string, unknown> = {};
    for (const field of this.resolvedFields()) {
      next[field.key] = init?.[field.key] ?? (field as { defaultValue?: unknown }).defaultValue ?? defaultValueFor(field);
    }
    this.form().reset(next, { emitEvent: false });
    this.submitAttempted.set(false);
    this._formStateTick.set(0);
    this.onEvent.emit({ type: 'form:reset' });
  }

  /**
   * Toggle the loading flag for a specific action button. Hosts call this
   * around long-running async work bound to a custom action.
   */
  setActionLoading(actionKey: string, loading: boolean): void {
    const next = new Map(this.actionLoading());
    if (loading) next.set(actionKey, true);
    else next.delete(actionKey);
    this.actionLoading.set(next);
  }

  // ── Template helpers — narrowing guards ──────────────────────────────

  protected isWidgetItem(item: SchemaItem): boolean { return isSchemaWidget(item); }

  protected itemKey(item: SchemaItem): string { return itemTrackKey(item); }

  protected spanForItem(item: SchemaItem): number | string {
    const span = item.columnSpan ?? 1;
    return span === 'full' ? this.schema().columns ?? 1 : span;
  }

  // ── Field value accessors ─────────────────────────────────────────────

  protected valueFor(key: string): string | number | null {
    this._formStateTick();
    const v = this.form().controls[key]?.value;
    if (v === undefined || v === null) return null;
    return v as string | number | null;
  }

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
    return Array.isArray(v) ? ([...v] as FileItem[]) : [];
  }

  protected treeValueFor(key: string): string | readonly string[] | null {
    this._formStateTick();
    const v = this.form().controls[key]?.value;
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v as readonly string[];
    return typeof v === 'string' ? v : null;
  }

  protected numberValueFor(key: string): number | null {
    this._formStateTick();
    const v = this.form().controls[key]?.value;
    if (v === null || v === undefined || v === '') return null;
    return typeof v === 'number' ? v : Number(v);
  }

  protected stringValueFor(key: string): string | null {
    this._formStateTick();
    const v = this.form().controls[key]?.value;
    if (v === null || v === undefined) return null;
    return String(v);
  }

  protected rangeValueFor(key: string): RangeValue {
    this._formStateTick();
    const v = this.form().controls[key]?.value;
    if (v === null || v === undefined) return null;
    if (Array.isArray(v) && v.length === 2) return [Number(v[0]), Number(v[1])] as const;
    return typeof v === 'number' ? v : null;
  }

  // ── Field event handlers ─────────────────────────────────────────────

  protected onFieldChange(key: string, value: unknown): void {
    const ctrl = this.form().controls[key];
    if (!ctrl) return;
    if (ctrl.value === value) return;
    ctrl.setValue(value, { emitEvent: true });
    ctrl.markAsDirty();
    this.onEvent.emit({
      type: 'field:change',
      key,
      value,
      value$: this.form().getRawValue() as T,
    });
  }

  protected onFieldBlur(key: string): void {
    this.form().controls[key]?.markAsTouched();
    this._formStateTick.update((n) => n + 1);
    this.onEvent.emit({
      type: 'field:blur',
      key,
      value$: this.form().getRawValue() as T,
    });
  }

  /**
   * Convenience for renderers (checkbox / switch / radio / file / color /
   * range / table-picker / tree-select) that don't fire a separate blur —
   * a value change implies "user interacted with it".
   */
  protected onValueChangeAndBlur(key: string, value: unknown): void {
    this.onFieldChange(key, value);
    this.form().controls[key]?.markAsTouched();
  }

  // ── Per-type config builders (each takes the discriminated variant) ──

  protected selectConfigFor(field: SelectField): SelectFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, placeholder: field.placeholder, hint: field.hint,
      options: field.options,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      clearable: field.clearable ?? !field.required,
      filterable: field.filterable ?? field.options.length > 8,
      emptyOptionsText: field.emptyOptionsText,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected multiSelectConfigFor(field: MultiSelectField): MultiSelectFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, placeholder: field.placeholder, hint: field.hint,
      options: field.options,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      filterable: field.filterable ?? field.options.length > 8,
      chipDisplay: field.chipDisplay,
      emptyOptionsText: field.emptyOptionsText,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected radioConfigFor(field: RadioField): RadioGroupFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, hint: field.hint,
      options: field.options,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected checkboxConfigFor(field: CheckboxField): CheckboxFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, hint: field.hint,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected switchConfigFor(field: SwitchField): SwitchFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, hint: field.hint,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected dateConfigFor(field: DateField, kind: 'date' | 'datetime' | 'time'): DatePickerFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      kind,
      label: field.label, placeholder: field.placeholder, hint: field.hint,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      clearable: field.clearable ?? !field.required,
      inlineCalendar: field.inlineCalendar,
      minDate: field.minDate, maxDate: field.maxDate,
      disabledDates: field.disabledDates,
      showSeconds: field.showSeconds, hourFormat: field.hourFormat,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected fileConfigFor(field: FileField): FileUploadConfig {
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

  protected treeSelectConfigFor(field: TreeSelectField): TreeSelectFieldConfig<unknown> {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, hint: field.hint,
      nodes: field.treeNodes,
      selectionMode: field.treeSelectionMode === null ? undefined : field.treeSelectionMode,
      treeConfig: field.treeConfig,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected tablePickerConfigFor(field: TablePickerField): TablePickerFieldConfig<Record<string, unknown>> {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, hint: field.hint,
      tableConfig: field.tableConfig,
      rows: field.tableRows ?? [],
      required: field.required, disabled: field.disabled,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected autocompleteConfigFor(field: AutocompleteField): AutocompleteFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, placeholder: field.placeholder, hint: field.hint,
      optionsLoader: field.optionsLoader,
      debounceMs: field.autocompleteDebounceMs,
      multiple: field.multiple,
      emptyOptionsText: field.emptyOptionsText,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      clearable: field.clearable ?? !field.required,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected currencyConfigFor(field: CurrencyField): CurrencyFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, placeholder: field.placeholder, hint: field.hint,
      currency: field.currency,
      locale: field.locale,
      min: field.validators?.min !== undefined ? unwrapValue(field.validators.min) : undefined,
      max: field.validators?.max !== undefined ? unwrapValue(field.validators.max) : undefined,
      step: field.step,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      clearable: field.clearable ?? !field.required,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected maskConfigFor(field: MaskField): MaskFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, placeholder: field.placeholder, hint: field.hint,
      mask: field.mask,
      slotChar: field.slotChar,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected colorConfigFor(field: ColorField): ColorFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, hint: field.hint,
      colorFormat: field.colorFormat,
      required: field.required, disabled: field.disabled,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected rangeConfigFor(field: RangeField): RangeFieldConfig {
    const errors = this.fieldErrors(field);
    return {
      label: field.label, hint: field.hint,
      min: field.validators?.min !== undefined ? unwrapValue(field.validators.min) : undefined,
      max: field.validators?.max !== undefined ? unwrapValue(field.validators.max) : undefined,
      step: field.rangeStep,
      rangeMode: field.rangeMode,
      required: field.required, disabled: field.disabled, readonly: field.readonly,
      id: `dph-schema-${field.key}`, name: field.key,
      errors, invalid: errors.length > 0,
    };
  }

  protected messageConfig(item: SchemaWidgetMessage): InlineMessageConfig {
    return {
      severity: item.severity,
      summary: item.summary,
      detail: item.detail,
      icon: item.icon,
      closable: item.closable,
    };
  }

  protected sectionPanelConfig(sec: FormSchemaSection): PanelConfig {
    return {
      header: sec.title,
      subheader: sec.description,
      icon: sec.icon,
      collapsible: sec.collapsible,
      defaultCollapsed: sec.defaultCollapsed,
      variant: 'default',
    };
  }

  // ── Section / Tabs / Wizard event handlers ──────────────────────────

  protected onSectionToggle(id: string, expanded: boolean): void {
    const next = new Map(this.collapsedSections());
    next.set(id, !expanded);
    this.collapsedSections.set(next);
    this.onEvent.emit({ type: 'section:toggle', key: id, expanded });
  }

  protected onTabChange(id: string | number): void {
    if (id === undefined || id === null) return;
    this.activeTabId.set(id);
    const idx = this.visibleTabs().findIndex((t) => t.id === id);
    // Emit BOTH the canonical and the legacy event so existing consumers
    // keep working during the deprecation window.
    this.onEvent.emit({ type: 'tab:change', id: String(id), index: idx });
    this.onEvent.emit({ type: 'section:tab-change', key: String(id), index: idx });
  }

  protected onActionClick(actionKey: string): void {
    this.onEvent.emit({
      type: 'action:click',
      action: actionKey,
      value$: this.form().getRawValue() as T,
    });
  }

  protected onStepStripClick(event: { key: string; index: number }): void {
    const layout = this.schema().layout;
    const wizard = layout && isWizardLayout(layout) ? layout : null;
    if (!wizard) return;
    const cur = this.activeStepIdx();
    const target = event.index;
    if (target > cur) {
      if (wizard.validatePerStep === false) {
        this.advanceTo(target, 'step:jump');
      } else if (this.markStepAsTouchedAndCheck(this.activeStep())) {
        this.advanceTo(target, 'step:jump');
      }
    } else if (target < cur) {
      if (wizard.allowBackNav === false) return;
      this.advanceTo(target, 'step:back');
    }
  }

  protected onWizardBack(): void {
    const idx = this.activeStepIdx();
    if (idx <= 0) return;
    this.advanceTo(idx - 1, 'step:back');
  }

  protected onWizardNext(): void {
    const layout = this.schema().layout;
    const wizard = layout && isWizardLayout(layout) ? layout : null;
    if (!wizard) return;
    const idx = this.activeStepIdx();
    const total = this.visibleSteps().length;
    if (idx >= total - 1) return;
    if (wizard.validatePerStep === false || this.markStepAsTouchedAndCheck(this.activeStep())) {
      this.advanceTo(idx + 1, 'step:advance');
    }
  }

  protected onWizardFinish(): void {
    const step = this.activeStep();
    if (!step) return;
    if (this.markStepAsTouchedAndCheck(step)) {
      this.onEvent.emit({
        type: 'step:complete',
        key: step.key,
        value$: this.form().getRawValue() as T,
      });
      this.onSubmit();
    }
  }

  protected onWizardCancel(): void {
    const step = this.activeStep();
    this.onEvent.emit({ type: 'step:cancel', key: step?.key ?? '' });
    this.onCancel();
  }

  protected onWizardSkip(): void {
    const idx = this.activeStepIdx();
    const total = this.visibleSteps().length;
    if (idx >= total - 1) return;
    const stepsList = this.visibleSteps();
    const from = stepsList[idx];
    const to = stepsList[idx + 1];
    if (!from || !to) return;
    this.activeStepIdx.set(idx + 1);
    this.onEvent.emit({
      type: 'step:skip',
      from: from.key,
      to: to.key,
      value$: this.form().getRawValue() as T,
    });
  }

  private advanceTo(idx: number, kind: 'step:advance' | 'step:back' | 'step:jump'): void {
    const stepsList = this.visibleSteps();
    const cur = this.activeStepIdx();
    const from = stepsList[cur];
    const to = stepsList[idx];
    if (!from || !to) return;
    this.activeStepIdx.set(idx);
    this.onEvent.emit({
      type: kind,
      from: from.key,
      to: to.key,
      value$: this.form().getRawValue() as T,
    });
  }

  private markStepAsTouchedAndCheck(step: FormSchemaStep | null): boolean {
    if (!step || step.skipValidation) return true;
    const ctx = this.whenContext();
    const fields = step.items.filter(isSchemaField).filter((f) => evalWhen(f.when, ctx));
    let valid = true;
    for (const f of fields) {
      const ctrl = this.form().controls[f.key];
      if (!ctrl) continue;
      ctrl.markAsTouched();
      if (ctrl.invalid) valid = false;
    }
    if (!valid) {
      this._formStateTick.update((n) => n + 1);
    }
    return valid;
  }

  private errorCountForStep(step: FormSchemaStep): number {
    const ctx = this.whenContext();
    const fields = step.items.filter(isSchemaField).filter((f) => evalWhen(f.when, ctx));
    let count = 0;
    for (const f of fields) {
      const ctrl = this.form().controls[f.key];
      if (ctrl?.invalid && (ctrl.touched || ctrl.dirty || this.submitAttempted())) count++;
    }
    return count;
  }

  // ── Errors ────────────────────────────────────────────────────────────

  private fieldErrors(field: SchemaField): readonly string[] {
    this._formStateTick();
    const ctrl = this.form().controls[field.key];
    return this.errorsFor(field, ctrl);
  }

  protected inputConfigFor(field: TextLikeField): {
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
    this._formStateTick();
    const ctrl = this.form().controls[field.key];
    const errors = this.errorsFor(field, ctrl);
    return {
      type: field.type,
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
      this.focusFirstError();
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

  // ── Internals ─────────────────────────────────────────────────────────

  private cleanedValue(): T {
    const raw = this.form().getRawValue() as Record<string, unknown>;
    const trimDefault = this.schema().trim ?? true;
    const out: Record<string, unknown> = {};
    for (const field of this.resolvedFields()) {
      const v = raw[field.key];
      if (typeof v === 'string') {
        const trimEnabled = field.trim ?? trimDefault;
        const trimmed = trimEnabled ? v.trim() : v;
        out[field.key] = field.nullIfEmpty && trimmed === '' ? null : trimmed;
      } else {
        out[field.key] = v;
      }
    }
    return out as T;
  }

  private errorsFor(field: SchemaField, ctrl: AbstractControl | undefined): readonly string[] {
    if (!ctrl) return [];
    const showLocal = this.submitAttempted() || ctrl.touched || ctrl.dirty;
    const messages: string[] = [];

    if (showLocal && ctrl.errors) {
      const validators = field.validators ?? {};
      if (ctrl.errors['required'])  messages.push(specMessage(validators.required, `${field.label} is required.`));
      if (ctrl.errors['email'])     messages.push(specMessage(validators.email, 'Enter a valid email address.'));
      if (ctrl.errors['minlength']) {
        const min = ctrl.errors['minlength'].requiredLength as number;
        messages.push(specMessage(validators.minLength, `Minimum ${min} characters.`));
      }
      if (ctrl.errors['maxlength']) {
        const max = ctrl.errors['maxlength'].requiredLength as number;
        messages.push(specMessage(validators.maxLength, `Maximum ${max} characters.`));
      }
      if (ctrl.errors['pattern']) messages.push(specMessage(validators.pattern, `${field.label} format is invalid.`));
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
      // Cross-field rule errors register against this field — value is the
      // rule's error message string already.
      for (const errKey of Object.keys(ctrl.errors)) {
        if (!errKey.startsWith('xfield:')) continue;
        const msg = ctrl.errors[errKey];
        if (typeof msg === 'string' && msg) messages.push(msg);
      }
    }

    const apiErr = this.apiError();
    if (apiErr) {
      const conflictMsg = this.conflictMessage();
      const conflictField = this.conflictField() ?? defaultConflictField(this.schema() as FormSchema);
      if (apiErr.statusCode === 409 && conflictMsg && conflictField === field.key) {
        messages.push(conflictMsg);
      }
      const fieldMsg = serverFieldMessage(apiErr, field, this.serverErrorIndex());
      if (fieldMsg) messages.push(fieldMsg);

      const statusOverride = field.statusErrorMessages?.[apiErr.statusCode];
      if (statusOverride && messages.indexOf(statusOverride) === -1) {
        messages.push(statusOverride);
      }
    }

    return messages;
  }
}

// ────────────────────────────────────────────────────────────────────
// Local helpers
// ────────────────────────────────────────────────────────────────────

function buildFormGroup(
  fb: FormBuilder,
  fields: readonly SchemaField[],
  crossFieldRules: readonly CrossFieldRule[] | undefined,
): FormGroup {
  const controls: Record<string, AbstractControl> = {};
  for (const field of fields) {
    const validators = collectValidators(field);
    controls[field.key] = fb.control((field as { defaultValue?: unknown }).defaultValue ?? defaultValueFor(field), {
      validators: validators.sync,
      asyncValidators: validators.async,
    });
  }
  const groupValidators: ValidatorFn[] = [];
  if (crossFieldRules?.length) {
    groupValidators.push(buildCrossFieldValidator(crossFieldRules));
  }
  return new FormGroup(controls, { validators: groupValidators });
}

/**
 * One FormGroup-level validator that runs every cross-field rule and
 * decorates each rule's targeted fields with an error keyed by `xfield:<id>`.
 * The value of the key is the rule's error string — `errorsFor` reads
 * `xfield:*` keys directly.
 */
function buildCrossFieldValidator(rules: readonly CrossFieldRule[]): ValidatorFn {
  return (group) => {
    const formGroup = group as FormGroup;
    const values = formGroup.getRawValue() as Record<string, unknown>;
    let groupHasError = false;
    for (const rule of rules) {
      const message = rule.validate(values);
      const errorKey = `xfield:${rule.id}`;
      for (const fieldKey of rule.fields) {
        const ctrl = formGroup.controls[fieldKey];
        if (!ctrl) continue;
        const existing = { ...(ctrl.errors ?? {}) };
        const had = errorKey in existing;
        if (message) {
          existing[errorKey] = message;
          ctrl.setErrors(existing);
          groupHasError = true;
        } else if (had) {
          delete existing[errorKey];
          ctrl.setErrors(Object.keys(existing).length ? existing : null);
        }
      }
    }
    return groupHasError ? { crossField: true } : null;
  };
}
