// Real-time anomalies detection for periodic time series.
// MIT. Copyright (c) 2014 Eleme, Inc. https://github.com/eleme/bell.js

'use strict';

const co        = require('co');
const fs        = require('fs');
const extend    = require('extend');
const program   = require('commander');
const toml      = require('toml');
const configs   = require('./lib/configs');
const log       = require('./lib/log');
const patterns  = require('./lib/patterns');
const util      = require('./lib/util');
const version   = require('./package').version;

global.Promise  = require('bluebird').Promise;

const listener  = require('./lib/listener');
const analyzer  = require('./lib/analyzer');
const webapp    = require('./lib/webapp');
const alerter   = require('./lib/alerter');
const cleaner   = require('./lib/cleaner');

co(function *() {
  // argv parsing
  program
    .version(version)
    .usage('<service> [options]')
    .option('-c, --configs-path <c>', 'configs file path')
    .option('-s, --sample-configs', 'generate sample configs file')
    .option('-l, --log-level <l>', 'logging level (1~5 for debug~fatal)',
            function(val){return (parseInt(val, 10) - 1) % 5 + 1;})
    .parse(process.argv);

  log.name = 'bell';
  log.level = program.logLevel || 2;

  if (program.sampleConfigs) {
    log.info('Generate sample.configs.toml to current directory');
    return util.copy(util.path.configs, 'sample.configs.toml');
  }

  // update configs
  var configsPath = program.configsPath || util.path.configs;
  var configsContent = fs.readFileSync(configsPath).toString();
  util.updateNestedObjects(configs, toml.parse(configsContent));

  // update patterns
  if (configs.patterns.length > 0) {
    var patternsContent = fs.readFileSync(configs.patterns);
    var patterns_ = eval('var _; _ = ' + patternsContent);
    // clear default object `patterns`
    for (var key in patterns) delete patterns[key];
    extend(patterns, patterns_);
  }

  var name = program.args[0];

  if (!name) {
    // no service name
    program.help();
  }

  var service = {
    listener: listener,
    analyzer: analyzer,
    webapp: webapp,
    alerter: alerter,
    cleaner: cleaner,
  }[name];

  if (!service) {
    // invalid service name
    program.help();
  }

  // set log name
  log.name = 'bell.' + name;
  // run service
  yield service.serve();
}).catch(function(err) {
  util.fatal('Fatal error: %s', err.stack);
});
