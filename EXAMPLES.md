# @gasket/plugin-newrelic — Examples

## Basic Fastify Setup

```js
// gasket.js
import { makeGasket } from '@gasket/core';
import pluginFastify from '@gasket/plugin-fastify';
import pluginNewrelic from '@gasket/plugin-newrelic';

export default makeGasket({
  plugins: [pluginFastify, pluginNewrelic],
  newrelic: {
    // enabled auto-detects from NEW_RELIC_LICENSE_KEY env var
    errors: {
      ignore4xx: true,   // don't report 404s, 400s, etc.
      ignore5xx: false   // do report 500s (default)
    }
  }
});
```

```js
// routes.js
export default async function routes(gasket, app) {
  app.get('/hello/:name', async (req, reply) => {
    return { hello: req.params.name };
  });
}
```

```js
// server.js
import gasket from './gasket.js';
import routes from './routes.js';

const app = await gasket.actions.getFastifyApp();
await routes(gasket, app);
await app.listen({ port: 3000 });
```

---

## Basic Express Setup

```js
// gasket.js
import { makeGasket } from '@gasket/core';
import pluginExpress from '@gasket/plugin-express';
import pluginNewrelic from '@gasket/plugin-newrelic';

export default makeGasket({
  plugins: [pluginExpress, pluginNewrelic],
  newrelic: {
    errors: {
      ignore4xx: true,
      ignore5xx: false
    }
  }
});
```

```js
// routes.js
export default function routes(gasket, app) {
  app.get('/users/:id', async (req, res) => {
    const user = await getUser(req.params.id);
    res.json(user);
  });
}
```

---

## Using `getNrTransaction` to Add Custom Attributes

```js
// In a route handler
app.get('/orders/:id', async (req, reply) => {
  const order = await getOrder(req.params.id);

  // Attach business context to the NR transaction
  const txn = await gasket.actions.getNrTransaction(req);
  if (txn) {
    txn.addAttribute('order.id', order.id);
    txn.addAttribute('order.status', order.status);
    txn.addAttribute('order.value', order.totalCents);
  }

  return order;
});
```

---

## Implementing `nrTransaction` in Another Plugin

Add user context (user ID, account, roles) to every NR transaction automatically:

```js
// plugins/plugin-nr-user-context.js
export default {
  name: 'plugin-nr-user-context',
  hooks: {
    /**
     * Decorates the NR transaction with authenticated user data.
     * Runs whenever gasket.actions.getNrTransaction(req) is called.
     *
     * @param {import('@gasket/core').Gasket} gasket
     * @param {import('newrelic').Transaction} transaction
     * @param {{ req: import('@gasket/request').GasketRequest }} context
     */
    async nrTransaction(gasket, transaction, { req }) {
      const user = req.user; // set by your auth middleware
      if (!user) return;

      transaction.addAttribute('user.id', user.id);
      transaction.addAttribute('user.accountId', user.accountId);
      transaction.addAttribute('user.roles', user.roles?.join(',') || '');
    }
  }
};
```

---

## Implementing `nrError` in Another Plugin

Enrich error reports with deploy metadata or feature flag context:

```js
// plugins/plugin-nr-error-context.js
export default {
  name: 'plugin-nr-error-context',
  hooks: {
    /**
     * Enriches NR error attributes before noticeError() is called.
     * Mutations to `attributes` are reflected in the NR report.
     *
     * @param {import('@gasket/core').Gasket} gasket
     * @param {Error} error
     * @param {Record<string, string | number | boolean>} attributes
     */
    async nrError(gasket, error, attributes) {
      // Deployment context for correlating errors to releases
      attributes['deploy.version'] = process.env.DEPLOY_VERSION || 'unknown';
      attributes['deploy.environment'] = process.env.NODE_ENV || 'development';

      // Feature flags active at the time of the error
      const flags = gasket.config.featureFlags;
      if (flags) {
        attributes['feature.flags'] = Object.entries(flags)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(',');
      }
    }
  }
};
```

---

## `newrelic.cjs` — Full Config Example

```js
// newrelic.cjs — place in your app root
'use strict';

// Docs: https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'my-gasket-app'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',

  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info'
  },

  distributed_tracing: {
    enabled: true
  },

  // Capture all request headers for distributed tracing context
  allow_all_headers: true,

  // Application logging — forward logs to NR with trace correlation
  application_logging: {
    forwarding: { enabled: true },
    local_decorating: { enabled: false }
  },

  // Exclude sensitive headers from being captured as attributes
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  }
};
```

---

## `setup.js` — With dotenv

If you store your NR license key in a `.env` file during development, load it before importing `newrelic`:

```js
// setup.js — app root
// Load .env first so NR agent picks up NEW_RELIC_LICENSE_KEY at startup
import 'dotenv/config';
import 'newrelic';
```

> **Note:** In production, inject environment variables via your deployment platform (Kubernetes secrets, ECS task environment, etc.) rather than `.env` files.

Then in `package.json`:

```json
{
  "scripts": {
    "start": "NODE_OPTIONS=--import=./setup.js node server.js",
    "local": "NODE_OPTIONS=--import=./setup.js tsx watch server.ts"
  }
}
```
