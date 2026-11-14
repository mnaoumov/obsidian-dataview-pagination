import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import { Component } from 'obsidian';

import type {
  DataviewApi,
  DataviewQueryResult
} from './dataview-api.ts';
import type { RenderPage } from './paged-view-component.ts';

import { PagedViewComponent } from './paged-view-component.ts';

/**
 * Parameters for {@link PagedQueryComponent}.
 */
export interface PagedQueryComponentConstructorParams {
  readonly api: DataviewApi;
  readonly containerEl: HTMLElement;
  readonly filePath: string;
  readonly pageSizes: readonly number[];
  readonly renderFallback: (containerEl: HTMLElement, component: Component) => Promise<void>;
  readonly renderList: (values: unknown[], containerEl: HTMLElement, component: Component) => Promise<void>;
  readonly renderTable: (headers: string[], values: unknown[][], containerEl: HTMLElement, component: Component) => Promise<void>;
  readonly shouldShowPagerForShortResults: boolean;
  readonly source: string;
}

/**
 * Runs a TABLE or LIST query, shows it one page at a time, and runs it again when the vault changes.
 *
 * A query that fails is handed back to `Dataview`, so its error message stays `Dataview`'s own.
 */
export class PagedQueryComponent extends ComponentEx {
  private fallbackComponent: Component | null = null;
  private lastRevision = -1;
  private pagedView: null | PagedViewComponent<unknown> = null;
  private readonly params: PagedQueryComponentConstructorParams;

  private resultType: DataviewQueryResult['type'] | null = null;

  public constructor(params: PagedQueryComponentConstructorParams) {
    super();
    const { api, containerEl, filePath, pageSizes, renderFallback, renderList, renderTable, shouldShowPagerForShortResults, source } = params;
    this.params = { api, containerEl, filePath, pageSizes, renderFallback, renderList, renderTable, shouldShowPagerForShortResults, source };
  }

  public override onload(): void {
    super.onload();
    this.lastRevision = this.params.api.index.revision;
    this.refresh();
    const maybeRefresh = this.maybeRefresh.bind(this);
    this.registerEvent(this.params.api.app.workspace.on('dataview:refresh-views' as 'quit', maybeRefresh));
    // A view that was hidden when the vault changed is brought up to date when it is shown.
    this.register(this.params.containerEl.onNodeInserted(maybeRefresh));
  }

  private createPagedView(value: DataviewQueryResult): PagedViewComponent<unknown> {
    const { containerEl, pageSizes, renderList, renderTable, shouldShowPagerForShortResults } = this.params;
    const renderPage: RenderPage<unknown> = value.type === 'table'
      ? (pageItems, pageEl, component): Promise<void> => renderTable(value.headers, pageItems as unknown[][], pageEl, component)
      : (pageItems, pageEl, component): Promise<void> => renderList(pageItems, pageEl, component);
    return new PagedViewComponent({ containerEl, pageSizes, renderPage, shouldShowPagerForShortResults });
  }

  private maybeRefresh(): void {
    const { api, containerEl } = this.params;
    if (api.index.revision === this.lastRevision || !containerEl.isShown() || !api.settings.refreshEnabled) {
      return;
    }
    this.lastRevision = api.index.revision;
    this.refresh();
  }

  private refresh(): void {
    invokeAsyncSafely(() => this.run());
  }

  private reset(): void {
    if (this.pagedView) {
      this.removeChild(this.pagedView);
      this.pagedView = null;
    }
    if (this.fallbackComponent) {
      this.removeChild(this.fallbackComponent);
      this.fallbackComponent = null;
    }
    this.resultType = null;
    this.params.containerEl.empty();
  }

  private async run(): Promise<void> {
    const { api, containerEl, filePath, renderFallback, source } = this.params;
    const result = await api.query(source, filePath);

    if (!result.successful || !result.value) {
      this.reset();
      this.fallbackComponent = this.addChild(new Component());
      await renderFallback(containerEl, this.fallbackComponent);
      return;
    }

    const { value } = result;
    if (this.resultType !== value.type || !this.pagedView) {
      this.reset();
      this.resultType = value.type;
      this.pagedView = this.addChild(this.createPagedView(value));
    }
    await this.pagedView.setItems(value.values);
  }
}
