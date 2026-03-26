/**
 * Express routes for the test app
 * Mirrors the Fastify routes so we can compare NR data side-by-side.
 */
export default {
  name: 'test-routes-express',
  hooks: {
    express(gasket, app) {
      const log = gasket.logger;

      /** GET /ping */
      app.get('/ping', (req, res) => {
        log.info('[express/ping] health check hit', { reqId: req.id });
        res.json({ status: 'ok', ts: new Date().toISOString(), server: 'express' });
      });

      /** GET /hello/:name */
      app.get('/hello/:name', async (req, res) => {
        const { name } = req.params;
        log.info(`[express/hello] request received — name="${name}"`, { reqId: req.id, name });

        const txn = await gasket.actions.getNrTransaction(req);
        if (txn) {
          txn.addAttribute?.('greeted', name);
          log.info('[express/hello] NR transaction active — added greeted attribute', { name });
        } else {
          log.warn('[express/hello] NR transaction not available');
        }

        res.json({ hello: name, nrActive: Boolean(txn), server: 'express' });
      });

      /** GET /work — multi-step with structured logging */
      app.get('/work', async (req, res) => {
        const txn = await gasket.actions.getNrTransaction(req);
        const reqId = req.id;

        log.info('[express/work] starting job', { reqId });
        await step(log, reqId, 'fetch-config', 30);
        await step(log, reqId, 'validate-input', 10);
        await step(log, reqId, 'process-data', 50);

        if (txn) txn.addAttribute?.('steps', 3);
        log.info('[express/work] job complete', { reqId, steps: 3 });
        res.json({ done: true, steps: 3, nrActive: Boolean(txn), server: 'express' });
      });

      /** GET /warn */
      app.get('/warn', (req, res) => {
        log.warn('[express/warn] deliberate warning log — check NR Logs', { reqId: req.id });
        res.json({ warned: true, server: 'express' });
      });

      /** GET /error — triggers NR error capture */
      app.get('/error', (req, res, next) => {
        log.error('[express/error] about to throw intentional test error', { reqId: req.id });
        const err = new Error('intentional express error');
        err.statusCode = 500;
        next(err);
      });

      // Default error responder — must come after all routes
      // eslint-disable-next-line no-unused-vars
      app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({ error: err.message, server: 'express' });
      });
    }
  }
};

async function step(log, reqId, name, ms) {
  log.info(`[express/work] step "${name}" starting`, { reqId, step: name, durationMs: ms });
  await new Promise((r) => setTimeout(r, ms));
  log.info(`[express/work] step "${name}" complete`, { reqId, step: name, durationMs: ms });
}
