/**
 * routes — test routes with rich logging so we can verify NR Log Management
 */
export default {
  name: 'test-routes',
  hooks: {
    fastify(gasket, app) {
      const log = gasket.logger;

      /** GET /ping — health check */
      app.get('/ping', async (req) => {
        log.info('[ping] health check hit', { reqId: req.id });
        return { status: 'ok', ts: new Date().toISOString() };
      });

      /**
       * GET /hello/:name
       * Logs request start, NR transaction state, and response.
       */
      app.get('/hello/:name', async (req) => {
        const { name } = req.params;

        log.info(`[hello] request received — name="${name}"`, { reqId: req.id, name });

        const txn = await gasket.actions.getNrTransaction(req);

        if (txn) {
          txn.addAttribute?.('greeted', name);
          log.info('[hello] NR transaction active — added greeted attribute', { reqId: req.id, name });
        } else {
          log.warn('[hello] NR transaction not available', { reqId: req.id });
        }

        const result = { hello: name, nrActive: Boolean(txn) };
        log.info('[hello] sending response', { reqId: req.id, result });
        return result;
      });

      /**
       * GET /work — simulates a multi-step operation with logging at each step.
       * Good for seeing correlated log entries in a single NR trace.
       */
      app.get('/work', async (req) => {
        const txn = await gasket.actions.getNrTransaction(req);
        const reqId = req.id;

        log.info('[work] starting job', { reqId, step: 'start' });

        await step(log, reqId, 'fetch-config', 30);
        await step(log, reqId, 'validate-input', 10);
        await step(log, reqId, 'process-data', 50);

        if (txn) txn.addAttribute?.('steps', 3);

        log.info('[work] job complete', { reqId, steps: 3, nrActive: Boolean(txn) });
        return { done: true, steps: 3, nrActive: Boolean(txn) };
      });

      /** GET /warn — logs a warning (visible in NR as warn-level log) */
      app.get('/warn', async (req) => {
        log.warn('[warn] deliberate warning log — check NR Logs', { reqId: req.id, reason: 'demo' });
        return { warned: true };
      });

      /** GET /error — throws so NR error capture fires */
      app.get('/error', async (req) => {
        log.error('[error] about to throw intentional test error', { reqId: req.id });
        throw new Error('intentional test error');
      });
    }
  }
};

/** Simulates an async step with a small delay and structured log */
async function step(log, reqId, name, ms) {
  log.info(`[work] step "${name}" starting`, { reqId, step: name, durationMs: ms });
  await new Promise((r) => setTimeout(r, ms));
  log.info(`[work] step "${name}" complete`, { reqId, step: name, durationMs: ms });
}
