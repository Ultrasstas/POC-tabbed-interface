/**
 * Configs are in ./webpack
 */
switch (process.env.NODE_ENV) {
  case 'prod':
  case 'production':
    module.exports = require('./webpack/production.js');
    break;
  case 'dev':
  case 'development':
  default:
    module.exports = require('./webpack/development.js');
}
