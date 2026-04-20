/**
 * ─── COMMITLINT CONFIG ──────────────────────────────────────────────────────────
 *
 * WHY
 *   Conventional Commits (`feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`,
 *   etc.) give automated tooling (changelogs, semantic-version releases,
 *   release notes) a machine-readable signal. They also make git log
 *   pleasant to skim.
 *
 *   `commitlint` runs via Husky's `commit-msg` hook so non-conforming
 *   messages are rejected before they land.
 *
 * CUSTOMISATIONS
 *   - `scope-enum` lists the tiers + common subsystems. Scopes are optional,
 *     but when present they must be one of these strings. Keeps commit
 *     history searchable by area.
 *   - `body-max-line-length` disabled — long bodies are fine; wrap where
 *     natural.
 *   - `subject-case` enforces lower-case; nothing breaks if you
 *     disagree — flip it off per team preference.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // Tiers
        'core',
        'shared',
        'layouts',
        'features',
        'config',
        // Subsystems
        'auth',
        'http',
        'store',
        'interceptors',
        'guards',
        'dynamic-form',
        // Ops / meta
        'build',
        'deps',
        'docs',
        'tooling',
        'ci',
      ],
    ],
    'body-max-line-length': [0],
    'subject-case': [2, 'always', 'lower-case'],
  },
};
