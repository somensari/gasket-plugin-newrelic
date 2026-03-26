import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNr = {
  agent: {},
  setTransactionName: vi.fn()
};

vi.mock('newrelic', () => ({ default: mockNr }));

const { default: fastifyHook } = await import('../lib/fastify.js');

const makeGasket = () => ({
  logger: { warn: vi.fn(), info: vi.fn() }
});

/** Build a minimal mock Fastify app that captures registered hooks */
const makeApp = () => {
  const hooks = {};
  return {
    addHook: vi.fn((name, fn) => { hooks[name] = fn; }),
    _hooks: hooks
  };
};

describe('fastify hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNr.agent = {};
  });

  it('registers an onRequest hook', async () => {
    const app = makeApp();
    await fastifyHook(makeGasket(), app);
    expect(app.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
  });

  it('names the transaction from routeOptions.url (pattern)', async () => {
    const app = makeApp();
    await fastifyHook(makeGasket(), app);

    const req = { method: 'GET', routeOptions: { url: '/hello/:name' }, url: '/hello/adilson' };
    await app._hooks.onRequest(req);

    expect(mockNr.setTransactionName).toHaveBeenCalledWith('GET /hello/:name');
  });

  it('falls back to routerPath when routeOptions.url is absent', async () => {
    const app = makeApp();
    await fastifyHook(makeGasket(), app);

    const req = { method: 'POST', routerPath: '/users/:id', url: '/users/42' };
    await app._hooks.onRequest(req);

    expect(mockNr.setTransactionName).toHaveBeenCalledWith('POST /users/:id');
  });

  it('falls back to raw url when no route pattern is available', async () => {
    const app = makeApp();
    await fastifyHook(makeGasket(), app);

    const req = { method: 'GET', url: '/ping' };
    await app._hooks.onRequest(req);

    expect(mockNr.setTransactionName).toHaveBeenCalledWith('GET /ping');
  });

  it('skips registration and warns when agent is not loaded', async () => {
    mockNr.agent = null;
    const gasket = makeGasket();
    const app = makeApp();

    await fastifyHook(gasket, app);

    expect(app.addHook).not.toHaveBeenCalled();
    expect(gasket.logger.warn).toHaveBeenCalledWith(expect.stringContaining('NR agent not loaded'));
  });
});
