/**
 * @file
 *
 * Pages a real `Dataview` DQL `TABLE` in Obsidian Mobile on an Android emulator: the pager appears, reads
 * `Page 1 of 5`, and Next moves the table to page 2.
 *
 * The desktop suite covers page size, jump to page, refresh and the error fallback; this leg proves the same paging
 * reaches a phone, where the plugin also runs (`isDesktopOnly: false`). It downloads `Dataview` from its `GitHub`
 * release, so it needs network access.
 */

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

// Isolation: `npx vitest run --project integration-tests:android src/dataview-pagination.android.integration.test.ts`.

interface DataviewIndex {
  readonly initialized: boolean;
}

interface DataviewPluginHost {
  readonly index: DataviewIndex;
}

const DATAVIEW_VERSION = '0.5.70';
const DATAVIEW_RELEASE_URL = `https://github.com/blacksmithgu/obsidian-dataview/releases/download/${DATAVIEW_VERSION}`;
const ITEM_COUNT = 120;
const PAGE_SIZE = 25;

/**
 * Waited on from Node, one short eval at a time, so a slow first index pass on a freshly booted emulator is not
 * bounded by the transport's per-closure cap.
 */
const POLL_TIMEOUT_IN_MILLISECONDS = 60_000;
const TEST_TIMEOUT_IN_MILLISECONDS = 180_000;

const NUMBERS_PATH = 'Numbers.md';
const TABLE_NOTE_PATH = 'Table.md';
const TABLE_NOTE_CONTENT = `\`\`\`dataview
TABLE WITHOUT ID item AS "Number"
WHERE file.name = "Numbers"
FLATTEN numbers AS item
\`\`\`
`;

const PAGER_SELECTOR = ':scope .markdown-reading-view .dataview-pagination-pager';
const SUMMARY_SELECTOR = `${PAGER_SELECTOR} .dataview-pagination-summary`;
const FIRST_CELL_SELECTOR = ':scope .markdown-reading-view .dataview-pagination-content tbody tr td';

beforeAll(async () => {
  await evalInObsidian({
    async callback({ app, itemCount, numbersPath, obsidianModule: { requestUrl }, releaseUrl }): Promise<void> {
      const pluginFolder = `${app.vault.configDir}/plugins/dataview`;
      if (!await app.vault.adapter.exists(pluginFolder)) {
        await app.vault.adapter.mkdir(pluginFolder);
      }
      for (const fileName of ['main.js', 'manifest.json']) {
        const { text } = await requestUrl(`${releaseUrl}/${fileName}`);
        await app.vault.adapter.write(`${pluginFolder}/${fileName}`, text);
      }
      /*
       * Written through the vault API rather than pushed to the device's disk: Obsidian Mobile does not notice every
       * file pushed there in time, and a file the vault itself creates is indexed at once.
       */
      const numbers = Array.from({ length: itemCount }, (_, index) => `  - ${String(index + 1)}`).join('\n');
      const numbersContent = `---\nnumbers:\n${numbers}\n---\n`;
      const existingFile = app.vault.getFileByPath(numbersPath);
      if (existingFile) {
        await app.vault.modify(existingFile, numbersContent);
      } else {
        await app.vault.create(numbersPath, numbersContent);
      }
      await app.plugins.loadManifests();
      await app.plugins.enablePlugin('dataview');
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

describe('paging a real Dataview table on mobile', () => {
  it('pages a DQL table and moves to the next page', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    await evalInObsidian({
      async callback({ app, content, path }): Promise<void> {
        // On a phone both sidebars are drawers over the note; keep them shut so the view has the whole screen.
        app.workspace.leftSplit.collapse();
        app.workspace.rightSplit.collapse();
        const existingFile = app.vault.getFileByPath(path);
        const note = existingFile ?? await app.vault.create(path, content);
        await app.workspace.getLeaf(false).openFile(note, { state: { mode: 'preview' } });
      },
      input: { content: TABLE_NOTE_CONTENT, path: TABLE_NOTE_PATH },
      vaultPath: vaultPath()
    });

    const firstSummary = `Page 1 of 5, total items: ${String(ITEM_COUNT)}`;
    expect(await waitForSummary(firstSummary)).toBe(firstSummary);
    const rowCount = await evalInObsidian({
      callback({ app }): number {
        return app.workspace.getMostRecentLeaf()?.view.containerEl.querySelectorAll(':scope .markdown-reading-view .dataview-pagination-content tbody tr').length ?? 0;
      },
      vaultPath: vaultPath()
    });
    expect(rowCount).toBe(PAGE_SIZE);

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

    const secondSummary = `Page 2 of 5, total items: ${String(ITEM_COUNT)}`;
    expect(await waitForSummary(secondSummary)).toBe(secondSummary);
    const firstCell = await pollInObsidian({
      input: { firstCellSelector: FIRST_CELL_SELECTOR },
      poll: ({ app, firstCellSelector }) => app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(firstCellSelector)?.textContent.trim() ?? '',
      timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
      timeoutMessage: 'the first cell of page 2',
      until: (text) => text === String(PAGE_SIZE + 1),
      vaultPath: vaultPath()
    });
    expect(firstCell).toBe(String(PAGE_SIZE + 1));
  });
});

function vaultPath(): string {
  return getTemporaryVault().path;
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
