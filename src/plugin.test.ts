import type { PluginManifest } from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { Plugin as ObsidianPlugin } from 'obsidian';
import {
  App,
  Plugin as PluginHost
} from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettings } from './plugin-settings.ts';

import { DataviewPaginationComponent } from './dataview-pagination-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { Plugin } from './plugin.ts';

describe('DataviewPagination', () => {
  it('extends the Obsidian Plugin class', () => {
    expect(Plugin.prototype).toBeInstanceOf(ObsidianPlugin);
  });

  // The plugin's own `onload` runs here, so this proves the command is registered, not only imported.
  it('registers the Report a bug command', async () => {
    const plugin = new Plugin(App.createConfigured__().asOriginalType__(), createManifest());
    await plugin.onload();
    expect(PluginHost.fromOriginalType2__(plugin).commands__.has('report-bug')).toBe(true);
    plugin.unload();
  });

  it('hands the pagination component the live settings', async () => {
    const plugin = new Plugin(App.createConfigured__().asOriginalType__(), createManifest());
    const addChildSpy = vi.spyOn(plugin, 'addChild');
    await plugin.onload();

    const children: unknown[] = addChildSpy.mock.calls.map(([child]) => child);
    const settingsComponent = ensureNonNullable(children.find((child) => child instanceof PluginSettingsComponent));
    const paginationComponent = ensureNonNullable(children.find((child) => child instanceof DataviewPaginationComponent));
    const { getSettings } = castTo<PaginationComponentInternals>(paginationComponent);

    expect(getSettings()).toBe(settingsComponent.settings);
    plugin.unload();
  });
});

interface PaginationComponentInternals {
  readonly getSettings: () => PluginSettings;
}

function createManifest(): PluginManifest {
  return {
    author: 'test',
    description: 'test',
    id: 'test-plugin',
    minAppVersion: '0.0.0',
    name: 'Test Plugin',
    version: '0.0.0'
  };
}
