/**
 * Express integration tests
 *
 * Spins up a real Express+Gasket app with the NR plugin (mocked agent),
 * fires HTTP requests via supertest, and asserts the plugin behaves correctly.
 *
 * Lifecycle order mirrors real Gasket:
 *   middleware (naming) → routes → errorMiddleware (error capture)
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ─── Mock NR agent before any plugin imports ────────────────────────────────
const mockNr = {
  agent: {},
  setTransactionName: vi.fn(),
  noticeError: vi.fn()
};
vi.mock('newrelic', () => ({ default: mockNr }));

const { expressLifecycleHook, errorMiddlewareHook } = await import('../../lib/express.js');

// ─── Build app matching real Gasket lifecycle order ──────────────────────────
async function buildApp(gasket) {
  const app = express();

  // 1. middleware lifecycle — naming hook, must come BEFORE routes
  await expressLifecycleHook(gasket, app);

  // 2. Routes (simulates 'express' lifecycle in a real Gasket app)
  app.get('/ping', (req, res) => res.json({ status: 'ok' }));
  app.get('/hello/:name', (req, res) => res.json({ hello: req.params.name }));
  app.get('/warn', (req, res) => res.json({ warned: true }));
  app.get('/error', (req, res, next) => {
    const err = new Error('intentional test error');
    err.statusCode = 500;
    next(err);
  });
  app.get('/not-found', (req, res, next) => {
    const err = new Error('resource not found');
    err.statusCode = 404;
    next(err);
  });

  // 3. errorMiddleware lifecycle — error capture, must come AFTER routes
  const errHandler = await errorMiddlewareHook(gasket); if (errHandler) app.use(errHandler);

  // Default error responder (runs after plugin's error middleware)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });

  return app;
}

const makeGasket = (newrelicConfig = {}) => ({
  config: { newrelic: newrelicConfig },
  exec: vi.fn(async () => {}),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
});

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('Express integration', () => {
  let app;
  let gasket;

  beforeAll(async () => {
    gasket = makeGasket();
    app = await buildApp(gasket);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockNr.agent = {};
  });

  describe('transaction naming', () => {
    it('names transaction from route pattern GET /hello/:name', async () => {
      await request(app).get('/hello/adilson').expect(200);
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNr.setTransactionName).toHaveBeenCalledWith('GET /hello/:name');
    });

    it('names transaction for static route GET /ping', async () => {
      await request(app).get('/ping').expect(200);
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNr.setTransactionName).toHaveBeenCalledWith('GET /ping');
    });

    it('falls back to raw path for unmatched routes', async () => {
      await request(app).get('/unknown-path').expect(404);
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNr.setTransactionName).toHaveBeenCalledWith('GET /unknown-path');
    });
  });

  describe('error capture', () => {
    it('reports 500 errors to NR and still returns error response', async () => {
      const res = await request(app).get('/error').expect(500);
      await new Promise((r) => setTimeout(r, 20));

      expect(mockNr.noticeError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'intentional test error' }),
        expect.objectContaining({ 'http.statusCode': 500, 'http.method': 'GET' })
      );
      expect(res.body.error).toBe('intentional test error');
    });

    it('fires nrError lifecycle before reporting', async () => {
      await request(app).get('/error').expect(500);
      await new Promise((r) => setTimeout(r, 20));

      expect(gasket.exec).toHaveBeenCalledWith('nrError', expect.any(Error), expect.any(Object));
      const execOrder = gasket.exec.mock.invocationCallOrder[0];
      const noticeOrder = mockNr.noticeError.mock.invocationCallOrder[0];
      expect(execOrder).toBeLessThan(noticeOrder);
    });

    it('skips 404 errors by default (ignore4xx=true)', async () => {
      await request(app).get('/not-found').expect(404);
      await new Promise((r) => setTimeout(r, 20));
      expect(mockNr.noticeError).not.toHaveBeenCalled();
    });

    it('reports 404 when ignore4xx=false', async () => {
      const customGasket = makeGasket({ errors: { ignore4xx: false } });
      const customApp = await buildApp(customGasket);

      await request(customApp).get('/not-found').expect(404);
      await new Promise((r) => setTimeout(r, 20));
      expect(mockNr.noticeError).toHaveBeenCalled();
    });
  });

  describe('happy path routes', () => {
    it('GET /ping returns ok', async () => {
      const res = await request(app).get('/ping').expect(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /hello/:name returns the name', async () => {
      const res = await request(app).get('/hello/gasket').expect(200);
      expect(res.body.hello).toBe('gasket');
    });
  });
});
