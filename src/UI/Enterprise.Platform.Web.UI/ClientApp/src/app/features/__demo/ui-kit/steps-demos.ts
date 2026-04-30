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
  ButtonComponent,
  InputComponent,
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

  /* Wired-wizard form helpers (section 10). */
  .wired-form { display: flex; flex-direction: column; gap: 0.625rem; }
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
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    InputComponent,
    StepsComponent,
    WizardButtonsComponent,
  ],
  template: `
    <!-- ── 1. HORIZONTAL ───────────────────────────────────────────── -->
    <div class="dph-section">
      <h3>Horizontal — default <span class="pill">numbered · connectors · click to go back</span></h3>
      <p>Default variant. Click prior steps to navigate back. Forward navigation gated until that step is active.</p>
      <dph-steps [config]="{ steps: BASIC_STEPS, activeIndex: idx1(), variant: 'horizontal', showProgress: true }" (stepClick)="idx1.set($event.index)" />
      <div class="row" style="margin-top:0.75rem;">
        <dph-button label="Prev" icon="pi pi-arrow-left" variant="outline" size="sm" [disabled]="idx1() === 0" (clicked)="idx1.set(Math.max(0, idx1() - 1))" />
        <dph-button label="Next" icon="pi pi-arrow-right" iconPosition="right" size="sm" [disabled]="idx1() >= BASIC_STEPS.length - 1" (clicked)="idx1.set(Math.min(BASIC_STEPS.length - 1, idx1() + 1))" />
        <dph-button label="Reset" variant="ghost" size="sm" (clicked)="idx1.set(0)" />
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

    <!-- ── 6. SPLIT (rail + sub-steps + content slot + bottom toolbar) ── -->
    <div class="dph-section">
      <h3>Split — rail + sub-steps + bottom toolbar <span class="pill">parent groups · prev/next/submit · validation gating · async submit</span></h3>
      <p>
        Real onboarding flow: 4 grouped sections with 9 flat steps. Parents act as group
        headings; sub-steps carry the actual content. Previous (bottom-left), Next
        (bottom-right) and Submit (final step) wire through to the same flat-index nav.
        Children render indented in the rail with NO connector line. <code>visited</code>
        tracking, server-error preview, optional steps and skip + reset all wired.
      </p>

      <dph-steps
        [config]="{ steps: SPLIT_STEPS, activeIndex: splitIdx(), variant: 'split', allowFreeNav: true, showHelp: true }"
        (stepClick)="splitGoTo($event.index)"
      >
        <div class="ep-wizard-pane">
          <!-- ── breadcrumb: group › step (+ optional chip) ───────────── -->
          <div class="ep-wizard-pane__crumb">
            @if (splitParent()) {
              <span class="ep-wizard-pane__crumb-group">{{ splitParent()!.label }}</span>
              <i class="pi pi-angle-right" aria-hidden="true"></i>
            }
            <span class="ep-wizard-pane__crumb-step">{{ splitCurrent()?.label }}</span>
            @if (splitCurrent()?.optional) {
              <span class="ep-wizard-pane__crumb-chip">optional</span>
            }
          </div>

          <h4 class="ep-wizard-pane__title">{{ splitCurrent()?.label }}</h4>

          <!-- ── per-step content (DPH primitives only) ───────────────── -->
          <div class="ep-wizard-pane__body">
            @switch (splitCurrent()?.key) {
              @case ('login') {
                <dph-input
                  [(value)]="splitForm.email"
                  [config]="{ type: 'email', label: 'Email', placeholder: 'you@example.com', prefixIcon: 'pi pi-envelope', required: true, autocomplete: 'email' }"
                />
                <dph-input
                  [(value)]="splitForm.password"
                  [config]="{ type: 'password', label: 'Password', placeholder: 'At least 8 characters', required: true, hint: 'Minimum 8 characters', autocomplete: 'new-password' }"
                />
                @if (splitForm.email && splitForm.password.length < 8) {
                  <div class="ep-wizard-pane__hint ep-wizard-pane__hint--warn">
                    <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>Password must be 8+ characters.
                  </div>
                }
              }
              @case ('verify-email') {
                <p class="ep-wizard-pane__callout">
                  <i class="pi pi-envelope" aria-hidden="true"></i>
                  We sent a 6-digit code to <strong>{{ splitForm.email || 'your email' }}</strong>.
                </p>
                <div class="ep-wizard-pane__otp">
                  <dph-input
                    [(value)]="splitForm.otp"
                    [config]="{ type: 'text', label: 'Verification code', placeholder: '123456', maxLength: 6, autocomplete: 'one-time-code' }"
                  />
                </div>
                <dph-button label="Resend code" variant="link" size="sm" (clicked)="splitResend()" />
              }
              @case ('identity') {
                <dph-input
                  [(value)]="splitForm.name"
                  [config]="{ type: 'text', label: 'Display name', placeholder: 'Jane Doe', required: true, autocomplete: 'name' }"
                />
                <dph-input
                  [(value)]="splitForm.bio"
                  [config]="{ type: 'textarea', label: 'Bio', placeholder: 'A few words about yourself…', rows: 3, hint: 'Optional', maxLength: 240, showCounter: true }"
                />
              }
              @case ('avatar') {
                <p class="ep-wizard-pane__desc">Pick a default avatar (or skip — you can change this any time).</p>
                <div class="ep-avatar-pick" role="radiogroup" aria-label="Avatar choice">
                  @for (av of AVATAR_OPTS; track av; let i = $index) {
                    <button type="button"
                      class="ep-avatar-swatch"
                      [class.ep-avatar-swatch--active]="splitForm.avatar === av"
                      [style.background]="av"
                      role="radio"
                      [attr.aria-checked]="splitForm.avatar === av"
                      [attr.aria-label]="'Avatar ' + (i + 1)"
                      (click)="splitForm.avatar = av; splitForm = { ...splitForm }"
                    ></button>
                  }
                </div>
              }
              @case ('plan') {
                <div class="ep-plan-cards" role="radiogroup" aria-label="Choose a plan">
                  @for (p of PLAN_OPTS; track p.id) {
                    <label class="ep-plan-card" [class.ep-plan-card--active]="splitForm.plan === p.id">
                      <input type="radio" name="splitPlan" [value]="p.id" [(ngModel)]="splitForm.plan" />
                      <span class="ep-plan-card__title">
                        {{ p.label }}
                        <span class="ep-plan-card__price">{{ p.price }}</span>
                      </span>
                      <span class="ep-plan-card__desc">{{ p.desc }}</span>
                    </label>
                  }
                </div>
              }
              @case ('payment') {
                <dph-input
                  [(value)]="splitForm.card"
                  [config]="{ type: 'text', label: 'Card number', placeholder: '4242 4242 4242 4242', maxLength: 19, prefixIcon: 'pi pi-credit-card', autocomplete: 'cc-number' }"
                />
                <div style="display:flex; gap:0.5rem;">
                  <div style="flex:1;">
                    <dph-input
                      [(value)]="splitForm.expiry"
                      [config]="{ type: 'text', label: 'Expiry', placeholder: 'MM/YY', maxLength: 5, autocomplete: 'cc-exp' }"
                    />
                  </div>
                  <div style="flex:1;">
                    <dph-input
                      [(value)]="splitForm.cvc"
                      [config]="{ type: 'text', label: 'CVC', placeholder: '123', maxLength: 4, autocomplete: 'cc-csc' }"
                    />
                  </div>
                </div>
                <div class="ep-wizard-pane__hint">
                  <i class="pi pi-lock" aria-hidden="true"></i>Demo only — no card data leaves this page.
                </div>
              }
              @case ('review') {
                <p class="ep-wizard-pane__desc">Confirm everything looks right. Click Submit to create your account.</p>
                <dl class="ep-wizard-pane__summary">
                  <dt>Email</dt><dd>{{ splitForm.email || '—' }}</dd>
                  <dt>Name</dt><dd>{{ splitForm.name || '—' }}</dd>
                  <dt>Bio</dt><dd>{{ splitForm.bio || '—' }}</dd>
                  <dt>Avatar</dt><dd>{{ splitForm.avatar ? 'Selected' : 'Skipped' }}</dd>
                  <dt>Plan</dt><dd>{{ planLabel(splitForm.plan) }}</dd>
                  <dt>Card</dt><dd>{{ splitForm.card ? '•••• ' + splitForm.card.slice(-4) : '—' }}</dd>
                </dl>
                <label class="ep-wizard-pane__terms">
                  <input type="checkbox" [(ngModel)]="splitForm.terms" />
                  <span>I agree to the Terms of Service and Privacy Policy.</span>
                </label>
              }
              @default { <div class="panel">No content for this step.</div> }
            }
          </div>

          <!-- ── toolbar: Previous (left) · progress · Skip · Next/Submit (right) ── -->
          <div class="ep-wizard-pane__toolbar">
            <div class="ep-wizard-pane__toolbar-left">
              <dph-button
                label="Previous"
                icon="pi pi-arrow-left"
                variant="outline"
                [disabled]="splitIsFirst()"
                (clicked)="splitBack()"
              />
              <dph-button label="Reset" variant="ghost" (clicked)="splitReset()" />
            </div>
            <div class="ep-wizard-pane__toolbar-right">
              <span class="ep-wizard-pane__progress">Step {{ splitLeafIndex() + 1 }} of {{ SPLIT_FLAT.length }}</span>
              @if (splitCurrent()?.optional) {
                <dph-button label="Skip" variant="ghost" (clicked)="splitNext()" />
              }
              @if (splitIsLast()) {
                <dph-button
                  label="Submit"
                  icon="pi pi-check"
                  variant="primary"
                  [loading]="splitSubmitting()"
                  loadingText="Submitting…"
                  [disabled]="!splitForm.terms"
                  (clicked)="splitSubmit()"
                />
              } @else {
                <dph-button
                  label="Next"
                  icon="pi pi-arrow-right"
                  iconPosition="right"
                  variant="primary"
                  [disabled]="!splitCanAdvance()"
                  (clicked)="splitNext()"
                />
              }
            </div>
          </div>
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
              <div class="wired-form">
                <dph-input
                  [(value)]="form.email"
                  [config]="{ type: 'email', label: 'Email', placeholder: 'you@example.com', required: true, autocomplete: 'email' }"
                />
                <dph-input
                  [(value)]="form.password"
                  [config]="{ type: 'password', label: 'Password', required: true, hint: 'Minimum 6 characters', autocomplete: 'new-password' }"
                />
              </div>
            }
            @case (1) {
              <h4>Profile</h4>
              <div class="wired-form">
                <dph-input
                  [(value)]="form.name"
                  [config]="{ type: 'text', label: 'Display name', required: true, autocomplete: 'name' }"
                />
                <fieldset style="border:none; padding:0; margin:0;">
                  <legend style="font-size:0.75rem; font-weight:500; color:var(--ep-color-neutral-700); padding:0; margin-bottom:0.25rem;">Account type</legend>
                  <div style="display:flex; gap:0.75rem;">
                    <label style="font-size:0.8125rem; display:flex; align-items:center; gap:0.375rem;">
                      <input type="radio" name="wizardKind" value="personal" [(ngModel)]="form.kind" />
                      Personal
                    </label>
                    <label style="font-size:0.8125rem; display:flex; align-items:center; gap:0.375rem;">
                      <input type="radio" name="wizardKind" value="business" [(ngModel)]="form.kind" />
                      Business
                    </label>
                  </div>
                </fieldset>
                <p style="font-size: 0.6875rem; margin: 0; color: var(--ep-color-neutral-500);">
                  Choosing "Business" inserts the Company step (conditional).
                </p>
              </div>
            }
            @case (2) {
              @if (form.kind === 'business') {
                <h4>Company</h4>
                <div class="wired-form">
                  <dph-input
                    [(value)]="form.company"
                    [config]="{ type: 'text', label: 'Company name', required: true, autocomplete: 'organization' }"
                  />
                  <dph-input
                    [(value)]="form.taxId"
                    [config]="{ type: 'text', label: 'Tax ID', required: true }"
                  />
                </div>
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

  /**
   * Sub-step structure for the advanced split rail. Top-level steps act as
   * group headings; their children are the actual flat steps the wizard
   * iterates through. The split rail flattens the tree (depth + indent) so
   * Previous / Next walk the linear order regardless of nesting.
   */
  protected readonly SPLIT_STEPS: readonly StepDescriptor[] = [
    {
      key: 'group-account', label: 'Account', icon: 'pi pi-user', description: 'Sign in details',
      children: [
        { key: 'login', label: 'Login', description: 'Email + password' },
        { key: 'verify-email', label: 'Verify email', description: 'Check your inbox' },
      ],
    },
    {
      key: 'group-profile', label: 'Profile', icon: 'pi pi-id-card', description: 'About you',
      children: [
        { key: 'identity', label: 'Identity', description: 'Display name + bio' },
        { key: 'avatar', label: 'Avatar', description: 'Upload or pick', optional: true },
      ],
    },
    {
      key: 'group-billing', label: 'Plan', icon: 'pi pi-credit-card', description: 'Choose a plan',
      children: [
        { key: 'plan', label: 'Choose plan' },
        { key: 'payment', label: 'Payment' },
      ],
    },
    { key: 'review', label: 'Review', icon: 'pi pi-check', description: 'Confirm and submit' },
  ];

  /**
   * Pre-flattened version (parents excluded — we treat them as group headers
   * the user CAN click but never "lands on" via Next). The actual nav order.
   * Index here matches the index emitted by `(stepClick)` because the rail
   * indexes parents as well, so we use a `STAGES` / `STAGES_FLAT` lookup
   * helper below to reconcile.
   */
  protected readonly SPLIT_FLAT: readonly { key: string; flatIdx: number; parentKey: string | null; label: string; optional: boolean }[] = [
    { key: 'login',         flatIdx: 1, parentKey: 'group-account', label: 'Login',         optional: false },
    { key: 'verify-email',  flatIdx: 2, parentKey: 'group-account', label: 'Verify email',  optional: false },
    { key: 'identity',      flatIdx: 4, parentKey: 'group-profile', label: 'Identity',      optional: false },
    { key: 'avatar',        flatIdx: 5, parentKey: 'group-profile', label: 'Avatar',        optional: true  },
    { key: 'plan',          flatIdx: 7, parentKey: 'group-billing', label: 'Choose plan',   optional: false },
    { key: 'payment',       flatIdx: 8, parentKey: 'group-billing', label: 'Payment',       optional: false },
    { key: 'review',        flatIdx: 9, parentKey: null,             label: 'Review',        optional: false },
  ];

  protected readonly AVATAR_OPTS: readonly string[] = [
    'linear-gradient(135deg, #1B3F73, #5F7FB4)',
    'linear-gradient(135deg, #1F5328, #66BC79)',
    'linear-gradient(135deg, #F4B82E, #FBE38A)',
    'linear-gradient(135deg, #B91C1C, #F87171)',
    'linear-gradient(135deg, #6D28D9, #C4B5FD)',
    'linear-gradient(135deg, #0E7490, #67E8F9)',
  ];

  protected readonly PLAN_OPTS: readonly { id: 'free' | 'pro' | 'team'; label: string; price: string; desc: string }[] = [
    { id: 'free', label: 'Starter',  price: '$0/mo',   desc: 'Personal projects, 1 user, community support.' },
    { id: 'pro',  label: 'Pro',      price: '$19/mo',  desc: '5 projects, priority support, custom domain.' },
    { id: 'team', label: 'Team',     price: '$49/mo',  desc: 'Unlimited projects, SSO, audit log, 24/7 support.' },
  ];

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
  // splitIdx — flat index for the advanced split-with-substeps wizard
  // (default lands on the FIRST sub-step, "Login" at flatIdx 1; flatIdx 0 is
  // the "Account" group header which has no actionable content).
  protected readonly splitIdx = signal<number>(1);
  protected readonly idx7 = signal<number>(1);
  protected readonly idx8 = signal<number>(4);

  // ── ADVANCED SPLIT WIZARD STATE ────────────────────────────────────────
  protected splitForm = {
    email: '',
    password: '',
    otp: '',
    name: '',
    bio: '',
    avatar: '' as string,
    plan: 'pro' as 'free' | 'pro' | 'team',
    card: '',
    expiry: '',
    cvc: '',
    terms: false,
  };
  protected readonly splitSubmitting = signal<boolean>(false);

  /** The step the user is currently on (a leaf, not a group). */
  protected readonly splitCurrent = computed(() =>
    this.SPLIT_FLAT.find((f) => f.flatIdx === this.splitIdx()) ?? null,
  );

  /** Parent group descriptor for the current leaf (used in the breadcrumb). */
  protected readonly splitParent = computed(() => {
    const current = this.splitCurrent();
    if (!current?.parentKey) return null;
    return this.SPLIT_STEPS.find((s) => s.key === current.parentKey) ?? null;
  });

  /** True when the user is on the very first leaf in the flat order. */
  protected readonly splitIsFirst = computed(() => {
    const idx = this.splitIdx();
    const first = this.SPLIT_FLAT[0];
    return !first || idx <= first.flatIdx;
  });

  /** True when the user is on the LAST leaf — Submit replaces Next. */
  protected readonly splitIsLast = computed(() => {
    const last = this.SPLIT_FLAT[this.SPLIT_FLAT.length - 1];
    return !!last && this.splitIdx() === last.flatIdx;
  });

  /** Per-step validation: whether Next/Submit may proceed from the current step. */
  protected splitCanAdvance(): boolean {
    const step = this.splitCurrent();
    if (!step) return false;
    switch (step.key) {
      case 'login':
        return !!this.splitForm.email && this.splitForm.password.length >= 8;
      case 'verify-email':
        return /^\d{6}$/.test(this.splitForm.otp);
      case 'identity':
        return !!this.splitForm.name.trim();
      case 'avatar':
        return true; // optional
      case 'plan':
        return !!this.splitForm.plan;
      case 'payment':
        return this.splitForm.card.replace(/\s/g, '').length >= 13
          && /^\d{2}\/\d{2}$/.test(this.splitForm.expiry)
          && this.splitForm.cvc.length >= 3;
      case 'review':
        return this.splitForm.terms;
      default:
        return true;
    }
  }

  /**
   * The current 0-based position in the leaves-only flat order. Used by the
   * "Step X of N" indicator so the user counts only the actionable steps,
   * not the parent group headings.
   */
  protected readonly splitLeafIndex = computed<number>(() => {
    const cur = this.splitCurrent();
    if (!cur) return 0;
    return this.SPLIT_FLAT.findIndex((f) => f.flatIdx === cur.flatIdx);
  });

  /** Map of parent key → first child's flat index, used for parent-click jumps. */
  private readonly PARENT_FIRST_CHILD = new Map<string, number>(
    this.SPLIT_STEPS
      .filter((p) => !!p.children?.length)
      .map((p) => {
        const firstLeaf = this.SPLIT_FLAT.find((f) => f.parentKey === p.key);
        return [p.key, firstLeaf?.flatIdx ?? 0] as const;
      }),
  );

  /** Move to a specific flat index — parent clicks jump to first child. */
  protected splitGoTo(targetFlatIdx: number): void {
    const isLeaf = this.SPLIT_FLAT.some((f) => f.flatIdx === targetFlatIdx);
    if (isLeaf) {
      this.splitIdx.set(targetFlatIdx);
      return;
    }
    // Resolve parent at this flat index. The split rail emits the parent's
    // own flat index when a group heading is clicked. Walk through the steps
    // tree to find which parent that corresponds to.
    let walked = 0;
    for (const parent of this.SPLIT_STEPS) {
      if (walked === targetFlatIdx) {
        const first = this.PARENT_FIRST_CHILD.get(parent.key);
        if (first !== undefined) this.splitIdx.set(first);
        return;
      }
      walked += 1 + (parent.children?.length ?? 0);
    }
  }

  protected splitBack(): void {
    const cur = this.SPLIT_FLAT.findIndex((f) => f.flatIdx === this.splitIdx());
    if (cur > 0) this.splitIdx.set(this.SPLIT_FLAT[cur - 1]!.flatIdx);
  }

  protected splitNext(): void {
    const cur = this.SPLIT_FLAT.findIndex((f) => f.flatIdx === this.splitIdx());
    if (cur >= 0 && cur < this.SPLIT_FLAT.length - 1) {
      this.splitIdx.set(this.SPLIT_FLAT[cur + 1]!.flatIdx);
    }
  }

  protected splitReset(): void {
    this.splitForm = {
      email: '', password: '', otp: '',
      name: '', bio: '', avatar: '',
      plan: 'pro', card: '', expiry: '', cvc: '',
      terms: false,
    };
    this.splitIdx.set(this.SPLIT_FLAT[0]!.flatIdx);
  }

  protected splitResend(): void {
    this.toast.info('Code sent', 'A new 6-digit code is on its way.');
  }

  protected splitSubmit(): void {
    if (!this.splitForm.terms || this.splitSubmitting()) return;
    this.splitSubmitting.set(true);
    setTimeout(() => {
      this.splitSubmitting.set(false);
      this.toast.success('Welcome aboard!', `Account ready for ${this.splitForm.email}.`);
      this.splitReset();
    }, 1500);
  }

  protected planLabel(id: string): string {
    return this.PLAN_OPTS.find((p) => p.id === id)?.label ?? '—';
  }

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
