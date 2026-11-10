/**
 * @file
 *
 * Produces the desktop screenshots the README and the community-store listing show, driving the demo vault's
 * `01 Tables and lists` note with a real `Dataview` in a real Obsidian and writing
 * `images/screenshots/screenshot-desktop-N.png`.
 *
 * A capture script rather than an assertion suite: it runs in a desktop project because that is where a real,
 * plugin-enabled Obsidian already exists, and it is named `*.desktop-capture.` so no standard project collects it.
 * Run it with `npm run capture:screenshots`. It downloads `Dataview` from its `GitHub` release, so it needs network
 * access.
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  applyObsidianTheme,
  buildDemoVaultPopulate,
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  pollInObsidian,
  readPngDimensions
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

interface DataviewIndex {
  readonly initialized: boolean;
}

interface DataviewPluginHost {
  readonly index: DataviewIndex;
  readonly updateSettings: (settings: Record<string, boolean>) => Promise<void>;
}

const WIDTH_IN_PIXELS = 1200;
const HEIGHT_IN_PIXELS = 800;
const POLL_TIMEOUT_IN_MILLISECONDS = 30_000;
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000;

const DATAVIEW_VERSION = '0.5.70';
const DATAVIEW_RELEASE_URL = `https://github.com/blacksmithgu/obsidian-dataview/releases/download/${DATAVIEW_VERSION}`;

const NOTE_PATH = '01 Tables and lists.md';
/**
 * The note's DQL table and list. Its `dataviewjs` views sit below the fold, where reading view has not rendered them.
 */
const PAGED_DQL_VIEW_COUNT = 2;

/**
 * The pager of the note's `dv.table` view, the only one with a second column, so a page reads as a table. Found by
 * its content rather than by position, because reading view renders only the sections near the scroll position.
 */
const SHOWCASE_PAGER_SELECTOR = ':scope .markdown-reading-view .dataview-pagination-content:has(th:nth-child(2)) + .dataview-pagination-pager';
const SHOWCASE_PAGE = 3;
const SHOWCASE_SUMMARY = 'Page 3 of 5, total items: 120';

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');
const DEMO_VAULT_PATH = join(process.cwd(), 'demo-vault');

beforeAll(async () => {
  const vault = getTemporaryVault();

  // The note and the `Numbers` fixture it reads.
  const demoVaultFiles = buildDemoVaultPopulate({ demoVaultPath: DEMO_VAULT_PATH });
  vault.populate(Object.fromEntries(Object.entries(demoVaultFiles).filter(([path]) => path === NOTE_PATH || path.startsWith('Materials/'))));
  await vault.syncToDevice();

  // The author's plugins are all shot in the default dark theme, so the sets read as one series.
  await applyObsidianTheme({ theme: 'dark', vaultPath: vaultPath() });

  await evalInObsidian({
    async callback({ app, obsidianModule: { requestUrl }, releaseUrl }): Promise<void> {
      const pluginFolder = `${app.vault.configDir}/plugins/dataview`;
      await app.vault.adapter.mkdir(pluginFolder);
      for (const fileName of ['main.js', 'manifest.json', 'styles.css']) {
        const { text } = await requestUrl(`${releaseUrl}/${fileName}`);
        await app.vault.adapter.write(`${pluginFolder}/${fileName}`, text);
      }
      await app.plugins.loadManifests();
      await app.plugins.enablePlugin('dataview');
      // eslint-disable-next-line no-restricted-syntax -- A closure runs inside Obsidian, where no cast helper can be imported, and `Dataview` publishes no plugin type.
      await (app.plugins.getPlugin('dataview') as unknown as DataviewPluginHost).updateSettings({ enableDataviewJs: true });
    },
    input: { releaseUrl: DATAVIEW_RELEASE_URL },
    vaultPath: vaultPath()
  });

  // A view rendered before the first index pass is rendered again when it ends, back on page 1.
  await pollInObsidian({
    // eslint-disable-next-line no-restricted-syntax -- A closure runs inside Obsidian, where no cast helper can be imported, and `Dataview` publishes no plugin type.
    poll: ({ app }) => (app.plugins.getPlugin('dataview') as unknown as DataviewPluginHost | null)?.index.initialized ?? false,
    timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: 'the first Dataview index pass',
    until: (isInitialized) => isInitialized,
    vaultPath: vaultPath()
  });

  await evalInObsidian({
    async callback({ app, notePath }): Promise<void> {
      // The views are the subject, so they get the whole window.
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      const note = app.vault.getFileByPath(notePath);
      if (!note) {
        throw new Error(`No ${notePath}.`);
      }
      await app.workspace.getLeaf(false).openFile(note, { state: { mode: 'preview' } });
    },
    input: { notePath: NOTE_PATH },
    vaultPath: vaultPath()
  });

  await pollInObsidian({
    poll: ({ app }) => app.workspace.getMostRecentLeaf()?.view.containerEl.querySelectorAll(':scope .markdown-reading-view .dataview-pagination-summary').length ?? 0,
    timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: 'the two DQL views paged',
    until: (count) => count >= PAGED_DQL_VIEW_COUNT,
    vaultPath: vaultPath()
  });
}, TEST_TIMEOUT_IN_MILLISECONDS);

describe('desktop store screenshots', () => {
  it('1 - a dv.table view on page 3 of 5', async () => {
    // The `dataviewjs` views are at the end of the note, rendered only once it is scrolled there.
    await pollInObsidian({
      input: { pagerSelector: SHOWCASE_PAGER_SELECTOR },
      poll: ({ app, pagerSelector }) => {
        const containerEl = app.workspace.getMostRecentLeaf()?.view.containerEl;
        const previewEl = containerEl?.querySelector<HTMLElement>(':scope .markdown-preview-view');
        if (previewEl) {
          previewEl.scrollTop = previewEl.scrollHeight;
        }
        return Boolean(containerEl?.querySelector(pagerSelector));
      },
      timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
      timeoutMessage: 'the dv.table view paged',
      until: (isRendered) => isRendered,
      vaultPath: vaultPath()
    });

    await clickPageButton(String(SHOWCASE_PAGE));

    const summary = await pollInObsidian({
      input: { pagerSelector: SHOWCASE_PAGER_SELECTOR },
      poll: ({ app, pagerSelector }) => app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(pagerSelector)?.querySelector(':scope .dataview-pagination-summary')?.textContent ?? '',
      timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
      timeoutMessage: 'page 3 of the dv.table view',
      until: (text) => text === SHOWCASE_SUMMARY,
      vaultPath: vaultPath()
    });
    expect(summary).toBe(SHOWCASE_SUMMARY);

    await evalInObsidian({
      callback({ app, pagerSelector }): void {
        // The controls mid-window, below the page's last rows and clear of the caption band.
        app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(pagerSelector)?.scrollIntoView({ block: 'center' });
      },
      input: { pagerSelector: SHOWCASE_PAGER_SELECTOR },
      vaultPath: vaultPath()
    });
    await shoot(1, 'Every Dataview table and list gets page controls');
  }, TEST_TIMEOUT_IN_MILLISECONDS);

  it('2 - the settings tab', async () => {
    await evalInObsidian({
      callback({ app }): void {
        app.setting.open();
        app.setting.openTabById('dataview-pagination');
      },
      vaultPath: vaultPath()
    });
    const settingNames = await pollInObsidian({
      poll: ({ app }) => [...app.setting.containerEl.querySelectorAll(':scope .vertical-tab-content .setting-item-name')].map((el) => el.textContent),
      timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
      timeoutMessage: 'the plugin settings tab',
      until: (names) => names.includes('Items per page'),
      vaultPath: vaultPath()
    });
    expect(settingNames).toContain('Items per page');
    await shoot(2, 'Choose the page sizes and when the controls appear');
    await evalInObsidian({
      callback({ app }): void {
        app.setting.close();
      },
      vaultPath: vaultPath()
    });
  }, TEST_TIMEOUT_IN_MILLISECONDS);
});

/**
 * Clicks a button of the showcase view's pager, the way a user does.
 *
 * @param label - The button text.
 */
async function clickPageButton(label: string): Promise<void> {
  await evalInObsidian({
    async callback({ app, buttonLabel, lib: { clickElement }, pagerSelector }): Promise<void> {
      const pagerEl = app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(pagerSelector);
      const buttonEl = [...pagerEl?.querySelectorAll<HTMLButtonElement>(':scope .dataview-pagination-navigation button') ?? []].find((el) => el.textContent === buttonLabel);
      if (!buttonEl) {
        throw new Error(`No ${buttonLabel} button.`);
      }
      buttonEl.scrollIntoView();
      await clickElement({ element: buttonEl });
    },
    input: { buttonLabel: label, pagerSelector: SHOWCASE_PAGER_SELECTOR },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the current Obsidian window, captions it and writes it as
 * `images/screenshots/screenshot-desktop-<index>.png`, failing if it does not come back at the listing size.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption burned into the shot.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const bytes = await captureObsidianScreenshot({
    heightInPixels: HEIGHT_IN_PIXELS,
    vaultPath: vaultPath(),
    widthInPixels: WIDTH_IN_PIXELS
  });
  const labeled = await labelScreenshot(bytes, { text: caption });
  expect(readPngDimensions(labeled)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });
  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-desktop-${String(index)}.png`), labeled);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
