import type { PagerPlacement } from './pagination.ts';

export class PluginSettings {
  public isPaginationEnabled = true;
  public pagerPlacement: PagerPlacement = 'below';
  public pageSizes = '25, 50, 100, 200';
  public shouldShowPagerForShortResults = false;
}
