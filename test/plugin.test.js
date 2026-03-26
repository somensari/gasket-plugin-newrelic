/**
 * Plugin shape tests — per authoring-plugins guidelines, verify the plugin
 * export has the correct structure, hooks the expected lifecycles, and each
 * timed hook carries the right timing config.
 */
import { describe, it, expect } from 'vitest';
import plugin from '../lib/index.js';

describe('plugin shape', () => {
  it('exports name, version, description', () => {
    expect(typeof plugin.name).toBe('string');
    expect(plugin.name).toBe('@gasket/plugin-newrelic');
    expect(typeof plugin.version).toBe('string');
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof plugin.description).toBe('string');
    expect(plugin.description.length).toBeGreaterThan(0);
  });

  it('hooks all expected lifecycles', () => {
    const hooks = Object.keys(plugin.hooks);
    expect(hooks).toContain('configure');
    expect(hooks).toContain('create');
    expect(hooks).toContain('fastify');
    expect(hooks).toContain('express');
    expect(hooks).toContain('errorMiddleware');
    expect(hooks).toContain('metadata');
  });

  it('exports getNrTransaction action', () => {
    expect(typeof plugin.actions?.getNrTransaction).toBe('function');
  });

  describe('hook timing', () => {
    it('fastify runs first — must name transactions before route plugins register routes', () => {
      expect(plugin.hooks.fastify.timing?.first).toBe(true);
      expect(typeof plugin.hooks.fastify.handler).toBe('function');
    });

    it('express runs first — naming middleware must be front of Express stack', () => {
      expect(plugin.hooks.express.timing?.first).toBe(true);
      expect(typeof plugin.hooks.express.handler).toBe('function');
    });

    it('errorMiddleware runs last — must be final error handler in Express chain', () => {
      expect(plugin.hooks.errorMiddleware.timing?.last).toBe(true);
      expect(typeof plugin.hooks.errorMiddleware.handler).toBe('function');
    });

    it('configure has no timing constraint (order-independent)', () => {
      // configure is a plain function, not a timing object
      expect(typeof plugin.hooks.configure).toBe('function');
    });
  });

  describe('metadata hook', () => {
    it('returns enriched meta with actions, configurations, and lifecycles', () => {
      const meta = plugin.hooks.metadata({}, {});
      expect(Array.isArray(meta.actions)).toBe(true);
      expect(Array.isArray(meta.configurations)).toBe(true);
      expect(Array.isArray(meta.lifecycles)).toBe(true);
    });

    it('documents getNrTransaction action', () => {
      const { actions } = plugin.hooks.metadata({}, {});
      expect(actions.some((a) => a.name === 'getNrTransaction')).toBe(true);
    });

    it('documents nrTransaction and nrError lifecycles', () => {
      const { lifecycles } = plugin.hooks.metadata({}, {});
      const names = lifecycles.map((l) => l.name);
      expect(names).toContain('nrTransaction');
      expect(names).toContain('nrError');
    });

    it('documents newrelic config options including errors.*', () => {
      const { configurations } = plugin.hooks.metadata({}, {});
      const names = configurations.map((c) => c.name);
      expect(names).toContain('newrelic');
      expect(names).toContain('newrelic.enabled');
      expect(names).toContain('newrelic.errors.ignore4xx');
      expect(names).toContain('newrelic.errors.ignore5xx');
    });
  });
});
