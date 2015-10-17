/**
 * @overview  Bell analyzer service.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const co = require('co');
const cluster = require('cluster');
const net = require('net');
const config = require('./config');
const log = require('./log');
const protocol = require('./protocol');
const service = require('./service');
const util = require('./util');

/**
 * Service analyzer
 */
function Analyzer() {
  this.name = 'analyzer';
}
util.inherits(Analyzer, service);

/**
 * Analyzer service entry:
 *
 *   * In master, fork workers
 *   * In worker, init clients and do work.
 */
Analyzer.prototype.serve = function *() {
  var i, worker;

  if (cluster.isMaster) {
    for (i = 0; i < config.analyzer.workers; i++) {
      worker = cluster.fork();
      log.info("forked worker process: %d", worker.process.pid);
    }
  } else {
    this.createSsdbPool();
    this.createBeansClient();
    yield this.connectBeans('watch');
    yield this.work();
  }
};

/**
 * Reserve job from beanstalk and do work.
 */
Analyzer.prototype.work = function *() {
  var self = this;
  var job = yield this.beans._reserve();
  var datapoint = JSON.parse(job.body);
  var startAt = new Date();
  var result = yield this.analyze(datapoint);
  var name = result[0];
  var key = result[1];
  var endAt = new Date();

  log.info("%dms analyzed %s: %s", endAt - startAt, name, key);

  this.beans.destroy(job.id, function(){});

  process.nextTick(co.wrap(function *() {
    yield self.work();
  }));
};

/**
 * Analyze current datapoint, return the array of metric name
 * and zset key.
 *
 * @param {Array} datapoint // [name, [time, val]]
 * @return {Array} // [name, key]
 */
Analyzer.prototype.analyze = function *(datapoint) {
  var name = datapoint[0];
  var time = +datapoint[1][0];
  var data = +datapoint[1][1];

  datapoint = [name, [time, data]];

  var history = yield this.query(datapoint);
  var multi = this.div3sigma(history[1]);
  var trend = this.trend(history[0], multi);

  datapoint[1].push(multi);

  var key = yield this.save(datapoint, trend);

  if (Math.abs(multi) > 1) {
    this.alert(datapoint, trend);
  }
  return [name, key];
};

/**
 * Query history data, include history datapoints & current
 * trend.
 *
 * @param {Array} datapoint [name, [time, val]]
 * @return {Array} // [trend, datapoint..]
 *
 * - trend
 *    {Number} if current is not defined yet, undefined
 * - series
 *    {Array}  // array of numbers
 */
Analyzer.prototype.query = function *(datapoint) {
  //----------------------------------------------------
  // Vars definitions
  //----------------------------------------------------
  var name = datapoint[0];
  var time = datapoint[1][0];
  var data = datapoint[1][1];

  var offset = config.analyzer.filterOffset;
  var period = config.analyzer.periodicity;
  var expiration = config.analyzer.expiration;
  var prefix = config.ssdb.prefix;
  var span = offset * period;

  var reqs = [];

  //----------------------------------------------------
  // Query trending
  //----------------------------------------------------
  var hash = prefix + 'trend';
  reqs.push(this.ssdb.acquire().hget(hash, name));

  //----------------------------------------------------
  // Query history data
  //----------------------------------------------------
  var now = time;
  var zset = prefix + name;
  var start, stop;

  while(now - time < expiration) {
    start = time - span;
    stop = time + span;
    reqs.push(this.ssdb.acquire().zkeys(zset, '', start, stop, -1));
    time -= period;
  }

  var chunks = yield reqs;

  //----------------------------------------------------
  // Build trending
  //----------------------------------------------------
  var trend = NaN;
  var first = chunks.shift();

  if (typeof first === 'string' || first instanceof String) {
    trend = +(first.split(':')[0]);
  }

  //----------------------------------------------------
  // Build series
  //----------------------------------------------------
  // chain chunks into keys (raw string array)
  var keys = [], i;

  for (i = chunks.length - 1; i >= 0; i--) {
    [].push.apply(keys, chunks[i]);
  }

  // collect values
  var series = [];

  for (i = 0; i < keys.length; i++) {
    series.push(+keys[i].split(':')[0]);
  }

  series.push(data);
  return [trend, series];
};

/**
 * Compute next trend via wma, called the weighted moving
 * average algorithm:
 *
 *   t[0] = x[1], factor: 0~1
 *   t[n] = t[n-1] * (1 - factor) + factor * x[n]
 *
 * @param {Number} last  // last trend
 * @param {Number} data  // current data
*/
Analyzer.prototype.trend = function(last, data) {
  if (isNaN(last)) {
    // set current data as first trend
    return data;
  }

  var factor = config.analyzer.trendingFactor;
  return last * (1 - factor) + factor * data;
};


/**
 * Compute the 3-sigma multiples, also like the z-score.
 *
 * What's 3-sigma:
 *
 *   states that nearly all values(99.7%) lie within 3 standard
 *   deviations of the mean in a normal distribution.
 *
 * What's z-score:
 *
 *   (val - mean) / stddev
 *
 * Return the multiples of the deviation to 3 * sigma, or
 * called 1/3 zscore.
 */
Analyzer.prototype.div3sigma = function(series) {
  var strict = config.analyzer.strict;
  var startSize = config.analyzer.startSize;

  if (series.length < startSize) {
    return 0;
  }

  // use the last if strict mode, else the mean of last 3 members
  var tail;

  if (strict) {
    tail = series.slice(-1)[0];
  } else {
    tail = new util.ReadOnlyArray(series.slice(-3)).mean();
  }

  var arr = new util.ReadOnlyArray(series);
  var mean = arr.mean();
  var std = arr.std();

  if (std === 0) {
    return tail - mean === 0 ? 0 : 1;
  }

  return (tail - mean) / (3 * std);
};

/**
 * Save datapoint & trend to database
 * @param {Array} datapoint // [name, [time, val, multi]]
 */

Analyzer.prototype.save = function *(datapoint, trend) {
  var name = datapoint[0];
  var time = datapoint[1][0];
  var data = datapoint[1][1];
  var multi = datapoint[1][2];

  var prefix = config.ssdb.prefix;
  var expiration = config.analyzer.expiration;

  var zset = prefix + name;
  var hash = prefix + 'trend';
  var key = [data, multi.toFixed(4), time].join(':');
  var val = [trend.toFixed(4), time].join(':');

  // parallel write db
  var resps = yield [
    this.ssdb.acquire().zset(zset, key, time),
    this.ssdb.acquire().zremrangebyscore(zset, 0, time - expiration),
    this.ssdb.acquire().hset(hash, name, val)
  ];

  return key;
};

/**
 * Connect to alerter service.
 * @param {Function} callback // function() {}
 * @return {Analyzer} // this
 */
Analyzer.prototype.connectAlerter = function(callback) {
  var self = this;
  var port = config.alerter.port;
  var host = config.alerter.host;

  this.alerterConn = net.connect({port: port, host: host}, function() {
    callback();
  })
  .on('error', function(e) {
    log.warn('alerter may not be up on %s:%d, %s',
             host, port, e);
    self.alerterConn.destroy();
    self.alerterConn = undefined;
  });

  return this;
};

/**
 * Send anomalous datapoint & trend to alerter
 * @param {Array} datapoint // [name, [time, value, multi]]
 */
Analyzer.prototype.alert = function(datapoint, trend) {
  var self = this, buffer;
  if (!this.alerterConn) {
    this.connectAlerter(function(){
      self.alert(datapoint, trend);
    });
  } else {
    buffer = protocol.encode([datapoint, trend]);
    this.alerterConn.write(buffer, 'utf8', function(){
      log.info('send to alerter: %s', [datapoint, trend]);
    });
  }
};

module.exports = new Analyzer();
