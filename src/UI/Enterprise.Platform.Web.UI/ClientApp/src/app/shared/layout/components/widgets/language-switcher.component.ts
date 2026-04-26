/**
 * ─── widgets/language-switcher ──────────────────────────────────────────────────
 *
 * Native `<select>` for the right-zone language switcher. Native picker
 * (instead of a PrimeNG dropdown) so mobile keyboards / VoiceOver give the
 * right rotor; brand styling layered on the wrapper.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import type { NavLanguageSwitcherConfig, LanguageOption } from '@shared/layout';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select
      class="ep-lang-select"
      [value]="current().code"
      [attr.aria-label]="'Change language. Current: ' + current().label"
      (change)="onChange($event)"
    >
      @for (lang of config().languages; track lang.code) {
        <option [value]="lang.code">
          {{ lang.flagEmoji ? lang.flagEmoji + ' ' : '' }}{{ lang.label }}
        </option>
      }
    </select>
  `,
  styles: [
    `
      .ep-lang-select {
        appearance: none;
        background-color: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        font-size: 0.8125rem;
        padding: 0.25rem 1.5rem 0.25rem 0.625rem;
        border-radius: 0.375rem;
        border: none;
        cursor: pointer;
        background-image:
          linear-gradient(45deg, transparent 50%, #fff 50%),
          linear-gradient(135deg, #fff 50%, transparent 50%);
        background-position: calc(100% - 12px) center, calc(100% - 7px) center;
        background-size: 5px 5px;
        background-repeat: no-repeat;
      }
      .ep-lang-select:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-lang-select option { color: var(--ep-color-neutral-900); background: #fff; }
    `,
  ],
})
export class LanguageSwitcherComponent {
  readonly config = input.required<NavLanguageSwitcherConfig>();
  readonly initialCode = input<string | null>(null);

  /** Current language. Initialised to `initialCode` or first config entry. */
  protected readonly current = computed<LanguageOption>(() => {
    const code = this._currentCode();
    return (
      this.config().languages.find((l) => l.code === code) ??
      this.config().languages[0] ?? { code: 'en', label: 'English' }
    );
  });

  private readonly _currentCode = signal<string>(
    this.initialCode() ?? '',
  );

  readonly languageChanged = output<LanguageOption>();

  protected onChange(event: Event): void {
    const code = (event.target as HTMLSelectElement).value;
    this._currentCode.set(code);
    const picked = this.config().languages.find((l) => l.code === code);
    if (picked) this.languageChanged.emit(picked);
  }
}
