import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNr = {
  agent: {},
  setTransactionName: vi.fn(),
  noticeError: vi.fn()
};

vi.mock('newrelic', () => ({ default: mockNr }));

const { expressLifecycleHook, errorMiddlewareHook } = await import('../lib/express.js');

const makeGasket = (newrelicConfig = {}) => ({
  config: { newrelic: newrelicConfig },
  exec: vi.fn(async () => {}),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
});

const makeApp = () => {
  const middleware = [];
  return {
    use: vi.fn((fn) => middleware.push(fn)),
    _middleware: middleware
  };
};

const runNaming = async (app, req) => {
  const namingMiddleware = app._middleware[0];
  const res = { on: vi.fn((event, cb) => { if (event === 'finish') cb(); }) };
  const next = vi.fn();
  await namingMiddleware(req, res, next);
  expect(next).toHaveBeenCalled();
};

const makeReq = (overrides = {}) => ({ method: 'GET', path: '/test', ...overrides });
const makeError = (msg = 'boom', statusCode = 500) => {
  const err = new Error(msg);
  err.statusCode = statusCode;
  return err;
};

describe('express hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNr.agent = {};
  });

  describe('expressLifecycleHook (transaction naming)', () => {
    it('registers the naming middleware', async () => {
      const app = makeApp();
      await expressLifecycleHook(makeGasket(), app);
      expect(app.use).toHaveBeenCalledTimes(1);
    });

    it('names transaction from req.route.path on res finish', async () => {
      const app = makeApp();
      await expressLifecycleHook(makeGasket(), app);
      await runNaming(app, { method: 'GET', path: '/hello/adilson', route: { path: '/hello/:name' } });
      expect(mockNr.setTransactionName).toHaveBeenCalledWith('GET /hello/:name');
    });

    it('falls back to req.path when no route matched', async () => {
      const app = makeApp();
      await expressLifecycleHook(makeGasket(), app);
      await runNaming(app, { method: 'GET', path: '/not-found' });
      expect(mockNr.setTransactionName).toHaveBeenCalledWith('GET /not-found');
    });

    it('warns and skips when agent not loaded', async () => {
      mockNr.agent = null;
      const gasket = makeGasket();
      const app = makeApp();
      await expressLifecycleHook(gasket, app);
      expect(app.use).not.toHaveBeenCalled();
      expect(gasket.logger.warn).toHaveBeenCalledWith(expect.stringContaining('NR agent not loaded'));
    });
  });

  describe('errorMiddlewareHook (error capture)', () => {
    it('returns an error handler function', async () => {
      const handler = await errorMiddlewareHook(makeGasket());
      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(4); // 4-arg = Express error middleware
    });

    it('returns undefined when agent not loaded', async () => {
      mockNr.agent = null;
      const gasket = makeGasket();
      const result = await errorMiddlewareHook(gasket);
      expect(result).toBeUndefined();
      expect(gasket.logger.warn).toHaveBeenCalledWith(expect.stringContaining('NR agent not loaded'));
    });

    it('reports 5xx errors to NR', async () => {
      const gasket = makeGasket();
      const handler = await errorMiddlewareHook(gasket);
      const next = vi.fn();
      handler(makeError('server exploded', 500), makeReq(), {}, next);
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNr.noticeError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'server exploded' }),
        expect.objectContaining({ 'http.statusCode': 500, 'http.method': 'GET' })
      );
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('skips 4xx errors by default', async () => {
      const handler = await errorMiddlewareHook(makeGasket());
      const next = vi.fn();
      handler(makeError('not found', 404), makeReq(), {}, next);
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNr.noticeError).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('reports 4xx when ignore4xx=false', async () => {
      const handler = await errorMiddlewareHook(makeGasket({ errors: { ignore4xx: false } }));
      handler(makeError('bad request', 400), makeReq(), {}, vi.fn());
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNr.noticeError).toHaveBeenCalled();
    });

    it('fires nrError lifecycle before reporting', async () => {
      const gasket = makeGasket();
      const handler = await errorMiddlewareHook(gasket);
      handler(makeError('oops', 500), makeReq(), {}, vi.fn());
      await new Promise((r) => setTimeout(r, 10));
      expect(gasket.exec).toHaveBeenCalledWith('nrError', expect.any(Error), expect.any(Object));
      const execOrder = gasket.exec.mock.invocationCallOrder[0];
      const noticeOrder = mockNr.noticeError.mock.invocationCallOrder[0];
      expect(execOrder).toBeLessThan(noticeOrder);
    });
  });
});
