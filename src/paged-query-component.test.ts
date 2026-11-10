import type { Component } from 'obsidian';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DataviewApi } from './dataview-api.ts';

import { PagedQueryComponent } from './paged-query-component.ts';

const ITEM_COUNT = 30;
const PAGE_SIZE = 10;
const FALLBACK_OUTPUT = 'Query error';

type DataviewResult = Awaited<ReturnType<DataviewApi['query']>>;

interface Harness {
  readonly api: FakeDataviewApi;
  readonly component: PagedQueryComponent;
  readonly containerEl: HTMLElement;
  readonly fallbackCalls: Component[];
  readonly listCalls: unknown[][];
  readonly tableCalls: TableCall[];
}

interface TableCall {
  readonly headers: string[];
  readonly values: unknown[][];
}

class FakeDataviewApi implements DataviewApi {
  public readonly app = App.createConfigured__().asOriginalType__();
  public readonly index = { revision: 1 };
  public result: DataviewResult = { successful: false };
  public readonly settings = { refreshEnabled: true };

  public execute(): Promise<void> {
    throw new Error('Not used by PagedQueryComponent.');
  }

  public list(): Promise<void> {
    throw new Error('Not used by PagedQueryComponent.');
  }

  public query(): Promise<DataviewResult> {
    return Promise.resolve(this.result);
  }

  public table(): Promise<void> {
    throw new Error('Not used by PagedQueryComponent.');
  }
}

const components: PagedQueryComponent[] = [];

afterEach(() => {
  for (const component of components.splice(0)) {
    component.unload();
  }
});

describe('PagedQueryComponent', () => {
  it('pages a TABLE result', async () => {
    const { containerEl, tableCalls } = await createHarness(tableResult(ITEM_COUNT));

    expect(tableCalls).toEqual([{ headers: ['Number'], values: rows(ITEM_COUNT).slice(0, PAGE_SIZE) }]);
    expect(getSummary(containerEl)).toBe('Page 1 of 3, total items: 30');
  });

  it('pages a LIST result', async () => {
    const { containerEl, listCalls } = await createHarness(listResult());

    expect(listCalls).toEqual([numbers(ITEM_COUNT).slice(0, PAGE_SIZE)]);
    expect(getSummary(containerEl)).toBe('Page 1 of 3, total items: 30');
  });

  it('hands a failed query to Dataview, so the error is Dataview\'s own', async () => {
    const { containerEl, fallbackCalls, listCalls, tableCalls } = await createHarness({ successful: false });

    expect(fallbackCalls).toHaveLength(1);
    expect(listCalls).toHaveLength(0);
    expect(tableCalls).toHaveLength(0);
    expect(containerEl.textContent).toBe(FALLBACK_OUTPUT);
  });

  it('hands a successful query with no value to Dataview', async () => {
    const { fallbackCalls } = await createHarness({ successful: true });

    expect(fallbackCalls).toHaveLength(1);
  });

  it('runs the query again when Dataview refreshes its views after a vault change, keeping the page', async () => {
    const { api, containerEl, tableCalls } = await createHarness(tableResult(ITEM_COUNT));
    clickButton(containerEl, 'Next');
    await waitForAllAsyncOperations();

    api.result = tableResult(ITEM_COUNT + 5);
    api.index.revision++;
    api.app.workspace.trigger('dataview:refresh-views');
    await waitForAllAsyncOperations();

    expect(getSummary(containerEl)).toBe('Page 2 of 4, total items: 35');
    expect(tableCalls.at(-1)?.values).toEqual(rows(ITEM_COUNT + 5).slice(PAGE_SIZE, 2 * PAGE_SIZE));
  });

  it('does not run the query again when the index has not changed', async () => {
    const { api, tableCalls } = await createHarness(tableResult(ITEM_COUNT));
    const querySpy = vi.spyOn(api, 'query');

    api.app.workspace.trigger('dataview:refresh-views');
    await waitForAllAsyncOperations();

    expect(querySpy).not.toHaveBeenCalled();
    expect(tableCalls).toHaveLength(1);
  });

  it('does not run the query again while the view is hidden or Dataview\'s refresh is off', async () => {
    const { api, containerEl } = await createHarness(tableResult(ITEM_COUNT));
    const querySpy = vi.spyOn(api, 'query');
    const isShownSpy = vi.spyOn(containerEl, 'isShown').mockReturnValue(false);

    api.index.revision++;
    api.app.workspace.trigger('dataview:refresh-views');
    await waitForAllAsyncOperations();
    expect(querySpy).not.toHaveBeenCalled();

    isShownSpy.mockReturnValue(true);
    api.settings.refreshEnabled = false;
    api.app.workspace.trigger('dataview:refresh-views');
    await waitForAllAsyncOperations();
    expect(querySpy).not.toHaveBeenCalled();
  });

  it('replaces the paged view when the result type changes, and recovers from a failed run', async () => {
    const { api, containerEl, fallbackCalls, listCalls } = await createHarness(tableResult(ITEM_COUNT));

    api.result = { successful: false };
    api.index.revision++;
    api.app.workspace.trigger('dataview:refresh-views');
    await waitForAllAsyncOperations();
    expect(fallbackCalls).toHaveLength(1);
    expect(containerEl.querySelector('.dataview-pagination-pager')).toBeNull();

    api.result = listResult();
    api.index.revision++;
    api.app.workspace.trigger('dataview:refresh-views');
    await waitForAllAsyncOperations();
    expect(fallbackCalls[0]?._loaded).toBe(false);
    expect(listCalls).toEqual([numbers(ITEM_COUNT).slice(0, PAGE_SIZE)]);
    expect(containerEl.textContent).not.toContain(FALLBACK_OUTPUT);
    expect(containerEl.querySelectorAll('.dataview-pagination-pager')).toHaveLength(1);

    api.result = tableResult(ITEM_COUNT);
    api.index.revision++;
    api.app.workspace.trigger('dataview:refresh-views');
    await waitForAllAsyncOperations();
    expect(containerEl.querySelectorAll('.dataview-pagination-pager')).toHaveLength(1);
    expect(getSummary(containerEl)).toBe('Page 1 of 3, total items: 30');
  });
});

function clickButton(containerEl: HTMLElement, label: string): void {
  const buttonEl = [...containerEl.querySelectorAll<HTMLButtonElement>(':scope .dataview-pagination-navigation button')].find((button) => button.textContent === label);
  if (!buttonEl) {
    throw new Error(`No ${label} button.`);
  }
  buttonEl.click();
}

async function createHarness(result: DataviewResult): Promise<Harness> {
  const api = new FakeDataviewApi();
  api.result = result;
  const containerEl = createDiv();
  vi.spyOn(containerEl, 'isShown').mockReturnValue(true);
  const fallbackCalls: Component[] = [];
  const listCalls: unknown[][] = [];
  const tableCalls: TableCall[] = [];
  const component = new PagedQueryComponent({
    api,
    containerEl,
    filePath: 'Note.md',
    pageSizes: [PAGE_SIZE],
    renderFallback(fallbackEl, fallbackComponent): Promise<void> {
      fallbackCalls.push(fallbackComponent);
      fallbackEl.setText(FALLBACK_OUTPUT);
      return noopAsync();
    },
    renderList(values): Promise<void> {
      listCalls.push(values);
      return noopAsync();
    },
    renderTable(headers, values): Promise<void> {
      tableCalls.push({ headers, values });
      return noopAsync();
    },
    shouldShowPagerForShortResults: false,
    source: 'TABLE x'
  });
  component.load();
  components.push(component);
  await waitForAllAsyncOperations();
  return { api, component, containerEl, fallbackCalls, listCalls, tableCalls };
}

function getSummary(containerEl: HTMLElement): string {
  return containerEl.querySelector('.dataview-pagination-summary')?.textContent ?? '';
}

function listResult(): DataviewResult {
  return { successful: true, value: { type: 'list', values: numbers(ITEM_COUNT) } };
}

function numbers(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function rows(count: number): number[][] {
  return numbers(count).map((value) => [value]);
}

function tableResult(count: number): DataviewResult {
  return { successful: true, value: { headers: ['Number'], type: 'table', values: rows(count) } };
}
