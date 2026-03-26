/// <reference types="create-gasket-app" />
/// <reference types="@gasket/plugin-metadata" />

import * as actions from './actions.js';
import configure from './configure.js';
import create from './create.js';
import transactionNaming from './fastify.js';
import errorCapture from './error.js';
import { expressLifecycleHook, errorMiddlewareHook } from './express.js';
import packageJson from '../package.json' with { type: 'json' };
const { name, version, description } = packageJson;

/** @type {import('@gasket/core').Plugin} */
const plugin = {
  name,
  version,
  description,
  actions,
  hooks: {
    configure,
    create,
    /**
     * fastify: timing.first — our onRequest naming hook must be registered
     * before any route plugin's hooks so NR sees the correct transaction name
     * for every request, including those from plugins that register routes first.
     */
    fastify: {
      timing: { first: true },
      handler: async function fastify(gasket, app) {
        await transactionNaming(gasket, app);
        await errorCapture(gasket, app);
      }
    },
    /**
     * express: timing.first — naming middleware must sit at the front of the
     * Express stack so res.finish fires with the correct route pattern.
     * Without this, plugins that register routes before us push our middleware
     * after theirs, breaking transaction naming for matched routes.
     */
    express: {
      timing: { first: true },
      handler: expressLifecycleHook
    },
    /**
     * errorMiddleware: timing.last — error capture must be the final error
     * handler in the Express chain so all route errors reach it before NR
     * reports them. Plugins that register their own error handlers should
     * run first.
     */
    errorMiddleware: {
      timing: { last: true },
      handler: errorMiddlewareHook
    },
    metadata(gasket, meta) {
      return {
        ...meta,
        actions: [
          {
            name: 'getNrTransaction',
            description: 'Get the current New Relic transaction for a request. Fires the nrTransaction lifecycle.',
            link: 'README.md#getnrtransactionreq'
          }
        ],
        configurations: [
          {
            name: 'newrelic',
            link: 'README.md#configuration',
            description: 'New Relic plugin configuration object',
            type: 'object'
          },
          {
            name: 'newrelic.enabled',
            link: 'README.md#configuration',
            description: 'Explicitly enable or disable the NR agent. Auto-detected from NEW_RELIC_LICENSE_KEY when omitted.',
            type: 'boolean'
          },
          {
            name: 'newrelic.licenseKey',
            link: 'README.md#configuration',
            description: 'NR ingest license key. Prefer the NEW_RELIC_LICENSE_KEY env var; this is a config-file fallback.',
            type: 'string'
          },
          {
            name: 'newrelic.errors',
            link: 'README.md#configuration',
            description: 'Controls which HTTP error classes are reported to New Relic.',
            type: 'object'
          },
          {
            name: 'newrelic.errors.ignore4xx',
            link: 'README.md#configuration',
            description: 'Skip reporting 4xx client errors. Default: true.',
            type: 'boolean'
          },
          {
            name: 'newrelic.errors.ignore5xx',
            link: 'README.md#configuration',
            description: 'Skip reporting 5xx server errors. Default: false.',
            type: 'boolean'
          }
        ],
        lifecycles: [
          {
            name: 'nrTransaction',
            method: 'exec',
            description: 'Fired when getNrTransaction is called with an active transaction. Use to add custom attributes (user ID, account, feature flags, etc.).',
            link: 'README.md#nrtransaction',
            parent: 'middleware'
          },
          {
            name: 'nrError',
            method: 'exec',
            description: 'Fired just before an error is reported to NR via noticeError(). Mutations to the attributes object are included in the report.',
            link: 'README.md#nrerror',
            parent: 'middleware'
          }
        ]
      };
    }
  }
};

export default plugin;
