/**
 * Real-time anomalies detection for periodic time series.
 * MIT. Copyright (c) 2014 Eleme, Inc. https://github.com/eleme/bell.js
 */

'use strict';

const co      = require('co');
const fs      = require('fs');
const program = require('commander');
const log     = require('logging.js').get('bell');
const toml    = require('toml');
const configs = require('./lib/configs');
const util    = require('./lib/util');
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
  .option('-c, --configs-path <c>', 'configs file path')
  .option('-s, --sample-configs', 'generate sample configs file')
  .option('-l, --log-level <l>', 'log level (1~5 for debug~critical)', function(val) {
    return (parseInt(val, 10) - 1) % 5 + 1;
  })
  .parse(process.argv);

  //----------------------------------------------------
  // Initialize logging
  //----------------------------------------------------
  log.addRule({
    name: 'stdout',
    stream: process.stdout,
    level: (program.logLevel || 2) * 10
  });

  //----------------------------------------------------
  // Generate sample config file
  //----------------------------------------------------
  if (program.sampleConfigs) {
    log.info("Generate sample.configs.toml to current directory");
    return util.copy(util.path.configs, 'sample.configs.toml');
  }

  //----------------------------------------------------
  // Read configs
  //----------------------------------------------------
  configsPath = program.configsPath || util.path.configs;
  configsContent = fs.readFileSync(configsPath).toString();
  util.updateNestedObjects(configs, toml.parse(configsContent));

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
