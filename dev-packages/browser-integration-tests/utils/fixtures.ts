import fs from 'fs';
import path from 'path';
/* eslint-disable no-empty-pattern */
import { test as base } from '@playwright/test';

import { SDK_VERSION } from '@sentry/browser';
import { generatePage } from './generatePage';

export const TEST_HOST = 'http://sentry-test.io';

const getAsset = (assetDir: string, asset: string): string => {
  const assetPath = `${assetDir}/${asset}`;

  if (fs.existsSync(assetPath)) {
    return assetPath;
  }

  const parentDirAssetPath = `${path.dirname(assetDir)}/${asset}`;

  if (fs.existsSync(parentDirAssetPath)) {
    return parentDirAssetPath;
  }

  return `utils/defaults/${asset}`;
};

export type TestFixtures = {
  _autoSnapshotSuffix: void;
  testDir: string;
  getLocalTestUrl: (options: { testDir: string; skipRouteHandler?: boolean }) => Promise<string>;
  forceFlushReplay: () => Promise<string>;
  enableConsole: () => void;
  runInChromium: (fn: (...args: unknown[]) => unknown, args?: unknown[]) => unknown;
  runInFirefox: (fn: (...args: unknown[]) => unknown, args?: unknown[]) => unknown;
  runInWebkit: (fn: (...args: unknown[]) => unknown, args?: unknown[]) => unknown;
  runInSingleBrowser: (
    browser: 'chromium' | 'firefox' | 'webkit',
    fn: (...args: unknown[]) => unknown,
    args?: unknown[],
  ) => unknown;
};

const sentryTest = base.extend<TestFixtures>({
  _autoSnapshotSuffix: [
    async ({}, use, testInfo) => {
      testInfo.snapshotSuffix = '';
      await use();
    },
    { auto: true },
  ],

  getLocalTestUrl: ({ page }, use) => {
    return use(async ({ testDir, skipRouteHandler = false }) => {
      const pagePath = `${TEST_HOST}/index.html`;

      await build(testDir);

      // Serve all assets under
      if (!skipRouteHandler) {
        await page.route(`${TEST_HOST}/*.*`, route => {
          const file = route.request().url().split('/').pop();
          const filePath = path.resolve(testDir, `./dist/${file}`);

          return fs.existsSync(filePath) ? route.fulfill({ path: filePath }) : route.continue();
        });

        // Ensure feedback can be lazy loaded
        await page.route(`https://browser.sentry-cdn.com/${SDK_VERSION}/feedback-modal.min.js`, route => {
          const filePath = path.resolve(testDir, './dist/feedback-modal.bundle.js');
          return fs.existsSync(filePath) ? route.fulfill({ path: filePath }) : route.continue();
        });

        await page.route(`https://browser.sentry-cdn.com/${SDK_VERSION}/feedback-screenshot.min.js`, route => {
          const filePath = path.resolve(testDir, './dist/feedback-screenshot.bundle.js');
          return fs.existsSync(filePath) ? route.fulfill({ path: filePath }) : route.continue();
        });
      }

      return pagePath;
    });
  },

  runInChromium: ({ runInSingleBrowser }, use) => {
    return use((fn, args) => runInSingleBrowser('chromium', fn, args));
  },
  runInFirefox: ({ runInSingleBrowser }, use) => {
    return use((fn, args) => runInSingleBrowser('firefox', fn, args));
  },
  runInWebkit: ({ runInSingleBrowser }, use) => {
    return use((fn, args) => runInSingleBrowser('webkit', fn, args));
  },
  runInSingleBrowser: ({ browserName }, use) => {
    return use((browser, fn, args = []) => {
      if (browserName !== browser) {
        return;
      }

      return fn(...args);
    });
  },

  forceFlushReplay: ({ page }, use) => {
    return use(() =>
      page.evaluate(`
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: function () {
          return 'hidden';
        },
      });
      document.dispatchEvent(new Event('visibilitychange'));
    `),
    );
  },

  enableConsole: ({ page }, use) => {
    return use(() =>
      // eslint-disable-next-line no-console
      page.on('console', msg => console.log(msg.text())),
    );
  },
});

export { sentryTest };

async function build(testDir: string): Promise<void> {
  const subject = getAsset(testDir, 'subject.js');
  const template = getAsset(testDir, 'template.html');
  const init = getAsset(testDir, 'init.js');

  await generatePage(init, subject, template, testDir);

  const additionalPages = fs
    .readdirSync(testDir)
    .filter(filename => filename.startsWith('page-') && filename.endsWith('.html'));

  for (const pageFilename of additionalPages) {
    // create a new page with the same subject and init as before
    const subject = getAsset(testDir, 'subject.js');
    const pageFile = getAsset(testDir, pageFilename);
    const init = getAsset(testDir, 'init.js');
    await generatePage(init, subject, pageFile, testDir, pageFilename);
  }
}
