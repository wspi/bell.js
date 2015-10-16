/**
 * @overview  Real-time anomalies detection for periodic time series.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const co      = require('co');
const program = require('commander');
const config  = require('./lib/config');
const log     = require('./lib/log');
const version = require('./package').version;

global.Promise = require('bluebird').Promise;

co(function *() {
  var configsPath,
      configsContent,
      serviceName,
      service;

  //----------------------------------------------------
  // Parse command line arguments
  //----------------------------------------------------
  program
  .version(version)
  .usage('<service> [options]')
  .option('-c, --config-path <c>', 'config file path [optional]')
  .option('-l, --log-level <l>', 'log level (e.g. debug, info..)',
          function(l) { return log[l.toUpperCase()]; }, log.INFO)
  .parse(process.argv);

  //----------------------------------------------------
  // Initialize logging
  //----------------------------------------------------
  log.level = program.logLevel;

  //----------------------------------------------------
  // Read configs
  //----------------------------------------------------
  config.init(program.configPath);

  //----------------------------------------------------
  // Start service
  //----------------------------------------------------
  serviceName = program.args[0];

  if (!serviceName) {
    program.help();
  }

  service = {
    listener: require('./lib/listener'),
    analyzer: require('./lib/analyzer'),
    webapp:   require('./lib/webapp'),
    alerter:  require('./lib/alerter'),
    cleaner:  require('./lib/cleaner')
  }[serviceName];

  if (!service) {
    program.help();
  }

  yield service.serve();
}).catch(function(err) {
  throw err;
});
