/**
 * ─── UI KIT DEMO — ROUTES ───────────────────────────────────────────────────────
 *
 * Permanent reference (replaces Storybook). Lives at /demo/ui-kit. Each
 * leaf route is a small showcase component for one UI Kit category. Page
 * header + breadcrumb come from data via the SubNavOrchestrator.
 */
import type { Routes } from '@angular/router';

import type { RouteMetadata } from '@core/models';

import {
  DemoButtonComponent,
  DemoDataTableComponent,
  DemoFieldErrorComponent,
  DemoFileComponent,
  DemoFloatLabelComponent,
  DemoFormLayoutComponent,
  DemoInputComponent,
  DemoListComponent,
  DemoMediaComponent,
  DemoMenuComponent,
  DemoMessageComponent,
  DemoOverlayComponent,
  DemoPanelComponent,
  DemoTreeComponent,
} from './ui-kit-demos';
import { UiKitShellComponent } from './ui-kit-shell.component';

const headerFor = (title: string, subtitle: string, icon: string): RouteMetadata => ({
  breadcrumb: title,
  pageHeader: {
    title,
    subtitle,
    icon,
    backRoute: '/demo/ui-kit',
  },
});

export const UI_KIT_ROUTES: Routes = [
  {
    path: '',
    component: UiKitShellComponent,
    data: {
      breadcrumb: 'UI Kit',
      pageHeader: {
        title: 'UI Kit',
        subtitle: '14 reusable primitives — config-driven, signal-based, accessible.',
        icon: 'pi pi-palette',
        badge: { label: 'DEMO', variant: 'info' as const },
      },
    } satisfies RouteMetadata,
  },
  { path: 'form-layout',  component: DemoFormLayoutComponent,  data: headerFor('Form Layout',   'Grid / stacked / inline / wizard layouts.', 'pi pi-th-large') satisfies RouteMetadata },
  { path: 'input',        component: DemoInputComponent,       data: headerFor('Input',         'Text / number / password / textarea + addons.', 'pi pi-pencil') satisfies RouteMetadata },
  { path: 'float-label',  component: DemoFloatLabelComponent,  data: headerFor('Float Label',   'Animated floating labels.', 'pi pi-arrows-v') satisfies RouteMetadata },
  { path: 'field-error',  component: DemoFieldErrorComponent,  data: headerFor('Invalid State', 'Standardized error messages.', 'pi pi-exclamation-circle') satisfies RouteMetadata },
  { path: 'button',       component: DemoButtonComponent,      data: headerFor('Button',        '7 variants × 5 sizes + states.', 'pi pi-bolt') satisfies RouteMetadata },
  { path: 'data-table',   component: DemoDataTableComponent,   data: headerFor('Data Table',    'Config-driven table with pagination, actions, skeletons.', 'pi pi-table') satisfies RouteMetadata },
  { path: 'list',         component: DemoListComponent,        data: headerFor('List',          'Simple / data / selectable / checklist.', 'pi pi-list') satisfies RouteMetadata },
  { path: 'tree',         component: DemoTreeComponent,        data: headerFor('Tree',          'Hierarchical with selection + filter.', 'pi pi-sitemap') satisfies RouteMetadata },
  { path: 'panel',        component: DemoPanelComponent,       data: headerFor('Panel',         'Cards: default / elevated / flat / ghost / glass.', 'pi pi-window-maximize') satisfies RouteMetadata },
  { path: 'overlay',      component: DemoOverlayComponent,     data: headerFor('Overlay',       'Dialog / Drawer / Popover / Tooltip.', 'pi pi-window-restore') satisfies RouteMetadata },
  { path: 'media',        component: DemoMediaComponent,       data: headerFor('Media',         'Image / Avatar / Gallery.', 'pi pi-image') satisfies RouteMetadata },
  { path: 'menu',         component: DemoMenuComponent,        data: headerFor('Menu',          'Dropdown / Context / Steps.', 'pi pi-bars') satisfies RouteMetadata },
  { path: 'message',      component: DemoMessageComponent,     data: headerFor('Message',       'Inline messages + Toast service.', 'pi pi-comment') satisfies RouteMetadata },
  { path: 'file',         component: DemoFileComponent,        data: headerFor('File',          'Upload (dropzone/button) + list + preview.', 'pi pi-paperclip') satisfies RouteMetadata },
];

export default UI_KIT_ROUTES;
