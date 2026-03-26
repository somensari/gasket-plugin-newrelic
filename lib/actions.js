import { withGasketRequestCache } from '@gasket/request';

/**
 * Get the current New Relic transaction for a request.
 *
 * The NR agent must be loaded before this runs via
 * `NODE_OPTIONS=--import=./setup.js`. If the agent is not loaded,
 * returns `undefined` without throwing.
 *
 * Also fires the `nrTransaction` lifecycle so other plugins can
 * decorate the transaction with custom attributes.
 *
 * @type {import('@gasket/core').ActionHandler<'getNrTransaction'>}
 */
export const getNrTransaction = withGasketRequestCache(
  async function getNrTransaction(gasket, req) {
    const nr = await import('newrelic').then((m) => m.default || m).catch(() => null);

    // `nr.agent` is present when the agent initialised successfully.
    if (!nr?.agent) {
      return;
    }

    const transaction = nr.getTransaction?.();
    if (!transaction) return;

    await gasket.exec('nrTransaction', transaction, { req });

    return transaction;
  }
);
