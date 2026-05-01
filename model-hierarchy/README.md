# Model Hierarchy — UML Class Diagrams

Comprehensive diagrams of every TypeScript model defined in `src/UI/Enterprise.Platform.Web.UI/ClientApp/src/`. Sources are Mermaid (`.mmd`); SVG renders sit alongside.

## Contents

| # | File | Domain |
|---|------|--------|
| 00 | [`00-master-overview.mmd`](./00-master-overview.svg) | Top-level — every domain at a glance |
| 01 | [`01-core-foundation.mmd`](./01-core-foundation.svg) | `BaseEntity`, `EntityDataState<T>`, `RouteMetadata`, `CurrentUser`, `EffectivePermissions` |
| 02 | [`02-api-contracts.mmd`](./02-api-contracts.svg) | `PagedResponse<T>`, `ApiResponse<T>`, `ApiError`, `QueryParams`, `SortConfig`, `SortDirection` |
| 03 | [`03-chrome-navbar.mmd`](./03-chrome-navbar.svg) | `NavbarConfig` + every right-zone widget config |
| 04 | [`04-chrome-menu-items.mmd`](./04-chrome-menu-items.svg) | `NavMenuItem`/`Section`/`Leaf`, `UserMenuItem` discriminated union |
| 05 | [`05-chrome-footer.mmd`](./05-chrome-footer.svg) | `FooterConfig` + 11 composable section blocks |
| 06 | [`06-login-page.mmd`](./06-login-page.svg) | `LoginPageConfig` + provider / hero / company / banner blocks |
| 07 | [`07-sub-nav.mmd`](./07-sub-nav.svg) | `BreadcrumbItem`, `PageHeaderConfig`, `PageHeaderAction` |
| 08 | [`08-events.mmd`](./08-events.svg) | `NavActionEvent`, `NavNotification`, tenant-switch / search / logout |
| 09 | [`09-dph-forms.mmd`](./09-dph-forms.svg) | `FormSchema`, `SchemaField`, `SchemaFormEvent` discriminated union |
| 10 | [`10-dph-data-table.mmd`](./10-dph-data-table.svg) | `TableConfig<T>`, `ColumnDef<T>`, filters, sorting, pagination, data source |
| 11 | [`11-dph-wizard.mmd`](./11-dph-wizard.svg) | `StepsConfig`, `StepDescriptor`, `WizardButtonsConfig` |
| 12 | [`12-dph-components.mmd`](./12-dph-components.svg) | Dialog / Drawer / Popover / Panel / Menu / Tree / Image / Avatar / File / Button |
| 13 | [`13-chart-widget.mmd`](./13-chart-widget.svg) | `ChartWidgetConfig`, `ChartWidgetDataset`, palette tokens |
| 14 | [`14-users-feature.mmd`](./14-users-feature.svg) | `UserDto`, `ListUsersResponse`, request DTOs |

## Source format

Each diagram is authored in [Mermaid](https://mermaid.js.org/) v10+ class-diagram syntax. Mermaid is the source of truth — the SVGs in this folder are generated artefacts.

## Regenerating SVGs

From this folder:

```bash
# one file
npx -y @mermaid-js/mermaid-cli -i 03-chrome-navbar.mmd -o 03-chrome-navbar.svg

# all files
for f in *.mmd; do
  npx -y @mermaid-js/mermaid-cli -i "$f" -o "${f%.mmd}.svg"
done
```

Mermaid CLI bundles Puppeteer + Chromium (~150 MB on first run) — this is a one-time cost.

## Editing in VS Code

Install the **Markdown Preview Mermaid Support** extension; mermaid blocks in `.md` files render inline. For standalone `.mmd` files use the **Mermaid Editor** extension.

## Conventions in these diagrams

- `<<interface>>` — TypeScript `export interface`
- `<<type>>` — TypeScript `export type` (alias / union / literal)
- `<<discriminated union>>` — TS union narrowed by a discriminator field (`type`, `kind`)
- `<<const>>` — exported runtime constant (e.g. `DEFAULT_QUERY_PARAMS`)
- `+readonly fieldName` — required field
- `+readonly fieldName?` — optional field
- `*--` composition (owns lifetime)
- `o--` aggregation / optional reference
- `<|--` extends / implements
- `..>` dependency / reference (imports the type)

## Cross-tier mirror

Most chrome-related types here have a 1:1 C# DTO mirror in `src/Contracts/Enterprise.Platform.Contracts/DTOs/Chrome/ChromeDtos.cs`. The architecture contract test diffs property names between the two and fails CI when one drifts.

The `master-config.models.ts` + `MasterConfigModels.cs` files in `docs/Architecture/` are reference snapshots that document divergent vocabularies (e.g. `Severity` vs `secondary`/`neutral`).
