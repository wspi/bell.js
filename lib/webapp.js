'use strict';

const co        = require('co');
const clone     = require('clone');
const cluster   = require('cluster');
const extend    = require('extend');
const fs        = require('fs');
const koa       = require('koa');
const mount     = require('koa-mount');
const route     = require('koa-route');
const static_   = require('koa-static');
const minimatch = require('minimatch');
const util      = require('util');
const configs   = require('./configs');
const logging   = require('logging.js');
const logreq    = require('./wbutil').logreq;
const path      = require('./util').path;
const service   = require('./service');
const render    = require('./wbutil').render;
const url       = require('./wbutil').url;
const version   = require('../package').version;

const log       = logging.get('bell.webapp');

var app;
// ssdb client instance  {Object}
var ssdb;
// dashboards
var dashboards;
// trendings sync from ssdb  {Object}
var trendings;

// @route index '/'
//
// request parameters:
//
//   @param {String} pattern   // e.g. 'timer.upper_90.*'
//   @param {String} type      // 'v' || 'm', default: 'm'
//   @param {String} limit     // top count, default: 50
//   @param {String} sort      // '↑' or '↓', default: '↑' (trending up)
//   @param {String} past      // e.g. '1d', '1d3h', .., default: '0s'
//   @param {Number} stop      // 1 or 0, default: 0
//   @param {String} dashboard // dashboard name
//
function *index() {
  var pattern = this.request.query.pattern || '*';
  var type = this.request.query.type === 'v' ? 'v' : 'm';
  var limit = +this.request.query.limit || 50;
  var sort = this.request.query.sort === '↓' ? '↓' : '↑';
  var past = this.request.query.past || '0s';
  var stop = +this.request.query.stop || 0;
  var dashboard = this.request.query.dashboard || null;

  var params;

  if (dashboard) {
    params = {dashboard: dashboard};
  } else {
    params = {pattern: pattern};
  }

  extend(params, {
    type: type,
    limit: limit,
    sort: sort,
    past: past,
    stop: stop,
  });

  if (dashboard) {
    delete params.pattern;
    params.dashboard = dashboard;
  }

  this.body = yield render('index.html', {
    params: params,
    dashboards: dashboards,
  });

  logreq(this.request.path, params);
}

// @route apiIndex '/api'
//
function *apiIndex() {
  // api doc content
  var apidoc = fs.readFileSync(path.join(
    path.static, 'webapi.txt')).toString();
  this.type = 'text/plain';
  this.body = apidoc;
}

// @route apiNames '/api/names'
//
// request parameters
//
//   @param {String} pattern
//   @param {Number} limit
//   @param {String} sort
//   @param {String} dashoard
//
function *apiNames() {
  var pattern = this.request.query.pattern || '*';
  var limit = +this.request.query.limit || 50;
  var sort = this.request.query.sort === '↓' ? '↓' : '↑';
  var dashboard = this.request.query.dashboard || null;

  var keys = [];  // default: empty

  if (dashboard && (dashboard in dashboards)) {
    var dash = dashboards[dashboard];
    for (var i = 0; i < dash.patterns.length; i++)
      [].push.apply(keys, filterTrendings(dash.patterns[i]));
  } else {
    keys = filterTrendings(pattern);
  }

  // sort by `p / ((t + 2) ^ 1.5)`
  var times = {};
  var trends = {};
  var desc = sort === '↑' ? 1 : -1;

  for (var i = 0; i < keys.length; i++) {
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
  keys = keys.slice(0, limit);

  var res = [];

  for (i = 0; i < keys.length; i++) {
    res.push([keys[i], trends[keys[i]]]);
  }

  this.body = yield res;

  // logging
  var params;
  if (dashboard) {
    params = {dashboard: dashboard};
  } else {
    params = {pattern: pattern};
  }

  extend(params, {limit: limit, sort: sort});
  logreq(this.request.path, params);
}

// @route apiDatapoints, '/api/datapoints'
//
// request parameters:
//
//   @param {String} name
//   @param {Number} start // unix timestamp
//   @param {Number} stop  // unix timestamp
//   @param {String} type  // 'm' or 'v'
//
function *apiDatapoints() {
  var name = this.request.query.name;
  var type = this.request.query.type;
  var start = +this.request.query.start;
  var stop = +this.request.query.stop;

  var zset = configs.ssdb.prefix + name;
  var list = yield ssdb.acquire().zkeys(zset, '', start, stop, -1);
  var index = type === 'v' ? 0 : 1;

  var vals = [];
  var times = [];

  for (var i = 0; i < list.length; i++) {
    var item = list[i].split(':');
    vals.push(+item[index]);
    times.push(+item[2]);
  }

  var trend = +trendings[name].split(':')[0];
  this.body = yield {times: times, vals: vals, trend: trend};

  // logging
  logreq(this.request.path, {name: name, start: start, stop: stop,
         type: type});
}

exports = module.exports = {
  serve: function *() {
    if (cluster.isMaster) {
      for (var i = 0; i < configs.webapp.workers; i++) {
        var worker = cluster.fork();
        log.info('Forked worker process: %d', worker.process.pid);
      }
    } else {
      // initialize dashboards
      dashboards = {};
      for (var i = 0; i < configs.webapp.dashboards.length; i++) {
        var dashboard = eval('var _; _ = ' + fs.readFileSync(
          configs.webapp.dashboards[i]).toString());
        dashboards[dashboard.name] = dashboard;
      }

      // initialize ssdb client instance
      ssdb = service.prototype.createSsdbPool().ssdb;

      // initialize koa app instance
      app = koa();
      // app.use(logger(log));
      app.use(mount(url('/static'), static_(path.static)));
      // register routes
      app.use(route.get(url('/'), index));
      app.use(route.get(url('/api'), apiIndex));
      app.use(route.get(url('/api/names'), apiNames));
      app.use(route.get(url('/api/datapoints'), apiDatapoints));
      // bind http server
      app.listen(configs.webapp.port);

      // start cron task to sync trendings
      yield syncTrendings();
      setInterval(co.wrap(syncTrendings), configs.interval * 1e3);
    }
  }
};

// Sync trendings to memory in webapp
function *syncTrendings() {
  var hash = configs.ssdb.prefix + 'trend';
  var list = yield ssdb.acquire().hgetall(hash);
  var dict = {};

  for (var i = 0; i < list.length; i += 2) {
    dict[list[i]] = list[i + 1];
  }

  trendings = dict;
  log.debug('Sync trendings done, %d items', Object.keys(trendings).length);
}

// Filter trendings by pattern
function filterTrendings(pattern) {
  return Object.keys(trendings).filter(minimatch.filter(pattern));
}
