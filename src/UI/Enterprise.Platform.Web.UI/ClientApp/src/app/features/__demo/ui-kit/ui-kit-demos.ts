/**
 * ─── UI KIT DEMO — 14 CATEGORY PAGES ────────────────────────────────────────────
 *
 * One showcase component per UI Kit category. Each shows variants + edge
 * cases + a link back to the landing. Permanent — this is the team's
 * living component reference.
 *
 * Kept in a single file because each page is small, mostly static, and
 * splitting into 14 folders adds churn without benefit.
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  AvatarComponent,
  ButtonComponent,
  ContextMenuComponent,
  DialogComponent,
  DrawerComponent,
  DropdownMenuComponent,
  FieldErrorComponent,
  FileListComponent,
  FilePreviewComponent,
  FileUploadComponent,
  FloatLabelComponent,
  FormLayoutComponent,
  GalleryComponent,
  ImageComponent,
  InlineMessageComponent,
  InputComponent,
  ListComponent,
  PanelComponent,
  PopoverComponent,
  StepsComponent,
  ToastService,
  TooltipDirective,
  TreeComponent,
  type FileItem,
  type TreeNode,
} from '@shared/components/dph';

const SECTION_STYLES = `
  :host { display: block; }
  .dph-section { padding: 1.25rem; border: 1px solid var(--ep-color-neutral-200); border-radius: var(--ep-radius-lg); background: #fff; margin-bottom: 1rem; }
  .dph-section h3 { margin: 0 0 0.5rem; font-size: 0.9375rem; font-weight: 600; color: var(--ep-color-neutral-900); }
  .dph-section p { margin: 0 0 0.875rem; font-size: 0.8125rem; color: var(--ep-color-neutral-600); }
  .dph-row { display: flex; flex-wrap: wrap; gap: 0.625rem; align-items: center; }
  .dph-stack { display: flex; flex-direction: column; gap: 0.625rem; }
  .dph-grid-2 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  @media (min-width: 768px) { .dph-grid-2 { grid-template-columns: 1fr 1fr; } }
  code { background: var(--ep-color-neutral-100); padding: 0.125rem 0.25rem; border-radius: 4px; font-size: 0.75rem; }
`;

// ─── BUTTON ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-demo-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <div class="dph-section">
      <h3>Variants</h3>
      <p>7 variants: primary, secondary, ghost, outline, danger, link, icon.</p>
      <div class="dph-row">
        <dph-button label="Primary" />
        <dph-button label="Secondary" variant="secondary" />
        <dph-button label="Ghost" variant="ghost" />
        <dph-button label="Outline" variant="outline" />
        <dph-button label="Danger" variant="danger" />
        <dph-button label="Link" variant="link" />
        <dph-button variant="icon" icon="pi pi-cog" ariaLabel="Settings" />
      </div>
    </div>

    <div class="dph-section">
      <h3>Sizes</h3>
      <p>5 sizes: xs, sm, md (default), lg, xl.</p>
      <div class="dph-row">
        <dph-button label="XS" size="xs" />
        <dph-button label="Small" size="sm" />
        <dph-button label="Medium" size="md" />
        <dph-button label="Large" size="lg" />
        <dph-button label="XL" size="xl" />
      </div>
    </div>

    <div class="dph-section">
      <h3>States</h3>
      <p>Disabled, loading, with icon (left/right), badge, raised, rounded, full-width.</p>
      <div class="dph-stack">
        <div class="dph-row">
          <dph-button label="Disabled" [disabled]="true" />
          <dph-button label="Loading" [loading]="true" loadingText="Saving…" />
          <dph-button label="Save" icon="pi pi-save" />
          <dph-button label="Next" icon="pi pi-arrow-right" iconPosition="right" />
        </div>
        <div class="dph-row">
          <dph-button label="Notifications" icon="pi pi-bell" badge="3" badgeSeverity="danger" />
          <dph-button label="Raised" [raised]="true" variant="secondary" />
          <dph-button label="Rounded pill" [rounded]="true" variant="outline" />
          <dph-button label="With tooltip" tooltip="This shows on hover" variant="ghost" />
        </div>
        <dph-button label="Full-width primary" [fullWidth]="true" />
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoButtonComponent {}

// ─── INPUT ───────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-demo-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, InputComponent],
  template: `
    <div class="dph-section">
      <h3>Types</h3>
      <p>text, email, password, number, search, textarea — all share the same wrapper API.</p>
      <div class="dph-grid-2">
        <dph-input [(value)]="textVal" [config]="{ type: 'text', label: 'Display name', placeholder: 'Jane Doe', required: true }" />
        <dph-input [(value)]="emailVal" [config]="{ type: 'email', label: 'Email', prefixIcon: 'pi pi-envelope', placeholder: 'you@example.com' }" />
        <dph-input [(value)]="pwdVal" [config]="{ type: 'password', label: 'Password', required: true, hint: 'Minimum 8 characters' }" />
        <dph-input [(value)]="numVal" [config]="{ type: 'number', label: 'Quantity', min: 0, max: 100, step: 1, suffixText: 'units' }" />
        <dph-input [(value)]="searchVal" [config]="{ type: 'search', label: 'Search', prefixIcon: 'pi pi-search', clearable: true, placeholder: 'Type to filter…' }" />
        <dph-input [(value)]="bioVal" [config]="{ type: 'textarea', label: 'Bio', rows: 3, maxLength: 240, showCounter: true, hint: 'Tell us about yourself' }" />
      </div>
    </div>

    <div class="dph-section">
      <h3>States</h3>
      <p>Disabled, readonly, invalid (with error), loading.</p>
      <div class="dph-grid-2">
        <dph-input [config]="{ type: 'text', label: 'Disabled', placeholder: 'Cannot edit', disabled: true }" />
        <dph-input [config]="{ type: 'text', label: 'Readonly', readonly: true }" [(value)]="readonlyVal" />
        <dph-input [config]="{ type: 'email', label: 'Invalid', errors: ['Email is required'], required: true }" />
        <dph-input [config]="{ type: 'text', label: 'Loading suffix', loading: true, placeholder: 'Validating…' }" />
      </div>
    </div>

    <div class="dph-section">
      <h3>Float label</h3>
      <p>Set <code>floatLabel: true</code>. Label animates from inside to above.</p>
      <div class="dph-grid-2">
        <dph-input [(value)]="floatVal" [config]="{ type: 'text', label: 'Email address', floatLabel: true }" />
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoInputComponent {
  protected textVal = signal<string>('');
  protected emailVal = signal<string>('');
  protected pwdVal = signal<string>('');
  protected numVal = signal<number | null>(10);
  protected searchVal = signal<string>('');
  protected bioVal = signal<string>('');
  protected readonlyVal = signal<string>('Locked value');
  protected floatVal = signal<string>('');
}

// ─── FLOAT LABEL ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-demo-float-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, FloatLabelComponent],
  template: `
    <div class="dph-section">
      <h3>Float label variants</h3>
      <p>Three modes: <code>over</code>, <code>in</code>, <code>on</code>.</p>
      <div class="dph-grid-2">
        <dph-float-label [config]="{ label: 'On variant (default)', variant: 'on', labelId: 'fl-1' }">
          <input id="fl-1" pInputText [(ngModel)]="v1" />
        </dph-float-label>
        <dph-float-label [config]="{ label: 'In variant', variant: 'in', labelId: 'fl-2' }">
          <input id="fl-2" pInputText [(ngModel)]="v2" />
        </dph-float-label>
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoFloatLabelComponent {
  protected v1 = '';
  protected v2 = '';
}

// ─── FIELD ERROR ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-demo-field-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldErrorComponent],
  template: `
    <div class="dph-section">
      <h3>Single vs multiple errors</h3>
      <p>Default shows first only; <code>showAll: true</code> renders the full list.</p>
      <div class="dph-stack">
        <dph-field-error [errors]="['Email is required']" id="e1" />
        <dph-field-error [errors]="['Email is required', 'Email must be valid', 'Domain not allowed']" [showAll]="true" id="e2" />
      </div>
    </div>
    <div class="dph-section">
      <h3>Touched gating</h3>
      <p>Pass <code>touched: false</code> to hide errors on untouched fields.</p>
      <div class="dph-stack">
        <dph-field-error [errors]="['This will not show']" [touched]="false" [dirty]="false" id="e3" />
        <p style="font-size:0.75rem;color:#666;">↑ nothing renders because touched/dirty both false</p>
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoFieldErrorComponent {}

// ─── FORM LAYOUT ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-demo-form-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormLayoutComponent, InputComponent, ButtonComponent],
  template: `
    <div class="dph-section">
      <h3>2-column grid (collapses to 1 below sm)</h3>
      <dph-form-layout [config]="{ variant: 'grid', columns: 2, gap: 'md' }">
        <dph-input [config]="{ type: 'text', label: 'First name', required: true }" />
        <dph-input [config]="{ type: 'text', label: 'Last name', required: true }" />
        <dph-input [config]="{ type: 'email', label: 'Email', required: true }" />
        <dph-input [config]="{ type: 'tel', label: 'Phone' }" />
        <ng-container slot="footer">
          <dph-button label="Cancel" variant="ghost" />
          <dph-button label="Save" icon="pi pi-save" />
        </ng-container>
      </dph-form-layout>
    </div>

    <div class="dph-section">
      <h3>3-column grid (lg+ → 2-col md → 1-col sm)</h3>
      <dph-form-layout [config]="{ variant: 'grid', columns: 3, gap: 'sm' }">
        <dph-input [config]="{ type: 'text', label: 'City' }" />
        <dph-input [config]="{ type: 'text', label: 'State' }" />
        <dph-input [config]="{ type: 'text', label: 'Postal code' }" />
      </dph-form-layout>
    </div>

    <div class="dph-section">
      <h3>Inline (horizontal, wraps)</h3>
      <dph-form-layout [config]="{ variant: 'inline', gap: 'sm' }">
        <dph-input [config]="{ type: 'search', label: 'Search', prefixIcon: 'pi pi-search' }" />
        <dph-button label="Apply" icon="pi pi-filter" />
        <dph-button label="Reset" variant="ghost" />
      </dph-form-layout>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoFormLayoutComponent {}

// ─── DATA TABLE — comprehensive demo lives in its own file ──────────────────
export { DemoDataTableComponent } from './data-table-demos';

// ─── STEPS — comprehensive demo lives in its own file ───────────────────────
export { DemoStepsComponent } from './steps-demos';

// ─── LIST ────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-demo-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListComponent],
  template: `
    <div class="dph-grid-2">
      <div class="dph-section">
        <h3>Simple list with dividers</h3>
        <dph-list [config]="{ variant: 'simple', dividers: true }" [items]="items" />
      </div>
      <div class="dph-section">
        <h3>Ordered list</h3>
        <dph-list [config]="{ variant: 'ordered' }" [items]="items" />
      </div>
      <div class="dph-section">
        <h3>Selectable</h3>
        <dph-list [config]="{ variant: 'selectable', selectionMode: 'single', dividers: true }" [items]="items" />
      </div>
      <div class="dph-section">
        <h3>Checklist</h3>
        <dph-list [config]="{ variant: 'checklist', selectionMode: 'multiple' }" [items]="items" />
      </div>
      <div class="dph-section">
        <h3>Empty state</h3>
        <dph-list [config]="{ variant: 'simple', emptyMessage: 'No tasks' }" [items]="[]" />
      </div>
      <div class="dph-section">
        <h3>Compact + striped</h3>
        <dph-list [config]="{ variant: 'simple', compact: true, striped: true }" [items]="items" />
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoListComponent {
  protected readonly items = ['Apples', 'Bread', 'Coffee', 'Eggs', 'Milk', 'Yogurt'];
}

// ─── TREE ────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-demo-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TreeComponent],
  template: `
    <div class="dph-section">
      <h3>Hierarchical tree with selection + filter</h3>
      <dph-tree [config]="{ selectionMode: 'single', filter: true, scrollHeight: '300px' }" [nodes]="nodes" />
    </div>
    <div class="dph-section">
      <h3>Checkbox selection (multi-select)</h3>
      <dph-tree [config]="{ selectionMode: 'checkbox' }" [nodes]="nodes" />
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoTreeComponent {
  protected readonly nodes: readonly TreeNode[] = [
    {
      key: 'eng', label: 'Engineering', icon: 'pi pi-cog',
      children: [
        { key: 'eng-fe', label: 'Frontend', icon: 'pi pi-palette',
          children: [{ key: 'eng-fe-web', label: 'Web' }, { key: 'eng-fe-mob', label: 'Mobile' }] },
        { key: 'eng-be', label: 'Backend', icon: 'pi pi-server',
          children: [{ key: 'eng-be-api', label: 'API' }, { key: 'eng-be-data', label: 'Data Platform' }] },
        { key: 'eng-qa', label: 'Quality', icon: 'pi pi-shield' },
      ],
    },
    {
      key: 'sales', label: 'Sales', icon: 'pi pi-chart-line',
      children: [
        { key: 'sales-na', label: 'North America' },
        { key: 'sales-eu', label: 'Europe' },
      ],
    },
  ];
}

// ─── PANEL ───────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-demo-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelComponent, ButtonComponent],
  template: `
    <div class="dph-grid-2">
      <dph-panel [config]="{ variant: 'default', header: 'Default panel', subheader: 'Plain border' }">
        Content goes here. Default has a thin neutral border.
        <ng-container slot="footer"><dph-button label="OK" size="sm" /></ng-container>
      </dph-panel>

      <dph-panel [config]="{ variant: 'elevated', header: 'Elevated', icon: 'pi pi-star' }">
        Soft drop-shadow, no border. Use for cards that should "lift" off the page.
      </dph-panel>

      <dph-panel [config]="{ variant: 'flat', header: 'Flat', subheader: 'Neutral background' }">
        Background tinted neutral-50. Good for sub-sections inside a larger card.
      </dph-panel>

      <dph-panel [config]="{ variant: 'ghost', header: 'Ghost', subheader: 'Transparent' }">
        No background, no border. Hierarchical grouping without visual weight.
      </dph-panel>

      <dph-panel [config]="{ variant: 'elevated', header: 'Collapsible', collapsible: true }">
        Click the chevron in the header to collapse. State preserved per instance.
      </dph-panel>

      <dph-panel [config]="{ variant: 'elevated', header: 'Loading state', loading: true }">
        Body is overlayed with a loading spinner.
      </dph-panel>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoPanelComponent {}

// ─── OVERLAY (dialog + drawer + popover + tooltip) ──────────────────────────

@Component({
  selector: 'app-demo-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DialogComponent, DrawerComponent, PopoverComponent, TooltipDirective],
  template: `
    <div class="dph-section">
      <h3>Dialog</h3>
      <dph-button label="Open dialog" (clicked)="dialogOpen.set(true)" />
      <dph-dialog [(visible)]="dialogOpen" [config]="{ header: 'Confirm action', subheader: 'This is a centered modal.', width: 'min(420px, 92vw)' }">
        <p>Dialogs use <code>appendTo: 'body'</code>, escape closes, mask click dismisses, focus is trapped.</p>
        <ng-container slot="footer">
          <dph-button label="Cancel" variant="ghost" (clicked)="dialogOpen.set(false)" />
          <dph-button label="Confirm" (clicked)="dialogOpen.set(false)" />
        </ng-container>
      </dph-dialog>
    </div>

    <div class="dph-section">
      <h3>Drawer</h3>
      <div class="dph-row">
        <dph-button label="Open from right" icon="pi pi-arrow-right" iconPosition="right" (clicked)="drawerOpen.set(true)" />
      </div>
      <dph-drawer [(visible)]="drawerOpen" [config]="{ position: 'right', header: 'Filters', width: 'min(360px, 90vw)' }">
        <p>Right-anchored drawer. Min(360px, 90vw) keeps a backdrop tappable on every viewport.</p>
        <dph-button label="Apply" [fullWidth]="true" />
      </dph-drawer>
    </div>

    <div class="dph-section">
      <h3>Popover</h3>
      <dph-popover [config]="{ maxWidth: '320px' }">
        <dph-button slot="trigger" label="Show details" variant="outline" icon="pi pi-info-circle" />
        <ng-container slot="content">
          <h4 style="margin:0 0 0.5rem;font-size:0.875rem;font-weight:600;">Popover content</h4>
          <p style="margin:0;font-size:0.8125rem;color:var(--ep-color-neutral-700);">
            Click outside or press Escape to dismiss.
          </p>
        </ng-container>
      </dph-popover>
    </div>

    <div class="dph-section">
      <h3>Tooltip directive</h3>
      <p>Add <code>dphTooltip</code> + <code>dphTooltipPosition</code> to any element.</p>
      <div class="dph-row">
        <dph-button label="Hover me" dphTooltip="Tooltip on bottom" dphTooltipPosition="bottom" />
        <dph-button label="Or me" variant="ghost" dphTooltip="Tooltip on top" dphTooltipPosition="top" />
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoOverlayComponent {
  protected readonly dialogOpen = signal<boolean>(false);
  protected readonly drawerOpen = signal<boolean>(false);
}

// ─── MEDIA (image + avatar + gallery) ───────────────────────────────────────

@Component({
  selector: 'app-demo-media',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageComponent, AvatarComponent, GalleryComponent],
  template: `
    <div class="dph-section">
      <h3>Avatar — sizes + shapes + initials + badge</h3>
      <div class="dph-row">
        <dph-avatar [config]="{ name: 'Jane Doe', size: 'xs' }" />
        <dph-avatar [config]="{ name: 'Jane Doe', size: 'sm' }" />
        <dph-avatar [config]="{ name: 'Jane Doe', size: 'md' }" />
        <dph-avatar [config]="{ name: 'Jane Doe', size: 'lg' }" />
        <dph-avatar [config]="{ name: 'Jane Doe', size: 'xl' }" />
        <dph-avatar [config]="{ name: 'Jane Doe', size: '2xl' }" />
      </div>
      <div class="dph-row" style="margin-top:0.75rem">
        <dph-avatar [config]="{ name: 'Square', shape: 'square', size: 'lg' }" />
        <dph-avatar [config]="{ icon: 'pi pi-user', size: 'lg' }" />
        <dph-avatar [config]="{ name: 'With Badge', size: 'lg', badge: { value: '3', severity: 'danger' } }" />
        <dph-avatar [config]="{ name: 'Custom Color', size: 'lg', bgColor: 'var(--ep-color-jessamine-200)', textColor: 'var(--ep-color-jessamine-900)' }" />
      </div>
    </div>

    <div class="dph-section">
      <h3>Image — fallback + skeleton</h3>
      <div class="dph-grid-2">
        <dph-image [config]="{ src: '/favicon.ico', alt: 'Favicon', skeleton: true, aspectRatio: '1/1' }" />
        <dph-image [config]="{ src: '/does-not-exist.png', alt: 'Missing', fallbackSrc: '/favicon.ico', aspectRatio: '1/1' }" />
      </div>
    </div>

    <div class="dph-section">
      <h3>Gallery — responsive grid</h3>
      <dph-gallery [config]="{ columns: 4, items: galleryItems }" />
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoMediaComponent {
  protected readonly galleryItems = Array.from({ length: 8 }, (_, i) => ({
    src: '/favicon.ico',
    alt: `Item ${i + 1}`,
    caption: `Item ${i + 1}`,
  }));
}

// ─── MENU (dropdown + context + steps) ─────────────────────────────────────

@Component({
  selector: 'app-demo-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DropdownMenuComponent, ContextMenuComponent, StepsComponent],
  template: `
    <div class="dph-section">
      <h3>Dropdown menu (click trigger)</h3>
      <dph-dropdown-menu [config]="{ items: menuItems }">
        <dph-button label="Actions" icon="pi pi-chevron-down" iconPosition="right" variant="outline" />
      </dph-dropdown-menu>
    </div>

    <div class="dph-section">
      <h3>Context menu (right-click target area)</h3>
      <dph-context-menu [config]="{ items: menuItems }">
        <div style="padding: 2rem; border: 2px dashed var(--ep-color-neutral-300); border-radius: var(--ep-radius-lg); text-align: center; color: var(--ep-color-neutral-600);">
          Right-click anywhere in this area
        </div>
      </dph-context-menu>
    </div>

    <div class="dph-section">
      <h3>Steps — wizard progress</h3>
      <dph-steps [config]="{ activeIndex: stepIdx(), steps: wizardSteps }" (stepClick)="stepIdx.set($event.index)" />
      <div class="dph-row" style="margin-top: 1rem;">
        <dph-button label="Previous" variant="ghost" [disabled]="stepIdx() === 0" (clicked)="stepIdx.set(stepIdx() - 1)" />
        <dph-button label="Next" [disabled]="stepIdx() >= wizardSteps.length - 1" (clicked)="stepIdx.set(stepIdx() + 1)" />
      </div>
    </div>

    <div class="dph-section">
      <h3>Steps — vertical variant</h3>
      <dph-steps [config]="{ activeIndex: 1, variant: 'vertical', steps: wizardSteps }" />
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoMenuComponent {
  protected readonly stepIdx = signal<number>(0);
  protected readonly menuItems = [
    { id: 'edit', label: 'Edit', icon: 'pi pi-pencil', command: () => console.info('edit') },
    { id: 'duplicate', label: 'Duplicate', icon: 'pi pi-copy', command: () => console.info('duplicate') },
    { id: 'sep1', label: '', separator: true },
    { id: 'archive', label: 'Archive', icon: 'pi pi-folder', command: () => console.info('archive') },
    { id: 'delete', label: 'Delete', icon: 'pi pi-trash', command: () => console.info('delete') },
  ];
  protected readonly wizardSteps = [
    { key: 'account', label: 'Account', icon: 'pi pi-user', description: 'Basic info' },
    { key: 'prefs', label: 'Preferences', icon: 'pi pi-cog', description: 'Tune your settings' },
    { key: 'review', label: 'Review', icon: 'pi pi-check', description: 'Confirm and finish' },
  ];
}

// ─── MESSAGE (inline + toast) ──────────────────────────────────────────────

@Component({
  selector: 'app-demo-message',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InlineMessageComponent, ButtonComponent],
  template: `
    <div class="dph-section">
      <h3>Inline messages — 5 severities</h3>
      <div class="dph-stack">
        <dph-inline-message [config]="{ severity: 'info', summary: 'Heads up', detail: 'Informational message.', closable: true }" />
        <dph-inline-message [config]="{ severity: 'success', summary: 'Success', detail: 'Operation completed cleanly.', closable: true }" />
        <dph-inline-message [config]="{ severity: 'warning', summary: 'Approaching limit', detail: 'Trial expires in 7 days.', closable: true, actions: [{ label: 'Renew', key: 'renew' }] }" />
        <dph-inline-message [config]="{ severity: 'danger', summary: 'Error', detail: 'Something went wrong.', closable: true }" />
        <dph-inline-message [config]="{ severity: 'neutral', summary: 'Note', detail: 'Neutral context.' }" />
      </div>
    </div>

    <div class="dph-section">
      <h3>Filled variant</h3>
      <div class="dph-stack">
        <dph-inline-message [config]="{ severity: 'success', summary: 'Filled', detail: 'High-emphasis variant.', filled: true }" />
        <dph-inline-message [config]="{ severity: 'danger', summary: 'Filled danger', detail: 'For critical alerts.', filled: true }" />
      </div>
    </div>

    <div class="dph-section">
      <h3>Toast service</h3>
      <p>Click any button — toast appears via the global <code>&lt;p-toast&gt;</code> in the app shell.</p>
      <div class="dph-row">
        <dph-button label="Success" variant="primary" (clicked)="toast.success('Saved!', 'Your changes have been saved.')" />
        <dph-button label="Info" variant="secondary" (clicked)="toast.info('FYI', 'Just so you know.')" />
        <dph-button label="Warning" variant="outline" (clicked)="toast.warning('Heads up', 'Trial expires in 3 days.')" />
        <dph-button label="Error" variant="danger" (clicked)="toast.error('Oops', 'Failed to save changes.')" />
        <dph-button label="Sticky" variant="ghost" (clicked)="toast.show({ severity: 'info', summary: 'Sticky', detail: 'Stays until dismissed.', sticky: true })" />
      </div>
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoMessageComponent {
  protected readonly toast = inject(ToastService);
}

// ─── FILE (upload + list + preview) ─────────────────────────────────────────

@Component({
  selector: 'app-demo-file',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileUploadComponent, FileListComponent, FilePreviewComponent],
  template: `
    <div class="dph-section">
      <h3>Dropzone variant</h3>
      <dph-file-upload
        [(files)]="files"
        [config]="{ variant: 'dropzone', multiple: true, accept: 'image/*,.pdf', maxFileSize: 5 * 1024 * 1024, maxFiles: 5, label: 'Drop images or PDFs here' }"
      />
    </div>

    <div class="dph-section">
      <h3>Button variant (compact)</h3>
      <dph-file-upload
        [(files)]="files2"
        [config]="{ variant: 'button', multiple: false, label: 'Choose file', icon: 'pi pi-upload' }"
      />
      @if (files2().length) {
        <div style="margin-top:0.75rem;">
          <dph-file-list [files]="files2()" (remove)="onRemove2($event)" />
        </div>
      }
    </div>

    <div class="dph-section">
      <h3>File list (read-only)</h3>
      <dph-file-list [files]="staticFiles" [showRemove]="false" />
    </div>

    <div class="dph-section">
      <h3>File preview (image fallback to icon)</h3>
      <dph-file-preview [file]="staticFiles[0] ?? null" />
    </div>
  `,
  styles: [SECTION_STYLES],
})
export class DemoFileComponent {
  protected readonly files = signal<FileItem[]>([]);
  protected readonly files2 = signal<FileItem[]>([]);
  protected readonly staticFiles: readonly FileItem[] = [
    { id: '1', name: 'report.pdf', size: 245678, type: 'application/pdf', status: 'complete', url: '/favicon.ico' },
    { id: '2', name: 'budget.xlsx', size: 89432, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'complete' },
    { id: '3', name: 'logo.png', size: 12450, type: 'image/png', status: 'complete' },
  ];

  protected onRemove2(f: FileItem): void {
    this.files2.set(this.files2().filter((x) => x.id !== f.id));
  }
}
