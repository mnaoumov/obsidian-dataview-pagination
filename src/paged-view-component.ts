import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import { Component } from 'obsidian';

import type { PagerPlacement } from './pagination.ts';

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
  readonly pagerPlacement: PagerPlacement;
  readonly pageSizes: readonly number[];
  readonly renderPage: RenderPage<T>;
  readonly shouldScrollToTopOnPageChange: boolean;
  readonly shouldShowPagerForShortResults: boolean;
}

/**
 * Draws one page of items.
 */
export type RenderPage<T> = (pageItems: T[], containerEl: HTMLElement, component: Component) => Promise<void> | void;

interface PagedViewComponentAddPageButtonParams {
  readonly accessibleLabel: string;
  readonly containerEl: HTMLElement;
  readonly isDisabled: boolean;
  readonly label: string;
  readonly targetPage: number;
}

/**
 * Shows a list of items one page at a time, with page controls below it, above it, or both.
 *
 * Every page gets its own child component, so whatever the previous page rendered is unloaded with it. Every pager is
 * redrawn from the same state on each render, so two pagers never disagree. When asked to, a page change made from a
 * pager scrolls the view's top into sight, so the reader starts the new page at its first row; a refresh never scrolls.
 *
 * Each pager is a `nav` landmark whose controls carry accessible names. One visually hidden live region, kept outside
 * the pagers so that two pagers announce once, reads the page summary out whenever it changes.
 */
export class PagedViewComponent<T> extends ComponentEx {
  private readonly containerEl: HTMLElement;
  private readonly contentEl: HTMLElement;
  private items: T[] = [];
  private page = 1;
  private pageComponent: Component | null = null;
  private readonly pagerEls: readonly HTMLElement[];
  private pageSize: number;
  private readonly pageSizes: readonly number[];
  private readonly renderPage: RenderPage<T>;
  private readonly shouldScrollToTopOnPageChange: boolean;
  private readonly shouldShowPagerForShortResults: boolean;
  private readonly statusEl: HTMLElement;

  public constructor(params: PagedViewComponentConstructorParams<T>) {
    super();
    this.pageSizes = params.pageSizes;
    this.pageSize = params.pageSizes[0] ?? FALLBACK_PAGE_SIZE;
    this.renderPage = params.renderPage;
    this.shouldScrollToTopOnPageChange = params.shouldScrollToTopOnPageChange;
    this.shouldShowPagerForShortResults = params.shouldShowPagerForShortResults;
    const { containerEl, pagerPlacement } = params;
    this.containerEl = containerEl;
    const isBoth = pagerPlacement === 'both';
    const pagerEls: HTMLElement[] = [];
    if (pagerPlacement !== 'below') {
      pagerEls.push(createPagerEl(containerEl, 'above', isBoth ? 'Pagination above the results' : 'Pagination'));
    }
    this.contentEl = containerEl.createDiv({ cls: 'dataview-pagination-content' });
    if (pagerPlacement !== 'above') {
      pagerEls.push(createPagerEl(containerEl, 'below', isBoth ? 'Pagination below the results' : 'Pagination'));
    }
    this.pagerEls = pagerEls;
    this.statusEl = containerEl.createDiv({
      attr: { 'aria-atomic': 'true', 'aria-live': 'polite', 'role': 'status' },
      cls: 'dataview-pagination-status'
    });
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
    const buttonEl = params.containerEl.createEl('button', { attr: { 'aria-label': params.accessibleLabel }, text: params.label });
    buttonEl.disabled = params.isDisabled;
    buttonEl.addEventListener('click', () => {
      invokeAsyncSafely(() => this.goToPage(params.targetPage));
    });
    return buttonEl;
  }

  private getPageSizeChoices(): readonly number[] {
    return this.pageSizes.length > 0 ? this.pageSizes : [this.pageSize];
  }

  private getSummaryText(pageCount: number): string {
    return `Page ${String(this.page)} of ${String(pageCount)}, total items: ${String(this.items.length)}`;
  }

  private async goToPage(page: number): Promise<void> {
    this.page = page;
    await this.render();
    if (this.shouldScrollToTopOnPageChange) {
      this.containerEl.scrollIntoView({ block: 'start' });
    }
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

    for (const pagerEl of this.pagerEls) {
      pagerEl.empty();
      if (isPagerVisible) {
        this.renderPager(pagerEl, pageCount);
      }
    }

    // Only a changed text is written, so a refresh that leaves the summary as it was announces nothing.
    const statusText = isPagerVisible ? this.getSummaryText(pageCount) : '';
    if (this.statusEl.textContent !== statusText) {
      this.statusEl.setText(statusText);
    }
  }

  private renderPager(pagerEl: HTMLElement, pageCount: number): void {
    const navigationEl = pagerEl.createDiv({ cls: 'dataview-pagination-navigation' });
    this.addPageButton({ accessibleLabel: 'First page', containerEl: navigationEl, isDisabled: this.page === 1, label: 'First', targetPage: 1 });
    this.addPageButton({
      accessibleLabel: 'Previous page',
      containerEl: navigationEl,
      isDisabled: this.page === 1,
      label: 'Previous',
      targetPage: this.page - 1
    });

    const visiblePages = getVisiblePageNumbers(this.page, pageCount);
    if (!visiblePages.includes(1)) {
      createEllipsis(navigationEl);
    }
    for (const visiblePage of visiblePages) {
      const buttonEl = this.addPageButton({
        accessibleLabel: `Page ${String(visiblePage)}`,
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
      createEllipsis(navigationEl);
    }

    this.addPageButton({
      accessibleLabel: 'Next page',
      containerEl: navigationEl,
      isDisabled: this.page === pageCount,
      label: 'Next',
      targetPage: this.page + 1
    });
    this.addPageButton({
      accessibleLabel: 'Last page',
      containerEl: navigationEl,
      isDisabled: this.page === pageCount,
      label: 'Last',
      targetPage: pageCount
    });

    const optionsEl = pagerEl.createDiv({ cls: 'dataview-pagination-options' });
    optionsEl.createSpan({ attr: { 'aria-hidden': 'true' }, text: 'Items per page: ' });
    const selectEl = optionsEl.createEl('select', { attr: { 'aria-label': 'Items per page' }, cls: 'dropdown' });
    for (const pageSize of this.getPageSizeChoices()) {
      selectEl.createEl('option', { text: String(pageSize), value: String(pageSize) });
    }
    selectEl.value = String(this.pageSize);
    selectEl.addEventListener('change', () => {
      this.pageSize = Number(selectEl.value);
      invokeAsyncSafely(() => this.goToPage(1));
    });

    optionsEl.createSpan({ attr: { 'aria-hidden': 'true' }, text: 'Jump to page: ' });
    const jumpEl = optionsEl.createEl('input', {
      attr: { 'aria-label': `Jump to page, 1 to ${String(pageCount)}`, 'max': pageCount, 'min': 1 },
      type: 'number'
    });
    jumpEl.addEventListener('keydown', (event_) => {
      if (event_.key === 'Enter' && jumpEl.value !== '' && jumpEl.reportValidity()) {
        invokeAsyncSafely(() => this.goToPage(Number(jumpEl.value)));
      }
    });

    pagerEl.createDiv({ cls: 'dataview-pagination-summary', text: this.getSummaryText(pageCount) });
  }
}

function createEllipsis(navigationEl: HTMLElement): void {
  navigationEl.createSpan({ attr: { 'aria-hidden': 'true' }, text: '...' });
}

function createPagerEl(containerEl: HTMLElement, placement: 'above' | 'below', label: string): HTMLElement {
  return containerEl.createEl('nav', {
    attr: { 'aria-label': label },
    cls: ['dataview-pagination-pager', `dataview-pagination-pager-${placement}`]
  });
}
