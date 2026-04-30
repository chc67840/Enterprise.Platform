/**
 * ─── UI KIT DEMO — SPRINT 1 ADDITIONS ───────────────────────────────────────────
 *
 * Showcase pages for the Sprint 1 deliverables that didn't exist before
 * (`ChartWidget`, `SchemaForm` event channel, `ConfirmDialogService`,
 * `Drawer` size presets) plus the B.1 design-token playground. Each page is
 * independent and small — split into one file so the import surface in the
 * routes file stays flat.
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import { ConfirmDialogService } from '@core/services/confirm-dialog.service';
import {
  ButtonComponent,
  ChartWidgetComponent,
  DrawerComponent,
  InlineMessageComponent,
  SchemaFormComponent,
  type ChartWidgetConfig,
  type DrawerSize,
  type FormSchema,
  type SchemaFormEvent,
} from '@shared/components/dph';

const SECTION_STYLES = `
  :host { display: block; }
  .demo-grid { display: grid; gap: 1rem; }
  .demo-grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .demo-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (max-width: 768px) {
    .demo-grid--2,
    .demo-grid--3 { grid-template-columns: 1fr; }
  }
  .demo-section {
    padding: 1rem 1.25rem;
    border: 1px solid var(--ep-border-default, var(--ep-color-neutral-200));
    border-radius: var(--ep-radius-lg);
    background: var(--ep-bg-elevated, #ffffff);
    margin-bottom: 1rem;
  }
  .demo-section h3 {
    margin: 0 0 0.375rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--ep-text-primary, var(--ep-color-neutral-900));
  }
  .demo-section p {
    margin: 0 0 1rem;
    font-size: 0.8125rem;
    color: var(--ep-text-muted, var(--ep-color-neutral-600));
  }
  .demo-section pre {
    margin: 0;
    padding: 0.625rem 0.75rem;
    background: var(--ep-bg-sunken, var(--ep-color-neutral-100));
    border-radius: var(--ep-radius-md);
    font-size: 0.75rem;
    overflow-x: auto;
    color: var(--ep-text-secondary);
    font-family: ui-monospace, SFMono-Regular, monospace;
  }
  .demo-row { display: flex; flex-wrap: wrap; gap: 0.625rem; align-items: center; }
  .demo-stack { display: flex; flex-direction: column; gap: 0.625rem; }
  .demo-event-log {
    margin: 0;
    padding: 0.5rem 0.75rem;
    background: var(--ep-color-neutral-50);
    border-left: 3px solid var(--ep-color-primary-400);
    border-radius: 0 var(--ep-radius-sm) var(--ep-radius-sm) 0;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 0.75rem;
    color: var(--ep-color-neutral-700);
    max-height: 9rem;
    overflow-y: auto;
  }
  .demo-token-row {
    display: grid;
    grid-template-columns: 14rem 1fr;
    align-items: center;
    gap: 0.75rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--ep-radius-sm);
    font-size: 0.8125rem;
  }
  .demo-token-row code {
    background: var(--ep-color-neutral-100);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }
  .demo-token-swatch {
    height: 2rem;
    border-radius: var(--ep-radius-md);
    border: 1px solid var(--ep-color-neutral-200);
  }
`;

// ─── CHART WIDGET DEMO (P1.3) ────────────────────────────────────────────────

@Component({
  selector: 'app-demo-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartWidgetComponent, ButtonComponent],
  template: `
    <div class="demo-section">
      <h3>Bar chart — single dataset</h3>
      <p>
        Auto-assigns a palette colour per dataset. Toggle dark mode to see the
        <code>themeRevision</code> trick re-skin the chart without re-mounting.
      </p>
      <dph-chart-widget [config]="barConfig()" />
    </div>

    <div class="demo-section">
      <h3>Stacked bar — multi-dataset, comparative</h3>
      <p>Each series picks the next palette token.</p>
      <dph-chart-widget [config]="stackedConfig()" />
    </div>

    <div class="demo-section">
      <h3>Line chart with fill</h3>
      <p>
        <code>fill: true</code> derives a translucent <code>backgroundColor</code>
        from the series border colour via <code>color-mix()</code>.
      </p>
      <dph-chart-widget [config]="lineConfig()" />
    </div>

    <div class="demo-section">
      <h3>Pie / Doughnut / Polar — segmented</h3>
      <p>Segmented charts paint one palette colour per <em>label</em>, not per dataset.</p>
      <div class="demo-grid demo-grid--3">
        <dph-chart-widget [config]="pieConfig()" />
        <dph-chart-widget [config]="doughnutConfig()" />
        <dph-chart-widget [config]="polarConfig()" />
      </div>
    </div>

    <div class="demo-section">
      <h3>Radar — multi-axis comparison</h3>
      <dph-chart-widget [config]="radarConfig()" />
    </div>

    <div class="demo-section">
      <h3>Loading state</h3>
      <p>Render a skeleton at the configured height while data is in flight.</p>
      <dph-chart-widget [config]="barConfig()" [loading]="loading()" />
      <div class="demo-row" style="margin-top: 0.75rem;">
        <dph-button label="Toggle loading" variant="outline" (clicked)="toggleLoading()" />
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoChartComponent {
  protected readonly loading = signal<boolean>(false);

  protected toggleLoading(): void {
    this.loading.update((v) => !v);
  }

  protected readonly barConfig = signal<ChartWidgetConfig>({
    type: 'bar',
    title: 'Monthly active users',
    subtitle: 'Q1 2026',
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{ label: 'Users', data: [1240, 1480, 1820] }],
    height: '320px',
    showLegend: false,
  });

  protected readonly stackedConfig = signal<ChartWidgetConfig>({
    type: 'bar',
    title: 'Order volume by region',
    subtitle: 'Last 6 months',
    labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    datasets: [
      { label: 'NA', data: [320, 358, 401, 432, 468, 502] },
      { label: 'EMEA', data: [248, 271, 296, 318, 340, 362] },
      { label: 'APAC', data: [156, 174, 198, 221, 245, 268] },
    ],
    stacked: true,
    height: '320px',
    legendPosition: 'top',
  });

  protected readonly lineConfig = signal<ChartWidgetConfig>({
    type: 'line',
    title: 'Server response time',
    subtitle: 'p50 / p95 / p99 (ms)',
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
    datasets: [
      { label: 'p50', data: [42, 38, 41, 56, 62, 48], fill: true, tension: 0.35 },
      { label: 'p95', data: [128, 112, 121, 184, 212, 162], fill: true, tension: 0.35 },
      { label: 'p99', data: [256, 218, 240, 412, 526, 384], fill: true, tension: 0.35 },
    ],
    height: '320px',
  });

  protected readonly pieConfig = signal<ChartWidgetConfig>({
    type: 'pie',
    title: 'Browser share',
    labels: ['Chrome', 'Edge', 'Safari', 'Firefox', 'Other'],
    datasets: [{ label: 'Sessions', data: [62, 18, 11, 6, 3] }],
    height: '260px',
  });

  protected readonly doughnutConfig = signal<ChartWidgetConfig>({
    type: 'doughnut',
    title: 'Storage breakdown',
    labels: ['Database', 'Files', 'Cache', 'Free'],
    datasets: [{ label: 'GB', data: [240, 180, 60, 120] }],
    height: '260px',
  });

  protected readonly polarConfig = signal<ChartWidgetConfig>({
    type: 'polarArea',
    title: 'Department headcount',
    labels: ['Eng', 'Sales', 'Ops', 'Support', 'Finance'],
    datasets: [{ label: 'People', data: [38, 22, 14, 18, 9] }],
    height: '260px',
  });

  protected readonly radarConfig = signal<ChartWidgetConfig>({
    type: 'radar',
    title: 'Skill matrix — frontend candidates',
    labels: ['HTML/CSS', 'TypeScript', 'Angular', 'Testing', 'Accessibility', 'Design'],
    datasets: [
      { label: 'Senior', data: [92, 88, 85, 78, 80, 70] },
      { label: 'Mid',    data: [78, 72, 68, 64, 60, 55] },
    ],
    height: '360px',
  });
}

// ─── SCHEMA FORM DEMO (P1.1) ─────────────────────────────────────────────────

@Component({
  selector: 'app-demo-schema-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SchemaFormComponent],
  template: `
    <div class="demo-section">
      <h3>Profile schema (2-column)</h3>
      <p>
        Declarative schema → typed FormGroup → emitted via the new single
        <code>(onEvent)</code> channel (P1.1). Submit triggers
        <code>type: 'form:submit'</code>; field changes emit
        <code>type: 'form:patch'</code>.
      </p>
      <dph-schema-form
        [schema]="profileSchema"
        [initialValue]="initialValue"
        submitLabel="Save profile"
        cancelLabel="Discard"
        (onEvent)="onEvent($event)"
      />
    </div>

    <div class="demo-section">
      <h3>Event log</h3>
      <p>Most recent first — showing the <code>SchemaFormEvent</code> discriminated union in action.</p>
      @if (events().length === 0) {
        <pre class="demo-event-log">(no events yet — interact with the form above)</pre>
      } @else {
        <pre class="demo-event-log">@for (e of events(); track $index) {{{ e }}
}</pre>
      }
    </div>

    <div class="demo-section">
      <h3>3-column schema with hints + server-error mapping</h3>
      <p>
        The address fields use <code>columnSpan</code> overrides (street → full,
        city / state / postal → 1).
      </p>
      <dph-schema-form
        [schema]="addressSchema"
        submitLabel="Save address"
        [showActions]="true"
      />
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoSchemaFormComponent {
  protected readonly profileSchema: FormSchema = {
    columns: 2,
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true, autocomplete: 'given-name' },
      { key: 'lastName',  label: 'Last name',  type: 'text', required: true, autocomplete: 'family-name' },
      { key: 'email',     label: 'Email',      type: 'email', required: true, prefixIcon: 'pi pi-envelope' },
      { key: 'phone',     label: 'Phone',      type: 'tel',   prefixIcon: 'pi pi-phone' },
      {
        key: 'bio',
        label: 'Bio',
        type: 'textarea',
        rows: 4,
        maxLength: 240,
        hint: 'Up to 240 characters.',
        columnSpan: 'full',
      },
    ],
  };

  protected readonly addressSchema: FormSchema = {
    columns: 3,
    fields: [
      { key: 'street',     label: 'Street',     type: 'text', required: true, columnSpan: 'full' },
      { key: 'city',       label: 'City',       type: 'text', required: true },
      { key: 'state',      label: 'State / Province', type: 'text', required: true },
      { key: 'postalCode', label: 'Postal code', type: 'text', required: true },
    ],
  };

  protected readonly initialValue = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '',
    bio: '',
  };

  protected readonly events = signal<readonly string[]>([]);

  protected onEvent(event: SchemaFormEvent): void {
    const summary = this.summarise(event);
    this.events.update((prev) => [summary, ...prev].slice(0, 30));
  }

  private summarise(e: SchemaFormEvent): string {
    const time = new Date().toLocaleTimeString();
    switch (e.type) {
      case 'form:submit':  return `[${time}] form:submit → ${JSON.stringify(e.value)}`;
      case 'form:cancel':  return `[${time}] form:cancel`;
      case 'form:reset':   return `[${time}] form:reset`;
      case 'form:patch':   return `[${time}] form:patch  → ${JSON.stringify(e.value$)}`;
      case 'field:change': return `[${time}] field:change ${e.key} → ${JSON.stringify(e.value)}`;
      case 'field:blur':   return `[${time}] field:blur   ${e.key}`;
      case 'field:focus':  return `[${time}] field:focus  ${e.key}`;
      case 'section:toggle':     return `[${time}] section:toggle ${e.key} expanded=${e.expanded}`;
      case 'section:tab-change': return `[${time}] section:tab-change ${e.key} index=${e.index}`;
      case 'action:click':       return `[${time}] action:click ${e.action}`;
      default:
        return `[${time}] (unknown event)`;
    }
  }
}

// ─── CONFIRM DIALOG DEMO (P0.5) ──────────────────────────────────────────────

@Component({
  selector: 'app-demo-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent, InlineMessageComponent],
  template: `
    <div class="demo-section">
      <h3>Promise-based confirm dialogs</h3>
      <p>
        <code>ConfirmDialogService.ask()</code> resolves <code>true</code> on
        accept and <code>false</code> on reject — no per-callsite
        <code>accept/reject</code> boilerplate. Severity defaults the icon,
        button class and default-focus.
      </p>
      <div class="demo-row">
        <dph-button label="Info confirm" variant="outline" (clicked)="askInfo()" />
        <dph-button label="Success confirm" variant="outline" (clicked)="askSuccess()" />
        <dph-button label="Warn confirm" variant="outline" (clicked)="askWarn()" />
        <dph-button label="Destructive (askDestructive)" variant="danger" (clicked)="askDestructive()" />
      </div>
    </div>

    <div class="demo-section">
      <h3>Last result</h3>
      @if (result()) {
        <dph-inline-message
          [config]="{
            severity: result()!.accepted ? 'success' : 'neutral',
            summary: result()!.accepted ? 'Accepted' : 'Rejected',
            detail: result()!.label,
          }"
        />
      } @else {
        <p>(none yet — click any button above)</p>
      }
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoConfirmComponent {
  private readonly confirm = inject(ConfirmDialogService);
  protected readonly result = signal<{ readonly accepted: boolean; readonly label: string } | null>(null);

  protected async askInfo(): Promise<void> {
    const accepted = await this.confirm.ask({
      message: 'Subscribe to the weekly digest?',
      severity: 'info',
      acceptLabel: 'Subscribe',
    });
    this.result.set({ accepted, label: 'Subscribe to weekly digest' });
  }

  protected async askSuccess(): Promise<void> {
    const accepted = await this.confirm.ask({
      message: 'Mark this task as complete?',
      severity: 'success',
      acceptLabel: 'Complete',
    });
    this.result.set({ accepted, label: 'Mark task complete' });
  }

  protected async askWarn(): Promise<void> {
    const accepted = await this.confirm.ask({
      message: 'This file has unsaved changes. Continue without saving?',
      severity: 'warn',
      header: 'Unsaved changes',
      acceptLabel: 'Discard',
    });
    this.result.set({ accepted, label: 'Discard unsaved changes' });
  }

  protected async askDestructive(): Promise<void> {
    const accepted = await this.confirm.askDestructive({
      message: 'Permanently delete the user account "jane@example.com"? This cannot be undone.',
      header: 'Delete account',
      acceptLabel: 'Delete forever',
    });
    this.result.set({ accepted, label: 'Delete user account' });
  }
}

// ─── DRAWER SIZE PRESETS DEMO (P1.2) ─────────────────────────────────────────

@Component({
  selector: 'app-demo-drawer-sizes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent, DrawerComponent],
  template: `
    <div class="demo-section">
      <h3>Size presets — sm / md / lg / xl / full</h3>
      <p>Resolves to <code>320 / 480 / 640 / 960 / 100vw</code>. Top/bottom positions resolve to height instead.</p>
      <div class="demo-row">
        @for (s of sizes; track s) {
          <dph-button [label]="'Right ' + s" variant="outline" (clicked)="open(s, 'right')" />
        }
      </div>
      <div class="demo-row" style="margin-top: 0.5rem;">
        @for (s of sizes; track s) {
          <dph-button [label]="'Bottom ' + s" variant="ghost" (clicked)="open(s, 'bottom')" />
        }
      </div>
    </div>

    <dph-drawer
      [(visible)]="visible"
      [config]="{
        position: position(),
        size: size(),
        header: 'Drawer · ' + size() + ' · ' + position(),
      }"
    >
      <p>This is a <strong>{{ size() }}</strong> drawer anchored on the <strong>{{ position() }}</strong>.</p>
      <p>The named-slot <code>[drawerFooter]</code> auto-hides when empty, so this drawer renders without one.</p>
      <p>Try toggling other sizes from the buttons.</p>

      <ng-container drawerFooter>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <dph-button label="Cancel" variant="ghost" (clicked)="visible.set(false)" />
          <dph-button label="OK" (clicked)="visible.set(false)" />
        </div>
      </ng-container>
    </dph-drawer>
  `,
  styles: [SECTION_STYLES],
})
export class DemoDrawerSizesComponent {
  protected readonly sizes: readonly DrawerSize[] = ['sm', 'md', 'lg', 'xl', 'full'];
  protected readonly visible = signal<boolean>(false);
  protected readonly size = signal<DrawerSize>('md');
  protected readonly position = signal<'right' | 'bottom'>('right');

  protected open(size: DrawerSize, position: 'right' | 'bottom'): void {
    this.size.set(size);
    this.position.set(position);
    this.visible.set(true);
  }
}

// ─── DESIGN TOKENS DEMO (B.1) ────────────────────────────────────────────────

interface TokenSpec {
  readonly token: string;
  readonly description: string;
  readonly cssValue: string;
}

const TEXT_INTENTS: readonly TokenSpec[] = [
  { token: '--ep-text-primary',    description: 'Primary body text',           cssValue: 'color: var(--ep-text-primary)' },
  { token: '--ep-text-secondary',  description: 'Secondary content / hints',   cssValue: 'color: var(--ep-text-secondary)' },
  { token: '--ep-text-muted',      description: 'Tertiary / metadata',         cssValue: 'color: var(--ep-text-muted)' },
  { token: '--ep-text-disabled',   description: 'Disabled controls',           cssValue: 'color: var(--ep-text-disabled)' },
  { token: '--ep-text-inverse',    description: 'Text on dark / colored bg',   cssValue: 'color: var(--ep-text-inverse)' },
  { token: '--ep-text-link',       description: 'Hyperlink — default state',   cssValue: 'color: var(--ep-text-link)' },
];
const BG_INTENTS: readonly TokenSpec[] = [
  { token: '--ep-bg-canvas',    description: 'Page background',          cssValue: 'background: var(--ep-bg-canvas)' },
  { token: '--ep-bg-elevated',  description: 'Cards / modals / panels',  cssValue: 'background: var(--ep-bg-elevated)' },
  { token: '--ep-bg-sunken',    description: 'Inset wells / code blocks',cssValue: 'background: var(--ep-bg-sunken)' },
  { token: '--ep-bg-overlay',   description: 'Modal scrim',              cssValue: 'background: var(--ep-bg-overlay)' },
];
const BORDER_INTENTS: readonly TokenSpec[] = [
  { token: '--ep-border-subtle',  description: 'Separators (low contrast)',  cssValue: 'border-color: var(--ep-border-subtle)' },
  { token: '--ep-border-default', description: 'Default control borders',     cssValue: 'border-color: var(--ep-border-default)' },
  { token: '--ep-border-strong',  description: 'Active states',                cssValue: 'border-color: var(--ep-border-strong)' },
  { token: '--ep-border-focus',   description: 'Focus ring colour',            cssValue: 'border-color: var(--ep-border-focus)' },
];
const SPACING_INTENTS: readonly TokenSpec[] = [
  { token: '--ep-stack-xs',  description: 'Vertical rhythm — extra small', cssValue: 'gap: var(--ep-stack-xs)' },
  { token: '--ep-stack-sm',  description: 'Vertical rhythm — small',        cssValue: 'gap: var(--ep-stack-sm)' },
  { token: '--ep-stack-md',  description: 'Vertical rhythm — medium',       cssValue: 'gap: var(--ep-stack-md)' },
  { token: '--ep-stack-lg',  description: 'Vertical rhythm — large',        cssValue: 'gap: var(--ep-stack-lg)' },
  { token: '--ep-inline-md', description: 'Horizontal cluster — medium',    cssValue: 'gap: var(--ep-inline-md)' },
  { token: '--ep-inset-md',  description: 'Uniform inset padding',          cssValue: 'padding: var(--ep-inset-md)' },
];

@Component({
  selector: 'app-demo-tokens',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="demo-section">
      <h3>Semantic intent tokens (B.1)</h3>
      <p>
        Components consume <em>intent</em> tokens that resolve through the
        cascade — different in light/dark, density modes, or per-tenant
        overlays. Brand assets stay on scale tokens.
      </p>
    </div>

    <div class="demo-section">
      <h3>Text intents</h3>
      @for (t of textTokens; track t.token) {
        <div class="demo-token-row">
          <code>{{ t.token }}</code>
          <span [style.color]="'var(' + t.token + ')'">{{ t.description }}</span>
        </div>
      }
    </div>

    <div class="demo-section">
      <h3>Background intents</h3>
      @for (t of bgTokens; track t.token) {
        <div class="demo-token-row">
          <code>{{ t.token }}</code>
          <div class="demo-token-swatch" [style.background]="'var(' + t.token + ')'"></div>
        </div>
      }
    </div>

    <div class="demo-section">
      <h3>Border intents</h3>
      @for (t of borderTokens; track t.token) {
        <div class="demo-token-row">
          <code>{{ t.token }}</code>
          <div class="demo-token-swatch" [style.background]="'var(--ep-bg-elevated)'" [style.border]="'2px solid var(' + t.token + ')'"></div>
        </div>
      }
    </div>

    <div class="demo-section">
      <h3>Spacing semantics</h3>
      @for (t of spacingTokens; track t.token) {
        <div class="demo-token-row">
          <code>{{ t.token }}</code>
          <div [style.background]="'var(--ep-color-primary-100)'" [style.height.px]="32" [style.width]="'var(' + t.token + ')'"></div>
        </div>
      }
    </div>

    <div class="demo-section">
      <h3>Density modes — <code>[data-density]</code></h3>
      <p>
        The attribute selector rebinds <code>--ep-control-height</code> for the
        subtree. No prop drilling, no per-component <code>[size]</code> input.
      </p>
      <div class="demo-stack" data-density="compact">
        <span style="font-size: 0.75rem; color: var(--ep-text-muted);">data-density="compact"</span>
        <div class="demo-row">
          <dph-button label="Compact" />
          <dph-button label="Compact secondary" variant="secondary" />
          <dph-button label="Compact ghost" variant="ghost" />
        </div>
      </div>
      <div class="demo-stack" style="margin-top: 0.75rem;" data-density="comfortable">
        <span style="font-size: 0.75rem; color: var(--ep-text-muted);">data-density="comfortable" (default)</span>
        <div class="demo-row">
          <dph-button label="Comfortable" />
          <dph-button label="Comfortable secondary" variant="secondary" />
          <dph-button label="Comfortable ghost" variant="ghost" />
        </div>
      </div>
      <div class="demo-stack" style="margin-top: 0.75rem;" data-density="touch">
        <span style="font-size: 0.75rem; color: var(--ep-text-muted);">data-density="touch" (44px min target)</span>
        <div class="demo-row">
          <dph-button label="Touch" />
          <dph-button label="Touch secondary" variant="secondary" />
          <dph-button label="Touch ghost" variant="ghost" />
        </div>
      </div>
    </div>

    <div class="demo-section">
      <h3>Motion scale + reduced motion</h3>
      <p>
        Components using the <code>motion()</code> mixin consume
        <code>--ep-motion-scale</code>. <code>{{ '@media (prefers-reduced-motion: reduce)' }}</code>
        sets it to <code>0</code> — transitions snap to instant.
      </p>
      <div class="demo-row">
        <span style="font-size: 0.875rem;"><code>--ep-motion-scale: var(--ep-motion-scale, 1)</code></span>
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoTokensComponent {
  protected readonly textTokens = TEXT_INTENTS;
  protected readonly bgTokens = BG_INTENTS;
  protected readonly borderTokens = BORDER_INTENTS;
  protected readonly spacingTokens = SPACING_INTENTS;
}
