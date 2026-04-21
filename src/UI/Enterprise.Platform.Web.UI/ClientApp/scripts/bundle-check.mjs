#!/usr/bin/env node
/**
 * ─── BUNDLE SIZE GATE ──────────────────────────────────────────────────────────
 *
 * Reads `dist/<project>/stats.json` produced by
 * `ng build --configuration production --stats-json` (esbuild/@angular/build
 * format) and asserts:
 *
 *   - INITIAL bundle (sum of outputs referenced from index.html) ≤ MAX_INITIAL_KB
 *   - Each LAZY chunk ≤ MAX_LAZY_KB
 *
 * Exits non-zero on any violation so the gate fails CI.
 *
 * WHY NOT `ng build --budgets`
 *   `angular.json` budgets produce warnings but don't fail the build unless
 *   configured at `error`. The error threshold is 2 MB — too loose for a
 *   regression gate. This script reads the authoritative per-chunk sizes
 *   from stats.json and enforces tighter ceilings we can tune independently.
 *
 * INITIAL vs LAZY DETECTION
 *   `@angular/build`'s stats.json emits every output chunk under `outputs`;
 *   the INITIAL set is whatever `index.html` references directly via
 *   `<script src="…">`. We parse the emitted `index.html` and cross-reference
 *   against the outputs dictionary.
 *
 * USAGE
 *   npm run bundle:check         # one-shot build + verify
 *   npm run bundle:check:only    # verify against an existing build
 *
 * CI RECIPE
 *   - name: Bundle size gate
 *     run: npm run bundle:check
 */
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = resolve(
  __dirname,
  '..',
  'dist',
  'enterprise-platform-client',
);
// `@angular/build` (Angular 21+) emits outputs at the project root; legacy
// builders wrote to `browser/`. Try both.
const STATS_CANDIDATES = [
  resolve(DIST_ROOT, 'stats.json'),
  resolve(DIST_ROOT, 'browser', 'stats.json'),
];
const INDEX_CANDIDATES = [
  resolve(DIST_ROOT, 'browser', 'index.html'),
  resolve(DIST_ROOT, 'index.html'),
];

// Budgets — tightened as bundles shrink. Raw (pre-gzip) sizes.
const MAX_INITIAL_KB = 1_500; // 1.5 MB raw initial bundle ceiling
const MAX_LAZY_KB = 500;      // 500 kB raw per lazy chunk ceiling

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

async function firstExisting(candidates) {
  for (const path of candidates) {
    try {
      await access(path, constants.R_OK);
      return path;
    } catch {
      // next
    }
  }
  return null;
}

async function main() {
  const statsPath = await firstExisting(STATS_CANDIDATES);
  if (!statsPath) {
    console.error(
      `[bundle:check] stats.json not found. Run \`npm run bundle:stats\` first.`,
    );
    process.exit(2);
  }

  const indexPath = await firstExisting(INDEX_CANDIDATES);
  if (!indexPath) {
    console.error(
      '[bundle:check] index.html not found — cannot distinguish initial from lazy chunks.',
    );
    process.exit(3);
  }

  const raw = await readFile(statsPath, 'utf8');
  let stats;
  try {
    stats = JSON.parse(raw);
  } catch (err) {
    console.error(`[bundle:check] stats.json is not valid JSON: ${err.message}`);
    process.exit(4);
  }

  const outputs = stats.outputs ?? {};
  if (Object.keys(outputs).length === 0) {
    console.error('[bundle:check] stats.json has no `outputs` entry.');
    process.exit(5);
  }

  const indexHtml = await readFile(indexPath, 'utf8');
  // Seeds — scripts referenced from `<script src="…">` in index.html.
  const scriptSources = [...indexHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(
    (m) => basename(m[1]),
  );

  // stats.json keys are paths relative to the dist root. Build a basename →
  // full-path index so we can seed the BFS with filenames we found in index.html.
  const byBasename = new Map();
  for (const path of Object.keys(outputs)) {
    byBasename.set(basename(path), path);
  }

  // BFS across `imports` where `kind === 'import-statement'` (static).
  // Dynamic imports (kind 'dynamic-import') mark a lazy boundary — do NOT
  // cross them. The set of reachable nodes is the INITIAL bundle.
  const initial = new Set();
  const queue = [];
  for (const src of scriptSources) {
    const full = byBasename.get(src);
    if (full) {
      initial.add(full);
      queue.push(full);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift();
    const meta = outputs[current];
    if (!meta) continue;
    for (const imp of meta.imports ?? []) {
      if (imp.kind !== 'import-statement') continue; // dynamic → skip
      if (!initial.has(imp.path) && outputs[imp.path]) {
        initial.add(imp.path);
        queue.push(imp.path);
      }
    }
  }

  let initialTotal = 0;
  const failures = [];

  for (const [outPath, meta] of Object.entries(outputs)) {
    if (!outPath.endsWith('.js')) continue;
    const size = meta.bytes ?? 0;

    if (initial.has(outPath)) {
      initialTotal += size;
    } else if (size > MAX_LAZY_KB * 1024) {
      const label = meta.entryPoint ? `${outPath} [${meta.entryPoint}]` : outPath;
      failures.push(
        `LAZY chunk \`${label}\` = ${kb(size)} exceeds ${MAX_LAZY_KB} kB ceiling`,
      );
    }
  }

  if (initialTotal > MAX_INITIAL_KB * 1024) {
    failures.push(
      `INITIAL bundle = ${kb(initialTotal)} exceeds ${MAX_INITIAL_KB} kB ceiling`,
    );
  }

  const initialOk = initialTotal <= MAX_INITIAL_KB * 1024;
  const marker = (ok) => (ok ? '✓' : '✗');
  console.log(
    `[bundle:check] INITIAL bundle: ${kb(initialTotal)} (cap ${MAX_INITIAL_KB} kB) ${marker(initialOk)}`,
  );
  console.log(`[bundle:check] LAZY ceiling: ${MAX_LAZY_KB} kB / chunk`);

  if (failures.length > 0) {
    console.error(`\n[bundle:check] ✗ ${failures.length} budget violation(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log('\n[bundle:check] ✓ All budgets OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('[bundle:check] unexpected failure:', err);
  process.exit(6);
});
