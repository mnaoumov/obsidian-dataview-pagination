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
  - shown as **Items per page**. Comma-separated choices for the dropdown under each view. The first one is the default page size, and anything that is not a positive whole number is ignored.
- `shouldShowPagerForShortResults`
  - shown as **Show controls for short results**. Off by default, so a result that fits on one page looks exactly as it does without the plugin.
