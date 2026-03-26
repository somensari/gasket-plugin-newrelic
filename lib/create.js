import packageJson from '../package.json' with { type: 'json' };
const { name, version, devDependencies } = packageJson;

/**
 * Scaffolds New Relic setup files for new Gasket apps:
 *   - `setup.js`     — imports the NR agent at process startup
 *   - `newrelic.cjs` — NR agent configuration (CommonJS, read by agent)
 *
 * Also prepends `NODE_OPTIONS=--import=./setup.js` to the start script
 * so the agent is always loaded before any other module.
 *
 * @type {import('@gasket/core').HookHandler<'create'>}
 */
export default function create(gasket, { pkg, files, gasketConfig }) {
  const generatorDir = new URL('../generator', import.meta.url).pathname;

  gasketConfig.addPlugin('pluginNewrelic', name);

  pkg.add('dependencies', {
    [name]: `^${version}`,
    newrelic: devDependencies.newrelic
  });

  // Prepend the --import flag so NR patches Node internals before ESM loads.
  pkg.extend((current) => {
    return {
      scripts: {
        start: `NODE_OPTIONS=--import=./setup.js ${current.scripts.start}`
      }
    };
  });

  files.add(`${generatorDir}/*`);
}
