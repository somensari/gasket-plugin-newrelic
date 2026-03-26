import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import configure from '../lib/configure.js';

const makeGasket = () => ({});

describe('configure', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
  });

  afterEach(() => {
    // restore env
    Object.keys(process.env).forEach((k) => {
      if (!(k in savedEnv)) delete process.env[k];
    });
    Object.assign(process.env, savedEnv);
  });

  it('defaults newrelic to empty object if not set', () => {
    delete process.env.NEW_RELIC_LICENSE_KEY;
    const result = configure(makeGasket(), {});
    expect(result.newrelic).toBeDefined();
  });

  it('sets enabled=false when no license key is present', () => {
    delete process.env.NEW_RELIC_LICENSE_KEY;
    const result = configure(makeGasket(), {});
    expect(result.newrelic.enabled).toBe(false);
  });

  it('sets enabled=true when NEW_RELIC_LICENSE_KEY env var is present', () => {
    process.env.NEW_RELIC_LICENSE_KEY = 'test-key-abc';
    const result = configure(makeGasket(), {});
    expect(result.newrelic.enabled).toBe(true);
  });

  it('sets enabled=true when licenseKey is in config', () => {
    delete process.env.NEW_RELIC_LICENSE_KEY;
    const result = configure(makeGasket(), { newrelic: { licenseKey: 'config-key' } });
    expect(result.newrelic.enabled).toBe(true);
  });

  it('respects enabled=false override even with license key', () => {
    process.env.NEW_RELIC_LICENSE_KEY = 'test-key-abc';
    const result = configure(makeGasket(), { newrelic: { enabled: false } });
    expect(result.newrelic.enabled).toBe(false);
  });

  it('respects enabled=true override even without license key', () => {
    delete process.env.NEW_RELIC_LICENSE_KEY;
    const result = configure(makeGasket(), { newrelic: { enabled: true } });
    expect(result.newrelic.enabled).toBe(true);
  });

  it('does not mutate original config', () => {
    const config = { someOtherKey: 'value' };
    const result = configure(makeGasket(), config);
    expect(result).not.toBe(config);
    expect(result.someOtherKey).toBe('value');
  });
});
