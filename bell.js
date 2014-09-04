/**
 * Realtime anomalies detection based on statsd, for periodic time series.
 * Copyright (c) 2014 Eleme, Inc. https://github.com/eleme/node-bell
 *
 * Usage: bell <service> [options]
 *
 * Options:
 *
 *   -h, --help            output usage information
 *   -V, --version         output the version number
 *   -c, --configs <c>     configs file path
 *   -l, --log-level <l>   logging level (1~5 for debug~critical)
 *   -s, --sample-configs  generate sample configs
 *
 * Data flow:
 *
 *  [statsd]
 *     |
 *     v        send to queue
 * [listener] -----------------> [beanstalkd]
 *                                   |
 *                                   | reserve
 *             history metrics       v     anomalies detected
 *             ---------------> [analyzers] ------------------
 *             |                     |                       |
 *             |                     | put to ssdb           |
 *             |                     v                       V
 *             ------------------- [ssdb]                [alerter]
 *                                   |
 *                                   v
 *                                [webapp]
 */


var fs = require('fs');
var co = require('co');
var program = require('commander');
var toml = require('toml');
var alerter = require('./lib/alerter');
var analyzer = require('./lib/analyzer');
var configs = require('./lib/configs');
var listener = require('./lib/listener');
var webapp = require('./lib/webapp');
var util = require('./lib/util');

var log = util.log;


co(function *(){
  // argv parsing
  program
  .version('0.2.9')
  .usage('<service> [options]')
  .option('-c, --configs-path <c>', 'configs file path')
  .option('-s, --sample-configs', 'generate sample configs file')
  .option('-l, --log-level <l>', 'logging level (1~5 for critical~debug)',
          function(val){return (parseInt(val, 10) - 1) % 5 + 1;})
  .parse(process.argv);

  log.level = util.logLevels[program.logLevel || 4];

  if (program.sampleConfigs) {
    log.info('Generate sample.configs.toml to current directory');
    return util.copy(util.path.configs, 'sample.configs.toml');
  }

  var configsPath = program.configsPath || util.path.configs;
  var content = fs.readFileSync(configsPath).toString();
  util.updateNestedObjects(configs, toml.parse(content));

  var name = program.args[0];

  if (!name) {
    // no service name
    program.help();
  }

  var service = {
    listener: listener,
    analyzer: analyzer,
    webapp: webapp,
    alerter: alerter
  }[name];

  if (!service) {
    // invalid service name
    program.help();
  }

  // run service
  yield service.serve();
})();
