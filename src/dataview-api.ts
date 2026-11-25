import type {
  App,
  Component
} from 'obsidian';

import { DATAVIEW_PLUGIN_ADAPTER } from '@mnaoumov/obsidian-lib/dataview';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';

/**
 * The members of `Dataview`'s plugin API that pagination relies on, narrowed from {@link DataviewPluginApi}.
 *
 * The adapter's type is not used directly because it does not fit the patches and their test fakes: it is a class with
 * private members, so a fake cannot implement it; its `execute` types `component` as
 * `Component | MarkdownPostProcessorContext`, while the patch adds a child to it; and its `query` result also covers
 * `TASK` and `CALENDAR`, which the patch never runs through `query`.
 */
export interface DataviewApi {
  readonly app: App;
  readonly execute: (source: string, container: HTMLElement, component: Component, filePath: string) => Promise<void>;
  readonly index: DataviewIndex;
  readonly list: (values: unknown, container: HTMLElement, component: Component, filePath: string) => Promise<void>;
  readonly query: (source: string, originFile?: string) => Promise<DataviewResult>;
  readonly settings: DataviewSettings;
  readonly table: (headers: string[], values: unknown, container: HTMLElement, component: Component, filePath: string) => Promise<void>;
}

/**
 * The `Dataview` API as {@link DATAVIEW_PLUGIN_ADAPTER} hands it over, typed by `@mnaoumov/obsidian-dataview`.
 */
export type DataviewPluginApi = NonNullable<ReturnType<typeof DATAVIEW_PLUGIN_ADAPTER.getApi>>;

export type DataviewQueryResult = DataviewQueryResultList | DataviewQueryResultTable;

interface DataviewIndex {
  readonly revision: number;
}

interface DataviewQueryResultList {
  readonly type: 'list';
  readonly values: unknown[];
}

interface DataviewQueryResultTable {
  readonly headers: string[];
  readonly type: 'table';
  readonly values: unknown[][];
}

interface DataviewResult {
  readonly successful: boolean;
  readonly value?: DataviewQueryResult;
}

interface DataviewSettings {
  readonly refreshEnabled: boolean;
}

/**
 * Narrows the adapter's API to the members pagination relies on. The object is the same one, so a patch applied to the
 * result patches `Dataview` itself.
 *
 * @param api - The API {@link DATAVIEW_PLUGIN_ADAPTER} returned.
 * @returns The same object, typed as {@link DataviewApi}.
 */
export function toPaginationApi(api: DataviewPluginApi): DataviewApi {
  return castTo<DataviewApi>(api);
}
