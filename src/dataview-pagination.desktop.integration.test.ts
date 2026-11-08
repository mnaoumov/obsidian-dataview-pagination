import {
  evalInObsidian,
  pollInObsidian
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

// Isolation: `npx vitest run --project integration-tests:desktop src/dataview-pagination.desktop.integration.test.ts`.

interface DataviewPluginHost {
  readonly updateSettings: (settings: Record<string, boolean>) => Promise<void>;
}

const DATAVIEW_VERSION = '0.5.70';
const DATAVIEW_RELEASE_URL = `https://github.com/blacksmithgu/obsidian-dataview/releases/download/${DATAVIEW_VERSION}`;
const ITEM_COUNT = 120;
const PAGE_SIZE = 25;
const PAGED_VIEW_COUNT = 3;
const POLL_TIMEOUT_IN_MILLISECONDS = 30_000;
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000;
const NOTE_PATH = 'Views.md';

const NOTE_CONTENT = `\`\`\`dataview
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

describe('paging real Dataview views', () => {
  it('pages DQL and dataviewjs results and moves between pages', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    const vaultPath = getTemporaryVault().path;

    await evalInObsidian({
      async callback({ app, itemCount, noteContent, notePath, obsidianModule: { requestUrl }, releaseUrl }): Promise<void> {
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
        await app.vault.create('Numbers.md', `---\nnumbers:\n${numbers}\n---\n`);
        const note = await app.vault.create(notePath, noteContent);
        await app.workspace.getLeaf(false).openFile(note, { state: { mode: 'preview' } });
      },
      input: { itemCount: ITEM_COUNT, noteContent: NOTE_CONTENT, notePath: NOTE_PATH, releaseUrl: DATAVIEW_RELEASE_URL },
      vaultPath
    });

    const pagerCount = await pollInObsidian({
      poll: ({ app }) => app.workspace.getMostRecentLeaf()?.view.containerEl.querySelectorAll(':scope .markdown-reading-view .dataview-pagination-pager .dataview-pagination-summary').length ?? 0,
      timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
      timeoutMessage: 'three paged views',
      until: (count) => count === PAGED_VIEW_COUNT,
      vaultPath
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
      vaultPath
    });
    expect(firstPage).toEqual([String(PAGE_SIZE), String(PAGE_SIZE), `Page 1 of 5, total items: ${String(ITEM_COUNT)}`]);

    await evalInObsidian({
      async callback({ app, lib: { clickElement } }): Promise<void> {
        const buttons = app.workspace.getMostRecentLeaf()?.view.containerEl.querySelectorAll<HTMLButtonElement>(':scope .markdown-reading-view .dataview-pagination-navigation button') ?? [];
        const nextButton = [...buttons].find((button) => button.textContent === 'Next');
        if (!nextButton) {
          throw new TypeError('No Next button.');
        }
        nextButton.scrollIntoView();
        await clickElement({ element: nextButton });
      },
      vaultPath
    });

    const firstRowOnSecondPage = await pollInObsidian({
      poll: ({ app }) => app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(':scope .markdown-reading-view .dataview-pagination-content tbody tr td')?.textContent.trim() ?? '',
      timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
      timeoutMessage: 'the second page',
      until: (text) => text === String(PAGE_SIZE + 1),
      vaultPath
    });
    expect(firstRowOnSecondPage).toBe(String(PAGE_SIZE + 1));
  });
});
