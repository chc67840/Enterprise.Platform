/**
 * ─── UI KIT DEMO — KITCHEN SINK ─────────────────────────────────────────────────
 *
 * One scrollable page that exercises every DPH UI Kit primitive at multiple
 * column-widths and variation tiers (basic → advanced). The intent is two-fold:
 *
 *   1. Reviewers can eyeball the whole component library on one URL, no
 *      navigation between sub-routes — useful for spotting regressions in
 *      tokens, density, dark-mode contrast, focus-rings.
 *
 *   2. Each section progressively scales from "basic" usage (1 column, default
 *      props) to "advanced" (multi-column grids, all props set, edge-case
 *      states like loading/error/disabled). Engineers learn the API surface by
 *      scrolling through one example sheet rather than 17 sub-pages.
 *
 * STRUCTURE
 *   Each major DPH category has its own `<section data-cat="…">` block. Inside
 *   each section, the heading shows the component name; sub-headings show the
 *   variation tier ("Basic", "Sizes", "States", "Advanced grid").
 *
 * KEEPING THIS LIVING
 *   When a new DPH primitive lands, add a section here as part of the same
 *   PR. Reviewers should fail the PR if a new component ships without a
 *   kitchen-sink entry (every UI Kit component that exists must be visible
 *   on this page).
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmDialogService } from '@core/services/confirm-dialog.service';
import {
  AvatarComponent,
  ButtonComponent,
  ChartWidgetComponent,
  DialogComponent,
  DrawerComponent,
  FieldErrorComponent,
  FloatLabelComponent,
  FormLayoutComponent,
  GalleryComponent,
  ImageComponent,
  InlineMessageComponent,
  InputComponent,
  ListComponent,
  PanelComponent,
  PopoverComponent,
  SchemaFormComponent,
  StepsComponent,
  ToastService,
  TooltipDirective,
  TreeComponent,
  type ChartWidgetConfig,
  type DrawerSize,
  type FormSchema,
  type TreeNode,
} from '@shared/components/dph';

const SHELL_STYLES = `
  :host {
    display: block;
    color: var(--ep-text-primary);
  }
  .ks-toc {
    position: sticky;
    top: 64px;
    z-index: 1;
    margin-bottom: 1.5rem;
    padding: 0.75rem 1rem;
    background: var(--ep-bg-elevated);
    border: 1px solid var(--ep-border-default, var(--ep-color-neutral-200));
    border-radius: var(--ep-radius-lg);
    box-shadow: 0 1px 2px rgba(15, 31, 59, 0.04);
  }
  .ks-toc__title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ep-text-muted);
    margin-bottom: 0.5rem;
  }
  .ks-toc__links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .ks-toc__link {
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    background: var(--ep-color-primary-50);
    color: var(--ep-color-primary-700);
    text-decoration: none;
    transition: background 120ms ease;
  }
  .ks-toc__link:hover {
    background: var(--ep-color-primary-100);
  }
  .ks-section {
    margin-bottom: 2rem;
    padding: 1.25rem;
    border: 1px solid var(--ep-border-default, var(--ep-color-neutral-200));
    border-radius: var(--ep-radius-lg);
    background: var(--ep-bg-elevated);
  }
  .ks-section__title {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0 0 1rem;
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--ep-text-primary);
    padding-bottom: 0.625rem;
    border-bottom: 1px solid var(--ep-border-subtle, var(--ep-color-neutral-200));
  }
  .ks-section__title i { color: var(--ep-color-primary-500); }
  .ks-tier {
    margin-bottom: 1.25rem;
  }
  .ks-tier__heading {
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ep-text-muted);
    margin-bottom: 0.5rem;
  }
  .ks-tier__caption {
    font-size: 0.8125rem;
    color: var(--ep-text-secondary);
    margin-bottom: 0.75rem;
  }
  .ks-row { display: flex; flex-wrap: wrap; gap: 0.625rem; align-items: center; }
  .ks-stack { display: flex; flex-direction: column; gap: 0.625rem; }
  .ks-grid { display: grid; gap: 1rem; }
  .ks-grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ks-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ks-grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  @media (max-width: 768px) {
    .ks-grid--2, .ks-grid--3, .ks-grid--4 { grid-template-columns: 1fr; }
  }
  @media (max-width: 1024px) {
    .ks-grid--3, .ks-grid--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  code {
    background: var(--ep-bg-sunken, var(--ep-color-neutral-100));
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }
`;

@Component({
  selector: 'app-kitchen-sink',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    AvatarComponent,
    ButtonComponent,
    ChartWidgetComponent,
    DialogComponent,
    DrawerComponent,
    FieldErrorComponent,
    FloatLabelComponent,
    FormLayoutComponent,
    GalleryComponent,
    ImageComponent,
    InlineMessageComponent,
    InputComponent,
    ListComponent,
    PanelComponent,
    PopoverComponent,
    SchemaFormComponent,
    StepsComponent,
    TooltipDirective,
    TreeComponent,
  ],
  template: `
    <!-- ── TOC ───────────────────────────────────────────────────────── -->
    <nav class="ks-toc" aria-label="Kitchen sink table of contents">
      <div class="ks-toc__title">Jump to</div>
      <div class="ks-toc__links">
        <a class="ks-toc__link" href="#ks-button">Buttons</a>
        <a class="ks-toc__link" href="#ks-input">Inputs</a>
        <a class="ks-toc__link" href="#ks-form">Form Layout</a>
        <a class="ks-toc__link" href="#ks-schema">Schema Form</a>
        <a class="ks-toc__link" href="#ks-panel">Panels</a>
        <a class="ks-toc__link" href="#ks-list">Lists</a>
        <a class="ks-toc__link" href="#ks-tree">Tree</a>
        <a class="ks-toc__link" href="#ks-overlay">Overlays</a>
        <a class="ks-toc__link" href="#ks-message">Messages</a>
        <a class="ks-toc__link" href="#ks-media">Media</a>
        <a class="ks-toc__link" href="#ks-steps">Steps</a>
        <a class="ks-toc__link" href="#ks-chart">Charts</a>
      </div>
    </nav>

    <!-- ── BUTTONS ───────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-button" data-cat="button">
      <h2 class="ks-section__title"><i class="pi pi-bolt"></i>Buttons</h2>

      <div class="ks-tier">
        <div class="ks-tier__heading">Basic — variants</div>
        <div class="ks-row">
          <dph-button label="Primary" />
          <dph-button label="Secondary" variant="secondary" />
          <dph-button label="Ghost" variant="ghost" />
          <dph-button label="Outline" variant="outline" />
          <dph-button label="Danger" variant="danger" />
          <dph-button label="Link" variant="link" />
          <dph-button variant="icon" icon="pi pi-cog" ariaLabel="Settings" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Sizes — xs / sm / md / lg / xl</div>
        <div class="ks-row">
          <dph-button label="XS" size="xs" />
          <dph-button label="Small" size="sm" />
          <dph-button label="Medium" size="md" />
          <dph-button label="Large" size="lg" />
          <dph-button label="XL" size="xl" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">States &amp; ornaments</div>
        <div class="ks-stack">
          <div class="ks-row">
            <dph-button label="Disabled" [disabled]="true" />
            <dph-button label="Loading" [loading]="true" loadingText="Saving…" />
            <dph-button label="Save" icon="pi pi-save" />
            <dph-button label="Next" icon="pi pi-arrow-right" iconPosition="right" />
          </div>
          <div class="ks-row">
            <dph-button label="Notifications" icon="pi pi-bell" badge="3" badgeSeverity="danger" />
            <dph-button label="Raised" [raised]="true" variant="secondary" />
            <dph-button label="Rounded" [rounded]="true" variant="outline" />
            <dph-button label="Tooltip" tooltip="This shows on hover" variant="ghost" />
          </div>
        </div>
      </div>
    </section>

    <!-- ── INPUTS ────────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-input" data-cat="input">
      <h2 class="ks-section__title"><i class="pi pi-pencil"></i>Inputs</h2>

      <div class="ks-tier">
        <div class="ks-tier__heading">Basic — single column</div>
        <div class="ks-grid">
          <dph-input [(value)]="textVal" [config]="{ type: 'text', label: 'Display name', placeholder: 'Jane Doe', required: true }" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Two-column grid — common pairing</div>
        <div class="ks-grid ks-grid--2">
          <dph-input [(value)]="emailVal" [config]="{ type: 'email', label: 'Email', prefixIcon: 'pi pi-envelope', required: true }" />
          <dph-input [(value)]="pwdVal" [config]="{ type: 'password', label: 'Password', required: true, hint: 'Min 8 characters' }" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Three-column grid — every type at once</div>
        <div class="ks-grid ks-grid--3">
          <dph-input [(value)]="numVal" [config]="{ type: 'number', label: 'Quantity', min: 0, max: 100, suffixText: 'units' }" />
          <dph-input [(value)]="searchVal" [config]="{ type: 'search', label: 'Search', prefixIcon: 'pi pi-search', clearable: true }" />
          <dph-input [(value)]="floatVal" [config]="{ type: 'text', label: 'Float label', floatLabel: true }" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Four-column grid — compact admin row</div>
        <div class="ks-grid ks-grid--4">
          <dph-input [config]="{ type: 'text', label: 'First' }" />
          <dph-input [config]="{ type: 'text', label: 'Last' }" />
          <dph-input [config]="{ type: 'tel', label: 'Phone' }" />
          <dph-input [config]="{ type: 'text', label: 'Title' }" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Advanced — states (disabled / readonly / invalid / loading) + textarea</div>
        <div class="ks-grid ks-grid--2">
          <dph-input [config]="{ type: 'text', label: 'Disabled', disabled: true }" />
          <dph-input [config]="{ type: 'text', label: 'Readonly', readonly: true }" [(value)]="readonlyVal" />
          <dph-input [config]="{ type: 'email', label: 'Invalid', errors: ['Email is required'], required: true }" />
          <dph-input [config]="{ type: 'text', label: 'Loading', loading: true, placeholder: 'Validating…' }" />
          <dph-input [(value)]="bioVal" [config]="{ type: 'textarea', label: 'Bio', rows: 3, maxLength: 240, showCounter: true }" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Float label variants</div>
        <div class="ks-grid ks-grid--2">
          <dph-float-label [config]="{ label: 'On variant (default)', variant: 'on', labelId: 'ks-fl-1' }">
            <input id="ks-fl-1" pInputText [(ngModel)]="flVal1" />
          </dph-float-label>
          <dph-float-label [config]="{ label: 'In variant', variant: 'in', labelId: 'ks-fl-2' }">
            <input id="ks-fl-2" pInputText [(ngModel)]="flVal2" />
          </dph-float-label>
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Field errors</div>
        <div class="ks-stack">
          <dph-field-error [errors]="['Email is required']" id="ks-err-1" />
          <dph-field-error [errors]="['Required', 'Must be valid email', 'Domain not allowed']" [showAll]="true" id="ks-err-2" />
        </div>
      </div>
    </section>

    <!-- ── FORM LAYOUT ──────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-form" data-cat="form">
      <h2 class="ks-section__title"><i class="pi pi-th-large"></i>Form Layout</h2>

      <div class="ks-tier">
        <div class="ks-tier__heading">Grid 2-column with footer slot</div>
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

      <div class="ks-tier">
        <div class="ks-tier__heading">Inline (toolbar)</div>
        <dph-form-layout [config]="{ variant: 'inline', gap: 'sm' }">
          <dph-input [config]="{ type: 'search', label: 'Search', prefixIcon: 'pi pi-search' }" />
          <dph-button label="Apply" icon="pi pi-filter" />
          <dph-button label="Reset" variant="ghost" />
        </dph-form-layout>
      </div>
    </section>

    <!-- ── SCHEMA FORM ──────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-schema" data-cat="schema">
      <h2 class="ks-section__title"><i class="pi pi-clone"></i>Schema Form</h2>
      <div class="ks-tier__caption">
        Declarative <code>FormSchema</code> → typed <code>FormGroup</code> with built-in error mapping.
      </div>
      <dph-schema-form [schema]="profileSchema" [initialValue]="profileInitial" submitLabel="Save profile" />
    </section>

    <!-- ── PANELS ───────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-panel" data-cat="panel">
      <h2 class="ks-section__title"><i class="pi pi-window-maximize"></i>Panels</h2>

      <div class="ks-tier">
        <div class="ks-tier__heading">All variants — 3-column</div>
        <div class="ks-grid ks-grid--3">
          <dph-panel [config]="{ variant: 'default', header: 'Default', subheader: 'Plain border' }">
            Content goes here.
          </dph-panel>
          <dph-panel [config]="{ variant: 'elevated', header: 'Elevated', icon: 'pi pi-star' }">
            Soft shadow, no border.
          </dph-panel>
          <dph-panel [config]="{ variant: 'flat', header: 'Flat', subheader: 'Neutral fill' }">
            Tinted background.
          </dph-panel>
          <dph-panel [config]="{ variant: 'ghost', header: 'Ghost' }">
            No background, no border.
          </dph-panel>
          <dph-panel [config]="{ variant: 'elevated', header: 'Collapsible', collapsible: true }">
            Click chevron to collapse.
          </dph-panel>
          <dph-panel [config]="{ variant: 'elevated', header: 'Loading', loading: true }">
            Spinner overlay.
          </dph-panel>
        </div>
      </div>
    </section>

    <!-- ── LISTS ────────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-list" data-cat="list">
      <h2 class="ks-section__title"><i class="pi pi-list"></i>Lists</h2>

      <div class="ks-grid ks-grid--3">
        <div>
          <div class="ks-tier__heading">Simple + dividers</div>
          <dph-list [config]="{ variant: 'simple', dividers: true }" [items]="listItems" />
        </div>
        <div>
          <div class="ks-tier__heading">Selectable</div>
          <dph-list [config]="{ variant: 'selectable', selectionMode: 'single', dividers: true }" [items]="listItems" />
        </div>
        <div>
          <div class="ks-tier__heading">Checklist</div>
          <dph-list [config]="{ variant: 'checklist', selectionMode: 'multiple' }" [items]="listItems" />
        </div>
      </div>
    </section>

    <!-- ── TREE ─────────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-tree" data-cat="tree">
      <h2 class="ks-section__title"><i class="pi pi-sitemap"></i>Trees</h2>
      <div class="ks-grid ks-grid--2">
        <div>
          <div class="ks-tier__heading">Single-select with filter</div>
          <dph-tree [config]="{ selectionMode: 'single', filter: true, scrollHeight: '260px' }" [nodes]="treeNodes" />
        </div>
        <div>
          <div class="ks-tier__heading">Checkbox select (multi)</div>
          <dph-tree [config]="{ selectionMode: 'checkbox' }" [nodes]="treeNodes" />
        </div>
      </div>
    </section>

    <!-- ── OVERLAYS ─────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-overlay" data-cat="overlay">
      <h2 class="ks-section__title"><i class="pi pi-window-restore"></i>Overlays</h2>

      <div class="ks-tier">
        <div class="ks-tier__heading">Dialog · Drawer (5 sizes) · Popover · Tooltip · Confirm</div>
        <div class="ks-row">
          <dph-button label="Open dialog" icon="pi pi-window-maximize" (clicked)="dialogOpen.set(true)" />
          @for (s of drawerSizes; track s) {
            <dph-button [label]="'Drawer ' + s" variant="outline" (clicked)="openDrawer(s)" />
          }
          <dph-button label="Confirm (info)" variant="ghost" (clicked)="confirmInfo()" />
          <dph-button label="Confirm (destructive)" variant="danger" (clicked)="confirmDestructive()" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Tooltips and popover</div>
        <div class="ks-row">
          <dph-button label="Top tooltip" dphTooltip="Top" dphTooltipPosition="top" />
          <dph-button label="Bottom tooltip" dphTooltip="Bottom" dphTooltipPosition="bottom" variant="ghost" />
          <dph-popover [config]="{ maxWidth: '320px' }">
            <dph-button slot="trigger" label="Show details" variant="outline" icon="pi pi-info-circle" />
            <ng-container slot="content">
              <h4 style="margin:0 0 0.5rem;font-size:0.875rem;font-weight:600;">Popover content</h4>
              <p style="margin:0;font-size:0.8125rem;color:var(--ep-text-secondary);">
                Click outside or press Escape to dismiss.
              </p>
            </ng-container>
          </dph-popover>
        </div>
      </div>

      <dph-dialog [(visible)]="dialogOpen" [config]="{ header: 'Confirm action', subheader: 'Centered modal.', width: 'min(420px, 92vw)' }">
        <p>Dialogs use <code>appendTo: 'body'</code>, escape closes, mask click dismisses.</p>
        <ng-container slot="footer">
          <dph-button label="Cancel" variant="ghost" (clicked)="dialogOpen.set(false)" />
          <dph-button label="Confirm" (clicked)="dialogOpen.set(false)" />
        </ng-container>
      </dph-dialog>

      <dph-drawer
        [(visible)]="drawerVisible"
        [config]="{ position: 'right', size: drawerSize(), header: 'Drawer · ' + drawerSize() }"
      >
        <p>Size preset <code>{{ drawerSize() }}</code>. Try other sizes from the buttons.</p>
        <ng-container drawerFooter>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <dph-button label="Cancel" variant="ghost" (clicked)="drawerVisible.set(false)" />
            <dph-button label="OK" (clicked)="drawerVisible.set(false)" />
          </div>
        </ng-container>
      </dph-drawer>
    </section>

    <!-- ── MESSAGES ─────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-message" data-cat="message">
      <h2 class="ks-section__title"><i class="pi pi-comment"></i>Messages &amp; Toast</h2>

      <div class="ks-tier">
        <div class="ks-tier__heading">Inline messages — 5 severities</div>
        <div class="ks-stack">
          <dph-inline-message [config]="{ severity: 'info', summary: 'Heads up', detail: 'Informational message.', closable: true }" />
          <dph-inline-message [config]="{ severity: 'success', summary: 'Success', detail: 'Operation completed.', closable: true }" />
          <dph-inline-message [config]="{ severity: 'warning', summary: 'Approaching limit', detail: 'Trial expires in 7 days.', closable: true }" />
          <dph-inline-message [config]="{ severity: 'danger', summary: 'Error', detail: 'Something went wrong.', closable: true }" />
          <dph-inline-message [config]="{ severity: 'neutral', summary: 'Note', detail: 'Neutral context.' }" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Toast — service-driven</div>
        <div class="ks-row">
          <dph-button label="Success toast" (clicked)="toast.success('Saved!', 'Your changes have been saved.')" />
          <dph-button label="Info" variant="secondary" (clicked)="toast.info('FYI', 'Just so you know.')" />
          <dph-button label="Warning" variant="outline" (clicked)="toast.warning('Heads up', 'Trial expires soon.')" />
          <dph-button label="Error" variant="danger" (clicked)="toast.error('Oops', 'Failed to save.')" />
          <dph-button label="Sticky" variant="ghost" (clicked)="toast.show({ severity: 'info', summary: 'Sticky', detail: 'Stays until dismissed.', sticky: true })" />
        </div>
      </div>
    </section>

    <!-- ── MEDIA ────────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-media" data-cat="media">
      <h2 class="ks-section__title"><i class="pi pi-image"></i>Media</h2>

      <div class="ks-tier">
        <div class="ks-tier__heading">Avatars — 6 sizes + shapes + badge</div>
        <div class="ks-row">
          <dph-avatar [config]="{ name: 'Jane Doe', size: 'xs' }" />
          <dph-avatar [config]="{ name: 'Jane Doe', size: 'sm' }" />
          <dph-avatar [config]="{ name: 'Jane Doe', size: 'md' }" />
          <dph-avatar [config]="{ name: 'Jane Doe', size: 'lg' }" />
          <dph-avatar [config]="{ name: 'Jane Doe', size: 'xl' }" />
          <dph-avatar [config]="{ name: 'Jane Doe', size: '2xl' }" />
          <dph-avatar [config]="{ name: 'Square', shape: 'square', size: 'lg' }" />
          <dph-avatar [config]="{ icon: 'pi pi-user', size: 'lg' }" />
          <dph-avatar [config]="{ name: 'WB', size: 'lg', badge: { value: '3', severity: 'danger' } }" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Image — fallback + gallery</div>
        <div class="ks-grid ks-grid--2">
          <dph-image [config]="{ src: '/favicon.ico', alt: 'Favicon', skeleton: true, aspectRatio: '1/1' }" />
          <dph-image [config]="{ src: '/missing.png', alt: 'Missing', fallbackSrc: '/favicon.ico', aspectRatio: '1/1' }" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Gallery — responsive 4-col</div>
        <dph-gallery [config]="{ columns: 4, items: galleryItems }" />
      </div>
    </section>

    <!-- ── STEPS ────────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-steps" data-cat="steps">
      <h2 class="ks-section__title"><i class="pi pi-step-forward"></i>Steps</h2>

      <div class="ks-tier">
        <div class="ks-tier__heading">Horizontal — 3 steps</div>
        <dph-steps [config]="{ activeIndex: stepIdx(), steps: wizardSteps }" (stepClick)="stepIdx.set($event.index)" />
        <div class="ks-row" style="margin-top: 0.75rem;">
          <dph-button label="Previous" variant="ghost" [disabled]="stepIdx() === 0" (clicked)="stepIdx.set(stepIdx() - 1)" />
          <dph-button label="Next" [disabled]="stepIdx() >= wizardSteps.length - 1" (clicked)="stepIdx.set(stepIdx() + 1)" />
        </div>
      </div>

      <div class="ks-tier">
        <div class="ks-tier__heading">Vertical variant</div>
        <dph-steps [config]="{ activeIndex: 1, variant: 'vertical', steps: wizardSteps }" />
      </div>
    </section>

    <!-- ── CHARTS ───────────────────────────────────────────────────── -->
    <section class="ks-section" id="ks-chart" data-cat="chart">
      <h2 class="ks-section__title"><i class="pi pi-chart-bar"></i>Charts (theme-aware)</h2>

      <div class="ks-grid ks-grid--2">
        <dph-chart-widget [config]="barConfig" />
        <dph-chart-widget [config]="lineConfig" />
        <dph-chart-widget [config]="pieConfig" />
        <dph-chart-widget [config]="radarConfig" />
      </div>
    </section>
  `,
  styles: [SHELL_STYLES],
})
export class KitchenSinkComponent {
  protected readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmDialogService);

  // Inputs
  protected readonly textVal = signal<string>('');
  protected readonly emailVal = signal<string>('');
  protected readonly pwdVal = signal<string>('');
  protected readonly numVal = signal<number | null>(10);
  protected readonly searchVal = signal<string>('');
  protected readonly bioVal = signal<string>('');
  protected readonly readonlyVal = signal<string>('Locked value');
  protected readonly floatVal = signal<string>('');
  protected flVal1 = '';
  protected flVal2 = '';

  // Overlays
  protected readonly dialogOpen = signal<boolean>(false);
  protected readonly drawerVisible = signal<boolean>(false);
  protected readonly drawerSize = signal<DrawerSize>('md');
  protected readonly drawerSizes: readonly DrawerSize[] = ['sm', 'md', 'lg', 'xl', 'full'];

  // Steps
  protected readonly stepIdx = signal<number>(0);
  protected readonly wizardSteps = [
    { key: 'account', label: 'Account', icon: 'pi pi-user', description: 'Basic info' },
    { key: 'prefs', label: 'Preferences', icon: 'pi pi-cog', description: 'Tune your settings' },
    { key: 'review', label: 'Review', icon: 'pi pi-check', description: 'Confirm and finish' },
  ];

  // Lists / Tree
  protected readonly listItems = ['Apples', 'Bread', 'Coffee', 'Eggs', 'Milk', 'Yogurt'];
  protected readonly treeNodes: readonly TreeNode[] = [
    {
      key: 'eng', label: 'Engineering', icon: 'pi pi-cog',
      children: [
        { key: 'eng-fe', label: 'Frontend', icon: 'pi pi-palette',
          children: [{ key: 'eng-fe-web', label: 'Web' }, { key: 'eng-fe-mob', label: 'Mobile' }] },
        { key: 'eng-be', label: 'Backend', icon: 'pi pi-server' },
      ],
    },
    { key: 'sales', label: 'Sales', icon: 'pi pi-chart-line', children: [
      { key: 'sales-na', label: 'North America' }, { key: 'sales-eu', label: 'Europe' },
    ] },
  ];

  // Gallery
  protected readonly galleryItems = Array.from({ length: 8 }, (_, i) => ({
    src: '/favicon.ico',
    alt: `Item ${i + 1}`,
    caption: `Item ${i + 1}`,
  }));

  // Schema form
  protected readonly profileSchema: FormSchema = {
    columns: 2,
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName',  label: 'Last name',  type: 'text', required: true },
      { key: 'email',     label: 'Email',      type: 'email', required: true, prefixIcon: 'pi pi-envelope' },
      { key: 'phone',     label: 'Phone',      type: 'tel',   prefixIcon: 'pi pi-phone' },
    ],
  };
  protected readonly profileInitial = { firstName: '', lastName: '', email: '', phone: '' };

  // Charts
  protected readonly barConfig: ChartWidgetConfig = {
    type: 'bar',
    title: 'Quarterly revenue',
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [{ label: 'Revenue', data: [128, 165, 192, 218] }],
    height: '260px',
    showLegend: false,
  };
  protected readonly lineConfig: ChartWidgetConfig = {
    type: 'line',
    title: 'Active users',
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      { label: 'New', data: [40, 45, 52, 60, 68, 30, 25], fill: true, tension: 0.4 },
      { label: 'Returning', data: [120, 135, 145, 162, 178, 90, 75], fill: true, tension: 0.4 },
    ],
    height: '260px',
  };
  protected readonly pieConfig: ChartWidgetConfig = {
    type: 'pie',
    title: 'Browser share',
    labels: ['Chrome', 'Edge', 'Safari', 'Firefox'],
    datasets: [{ label: 'Sessions', data: [62, 18, 14, 6] }],
    height: '260px',
  };
  protected readonly radarConfig: ChartWidgetConfig = {
    type: 'radar',
    title: 'Skill matrix',
    labels: ['HTML/CSS', 'TypeScript', 'Angular', 'Testing', 'Accessibility', 'Design'],
    datasets: [
      { label: 'Senior', data: [92, 88, 85, 78, 80, 70] },
      { label: 'Mid',    data: [78, 72, 68, 64, 60, 55] },
    ],
    height: '260px',
  };

  // Actions
  protected openDrawer(size: DrawerSize): void {
    this.drawerSize.set(size);
    this.drawerVisible.set(true);
  }

  protected async confirmInfo(): Promise<void> {
    const ok = await this.confirm.ask({
      message: 'Subscribe to weekly digest?',
      severity: 'info',
      acceptLabel: 'Subscribe',
    });
    if (ok) this.toast.info('Subscribed', 'You will receive the digest every Monday.');
  }

  protected async confirmDestructive(): Promise<void> {
    const ok = await this.confirm.askDestructive({
      message: 'Permanently delete this user?',
      header: 'Delete user',
      acceptLabel: 'Delete',
    });
    if (ok) this.toast.error('Deleted', 'User account removed.');
  }
}
