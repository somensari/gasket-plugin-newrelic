import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNr = {
  agent: {},
  noticeError: vi.fn()
};

vi.mock('newrelic', () => ({ default: mockNr }));

const { default: errorHook } = await import('../lib/error.js');

const makeGasket = (newrelicConfig = {}) => ({
  config: { newrelic: newrelicConfig },
  exec: vi.fn(async () => {}),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
});

const makeApp = () => {
  const hooks = {};
  return {
    addHook: vi.fn((name, fn) => { hooks[name] = fn; }),
    _hooks: hooks
  };
};

const makeReq = (overrides = {}) => ({
  method: 'GET',
  url: '/test',
  routeOptions: { url: '/test' },
  id: 'req-1',
  ...overrides
});

const makeError = (msg = 'boom', statusCode = 500) => {
  const err = new Error(msg);
  err.statusCode = statusCode;
  return err;
};

describe('error hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNr.agent = {};
  });

  it('registers an onError hook on the Fastify app', async () => {
    const app = makeApp();
    await errorHook(makeGasket(), app);
    expect(app.addHook).toHaveBeenCalledWith('onError', expect.any(Function));
  });

  it('calls nr.noticeError for 5xx errors', async () => {
    const app = makeApp();
    const gasket = makeGasket();
    await errorHook(gasket, app);

    const error = makeError('server exploded', 500);
    await app._hooks.onError(makeReq(), {}, error);

    expect(mockNr.noticeError).toHaveBeenCalledWith(error, expect.objectContaining({
      'http.statusCode': 500,
      'http.method': 'GET',
      'http.route': '/test'
    }));
  });

  it('skips 4xx errors by default (ignore4xx=true)', async () => {
    const app = makeApp();
    await errorHook(makeGasket(), app);

    await app._hooks.onError(makeReq(), {}, makeError('not found', 404));

    expect(mockNr.noticeError).not.toHaveBeenCalled();
  });

  it('reports 4xx when ignore4xx=false', async () => {
    const app = makeApp();
    await errorHook(makeGasket({ errors: { ignore4xx: false } }), app);

    await app._hooks.onError(makeReq(), {}, makeError('bad request', 400));

    expect(mockNr.noticeError).toHaveBeenCalled();
  });

  it('skips 5xx when ignore5xx=true', async () => {
    const app = makeApp();
    await errorHook(makeGasket({ errors: { ignore5xx: true } }), app);

    await app._hooks.onError(makeReq(), {}, makeError('server error', 500));

    expect(mockNr.noticeError).not.toHaveBeenCalled();
  });

  it('fires the nrError lifecycle before reporting', async () => {
    const app = makeApp();
    const gasket = makeGasket();
    await errorHook(gasket, app);

    const error = makeError('oops', 500);
    await app._hooks.onError(makeReq(), {}, error);

    expect(gasket.exec).toHaveBeenCalledWith('nrError', error, expect.any(Object));
    // lifecycle fires before noticeError
    const execOrder = gasket.exec.mock.invocationCallOrder[0];
    const noticeOrder = mockNr.noticeError.mock.invocationCallOrder[0];
    expect(execOrder).toBeLessThan(noticeOrder);
  });

  it('skips registration and warns when agent not loaded', async () => {
    mockNr.agent = null;
    const gasket = makeGasket();
    const app = makeApp();

    await errorHook(gasket, app);

    expect(app.addHook).not.toHaveBeenCalled();
    expect(gasket.logger.warn).toHaveBeenCalledWith(expect.stringContaining('NR agent not loaded'));
  });
});
