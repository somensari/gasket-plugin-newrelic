import { makeGasket } from '@gasket/core';
import pluginLogger from '@gasket/plugin-logger';
import pluginWinston from '@gasket/plugin-winston';
import pluginFastify from '@gasket/plugin-fastify';
import pluginHttps from '@gasket/plugin-https';
import pluginNewrelic from '@gasket/plugin-newrelic';
import routes from './routes.js';

export default makeGasket({
  plugins: [
    pluginLogger,
    pluginWinston,
    pluginFastify,
    pluginHttps,
    pluginNewrelic,
    routes
  ],
  newrelic: {
    // enabled is auto-detected from NEW_RELIC_LICENSE_KEY in .env
  },
  http: 3000
});
