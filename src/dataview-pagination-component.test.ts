import type {
  Component as ObsidianComponent,
  Plugin as ObsidianPlugin
} from 'obsidian';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { Component } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DataviewApi } from './dataview-api.ts';

import { DataviewPaginationComponent } from './dataview-pagination-component.ts';
import { PluginSettings } from './plugin-settings.ts';

const ITEM_COUNT = 60;
const PAGE_SIZE = 25;
const FILE_PATH = 'Note.md';
const ORIGINAL_OUTPUT = 'Original renderer output';

interface DataviewPluginHost extends ObsidianPlugin {
  readonly api: DataviewApi;
}

type DataviewResult = Awaited<ReturnType<DataviewApi['query']>>;

interface ExecuteCall {
  readonly containerEl: HTMLElement;
  readonly filePath: string;
  readonly source: string;
}

interface Harness {
  readonly api: FakeDataviewApi;
  readonly app: DataviewApi['app'];
  readonly component: DataviewPaginationComponent;
  readonly setPluginApi: (api: DataviewApi) => void;
  readonly settings: PluginSettings;
}

interface ListCall {
  readonly containerEl: HTMLElement;
  readonly filePath: string;
  readonly values: unknown;
}

interface TableCall {
  readonly containerEl: HTMLElement;
  readonly filePath: string;
  readonly headers: string[];
  readonly values: unknown;
}

/**
 * Stands in for the plugin API: each renderer records what it was asked to draw, which is what the patches change.
 */
class FakeDataviewApi implements DataviewApi {
  public readonly executeCalls: ExecuteCall[] = [];
  public readonly index = { revision: 1 };
  public readonly listCalls: ListCall[] = [];
  public result: DataviewResult = { successful: false };
  public readonly settings = { refreshEnabled: true };
  public readonly tableCalls: TableCall[] = [];

  public constructor(public readonly app: DataviewApi['app']) {}

  public execute(source: string, containerEl: HTMLElement, component: ObsidianComponent, filePath: string): Promise<void> {
    expect(component).toBeInstanceOf(Component);
    this.executeCalls.push({ containerEl, filePath, source });
    containerEl.setText(ORIGINAL_OUTPUT);
    return noopAsync();
  }

  public list(values: unknown, containerEl: HTMLElement, component: ObsidianComponent, filePath: string): Promise<void> {
    expect(component).toBeInstanceOf(Component);
    this.listCalls.push({ containerEl, filePath, values });
    return noopAsync();
  }

  public query(): Promise<DataviewResult> {
    return Promise.resolve(this.result);
  }

  public table(headers: string[], values: unknown, containerEl: HTMLElement, component: ObsidianComponent, filePath: string): Promise<void> {
    expect(component).toBeInstanceOf(Component);
    this.tableCalls.push({ containerEl, filePath, headers, values });
    return noopAsync();
  }
}

const loadedComponents: ObsidianComponent[] = [];

afterEach(() => {
  for (const component of loadedComponents.splice(0)) {
    component.unload();
  }
});

describe('DataviewPaginationComponent', () => {
  it('pages api.table, passing the original renderer one page of rows at a time', async () => {
    const { api } = createHarness();
    const containerEl = createDiv();

    await api.table(['Number'], rows(), containerEl, createOwner(), FILE_PATH);

    expect(api.tableCalls).toHaveLength(1);
    expect(api.tableCalls[0]?.headers).toEqual(['Number']);
    expect(api.tableCalls[0]?.filePath).toBe(FILE_PATH);
    expect(api.tableCalls[0]?.values).toEqual(rows().slice(0, PAGE_SIZE));
    expect(getSummary(containerEl)).toBe('Page 1 of 3, total items: 60');
  });

  it('pages api.list, accepting any iterable such as a DataArray', async () => {
    const { api } = createHarness();
    const containerEl = createDiv();

    await api.list(new Set(numbers()), containerEl, createOwner(), FILE_PATH);

    expect(api.listCalls).toHaveLength(1);
    expect(api.listCalls[0]?.filePath).toBe(FILE_PATH);
    expect(api.listCalls[0]?.values).toEqual(numbers().slice(0, PAGE_SIZE));
    expect(getSummary(containerEl)).toBe('Page 1 of 3, total items: 60');
  });

  it('passes values that are not iterable straight to the original renderer', async () => {
    const { api } = createHarness();
    const containerEl = createDiv();

    await api.table(['Number'], null, containerEl, createOwner(), FILE_PATH);
    await api.list(42, containerEl, createOwner(), FILE_PATH);

    expect(api.tableCalls[0]?.values).toBeNull();
    expect(api.listCalls[0]?.values).toBe(42);
    expect(containerEl.querySelector(':scope .dataview-pagination-pager')).toBeNull();
  });

  it('passes everything straight to the original renderer while pagination is turned off', async () => {
    const { api, settings } = createHarness();
    settings.isPaginationEnabled = false;
    const containerEl = createDiv();

    await api.table(['Number'], rows(), containerEl, createOwner(), FILE_PATH);
    await api.execute('TABLE x', containerEl, createOwner(), FILE_PATH);

    expect(api.tableCalls[0]?.values).toEqual(rows());
    expect(api.executeCalls).toEqual([{ containerEl, filePath: FILE_PATH, source: 'TABLE x' }]);
    expect(containerEl.querySelector(':scope .dataview-pagination-pager')).toBeNull();
  });

  it('runs a TABLE query through the paged view, drawing each page with the original table renderer without paging it again', async () => {
    const { api } = createHarness();
    api.result = { successful: true, value: { headers: ['Number'], type: 'table', values: rows() } };
    const containerEl = createDiv();

    await api.execute('  table WITHOUT ID x', containerEl, createOwner(), FILE_PATH);
    await waitForAllAsyncOperations();

    expect(api.executeCalls).toHaveLength(0);
    expect(api.tableCalls).toHaveLength(1);
    expect(api.tableCalls[0]?.filePath).toBe(FILE_PATH);
    expect(api.tableCalls[0]?.values).toEqual(rows().slice(0, PAGE_SIZE));
    expect(containerEl.querySelectorAll(':scope .dataview-pagination-pager')).toHaveLength(1);
    expect(getSummary(containerEl)).toBe('Page 1 of 3, total items: 60');
  });

  it('runs a LIST query through the paged view with the original list renderer', async () => {
    const { api } = createHarness();
    api.result = { successful: true, value: { type: 'list', values: numbers() } };
    const containerEl = createDiv();

    await api.execute('LIST x', containerEl, createOwner(), FILE_PATH);
    await waitForAllAsyncOperations();

    expect(api.listCalls[0]?.values).toEqual(numbers().slice(0, PAGE_SIZE));
    expect(containerEl.querySelectorAll(':scope .dataview-pagination-pager')).toHaveLength(1);
  });

  it('shows the original output for a query that fails', async () => {
    const { api } = createHarness();
    api.result = { successful: false };
    const containerEl = createDiv();

    await api.execute('TABLE broken(', containerEl, createOwner(), FILE_PATH);
    await waitForAllAsyncOperations();

    expect(api.executeCalls).toEqual([{ containerEl, filePath: FILE_PATH, source: 'TABLE broken(' }]);
    expect(containerEl.textContent).toBe(ORIGINAL_OUTPUT);
  });

  it('passes TASK and CALENDAR queries straight to the original execute', async () => {
    const { api } = createHarness();
    const containerEl = createDiv();

    await api.execute('TASK FROM ""', containerEl, createOwner(), FILE_PATH);
    await api.execute('CALENDAR file.ctime', containerEl, createOwner(), FILE_PATH);

    expect(api.executeCalls.map((call) => call.source)).toEqual(['TASK FROM ""', 'CALENDAR file.ctime']);
  });

  it('patches a reloaded API when the plugin announces it, and patches each API once', async () => {
    const { app, setPluginApi } = createHarness();
    const reloadedApi = new FakeDataviewApi(app);
    setPluginApi(reloadedApi);

    app.metadataCache.trigger('dataview:api-ready');
    app.metadataCache.trigger('dataview:api-ready');
    const containerEl = createDiv();
    await reloadedApi.table(['Number'], rows(), containerEl, createOwner(), FILE_PATH);

    expect(reloadedApi.tableCalls).toHaveLength(1);
    expect(reloadedApi.tableCalls[0]?.values).toEqual(rows().slice(0, PAGE_SIZE));
    expect(containerEl.querySelectorAll(':scope .dataview-pagination-pager')).toHaveLength(1);
  });

  it('does nothing while the plugin is not loaded', () => {
    const app = App.createConfigured__().asOriginalType__();
    vi.spyOn(app.plugins, 'getPlugin').mockReturnValue(null);
    const component = new DataviewPaginationComponent({ app, getSettings: (): PluginSettings => new PluginSettings() });

    expect(() => {
      component.load();
    }).not.toThrow();
    loadedComponents.push(component);
  });

  it('restores the original methods when unloaded', async () => {
    const { api, component } = createHarness();
    component.unload();
    const containerEl = createDiv();

    await api.table(['Number'], rows(), containerEl, createOwner(), FILE_PATH);

    expect(api.tableCalls[0]?.values).toEqual(rows());
    expect(containerEl.querySelector(':scope .dataview-pagination-pager')).toBeNull();
  });
});

function createHarness(): Harness {
  const app = App.createConfigured__().asOriginalType__();
  const api = new FakeDataviewApi(app);
  const getPluginSpy = vi.spyOn(app.plugins, 'getPlugin');
  function setPluginApi(pluginApi: DataviewApi): void {
    getPluginSpy.mockReturnValue(strictProxy<DataviewPluginHost>({ api: pluginApi }));
  }
  setPluginApi(api);
  const settings = new PluginSettings();
  settings.pageSizes = String(PAGE_SIZE);
  const component = new DataviewPaginationComponent({ app, getSettings: (): PluginSettings => settings });
  component.load();
  loadedComponents.push(component);
  return { api, app, component, setPluginApi, settings };
}

function createOwner(): ObsidianComponent {
  const owner = new Component();
  owner.load();
  loadedComponents.push(owner);
  return owner;
}

function getSummary(containerEl: HTMLElement): string {
  return containerEl.querySelector(':scope .dataview-pagination-summary')?.textContent ?? '';
}

function numbers(): number[] {
  return Array.from({ length: ITEM_COUNT }, (_, index) => index + 1);
}

function rows(): number[][] {
  return numbers().map((value) => [value]);
}
