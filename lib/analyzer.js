/**
 * Analyze incoming datapoints from beanstalkd and store
 * results into ssdb
 */

const co = require('co');
const cluster = require('cluster');
const net = require('net');
const inherits = require('util').inherits;

const configs = require('./configs');
const log = require('./log');
const protocol = require('./protocol');
const service = require('./service');
const array = require('./util').array;


/**
 * @constructor
 */
function Analyzer() {}
inherits(Analyzer, service);


/**
 * Beanstalk evented
 */
Analyzer.prototype.serve = function *() {
  if (cluster.isMaster) {
    for (var i = 0; i < configs.analyzer.workers; i++) {
      var worker = cluster.fork();
      log.info('Forked worker process: %d', worker.process.pid);
    }
  } else {
    var self = this;

    this.createSsdbClient()
    .createBeansClient()
    ;

    yield this.connectBeans('watch');

    yield this.work();
  }
};


/**
 * Do analyze work (recursely)
 */
Analyzer.prototype.work = function *() {
  var job = yield this.beans._reserve();
  log.debug('Reserved job: %d', job.id);
  var datapoint = JSON.parse(job.body);
  var startAt = new Date();
  var result = yield this.analyze(datapoint);
  var name = result[0];
  var key = result[1];
  var endAt = new Date();
  log.info('Analyzed (%dms) %s: %s', endAt - startAt, name, key);
  this.beans.destroy(job.id, function(){});
  log.debug('Completed job: %d', job.id);

  var self = this;
  process.nextTick(co.wrap(function *() {
    yield self.work();
  }));
};


/**
 * Analyze current datapoint, return the array of metric name and zset key.
 *
 * @param {Array} datapoint  // [name, [time, val]]
 * @return {Array}   // [name, key]
 */
Analyzer.prototype.analyze = function *(datapoint) {
  var name = datapoint[0];
  var time = +datapoint[1][0];
  var data = +datapoint[1][1];
  datapoint = [name, [time, data]];
  // get history trend & datapoints, [trend, series]
  var history = yield this.query(datapoint);
  // compute the multiples (like zscore)
  var multi = this.div3sigma(history[1]);
  // compute trend
  var trend = this.trend(history[0], multi);
  // update datapoint with multi & trend
  datapoint[1].push(multi);
  // save to db
  var key = yield this.save(datapoint, trend);
  // send to alerter
  if (Math.abs(multi) > 1) {
    this.alert(datapoint, trend);
  }
  return [name, key];
};


/**
 * Query history data, include history datapoints & current trend
 *
 * trend
 *   * {Number} if current is not defined yet, undefined
 *
 * series
 *   * {Array}  // array of numbers
 *
 * @param {Array} datapoint
 * @return {Array}  // [trend, [datapoint..]]
 */
Analyzer.prototype.query = function *(datapoint) {
  var name = datapoint[0];
  var time = datapoint[1][0];
  var data = datapoint[1][1];

  var offset = configs.analyzer.filter.offset;
  var period = configs.analyzer.filter.periodicity;
  var prefix = configs.ssdb.prefix;
  var expire = configs.ssdb.zset.expire;
  var span = offset * period;

  var reqs = [];

  /**
   * query current trend
   */
  var hash = prefix + 'trend';
  reqs.push(this.ssdb.hget(hash, name));

  /**
   * query history datapoints
   */
  var now = time;
  var zset = prefix + name;

  while(now - time < expire) {
    var start = time - span;
    var stop = time + span;
    reqs.push(this.ssdb.zkeys(zset, '', start, stop, -1));
    time -= period;
  }

  /**
   * execute requests
   */
  var chunks = yield reqs;

  /**
   * the current trend
   *
   * bell.trend, hashmap, name => trend:timestamp
   */
  var trend = NaN;
  var first = chunks.shift();

  if (typeof first === 'string' || first instanceof String) {
    trend = +(first.split(':')[0]);
  }


  /**
   * the history datapoints
   */
  var keys = [];

  // chain chunks into series
  for (var i = chunks.length - 1; i >= 0; i--) {
    Array.prototype.push.apply(keys, chunks[i]);
  }

  // collect values
  var series = [];

  for (i = 0; i < keys.length; i++) {
    series.push(+keys[i].split(':')[0]);
  }
  // push current data to series
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
 * @return {Number}
 */
Analyzer.prototype.trend = function(last, data) {
  if (isNaN(last)) {
    // set current data as first trend
    return data;
  }

  var factor = configs.analyzer.trending.factor;
  return last * (1 - factor) + factor * data;
};


/**
 * Compute the 3-sigma multiples, also like the z-score;
 *
 * What's 3-sigma?
 *
 *   => states that nearly all values(99.7%) lie within 3 standard deviations
 *   of the mean in a normal distribution.
 *
 * What's z-score?
 *
 *   => (val - mean) / stddev
 * Return the multiples of the deviation to 3 * sigma, or called 1/3 zscore.
 *
 * @param {Array} series
 * @return {Number}
 */
Analyzer.prototype.div3sigma = function(series) {
  var strict = configs.analyzer.strict;
  var minSize = configs.analyzer.minSize;

  if (series.length < minSize) {
    return 0;
  }

  // use the last if strict mode, else the mean of last 3 members
  var tail;

  if (strict) {
    tail = series.slice(-1)[0];
  } else {
    tail = array(series.slice(-3)).mean();
  }

  var arr = array(series);
  var mean = arr.mean();
  var std = arr.std();

  if (std === 0) {
    return tail - mean === 0 ? 0 : 1;
  }

  return (tail - mean) / (3 * std);
};


/**
 * Save datapoint & trend to database
 *
 * @param {Array} datapoint  // [name, [time, val, multi]]
 * @param {Number} trend
 */
Analyzer.prototype.save = function *(datapoint, trend) {
  var name = datapoint[0];
  var time = datapoint[1][0];
  var data = datapoint[1][1];
  var multi = datapoint[1][2];

  var prefix = configs.ssdb.prefix;
  var expire = configs.ssdb.zset.expire;

  var zset = prefix + name;
  var hash = prefix + 'trend';
  // zset key
  var key = [data, multi.toFixed(4), time].join(':');
  // hash val
  var val  = [trend.toFixed(4), time].join(':');

  // parallel write db
  var resps = yield [
    this.ssdb.zset(zset, key, time),
    this.ssdb.zremrangebyscore(zset, 0, time - expire),
    this.ssdb.hset(hash, name, val)
  ];

  log.debug('ssdb resps: %s', resps);
  return key;
};


/**
 * Connect to alerter
 */
Analyzer.prototype.connectAlerter = function(callback) {
  var self = this;
  var port = configs.alerter.port;
  var host = configs.alerter.host;
  this.alerterConn = net.connect({port: port, host: host}, function(){
    log.debug('Connected to alerter');
    callback();
  }).on('error', function(err) {
    log.warn('Socket error, alerter may not be up on %s:%d', host, port);
    self.alerterConn.destroy();
    self.alerterConn = undefined;
  });
  return this;
};


/**
 * Send anomalous datapoint & trend to alerter
 * @param {Array} datapoint // [name, [time, value, multi]]
 * @param {Number} trend
 */
Analyzer.prototype.alert = function(datapoint, trend) {
  if (!this.alerterConn) {
    var self = this;
    this.connectAlerter(function(){
      // re-alert on connect
      self.alert(datapoint, trend);
    });
  } else {
    var buffer = protocol.encode([datapoint, trend]);
    this.alerterConn.write(buffer, 'utf8', function(){
      log.info('Send to alerter: %s', [datapoint, trend]);
    });
  }
};

exports = module.exports = new Analyzer();
