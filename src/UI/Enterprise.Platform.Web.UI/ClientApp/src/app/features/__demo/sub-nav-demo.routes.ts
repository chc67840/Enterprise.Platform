/**
 * ─── ⚠ TEMPORARY DEMO ROUTES — REMOVE AFTER VERIFICATION ⚠ ──────────────────────
 *
 * Nested route tree feeds the breadcrumb collapse demo. Each level adds
 * one entry to the trail via `data.breadcrumb`. Reach Level 4 and the
 * BreadcrumbComponent's collapse rule kicks in (first → … → last 2).
 */
import type { Routes } from '@angular/router';

import type { RouteMetadata } from '@core/models';

import { SubNavDemoComponent, SubNavDemoLeafComponent } from './sub-nav-demo.component';

export const SUB_NAV_DEMO_ROUTES: Routes = [
  {
    path: '',
    component: SubNavDemoComponent,
    data: {
      breadcrumb: 'Demo',
      pageHeader: {
        title: 'Sub-Nav Demo',
        subtitle: 'Visual test rig for breadcrumb, page-header, and status banners.',
        icon: 'pi pi-bolt',
        badge: { label: 'DEMO', variant: 'info' },
        helpTooltip: 'Temporary route — remove via the checklist in this file.',
        primaryAction: {
          label: 'Save changes',
          icon: 'pi pi-save',
          actionKey: 'demo.save',
        },
        secondaryActions: [
          { label: 'Refresh', icon: 'pi pi-refresh', actionKey: 'demo.refresh' },
          { label: 'Export', icon: 'pi pi-download', actionKey: 'demo.export' },
        ],
      },
    } satisfies RouteMetadata,
    children: [
      {
        path: 'section',
        data: {
          breadcrumb: 'Section',
          leafLabel: 'Section',
        } satisfies RouteMetadata & { leafLabel: string },
        component: SubNavDemoLeafComponent,
        children: [
          {
            path: 'group',
            data: {
              breadcrumb: 'Group',
              leafLabel: 'Group',
            } satisfies RouteMetadata & { leafLabel: string },
            component: SubNavDemoLeafComponent,
            children: [
              {
                path: 'item',
                data: {
                  breadcrumb: 'Item',
                  leafLabel: 'Item',
                } satisfies RouteMetadata & { leafLabel: string },
                component: SubNavDemoLeafComponent,
              },
            ],
          },
        ],
      },
    ],
  },
];

export default SUB_NAV_DEMO_ROUTES;
