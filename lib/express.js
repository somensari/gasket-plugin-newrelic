/**
 * Express `express` lifecycle — transaction naming middleware.
 *
 * Names the NR transaction from the matched route pattern after routing
 * completes. Using a `res.on('finish')` listener ensures `req.route.path`
 * is available (it is only set by Express after route matching). Falls back
 * to `req.path` for unmatched requests (404s).
 *
 * @type {import('@gasket/core').HookHandler<'express'>}
 */
export async function expressLifecycleHook(gasket, app) {
  const nr = await import('newrelic').then((m) => m.default || m).catch(() => null);

  if (!nr?.agent) {
    gasket.logger.warn('[plugin-newrelic] NR agent not loaded — skipping Express transaction naming');
    return;
  }

  app.use((req, res, next) => {
    res.on('finish', () => {
      const routePath = req.route?.path || req.path;
      nr.setTransactionName(`${req.method} ${routePath}`);
    });
    next();
  });
}

/**
 * Express `errorMiddleware` lifecycle — error capture middleware.
 *
 * Returns (rather than registers) the error handler so that Gasket's
 * plugin-express can collect and mount it after all routes are registered.
 * This guarantees the error handler is last in the Express middleware stack,
 * which is required for Express error handlers (4-argument functions).
 *
 * Fires the `nrError` lifecycle before reporting so other plugins can enrich
 * the attributes object. Always calls `next(err)` so Express's own error
 * handling continues to run.
 *
 * Error filtering is controlled by `gasket.config.newrelic.errors`:
 *   - `ignore4xx` (default: `true`)  — skip 4xx client errors
 *   - `ignore5xx` (default: `false`) — skip 5xx server errors
 *
 * Returns `undefined` when @gasket/plugin-express is not loaded so that
 * @gasket/plugin-fastify does not require @fastify/express unnecessarily.
 *
 * @type {import('@gasket/core').HookHandler<'errorMiddleware'>}
 */
export async function errorMiddlewareHook(gasket) {
  // errorMiddleware is Express-only. If @gasket/plugin-express is not loaded
  // (e.g. a Fastify-only app), return undefined so @gasket/plugin-fastify's
  // create-servers does not require @fastify/express.
  const hasExpress = gasket.config.plugins?.some((p) => p.name === '@gasket/plugin-express');
  if (!hasExpress) return;

  const nr = await import('newrelic').then((m) => m.default || m).catch(() => null);

  if (!nr?.agent) {
    gasket.logger.warn('[plugin-newrelic] NR agent not loaded — skipping Express error capture');
    return;
  }

  const { ignore4xx = true, ignore5xx = false } = gasket.config?.newrelic?.errors || {};

  // Four arguments are required for Express to treat this as an error handler.
  // eslint-disable-next-line no-unused-vars
  return function nrErrorMiddleware(err, req, res, next) {
    const statusCode = err.status || err.statusCode || 500;

    if (ignore4xx && statusCode >= 400 && statusCode < 500) return next(err);
    if (ignore5xx && statusCode >= 500) return next(err);

    const attrs = {
      'http.statusCode': statusCode,
      'http.method': req.method || '',
      'http.route': req.route?.path || req.path || ''
    };
    if (req.id) attrs['request.id'] = String(req.id);

    // Fire nrError lifecycle to allow attribute enrichment, then report.
    gasket.exec('nrError', err, attrs).then(() => {
      nr.noticeError(err, attrs);
      gasket.logger.error(
        `[plugin-newrelic] noticeError — ${statusCode} "${err.message}" on ${attrs['http.route']}`
      );
    });

    next(err);
  };
}
