import type { SettingDefinitionItem } from 'obsidian';

import { PluginSettingsTabBase } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      this.settingEx({
        desc: 'Show Dataview tables and lists one page at a time. Views already on screen change the next time they render.',
        name: 'Enable pagination',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'isPaginationEnabled', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: 'Comma-separated choices for the items per page control. The first one is the default.',
        name: 'Items per page',
        render: (setting) => {
          setting.addText((text) => {
            this.bind({ propertyName: 'pageSizes', valueComponent: text });
          });
        }
      }),
      this.settingEx({
        desc: 'Show the page controls even when every result fits on one page.',
        name: 'Show controls for short results',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldShowPagerForShortResults', valueComponent: toggle });
          });
        }
      })
    ];
  }
}
