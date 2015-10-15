/**
 * @overview    Runtime configurations with default values.
 * @author      Chao Wang (hit9)
 * @copyright   2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const assert  = require('assert');
const events  = require('events');
const fs      = require('fs');
const logging = require('logging.js');
const util    = require('./util');
const log     = logging.get('bell.config');
const config  = module.exports = {
  interval: 10,
  autoReload: true,

  beanstalkd: {
    host: '0.0.0.0',
    port: 11300,
    tube: 'bell'
  },

  ssdb: {
    host: '0.0.0.0',
    port: 8888,
    auth: null,
    size: 6,
    prefix: 'bell.'
  },

  listener: {
    port: 2015,
    whitelist: ['*'],
    blacklist: ['statsd.*'],
  },

  analyzer: {
    workers: 4,
    strict: true,
    startSize: 50,
    periodicity: 24*3600,
    expiration: 5*24*3600,
    filterOffset: 0.01,
    trendingFactor: 0.1,
  },

  webapp: {
    port: 2016,
    workers: 2,
    root: null,
  },

  cleaner: {
    interval: 10*60,
    threshold: 2*24*3600,
  },

  alerter: {
    host: '0.0.0.0',
    port: 2017,
  }
};

/**
 * Init config with config file path.
 *
 * @param {String} file
 */
config.init = function(file) {
  if (file) {
    if (!config._file)
      config._file = file;

    config.reload();

    util.fileOnChanges(config._file, function() {
      if (config.autoReload)
        config.reload();
    });
  } else {
    log.warn("using default config..");
  }
};

/**
 * Reload config file.
 */
config.reload = function() {
  assert(config._file);
  log.info("reading config from %s", config._file);
  var conf = util.loadObjectFromPath(config._file);
  util.updateNestedObjects(config, conf);
  config.emitter.emit('reload');
};

config.emitter = new events.EventEmitter();
