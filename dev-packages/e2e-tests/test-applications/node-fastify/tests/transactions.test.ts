import { expect, test } from '@playwright/test';
import { waitForTransaction } from '@sentry-internal/event-proxy-server';
import axios, { AxiosError } from 'axios';

const authToken = process.env.E2E_TEST_AUTH_TOKEN;
const sentryTestOrgSlug = process.env.E2E_TEST_SENTRY_ORG_SLUG;
const sentryTestProject = process.env.E2E_TEST_SENTRY_TEST_PROJECT;
const EVENT_POLLING_TIMEOUT = 90_000;

test('Sends an API route transaction', async ({ baseURL }) => {
  const pageloadTransactionEventPromise = waitForTransaction('node-fastify', transactionEvent => {
    return (
      transactionEvent?.contexts?.trace?.op === 'http.server' &&
      transactionEvent?.transaction === 'GET /test-transaction'
    );
  });

  await axios.get(`${baseURL}/test-transaction`);

  const transactionEvent = await pageloadTransactionEventPromise;
  const transactionEventId = transactionEvent.event_id;

  expect(transactionEvent.contexts?.trace).toEqual({
    data: {
      'sentry.source': 'route',
      'sentry.origin': 'auto.http.otel.http',
      'sentry.op': 'http.server',
      'sentry.sample_rate': 1,
      url: 'http://localhost:3030/test-transaction',
      'otel.kind': 'SERVER',
      'http.response.status_code': 200,
      'http.url': 'http://localhost:3030/test-transaction',
      'http.host': 'localhost:3030',
      'net.host.name': 'localhost',
      'http.method': 'GET',
      'http.scheme': 'http',
      'http.target': '/test-transaction',
      'http.user_agent': 'axios/1.6.7',
      'http.flavor': '1.1',
      'net.transport': 'ip_tcp',
      'net.host.ip': expect.any(String),
      'net.host.port': expect.any(Number),
      'net.peer.ip': expect.any(String),
      'net.peer.port': expect.any(Number),
      'http.status_code': 200,
      'http.status_text': 'OK',
      'http.route': '/test-transaction',
    },
    op: 'http.server',
    span_id: expect.any(String),
    status: 'ok',
    trace_id: expect.any(String),
    origin: 'auto.http.otel.http',
  });

  expect(transactionEvent).toEqual(
    expect.objectContaining({
      transaction: 'GET /test-transaction',
      type: 'transaction',
      transaction_info: {
        source: 'route',
      },
    }),
  );

  const spans = transactionEvent.spans || [];

  expect(spans).toContainEqual({
    data: {
      'plugin.name': 'fastify -> sentry-fastify-error-handler',
      'fastify.type': 'middleware',
      'hook.name': 'onRequest',
      'otel.kind': 'INTERNAL',
      'sentry.origin': 'auto.http.otel.fastify',
      'sentry.op': 'middleware.fastify',
    },
    description: 'sentry-fastify-error-handler',
    op: 'middleware.fastify',
    parent_span_id: expect.any(String),
    span_id: expect.any(String),
    start_timestamp: expect.any(Number),
    status: 'ok',
    timestamp: expect.any(Number),
    trace_id: expect.any(String),
    origin: 'auto.http.otel.fastify',
  });

  expect(spans).toContainEqual({
    data: {
      'plugin.name': 'fastify -> sentry-fastify-error-handler',
      'fastify.type': 'request_handler',
      'http.route': '/test-transaction',
      'otel.kind': 'INTERNAL',
      'sentry.op': 'request_handler.fastify',
      'sentry.origin': 'auto.http.otel.fastify',
    },
    description: 'sentry-fastify-error-handler',
    op: 'request_handler.fastify',
    parent_span_id: expect.any(String),
    span_id: expect.any(String),
    start_timestamp: expect.any(Number),
    status: 'ok',
    timestamp: expect.any(Number),
    trace_id: expect.any(String),
    origin: 'auto.http.otel.fastify',
  });

  expect(spans).toContainEqual({
    data: {
      'otel.kind': 'INTERNAL',
      'sentry.origin': 'manual',
    },
    description: 'test-span',
    parent_span_id: expect.any(String),
    span_id: expect.any(String),
    start_timestamp: expect.any(Number),
    status: 'ok',
    timestamp: expect.any(Number),
    trace_id: expect.any(String),
    origin: 'manual',
  });

  expect(spans).toContainEqual({
    data: {
      'otel.kind': 'INTERNAL',
      'sentry.origin': 'manual',
    },
    description: 'child-span',
    parent_span_id: expect.any(String),
    span_id: expect.any(String),
    start_timestamp: expect.any(Number),
    status: 'ok',
    timestamp: expect.any(Number),
    trace_id: expect.any(String),
    origin: 'manual',
  });

  await expect
    .poll(
      async () => {
        try {
          const response = await axios.get(
            `https://sentry.io/api/0/projects/${sentryTestOrgSlug}/${sentryTestProject}/events/${transactionEventId}/`,
            { headers: { Authorization: `Bearer ${authToken}` } },
          );

          return response.status;
        } catch (e) {
          if (e instanceof AxiosError && e.response) {
            if (e.response.status !== 404) {
              throw e;
            } else {
              return e.response.status;
            }
          } else {
            throw e;
          }
        }
      },
      {
        timeout: EVENT_POLLING_TIMEOUT,
      },
    )
    .toBe(200);
});
