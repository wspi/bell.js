/**
 * Analyze incoming metrics from beanstalkd and store results into ssdb
 */

var net = require('net');
var inherits = require('util').inherits;
var configs = require('./configs');
var service = require('./service');
var log = require('./util').log;
var array = require('./util').array;


/**
 * analyzer, beanstalk evented
 */

function Analyzer() {}
inherits(Analyzer, service);


/**
 * serve forever
 */
Analyzer.prototype.serve = function *() {
  var self = this;

  this.connectAlerter()
  .createSsdbClient()
  .createBeansClient();

  yield this.connectBeans('watch');

  // fivebeans requires a function for `destroy`
  var beansDelCb = function() {};

  while (1) {
    var job = yield this.beans._reserve();
    log.debug('Reserved job: %d', job.id);
    var datapoint = JSON.parse(job.body);
    // measure time duration
    var start = new Date();
    var result = yield this.analyze(datapoint);
    var name = result[0], key = result[1];
    var end = new Date();
    log.info('Analyzed (%dms) %s: %s', end - start,
             name, key);
    this.beans.destroy(job.id, beansDelCb);
    log.debug('Completed job: %d', job.id);
  }
};


/**
 * analyze current datapoint, return the array of metric
 * name and zset key.
 *
 * @param {Array} datapoint
 * @return {Array} [name, key]
 */
Analyzer.prototype.analyze = function *(datapoint) {
  var name = datapoint[0];
  var time = datapoint[1][0];
  var data = datapoint[1][1];
  var zset = configs.ssdb.zset.prefix + name;
  // get datapoints from database
  var series = [];
  var keys = yield this.filter(zset, time);

  for (var i = 0; i < keys.length; i++) {
    series.push(+keys[i].split(':')[0]);
  }
  // push current data to series
  series.push(data);
  // caculate the result
  var multi = +this.div3sigma(series).toFixed(4);

  var key = yield this.save(name, data, multi, time);

  if (multi > 1) {
    this.alert([name, [time, data, multi]]);
  }

  return [name, key];
};


/**
 * filter datapoints from database by periodicity & offset
 *
 * @param {String} zset  // example: 'bell.timer.mean.foo'
 * @param {Number} time  // unix timestamp
 * @return {Array}
 */
Analyzer.prototype.filter = function *(zset, time) {
  var offset = configs.analyzer.filter.offset;
  var period = configs.analyzer.filter.periodicity;
  var span = offset * period;
  var expire = configs.ssdb.zset.expire;

  var reqs = [];
  var now = time;

  while (now - time < expire) {
    var start = time - span;
    var stop = time + span;
    reqs.push(this.ssdb.zkeys(zset, '', start, stop, -1));
    time -= period;
  }

  var chunks = yield reqs;

  var series = [];

  // chain chunks into series
  for (var i = chunks.length - 1; i >= 0; i--) {
    Array.prototype.push.apply(series, chunks[i]);
  }

  return series;
};


/**
 * calculate the 3-sigma multiples.
 *
 * What's 3-sigma?
 *   => states that nearly all values(99.7%) lie within 3 standard deviations
 *   of the mean in a normal distribution.
 *
 * Return the multiples of the deviation to 3 * sigma.
 *
 * @param {Array} series
 * @return {Number}
 */
Analyzer.prototype.div3sigma = function (series) {
  var strict = configs.analyzer.strict;
  var minSize = configs.analyzer.minSize;

  if (series.length < minSize) {
    return 0;
  }

  // use the last if strict mode, else the mean of the last
  // 3 members
  var tail;

  if (strict) {
    tail = series.slice(-1)[0];
  } else {
    tail = array(series.slice(-3)).mean();
  }

  var arr = array(series);
  var mean = arr.mean();
  var std = arr.std();
  var dis = Math.abs(tail - mean);

  if (std === 0) {
    return dis === 0 ? 0 : 1;
  } else {
    return dis / (3 * std);
  }
};


/**
 * save datapoint to database
 * @param {String} name
 * @param {Number} data
 * @param {Number} multi  // 3sigma multiples
 * @param {Number} time   // unix timestamp
 */
Analyzer.prototype.save = function *(name, data, multi, time) {  // jshint ignore: line
  var prefix = configs.ssdb.zset.prefix;
  var expire = configs.ssdb.zset.expire;
  var mZset = configs.ssdb.zset.trending.multi;
  var vZset = configs.ssdb.zset.trending.value;

  // push datapoint to zset and clean outdates
  var key = [data, multi, time].join(':');
  var zset = prefix + name;

  var reqs = [
    this.ssdb.zset(zset, key, time),
    this.ssdb.zremrangebyscore(zset, 0, time - expire),
  ];

  // get current trendings
  var trendings = yield [
    this.ssdb.zget(mZset, name),
    this.ssdb.zget(vZset, name)
  ];

  // ssdb currently only support zset score as integer
  trendings[0] /= 1e5; trendings[1] /= 1e5;

  var factor = configs.analyzer.trending.factor;

  // calculate trendings via
  if (typeof trendings[0] === 'undefined') {
    var tmulti = multi;
  } else {
    tmulti = (trendings[0]) * (1 - factor) + factor * multi;
  }

  if (typeof trendings[1] === 'undefined') {
    var tvalue = data;
  } else {
    tvalue = (trendings[1]) * (1 - factor) + factor * data;
  }

  // ssdb currently only support zset score as integer
  tmulti *= 1e5; tvalue *= 1e5;

  // append `write trendigs` to reqs
  reqs.push(this.ssdb.zset(mZset, name, Math.round(tmulti)));
  reqs.push(this.ssdb.zset(vZset, name, Math.round(tvalue)));

  // parallel requests
  var resps = yield reqs;

  log.debug('ssdb resps: %s', resps);

  return key;
};


/**
 * connect to alerter
 */
Analyzer.prototype.connectAlerter = function() {
  var self = this;
  var port = configs.alerter.port;
  var host = configs.alerter.host;
  this.alerterConn = net.connect({port: port, host: host}, function(){
    log.debug('Connected to alerter');
  }).on('error', function(err) {
    log.warn('Socket error, alerter may be not up on port: %d', port);
    self.alerterConn.destroy();
    self.alerterConn = undefined;
  });
  return this;
};


/**
 * send anomaly to alerter
 * @param {Array} datapoint // [name, [time, value, multi]]
 */
Analyzer.prototype.alert = function(datapoint) {
  if (!this.alerterConn) {
    this.connectAlerter();
  }

  var string = JSON.stringify(datapoint);
  var buffer = new Buffer([string.length, string].join('\n'));
  this.alerterConn.write(buffer, 'utf8', function(){
    log.info('Send to alerter: %s', string);
  });
};

exports = module.exports = new Analyzer();
