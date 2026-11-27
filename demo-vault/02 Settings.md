# Settings

Every setting `Dataview Pagination` stores, listed by the **key it is written under in `data.json`** rather than by its display label. That is what you see when you open the file, hit a sync conflict, or read a support thread.

Find them in Obsidian under **Settings → Community plugins → `Dataview Pagination`**.

```code-button
---
caption: Open the plugin's settings
---
require('/demoSetup.ts').openPluginSettings(app);
```

Manual equivalent: open **Settings** and pick `Dataview Pagination` in the sidebar.

## General

- `isPaginationEnabled`
  - shown as **Enable pagination**. On by default. Turn it off to get `Dataview`'s normal views back the next time they render.
- `pageSizes`
  - shown as **Items per page**. Comma-separated choices for the dropdown in each view's page controls. The first one is the default page size, and anything that is not a positive whole number is ignored.
- `pagerPlacement`
  - shown as **Controls position**. `below` by default, which draws the page controls under each view. `above` draws them over it, and `both` draws a copy in each place, so a page of 100 or 200 rows needs no scrolling to reach **Next**. Both copies always show the same page, and any control in either one works. Like the other settings, it applies the next time a view renders.
- `shouldScrollToTopOnPageChange`
  - shown as **Scroll to the top on page change**. Off by default. Turn it on and every page change made from the page controls (**First**, **Previous**, a page number, **Next**, **Last**, a jump or a new page size) scrolls the note so the view's first row is in sight, so pressing **Next** under a long page starts you at the top of the new one. A refresh after the vault changes never scrolls.
- `shouldShowPagerForShortResults`
  - shown as **Show controls for short results**. Off by default, so a result that fits on one page looks exactly as it does without the plugin.
