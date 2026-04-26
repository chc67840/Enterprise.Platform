/**
 * ─── domains/ — barrel ──────────────────────────────────────────────────────────
 *
 * Each `*.config.ts` exports a `create<Domain>Chrome()` factory that returns
 * a `DomainChromeConfig`. The shell consumes a registry built from these
 * factories, keyed by `DomainKey`, and swaps the active config based on
 * `DomainStore.currentDomain()`.
 */
import type { DomainChromeConfig } from '../models/nav.models';
import { createFinanceChrome } from './finance.config';
import { createHealthcareChrome } from './healthcare.config';
import { createHrChrome } from './hr.config';

export type DomainKey = 'finance' | 'healthcare' | 'hr';

/**
 * Registry: domain key → its chrome config. Rebuilt once per app boot
 * (the factories are pure — no per-call side effects).
 */
export const DOMAIN_CHROME_REGISTRY: Readonly<Record<DomainKey, DomainChromeConfig>> = {
  finance: createFinanceChrome(),
  healthcare: createHealthcareChrome(),
  hr: createHrChrome(),
};

export { createFinanceChrome, FINANCE_CHROME } from './finance.config';
export { createHealthcareChrome, HEALTHCARE_CHROME } from './healthcare.config';
export { createHrChrome, HR_CHROME } from './hr.config';
