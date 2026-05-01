/**
 * ─── DPH UI KIT — AUTOCOMPLETE ──────────────────────────────────────────────────
 *
 * Async typeahead. The host supplies an `optionsLoader(query)` and the
 * component handles debouncing + loading state + min-query-length gating.
 * Wraps PrimeNG `<p-autoComplete>` with `[suggestions]` populated from the
 * loader's response.
 *
 *   <dph-autocomplete
 *     [(value)]="customerId"
 *     [config]="{
 *       label: 'Customer',
 *       optionsLoader: q => api.searchCustomers(q),
 *       autocompleteDebounceMs: 250,
 *       minQueryLength: 2,
 *     }"
 *   />
 *
 * VALUE SHAPE
 *   The bound model is the selected `OptionItem.value` (NOT the whole
 *   option). This matches dph-select / dph-multi-select for consistency:
 *   the form payload contains the API id, never the display label.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { OptionItem, Size } from './dph.types';

export interface AutocompleteFieldConfig {
  readonly label?: string;
  readonly hint?: string;
  readonly placeholder?: string;
  /**
   * Async loader. Receives the trimmed query, returns options. Sync return
   * accepted for in-memory filters.
   */
  readonly optionsLoader: (query: string) => Promise<readonly OptionItem[]> | readonly OptionItem[];
  /** Debounce window for keystrokes. Default `250`ms. */
  readonly debounceMs?: number;
  /** Minimum query length before the loader is called. Default `1`. */
  readonly minQueryLength?: number;
  /** Allow free-text values that don't match any option. Default `false`. */
  readonly forceSelection?: boolean;
  /** Multi-pick mode — emit an array of values. Default `false`. */
  readonly multiple?: boolean;
  /** Empty-state text when no results. */
  readonly emptyOptionsText?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly clearable?: boolean;
  readonly size?: Size;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'dph-autocomplete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AutoCompleteModule, FieldErrorComponent],
  template: `
    <div class="dph-ac" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-ac__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-ac__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <p-autoComplete
        [inputId]="inputId()"
        [suggestions]="suggestions()"
        [placeholder]="config().placeholder || ''"
        [disabled]="!!config().disabled"
        [readonly]="!!config().readonly"
        [forceSelection]="!!config().forceSelection"
        [multiple]="!!config().multiple"
        [showClear]="!!config().clearable"
        [delay]="config().debounceMs ?? 250"
        [minLength]="config().minQueryLength ?? 1"
        [emptyMessage]="config().emptyOptionsText || 'No results'"
        [invalid]="invalidEffective()"
        field="label"
        optionLabel="label"
        appendTo="body"
        styleClass="w-full"
        [(ngModel)]="boundValue"
        (completeMethod)="onSearch($event)"
        (onBlur)="onBlur($any($event).originalEvent ?? $event)"
        (onFocus)="onFocus($any($event).originalEvent ?? $event)"
        [attr.aria-required]="config().required ? 'true' : null"
        [attr.aria-invalid]="invalidEffective() ? 'true' : null"
        [attr.aria-describedby]="errorId()"
      />

      @if (config().hint && !invalidEffective()) {
        <p class="dph-ac__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './autocomplete.component.scss',
})
export class AutocompleteComponent {
  readonly config = input.required<AutocompleteFieldConfig>();
  readonly value = model<unknown>(null);
  readonly blur = output<FocusEvent>();
  readonly focus = output<FocusEvent>();

  protected readonly suggestions = signal<OptionItem[]>([]);
  /** Cache the most-recent loader response so value→option resolution works. */
  private readonly knownOptions = signal<readonly OptionItem[]>([]);

  private readonly _autoId = signal<string>(`dph-ac-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  /**
   * `<p-autoComplete>` two-way binds the WHOLE option object (or array).
   * We adapt to/from the consumer's primitive `value` model so the form
   * payload mirrors `dph-select` semantics — value field only.
   */
  protected get boundValue(): OptionItem | OptionItem[] | null {
    const v = this.value();
    const opts = this.knownOptions();
    if (v === null || v === undefined) return null;
    if (this.config().multiple && Array.isArray(v)) {
      return v
        .map((vv) => opts.find((o) => o.value === vv))
        .filter((o): o is OptionItem => !!o);
    }
    if (this.config().forceSelection) {
      return opts.find((o) => o.value === v) ?? null;
    }
    // free-text: the model can be the raw string the user typed
    if (typeof v === 'string') {
      return { label: v, value: v };
    }
    return null;
  }
  protected set boundValue(v: OptionItem | OptionItem[] | string | null) {
    if (v === null || v === undefined) {
      this.value.set(this.config().multiple ? [] : null);
      return;
    }
    if (Array.isArray(v)) {
      this.value.set(v.map((o) => o.value));
      return;
    }
    if (typeof v === 'string') {
      this.value.set(v);
      return;
    }
    this.value.set(v.value);
  }

  protected async onSearch(event: { query: string }): Promise<void> {
    const query = (event?.query ?? '').trim();
    const minLen = this.config().minQueryLength ?? 1;
    if (query.length < minLen) {
      this.suggestions.set([]);
      return;
    }
    try {
      const result = await Promise.resolve(this.config().optionsLoader(query));
      const list = [...result];
      this.suggestions.set(list);
      this.knownOptions.set(list);
    } catch {
      this.suggestions.set([]);
    }
  }

  protected onBlur(event: FocusEvent): void { this.blur.emit(event); }
  protected onFocus(event: FocusEvent): void { this.focus.emit(event); }
}
