import { makeGasket } from '@gasket/core';
import pluginLogger from '@gasket/plugin-logger';
import pluginWinston from '@gasket/plugin-winston';
import pluginExpress from '@gasket/plugin-express';
import pluginHttps from '@gasket/plugin-https';
import pluginNewrelic from '@gasket/plugin-newrelic';
import routesExpress from './routes-express.js';

export default makeGasket({
  plugins: [
    pluginLogger,
    pluginWinston,
    pluginExpress,
    pluginHttps,
    pluginNewrelic,
    routesExpress
  ],
  newrelic: {
    // enabled auto-detected from NEW_RELIC_LICENSE_KEY
  },
  http: 3001  // different port so it can run alongside the Fastify app
});
