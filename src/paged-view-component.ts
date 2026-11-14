import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import { Component } from 'obsidian';

import {
  clampPage,
  getPageCount,
  getPageItems,
  getVisiblePageNumbers
} from './pagination.ts';

const FALLBACK_PAGE_SIZE = 50;

/**
 * Parameters for {@link PagedViewComponent}.
 */
export interface PagedViewComponentConstructorParams<T> {
  readonly containerEl: HTMLElement;
  readonly pageSizes: readonly number[];
  readonly renderPage: RenderPage<T>;
  readonly shouldShowPagerForShortResults: boolean;
}

/**
 * Draws one page of items.
 */
export type RenderPage<T> = (pageItems: T[], containerEl: HTMLElement, component: Component) => Promise<void> | void;

interface PagedViewComponentAddPageButtonParams {
  readonly containerEl: HTMLElement;
  readonly isDisabled: boolean;
  readonly label: string;
  readonly targetPage: number;
}

/**
 * Shows a list of items one page at a time, with page controls below it.
 *
 * Every page gets its own child component, so whatever the previous page rendered is unloaded with it.
 */
export class PagedViewComponent<T> extends ComponentEx {
  private readonly contentEl: HTMLElement;
  private items: T[] = [];
  private page = 1;
  private pageComponent: Component | null = null;
  private readonly pagerEl: HTMLElement;
  private pageSize: number;
  private readonly pageSizes: readonly number[];
  private readonly renderPage: RenderPage<T>;
  private readonly shouldShowPagerForShortResults: boolean;

  public constructor(params: PagedViewComponentConstructorParams<T>) {
    super();
    this.pageSizes = params.pageSizes;
    this.pageSize = params.pageSizes[0] ?? FALLBACK_PAGE_SIZE;
    this.renderPage = params.renderPage;
    this.shouldShowPagerForShortResults = params.shouldShowPagerForShortResults;
    this.contentEl = params.containerEl.createDiv({ cls: 'dataview-pagination-content' });
    this.pagerEl = params.containerEl.createDiv({ cls: 'dataview-pagination-pager' });
  }

  /**
   * Replaces the items, keeping the current page when it still exists.
   *
   * @param items - The new items.
   */
  public async setItems(items: T[]): Promise<void> {
    this.items = items;
    await this.render();
  }

  private addPageButton(params: PagedViewComponentAddPageButtonParams): HTMLButtonElement {
    const buttonEl = params.containerEl.createEl('button', { text: params.label });
    buttonEl.disabled = params.isDisabled;
    buttonEl.addEventListener('click', () => {
      invokeAsyncSafely(() => this.goToPage(params.targetPage));
    });
    return buttonEl;
  }

  private getPageSizeChoices(): readonly number[] {
    return this.pageSizes.length > 0 ? this.pageSizes : [this.pageSize];
  }

  private async goToPage(page: number): Promise<void> {
    this.page = page;
    await this.render();
  }

  private isPagerVisible(): boolean {
    return this.shouldShowPagerForShortResults || this.items.length > Math.min(...this.getPageSizeChoices());
  }

  private async render(): Promise<void> {
    const pageCount = getPageCount(this.items.length, this.pageSize);
    this.page = clampPage(this.page, pageCount);

    if (this.pageComponent) {
      this.removeChild(this.pageComponent);
    }
    this.pageComponent = this.addChild(new Component());
    this.contentEl.empty();

    const isPagerVisible = this.isPagerVisible();
    this.contentEl.toggleClass('dataview-pagination-paged', isPagerVisible);
    const pageItems = isPagerVisible ? getPageItems(this.items, this.page, this.pageSize) : this.items;
    await this.renderPage(pageItems, this.contentEl, this.pageComponent);

    this.pagerEl.empty();
    if (isPagerVisible) {
      this.renderPager(pageCount);
    }
  }

  private renderPager(pageCount: number): void {
    const navigationEl = this.pagerEl.createDiv({ cls: 'dataview-pagination-navigation' });
    this.addPageButton({ containerEl: navigationEl, isDisabled: this.page === 1, label: 'First', targetPage: 1 });
    this.addPageButton({ containerEl: navigationEl, isDisabled: this.page === 1, label: 'Previous', targetPage: this.page - 1 });

    const visiblePages = getVisiblePageNumbers(this.page, pageCount);
    if (!visiblePages.includes(1)) {
      navigationEl.createSpan({ text: '...' });
    }
    for (const visiblePage of visiblePages) {
      const buttonEl = this.addPageButton({
        containerEl: navigationEl,
        isDisabled: false,
        label: String(visiblePage),
        targetPage: visiblePage
      });
      if (visiblePage !== this.page) {
        continue;
      }

      buttonEl.addClass('dataview-pagination-current');
      buttonEl.setAttr('aria-current', 'page');
    }
    if (!visiblePages.includes(pageCount)) {
      navigationEl.createSpan({ text: '...' });
    }

    this.addPageButton({ containerEl: navigationEl, isDisabled: this.page === pageCount, label: 'Next', targetPage: this.page + 1 });
    this.addPageButton({ containerEl: navigationEl, isDisabled: this.page === pageCount, label: 'Last', targetPage: pageCount });

    const optionsEl = this.pagerEl.createDiv({ cls: 'dataview-pagination-options' });
    optionsEl.createSpan({ text: 'Items per page: ' });
    const selectEl = optionsEl.createEl('select', { cls: 'dropdown' });
    for (const pageSize of this.getPageSizeChoices()) {
      selectEl.createEl('option', { text: String(pageSize), value: String(pageSize) });
    }
    selectEl.value = String(this.pageSize);
    selectEl.addEventListener('change', () => {
      this.pageSize = Number(selectEl.value);
      invokeAsyncSafely(() => this.goToPage(1));
    });

    optionsEl.createSpan({ text: 'Jump to page: ' });
    const jumpEl = optionsEl.createEl('input', { attr: { max: pageCount, min: 1 }, type: 'number' });
    jumpEl.addEventListener('keydown', (event_) => {
      if (event_.key === 'Enter' && jumpEl.value !== '' && jumpEl.reportValidity()) {
        invokeAsyncSafely(() => this.goToPage(Number(jumpEl.value)));
      }
    });

    this.pagerEl.createDiv({
      cls: 'dataview-pagination-summary',
      text: `Page ${String(this.page)} of ${String(pageCount)}, total items: ${String(this.items.length)}`
    });
  }
}
