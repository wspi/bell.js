/**
 * @fileoverview Bell WebApp Service.
 */

'use strict';

// jshint -W124

const co        = require('co');
const cluster   = require('cluster');
const extend    = require('extend');
const fs        = require('fs');
const koa       = require('koa');
const mount     = require('koa-mount');
const route     = require('koa-route');
const static_   = require('koa-static');
const minimatch = require('minimatch');
const configs   = require('./configs');
const logging   = require('logging.js');
const logreq    = require('./wbutil').logreq;
const path      = require('./util').path;
const service   = require('./service');
const render    = require('./wbutil').render;
const url       = require('./wbutil').url;
const log       = logging.get('bell.webapp');

//----------------------------------------------------
// Global Vars
//----------------------------------------------------

var app;        // koa app instance
var ssdb;       // ssdb client instance  {Object}
var groups;     // dashboard groups
var dashboards; // cache all dashboards {dashboardSlug: {..}}
var trendings;  // trendings sync from ssdb  {Object}

//----------------------------------------------------
// Route Handlers
//----------------------------------------------------

/**
 * @route index '/'
 *
 * request parameters:
 *
 *   @param {String} pattern   // e.g. 'timer.upper_90.*'
 *   @param {String} type      // 'v' || 'm', default: 'm'
 *   @param {String} limit     // top count, default: 50
 *   @param {String} sort      // '↑' or '↓', default: '↑' (trending up)
 *   @param {String} past      // e.g. '1d', '1d3h', .., default: '0s'
 *   @param {Number} stop      // 1 or 0, default: 0
 *   @param {String} dashboard // dashboard name
 *   @param {String} lang      // languange, zh or 'en'
 */
function *index() {
  var pattern = this.request.query.pattern || '*';
  var type = this.request.query.type === 'v' ? 'v' : 'm';
  var limit = +this.request.query.limit || 50;
  var sort = this.request.query.sort === '↓' ? '↓' : '↑';
  var past = this.request.query.past || '0s';
  var stop = +this.request.query.stop || 0;
  var dashboard = this.request.query.dashboard || null;
  var lang = this.request.query.lang === 'zh' ? 'zh' : 'en';

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
    lang: lang,
  });

  if (dashboard) {
    delete params.pattern;
    params.dashboard = dashboard;
  }

  this.body = yield render('index.html', {
    params: params,
    groups: groups
  });

  logreq(this.request.path, params);
}

/**
 * @route docsIndex '/docs'
 *
 * request parametera
 *
 *   @param {String} lang // 'zh' or 'en'
 **/
function *docsIndex() {
  var lang = this.request.query.lang === 'zh' ? 'zh' : 'en';
  var vars = {
    params: {
      lang: lang
    }
  };
  this.body = yield render('docs.html', vars);
}

/**
 * @route apiNames '/api/names'
 *
 * request parameters
 *
 *   @param {String} pattern
 *   @param {Number} limit
 *   @param {String} sort
 *   @param {String} dashoard
 */
function *apiNames() {
  //----------------------------------------------------
  // Collect Keys
  //----------------------------------------------------
  var pattern = this.request.query.pattern || '*';
  var limit = +this.request.query.limit || 50;
  var sort = this.request.query.sort === '↓' ? '↓' : '↑';
  var dashboard = this.request.query.dashboard || null;

  var keys = [], i, dash;

  if (dashboard && (dashboard in dashboards)) {
    dash = dashboards[dashboard];
    for (i = 0; i < dash.patterns.length; i++) {
      [].push.apply(keys, filterTrendings(dash.patterns[i]));
    }
  } else {
    keys = filterTrendings(pattern);
  }

  //----------------------------------------------------
  // Sort by ``p / ((t + 2) ^ 1.5)``
  //----------------------------------------------------
  var total = keys.length;
  var mcount = 0;
  var times = {},
      trends = {},
      desc = sort === '↑' ? 1 : -1,
      key, val, now;

  for (i = 0; i < keys.length; i++) {
    key = keys[i];
    val = trendings[key];
    trends[key] = +val.split(':')[0];
    times[key] = +val.split(':')[1];
    if (trends[key] >= 1) {
      mcount += 1;
    }
  }

  // issue#28, https://github.com/eleme/bell.js/issues/28
  now = Math.round(+new Date() / 1000);
  keys.sort(function(a, b){
    var a_ = trends[a] / Math.pow(2 + now - times[a], 1.5);
    var b_ = trends[b] / Math.pow(2 + now - times[b], 1.5);
    return desc * (b_ - a_);
  });

  //----------------------------------------------------
  // Limit
  //----------------------------------------------------
  keys = keys.slice(0, limit);

  var names = [];

  for (i = 0; i < keys.length; i++) {
    names.push([keys[i], trends[keys[i]]]);
  }

  //----------------------------------------------------
  // Yield Request
  //----------------------------------------------------
  this.body = yield {total: total, mcount: mcount, names: names};

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

/**
 * @route apiDatapoints, '/api/datapoints'
 *
 * request parameters:
 *
 *   @param {String} name
 *   @param {Number} start // unix timestamp
 *   @param {Number} stop  // unix timestamp
 *   @param {String} type  // 'm' or 'v'
 */
function *apiDatapoints() {
  var name = this.request.query.name;
  var type = this.request.query.type;
  var start = +this.request.query.start;
  var stop = +this.request.query.stop;

  var zset = configs.ssdb.prefix + name;
  var list = yield ssdb.acquire().zkeys(zset, '', start, stop, -1);
  var idx = type === 'v' ? 0 : 1;

  var vals = [];
  var times = [];

  var i, item;

  for (i = 0; i < list.length; i++) {
    item = list[i].split(':');
    vals.push(+item[idx]);
    times.push(+item[2]);
  }

  var trend = +trendings[name].split(':')[0];
  this.body = yield {times: times, vals: vals, trend: trend};

  // logging
  logreq(this.request.path, {name: name, start: start, stop: stop,
         type: type});
}


//----------------------------------------------------
// Export Serve Entry
//----------------------------------------------------
exports = module.exports = {
  serve: function *() {
    var i;

    if (cluster.isMaster) {
      //----------------------------------------------
      // Fork workers in master
      //----------------------------------------------
      for (i = 0; i < configs.webapp.workers; i++) {
        var worker = cluster.fork();
        log.info("Forked worker process: %d", worker.process.pid);
      }
    } else {
      //----------------------------------------------
      // Load dashboards
      //----------------------------------------------
      var fileName = configs.webapp.groups,
          content,
          groupName,
          group,
          dashboardName,
          dashboardSlug;
      if (fileName && fileName.length > 0) {
        content = fs.readFileSync(configs.webapp.groups).toString();
        groups = eval('var _; _ = ' + content);
        dashboards = {};
        for (groupName in groups) {
          group = groups[groupName];
          for (dashboardName in group.dashboards) {
            dashboardSlug = [groupName, dashboardName].join(':');
            dashboards[dashboardSlug] = group.dashboards[dashboardName];
          }
        }
      }
      //----------------------------------------------
      // Initialize ssdb/koa/cron
      //----------------------------------------------
      ssdb = service.prototype.createSsdbPool().ssdb;
      app = koa();
      app.use(mount(url('/static'), static_(path.static)));
      app.use(route.get(url('/docs'), docsIndex));
      app.use(route.get(url('/'), index));
      app.use(route.get(url('/api/names'), apiNames));
      app.use(route.get(url('/api/datapoints'), apiDatapoints));
      app.listen(configs.webapp.port);
      yield syncTrendings();
      setInterval(co.wrap(syncTrendings), configs.interval * 1e3);
    }
  }
};

// Sync trendings to memory in webapp
function *syncTrendings() {
  var hash = configs.ssdb.prefix + 'trend';
  var list = yield ssdb.acquire().hgetall(hash);
  var dict = {}, i;

  for (i = 0; i < list.length; i += 2) {
    dict[list[i]] = list[i + 1];
  }

  trendings = dict;
  log.info('Sync trendings done, %d items', Object.keys(trendings).length);
}

// Filter trendings by pattern
function filterTrendings(pattern) {
  return Object.keys(trendings).filter(minimatch.filter(pattern));
}
