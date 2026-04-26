# Runtime — Loading Sequence & Feature Anatomy

The two questions every new developer asks:

1. **What happens between "browser opens the URL" and "user sees data"?** → see `01`
2. **How do I add a new feature?** → see `02` for the walkthrough, `03–10` for the per-layer reference

## Reading order

| File | When to read | Length |
|---|---|---|
| `01-loading-sequence.md` | First — understand the boot pipeline | ~250 lines |
| `02-first-feature-walkthrough.md` | Before adding your first feature — narrative tour through the Users feature, URL → API response | ~280 lines |
| `03-folder-structure.md` | Reference — what files a feature must have | ~120 lines |
| `04-data-layer.md` | Building the API service + Zod schemas | ~150 lines |
| `05-store-layer.md` | Designing the signal store | ~170 lines |
| `06-view-layer.md` | Writing the page components | ~150 lines |
| `07-routes-file.md` | Wiring the feature into Angular routing | ~140 lines |
| `08-permission-gate.md` | Gating the feature behind authentication + policies | ~130 lines |
| `09-empty-skeleton-states.md` | Handling loading, empty, error UI states | ~140 lines |
| `10-test-scaffolding.md` | Writing the 3 standard spec files per feature | ~150 lines |

## Conventions referenced throughout

- **Single source of truth: `Users` feature.** Every "canonical example" cites real code from `src/app/features/users/`. If a doc and the code disagree, the code wins — open a PR to fix the doc.
- **Standalone, OnPush, signals everywhere.** Every component uses `ChangeDetectionStrategy.OnPush`, `inject()` for DI, `input.required<T>()` for inputs, `output<T>()` for events, `@if`/`@for`/`@switch` for control flow. No NgModules, no constructor DI, no `*ngIf`.
- **NGRX Signals (`@ngrx/signals`)** is the chosen store toolkit. Stores are provided at the feature route level (`providers: [UsersStore]`) so their lifetime tracks navigation in/out.
- **Zod at the API boundary.** Every successful API response is validated by a Zod schema before reaching the store. Backend contract drift → typed exception with field path, not "cannot read properties of undefined" deep in a template.
- **Document scroll model.** Window scrolls; navbar uses `position: sticky`. See `Architecture/UI-Sub-Nav-Zone.md` for the chrome-zone contract.

## Where these docs sit in the broader doc set

```
docs/Architecture/
├── 00-INDEX.md                           ← whole-architecture index
├── 01-Enterprise-Architecture-Overview.md
├── ...
├── runtime/                              ← YOU ARE HERE
│   ├── 00-INDEX.md
│   ├── 01-loading-sequence.md
│   ├── 02-first-feature-walkthrough.md
│   ├── 03-folder-structure.md
│   ├── 04-data-layer.md
│   ├── 05-store-layer.md
│   ├── 06-view-layer.md
│   ├── 07-routes-file.md
│   ├── 08-permission-gate.md
│   ├── 09-empty-skeleton-states.md
│   └── 10-test-scaffolding.md
├── UI-Styling-Strategy.md                ← cross-cutting reference
├── UI-Sub-Nav-Zone.md
├── UI-Standards-Triage.md
└── ...
```

The **runtime/** folder is the "how a request becomes a render" reference. Cross-cutting topics (styling, sub-nav, BFF flow) live one level up.
