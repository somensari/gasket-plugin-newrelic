import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the newrelic module before importing actions
const mockTransaction = { name: 'WebTransaction/test', id: 'txn-123' };

const mockNr = {
  agent: {},  // presence = agent loaded successfully
  getTransaction: vi.fn(() => mockTransaction)
};

vi.mock('newrelic', () => ({ default: mockNr }));

// Re-import after mock is set up
const { getNrTransaction } = await import('../lib/actions.js');

const makeGasket = (overrides = {}) => ({
  exec: vi.fn(async () => {}),
  logger: { warn: vi.fn(), info: vi.fn() },
  ...overrides
});

describe('getNrTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNr.agent = {};
    mockNr.getTransaction.mockReturnValue(mockTransaction);
  });

  it('returns the current NR transaction', async () => {
    const gasket = makeGasket();
    const req = { headers: {} };
    const result = await getNrTransaction(gasket, req);
    expect(result).toBe(mockTransaction);
  });

  it('fires the nrTransaction lifecycle with transaction and req', async () => {
    const gasket = makeGasket();
    const req = { headers: {}, url: '/test' };
    await getNrTransaction(gasket, req);
    expect(gasket.exec).toHaveBeenCalledWith('nrTransaction', mockTransaction, expect.objectContaining({ req: expect.anything() }));
  });

  it('returns undefined when agent is not loaded', async () => {
    mockNr.agent = null;
    const gasket = makeGasket();
    const result = await getNrTransaction(gasket, { headers: {} });
    expect(result).toBeUndefined();
    expect(gasket.exec).not.toHaveBeenCalled();
  });

  it('returns undefined when no active transaction', async () => {
    mockNr.getTransaction.mockReturnValue(null);
    const gasket = makeGasket();
    const result = await getNrTransaction(gasket, { headers: {} });
    expect(result).toBeUndefined();
    expect(gasket.exec).not.toHaveBeenCalled();
  });
});
