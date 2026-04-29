/**
 * ─── DPH UI KIT — STEPS / WIZARD ────────────────────────────────────────────────
 *
 * Multi-step indicator. 8 visual variants × horizontal/vertical orientation
 * × hierarchical sub-steps × 8 lifecycle states × inline-editing-friendly
 * validation hooks.
 *
 *   <dph-steps [config]="{ steps, activeIndex: idx() }" (stepClick)="goTo($event)" />
 *
 * Variants
 *   horizontal | vertical | pill-bar | progress | cards | split | accordion | dots
 *
 * States (per step)
 *   pending | active | complete | error | warning | skipped | disabled | loading
 *   (override via step.state, otherwise auto-derived from activeIndex)
 *
 * Sub-steps
 *   step.children?: StepDescriptor[]   ← recursive tree, any depth
 *
 * Conditional steps
 *   step.when?: () => boolean          ← skipped from rendering when falsy
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import type { StepDescriptor, StepState, StepsConfig, StepsVariant } from './dph.types';

interface FlatStep {
  readonly key: string;
  readonly index: number;
  readonly depth: number;
  readonly path: readonly number[];
  readonly step: StepDescriptor;
  readonly parentKey: string | null;
  readonly hasChildren: boolean;
}

@Component({
  selector: 'dph-steps',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @switch (variant()) {
      <!-- ── HORIZONTAL (numbered with connectors) ─────────────────── -->
      @case ('horizontal') {
        <ol class="dph-steps" data-variant="horizontal" role="list" aria-label="Wizard progress">
          @for (fs of visibleTopSteps(); track fs.key; let i = $index) {
            <li
              class="dph-steps__item"
              [attr.data-state]="stateFor(fs)"
              [attr.aria-current]="fs.index === activeIdx() ? 'step' : null"
            >
              <button type="button" class="dph-steps__btn" [disabled]="!canNav(fs)" (click)="onStepClick(fs)">
                <span class="dph-steps__marker">
                  <ng-container *ngTemplateOutlet="markerIcon; context: { $implicit: fs }" />
                </span>
                @if (showLabels()) {
                  <span class="dph-steps__text">
                    <span class="dph-steps__label">{{ fs.step.label }}</span>
                    @if (fs.step.description) {
                      <span class="dph-steps__desc">{{ fs.step.description }}</span>
                    }
                  </span>
                }
                <ng-container *ngTemplateOutlet="badgeChip; context: { $implicit: fs }" />
              </button>
              @if (showConnectors() && i < visibleTopSteps().length - 1) {
                <span class="dph-steps__connector" aria-hidden="true"></span>
              }
            </li>
          }
        </ol>
        @if (showProgress()) {
          <div class="dph-steps__progress" role="progressbar" [attr.aria-valuenow]="progressPct()">
            <div class="dph-steps__progress-bar" [style.width]="progressPct() + '%'"></div>
          </div>
        }
      }

      <!-- ── VERTICAL (with sub-steps support) ─────────────────────── -->
      @case ('vertical') {
        <ol class="dph-steps" data-variant="vertical" role="list" aria-label="Wizard progress">
          @for (fs of visibleAllSteps(); track fs.key) {
            <li
              class="dph-steps__item"
              [class.dph-steps__item--child]="fs.depth > 0"
              [style.padding-left.rem]="fs.depth * 1.5"
              [attr.data-state]="stateFor(fs)"
              [attr.aria-current]="fs.index === activeIdx() ? 'step' : null"
            >
              <div class="dph-steps__rail">
                <span class="dph-steps__marker">
                  <ng-container *ngTemplateOutlet="markerIcon; context: { $implicit: fs }" />
                </span>
                @if (!isLast(fs)) {
                  <span class="dph-steps__rail-line" aria-hidden="true"></span>
                }
              </div>
              <button type="button" class="dph-steps__btn dph-steps__btn--vertical" [disabled]="!canNav(fs)" (click)="onStepClick(fs)">
                <span class="dph-steps__text">
                  <span class="dph-steps__label">
                    {{ fs.step.label }}
                    @if (fs.step.optional) { <em class="dph-steps__opt"> · optional</em> }
                  </span>
                  @if (fs.step.description) {
                    <span class="dph-steps__desc">{{ fs.step.description }}</span>
                  }
                </span>
                <ng-container *ngTemplateOutlet="badgeChip; context: { $implicit: fs }" />
              </button>
            </li>
          }
        </ol>
      }

      <!-- ── PILL BAR (connected pill segments) ────────────────────── -->
      @case ('pill-bar') {
        <div class="dph-steps__pills" role="list" aria-label="Wizard progress">
          @for (fs of visibleTopSteps(); track fs.key) {
            <button
              type="button"
              class="dph-steps__pill"
              [attr.data-state]="stateFor(fs)"
              [attr.aria-current]="fs.index === activeIdx() ? 'step' : null"
              [disabled]="!canNav(fs)"
              (click)="onStepClick(fs)"
            >
              <span class="dph-steps__pill-num">{{ fs.index + 1 }}</span>
              <span class="dph-steps__pill-label">{{ fs.step.label }}</span>
            </button>
          }
        </div>
      }

      <!-- ── PROGRESS BAR with notch markers ───────────────────────── -->
      @case ('progress') {
        <div class="dph-steps__pbar" role="progressbar" [attr.aria-valuenow]="progressPct()">
          <div class="dph-steps__pbar-track">
            <div class="dph-steps__pbar-fill" [style.width]="progressPct() + '%'"></div>
            @for (fs of visibleTopSteps(); track fs.key) {
              <button
                type="button"
                class="dph-steps__pbar-notch"
                [attr.data-state]="stateFor(fs)"
                [style.left]="notchPosition($index) + '%'"
                [disabled]="!canNav(fs)"
                [attr.aria-label]="fs.step.label"
                (click)="onStepClick(fs)"
              >
                <span>{{ $index + 1 }}</span>
              </button>
            }
          </div>
          <div class="dph-steps__pbar-labels">
            @for (fs of visibleTopSteps(); track fs.key) {
              <span [class.dph-steps__pbar-active]="fs.index === activeIdx()">{{ fs.step.label }}</span>
            }
          </div>
        </div>
      }

      <!-- ── CARDS (each step a clickable card) ────────────────────── -->
      @case ('cards') {
        <div class="dph-steps__cards" role="list" aria-label="Wizard progress">
          @for (fs of visibleTopSteps(); track fs.key) {
            <button
              type="button"
              class="dph-steps__card"
              [attr.data-state]="stateFor(fs)"
              [attr.aria-current]="fs.index === activeIdx() ? 'step' : null"
              [disabled]="!canNav(fs)"
              (click)="onStepClick(fs)"
            >
              <div class="dph-steps__card-head">
                <span class="dph-steps__marker dph-steps__marker--lg">
                  <ng-container *ngTemplateOutlet="markerIcon; context: { $implicit: fs }" />
                </span>
                <span class="dph-steps__card-step">Step {{ fs.index + 1 }}</span>
              </div>
              <div class="dph-steps__card-body">
                <div class="dph-steps__card-title">{{ fs.step.label }}</div>
                @if (fs.step.description) {
                  <div class="dph-steps__card-desc">{{ fs.step.description }}</div>
                }
                @if (fs.step.time) {
                  <div class="dph-steps__card-time"><i class="pi pi-clock" aria-hidden="true"></i> {{ fs.step.time }} min</div>
                }
              </div>
            </button>
          }
        </div>
      }

      <!-- ── SPLIT (left rail + content slot) ──────────────────────── -->
      @case ('split') {
        <div class="dph-steps__split">
          <ol class="dph-steps__split-rail" role="list" aria-label="Wizard progress">
            @for (fs of visibleAllSteps(); track fs.key) {
              <li
                class="dph-steps__split-item"
                [class.dph-steps__split-item--child]="fs.depth > 0"
                [attr.data-state]="stateFor(fs)"
                [attr.aria-current]="fs.index === activeIdx() ? 'step' : null"
              >
                <button type="button" class="dph-steps__split-btn" [disabled]="!canNav(fs)" (click)="onStepClick(fs)">
                  <span class="dph-steps__marker dph-steps__marker--sm">
                    <ng-container *ngTemplateOutlet="markerIcon; context: { $implicit: fs }" />
                  </span>
                  <span class="dph-steps__text">
                    <span class="dph-steps__label">{{ fs.step.label }}</span>
                    @if (fs.step.description) {
                      <span class="dph-steps__desc">{{ fs.step.description }}</span>
                    }
                  </span>
                </button>
              </li>
            }
          </ol>
          <div class="dph-steps__split-content">
            <ng-content />
          </div>
        </div>
      }

      <!-- ── ACCORDION (each step collapsible inline) ──────────────── -->
      @case ('accordion') {
        <div class="dph-steps__acc" role="list" aria-label="Wizard progress">
          @for (fs of visibleTopSteps(); track fs.key) {
            <details class="dph-steps__acc-item" [attr.data-state]="stateFor(fs)" [open]="fs.index === activeIdx()">
              <summary class="dph-steps__acc-head">
                <span class="dph-steps__marker">
                  <ng-container *ngTemplateOutlet="markerIcon; context: { $implicit: fs }" />
                </span>
                <span class="dph-steps__acc-title">
                  {{ fs.step.label }}
                  @if (fs.step.description) { <span class="dph-steps__desc"> — {{ fs.step.description }}</span> }
                </span>
              </summary>
            </details>
          }
        </div>
      }

      <!-- ── DOTS (compact — for 10+ steps) ────────────────────────── -->
      @case ('dots') {
        <div class="dph-steps__dots" role="list" aria-label="Wizard progress">
          @for (fs of visibleTopSteps(); track fs.key) {
            <button
              type="button"
              class="dph-steps__dot"
              [attr.data-state]="stateFor(fs)"
              [attr.aria-current]="fs.index === activeIdx() ? 'step' : null"
              [attr.aria-label]="fs.step.label"
              [disabled]="!canNav(fs)"
              [title]="fs.step.label"
              (click)="onStepClick(fs)"
            ></button>
          }
          <span class="dph-steps__dots-label">Step {{ activeIdx() + 1 }} of {{ visibleTopSteps().length }} — {{ activeStep()?.label }}</span>
        </div>
      }
    }

    <!-- ── shared marker template ─────────────────────────────────── -->
    <ng-template #markerIcon let-fs>
      @switch (stateFor(fs)) {
        @case ('complete') { <i class="pi pi-check" aria-hidden="true"></i> }
        @case ('error')    { <i class="pi pi-times" aria-hidden="true"></i> }
        @case ('warning')  { <i class="pi pi-exclamation-triangle" aria-hidden="true"></i> }
        @case ('skipped')  { <i class="pi pi-forward" aria-hidden="true"></i> }
        @case ('loading')  { <span class="dph-steps__spin" aria-hidden="true"></span> }
        @case ('disabled') { <i class="pi pi-lock" aria-hidden="true"></i> }
        @default {
          @if (fs.step.icon) { <i [class]="fs.step.icon" aria-hidden="true"></i> }
          @else { {{ fs.index + 1 }} }
        }
      }
    </ng-template>

    <!-- ── shared error/badge chip ────────────────────────────────── -->
    <ng-template #badgeChip let-fs>
      @if (fs.step.errorCount && fs.step.errorCount > 0) {
        <span class="dph-steps__error-badge" [attr.aria-label]="fs.step.errorCount + ' errors'">{{ fs.step.errorCount }}</span>
      }
      @if (fs.step.badge) {
        <span class="dph-steps__chip" [attr.data-severity]="fs.step.badge.severity || 'neutral'">{{ fs.step.badge.value }}</span>
      }
    </ng-template>
  `,
  styleUrl: './steps.component.scss',
})
export class StepsComponent {
  readonly config = input.required<StepsConfig>();
  readonly stepClick = output<{ key: string; index: number; path: readonly number[] }>();

  protected readonly variant = computed<StepsVariant>(() => this.config().variant ?? 'horizontal');
  protected readonly showLabels = computed<boolean>(() => this.config().showLabels !== false);
  protected readonly showConnectors = computed<boolean>(() => this.config().showConnectors !== false);
  protected readonly showProgress = computed<boolean>(() => !!this.config().showProgress);
  protected readonly activeIdx = computed<number>(() => this.config().activeIndex);

  protected readonly flatSteps = computed<readonly FlatStep[]>(() => {
    const out: FlatStep[] = [];
    let idx = 0;
    const walk = (steps: readonly StepDescriptor[], depth: number, path: readonly number[], parentKey: string | null) => {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]!;
        if (s.when && !s.when()) continue;
        const fs: FlatStep = {
          key: s.key,
          index: idx++,
          depth,
          path: [...path, i],
          step: s,
          parentKey,
          hasChildren: !!s.children?.length,
        };
        out.push(fs);
        if (s.children?.length) walk(s.children, depth + 1, fs.path, s.key);
      }
    };
    walk(this.config().steps, 0, [], null);
    return out;
  });

  protected readonly visibleAllSteps = computed<readonly FlatStep[]>(() => this.flatSteps());
  protected readonly visibleTopSteps = computed<readonly FlatStep[]>(() => this.flatSteps().filter((fs) => fs.depth === 0));

  protected readonly activeStep = computed<StepDescriptor | null>(() => {
    const fs = this.flatSteps().find((f) => f.index === this.activeIdx());
    return fs?.step ?? null;
  });

  protected readonly progressPct = computed<number>(() => {
    const top = this.visibleTopSteps();
    if (!top.length) return 0;
    const completed = top.filter((fs) => this.stateFor(fs) === 'complete').length;
    const active = top.findIndex((fs) => fs.index === this.activeIdx());
    const partial = active >= 0 ? 0.5 : 0;
    return Math.min(100, ((completed + partial) / top.length) * 100);
  });

  protected stateFor(fs: FlatStep): StepState {
    if (fs.step.state) return fs.step.state;
    const a = this.activeIdx();
    if (fs.index < a) return 'complete';
    if (fs.index === a) return 'active';
    return 'pending';
  }

  protected canNav(fs: FlatStep): boolean {
    if (this.config().readonly) return false;
    if (this.config().allowFreeNav) return true;
    return fs.index <= this.activeIdx();
  }

  protected isLast(fs: FlatStep): boolean {
    const all = this.visibleAllSteps();
    return all[all.length - 1]?.key === fs.key;
  }

  protected notchPosition(idx: number): number {
    const total = this.visibleTopSteps().length;
    if (total <= 1) return 50;
    return (idx / (total - 1)) * 100;
  }

  protected onStepClick(fs: FlatStep): void {
    if (!this.canNav(fs)) return;
    this.stepClick.emit({ key: fs.key, index: fs.index, path: fs.path });
  }
}
