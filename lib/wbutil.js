/**
 * Webapp utils:
 */


var path = require('./util').path;
var clone = require('clone');
var extend = require('extend');
var nunjucks = require('nunjucks');
var configs = require('./configs');
var package = require('../package');


/**
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
  var url_ = path.join('/', configs.webapp.root, route);

  if (typeof params !== 'undefined') {
    var pairs = [];

    for (var key in params) {
      pairs.push(
        [encodeURIComponent(key), encodeURIComponent(params[key])].join('='));
    }
    url_ += '?' + pairs.join('&');
  }
  return url_;
}

exports.url = url;


/**
 * nunjucks environment
 */
var loader = new nunjucks.FileSystemLoader(path.view);
var env = new nunjucks.Environment(loader);

/**
 * Set global variables to nunjucks env
 */
// normal globals
env.addGlobal('JSON', JSON);
env.addGlobal('Object', Object);
env.addGlobal('clone', clone);
env.addGlobal('extend', extend);
env.addGlobal('isNaN', isNaN);
// custom globals
env.addGlobal('configs', configs);
env.addGlobal('url', url);
env.addGlobal('package', package);


/**
 * Make nunjucks to work with koa
 *
 * @param {String} template
 * @param {Object} context
 * @return {Function}  // thunkify
 */
function render(template, context) {
  return function(callback) {
    env.render(template, context, callback);
  };
}

exports.render = render;
