import type { PluginSettingsComponentBase } from '@mnaoumov/obsidian-lib/components/plugin-settings-component';
import type {
  Plugin,
  SettingGroup
} from 'obsidian';

import { SettingEx } from '@mnaoumov/obsidian-lib/setting-ex';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  TextComponent,
  ToggleComponent
} from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { PluginSettings } from './plugin-settings.ts';

interface BoundRow {
  readonly componentType: string;
  readonly propertyName: string;
}

describe('PluginSettingsTab', () => {
  it('should declare the three settings by name, in order', () => {
    const tab = createTab();

    expect(tab.getSettingDefinitions().map((definition) => 'name' in definition ? definition.name : '')).toEqual([
      'Enable pagination',
      'Items per page',
      'Show controls for short results'
    ]);
  });

  it('should bind each row\'s control to its own setting when rendered', () => {
    const tab = createTab();
    const bindSpy = vi.spyOn(tab, 'bind').mockImplementation((params) => params.valueComponent);

    for (const definition of tab.getSettingDefinitions()) {
      if ('render' in definition) {
        definition.render(new SettingEx(tab.containerEl), castTo<SettingGroup>(null));
      }
    }

    expect(bindSpy.mock.calls.map(([params]): BoundRow => ({
      componentType: describeComponent(params.valueComponent),
      propertyName: params.propertyName
    }))).toEqual([
      { componentType: 'toggle', propertyName: 'isPaginationEnabled' },
      { componentType: 'text', propertyName: 'pageSizes' },
      { componentType: 'toggle', propertyName: 'shouldShowPagerForShortResults' }
    ]);
  });
});

function createTab(): PluginSettingsTab {
  const pluginSettingsComponent = strictProxy<PluginSettingsComponentBase<PluginSettings>>({
    defaultSettings: new PluginSettings(),
    on: vi.fn().mockReturnValue({ id: 'ref' }),
    settings: new PluginSettings(),
    settingsState: {
      effectiveValues: new PluginSettings(),
      inputValues: new PluginSettings(),
      validationMessages: {
        isPaginationEnabled: '',
        pageSizes: '',
        shouldShowPagerForShortResults: ''
      }
    }
  });

  const plugin = strictProxy<Plugin>({
    app: {
      workspace: {
        on: vi.fn().mockReturnValue({ id: 'test' })
      }
    }
  });

  const tab = new PluginSettingsTab({
    plugin,
    pluginSettingsComponent
  });
  tab.containerEl = activeWindow.createDiv();
  return tab;
}

function describeComponent(component: unknown): string {
  if (component instanceof ToggleComponent) {
    return 'toggle';
  }

  if (component instanceof TextComponent) {
    return 'text';
  }

  return 'other';
}
