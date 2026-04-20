# `src/app/shared/` — Shared tier

Reusable UI primitives, structural directives, and pipes. Owns:

- `components/` — DataTable, PageHeader, DetailView, DrawerPanel, ConfirmDialog, StepperForm, ChartWidget, StatCard, StatusBadge, Timeline, EmptyState, ErrorState, LoadingOverlay, GlobalProgressBar, SkeletonCard, VirtualList, FilePreview, CommandPalette (Phases 1–5)
- `components/dynamic-form/` — the schema-driven form subsystem: 22 field controls + FormBuilderService + ValidationMapperService + FieldVisibilityService + ServerErrorMapperService + ZodAdapterService (Phases 1–6)
- `directives/` — `*appHasPermission`, `*appHasRole`, `appAutofocus`, `appTrapFocus`, `appCopyToClipboard` (Phase 1+2)
- `pipes/` — `relativeTime`, `truncate`, `safeHtml`, `currency2`, `fileSize` (Phase 1+5)

**Import rules:**
- Shared may import `@core/*` **types only** (no services / no state) to avoid
  circular DI + to stay composable in isolation (Storybook, unit tests).
- Shared may NOT import from `@features/*` or `@layouts/*`.
