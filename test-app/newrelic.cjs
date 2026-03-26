'use strict';
// newrelic.cjs — loaded automatically by the NR agent at startup
require('dotenv').config();

exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'gasket-plugin-newrelic-express-test'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  logging: { level: process.env.NEW_RELIC_LOG_LEVEL || 'info' },
  distributed_tracing: { enabled: true },
  allow_all_headers: true,
  // Forward application logs to NR Log Management
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000
    },
    local_decorating: {
      // Stamps log lines with NR trace/span IDs for correlation
      enabled: true
    },
    metrics: {
      enabled: true
    }
  },
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization'
    ]
  }
};
