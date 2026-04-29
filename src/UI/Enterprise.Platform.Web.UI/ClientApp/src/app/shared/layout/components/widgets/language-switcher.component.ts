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
  styleUrl: './language-switcher.component.scss',
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
