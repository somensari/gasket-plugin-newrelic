/**
 * Returns `true` when the NR agent has enough configuration to start.
 *
 * Resolution order:
 *   1. `config.enabled === false` → always disabled
 *   2. `config.enabled === true`  → always enabled
 *   3. Otherwise → enabled when a license key is present (config or env var)
 *
 * @param {object} config - `newrelic` config block from gasket.js
 * @param {Record<string, string | undefined>} env - process.env
 * @returns {boolean}
 */
const isActive = (config, env) => {
  if (config.enabled === false) return false;
  if (config.enabled === true) return true;

  const licenseKey = config.licenseKey || env.NEW_RELIC_LICENSE_KEY;
  return Boolean(licenseKey);
};

/** @type {import('@gasket/core').HookHandler<'configure'>} */
export default function configure(gasket, config) {
  config.newrelic = config.newrelic || {};

  // eslint-disable-next-line no-process-env
  config.newrelic.enabled = isActive(config.newrelic, process.env);

  return { ...config };
}
