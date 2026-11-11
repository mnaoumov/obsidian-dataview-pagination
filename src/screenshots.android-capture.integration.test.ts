/**
 * @file
 *
 * Produces the mobile screenshots the README and the community-store listing show, driving the demo vault's
 * `01 Tables and lists` note with a real `Dataview` in Obsidian Mobile on an Android emulator and writing
 * `images/screenshots/screenshot-mobile-N.png`.
 *
 * The mobile counterpart of the desktop capture suite, with the same two frames: the `dv.table` view on page 3 with
 * its controls, then the settings tab. A phone is where the pager has the least room, which is why the mobile set is
 * worth taking rather than reusing the desktop images.
 *
 * It runs on the dedicated `obsidian_screenshots` AVD, built at exactly 900x1600, so the device frame already IS the
 * listing size and needs no crop or rescale. The harness never installs the Obsidian APK on it, so provision it with
 * `provision-obsidian-avd.ps1 -AvdName obsidian_screenshots` whenever its Obsidian falls below the manifest's
 * `minAppVersion`.
 *
 * Named `*.android-capture.` so no standard project collects it. Run it with `npm run capture:screenshots`. It
 * downloads `Dataview` from its `GitHub` release, so it needs network access.
 */

import { Buffer } from 'node:buffer';
import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import {
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

const WIDTH_IN_PIXELS = 900;
const HEIGHT_IN_PIXELS = 1600;

/**
 * Waited on from Node, one short eval at a time, so a slow vault scan on a freshly booted emulator is not bounded by
 * the transport's ~30s per-closure cap.
 */
const POLL_TIMEOUT_IN_MILLISECONDS = 60_000;
const TEST_TIMEOUT_IN_MILLISECONDS = 180_000;
const SETTLE_DELAY_IN_MILLISECONDS = 1500;

const DATAVIEW_VERSION = '0.5.70';
const DATAVIEW_RELEASE_URL = `https://github.com/blacksmithgu/obsidian-dataview/releases/download/${DATAVIEW_VERSION}`;

const NOTE_PATH = '01 Tables and lists.md';
const NUMBERS_NOTE_PATH = 'Materials/01 Tables and lists/Numbers.md';

/**
 * The pager of the note's `dv.table` view, the only one with a second column, so a page reads as a table. Found by
 * its content rather than by position, because reading view renders only the sections near the scroll position.
 */
const SHOWCASE_PAGER_SELECTOR = ':scope .markdown-reading-view .dataview-pagination-content:has(th:nth-child(2)) + .dataview-pagination-pager';
const SHOWCASE_PAGE = 3;
const SHOWCASE_SUMMARY = 'Page 3 of 5, total items: 120';
/**
 * Where the pager's bottom edge lands, as a fraction of the reading view's height.
 */
const SHOWCASE_PAGER_BOTTOM_FRACTION = 0.85;

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');
const DEMO_VAULT_PATH = join(process.cwd(), 'demo-vault');

beforeAll(async () => {
  // The note and the `Numbers` fixture it reads.
  const demoVaultFiles = buildDemoVaultPopulate({ demoVaultPath: DEMO_VAULT_PATH });
  // Every fixture is a note, decoded here because the populate map may hold the file's bytes.
  const fixtures = Object.fromEntries(
    Object.entries(demoVaultFiles)
      .filter(([path]) => path === NOTE_PATH || path.startsWith('Materials/'))
      .map(([path, content]) => [path, typeof content === 'string' ? content : Buffer.from(content as Uint8Array).toString('utf-8')])
  );

  /*
   * Written through the vault API rather than pushed with `vault.syncToDevice()`: Obsidian Mobile does not notice
   * every file pushed to the device's disk in time, and a file the vault itself creates is indexed at once.
   */
  await evalInObsidian({
    async callback({ app, files }): Promise<void> {
      for (const [path, content] of Object.entries(files)) {
        const folderPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        if (folderPath && !app.vault.getFolderByPath(folderPath) && !await app.vault.adapter.exists(folderPath)) {
          await app.vault.createFolder(folderPath);
        }
        const existingFile = app.vault.getFileByPath(path);
        if (existingFile) {
          await app.vault.modify(existingFile, content);
        } else {
          await app.vault.create(path, content);
        }
      }
    },
    input: { files: fixtures },
    vaultPath: vaultPath()
  });

  await pollInObsidian({
    input: { notePaths: [NOTE_PATH, NUMBERS_NOTE_PATH] },
    poll: ({ app, notePaths }) =>
      notePaths.every((path) => {
        const file = app.vault.getFileByPath(path);
        return Boolean(file && app.metadataCache.getFileCache(file));
      }),
    timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: 'the note and its Numbers fixture indexed',
    until: (hasArrived) => hasArrived,
    vaultPath: vaultPath()
  });

  await evalInObsidian({
    async callback({ app, obsidianModule: { requestUrl }, releaseUrl }): Promise<void> {
      const pluginFolder = `${app.vault.configDir}/plugins/dataview`;
      if (!await app.vault.adapter.exists(pluginFolder)) {
        await app.vault.adapter.mkdir(pluginFolder);
      }
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
      // The default dark theme, as on desktop, so the sets read as one series.
      app.changeTheme('obsidian');
      // On a phone both sidebars are drawers over the note; keep them shut so the views have the whole screen.
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
}, TEST_TIMEOUT_IN_MILLISECONDS);

describe('mobile store screenshots', () => {
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
      callback({ app, pagerBottomFraction, pagerSelector }): void {
        /*
         * The controls low on the screen, above the toolbar and the caption band, so the rest of the phone's height
         * shows the page's rows rather than the prose after the view.
         */
        const containerEl = app.workspace.getMostRecentLeaf()?.view.containerEl;
        const previewEl = containerEl?.querySelector<HTMLElement>(':scope .markdown-preview-view');
        const pagerEl = containerEl?.querySelector(pagerSelector);
        if (!previewEl || !pagerEl) {
          throw new Error('No showcase pager to frame.');
        }
        const previewRect = previewEl.getBoundingClientRect();
        const pagerRect = pagerEl.getBoundingClientRect();
        previewEl.scrollTop += pagerRect.bottom - previewRect.top - previewEl.clientHeight * pagerBottomFraction;
      },
      input: { pagerBottomFraction: SHOWCASE_PAGER_BOTTOM_FRACTION, pagerSelector: SHOWCASE_PAGER_SELECTOR },
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
 * Captures the device screen, captions it and writes it as `images/screenshots/screenshot-mobile-<index>.png`.
 *
 * The capture is the device's own framebuffer, so its size is asserted before captioning: run against any AVD but
 * the 900x1600 one and this fails loudly instead of shipping an off-spec image.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption burned into the shot.
 */
async function shoot(index: number, caption: string): Promise<void> {
  // A scroll or a settings page opening plays a short transition on mobile; let it finish first.
  await sleep(SETTLE_DELAY_IN_MILLISECONDS);
  const captured = await captureObsidianScreenshot({ vaultPath: vaultPath() });
  expect(readPngDimensions(captured)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });
  const labeled = await labelScreenshot(captured, { text: caption });
  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), labeled);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
