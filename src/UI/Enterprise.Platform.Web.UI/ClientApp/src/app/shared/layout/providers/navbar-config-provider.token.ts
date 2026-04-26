/**
 * ─── shared/layout/providers/navbar-config-provider.token ───────────────────────
 *
 * DI token for the chrome-config provider. App composition root binds the
 * concrete impl (static / backend / custom) once at boot. The default factory
 * resolves to the static provider so a brand-new app boots without HTTP plumbing.
 *
 * Swap it in `app.config.ts`:
 *
 *   providers: [
 *     { provide: NAVBAR_CONFIG_PROVIDER, useClass: BackendNavbarConfigProvider },
 *   ]
 */
import { InjectionToken, inject } from '@angular/core';

import { StaticNavbarConfigProvider } from './static-navbar-config.provider';
import type { NavbarConfigProvider } from './navbar-config.types';

export const NAVBAR_CONFIG_PROVIDER = new InjectionToken<NavbarConfigProvider>(
  'NAVBAR_CONFIG_PROVIDER',
  {
    providedIn: 'root',
    factory: () => inject(StaticNavbarConfigProvider),
  },
);
