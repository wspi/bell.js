// Real-time anomalies detection for periodic time series.
// MIT. Copyright (c) 2014 Eleme, Inc. https://github.com/eleme/bell.js

'use strict';

const co        = require('co');
const fs        = require('fs');
const program   = require('commander');
const logging   = require('logging.js');
const toml      = require('toml');
const configs   = require('./lib/configs');
const util      = require('./lib/util');
const version   = require('./package').version;

const log       = logging.get('bell');
global.Promise  = require('bluebird').Promise;

co(function *() {
  // argv parsing
  program
    .version(version)
    .usage('<service> [options]')
    .option('-c, --configs-path <c>', 'configs file path')
    .option('-s, --sample-configs', 'generate sample configs file')
    .option('-l, --log-level <l>', 'logging level (1~5 for debug~critical)',
            function(val){return (parseInt(val, 10) - 1) % 5 + 1;})
    .parse(process.argv);

  // init logging
  log.addRule({name: 'stdout', stream: process.stdout,
              level: (program.logLevel || 2) * 10});

  if (program.sampleConfigs) {
    log.info('Generate sample.configs.toml to current directory');
    return util.copy(util.path.configs, 'sample.configs.toml');
  }

  // update configs
  var configsPath = program.configsPath || util.path.configs;
  var configsContent = fs.readFileSync(configsPath).toString();
  util.updateNestedObjects(configs, toml.parse(configsContent));

  var name = program.args[0];

  if (!name) {
    // no service name
    program.help();
  }

  var service = {
    listener: require('./lib/listener'),
    analyzer: require('./lib/analyzer'),
    webapp  : require('./lib/webapp'),
    alerter : require('./lib/alerter'),
    cleaner : require('./lib/cleaner'),
  }[name];

  if (!service) {
    // invalid service name
    program.help();
  }

  // run service
  yield service.serve();
}).catch(function(err) {
  throw err;
});
