/**
 * Fastify `onRequest` hook — names the New Relic transaction using the matched
 * route pattern (e.g. `GET /hello/:name`) instead of the raw URL.
 *
 * Without route-pattern naming, NR creates a new metric segment for every
 * unique URL, which causes Metric Grouping Issues (MGI) in high-cardinality
 * routes like `/users/123`, `/users/456`, etc.
 *
 * @type {import('@gasket/core').HookHandler<'fastify'>}
 */
export default async function fastify(gasket, app) {
  const nr = await import('newrelic').then((m) => m.default || m).catch(() => null);

  if (!nr?.agent) {
    gasket.logger.warn('[plugin-newrelic] NR agent not loaded — skipping transaction naming hook');
    return;
  }

  app.addHook('onRequest', async (req) => {
    // `routeOptions.url` is the registered pattern; falls back gracefully.
    const routePattern = req.routeOptions?.url || req.routerPath || req.url;
    nr.setTransactionName(`${req.method} ${routePattern}`);
  });
}
