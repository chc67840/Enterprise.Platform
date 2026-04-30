/**
 * ─── widgets/nav-clock ──────────────────────────────────────────────────────────
 *
 * Pure display widget — current time formatted per `NavClockConfig`. Owns
 * its own 15-second tick (fast enough that minute-boundary lag isn't
 * visible; slow enough that idle tabs don't burn budget).
 *
 * Visual: pill on indigo chrome (rgba white tint background) — designed
 * for the dark navbar surface only. If a future light-chrome variant is
 * needed, parameterise via a tone input mirroring the bell pattern.
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  input,
  signal,
} from '@angular/core';

import type { NavClockConfig } from '@shared/layout';

@Component({
  selector: 'app-nav-clock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      Pure display widget — never interactive. aria-label gives screen
      readers a single coherent announcement of the time + zone; descendant
      spans are aria-hidden so they don't fragment that announcement. CSS
      forces every child to opt out of pointer events + selection so taps
      never land on the live-updating time text (which would also break
      mid-selection every 15 s when the value re-renders).
    -->
    <span
      class="ep-clock"
      role="status"
      aria-live="off"
      [attr.aria-label]="'Current time: ' + time() + (showTz() ? ' ' + tz() : '')"
    >
      <i class="pi pi-clock text-[10px] opacity-70" aria-hidden="true"></i>
      <span aria-hidden="true">{{ time() }}</span>
      @if (showTz()) {
        <span class="ep-clock__tz" aria-hidden="true">{{ tz() }}</span>
      }
    </span>
  `,
  styleUrl: './nav-clock.component.scss',
})
export class NavClockComponent implements OnInit, OnDestroy {
  readonly config = input.required<NavClockConfig>();

  private readonly _now = signal<Date>(new Date());
  private timerId: ReturnType<typeof setInterval> | null = null;

  protected readonly showTz = computed(() => this.config().showTimezone !== false);

  protected readonly time = computed(() => {
    const cfg = this.config();
    const opts: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: cfg.format === '12h',
    };
    // Intl.DateTimeFormat throws RangeError on `timeZone: null`. Only set the
    // option when a non-empty IANA name is present; absent / null / '' all
    // fall through to browser-local. Same defensive pattern in `tz` below.
    if (cfg.timezone) {
      opts.timeZone = cfg.timezone;
    }
    return new Intl.DateTimeFormat(undefined, opts).format(this._now());
  });

  protected readonly tz = computed(() => {
    const cfg = this.config();
    const opts: Intl.DateTimeFormatOptions = {
      timeZoneName: 'short',
    };
    if (cfg.timezone) {
      opts.timeZone = cfg.timezone;
    }
    const parts = new Intl.DateTimeFormat(undefined, opts).formatToParts(this._now());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  });

  ngOnInit(): void {
    this.timerId = setInterval(() => this._now.set(new Date()), 15_000);
  }

  ngOnDestroy(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
