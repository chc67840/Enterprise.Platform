/**
 * ─── UI KIT DEMO — SHELL ────────────────────────────────────────────────────────
 *
 * Landing page: 14 tiles linking to each category demo. Permanent (per
 * the standards triage — replaces Storybook). Lives at /demo/ui-kit.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Tile {
  readonly path: string;
  readonly title: string;
  readonly icon: string;
  readonly desc: string;
}

const TILES: readonly Tile[] = [
  { path: 'form-layout', title: 'Form Layout', icon: 'pi pi-th-large', desc: 'Grid / stacked / inline / tabbed / wizard layouts.' },
  { path: 'input', title: 'Input', icon: 'pi pi-pencil', desc: 'Text, number, password, textarea + addons + states.' },
  { path: 'float-label', title: 'Float Label', icon: 'pi pi-arrows-v', desc: 'Animated floating labels for any input.' },
  { path: 'field-error', title: 'Invalid State', icon: 'pi pi-exclamation-circle', desc: 'Standard error messages below form fields.' },
  { path: 'button', title: 'Button', icon: 'pi pi-bolt', desc: '7 variants, 5 sizes, loading + badge + tooltip.' },
  { path: 'data-table', title: 'Data Table', icon: 'pi pi-table', desc: 'Config-driven table with skeletons, pagination, row actions.' },
  { path: 'list', title: 'List', icon: 'pi pi-list', desc: 'Simple / data / selectable / checklist variants.' },
  { path: 'tree', title: 'Tree', icon: 'pi pi-sitemap', desc: 'Hierarchical tree with selection + filter + lazy load.' },
  { path: 'panel', title: 'Panel', icon: 'pi pi-window-maximize', desc: 'Cards: default / elevated / flat / ghost / glass.' },
  { path: 'overlay', title: 'Overlay', icon: 'pi pi-window-restore', desc: 'Dialog / Drawer / Popover / Tooltip.' },
  { path: 'media', title: 'Media', icon: 'pi pi-image', desc: 'Image / Avatar / Gallery.' },
  { path: 'menu', title: 'Menu', icon: 'pi pi-bars', desc: 'Dropdown / Context menu / Steps.' },
  { path: 'message', title: 'Message', icon: 'pi pi-comment', desc: 'Inline messages + toast service.' },
  { path: 'file', title: 'File', icon: 'pi pi-paperclip', desc: 'Upload (dropzone/button) + list + preview.' },
];

@Component({
  selector: 'app-ui-kit-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="space-y-4">
      <p class="text-sm text-gray-700">
        14 reusable primitives prefixed <code>dph-*</code>. Every component is config-driven, signal-based,
        OnPush, standalone, accessible, responsive (320px → 2560px). Pick a category to explore variants
        and edge cases.
      </p>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (t of tiles; track t.path) {
          <a
            [routerLink]="t.path"
            class="dph-tile"
          >
            <div class="dph-tile__icon"><i [class]="t.icon" aria-hidden="true"></i></div>
            <div class="dph-tile__text">
              <div class="dph-tile__title">{{ t.title }}</div>
              <div class="dph-tile__desc">{{ t.desc }}</div>
            </div>
          </a>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .dph-tile {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid var(--ep-color-neutral-200);
        border-radius: var(--ep-radius-lg);
        background-color: #ffffff;
        text-decoration: none;
        color: inherit;
        transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
      }
      .dph-tile:hover {
        border-color: var(--ep-color-primary-400);
        box-shadow: 0 2px 6px rgba(15, 31, 59, 0.06), 0 4px 14px rgba(15, 31, 59, 0.08);
        transform: translateY(-1px);
      }
      .dph-tile:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; }
      .dph-tile__icon {
        display: grid;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--ep-radius-md);
        background-color: var(--ep-color-primary-50);
        color: var(--ep-color-primary-700);
        font-size: 1.125rem;
        flex-shrink: 0;
      }
      .dph-tile__title { font-weight: 600; font-size: 0.9375rem; color: var(--ep-color-neutral-900); }
      .dph-tile__desc { margin-top: 0.125rem; font-size: 0.8125rem; color: var(--ep-color-neutral-600); }
    `,
  ],
})
export class UiKitShellComponent {
  protected readonly tiles = TILES;
}
