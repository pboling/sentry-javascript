import { applySdkMetadata } from '@sentry/core';
import type { NodeOptions } from '@sentry/node';
import {
  getDefaultIntegrations as getDefaultNodeIntegrations,
  init as nodeInit,
  isInitialized,
  setTag,
} from '@sentry/node';
import type { Integration } from '@sentry/types';
import { logger } from '@sentry/utils';

import { DEBUG_BUILD } from './utils/debug-build';
import { instrumentServer } from './utils/instrumentServer';
import { remixIntegration } from './utils/integrations/opentelemetry';
import type { RemixOptions } from './utils/remixOptions';

// We need to explicitly export @sentry/node as they end up under `default` in ESM builds
// See: https://github.com/getsentry/sentry-javascript/issues/8474
export {
  addEventProcessor,
  addBreadcrumb,
  addIntegration,
  captureCheckIn,
  withMonitor,
  captureException,
  captureEvent,
  captureMessage,
  captureFeedback,
  createTransport,
  // eslint-disable-next-line deprecation/deprecation
  getCurrentHub,
  getClient,
  getCurrentScope,
  getGlobalScope,
  getIsolationScope,
  setCurrentClient,
  NodeClient,
  Scope,
  SDK_VERSION,
  setContext,
  setExtra,
  setExtras,
  setTag,
  setTags,
  setUser,
  getSpanStatusFromHttpCode,
  setHttpStatus,
  withScope,
  withIsolationScope,
  makeNodeTransport,
  defaultStackParser,
  lastEventId,
  flush,
  close,
  getSentryRelease,
  addRequestDataToEvent,
  DEFAULT_USER_INCLUDES,
  extractRequestData,
  consoleIntegration,
  onUncaughtExceptionIntegration,
  onUnhandledRejectionIntegration,
  modulesIntegration,
  contextLinesIntegration,
  nodeContextIntegration,
  localVariablesIntegration,
  requestDataIntegration,
  functionToStringIntegration,
  inboundFiltersIntegration,
  linkedErrorsIntegration,
  setMeasurement,
  getActiveSpan,
  getRootSpan,
  startSpan,
  startSpanManual,
  startInactiveSpan,
  withActiveSpan,
  getSpanDescendants,
  continueTrace,
  isInitialized,
  cron,
  parameterize,
  metrics,
  createGetModuleFromFilename,
  SEMANTIC_ATTRIBUTE_SENTRY_OP,
  SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN,
  SEMANTIC_ATTRIBUTE_SENTRY_SOURCE,
  SEMANTIC_ATTRIBUTE_SENTRY_SAMPLE_RATE,
  expressIntegration,
  expressErrorHandler,
  setupExpressErrorHandler,
  fastifyIntegration,
  graphqlIntegration,
  mongoIntegration,
  mongooseIntegration,
  mysqlIntegration,
  mysql2Integration,
  redisIntegration,
  nestIntegration,
  setupNestErrorHandler,
  postgresIntegration,
  prismaIntegration,
  hapiIntegration,
  setupHapiErrorHandler,
  spotlightIntegration,
  setupFastifyErrorHandler,
  trpcMiddleware,
  spanToJSON,
  spanToTraceHeader,
  spanToBaggageHeader,
  addOpenTelemetryInstrumentation,
} from '@sentry/node';

// Keeping the `*` exports for backwards compatibility and types
export * from '@sentry/node';

export {
  captureRemixServerException,
  // eslint-disable-next-line deprecation/deprecation
  wrapRemixHandleError,
  sentryHandleError,
  wrapHandleErrorWithSentry,
} from './utils/instrumentServer';
export { ErrorBoundary, withErrorBoundary } from '@sentry/react';
export { withSentry } from './client/performance';
export { captureRemixErrorBoundaryError } from './client/errors';
export { browserTracingIntegration } from './client/browserTracingIntegration';

export type { SentryMetaArgs } from './utils/types';

/**
 * Returns the default Remix integrations.
 *
 * @param options The options for the SDK.
 */
export function getDefaultIntegrations(options: RemixOptions): Integration[] {
  return [
    ...getDefaultNodeIntegrations(options).filter(integration => integration.name !== 'Http'),
    remixIntegration(options),
  ];
}

/** Initializes Sentry Remix SDK on Node. */
export function init(options: RemixOptions): void {
  applySdkMetadata(options, 'remix', ['remix', 'node']);

  if (isInitialized()) {
    DEBUG_BUILD && logger.log('SDK already initialized');

    return;
  }

  options.defaultIntegrations = getDefaultIntegrations(options as NodeOptions);

  nodeInit(options as NodeOptions);

  instrumentServer();

  setTag('runtime', 'node');
}
