import { expect, test } from '@playwright/test';
import axios, { AxiosError } from 'axios';

const authToken = process.env.E2E_TEST_AUTH_TOKEN;
const sentryTestOrgSlug = process.env.E2E_TEST_SENTRY_ORG_SLUG;
const sentryTestProject = process.env.E2E_TEST_SENTRY_TEST_PROJECT;
const EVENT_POLLING_TIMEOUT = 90_000;

test('Sends transactions to Sentry', async ({ baseURL }) => {
  const { data } = await axios.get(`${baseURL}/test-transaction`);
  const { transactionIds } = data;

  console.log(`Polling for transaction eventIds: ${JSON.stringify(transactionIds)}`);

  expect(transactionIds.length).toBeGreaterThan(0);

  await Promise.all(
    transactionIds.map(async (transactionId: string) => {
      const url = `https://sentry.io/api/0/projects/${sentryTestOrgSlug}/${sentryTestProject}/events/${transactionId}/`;

      await expect
        .poll(
          async () => {
            try {
              const response = await axios.get(url, { headers: { Authorization: `Bearer ${authToken}` } });

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
          { timeout: EVENT_POLLING_TIMEOUT },
        )
        .toBe(200);
    }),
  );
});
