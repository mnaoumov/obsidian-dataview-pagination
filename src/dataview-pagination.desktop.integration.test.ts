import {
  evalInObsidian,
  pollInObsidian
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

// Isolation: `npx vitest run --project integration-tests:desktop src/dataview-pagination.desktop.integration.test.ts`.

interface DataviewIndex {
  readonly initialized: boolean;
}

interface DataviewPluginHost {
  readonly index: DataviewIndex;
  readonly updateSettings: (settings: Record<string, boolean>) => Promise<void>;
}

const DATAVIEW_VERSION = '0.5.70';
const DATAVIEW_RELEASE_URL = `https://github.com/blacksmithgu/obsidian-dataview/releases/download/${DATAVIEW_VERSION}`;
const ITEM_COUNT = 120;
const ADDED_ITEM_COUNT = 10;
const PAGE_SIZE = 25;
const LARGER_PAGE_SIZE = 50;
const JUMP_PAGE = 4;
const PAGED_VIEW_COUNT = 3;
const POLL_TIMEOUT_IN_MILLISECONDS = 30_000;
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000;
const NUMBERS_PATH = 'Numbers.md';

const VIEWS_NOTE_PATH = 'Views.md';
const VIEWS_NOTE_CONTENT = `\`\`\`dataview
TABLE WITHOUT ID item AS "Number"
WHERE file.name = "Numbers"
FLATTEN numbers AS item
\`\`\`

\`\`\`dataview
LIST WITHOUT ID item
WHERE file.name = "Numbers"
FLATTEN numbers AS item
\`\`\`

\`\`\`dataviewjs
dv.table(['Number'], Array.from({ length: ${String(ITEM_COUNT)} }, (_, index) => [index + 1]));
\`\`\`

\`\`\`dataviewjs
dv.table(['Short'], [[1], [2], [3]]);
\`\`\`
`;

const TABLE_NOTE_CONTENT = `\`\`\`dataview
TABLE WITHOUT ID item AS "Number"
WHERE file.name = "Numbers"
FLATTEN numbers AS item
\`\`\`
`;

const BROKEN_NOTE_PATH = 'Broken.md';
const BROKEN_NOTE_CONTENT = `\`\`\`dataview
TABLE WITHOUT ID item AS "Number"
FROM "Numbers" WHERE (
\`\`\`
`;

const PAGER_SELECTOR = ':scope .markdown-reading-view .dataview-pagination-pager';
const SUMMARY_SELECTOR = `${PAGER_SELECTOR} .dataview-pagination-summary`;
const FIRST_CELL_SELECTOR = ':scope .markdown-reading-view .dataview-pagination-content tbody tr td';

beforeAll(async () => {
  await evalInObsidian({
    async callback({ app, itemCount, numbersPath, obsidianModule: { requestUrl }, releaseUrl }): Promise<void> {
      const pluginFolder = `${app.vault.configDir}/plugins/dataview`;
      await app.vault.adapter.mkdir(pluginFolder);
      for (const fileName of ['main.js', 'manifest.json']) {
        const { text } = await requestUrl(`${releaseUrl}/${fileName}`);
        await app.vault.adapter.write(`${pluginFolder}/${fileName}`, text);
      }
      await app.plugins.loadManifests();
      await app.plugins.enablePlugin('dataview');
      // eslint-disable-next-line no-restricted-syntax -- A closure runs inside Obsidian, where no cast helper can be imported, and `Dataview` publishes no plugin type.
      await (app.plugins.getPlugin('dataview') as unknown as DataviewPluginHost).updateSettings({ enableDataviewJs: true });
      const numbers = Array.from({ length: itemCount }, (_, index) => `  - ${String(index + 1)}`).join('\n');
      await app.vault.create(numbersPath, `---\nnumbers:\n${numbers}\n---\n`);
    },
    input: { itemCount: ITEM_COUNT, numbersPath: NUMBERS_PATH, releaseUrl: DATAVIEW_RELEASE_URL },
    vaultPath: vaultPath()
  });

  await pollInObsidian({
    // eslint-disable-next-line no-restricted-syntax -- A closure runs inside Obsidian, where no cast helper can be imported, and `Dataview` publishes no plugin type.
    poll: ({ app }) => (app.plugins.getPlugin('dataview') as unknown as DataviewPluginHost | null)?.index.initialized ?? false,
    timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: 'the first Dataview index pass',
    until: (isInitialized) => isInitialized,
    vaultPath: vaultPath()
  });
}, TEST_TIMEOUT_IN_MILLISECONDS);

describe('paging real Dataview views', () => {
  it('pages DQL and dataviewjs results and moves between pages', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    await openNote(VIEWS_NOTE_PATH, VIEWS_NOTE_CONTENT);

    const pagerCount = await pollInObsidian({
      input: { summarySelector: SUMMARY_SELECTOR },
      poll: ({ app, summarySelector }) => app.workspace.getMostRecentLeaf()?.view.containerEl.querySelectorAll(summarySelector).length ?? 0,
      timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
      timeoutMessage: 'three paged views',
      until: (count) => count === PAGED_VIEW_COUNT,
      vaultPath: vaultPath()
    });
    expect(pagerCount).toBe(PAGED_VIEW_COUNT);

    const firstPage = await evalInObsidian({
      callback({ app }): string[] {
        const containerEl = app.workspace.getMostRecentLeaf()?.view.containerEl;
        return [
          String(containerEl?.querySelectorAll(':scope .markdown-reading-view .dataview-pagination-content')[0]?.querySelectorAll(':scope tbody tr').length),
          String(containerEl?.querySelectorAll(':scope .markdown-reading-view .dataview-pagination-content')[1]?.querySelectorAll(':scope li').length),
          containerEl?.querySelector(':scope .markdown-reading-view .dataview-pagination-summary')?.textContent ?? ''
        ];
      },
      vaultPath: vaultPath()
    });
    expect(firstPage).toEqual([String(PAGE_SIZE), String(PAGE_SIZE), `Page 1 of 5, total items: ${String(ITEM_COUNT)}`]);

    await clickNextButton();
    expect(await waitForFirstCell(String(PAGE_SIZE + 1))).toBe(String(PAGE_SIZE + 1));
  });

  it('shows more rows per page when the page size changes, back on page 1', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    await openNote('Page size.md', TABLE_NOTE_CONTENT);
    await waitForSummary(`Page 1 of 5, total items: ${String(ITEM_COUNT)}`);
    await clickNextButton();
    await waitForSummary(`Page 2 of 5, total items: ${String(ITEM_COUNT)}`);

    await evalInObsidian({
      async callback({ app, lib: { clickElement, pressKey }, pagerSelector }): Promise<void> {
        const selectEl = app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector<HTMLSelectElement>(`${pagerSelector} select`);
        if (!selectEl) {
          throw new Error('No page size dropdown.');
        }
        selectEl.scrollIntoView({ block: 'center' });
        // Opening the dropdown and picking the next option, as a keyboard user does.
        await clickElement({ element: selectEl });
        await pressKey({ key: 'Down' });
        await pressKey({ key: 'Enter' });
      },
      input: { pagerSelector: PAGER_SELECTOR },
      vaultPath: vaultPath()
    });

    expect(await waitForSummary(`Page 1 of 3, total items: ${String(ITEM_COUNT)}`)).toBe(`Page 1 of 3, total items: ${String(ITEM_COUNT)}`);
    const rowCount = await evalInObsidian({
      callback({ app }): number {
        return app.workspace.getMostRecentLeaf()?.view.containerEl.querySelectorAll(':scope .markdown-reading-view .dataview-pagination-content tbody tr').length ?? 0;
      },
      vaultPath: vaultPath()
    });
    expect(rowCount).toBe(LARGER_PAGE_SIZE);
  });

  it('jumps to the page typed into the jump box', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    await openNote('Jump.md', TABLE_NOTE_CONTENT);
    await waitForSummary(`Page 1 of 5, total items: ${String(ITEM_COUNT)}`);

    await evalInObsidian({
      async callback({ app, jumpPage, lib: { clickElement, pressKey }, pagerSelector }): Promise<void> {
        const jumpEl = app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector<HTMLInputElement>(`${pagerSelector} input[type="number"]`);
        if (!jumpEl) {
          throw new Error('No jump box.');
        }
        jumpEl.scrollIntoView({ block: 'center' });
        await clickElement({ element: jumpEl });
        await pressKey({ key: String(jumpPage) });
        await pressKey({ key: 'Enter' });
      },
      input: { jumpPage: JUMP_PAGE, pagerSelector: PAGER_SELECTOR },
      vaultPath: vaultPath()
    });

    expect(await waitForSummary(`Page ${String(JUMP_PAGE)} of 5, total items: ${String(ITEM_COUNT)}`)).toBe(
      `Page ${String(JUMP_PAGE)} of 5, total items: ${String(ITEM_COUNT)}`
    );
    expect(await waitForFirstCell(String((JUMP_PAGE - 1) * PAGE_SIZE + 1))).toBe(String((JUMP_PAGE - 1) * PAGE_SIZE + 1));
  });

  it('runs the query again when the vault changes, keeping the current page', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    await openNote('Refresh.md', TABLE_NOTE_CONTENT);
    await waitForSummary(`Page 1 of 5, total items: ${String(ITEM_COUNT)}`);
    await clickNextButton();
    await waitForSummary(`Page 2 of 5, total items: ${String(ITEM_COUNT)}`);

    await evalInObsidian({
      async callback({ addedItemCount, app, itemCount, numbersPath }): Promise<void> {
        const numbersFile = app.vault.getFileByPath(numbersPath);
        if (!numbersFile) {
          throw new Error(`No ${numbersPath}.`);
        }
        const numbers = Array.from({ length: itemCount + addedItemCount }, (_, index) => `  - ${String(index + 1)}`).join('\n');
        await app.vault.modify(numbersFile, `---\nnumbers:\n${numbers}\n---\n`);
      },
      input: { addedItemCount: ADDED_ITEM_COUNT, itemCount: ITEM_COUNT, numbersPath: NUMBERS_PATH },
      vaultPath: vaultPath()
    });

    const expectedSummary = `Page 2 of 6, total items: ${String(ITEM_COUNT + ADDED_ITEM_COUNT)}`;
    expect(await waitForSummary(expectedSummary)).toBe(expectedSummary);
    expect(await waitForFirstCell(String(PAGE_SIZE + 1))).toBe(String(PAGE_SIZE + 1));
  });

  it('leaves a query that fails to Dataview, which shows its own error', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    await openNote(BROKEN_NOTE_PATH, BROKEN_NOTE_CONTENT);

    const errorText = await pollInObsidian({
      poll: ({ app }) => app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(':scope .markdown-reading-view .dataview-error')?.textContent ?? '',
      timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
      timeoutMessage: 'the Dataview error',
      until: (text) => text !== '',
      vaultPath: vaultPath()
    });
    expect(errorText).toContain('Dataview');

    const pagerCount = await evalInObsidian({
      callback({ app, pagerSelector }): number {
        return app.workspace.getMostRecentLeaf()?.view.containerEl.querySelectorAll(pagerSelector).length ?? 0;
      },
      input: { pagerSelector: PAGER_SELECTOR },
      vaultPath: vaultPath()
    });
    expect(pagerCount).toBe(0);
  });
});

/**
 * Clicks the Next button of the first pager on screen, the way a user does.
 */
async function clickNextButton(): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { clickElement }, pagerSelector }): Promise<void> {
      const pagerEl = app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(pagerSelector);
      const buttonEl = [...pagerEl?.querySelectorAll<HTMLButtonElement>(':scope .dataview-pagination-navigation button') ?? []].find((el) => el.textContent === 'Next');
      if (!buttonEl) {
        throw new Error('No Next button.');
      }
      buttonEl.scrollIntoView({ block: 'center' });
      await clickElement({ element: buttonEl });
    },
    input: { pagerSelector: PAGER_SELECTOR },
    vaultPath: vaultPath()
  });
}

/**
 * Creates a note and opens it in reading view.
 *
 * @param notePath - The note path.
 * @param noteContent - The note content.
 */
async function openNote(notePath: string, noteContent: string): Promise<void> {
  await evalInObsidian({
    async callback({ app, content, path }): Promise<void> {
      const note = await app.vault.create(path, content);
      await app.workspace.getLeaf(false).openFile(note, { state: { mode: 'preview' } });
    },
    input: { content: noteContent, path: notePath },
    vaultPath: vaultPath()
  });
}

function vaultPath(): string {
  return getTemporaryVault().path;
}

async function waitForFirstCell(expectedText: string): Promise<string> {
  return pollInObsidian({
    input: { firstCellSelector: FIRST_CELL_SELECTOR },
    poll: ({ app, firstCellSelector }) => app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(firstCellSelector)?.textContent.trim() ?? '',
    timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: `the first cell to read ${expectedText}`,
    until: (text) => text === expectedText,
    vaultPath: vaultPath()
  });
}

async function waitForSummary(expectedSummary: string): Promise<string> {
  return pollInObsidian({
    input: { summarySelector: SUMMARY_SELECTOR },
    poll: ({ app, summarySelector }) => app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(summarySelector)?.textContent ?? '',
    timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: `the pager to read ${expectedSummary}`,
    until: (text) => text === expectedSummary,
    vaultPath: vaultPath()
  });
}
