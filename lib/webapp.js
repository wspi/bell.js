/**
 * Webapp, analyzation results visualization
 */

var koa = require('koa');
var logger = require('koa-logger');
var mount = require('koa-mount');
var route = require('koa-route');
var _static = require('koa-static');
var views = require('co-views');
var minimatch = require('minimatch');
var configs = require('./configs');
var isEmptyObject = require('./util').isEmptyObject;
var path = require('./util').path;
var service = require('./service');

var app;
var ssdb;

/**
 * make absolute url by pathes
 *
 * example:
 *
 *   url('/user', {name: 'foo', age: 17})
 *   // => '/user?name=foo&age=17'
 *
 * @param {String} route
 * @param {Object} params
 * @return {String}
 */
function url(route, params) {
  var root = configs.webapp.root;
  var uri = path.join('/', root, route);

  if (typeof params !== 'undefined') {
    var pairs = [];
    for (var key in params) {
      pairs.push([key, params[key]].join('='));
    }
    uri += '?' + pairs.join('&');
  }
  return uri;
}


/**
 * render template with global vars
 *
 * example:
 *
 *   render('index', {key: 'val'})
 */
var render = (function(globals) {
  // swig render
  var render = views(path.view, {map: {html: 'swig'}});

  return function *(view, locals) {
    locals = locals || {};

    for (var key in globals) {
      if (globals.hasOwnProperty(key)) {
        locals[key] = globals[key];
      }
    }

    return yield render(view, locals);
  };
})({url: url});


/**
 * time spans for trending page
 */
var timeSpans = {
  '15m': 15 * 60,
  '45m': 45 * 60,
  '60m': 60 * 60,
  '90m': 90 * 60,
  '3h': 3 * 60 * 60
};

/**
 * route, index, '/pattern'
 *
 * request parameters:
 *
 *   - type, String, 'v' or 'm', default: 'm'
 *   - limit, Number, top count, default: 50
 *   - since, String, timeSpans, default: '15m'
 *
 * @param {String} pattern  // i.e. 'timer.*'
 */
function *index(pattern) {
  if (isEmptyObject(pattern) || typeof pattern === 'undefined') {
    pattern = '*';
  }

  var type = this.request.query.type === 'v' ? 'v' : 'm';
  var limit = this.request.query.limit || 50;
  var since = this.request.query.since || '15m';

  this.body = yield render('index', {
    type: type,
    pattern: pattern,
    limit: limit,
    since: since
  });
}

/**
 * route, apiNames, '/api/names/:pattern/:limit/:since'
 *
 * @param {String} pattern
 * @param {Number} limit
 * @param {String} since
 */
function *apiNames(pattern, limit, since) {
  limit = +limit;
  since = timeSpans[since];

  var hash = configs.ssdb.hash;
  var keys = yield ssdb.hkeys(hash, '', '', -1);

  keys = keys.filter(minimatch.filter(pattern));

  var reqs = [];
  var now = new Date() / 1000;
  var prefix = configs.ssdb.zset.prefix;

  for (var i = 0; i < keys.length; i++) {
    reqs.push(ssdb.zcount(prefix + '_' + keys[i], now - since, ''));
  }

  var counts = yield reqs;
  var dict = {};

  for (i = 0; i < keys.length; i++) {
    dict[keys[i]] = counts[i];
  }

  keys = keys.sort(function(x, y) {
    return dict[y] - dict[x];
  });

  this.body = yield keys.slice(0, limit);
}


/**
 * route: apiMetrics, '/api/metrics/:name/:start/:stop/:type'
 *
 * @param {String} name
 * @param {Number} start  // unix timestamp
 * @param {Number} stop  // unix timestamp
 * @param {String} type
 */

function *apiMetrics(name, start, stop, type) {
  var zset = configs.ssdb.zset.prefix + name;
  var list = yield ssdb.zkeys(zset, '', +start, +stop, -1);
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


exports = module.exports = {
  serve: function *() {
    ssdb = service.prototype.createSsdbClient().ssdb;
    app = koa();
    app.use(logger());
    // mount static
    app.use(mount(url('/static'), _static(path.static)));
    // register routes
    app.use(route.get(url('/'), index));
    app.use(route.get(url('/:pattern'), index));
    app.use(route.get(url('/api/names/:pattern/:limit/:since'), apiNames));
    app.use(route.get(url('/api/metrics/:name/:start/:stop/:type'), apiMetrics));
    // listen
    app.listen(configs.webapp.port);
  }
};
