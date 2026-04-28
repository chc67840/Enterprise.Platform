/**
 * ─── DPH UI KIT — DATA TABLE — CELL RENDERER ────────────────────────────────────
 *
 * One component renders any CellType. Splitting per-type into separate
 * components costs more than it earns at this granularity (every cell would
 * be a fresh CD root). All 17 renderers live here in one switch.
 *
 * Renderers: text | number | currency | date | datetime | boolean | badge |
 *            avatar | avatar-group | link | email | phone | image | rating |
 *            progress | sparkline | chips | multi-line | status-dot | json
 */
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

import type { CellOptions, CellType, ColumnDef, Severity } from '../dph.types';

@Component({
  selector: 'dph-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPipe, DatePipe, DecimalPipe, TagModule],
  template: `
    @switch (type()) {
      @case ('text') {
        <span [title]="tip()">{{ formatted() }}</span>
      }
      @case ('number') {
        {{ $any(value()) | number: '1.0-2' }}
      }
      @case ('currency') {
        {{ $any(value()) | currency: opts().currencyCode || 'USD' }}
      }
      @case ('date') {
        {{ $any(value()) | date: opts().dateFormat || 'mediumDate' }}
      }
      @case ('datetime') {
        {{ $any(value()) | date: opts().dateFormat || 'medium' }}
      }
      @case ('boolean') {
        <i
          class="pi"
          [class.pi-check]="!!value()"
          [class.pi-times]="!value()"
          [style.color]="!!value() ? 'var(--ep-color-palmetto-700)' : 'var(--ep-color-neutral-400)'"
          aria-hidden="true"
        ></i>
        <span class="dph-sr-only">{{ value() ? 'Yes' : 'No' }}</span>
      }
      @case ('badge') {
        <p-tag
          [value]="formatted()"
          [severity]="$any(badgeSeverity())"
          [rounded]="true"
        />
      }
      @case ('avatar') {
        <div class="dph-cell__avatar">
          @if (avatarSrc()) {
            <img [src]="avatarSrc()" [alt]="formatted()" referrerpolicy="no-referrer" />
          } @else {
            <span [style.background-color]="avatarBg()">{{ avatarInitials() }}</span>
          }
          @if (showAvatarLabel()) {
            <span class="dph-cell__avatar-label">{{ formatted() }}</span>
          }
        </div>
      }
      @case ('avatar-group') {
        @let arr = avatarArray();
        @let max = opts().maxAvatars ?? 4;
        <div class="dph-cell__avatar-group">
          @for (a of arr.slice(0, max); track $index) {
            <span class="dph-cell__avatar-mini" [style.background-color]="bgFor($index)" [title]="$any(a)">
              {{ initialsOf($any(a)) }}
            </span>
          }
          @if (arr.length > max) {
            <span class="dph-cell__avatar-mini dph-cell__avatar-more">+{{ arr.length - max }}</span>
          }
        </div>
      }
      @case ('link') {
        <a
          [href]="linkHref()"
          [attr.target]="opts().target || '_self'"
          [attr.rel]="opts().external ? 'noopener noreferrer' : null"
          class="dph-cell__link"
        >
          {{ formatted() }}
          @if (opts().external) {
            <i class="pi pi-external-link" aria-hidden="true"></i>
          }
        </a>
      }
      @case ('email') {
        <a [href]="'mailto:' + value()" class="dph-cell__link">{{ formatted() }}</a>
      }
      @case ('phone') {
        <a [href]="'tel:' + value()" class="dph-cell__link">{{ formatted() }}</a>
      }
      @case ('image') {
        @if (value()) {
          <img
            [src]="$any(value())"
            [alt]="formatted() || 'image'"
            class="dph-cell__image"
            [style.width]="opts().imageWidth || '2.5rem'"
            [style.height]="opts().imageHeight || '2.5rem'"
            (error)="onImgErr($event)"
          />
        } @else {
          <i class="pi pi-image" aria-hidden="true" style="color: var(--ep-color-neutral-300)"></i>
        }
      }
      @case ('rating') {
        @let max = opts().ratingMax ?? 5;
        @let n = ratingValue();
        <span class="dph-cell__rating" [attr.aria-label]="n + ' out of ' + max">
          @for (i of stars(); track $index) {
            <i
              class="pi"
              [class.pi-star-fill]="i <= n"
              [class.pi-star]="i > n"
              aria-hidden="true"
            ></i>
          }
        </span>
      }
      @case ('progress') {
        @let pct = progressPct();
        <div class="dph-cell__progress" [attr.aria-valuenow]="value()" [attr.aria-valuemax]="opts().progressMax ?? 100" role="progressbar">
          <div class="dph-cell__progress-bar" [style.width]="pct + '%'" [style.background-color]="progressColor(pct)"></div>
          @if (opts().progressShowValue) {
            <span class="dph-cell__progress-text">{{ pct | number: '1.0-0' }}%</span>
          }
        </div>
      }
      @case ('sparkline') {
        <svg class="dph-cell__sparkline" [attr.viewBox]="'0 0 100 24'" preserveAspectRatio="none" aria-hidden="true">
          <polyline
            [attr.points]="sparkPoints()"
            fill="none"
            [attr.stroke]="opts().sparklineColor || 'var(--ep-color-primary-600)'"
            stroke-width="1.5"
          />
        </svg>
      }
      @case ('chips') {
        @let chips = chipArray();
        @let mc = opts().maxChips ?? 3;
        <span class="dph-cell__chips">
          @for (chip of chips.slice(0, mc); track $index) {
            <p-tag [value]="$any(chip)" [severity]="$any(chipSeverityFor(chip))" [rounded]="true" />
          }
          @if (chips.length - mc > 0) {
            <span class="dph-cell__chip-more">+{{ chips.length - mc }}</span>
          }
        </span>
      }
      @case ('multi-line') {
        <div class="dph-cell__multiline" [style.-webkit-line-clamp]="opts().maxLines || 2" [title]="String(value() || '')">
          {{ formatted() }}
        </div>
      }
      @case ('status-dot') {
        <span class="dph-cell__status">
          <span class="dph-cell__status-dot" [style.background-color]="statusColor()"></span>
          <span>{{ statusLabel() }}</span>
        </span>
      }
      @case ('json') {
        <pre class="dph-cell__json">{{ jsonText() }}</pre>
      }
      @default {
        <span [title]="tip()">{{ formatted() }}</span>
      }
    }
  `,
  styles: [
    `
      :host { display: inline-block; max-width: 100%; }
      .dph-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

      .dph-cell__avatar { display: inline-flex; align-items: center; gap: 0.5rem; min-width: 0; }
      .dph-cell__avatar img { width: 1.75rem; height: 1.75rem; border-radius: 9999px; object-fit: cover; }
      .dph-cell__avatar > span { display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 9999px; color: #fff; font-size: 0.6875rem; font-weight: 700; }
      .dph-cell__avatar-label { font-size: 0.8125rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .dph-cell__avatar-group { display: inline-flex; }
      .dph-cell__avatar-mini { display: inline-grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 9999px; color: #fff; font-size: 0.625rem; font-weight: 700; border: 2px solid #fff; margin-left: -0.375rem; }
      .dph-cell__avatar-mini:first-child { margin-left: 0; }
      .dph-cell__avatar-more { background: var(--ep-color-neutral-300) !important; color: var(--ep-color-neutral-800) !important; }

      .dph-cell__link { color: var(--ep-color-primary-700); text-decoration: none; }
      .dph-cell__link:hover { text-decoration: underline; }
      .dph-cell__link i { font-size: 0.625rem; margin-left: 0.125rem; opacity: 0.6; }

      .dph-cell__image { object-fit: cover; border-radius: var(--ep-radius-sm); border: 1px solid var(--ep-color-neutral-200); }

      .dph-cell__rating { color: var(--ep-color-jessamine-500); font-size: 0.75rem; letter-spacing: 0.05em; }

      .dph-cell__progress {
        position: relative;
        width: 100%;
        max-width: 8rem;
        height: 0.5rem;
        background: var(--ep-color-neutral-200);
        border-radius: 9999px;
        overflow: hidden;
      }
      .dph-cell__progress-bar { height: 100%; transition: width 200ms ease; }
      .dph-cell__progress-text {
        position: absolute;
        right: 0;
        top: 0.625rem;
        font-size: 0.6875rem;
        color: var(--ep-color-neutral-600);
      }

      .dph-cell__sparkline { display: inline-block; width: 5rem; height: 1.5rem; vertical-align: middle; }

      .dph-cell__chips { display: inline-flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
      .dph-cell__chip-more { font-size: 0.6875rem; color: var(--ep-color-neutral-500); padding: 0 0.25rem; }

      .dph-cell__multiline {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
        font-size: 0.8125rem;
        color: var(--ep-color-neutral-700);
      }

      .dph-cell__status { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; }
      .dph-cell__status-dot { display: inline-block; width: 0.5rem; height: 0.5rem; border-radius: 9999px; box-shadow: 0 0 0 2px rgba(255,255,255,0.85); }

      .dph-cell__json { margin: 0; padding: 0.25rem 0.375rem; background: var(--ep-color-neutral-50); border-radius: var(--ep-radius-sm); font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.6875rem; color: var(--ep-color-neutral-800); max-height: 6rem; overflow: auto; }
    `,
  ],
})
export class CellRendererComponent {
  readonly type = input.required<CellType>();
  readonly value = input<unknown>(null);
  readonly column = input<ColumnDef<Record<string, unknown>> | null>(null);
  readonly row = input<Record<string, unknown> | null>(null);

  protected readonly Math = Math;
  protected readonly Number = Number;
  protected readonly String = String;

  protected readonly opts = computed<CellOptions>(() => this.column()?.cellOptions ?? {});

  protected readonly formatted = computed<string>(() => {
    const col = this.column();
    const row = this.row();
    const v = this.value();
    if (col?.format && row) return col.format(v, row);
    return v == null ? '' : String(v);
  });

  protected readonly tip = computed<string | null>(() => {
    const col = this.column();
    const row = this.row();
    if (col?.tooltip && row) return col.tooltip(this.value(), row);
    return null;
  });

  protected readonly badgeSeverity = computed<string>(() => {
    const v = this.value();
    const map = this.opts().badgeSeverityMap;
    if (map && typeof v === 'string' && v in map) return map[v]!;
    if (v === true || v === 'success' || v === 'active' || v === 'completed') return 'success';
    if (v === false || v === 'inactive' || v === 'archived') return 'secondary';
    if (v === 'warning' || v === 'pending') return 'warn';
    if (v === 'danger' || v === 'error' || v === 'failed') return 'danger';
    return 'info';
  });

  protected readonly avatarSrc = computed<string | null>(() => {
    const v = this.value();
    if (typeof v === 'string' && (v.startsWith('http') || v.startsWith('data:'))) return v;
    const row = this.row();
    if (row && typeof row === 'object' && 'avatarUrl' in row && typeof row['avatarUrl'] === 'string') {
      return row['avatarUrl'] as string;
    }
    return null;
  });

  protected readonly avatarInitials = computed<string>(() => this.initialsOf(this.formatted()));
  protected readonly avatarBg = computed<string>(() => this.bgFor(this.hash(this.formatted())));
  protected readonly showAvatarLabel = computed<boolean>(() => !!this.formatted() && this.formatted() !== this.avatarInitials());

  protected readonly avatarArray = computed<readonly unknown[]>(() => {
    const v = this.value();
    if (Array.isArray(v)) return v;
    return [];
  });

  protected readonly chipArray = computed<readonly unknown[]>(() => {
    const v = this.value();
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  });

  protected readonly linkHref = computed<string>(() => {
    const opts = this.opts();
    const row = this.row();
    if (opts.hrefField && row) {
      const v = row[opts.hrefField];
      if (typeof v === 'string') return v;
    }
    const v = this.value();
    return typeof v === 'string' ? v : '#';
  });

  protected readonly ratingValue = computed<number>(() => {
    const v = this.value();
    return typeof v === 'number' ? v : 0;
  });
  protected readonly stars = computed<readonly number[]>(() => {
    const max = this.opts().ratingMax ?? 5;
    return Array.from({ length: max }, (_, i) => i + 1);
  });

  protected readonly progressPct = computed<number>(() => {
    const mx = this.opts().progressMax ?? 100;
    const v = Number(this.value());
    if (Number.isNaN(v) || mx <= 0) return 0;
    return Math.min(100, Math.max(0, (v / mx) * 100));
  });

  protected readonly sparkPoints = computed<string>(() => {
    const v = this.value();
    if (!Array.isArray(v) || !v.length) return '0,12 100,12';
    const nums = v.map((x) => (typeof x === 'number' ? x : Number(x))).filter((x) => !Number.isNaN(x));
    if (!nums.length) return '0,12 100,12';
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    return nums
      .map((n, i) => {
        const x = (i / (nums.length - 1 || 1)) * 100;
        const y = 22 - ((n - min) / range) * 20;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  protected readonly statusColor = computed<string>(() => {
    const v = this.value();
    const map = this.opts().statusColors;
    if (map && typeof v === 'string' && v in map) return map[v]!;
    if (v === 'online' || v === 'active' || v === true) return 'var(--ep-color-palmetto-500)';
    if (v === 'away' || v === 'pending') return 'var(--ep-color-jessamine-500)';
    if (v === 'offline' || v === 'inactive' || v === false) return 'var(--ep-color-neutral-400)';
    if (v === 'busy' || v === 'error' || v === 'danger') return 'var(--ep-color-danger-500)';
    return 'var(--ep-color-neutral-400)';
  });

  protected readonly statusLabel = computed<string>(() => {
    const v = this.value();
    const map = this.opts().statusLabels;
    if (map && typeof v === 'string' && v in map) return map[v]!;
    return this.formatted();
  });

  protected readonly jsonText = computed<string>(() => {
    const v = this.value();
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  });

  protected initialsOf(s: string): string {
    if (!s) return '?';
    return s
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  protected bgFor(seed: number): string {
    const palette = ['#1B3F73', '#1F5328', '#A87711', '#5F7FB4', '#2E7D3E', '#D49B1A', '#8B5CF6', '#0EA5E9'];
    return palette[Math.abs(seed) % palette.length] as string;
  }

  protected hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  protected progressColor(pct: number): string {
    if (pct < 33) return 'var(--ep-color-danger-500)';
    if (pct < 66) return 'var(--ep-color-jessamine-500)';
    return 'var(--ep-color-palmetto-500)';
  }

  protected chipSeverityFor(chip: unknown): Severity {
    const fn = this.opts().chipSeverity;
    if (fn) return fn(chip);
    return 'neutral';
  }

  protected onImgErr(event: Event): void {
    const fb = this.opts().imageFallback;
    if (fb) (event.target as HTMLImageElement).src = fb;
    else (event.target as HTMLImageElement).style.visibility = 'hidden';
  }
}
