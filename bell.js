/**
 * Real-time anomalies detection for periodic time series.
 * Copyright (c) 2014 Eleme, Inc. https://github.com/eleme/bell.js
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
 * OR OTHER DEALINGS IN THE SOFTWARE.
 */


const fs = require('fs');
const co = require('co');
const program = require('commander');
const extend = require('extend');
const toml = require('toml');

const listener = require('./lib/listener');
const analyzer = require('./lib/analyzer');
const webapp = require('./lib/webapp');
const alerter = require('./lib/alerter');
const cleaner = require('./lib/cleaner');

const configs = require('./lib/configs');
const log = require('./lib/log');
const patterns = require('./lib/patterns');
const util = require('./lib/util');
const version = require('./package').version;

global.Promise = require('bluebird').Promise;

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
    var patterns_ = eval('_ = ' + patternsContent);
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
