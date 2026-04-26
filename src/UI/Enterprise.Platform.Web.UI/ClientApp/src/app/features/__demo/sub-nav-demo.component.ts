/**
 * ─── ⚠ TEMPORARY VISUAL TEST RIG — REMOVE AFTER VERIFICATION ⚠ ──────────────────
 *
 * Single-page exercise of every sub-nav surface:
 *   - Page header (icon, badge, primary CTA, secondary actions, back, help, loading)
 *   - Status banners (5 severities, dismissable + persistent variants)
 *   - PageHeaderService (set + patch dynamic config; auto-clear on nav)
 *   - Breadcrumb (deep nested routes show collapse: first → … → last 2)
 *
 * REMOVAL CHECKLIST (after visual verification):
 *   1. Delete `src/app/features/__demo/` (this file + sub-nav-demo.routes.ts)
 *   2. Delete the 'demo' route block in `src/app/app.routes.ts`
 *   3. Delete the "Open sub-nav demo" button in `src/app/features/dashboard/dashboard.component.ts`
 *   4. Delete the `nav.demo` case in `app-shell.component.ts → onNavAction switch`
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs/operators';

import { StatusBannerService } from '@core/services';
import { PageHeaderService } from '@shared/layout/sub-nav';

@Component({
  selector: 'app-sub-nav-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterOutlet],
  template: `
    <section class="space-y-6">
      <p class="text-sm text-gray-700">
        Visual test rig for the sub-nav zone. Watch the navbar, status-banner host,
        breadcrumb, and page-header above as you click through.
      </p>

      <!-- Status banner triggers -->
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-gray-900">Status banners</div>
        <p class="mt-1 text-xs text-gray-500">
          5 severities + dismiss-persist. Push the same id twice → second replaces first
          (dedupe by id). Persistent dismiss survives reload via localStorage.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="ep-demo-btn" (click)="pushInfo()">Push info</button>
          <button class="ep-demo-btn" (click)="pushSuccess()">Push success</button>
          <button class="ep-demo-btn" (click)="pushWarning()">Push warning</button>
          <button class="ep-demo-btn ep-demo-btn--danger" (click)="pushDanger()">Push danger</button>
          <button class="ep-demo-btn" (click)="pushMaintenance()">Push maintenance</button>
          <button class="ep-demo-btn" (click)="pushPersistent()">Push persistent (dismiss survives reload)</button>
          <button class="ep-demo-btn" (click)="pushAll()">Push all 5 at once</button>
          <button class="ep-demo-btn" (click)="clearBanners()">Clear all</button>
          <button class="ep-demo-btn" (click)="resetDismissed()">Reset dismissed (re-show persistent)</button>
        </div>
      </div>

      <!-- Page header dynamic updates -->
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-gray-900">Page header — dynamic</div>
        <p class="mt-1 text-xs text-gray-500">
          Static config from route data is the default. PageHeaderService.set() overrides
          per-page. Service signal wins. Auto-clears on NavigationStart.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="ep-demo-btn" (click)="patchLoading()">
            Toggle primary action loading (2s)
          </button>
          <button class="ep-demo-btn" (click)="setDynamicHeader()">
            Set dynamic header (entity-style: badge + back link)
          </button>
          <button class="ep-demo-btn" (click)="restoreStaticHeader()">
            Clear service override (route data wins)
          </button>
        </div>
      </div>

      <!-- Breadcrumb collapse demo -->
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-gray-900">Breadcrumb — deep nesting</div>
        <p class="mt-1 text-xs text-gray-500">
          Drill into deeper routes to verify collapse: trail length &gt; 3 renders
          first → … → last 2. Each level adds <code>data.breadcrumb</code> only.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <a class="ep-demo-link" routerLink="/demo/sub-nav">Level 1 (root)</a>
          <a class="ep-demo-link" routerLink="/demo/sub-nav/section">Level 2</a>
          <a class="ep-demo-link" routerLink="/demo/sub-nav/section/group">Level 3</a>
          <a class="ep-demo-link" routerLink="/demo/sub-nav/section/group/item">Level 4 (collapse triggers)</a>
        </div>
        <div class="mt-4 rounded border border-dashed border-gray-300 p-3 text-xs text-gray-600">
          <router-outlet />
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .ep-demo-btn {
        display: inline-flex;
        align-items: center;
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        background-color: var(--ep-color-primary-700);
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 600;
        border: none;
        cursor: pointer;
      }
      .ep-demo-btn:hover { background-color: var(--ep-color-primary-800); }
      .ep-demo-btn--danger { background-color: var(--ep-color-danger-600); }
      .ep-demo-btn--danger:hover { background-color: var(--ep-color-danger-700); }

      .ep-demo-link {
        display: inline-flex;
        align-items: center;
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        background-color: var(--ep-color-neutral-100);
        color: var(--ep-color-neutral-800);
        font-size: 0.75rem;
        font-weight: 600;
        text-decoration: none;
        border: 1px solid var(--ep-color-neutral-200);
      }
      .ep-demo-link:hover {
        background-color: var(--ep-color-primary-50);
        color: var(--ep-color-primary-800);
      }
    `,
  ],
})
export class SubNavDemoComponent {
  private readonly banners = inject(StatusBannerService);
  private readonly pageHeader = inject(PageHeaderService);
  private readonly router = inject(Router);

  // ── Banner triggers ────────────────────────────────────────────────────

  pushInfo(): void {
    this.banners.push({
      id: 'demo-info',
      severity: 'info',
      title: 'Heads up',
      message: 'Informational context — non-urgent system state.',
      dismissable: true,
    });
  }

  pushSuccess(): void {
    this.banners.push({
      id: 'demo-success',
      severity: 'success',
      title: 'All good',
      message: 'Operation completed cleanly. All systems healthy.',
      dismissable: true,
    });
  }

  pushWarning(): void {
    this.banners.push({
      id: 'demo-warning',
      severity: 'warning',
      title: 'Approaching threshold',
      message: 'Trial expires in 7 days. Renew to keep editing access.',
      dismissable: true,
      action: { label: 'Renew now', invoke: () => alert('Demo CTA clicked') },
    });
  }

  pushDanger(): void {
    this.banners.push({
      id: 'demo-danger',
      severity: 'danger',
      title: 'Action required',
      message: 'Billing past due — saves are blocked until payment is settled.',
      dismissable: false,
    });
  }

  pushMaintenance(): void {
    this.banners.push({
      id: 'demo-maintenance',
      severity: 'maintenance',
      title: 'Scheduled maintenance Sunday 02:00 UTC',
      message: 'Saves will be disabled between 02:00 – 03:00 UTC. Plan accordingly.',
      dismissable: true,
    });
  }

  pushPersistent(): void {
    this.banners.push({
      id: 'demo-persistent',
      severity: 'info',
      title: 'One-time announcement',
      message: 'Dismissing this banner persists across reloads (localStorage).',
      dismissable: true,
      dismissPersist: true,
    });
  }

  pushAll(): void {
    this.pushInfo();
    this.pushSuccess();
    this.pushWarning();
    this.pushDanger();
    this.pushMaintenance();
  }

  clearBanners(): void {
    this.banners.clear();
  }

  resetDismissed(): void {
    this.banners.resetDismissed();
    alert('Persistent dismiss list cleared. Push the persistent banner again to verify.');
  }

  // ── Page header dynamic ────────────────────────────────────────────────

  patchLoading(): void {
    /*
     * Pull the current config (from route data or prior service override)
     * and patch it with primaryAction.loading=true. This exercises the
     * patch() method + verifies the spinner + disabled state work.
     */
    this.pageHeader.set({
      title: 'Sub-Nav Demo',
      subtitle: 'Submitting...',
      icon: 'pi pi-bolt',
      badge: { label: 'WORKING', variant: 'warning' },
      primaryAction: {
        label: 'Save changes',
        icon: 'pi pi-save',
        actionKey: 'demo.save',
        loading: true,
      },
    });
    setTimeout(() => this.pageHeader.clear(), 2000);
  }

  setDynamicHeader(): void {
    /*
     * Mimics what a user-detail page does after the entity loads —
     * title becomes the entity name, badge shows the role, back link
     * returns to the list page, secondary actions for less-common ops.
     */
    this.pageHeader.set({
      title: 'Jane Doe',
      subtitle: 'jane.doe@example.com · Last login 2 hours ago',
      icon: 'pi pi-user',
      badge: { label: 'ADMIN', variant: 'danger' },
      backRoute: '/demo/sub-nav',
      helpTooltip: 'Profile editor — changes are audited.',
      primaryAction: {
        label: 'Edit profile',
        icon: 'pi pi-pencil',
        actionKey: 'demo.edit',
      },
      secondaryActions: [
        { label: 'Reset password', icon: 'pi pi-key', actionKey: 'demo.reset' },
        { label: 'Suspend', icon: 'pi pi-ban', actionKey: 'demo.suspend' },
      ],
    });
  }

  restoreStaticHeader(): void {
    this.pageHeader.clear();
  }
}

// ── Stub child components for breadcrumb depth demo ──────────────────────

@Component({
  selector: 'app-sub-nav-demo-leaf',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="m-0">
      Active leaf: <strong>{{ label() }}</strong> — watch the breadcrumb update above.
      Drill deeper or back via the buttons.
    </p>
  `,
})
export class SubNavDemoLeafComponent {
  private readonly route = inject(ActivatedRoute);
  readonly label = toSignal(
    this.route.data.pipe(map((d) => (d['leafLabel'] as string) ?? 'unnamed')),
    { initialValue: 'loading…' },
  );
}
