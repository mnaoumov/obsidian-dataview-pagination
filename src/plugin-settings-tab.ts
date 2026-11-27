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
        desc: 'Where the page controls appear. Both puts a copy above the page as well, so a long page needs no scrolling to reach them.',
        name: 'Controls position',
        render: (setting) => {
          setting.addDropdown((dropdown) => {
            dropdown.addOptions({
              below: 'Below the page',
              // eslint-disable-next-line perfectionist/sort-objects -- The dropdown lists the options in this order.
              above: 'Above the page',
              both: 'Above and below'
            });
            this.bind({ propertyName: 'pagerPlacement', valueComponent: dropdown });
          });
        }
      }),
      this.settingEx({
        desc: 'After First, Previous, Next, Last, a page number, a jump or a new page size, scroll the view back so its first row is in sight. A refresh never scrolls.',
        name: 'Scroll to the top on page change',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldScrollToTopOnPageChange', valueComponent: toggle });
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
