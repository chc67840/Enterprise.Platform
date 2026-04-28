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
  styles: [
    `
      :host { display: block; }

      /* ── COMMON markers ───────────────────────────────────────── */
      .dph-steps__marker {
        display: inline-grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 9999px;
        background-color: var(--ep-color-neutral-200);
        color: var(--ep-color-neutral-700);
        font-size: 0.75rem;
        font-weight: 700;
        flex-shrink: 0;
        transition: background-color 200ms, color 200ms;
      }
      .dph-steps__marker--sm { width: 1.375rem; height: 1.375rem; font-size: 0.6875rem; }
      .dph-steps__marker--lg { width: 2.5rem; height: 2.5rem; font-size: 0.875rem; }

      .dph-steps__item[data-state='active'] .dph-steps__marker,
      [data-state='active'] .dph-steps__marker { background: var(--ep-color-primary-700); color: #fff; }
      [data-state='complete'] .dph-steps__marker { background: var(--ep-color-palmetto-600); color: #fff; }
      [data-state='error'] .dph-steps__marker { background: var(--ep-color-danger-500); color: #fff; }
      [data-state='warning'] .dph-steps__marker { background: var(--ep-color-jessamine-500); color: #fff; }
      [data-state='skipped'] .dph-steps__marker { background: var(--ep-color-neutral-300); color: var(--ep-color-neutral-700); }
      [data-state='disabled'] .dph-steps__marker { background: var(--ep-color-neutral-200); color: var(--ep-color-neutral-400); }
      [data-state='loading'] .dph-steps__marker { background: var(--ep-color-primary-50); color: var(--ep-color-primary-700); }

      .dph-steps__spin {
        width: 0.875rem;
        height: 0.875rem;
        border: 2px solid var(--ep-color-primary-200);
        border-top-color: var(--ep-color-primary-700);
        border-radius: 9999px;
        animation: dph-step-spin 0.7s linear infinite;
      }
      @keyframes dph-step-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .dph-steps__spin { animation: none; } }

      /* ── HORIZONTAL ───────────────────────────────────────────── */
      .dph-steps[data-variant='horizontal'] {
        list-style: none; margin: 0; padding: 0;
        display: flex; align-items: center; gap: 0;
      }
      .dph-steps[data-variant='horizontal'] .dph-steps__item {
        display: flex; align-items: center; flex: 1; min-width: 0;
      }
      .dph-steps__btn {
        display: inline-flex; align-items: center; gap: 0.5rem;
        padding: 0.5rem 0.625rem; background: transparent; border: none;
        cursor: pointer; text-align: left; color: var(--ep-color-neutral-600);
        touch-action: manipulation; min-height: 2.75rem; flex: 1; min-width: 0;
      }
      .dph-steps__btn[disabled] { cursor: default; }
      .dph-steps__btn:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; border-radius: var(--ep-radius-sm); }
      .dph-steps[data-variant='horizontal'] .dph-steps__item[data-state='active'] .dph-steps__btn { color: var(--ep-color-neutral-900); font-weight: 600; }
      .dph-steps[data-variant='horizontal'] .dph-steps__item[data-state='complete'] .dph-steps__btn { color: var(--ep-color-neutral-700); }
      .dph-steps[data-variant='horizontal'] .dph-steps__item[data-state='error'] .dph-steps__btn { color: var(--ep-color-danger-700); }

      .dph-steps__text { display: inline-flex; flex-direction: column; min-width: 0; line-height: 1.2; }
      .dph-steps__label { font-size: 0.8125rem; }
      .dph-steps__desc { font-size: 0.6875rem; color: var(--ep-color-neutral-500); }
      .dph-steps__opt { font-style: italic; color: var(--ep-color-neutral-500); font-weight: 400; }

      .dph-steps__connector {
        flex: 1; height: 2px; background-color: var(--ep-color-neutral-200);
        align-self: center; transition: background-color 300ms;
      }
      .dph-steps__item[data-state='complete'] + .dph-steps__item .dph-steps__connector,
      .dph-steps__item[data-state='complete'] .dph-steps__connector { background: var(--ep-color-palmetto-500); }

      .dph-steps__progress {
        margin-top: 0.5rem; height: 4px; background: var(--ep-color-neutral-200);
        border-radius: 9999px; overflow: hidden;
      }
      .dph-steps__progress-bar {
        height: 100%; background: var(--ep-gradient-brand-cool, var(--ep-color-primary-600));
        transition: width 300ms ease;
      }

      /* ── VERTICAL (with sub-steps + rail) ─────────────────────── */
      .dph-steps[data-variant='vertical'] {
        list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column;
      }
      .dph-steps[data-variant='vertical'] .dph-steps__item {
        display: flex; gap: 0.75rem; padding: 0.25rem 0; align-items: flex-start; min-height: 3rem;
      }
      .dph-steps__rail { display: flex; flex-direction: column; align-items: center; min-height: 100%; }
      .dph-steps__rail-line { flex: 1; width: 2px; background: var(--ep-color-neutral-200); margin: 0.25rem 0; min-height: 1.5rem; }
      .dph-steps[data-variant='vertical'] .dph-steps__item[data-state='complete'] .dph-steps__rail-line { background: var(--ep-color-palmetto-500); }
      .dph-steps__btn--vertical { padding: 0.25rem 0; align-items: flex-start; }
      .dph-steps__item--child .dph-steps__marker { width: 1.25rem; height: 1.25rem; font-size: 0.625rem; }

      /* ── PILL BAR ─────────────────────────────────────────────── */
      .dph-steps__pills {
        display: flex; flex-wrap: wrap; gap: 0;
        background: var(--ep-color-neutral-100); border-radius: 9999px;
        padding: 0.25rem; min-height: 2.5rem;
      }
      .dph-steps__pill {
        flex: 1;
        display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
        padding: 0.375rem 0.75rem; border: none; background: transparent;
        border-radius: 9999px; cursor: pointer;
        color: var(--ep-color-neutral-600); font-size: 0.8125rem;
        min-width: 0; min-height: 2rem;
      }
      .dph-steps__pill:disabled { cursor: default; }
      .dph-steps__pill[data-state='active'] { background: var(--ep-color-primary-700); color: #fff; font-weight: 600; }
      .dph-steps__pill[data-state='complete'] { color: var(--ep-color-palmetto-700); }
      .dph-steps__pill[data-state='error'] { background: var(--ep-color-danger-50); color: var(--ep-color-danger-700); }
      .dph-steps__pill-num {
        display: inline-grid; place-items: center; width: 1.25rem; height: 1.25rem;
        background: rgba(255,255,255,0.25); border-radius: 9999px; font-size: 0.625rem; font-weight: 700;
      }
      .dph-steps__pill[data-state='pending'] .dph-steps__pill-num { background: var(--ep-color-neutral-200); color: var(--ep-color-neutral-700); }
      .dph-steps__pill-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* ── PROGRESS BAR with notches ────────────────────────────── */
      .dph-steps__pbar { padding: 1rem 0.5rem 0.25rem; }
      .dph-steps__pbar-track {
        position: relative; height: 6px; background: var(--ep-color-neutral-200);
        border-radius: 9999px;
      }
      .dph-steps__pbar-fill {
        position: absolute; left: 0; top: 0; bottom: 0;
        background: var(--ep-gradient-brand-cool, var(--ep-color-primary-600));
        border-radius: 9999px; transition: width 350ms ease;
      }
      .dph-steps__pbar-notch {
        position: absolute; top: 50%; transform: translate(-50%, -50%);
        width: 1.5rem; height: 1.5rem; border-radius: 9999px; cursor: pointer;
        border: 2px solid #fff; background: var(--ep-color-neutral-300);
        font-size: 0.625rem; font-weight: 700; color: var(--ep-color-neutral-800);
        display: grid; place-items: center;
      }
      .dph-steps__pbar-notch[data-state='complete'] { background: var(--ep-color-palmetto-600); color: #fff; }
      .dph-steps__pbar-notch[data-state='active'] {
        background: var(--ep-color-primary-700); color: #fff;
        box-shadow: 0 0 0 4px var(--ep-color-primary-100);
      }
      .dph-steps__pbar-notch[data-state='error'] { background: var(--ep-color-danger-500); color: #fff; }
      .dph-steps__pbar-labels {
        margin-top: 1.5rem; display: flex; justify-content: space-between;
        font-size: 0.6875rem; color: var(--ep-color-neutral-500);
      }
      .dph-steps__pbar-active { color: var(--ep-color-primary-800); font-weight: 600; }

      /* ── CARDS ────────────────────────────────────────────────── */
      .dph-steps__cards {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        gap: 0.75rem;
      }
      .dph-steps__card {
        text-align: left; padding: 0.875rem; border-radius: var(--ep-radius-lg);
        border: 1px solid var(--ep-color-neutral-200); background: #fff;
        cursor: pointer; transition: border-color 120ms, box-shadow 120ms;
        display: flex; flex-direction: column; gap: 0.5rem;
      }
      .dph-steps__card:hover { border-color: var(--ep-color-primary-300); box-shadow: var(--ep-shadow-sm); }
      .dph-steps__card[data-state='active'] {
        border-color: var(--ep-color-primary-500);
        box-shadow: 0 0 0 3px var(--ep-color-primary-100);
      }
      .dph-steps__card[data-state='complete'] { border-color: var(--ep-color-palmetto-300); background: var(--ep-color-palmetto-50); }
      .dph-steps__card[data-state='error'] { border-color: var(--ep-color-danger-300); background: var(--ep-color-danger-50); }
      .dph-steps__card[disabled] { opacity: 0.5; cursor: not-allowed; }
      .dph-steps__card-head { display: flex; align-items: center; gap: 0.5rem; }
      .dph-steps__card-step { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ep-color-neutral-500); }
      .dph-steps__card-title { font-weight: 600; color: var(--ep-color-neutral-900); font-size: 0.9375rem; }
      .dph-steps__card-desc { font-size: 0.8125rem; color: var(--ep-color-neutral-600); }
      .dph-steps__card-time { font-size: 0.6875rem; color: var(--ep-color-neutral-500); display: inline-flex; align-items: center; gap: 0.25rem; }

      /* ── SPLIT ────────────────────────────────────────────────── */
      .dph-steps__split {
        display: grid; grid-template-columns: 14rem 1fr; gap: 1rem;
        border: 1px solid var(--ep-color-neutral-200); border-radius: var(--ep-radius-lg);
        background: #fff; min-height: 16rem;
      }
      @media (max-width: 767px) {
        .dph-steps__split { grid-template-columns: 1fr; }
        .dph-steps__split-rail { border-right: none; border-bottom: 1px solid var(--ep-color-neutral-200); }
      }
      .dph-steps__split-rail {
        list-style: none; margin: 0; padding: 0.5rem 0;
        border-right: 1px solid var(--ep-color-neutral-200);
        background: var(--ep-color-neutral-50);
        border-radius: var(--ep-radius-lg) 0 0 var(--ep-radius-lg);
      }
      .dph-steps__split-item { display: block; }
      .dph-steps__split-item--child { padding-left: 1rem; }
      .dph-steps__split-btn {
        width: 100%; display: flex; align-items: center; gap: 0.5rem;
        padding: 0.5rem 0.75rem; background: transparent; border: none;
        cursor: pointer; text-align: left; min-height: 2.5rem;
      }
      .dph-steps__split-btn[disabled] { cursor: default; opacity: 0.6; }
      .dph-steps__split-item[data-state='active'] .dph-steps__split-btn {
        background: var(--ep-color-primary-50); border-left: 3px solid var(--ep-color-primary-700);
      }
      .dph-steps__split-content { padding: 1rem; min-width: 0; }

      /* ── ACCORDION ────────────────────────────────────────────── */
      .dph-steps__acc {
        display: flex; flex-direction: column;
        border: 1px solid var(--ep-color-neutral-200); border-radius: var(--ep-radius-lg);
        overflow: hidden; background: #fff;
      }
      .dph-steps__acc-item + .dph-steps__acc-item { border-top: 1px solid var(--ep-color-neutral-200); }
      .dph-steps__acc-head {
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.75rem 1rem; cursor: pointer;
        list-style: none;
      }
      .dph-steps__acc-head::-webkit-details-marker { display: none; }
      .dph-steps__acc-title { flex: 1; font-weight: 500; color: var(--ep-color-neutral-800); font-size: 0.875rem; }

      /* ── DOTS ─────────────────────────────────────────────────── */
      .dph-steps__dots { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
      .dph-steps__dot {
        width: 0.625rem; height: 0.625rem; border-radius: 9999px;
        background: var(--ep-color-neutral-300); border: none; cursor: pointer; padding: 0;
        transition: transform 120ms;
      }
      .dph-steps__dot[data-state='active'] { background: var(--ep-color-primary-700); transform: scale(1.4); }
      .dph-steps__dot[data-state='complete'] { background: var(--ep-color-palmetto-500); }
      .dph-steps__dot[data-state='error'] { background: var(--ep-color-danger-500); }
      .dph-steps__dot[disabled] { cursor: default; }
      .dph-steps__dots-label { margin-left: 0.5rem; font-size: 0.75rem; color: var(--ep-color-neutral-700); }

      /* ── badges ───────────────────────────────────────────────── */
      .dph-steps__error-badge {
        margin-left: 0.25rem;
        display: inline-grid; place-items: center;
        min-width: 1.125rem; height: 1.125rem; padding: 0 0.25rem;
        background: var(--ep-color-danger-500); color: #fff; border-radius: 9999px;
        font-size: 0.625rem; font-weight: 700;
      }
      .dph-steps__chip {
        margin-left: 0.25rem;
        padding: 0.0625rem 0.375rem; border-radius: 9999px;
        font-size: 0.625rem; font-weight: 600;
        background: var(--ep-color-neutral-200); color: var(--ep-color-neutral-800);
      }
      .dph-steps__chip[data-severity='success'] { background: var(--ep-color-palmetto-100); color: var(--ep-color-palmetto-800); }
      .dph-steps__chip[data-severity='warning'] { background: var(--ep-color-jessamine-100); color: var(--ep-color-jessamine-800); }
      .dph-steps__chip[data-severity='danger']  { background: var(--ep-color-danger-100);  color: var(--ep-color-danger-700); }
      .dph-steps__chip[data-severity='info']    { background: var(--ep-color-primary-100); color: var(--ep-color-primary-800); }

      /* ── MOBILE collapse for horizontal labels ───────────────── */
      @media (max-width: 639px) {
        .dph-steps[data-variant='horizontal'] .dph-steps__text { display: none; }
        .dph-steps[data-variant='horizontal'] .dph-steps__item[data-state='active'] .dph-steps__text { display: inline-flex; }
      }
    `,
  ],
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
