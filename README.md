# @gasket/plugin-newrelic

Adds [New Relic APM](https://newrelic.com/products/application-monitoring) instrumentation to your Gasket application. Supports both Fastify and Express with automatic transaction naming, error capture, and extensible lifecycle hooks.

## Installation

```
npm i @gasket/plugin-newrelic newrelic
```

Update your `gasket.js` plugin configuration:

```diff
// gasket.js
+ import pluginNewrelic from '@gasket/plugin-newrelic';

export default makeGasket({
  plugins: [
+   pluginNewrelic
  ]
});
```

## Setup

The New Relic agent must be loaded **before any other code** via Node's `--import` flag. The plugin's `create` hook scaffolds the necessary files automatically for new apps; for existing apps, follow the steps below.

### 1. Create `setup.js`

```js
// setup.js — app root
import 'newrelic';
```

### 2. Create `newrelic.cjs`

The NR agent reads this file at startup. Use CommonJS format (`.cjs`) so it loads before ESM transforms.

```js
// newrelic.cjs — app root
'use strict';
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'my-gasket-app'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  logging: { level: 'info' },
  distributed_tracing: { enabled: true },
  allow_all_headers: true
};
```

### 3. Update your start script

```diff
// package.json
  "scripts": {
-   "start": "node server.js",
+   "start": "NODE_OPTIONS=--import=./setup.js node server.js"
  }
```

### Environment Variables

At minimum, set these before starting your app:

| Variable | Required | Description |
|---|---|---|
| `NEW_RELIC_LICENSE_KEY` | Yes (or `newrelic.licenseKey`) | Your NR ingest license key |
| `NEW_RELIC_APP_NAME` | Recommended | Application name shown in NR UI |
| `NEW_RELIC_LOG_LEVEL` | No | NR agent log level (`info`, `warn`, `error`, `debug`) |
| `NEW_RELIC_DISTRIBUTED_TRACING_ENABLED` | No | Enable distributed tracing (default: `true` via config) |

> **Note:** `NEW_RELIC_LICENSE_KEY` is also used by this plugin to auto-detect whether the NR agent should be enabled. If it is absent and `newrelic.enabled` is not set in `gasket.js`, the plugin skips all instrumentation gracefully.

## Configuration

Configure the plugin under the `newrelic` key in your `gasket.js`:

```js
// gasket.js
export default makeGasket({
  plugins: [pluginNewrelic],
  newrelic: {
    enabled: true,        // optional — auto-detected from NEW_RELIC_LICENSE_KEY
    licenseKey: '...',    // optional — prefer env var; here as a fallback
    errors: {
      ignore4xx: true,    // skip reporting 4xx client errors (default: true)
      ignore5xx: false    // skip reporting 5xx server errors (default: false)
    }
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `newrelic.enabled` | `boolean` | auto | Explicitly enable or disable instrumentation. Defaults to `true` when `NEW_RELIC_LICENSE_KEY` is present. |
| `newrelic.licenseKey` | `string` | — | NR license key. Prefer the `NEW_RELIC_LICENSE_KEY` env var; this is a config-file fallback. |
| `newrelic.errors.ignore4xx` | `boolean` | `true` | When `true`, 4xx client errors are not reported to NR. |
| `newrelic.errors.ignore5xx` | `boolean` | `false` | When `true`, 5xx server errors are not reported to NR. |

## Actions

### `getNrTransaction(req)`

Returns the active New Relic `Transaction` object for the given request. Also fires the [`nrTransaction`](#nrtransaction) lifecycle so other plugins can decorate it (e.g. add user attributes).

Returns `undefined` if the NR agent is not loaded or no active transaction exists.

```js
// In a route handler, middleware, or another plugin
const transaction = await gasket.actions.getNrTransaction(req);
if (transaction) {
  transaction.addAttribute('custom.key', 'value');
}
```

**Signature:**
```ts
getNrTransaction(req: RequestLike): Promise<Transaction | void>
```

Results are cached per request via `@gasket/request` so repeated calls within the same request are efficient.

## Lifecycles

### `nrTransaction`

Fired when [`getNrTransaction`](#getnrtransactionreq) is called with an active transaction. Use this lifecycle to add custom attributes, user context, feature flags, or any other metadata to the transaction.

```js
// In another plugin
export default {
  name: 'my-plugin',
  hooks: {
    async nrTransaction(gasket, transaction, { req }) {
      if (req.user) {
        transaction.addAttribute('user.id', req.user.id);
        transaction.addAttribute('user.role', req.user.role);
      }
    }
  }
};
```

**Signature:**
```ts
nrTransaction(
  transaction: Transaction,
  context: { req: GasketRequest }
): MaybeAsync<void>
```

### `nrError`

Fired just before an error is reported to New Relic via `nr.noticeError()`. Use this lifecycle to enrich the error attributes object — for example, adding a deploy version or feature flag context that helps diagnose the error.

```js
// In another plugin
export default {
  name: 'my-plugin',
  hooks: {
    async nrError(gasket, error, attributes) {
      attributes['deploy.version'] = process.env.DEPLOY_VERSION || 'unknown';
      attributes['feature.flags'] = gasket.config.myFeatureFlags?.join(',') || '';
    }
  }
};
```

**Signature:**
```ts
nrError(
  error: Error,
  attributes: Record<string, string | number | boolean>
): MaybeAsync<void>
```

The `attributes` object starts with the following HTTP context fields and is passed by reference — mutations are reflected in the `noticeError` call:

| Attribute | Type | Description |
|---|---|---|
| `http.statusCode` | `number` | HTTP status code of the response |
| `http.method` | `string` | HTTP method (GET, POST, …) |
| `http.route` | `string` | Matched route pattern (e.g. `/users/:id`) |
| `request.id` | `string` | Request identifier (if available) |

## Framework Support

### Fastify

When a Fastify app is detected, the plugin registers two Fastify lifecycle hooks:

- **`onRequest`** — names the NR transaction using the matched route pattern (`req.routeOptions.url`, e.g. `GET /hello/:name`) instead of the raw URL. This prevents [Metric Grouping Issues (MGI)](https://docs.newrelic.com/docs/apm/agents/manage-apm-agents/troubleshooting/metric-grouping-issues/) for high-cardinality routes.
- **`onError`** — captures unhandled route errors and reports them to NR via `noticeError()`. Fires the `nrError` lifecycle before reporting so other plugins can enrich the attributes.

### Express

When an Express app is detected, the plugin provides:

- **Transaction naming middleware** (registered via the `express` lifecycle) — adds a `res.on('finish')` listener that names the NR transaction from `req.route.path` after routing completes. Falls back to `req.path` for unmatched routes.
- **Error capture middleware** (registered via the `errorMiddleware` lifecycle) — a standard 4-argument Express error handler that calls `nr.noticeError()`. Fires the `nrError` lifecycle before reporting. Always calls `next(err)` so Express's built-in error handling also runs.

> Both middlewares are registered only after the NR agent is confirmed to have started (`nr.agent` is truthy). If the agent did not load, a warning is logged and the middleware is skipped — your app continues to run normally.

## Viewing Data in New Relic

Once instrumented, you can find your data at:

- **APM & Services** → select your app → **Transactions**, **Errors**, **Distributed Tracing**
- [NR Node.js agent documentation](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/getting-started/introduction-new-relic-nodejs/)
- [Node.js agent configuration reference](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/)
- [Custom attributes guide](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/api-guides/nodejs-agent-api/#custom-attributes)
- [noticeError API](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/api-guides/nodejs-agent-api/#noticeError)

## License

[MIT](./LICENSE)
