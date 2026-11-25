'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    // Node side: CommonJS with the Node globals.
    files: [
      'server.js',
      'prompt.js',
      'demo-report.js',
      'offline.js',
      'scripts/**/*.js',
      'test/**/*.js',
      'eslint.config.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    // Browser side: classic scripts — the page bundle and the service worker.
    files: ['public/i18n.js', 'public/sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
];
