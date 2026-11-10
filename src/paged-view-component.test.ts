import type { Component } from 'obsidian';

import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

import type { PagedViewComponentConstructorParams } from './paged-view-component.ts';

import { PagedViewComponent } from './paged-view-component.ts';

const ITEM_COUNT = 120;
const ITEMS = Array.from({ length: ITEM_COUNT }, (_, index) => index + 1);

interface Harness {
  readonly containerEl: HTMLElement;
  readonly pageComponents: Component[];
  readonly renderedPages: number[][];
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
  const view = new PagedViewComponent<number>({
    containerEl,
    pageSizes: params.pageSizes ?? [25],
    renderPage(pageItems, pageEl, component): void {
      renderedPages.push(pageItems);
      pageComponents.push(component);
      pageEl.createDiv({ text: pageItems.join(',') });
    },
    shouldShowPagerForShortResults: params.shouldShowPagerForShortResults ?? false
  });
  view.load();
  views.push(view);
  return { containerEl, pageComponents, renderedPages, view };
}

function getButton(containerEl: HTMLElement, label: string): HTMLButtonElement {
  const buttonEl = [...containerEl.querySelectorAll<HTMLButtonElement>(':scope .dataview-pagination-navigation button')].find((button) => button.textContent === label);
  if (!buttonEl) {
    throw new Error(`No ${label} button.`);
  }
  return buttonEl;
}

function getEllipsisCount(navigationEl: Element | null): number {
  return [...navigationEl?.querySelectorAll('span') ?? []].filter((span) => span.textContent === '...').length;
}

function getJumpInput(containerEl: HTMLElement): HTMLInputElement {
  const jumpEl = containerEl.querySelector<HTMLInputElement>(':scope .dataview-pagination-options input[type="number"]');
  if (!jumpEl) {
    throw new Error('No jump box.');
  }
  return jumpEl;
}

function getSelect(containerEl: HTMLElement): HTMLSelectElement {
  const selectEl = containerEl.querySelector<HTMLSelectElement>(':scope .dataview-pagination-options select');
  if (!selectEl) {
    throw new Error('No page size dropdown.');
  }
  return selectEl;
}

function getSummary(containerEl: HTMLElement): string {
  return containerEl.querySelector('.dataview-pagination-summary')?.textContent ?? '';
}
