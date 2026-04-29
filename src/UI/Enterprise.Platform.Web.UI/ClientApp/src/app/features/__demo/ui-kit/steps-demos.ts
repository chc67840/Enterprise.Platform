/**
 * ─── STEPS DEMO — comprehensive showcase ────────────────────────────────────────
 *
 * Every variant × orientation × state × hierarchy depth × validation hook,
 * plus a fully-wired Sign-up wizard built on the kit (Steps + WizardButtons +
 * Form layout) with conditional steps + nested sub-steps + branching.
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  StepsComponent,
  ToastService,
  WizardButtonsComponent,
  type StepDescriptor,
  type StepsConfig,
  type WizardButtonsConfig,
} from '@shared/components/dph';

const SECTION_STYLES = `
  :host { display: block; }
  .dph-section { padding: 1.25rem; border: 1px solid var(--ep-color-neutral-200); border-radius: var(--ep-radius-lg); background: #fff; margin-bottom: 1rem; }
  .dph-section h3 { margin: 0 0 0.25rem; font-size: 0.9375rem; font-weight: 600; color: var(--ep-color-neutral-900); }
  .dph-section p { margin: 0 0 0.875rem; font-size: 0.8125rem; color: var(--ep-color-neutral-600); }
  .dph-section h3 .pill { display: inline-block; margin-left: 0.5rem; padding: 0.0625rem 0.5rem; background: var(--ep-color-primary-50); color: var(--ep-color-primary-800); border-radius: 9999px; font-size: 0.625rem; font-weight: 700; vertical-align: middle; }
  code { background: var(--ep-color-neutral-100); padding: 0.125rem 0.25rem; border-radius: 4px; font-size: 0.75rem; }
  .row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  .row > button {
    padding: 0.375rem 0.625rem; border: 1px solid var(--ep-color-neutral-300);
    background: #fff; border-radius: var(--ep-radius-md); cursor: pointer; font-size: 0.75rem;
  }
  .panel {
    padding: 1rem; background: var(--ep-color-neutral-50); border-radius: var(--ep-radius-md);
    min-height: 6rem; font-size: 0.875rem;
  }
  .panel h4 { margin: 0 0 0.5rem; font-size: 0.875rem; }
  .grid-2 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  @media (min-width: 768px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
`;

const BASIC_STEPS: readonly StepDescriptor[] = [
  { key: 'account',  label: 'Account',     icon: 'pi pi-user',     description: 'Create your login' },
  { key: 'profile',  label: 'Profile',     icon: 'pi pi-id-card',  description: 'Tell us about yourself' },
  { key: 'billing',  label: 'Billing',     icon: 'pi pi-credit-card', description: 'Plan + payment' },
  { key: 'review',   label: 'Review',      icon: 'pi pi-check',    description: 'Confirm and finish' },
];

@Component({
  selector: 'app-demo-steps',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, StepsComponent, WizardButtonsComponent],
  template: `
    <!-- ── 1. HORIZONTAL ───────────────────────────────────────────── -->
    <div class="dph-section">
      <h3>Horizontal — default <span class="pill">numbered · connectors · click to go back</span></h3>
      <p>Default variant. Click prior steps to navigate back. Forward navigation gated until that step is active.</p>
      <dph-steps [config]="{ steps: BASIC_STEPS, activeIndex: idx1(), variant: 'horizontal', showProgress: true }" (stepClick)="idx1.set($event.index)" />
      <div class="row" style="margin-top:0.75rem;">
        <button (click)="idx1.set(Math.max(0, idx1() - 1))">← Prev</button>
        <button (click)="idx1.set(Math.min(BASIC_STEPS.length - 1, idx1() + 1))">Next →</button>
        <button (click)="idx1.set(0)">Reset</button>
      </div>
    </div>

    <!-- ── 2. VERTICAL with sub-steps ──────────────────────────────── -->
    <div class="dph-section">
      <h3>Vertical with sub-steps <span class="pill">recursive nesting · rail line</span></h3>
      <p>
        <code>step.children</code> renders nested sub-steps in a tree-indented rail. Sub-steps share state
        derivation and contribute to the parent's progress.
      </p>
      <div style="max-width: 28rem;">
        <dph-steps [config]="{ steps: NESTED_STEPS, activeIndex: idx2(), variant: 'vertical', allowFreeNav: true }" (stepClick)="idx2.set($event.index)" />
      </div>
    </div>

    <!-- ── 3. PILL BAR ─────────────────────────────────────────────── -->
    <div class="dph-section">
      <h3>Pill bar <span class="pill">connected segments · dense</span></h3>
      <p>Best for 3-5 short labels. Active step gets the brand fill. Wraps gracefully.</p>
      <dph-steps [config]="{ steps: BASIC_STEPS, activeIndex: idx3(), variant: 'pill-bar' }" (stepClick)="idx3.set($event.index)" />
    </div>

    <!-- ── 4. PROGRESS BAR with notches ────────────────────────────── -->
    <div class="dph-section">
      <h3>Progress bar with milestones <span class="pill">single bar · notch markers</span></h3>
      <p>
        Linear-progress feel with clickable notch markers. Active step pulses with a brand halo. Works well
        for 5-10 steps where verbose labels would be too noisy.
      </p>
      <dph-steps [config]="{ steps: SEVEN_STEPS, activeIndex: idx4(), variant: 'progress' }" (stepClick)="idx4.set($event.index)" />
    </div>

    <!-- ── 5. CARDS ────────────────────────────────────────────────── -->
    <div class="dph-section">
      <h3>Cards <span class="pill">grid · time hint · hover</span></h3>
      <p>Each step is a card. Great for long descriptions or settings overviews. Time hint shown when <code>step.time</code> is set.</p>
      <dph-steps [config]="{ steps: TIMED_STEPS, activeIndex: idx5(), variant: 'cards', allowFreeNav: true }" (stepClick)="idx5.set($event.index)" />
    </div>

    <!-- ── 6. SPLIT (rail + content slot) ──────────────────────────── -->
    <div class="dph-section">
      <h3>Split — rail + content slot <span class="pill">native projection · responsive</span></h3>
      <p>Left rail = step nav, right pane = active step content (projected via <code>&lt;ng-content&gt;</code>). Collapses to stacked on mobile.</p>
      <dph-steps [config]="{ steps: BASIC_STEPS, activeIndex: idx6(), variant: 'split', allowFreeNav: true }" (stepClick)="idx6.set($event.index)">
        <div>
          <h4 style="margin-top:0;">{{ BASIC_STEPS[idx6()]?.label }}</h4>
          <p>{{ BASIC_STEPS[idx6()]?.description }}</p>
          <div class="panel">Step content for "{{ BASIC_STEPS[idx6()]?.label }}" goes here.</div>
        </div>
      </dph-steps>
    </div>

    <!-- ── 7. ACCORDION ────────────────────────────────────────────── -->
    <div class="dph-section">
      <h3>Accordion <span class="pill">expand inline · checklist-style</span></h3>
      <p>One step at a time. Suitable for guided setup where each step has a meaningful body without leaving the page.</p>
      <dph-steps [config]="{ steps: BASIC_STEPS, activeIndex: idx7(), variant: 'accordion' }" />
    </div>

    <!-- ── 8. DOTS (compact) ───────────────────────────────────────── -->
    <div class="dph-section">
      <h3>Dots <span class="pill">10+ steps · mobile carousels</span></h3>
      <p>Minimal. Active step's label shown next to the row. Tap a dot to jump. Ideal for image carousels or onboarding screens.</p>
      <dph-steps [config]="{ steps: TEN_STEPS, activeIndex: idx8(), variant: 'dots', allowFreeNav: true }" (stepClick)="idx8.set($event.index)" />
    </div>

    <!-- ── 9. ALL STATES SHOWCASE ──────────────────────────────────── -->
    <div class="dph-section">
      <h3>All 8 states in one view <span class="pill">pending · active · complete · error · warning · skipped · disabled · loading</span></h3>
      <p>
        States can be auto-derived from <code>activeIndex</code> or explicitly set via <code>step.state</code>.
        Shown here as a vertical wizard for clarity, with <code>errorCount</code> and <code>badge</code>
        decorations on selected steps.
      </p>
      <div style="max-width: 32rem;">
        <dph-steps [config]="{ steps: STATEFUL_STEPS, activeIndex: 2, variant: 'vertical' }" />
      </div>
    </div>

    <!-- ── 10. FULLY WIRED WIZARD ──────────────────────────────────── -->
    <div class="dph-section">
      <h3>Fully wired wizard <span class="pill">steps + buttons + validation · async submit</span></h3>
      <p>
        End-to-end: <code>&lt;dph-steps&gt;</code> + <code>&lt;dph-wizard-buttons&gt;</code> + a tiny form.
        Per-step validation gates Next; final step shows a sticky finish action with async loading state.
        Conditional steps appear/hide based on prior choices.
      </p>
      <div class="grid-2">
        <div>
          <dph-steps [config]="wizardConfig()" (stepClick)="goTo($event.index)" />
        </div>
        <div class="panel">
          @switch (wizardIdx()) {
            @case (0) {
              <h4>Account</h4>
              <label style="display:block; font-size:0.75rem;">Email
                <input type="email" [(ngModel)]="form.email" style="display:block; width:100%; padding:0.375rem; margin-top:0.25rem; border:1px solid var(--ep-color-neutral-300); border-radius:4px;" />
              </label>
              <label style="display:block; font-size:0.75rem; margin-top:0.5rem;">Password
                <input type="password" [(ngModel)]="form.password" style="display:block; width:100%; padding:0.375rem; margin-top:0.25rem; border:1px solid var(--ep-color-neutral-300); border-radius:4px;" />
              </label>
            }
            @case (1) {
              <h4>Profile</h4>
              <label style="display:block; font-size:0.75rem;">Display name
                <input type="text" [(ngModel)]="form.name" style="display:block; width:100%; padding:0.375rem; margin-top:0.25rem; border:1px solid var(--ep-color-neutral-300); border-radius:4px;" />
              </label>
              <label style="display:block; font-size:0.75rem; margin-top:0.5rem;">Account type
                <select [(ngModel)]="form.kind" style="display:block; width:100%; padding:0.375rem; margin-top:0.25rem; border:1px solid var(--ep-color-neutral-300); border-radius:4px;">
                  <option value="personal">Personal</option>
                  <option value="business">Business</option>
                </select>
              </label>
              <p style="font-size: 0.6875rem; margin-top:0.5rem; color: var(--ep-color-neutral-500);">
                Choosing "Business" inserts the Company step (conditional).
              </p>
            }
            @case (2) {
              @if (form.kind === 'business') {
                <h4>Company</h4>
                <label style="display:block; font-size:0.75rem;">Company name
                  <input type="text" [(ngModel)]="form.company" style="display:block; width:100%; padding:0.375rem; margin-top:0.25rem; border:1px solid var(--ep-color-neutral-300); border-radius:4px;" />
                </label>
                <label style="display:block; font-size:0.75rem; margin-top:0.5rem;">Tax ID
                  <input type="text" [(ngModel)]="form.taxId" style="display:block; width:100%; padding:0.375rem; margin-top:0.25rem; border:1px solid var(--ep-color-neutral-300); border-radius:4px;" />
                </label>
              } @else {
                <h4>Billing</h4>
                <p style="font-size: 0.8125rem;">Pick a plan and provide a card.</p>
              }
            }
            @case (3) {
              <h4>{{ form.kind === 'business' ? 'Billing' : 'Review' }}</h4>
              <pre style="font-size: 0.6875rem;">{{ form | json }}</pre>
            }
            @case (4) {
              <h4>Review</h4>
              <pre style="font-size: 0.6875rem;">{{ form | json }}</pre>
              <p style="font-size: 0.75rem;">Click Finish to simulate an async submit (1.5s).</p>
            }
          }
          <dph-wizard-buttons
            [config]="wizardButtons()"
            (back)="back()"
            (next)="next()"
            (cancel)="reset()"
            (finish)="finish()"
          />
        </div>
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoStepsComponent {
  protected readonly toast = inject(ToastService);
  protected readonly Math = Math;

  protected readonly BASIC_STEPS = BASIC_STEPS;

  protected readonly NESTED_STEPS: readonly StepDescriptor[] = [
    {
      key: 'setup', label: 'Project setup', description: 'Create + configure', icon: 'pi pi-cog',
      children: [
        { key: 'project', label: 'New project', description: 'Name + visibility' },
        { key: 'team', label: 'Add team members' },
      ],
    },
    {
      key: 'integration', label: 'Integrations', icon: 'pi pi-link',
      children: [
        { key: 'github', label: 'GitHub' },
        { key: 'slack', label: 'Slack' },
        { key: 'jira', label: 'Jira', optional: true },
      ],
    },
    {
      key: 'launch', label: 'Launch', icon: 'pi pi-rocket',
      children: [
        { key: 'preview', label: 'Preview' },
        { key: 'go-live', label: 'Go live' },
      ],
    },
  ];

  protected readonly SEVEN_STEPS: readonly StepDescriptor[] = [
    { key: 'a', label: 'Plan', icon: 'pi pi-flag' },
    { key: 'b', label: 'Design', icon: 'pi pi-pencil' },
    { key: 'c', label: 'Build', icon: 'pi pi-cog' },
    { key: 'd', label: 'Test', icon: 'pi pi-check-circle' },
    { key: 'e', label: 'Stage', icon: 'pi pi-cloud' },
    { key: 'f', label: 'Ship', icon: 'pi pi-send' },
    { key: 'g', label: 'Monitor', icon: 'pi pi-chart-line' },
  ];

  protected readonly TIMED_STEPS: readonly StepDescriptor[] = [
    { key: 'a', label: 'Configure DNS', description: 'Point your domain at our nameservers.', icon: 'pi pi-globe', time: 5 },
    { key: 'b', label: 'Verify ownership', description: 'TXT record, takes 2-5 min to propagate.', icon: 'pi pi-shield', time: 5 },
    { key: 'c', label: 'Issue certificate', description: "Let's Encrypt provisioning + HSTS.", icon: 'pi pi-lock', time: 3 },
    { key: 'd', label: 'Smoke test', description: 'Verify HTTPS, CSP headers, redirects.', icon: 'pi pi-bolt', time: 2 },
  ];

  protected readonly TEN_STEPS: readonly StepDescriptor[] = Array.from({ length: 10 }, (_, i) => ({
    key: String(i),
    label: `Slide ${i + 1}`,
  }));

  protected readonly STATEFUL_STEPS: readonly StepDescriptor[] = [
    { key: '1', label: 'Account created',  state: 'complete', description: 'Email verified · password set' },
    { key: '2', label: 'Profile complete', state: 'complete', description: 'All required fields' },
    { key: '3', label: 'Billing',          state: 'active',   description: 'Choose plan and card' },
    { key: '4', label: 'Identity check',   state: 'loading',  description: 'Awaiting third-party verification' },
    { key: '5', label: 'Compliance',       state: 'warning',  description: 'Some fields need attention', errorCount: 2 },
    { key: '6', label: 'Tax info',         state: 'error',    description: 'Required for billing', errorCount: 1, badge: { value: 'REQ', severity: 'danger' } },
    { key: '7', label: 'Add team',         state: 'skipped',  description: 'Skipped — single-user account' },
    { key: '8', label: 'Advanced settings', state: 'disabled', description: 'Unlocks after launch' },
  ];

  // Variant index controls
  protected readonly idx1 = signal<number>(1);
  protected readonly idx2 = signal<number>(3);
  protected readonly idx3 = signal<number>(2);
  protected readonly idx4 = signal<number>(3);
  protected readonly idx5 = signal<number>(1);
  protected readonly idx6 = signal<number>(0);
  protected readonly idx7 = signal<number>(1);
  protected readonly idx8 = signal<number>(4);

  // Wired wizard
  protected readonly wizardIdx = signal<number>(0);
  protected readonly form = {
    email: '',
    password: '',
    name: '',
    kind: 'personal' as 'personal' | 'business',
    company: '',
    taxId: '',
  };
  protected readonly submitting = signal<boolean>(false);

  protected readonly wizardSteps = computed<readonly StepDescriptor[]>(() => {
    const isBusiness = this.form.kind === 'business';
    return [
      { key: 'account', label: 'Account', icon: 'pi pi-user' },
      { key: 'profile', label: 'Profile', icon: 'pi pi-id-card' },
      { key: 'company', label: 'Company', icon: 'pi pi-building', when: () => isBusiness },
      { key: 'billing', label: 'Billing', icon: 'pi pi-credit-card' },
      { key: 'review',  label: 'Review',  icon: 'pi pi-check' },
    ];
  });

  protected readonly wizardConfig = computed<StepsConfig>(() => ({
    steps: this.wizardSteps(),
    activeIndex: this.wizardIdx(),
    variant: 'vertical',
    showProgress: false,
  }));

  protected readonly wizardButtons = computed<WizardButtonsConfig>(() => {
    const idx = this.wizardIdx();
    const total = this.wizardSteps().length;
    return {
      isFirst: idx === 0,
      isLast: idx === total - 1,
      nextDisabled: !this.canAdvance(idx),
      nextLoading: this.submitting(),
      sticky: false,
    };
  });

  protected canAdvance(idx: number): boolean {
    const step = this.wizardSteps()[idx];
    if (!step) return false;
    if (step.key === 'account') return !!this.form.email && this.form.password.length >= 6;
    if (step.key === 'profile') return !!this.form.name;
    if (step.key === 'company') return !!this.form.company && !!this.form.taxId;
    return true;
  }

  protected goTo(i: number): void {
    if (i <= this.wizardIdx()) this.wizardIdx.set(i);
  }
  protected back(): void {
    this.wizardIdx.update((i) => Math.max(0, i - 1));
  }
  protected next(): void {
    this.wizardIdx.update((i) => Math.min(this.wizardSteps().length - 1, i + 1));
  }
  protected reset(): void {
    this.wizardIdx.set(0);
    this.form.email = '';
    this.form.password = '';
    this.form.name = '';
    this.form.kind = 'personal';
    this.form.company = '';
    this.form.taxId = '';
  }
  protected finish(): void {
    this.submitting.set(true);
    setTimeout(() => {
      this.submitting.set(false);
      this.toast.success('Account created', `Welcome, ${this.form.name || this.form.email}!`);
      this.reset();
    }, 1500);
  }
}
