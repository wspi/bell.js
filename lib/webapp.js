/**
 * Webapp, analyzation results visualization
 */

var fs = require('fs');
var co = require('co');
var koa = require('koa');
var logger = require('koa-bunyan');
var mount = require('koa-mount');
var route = require('koa-route');
var static_ = require('koa-static');
var views = require('co-views');
var configs = require('./configs');
var isEmptyObject = require('./util').isEmptyObject;
var log = require('./util').log;
var path = require('./util').path;
var startsWith = require('./util').startsWith;
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
var timesteps;

/**
 * route, index, '/prefix'
 *
 * @param {String} prefix  // i.e. 'timer.mean.'
 *
 * request parameters:
 *
 *   @param {String} type  // 'v' or 'm', default: 'm'
 *   @param {Number} limit  // top count, default: 50
 *   @param {String} sort  // '↑' or '↓', default: '↑' (trending up)
 *   @param {String} past  // sample: '1d', '1d3h' .., default: '0s'
 *   @param {Number} stop  // 1 or 0, default: 0
 */
function *index(prefix) {
  if (isEmptyObject(prefix) || typeof prefix === 'undefined') {
    prefix = '';
  }

  var type = this.request.query.type === 'v' ? 'v' : 'm';
  var sort = this.request.query.sort === '↓' ? '↓' : '↑';
  var limit = +this.request.query.limit || 50;
  var past = this.request.query.past || '0s';
  var stop = +this.request.query.stop || 0;

  var timestep = 10;

  if (typeof timesteps !== 'undefined') {
    for (var key in timesteps) {
      if (startsWith(prefix, key)) {
        timestep = timesteps[key];
      }
    }
  }

  this.body = yield render('index', {
    type: type,
    prefix: prefix,
    limit: limit,
    sort: sort,
    past: past,
    stop: stop,
    qcketrs: qcketrs,
    // helper function to switch parameter
    switchUrl: function(key, value) {
      var params = {type: type, limit: limit, sort: sort, past: past,
        stop: stop};
      params[key] = value;
      return url('/' + prefix, params);
    }
  });
}

/**
 * route, apiNames, '/api/names'
 *
 * request parameters:
 *
 *   @param {String} prefix
 *   @param {Number} limit
 *   @param {String} sort
 */
function *apiNames() {
  // get parameters
  var prefix = this.request.query.prefix || '';
  var limit = +this.request.query.limit || 50;
  var sort = this.request.query.sort === '↓' ? '↓' : '↑';

  // desc
  var desc = sort === '↑' ? 1 : -1;

  var list = trendings;

  var dict = {};

  for (var i = 0; i < list.length; i += 2) {
    dict[list[i]] = list[i + 1];
  }

  // filter
  keys = Object.keys(dict).filter(function(key) {
    return startsWith(key, prefix);
  });

  // sort,  p / ((t + 2)^1.5)
  var times = {};
  var trends = {};

  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    var val = dict[key];
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
 * cache all trending data to memory every 10s
 */
var trendings;

function *cacheTrendings() {
  var hash = configs.ssdb.prefix + 'trend';
  trendings = yield ssdb.hgetall(hash);
  log.debug('Sync trendings done, %d', trendings.length);
}


exports = module.exports = {
  serve: function *() {
    if (configs.webapp.quickenters.length > 0) {
      var quickentersContent = fs.readFileSync(configs.webapp.quickenters);
      qcketrs = JSON.parse(quickentersContent);
    }

    if (configs.webapp.timesteps.length > 0) {
      var timestepsContent = fs.readFileSync(configs.webapp.timesteps);
      timesteps = JSON.parse(timestepsContent);
    }

    ssdb = service.prototype.createSsdbClient().ssdb;
    app = koa();
    app.use(logger(log));
    // mount static
    app.use(mount(url('/static'), static_(path.static)));
    // register routes
    app.use(route.get(url('/'), index));
    app.use(route.get(url('/:prefix'), index));
    app.use(route.get(url('/api/names'), apiNames));
    app.use(route.get(url('/api/metrics'),
                      apiMetrics));
    // listen
    app.listen(configs.webapp.port);

    // cache trendings
    yield cacheTrendings();

    setInterval(function(){
      co(cacheTrendings)();
    }, 1000 * configs.webapp.cacheInterval);
  }  // jshint ignore: line
};
