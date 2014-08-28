/**
 * Analyze incoming metrics from beanstalkd and store results into ssdb
 */

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

  // init hooks
  if (configs.hooks.enable) {
    var hooks = configs.hooks.modules;
    for (var i = 0; i < hooks.length; i++) {
      log.debug('Load hook module: %s ..', hooks[i]);
      (require(hooks[i]).init)(configs, self, log);
    }
  }

  this.createSsdbClient().createBeansClient();

  yield this.connectBeans('watch');

  // fivebeans requires a function for `destroy`
  var beansDelCb = function() {};

  while (1) {
    var job = yield this.beans._reserve();
    log.debug('Reserved job: %d', job.id);
    var datapoint = JSON.parse(job.body);
    var key = yield this.analyze(datapoint);
    log.info('Analyzed: %s', key);
    this.beans.destroy(job.id, beansDelCb);
    log.debug('Completed job: %d', job.id);
  }
};


/**
 * analyze current datapoint
 */
Analyzer.prototype.analyze = function *(datapoint) {
  var name = datapoint[0];
  var time = datapoint[1][0];
  var data = datapoint[1][1];
  var zset = configs.ssdb.zset.prefix + name;
  // measure time duration
  var start = new Date();
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

  if (multi > 1) {
    this.emit('anomaly detected', datapoint, multi);
  }

  return yield this.save(name, data, multi, time);
};


/**
 * filter datapoints from database
 */
Analyzer.prototype.filter = function *(zset, time) {
  var offset = configs.filter.offset;
  var period = configs.filter.periodicity;
  var span = offset * period;

  var chunks = [];

  while (1) {
    var start = time - span;
    var stop = time + span;

    var chunk = yield this.ssdb.zkeys(zset, '', start, stop, -1);

    if (!chunk.length) {
      break;
    } else {
      chunks.push(chunk);
      time -= period;
    }
  }

  var series = [];

  for (var i = chunks.length - 1; i >= 0; i--) {
    Array.prototype.push.apply(series, chunks[i]);
  }

  return series;
};


/**
 * calculate the 3-sigma multiples
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
    return dis === 0 ? -1 : 0;   // -1 => -inf
  } else {
    return dis / (3 * std);
  }
};


/**
 * save datapoint to database
 */
Analyzer.prototype.save = function *(name, data, multi, time) {
  var key = [data, multi, time].join(':');
  var hash = configs.ssdb.hash;
  var zset = configs.ssdb.prefix + name;
  var _zset = configs.ssdb.prefix + '_' + name;
  var expire = configs.ssdb.zset.expire;
  var _3hours = 10800;

  // push datapoint to zset and clean outdates
  var reqs = [
    this.ssdb.zsie(zset),
    this.ssdb.zset(zset, key, time),
    this.ssdb.zremrangebyscore(zset, 0, time - expire)
  ];

  // push anomalies and clean outdates
  if (multi > 1) {
    reqs.push(this.ssdb.zset(_zset, multi, time));
    reqs.push(this.ssdb.zremrangebyscore(_zset, 0, time - _3hours));
  }

  // parallel requests
  yield reqs;

  return key;
};
