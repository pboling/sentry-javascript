import { expect } from '@playwright/test';

import { sentryTest } from '../../../../../utils/fixtures';
import { envelopeRequestParser, waitForErrorRequest } from '../../../../../utils/helpers';
import {
  collectReplayRequests,
  getReplayPerformanceSpans,
  shouldSkipReplayTest,
} from '../../../../../utils/replayHelpers';

sentryTest('captures response size from Content-Length header if available', async ({ getLocalTestPath, page }) => {
  if (shouldSkipReplayTest()) {
    sentryTest.skip();
  }

  await page.route('**/foo', route => {
    return route.fulfill({
      status: 200,
      body: JSON.stringify({
        userNames: ['John', 'Jane'],
      }),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '789',
      },
    });
  });

  await page.route('https://dsn.ingest.sentry.io/**/*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'test-id' }),
    });
  });

  const requestPromise = waitForErrorRequest(page);

  const replayRequestPromise = collectReplayRequests(page, recordingEvents => {
    return getReplayPerformanceSpans(recordingEvents).some(span => span.op === 'resource.fetch');
  });

  const url = await getLocalTestPath({ testDir: __dirname });
  await page.goto(url);

  const [, request] = await Promise.all([
    page.evaluate(() => {
      /* eslint-disable */
      fetch('http://localhost:7654/foo').then(() => {
        // @ts-expect-error Sentry is a global
        Sentry.captureException('test error');
      });
      /* eslint-enable */
    }),
    requestPromise,
  ]);

  const eventData = envelopeRequestParser(request);

  expect(eventData.exception?.values).toHaveLength(1);

  expect(eventData?.breadcrumbs?.length).toBe(1);
  expect(eventData!.breadcrumbs![0]).toEqual({
    timestamp: expect.any(Number),
    category: 'fetch',
    type: 'http',
    data: {
      method: 'GET',
      response_body_size: 789,
      status_code: 200,
      url: 'http://localhost:7654/foo',
    },
  });

  const { replayRecordingSnapshots } = await replayRequestPromise;
  expect(getReplayPerformanceSpans(replayRecordingSnapshots).filter(span => span.op === 'resource.fetch')).toEqual([
    {
      data: {
        method: 'GET',
        statusCode: 200,
        request: {
          headers: {},
          _meta: {
            warnings: ['URL_SKIPPED'],
          },
        },
        response: {
          size: 789,
          headers: {},
          _meta: {
            warnings: ['URL_SKIPPED'],
          },
        },
      },
      description: 'http://localhost:7654/foo',
      endTimestamp: expect.any(Number),
      op: 'resource.fetch',
      startTimestamp: expect.any(Number),
    },
  ]);
});

sentryTest('captures response size without Content-Length header', async ({ getLocalTestPath, page }) => {
  if (shouldSkipReplayTest()) {
    sentryTest.skip();
  }

  await page.route('**/foo', route => {
    return route.fulfill({
      status: 200,
      body: JSON.stringify({
        userNames: ['John', 'Jane'],
      }),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '',
      },
    });
  });

  await page.route('https://dsn.ingest.sentry.io/**/*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'test-id' }),
    });
  });

  const requestPromise = waitForErrorRequest(page);

  const replayRequestPromise = collectReplayRequests(page, recordingEvents => {
    return getReplayPerformanceSpans(recordingEvents).some(span => span.op === 'resource.fetch');
  });

  const url = await getLocalTestPath({ testDir: __dirname });
  await page.goto(url);

  const [, request] = await Promise.all([
    page.evaluate(() => {
      /* eslint-disable */
      fetch('http://localhost:7654/foo').then(() => {
        // @ts-expect-error Sentry is a global
        Sentry.captureException('test error');
      });
      /* eslint-enable */
    }),
    requestPromise,
  ]);

  const eventData = envelopeRequestParser(request);

  expect(eventData.exception?.values).toHaveLength(1);

  expect(eventData?.breadcrumbs?.length).toBe(1);
  expect(eventData!.breadcrumbs![0]).toEqual({
    timestamp: expect.any(Number),
    category: 'fetch',
    type: 'http',
    data: {
      method: 'GET',
      status_code: 200,
      // NOT set here from body, as this would be async
      url: 'http://localhost:7654/foo',
    },
  });

  const { replayRecordingSnapshots } = await replayRequestPromise;
  expect(getReplayPerformanceSpans(replayRecordingSnapshots).filter(span => span.op === 'resource.fetch')).toEqual([
    {
      data: {
        method: 'GET',
        statusCode: 200,
        request: {
          headers: {},
          _meta: {
            warnings: ['URL_SKIPPED'],
          },
        },
        response: {
          size: 29,
          headers: {},
          _meta: {
            warnings: ['URL_SKIPPED'],
          },
        },
      },
      description: 'http://localhost:7654/foo',
      endTimestamp: expect.any(Number),
      op: 'resource.fetch',
      startTimestamp: expect.any(Number),
    },
  ]);
});

sentryTest('captures response size from non-text response body', async ({ getLocalTestPath, page }) => {
  if (shouldSkipReplayTest()) {
    sentryTest.skip();
  }

  await page.route('**/foo', async route => {
    return route.fulfill({
      status: 200,
      body: Buffer.from('<html>Hello world</html>'),
      headers: {
        'Content-Length': '',
      },
    });
  });

  await page.route('https://dsn.ingest.sentry.io/**/*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'test-id' }),
    });
  });

  const requestPromise = waitForErrorRequest(page);

  const replayRequestPromise = collectReplayRequests(page, recordingEvents => {
    return getReplayPerformanceSpans(recordingEvents).some(span => span.op === 'resource.fetch');
  });

  const url = await getLocalTestPath({ testDir: __dirname });
  await page.goto(url);

  const [, request, { replayRecordingSnapshots }] = await Promise.all([
    page.evaluate(() => {
      /* eslint-disable */
      fetch('http://localhost:7654/foo', {
        method: 'POST',
      }).then(() => {
        // @ts-expect-error Sentry is a global
        Sentry.captureException('test error');
      });
      /* eslint-enable */
    }),
    requestPromise,
    replayRequestPromise,
  ]);

  const eventData = envelopeRequestParser(request);

  expect(eventData.exception?.values).toHaveLength(1);

  expect(eventData?.breadcrumbs?.length).toBe(1);
  expect(eventData!.breadcrumbs![0]).toEqual({
    timestamp: expect.any(Number),
    category: 'fetch',
    type: 'http',
    data: {
      method: 'POST',
      status_code: 200,
      url: 'http://localhost:7654/foo',
    },
  });

  expect(getReplayPerformanceSpans(replayRecordingSnapshots).filter(span => span.op === 'resource.fetch')).toEqual([
    {
      data: {
        method: 'POST',
        statusCode: 200,
        request: {
          headers: {},
          _meta: {
            warnings: ['URL_SKIPPED'],
          },
        },
        response: {
          size: 24,
          headers: {},
          _meta: {
            warnings: ['URL_SKIPPED'],
          },
        },
      },
      description: 'http://localhost:7654/foo',
      endTimestamp: expect.any(Number),
      op: 'resource.fetch',
      startTimestamp: expect.any(Number),
    },
  ]);
});
