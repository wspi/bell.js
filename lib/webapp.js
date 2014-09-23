/**
 * Webapp, analyzation results visualization
 */

var fs = require('fs');
var koa = require('koa');
var logger = require('koa-bunyan');
var mount = require('koa-mount');
var route = require('koa-route');
var _static = require('koa-static');
var views = require('co-views');
var minimatch = require('minimatch');
var configs = require('./configs');
var isEmptyObject = require('./util').isEmptyObject;
var log = require('./util').log;
var path = require('./util').path;
var service = require('./service');
var version = require('./version');

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
var globals = {
  url: url,
  version: version
};

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
})(globals);


var qcketrs;

/**
 * route, index, '/pattern'
 *
 * request parameters:
 *
 *   - type, String, 'v' or 'm', default: 'm'
 *   - limit, Number, top count, default: 50
 *   - sort, String, '↑' or '↓', default: '↓' (trending up)
 *   - past, String, sample: '1d', '1d3h' .., default: '0s'
 *
 * @param {String} pattern  // i.e. 'timer.mean.foo*'
 */
function *index(pattern) {
  if (isEmptyObject(pattern) || typeof pattern === 'undefined') {
    pattern = '*';
  }

  var type = this.request.query.type === 'v' ? 'v' : 'm';
  var sort = this.request.query.sort === '↑' ? '↑' : '↓';
  var limit = +this.request.query.limit || 50;
  var past = this.request.query.past || '0s';

  this.body = yield render('index', {
    type: type,
    pattern: pattern,
    limit: limit,
    sort: sort,
    past: past,
    qcketrs: qcketrs,
    // helper function to switch parameter
    switchUrl: function(key, value) {
      var params = {type: type, limit: limit, sort: sort, past: past};
      params[key] = value;
      return url('/' + pattern, params);
    }
  });
}

/**
 * route, apiNames, '/api/names/:pattern/:limit/:sort'
 *
 * @param {String} pattern
 * @param {Number} limit
 * @param {String} sort
 */
function *apiNames(pattern, limit, sort) {
  // cast parameters
  limit = +limit;

  // method: zscan/zrscan
  method = sort === '↑' ? 'zscan' : 'zrscan';

  console.log(method)

  // collect keys
  var zset = configs.ssdb.zset.prefix + 'trend';
  var list = yield ssdb[method](zset, '', '', '', -1);
  var keys = [];

  for (var i = 0; i < list.length; i += 2) {
    keys.push(list[i]);
  }

  // filter
  keys = keys.filter(minimatch.filter(pattern));
  // limit
  this.body = yield keys.slice(0, limit);
}


/**
 * route: apiMetrics, '/api/metrics/:name/:start/:stop/:type'
 *
 * @param {String} name
 * @param {Number} start // unix timestamp
 * @param {Number} stop  // unix timestamp
 * @param {String} type  // 'm' or 'v'
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
    if (configs.webapp.quickenters.length > 0) {
      var content = fs.readFileSync(configs.webapp.quickenters);
      qcketrs = JSON.parse(content);
    }

    ssdb = service.prototype.createSsdbClient().ssdb;
    app = koa();
    app.use(logger(log));
    // mount static
    app.use(mount(url('/static'), _static(path.static)));
    // register routes
    app.use(route.get(url('/'), index));
    app.use(route.get(url('/:pattern'), index));
    app.use(route.get(url('/api/names/:pattern/:limit/:sort'), apiNames));
    app.use(route.get(url('/api/metrics/:name/:start/:stop/:type'),
                      apiMetrics));
    // listen
    app.listen(configs.webapp.port);
  }  // jshint ignore: line
};
