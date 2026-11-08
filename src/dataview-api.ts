import type {
  App,
  Component
} from 'obsidian';

/**
 * The members of `Dataview`'s plugin API that pagination relies on. `Dataview` publishes no types of its own for them.
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
