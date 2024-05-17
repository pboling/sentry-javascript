import { expect, test } from '@playwright/test';
import { uuid4 } from '@sentry/utils';

import { waitForTransaction } from '@sentry-internal/event-proxy-server';

test('Sends two linked transactions (server & client) to Sentry', async ({ page }) => {
  // We use this to identify the transactions
  const testTag = uuid4();

  const httpServerTransactionPromise = waitForTransaction('create-remix-app-v2', transactionEvent => {
    return (
      transactionEvent.type === 'transaction' &&
      transactionEvent.contexts?.trace?.op === 'http' &&
      transactionEvent.tags?.['sentry_test'] === testTag
    );
  });

  const pageLoadTransactionPromise = waitForTransaction('create-remix-app-v2', transactionEvent => {
    return (
      transactionEvent.type === 'transaction' &&
      transactionEvent.contexts?.trace?.op === 'pageload' &&
      transactionEvent.tags?.['sentry_test'] === testTag
    );
  });

  page.goto(`/?tag=${testTag}`);

  const pageloadTransaction = await pageLoadTransactionPromise;
  const httpServerTransaction = await httpServerTransactionPromise;

  expect(pageloadTransaction).toBeDefined();
  expect(httpServerTransaction).toBeDefined();

  const httpServerTraceId = httpServerTransaction.contexts?.trace?.trace_id;
  const httpServerSpanId = httpServerTransaction.contexts?.trace?.span_id;
  const loaderSpanId = httpServerTransaction?.spans?.find(
    span => span.data && span.data['code.function'] === 'loader',
  )?.span_id;

  const pageLoadTraceId = pageloadTransaction.contexts?.trace?.trace_id;
  const pageLoadSpanId = pageloadTransaction.contexts?.trace?.span_id;
  const pageLoadParentSpanId = pageloadTransaction.contexts?.trace?.parent_span_id;

  expect(httpServerTransaction.transaction).toBe('GET http://localhost:3030/');
  expect(pageloadTransaction.transaction).toBe('routes/_index');

  expect(httpServerTraceId).toBeDefined();
  expect(httpServerSpanId).toBeDefined();

  expect(pageLoadTraceId).toEqual(httpServerTraceId);
  expect(pageLoadParentSpanId).toEqual(loaderSpanId);
  expect(pageLoadSpanId).not.toEqual(httpServerSpanId);
});
