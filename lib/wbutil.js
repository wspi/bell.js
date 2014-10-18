/**
 * webapp render via co & swig
 */

var views = require('co-views');
var configs = require('./configs');
var path = require('./util').path;
var version = require('./version');


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
function url(route, params){
  var root = configs.webapp.root;
  var url_ = path.join('/', root, route);

  if (typeof params !== 'undefined') {
    var pairs = [];

    for (var key in params) {
      pairs.push([key, params[key]].join('='));
    }

    url_ += '?' + pairs.join('&');
  }

  return url_;
}

exports.url = url;


/**
 * global vars of template rendering
 */
var globals = {
  url: url,
  verison: version
};


/**
 * swig render
 */
var render = views(path.view, {map: {html: 'swig'}});


exports.render = function *(view, locals){
  locals = locals || {};

  for (var key in globals) {
    if (globals.hasOwnProperty(key)) {
      locals[key] = globals[key];
    }
  }

  return yield render(view, locals);
};
