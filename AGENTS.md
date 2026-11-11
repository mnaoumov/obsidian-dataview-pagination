# Dataview Pagination

Follow the shared Obsidian workspace conventions.

## Architecture

- `src/pagination.ts` is pure paging arithmetic and the parser for the page-size setting.
- `src/paged-view-component.ts` draws one page and the pager. It gives every page its own child component, so what the previous page rendered unloads with it.
- `src/paged-query-component.ts` runs a DQL `TABLE` or `LIST` through `api.query`, and re-runs it on `dataview:refresh-views` and when a hidden view is shown, the two triggers `Dataview`'s own renderer uses. A query that fails goes back to `Dataview`'s `execute`, so the error text stays its own.
- `src/dataview-pagination-component.ts` patches `api.execute`, `api.table` and `api.list` on the instance, re-patching on `dataview:api-ready` when `Dataview` reloads. `TASK` and `CALENDAR` queries pass through.

`TableGrouping` and the list renderer are bundled inside `Dataview`, so nothing can patch them. Instead, each page is drawn by calling `api.table` or `api.list` with only that page's rows. That is why `renderUnpaged` exists: without its flag, the slice would be paged a second time.

The stylesheet hides `Dataview`'s result count in the table heading while a view is paged, because it would show one page's rows; the pager's summary shows the total.

## Scope

`Dataview` only, pagination only, global settings only. The reasoning, and what was found about Datacore, Bases and Markdown tables, is recorded in the task that created this plugin. `Datacore` pages by default and core Bases tables are virtualized.

## Validation

The standard gate, plus `npm run test:integration:desktop` and `npm run test:integration:android`, whose suites download `Dataview` 0.5.70 from its `GitHub` release into the test vault. Both need network access, and the Android one boots the shared `obsidian_test` AVD. The Android suite only proves that a DQL table pages on a phone; page size, jump to page, refresh and the error fallback are covered on desktop. `src/dataview-api.ts` is typed by hand because `Dataview` publishes no types for these members.

`npm run capture:screenshots` regenerates `images/screenshots/screenshot-desktop-*.png` for the README and the listing, from `src/screenshots.desktop-capture.integration.test.ts`, then `screenshot-mobile-*.png` from `src/screenshots.android-capture.integration.test.ts`. The Android project, `capture-screenshots:android`, boots the 900x1600 `obsidian_screenshots` AVD, whose Obsidian must be at least the manifest's `minAppVersion` (`provision-obsidian-avd.ps1 -AvdName obsidian_screenshots`). No standard project collects either file, so the gate never rewrites the images.
