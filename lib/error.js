/**
 * Fastify `onError` hook — captures unhandled route errors and reports them
 * to New Relic via `noticeError()`.
 *
 * Fires the `nrError` lifecycle before reporting so other plugins can enrich
 * the attributes object (e.g. add deploy version, feature flags).
 *
 * Error filtering is controlled by `gasket.config.newrelic.errors`:
 *   - `ignore4xx` (default: `true`)  — skip 4xx client errors
 *   - `ignore5xx` (default: `false`) — skip 5xx server errors
 *
 * @type {import('@gasket/core').HookHandler<'fastify'>}
 */
export default async function errorHook(gasket, app) {
  const nr = await import('newrelic').then((m) => m.default || m).catch(() => null);

  if (!nr?.agent) {
    gasket.logger.warn('[plugin-newrelic] NR agent not loaded — skipping error capture hook');
    return;
  }

  app.addHook('onError', async (req, _reply, error) => {
    const statusCode = error.statusCode || 500;
    const { ignore4xx = true, ignore5xx = false } = gasket.config?.newrelic?.errors || {};

    if (ignore4xx && statusCode >= 400 && statusCode < 500) return;
    if (ignore5xx && statusCode >= 500) return;

    const attrs = {
      'http.statusCode': statusCode,
      'http.method': req.method || '',
      'http.route': req.routeOptions?.url || req.routerPath || req.url || ''
    };
    if (req.id) attrs['request.id'] = String(req.id);

    // Allow other plugins to enrich attrs before the NR report is sent.
    await gasket.exec('nrError', error, attrs);

    nr.noticeError(error, attrs);

    gasket.logger.error(
      `[plugin-newrelic] noticeError — ${statusCode} "${error.message}" on ${attrs['http.route']}`
    );
  });
}
