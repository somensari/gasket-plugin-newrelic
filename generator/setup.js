// setup.js — must be loaded before anything else via NODE_OPTIONS=--import=./setup.js
// This ensures the New Relic agent patches Node internals at startup.
import 'newrelic';
