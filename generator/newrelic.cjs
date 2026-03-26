'use strict';

// newrelic.cjs — New Relic agent configuration
// Docs: https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'my-gasket-app'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  logging: {
    level: 'info'
  },
  distributed_tracing: {
    enabled: true
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  }
};
