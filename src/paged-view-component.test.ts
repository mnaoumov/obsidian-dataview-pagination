import type { Component } from 'obsidian';

import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PagedViewComponentConstructorParams } from './paged-view-component.ts';

import { PagedViewComponent } from './paged-view-component.ts';

const ITEM_COUNT = 120;
const ITEMS = Array.from({ length: ITEM_COUNT }, (_, index) => index + 1);

interface Harness {
  readonly containerEl: HTMLElement;
  readonly pageComponents: Component[];
  readonly renderedPages: number[][];
  readonly scrollCalls: ScrollIntoViewOptions[];
  readonly view: PagedViewComponent<number>;
}

const views: PagedViewComponent<number>[] = [];

afterEach(() => {
  for (const view of views.splice(0)) {
    view.unload();
  }
});

describe('PagedViewComponent', () => {
  it('shows the first page and a pager that counts every item', async () => {
    const { containerEl, renderedPages, view } = createHarness();
    await view.setItems(ITEMS);

    expect(renderedPages).toEqual([ITEMS.slice(0, 25)]);
    expect(getSummary(containerEl)).toBe('Page 1 of 5, total items: 120');
    expect(getButton(containerEl, 'First').disabled).toBe(true);
    expect(getButton(containerEl, 'Previous').disabled).toBe(true);
    expect(getButton(containerEl, 'Next').disabled).toBe(false);
    expect(getButton(containerEl, '1').getAttribute('aria-current')).toBe('page');
    expect(containerEl.querySelector('.dataview-pagination-content')?.hasClass('dataview-pagination-paged')).toBe(true);
  });

  it('moves between pages with the navigation buttons', async () => {
    const { containerEl, renderedPages, view } = createHarness();
    await view.setItems(ITEMS);

    getButton(containerEl, 'Next').click();
    await waitForAllAsyncOperations();
    expect(renderedPages.at(-1)).toEqual(ITEMS.slice(25, 50));
    expect(getSummary(containerEl)).toBe('Page 2 of 5, total items: 120');

    getButton(containerEl, 'Last').click();
    await waitForAllAsyncOperations();
    expect(renderedPages.at(-1)).toEqual(ITEMS.slice(100));
    expect(getButton(containerEl, 'Next').disabled).toBe(true);
    expect(getButton(containerEl, 'Last').disabled).toBe(true);

    getButton(containerEl, 'Previous').click();
    await waitForAllAsyncOperations();
    expect(getSummary(containerEl)).toBe('Page 4 of 5, total items: 120');

    getButton(containerEl, '2').click();
    await waitForAllAsyncOperations();
    expect(getSummary(containerEl)).toBe('Page 2 of 5, total items: 120');

    getButton(containerEl, 'First').click();
    await waitForAllAsyncOperations();
    expect(getSummary(containerEl)).toBe('Page 1 of 5, total items: 120');
  });

  it('marks pages hidden past either end of the page buttons with an ellipsis', async () => {
    const { containerEl, view } = createHarness({ pageSizes: [10] });
    await view.setItems(ITEMS);

    const navigationEl = containerEl.querySelector('.dataview-pagination-navigation');
    expect(getEllipsisCount(navigationEl)).toBe(1);

    getButton(containerEl, '3').click();
    await waitForAllAsyncOperations();
    getButton(containerEl, '5').click();
    await waitForAllAsyncOperations();
    expect(getEllipsisCount(containerEl.querySelector('.dataview-pagination-navigation'))).toBe(2);

    getButton(containerEl, 'Last').click();
    await waitForAllAsyncOperations();
    expect(getEllipsisCount(containerEl.querySelector('.dataview-pagination-navigation'))).toBe(1);
  });

  it('goes back to the first page with the new page size when the page size changes', async () => {
    const { containerEl, renderedPages, view } = createHarness({ pageSizes: [25, 50] });
    await view.setItems(ITEMS);
    getButton(containerEl, 'Next').click();
    await waitForAllAsyncOperations();

    const selectEl = getSelect(containerEl);
    expect([...selectEl.options].map((option) => option.value)).toEqual(['25', '50']);
    selectEl.value = '50';
    selectEl.dispatchEvent(new Event('change'));
    await waitForAllAsyncOperations();

    expect(renderedPages.at(-1)).toEqual(ITEMS.slice(0, 50));
    expect(getSummary(containerEl)).toBe('Page 1 of 3, total items: 120');
    expect(getSelect(containerEl).value).toBe('50');
  });

  it('jumps to the page typed into the jump box on Enter', async () => {
    const { containerEl, renderedPages, view } = createHarness();
    await view.setItems(ITEMS);

    const jumpEl = getJumpInput(containerEl);
    expect(jumpEl.min).toBe('1');
    expect(jumpEl.max).toBe('5');
    jumpEl.value = '4';
    jumpEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await waitForAllAsyncOperations();

    expect(renderedPages.at(-1)).toEqual(ITEMS.slice(75, 100));
    expect(getSummary(containerEl)).toBe('Page 4 of 5, total items: 120');
  });

  it('ignores the jump box for other keys, an empty value and a page out of range', async () => {
    const { containerEl, renderedPages, view } = createHarness();
    await view.setItems(ITEMS);

    const jumpEl = getJumpInput(containerEl);
    jumpEl.value = '3';
    jumpEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    jumpEl.value = '';
    jumpEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    jumpEl.value = '9';
    jumpEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await waitForAllAsyncOperations();

    expect(renderedPages).toHaveLength(1);
    expect(getSummary(containerEl)).toBe('Page 1 of 5, total items: 120');
  });

  it('keeps the current page when the items change, and clamps it when the page is gone', async () => {
    const { containerEl, view } = createHarness();
    await view.setItems(ITEMS);
    getButton(containerEl, 'Last').click();
    await waitForAllAsyncOperations();

    await view.setItems(ITEMS.slice(0, 110));
    expect(getSummary(containerEl)).toBe('Page 5 of 5, total items: 110');

    await view.setItems(ITEMS.slice(0, 60));
    expect(getSummary(containerEl)).toBe('Page 3 of 3, total items: 60');
  });

  it('unloads the previous page\'s component when another page is drawn', async () => {
    const { containerEl, pageComponents, view } = createHarness();
    await view.setItems(ITEMS);
    getButton(containerEl, 'Next').click();
    await waitForAllAsyncOperations();

    const [firstPageComponent, secondPageComponent] = pageComponents;
    expect(firstPageComponent?._loaded).toBe(false);
    expect(secondPageComponent?._loaded).toBe(true);
  });

  it('draws a result no longer than the smallest page size without a pager', async () => {
    const { containerEl, renderedPages, view } = createHarness({ pageSizes: [5, 25] });
    await view.setItems([1, 2, 3]);

    expect(renderedPages).toEqual([[1, 2, 3]]);
    expect(containerEl.querySelector('.dataview-pagination-pager')?.childElementCount).toBe(0);
    expect(containerEl.querySelector('.dataview-pagination-content')?.hasClass('dataview-pagination-paged')).toBe(false);
  });

  it('shows the pager for a short result when the setting asks for it', async () => {
    const { containerEl, view } = createHarness({ shouldShowPagerForShortResults: true });
    await view.setItems([1, 2, 3]);

    expect(getSummary(containerEl)).toBe('Page 1 of 1, total items: 3');
  });

  it('draws the pager below the page by default', async () => {
    const { containerEl, view } = createHarness();
    await view.setItems(ITEMS);

    expect(getChildClasses(containerEl)).toEqual(['dataview-pagination-content', 'dataview-pagination-pager-below', 'dataview-pagination-status']);
  });

  it('draws the pager above the page when the placement is above', async () => {
    const { containerEl, view } = createHarness({ pagerPlacement: 'above' });
    await view.setItems(ITEMS);

    expect(getChildClasses(containerEl)).toEqual(['dataview-pagination-pager-above', 'dataview-pagination-content', 'dataview-pagination-status']);
    expect(getSummary(containerEl)).toBe('Page 1 of 5, total items: 120');
  });

  it('keeps both pagers in step when the placement is both, whichever one is used', async () => {
    const { containerEl, renderedPages, view } = createHarness({ pagerPlacement: 'both', pageSizes: [25, 50] });
    await view.setItems(ITEMS);

    expect(getChildClasses(containerEl)).toEqual(['dataview-pagination-pager-above', 'dataview-pagination-content', 'dataview-pagination-pager-below', 'dataview-pagination-status']);
    const aboveEl = getPager(containerEl, 'above');
    const belowEl = getPager(containerEl, 'below');

    getButton(belowEl, 'Next').click();
    await waitForAllAsyncOperations();
    expect(getSummaries(containerEl)).toEqual(['Page 2 of 5, total items: 120', 'Page 2 of 5, total items: 120']);
    expect(getButton(aboveEl, '2').getAttribute('aria-current')).toBe('page');

    getButton(aboveEl, 'Last').click();
    await waitForAllAsyncOperations();
    expect(renderedPages.at(-1)).toEqual(ITEMS.slice(100));
    expect(getSummaries(containerEl)).toEqual(['Page 5 of 5, total items: 120', 'Page 5 of 5, total items: 120']);

    const belowSelectEl = getSelect(belowEl);
    belowSelectEl.value = '50';
    belowSelectEl.dispatchEvent(new Event('change'));
    await waitForAllAsyncOperations();
    expect(getSelect(aboveEl).value).toBe('50');
    expect(getSummaries(containerEl)).toEqual(['Page 1 of 3, total items: 120', 'Page 1 of 3, total items: 120']);

    const aboveJumpEl = getJumpInput(aboveEl);
    aboveJumpEl.value = '3';
    aboveJumpEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await waitForAllAsyncOperations();
    expect(renderedPages.at(-1)).toEqual(ITEMS.slice(100));
    expect(getJumpInput(belowEl).max).toBe('3');
    expect(getSummaries(containerEl)).toEqual(['Page 3 of 3, total items: 120', 'Page 3 of 3, total items: 120']);
  });

  it('leaves both pagers empty for a short result when the placement is both', async () => {
    const { containerEl, view } = createHarness({ pagerPlacement: 'both' });
    await view.setItems([1, 2, 3]);

    expect(getPager(containerEl, 'above').childElementCount).toBe(0);
    expect(getPager(containerEl, 'below').childElementCount).toBe(0);
  });

  it('scrolls the view top into sight after every kind of page change when asked to', async () => {
    const { containerEl, scrollCalls, view } = createHarness({ pageSizes: [25, 50], shouldScrollToTopOnPageChange: true });
    await view.setItems(ITEMS);
    expect(scrollCalls).toEqual([]);

    getButton(containerEl, 'Next').click();
    await waitForAllAsyncOperations();
    getButton(containerEl, '3').click();
    await waitForAllAsyncOperations();
    getButton(containerEl, 'Previous').click();
    await waitForAllAsyncOperations();
    getButton(containerEl, 'Last').click();
    await waitForAllAsyncOperations();
    getButton(containerEl, 'First').click();
    await waitForAllAsyncOperations();

    const jumpEl = getJumpInput(containerEl);
    jumpEl.value = '4';
    jumpEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await waitForAllAsyncOperations();

    const selectEl = getSelect(containerEl);
    selectEl.value = '50';
    selectEl.dispatchEvent(new Event('change'));
    await waitForAllAsyncOperations();

    expect(scrollCalls).toEqual(Array.from({ length: 7 }, () => ({ block: 'start' })));
  });

  it('does not scroll on a refresh, even when asked to scroll on page changes', async () => {
    const { containerEl, scrollCalls, view } = createHarness({ shouldScrollToTopOnPageChange: true });
    await view.setItems(ITEMS);
    getButton(containerEl, 'Next').click();
    await waitForAllAsyncOperations();
    expect(scrollCalls).toHaveLength(1);

    await view.setItems(ITEMS.slice(0, 100));

    expect(getSummary(containerEl)).toBe('Page 2 of 4, total items: 100');
    expect(scrollCalls).toHaveLength(1);
  });

  it('does not scroll after a page change by default', async () => {
    const { containerEl, scrollCalls, view } = createHarness();
    await view.setItems(ITEMS);

    getButton(containerEl, 'Next').click();
    await waitForAllAsyncOperations();

    expect(getSummary(containerEl)).toBe('Page 2 of 5, total items: 120');
    expect(scrollCalls).toEqual([]);
  });

  it('announces the page summary through one live region, only when it changes', async () => {
    const { containerEl, view } = createHarness({ pagerPlacement: 'both' });
    const statusEls = containerEl.querySelectorAll('[aria-live]');
    expect(statusEls).toHaveLength(1);
    const statusEl = getStatus(containerEl);
    expect(statusEl.getAttribute('aria-live')).toBe('polite');
    expect(statusEl.getAttribute('aria-atomic')).toBe('true');
    expect(statusEl.getAttribute('role')).toBe('status');
    expect(statusEl.closest('nav')).toBeNull();

    await view.setItems(ITEMS);
    expect(statusEl.textContent).toBe('Page 1 of 5, total items: 120');
    const firstTextNode = statusEl.firstChild;

    await view.setItems([...ITEMS]);
    expect(statusEl.firstChild).toBe(firstTextNode);

    getButton(getPager(containerEl, 'below'), 'Next').click();
    await waitForAllAsyncOperations();
    expect(statusEl.textContent).toBe('Page 2 of 5, total items: 120');

    await view.setItems([1, 2, 3]);
    expect(statusEl.textContent).toBe('');
  });

  it('makes each pager a labelled navigation landmark', async () => {
    const single = createHarness();
    await single.view.setItems(ITEMS);
    expect(getPager(single.containerEl, 'below').tagName).toBe('NAV');
    expect(getPager(single.containerEl, 'below').getAttribute('aria-label')).toBe('Pagination');

    const both = createHarness({ pagerPlacement: 'both' });
    await both.view.setItems(ITEMS);
    expect(getPager(both.containerEl, 'above').getAttribute('aria-label')).toBe('Pagination above the results');
    expect(getPager(both.containerEl, 'below').getAttribute('aria-label')).toBe('Pagination below the results');
  });

  it('gives every pager control an accessible name and hides the decorative text', async () => {
    const { containerEl, view } = createHarness({ pageSizes: [10] });
    await view.setItems(ITEMS);
    getButton(containerEl, '3').click();
    await waitForAllAsyncOperations();
    getButton(containerEl, '5').click();
    await waitForAllAsyncOperations();

    const labels = [...containerEl.querySelectorAll(':scope .dataview-pagination-navigation button')].map((buttonEl) => buttonEl.getAttribute('aria-label'));
    expect(labels).toEqual(['First page', 'Previous page', 'Page 3', 'Page 4', 'Page 5', 'Page 6', 'Page 7', 'Next page', 'Last page']);
    const ellipses = [...containerEl.querySelectorAll(':scope .dataview-pagination-navigation span')];
    expect(ellipses).toHaveLength(2);
    expect(ellipses.every((span) => span.getAttribute('aria-hidden') === 'true')).toBe(true);

    expect(getSelect(containerEl).getAttribute('aria-label')).toBe('Items per page');
    expect(getJumpInput(containerEl).getAttribute('aria-label')).toBe('Jump to page, 1 to 12');
    const optionTexts = [...containerEl.querySelectorAll(':scope .dataview-pagination-options > span')];
    expect(optionTexts.every((span) => span.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('falls back to 50 items per page when no page size is configured', async () => {
    const { containerEl, renderedPages, view } = createHarness({ pageSizes: [] });
    await view.setItems(ITEMS);

    expect(renderedPages).toEqual([ITEMS.slice(0, 50)]);
    expect([...getSelect(containerEl).options].map((option) => option.value)).toEqual(['50']);
  });
});

function createHarness(params: Partial<Omit<PagedViewComponentConstructorParams<number>, 'containerEl' | 'renderPage'>> = {}): Harness {
  const containerEl = createDiv();
  const renderedPages: number[][] = [];
  const pageComponents: Component[] = [];
  const scrollCalls: ScrollIntoViewOptions[] = [];
  containerEl.scrollIntoView = vi.fn((options?: boolean | ScrollIntoViewOptions): void => {
    scrollCalls.push(typeof options === 'object' ? options : {});
  });
  const view = new PagedViewComponent<number>({
    containerEl,
    pagerPlacement: params.pagerPlacement ?? 'below',
    pageSizes: params.pageSizes ?? [25],
    renderPage(pageItems, pageEl, component): void {
      renderedPages.push(pageItems);
      pageComponents.push(component);
      pageEl.createDiv({ text: pageItems.join(',') });
    },
    shouldScrollToTopOnPageChange: params.shouldScrollToTopOnPageChange ?? false,
    shouldShowPagerForShortResults: params.shouldShowPagerForShortResults ?? false
  });
  view.load();
  views.push(view);
  return { containerEl, pageComponents, renderedPages, scrollCalls, view };
}

function getButton(containerEl: HTMLElement, label: string): HTMLButtonElement {
  const buttonEl = [...containerEl.querySelectorAll<HTMLButtonElement>(':scope .dataview-pagination-navigation button')].find((button) => button.textContent === label);
  if (!buttonEl) {
    throw new Error(`No ${label} button.`);
  }
  return buttonEl;
}

function getChildClasses(containerEl: HTMLElement): string[] {
  return [...containerEl.children].map((childEl) => [...childEl.classList].find((cls) => cls.startsWith('dataview-pagination-pager-')) ?? [...childEl.classList].find((cls) => cls === 'dataview-pagination-content' || cls === 'dataview-pagination-status') ?? '');
}

function getEllipsisCount(navigationEl: Element | null): number {
  return [...(navigationEl?.querySelectorAll('span') ?? [])].filter((span) => span.textContent === '...').length;
}

function getJumpInput(containerEl: HTMLElement): HTMLInputElement {
  const jumpEl = containerEl.querySelector<HTMLInputElement>(':scope .dataview-pagination-options input[type="number"]');
  if (!jumpEl) {
    throw new Error('No jump box.');
  }
  return jumpEl;
}

function getPager(containerEl: HTMLElement, placement: 'above' | 'below'): HTMLElement {
  const pagerEl = containerEl.querySelector<HTMLElement>(`:scope > .dataview-pagination-pager-${placement}`);
  if (!pagerEl) {
    throw new Error(`No pager ${placement} the page.`);
  }
  return pagerEl;
}

function getSelect(containerEl: HTMLElement): HTMLSelectElement {
  const selectEl = containerEl.querySelector<HTMLSelectElement>(':scope .dataview-pagination-options select');
  if (!selectEl) {
    throw new Error('No page size dropdown.');
  }
  return selectEl;
}

function getStatus(containerEl: HTMLElement): HTMLElement {
  const statusEl = containerEl.querySelector<HTMLElement>(':scope > .dataview-pagination-status');
  if (!statusEl) {
    throw new Error('No status region.');
  }
  return statusEl;
}

function getSummaries(containerEl: HTMLElement): string[] {
  return [...containerEl.querySelectorAll('.dataview-pagination-summary')].map((summaryEl) => summaryEl.textContent);
}

function getSummary(containerEl: HTMLElement): string {
  return containerEl.querySelector('.dataview-pagination-summary')?.textContent ?? '';
}
