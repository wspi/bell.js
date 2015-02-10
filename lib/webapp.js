/**
 * Webapp, analyzation results visualization
 */

const cluster = require('cluster');
const fs = require('fs');
const co = require('co');
const clone = require('clone');
const extend = require('extend');
const koa = require('koa');
const mount = require('koa-mount');
const route = require('koa-route');
const static_ = require('koa-static');
const minimatch = require('minimatch');

const configs = require('./configs');
const log = require('./log');
const path = require('./util').path;
const patterns = require('./patterns');
const service = require('./service');
const url = require('./wbutil').url;
const render = require('./wbutil').render;
const version = require('../package').version;
const util = require('util');

// koa app instance  {Object}
const app;
// ssdb client instance  {Object}
const ssdb;
// trendings sync from ssdb  {Object}
const trendings;


/**
 * @route index  '/pattern'
 *
 * request parameters:
 *
 *   @param {String} pattern  // e.g. 'timer.upper_90.*'
 *   @param {String} type  // 'v' || 'm', default: 'm'
 *   @param {String} limit  // top count, default: 50
 *   @param {String} sort  // '↑' or '↓', default: '↑' (trending up)
 *   @param {String} past  // e.g. '1d', '1d3h', .., default: '0s'
 *   @param {Number} stop  // 1 or 0, default: 0
 */

function *index() {
  var pattern = this.request.query.pattern || '*';
  var type = this.request.query.type === 'v' ? 'v' : 'm';
  var limit = +this.request.query.limit || 50;
  var sort = this.request.query.sort === '↓' ? '↓' : '↑';
  var past = this.request.query.past || '0s';
  var stop = +this.request.query.stop || 0;

  // request params
  var params = {
    pattern: pattern,
    type: type,
    limit: limit,
    sort: sort,
    past: past,
    stop: stop
  };

  this.body = yield render('index.html', {
    params: params,
    patterns: patterns,
  });

  // logging
  var chunks = [];
  for (var key in params) {
    chunks.push(util.format('%s: %j', key, params[key]));
  }
  log.info(chunks.join(', '));
}


/**
 * @route apiNames '/api/names'
 *
 * request parameters
 *
 *   @param {String} pattern
 *   @param {Number} limit
 *   @param {String} sort
 */

function *apiNames() {
  var pattern = this.request.query.pattern || '*';
  var limit = +this.request.query.limit || 50;
  var sort = this.request.query.sort === '↓' ? '↓' : '↑';

  // filter
  keys = Object.keys(trendings).filter(minimatch.filter(pattern));

  // sort by `p / ((t + 2) ^ 1.5)`
  var times = {};
  var trends = {};
  var desc = sort === '↑' ? 1 : -1;

  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    var val = trendings[key];
    trends[key] = +val.split(':')[0];
    times[key] = +val.split(':')[1];
  }
  // issue#28, https://github.com/eleme/node-bell/issues/28
  var now = Math.round(+new Date() / 1000);
  keys.sort(function(a, b){
    var a_ = trends[a] / Math.pow(2 + now - times[a], 1.5);
    var b_ = trends[b] / Math.pow(2 + now - times[b], 1.5);
    return desc * (b_ - a_);
  });

  // limit
  this.body = yield keys.slice(0, limit);
}


/**
 * route: apiMetrics, '/api/metrics'
 *
 * request parameters:
 *
 *   @param {String} name
 *   @param {Number} start // unix timestamp
 *   @param {Number} stop  // unix timestamp
 *   @param {String} type  // 'm' or 'v'
 */

function *apiMetrics() {
  var name = this.request.query.name;
  var type = this.request.query.type;
  var start = +this.request.query.start;
  var stop = +this.request.query.stop;

  var zset = configs.ssdb.prefix + name;
  var list = yield ssdb.zkeys(zset, '', start, stop, -1);
  var index = type === 'v' ? 0 : 1;

  var vals = [];
  var times = [];

  for (var i = 0; i < list.length; i++) {
    var item = list[i].split(':');
    vals.push(+item[index]);
    times.push(+item[2]);
  }

  this.body = yield {times: times, vals: vals};
}

/**
 * route: apiStats, '/api/stats'
 *
 * request parameters: None
 * response: JSON, schema
 *   {pattern: trend}
 */

function *apiStats() {
  // collect patterns
  var list = [];

  for (var key in patterns) {
    for (var key_ in patterns[key]) {
      list.push(patterns[key][key_]);
    }
  }

  // collect trends
  var trends = {};

  for (key in trendings) {
    var item = trendings[key].split(':');

    if (1000 * (+item[1] + 2 * configs.interval) >= new Date()) {
      trends[key] = +item[0];
    }
  }

  // collect stats
  var stats = {};

  for (var i = 0; i < list.length; i++) {
    var sum = 0;
    var count = 0;

    for (key in trends) {
      if (minimatch(key, list[i])) {
        count += 1;
        sum += trends[key];
      }
    }

    if (count === 0) {
      stats[list[i]] = 0;
    } else {
      stats[list[i]] = sum / count;
    }
  }

  this.body = yield stats;
}

exports = module.exports = {
  serve: function *() {
    if (cluster.isMaster) {
      for (var i = 0; i < configs.webapp.workers; i++) {
        var worker = cluster.fork();
        log.info('Forked worker process: %d', worker.process.pid);
      }
    } else {
      // initialize ssdb client instance
      ssdb = service.prototype.createSsdbClient().ssdb;

      // initialize koa app instance
      app = koa();
      // app.use(logger(log));
      app.use(mount(url('/static'), static_(path.static)));
      // register routes
      app.use(route.get(url('/'), index));
      app.use(route.get(url('/api/names'), apiNames));
      app.use(route.get(url('/api/metrics'), apiMetrics));
      app.use(route.get(url('/api/stats'), apiStats));
      // bind http server
      app.listen(configs.webapp.port);

      // start cron task to sync trendings
      yield syncTrendings();
      setInterval(co.wrap(syncTrendings), configs.interval * 1e3);
    }
  }
};


/**
 * Sync trendings to memory in webapp
 */
function *syncTrendings() {
  var hash = configs.ssdb.prefix + 'trend';
  var list = yield ssdb.hgetall(hash);
  var dict = {};

  for (var i = 0; i < list.length; i += 2) {
    dict[list[i]] = list[i + 1];
  }

  trendings = dict;
  log.debug('Sync trendings done, %d items', Object.keys(trendings).length);
}
