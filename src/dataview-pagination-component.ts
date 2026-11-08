import type { App } from 'obsidian';

import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { noopAsync } from '@mnaoumov/typescript-lib/function';

import type { DataviewApi } from './dataview-api.ts';
import type { RenderPage } from './paged-view-component.ts';
import type { PluginSettings } from './plugin-settings.ts';

import { PagedQueryComponent } from './paged-query-component.ts';
import { PagedViewComponent } from './paged-view-component.ts';
import { parsePageSizes } from './pagination.ts';

interface DataviewPluginInstance {
  readonly api?: DataviewApi;
}

const PAGED_QUERY_PATTERN = /^\s*(?:list|table)\b/iu;

/**
 * Parameters for {@link DataviewPaginationComponent}.
 */
export interface DataviewPaginationComponentConstructorParams {
  readonly app: App;
  readonly getSettings: () => PluginSettings;
}

/**
 * Wraps the three entry points every `Dataview` table and list goes through, so each one is drawn a page at a time by
 * `Dataview`'s own renderer. TASK and CALENDAR queries pass through untouched.
 */
export class DataviewPaginationComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly getSettings: () => PluginSettings;
  private isRenderingPage = false;
  private patchedApi: DataviewApi | null = null;

  public constructor(params: DataviewPaginationComponentConstructorParams) {
    super();
    this.app = params.app;
    this.getSettings = params.getSettings;
  }

  public override onload(): void {
    super.onload();
    this.registerEvent(this.app.metadataCache.on('dataview:api-ready' as 'resolved', this.patchCurrentApi.bind(this)));
    this.app.workspace.onLayoutReady(this.patchCurrentApi.bind(this));
    this.patchCurrentApi();
  }

  private createPagedView(
    containerEl: HTMLElement,
    renderPage: RenderPage<unknown>
  ): PagedViewComponent<unknown> {
    const settings = this.getSettings();
    return new PagedViewComponent<unknown>({
      containerEl,
      pageSizes: parsePageSizes(settings.pageSizes),
      renderPage,
      shouldShowPagerForShortResults: settings.shouldShowPagerForShortResults
    });
  }

  private getDataviewApi(): DataviewApi | null {
    const plugin = this.app.plugins.getPlugin('dataview') as DataviewPluginInstance | null;
    return plugin?.api ?? null;
  }

  private patchCurrentApi(): void {
    const api = this.getDataviewApi();
    if (!api || api === this.patchedApi) {
      return;
    }
    this.patchedApi = api;
    this.patchTable(api);
    this.patchList(api);
    this.patchExecute(api);
  }

  private patchExecute(api: DataviewApi): void {
    this.registerMethodPatch({
      $object: api,
      methodName: 'execute',
      patchHandler: ({ fallback, originalArguments: [source, container, component, filePath], originalMethodBound }) => {
        if (this.shouldPassThrough() || !PAGED_QUERY_PATTERN.test(source)) {
          return fallback();
        }
        const settings = this.getSettings();
        component.addChild(
          new PagedQueryComponent({
            api,
            containerEl: container,
            filePath,
            pageSizes: parsePageSizes(settings.pageSizes),
            renderFallback: (fallbackEl, fallbackComponent): Promise<void> => originalMethodBound(source, fallbackEl, fallbackComponent, filePath),
            renderList: (values, pageEl, pageComponent): Promise<void> => this.renderUnpaged(() => api.list(values, pageEl, pageComponent, filePath)),
            renderTable: (headers, values, pageEl, pageComponent): Promise<void> => this.renderUnpaged(() => api.table(headers, values, pageEl, pageComponent, filePath)),
            shouldShowPagerForShortResults: settings.shouldShowPagerForShortResults,
            source
          })
        );
        return noopAsync();
      }
    });
  }

  private patchList(api: DataviewApi): void {
    this.registerMethodPatch({
      $object: api,
      methodName: 'list',
      patchHandler: ({ fallback, originalArguments: [values, container, component, filePath], originalMethodBound }) => {
        if (this.shouldPassThrough() || !isIterable(values)) {
          return fallback();
        }
        const pagedView = component.addChild(
          this.createPagedView(container, (pageItems, pageEl, pageComponent) => originalMethodBound(pageItems, pageEl, pageComponent, filePath))
        );
        return pagedView.setItems([...values]);
      }
    });
  }

  private patchTable(api: DataviewApi): void {
    this.registerMethodPatch({
      $object: api,
      methodName: 'table',
      patchHandler: ({ fallback, originalArguments: [headers, values, container, component, filePath], originalMethodBound }) => {
        if (this.shouldPassThrough() || !isIterable(values)) {
          return fallback();
        }
        const pagedView = component.addChild(
          this.createPagedView(container, (pageItems, pageEl, pageComponent) => originalMethodBound(headers, pageItems, pageEl, pageComponent, filePath))
        );
        return pagedView.setItems([...values]);
      }
    });
  }

  /**
   * Calls a patched renderer for a slice that is already one page, so it draws the slice instead of paging it again.
   * The patches read the flag synchronously on entry, so it is cleared before anything else can run.
   *
   * @param render - The renderer call.
   * @returns The renderer's promise.
   */
  private renderUnpaged(render: () => Promise<void>): Promise<void> {
    this.isRenderingPage = true;
    try {
      return render();
    } finally {
      this.isRenderingPage = false;
    }
  }

  private shouldPassThrough(): boolean {
    return this.isRenderingPage || !this.getSettings().isPaginationEnabled;
  }
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function';
}
