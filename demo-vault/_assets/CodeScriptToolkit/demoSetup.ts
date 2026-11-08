import type { App } from 'obsidian';

// Shared code for every `code-button` in this vault, so each note's button stays a one-liner.
//
// The plugin id has to match `manifest.json` exactly.
const PLUGIN_ID = 'dataview-pagination';

/**
 * Opens this plugin's settings tab.
 *
 * Manual equivalent: open **Settings** and pick `Dataview Pagination` in the sidebar.
 */
export function openPluginSettings(app: App): void {
  app.setting.open();
  app.setting.openTabById(PLUGIN_ID);
}
