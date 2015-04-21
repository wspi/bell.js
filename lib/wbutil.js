'use strict';

const clone = require('clone');
const extend = require('extend');
const nunjucks = require('nunjucks');

const configs = require('./configs');
const package_ = require('../package');
const path = require('./util').path;

// e.g.
//
//   url('/user', {name: 'foo', age: 17})
//   // => '/user?name=foo&age=17'
//
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

const loader = new nunjucks.FileSystemLoader(path.view);
const env = new nunjucks.Environment(loader);

env.addGlobal('JSON', JSON);
env.addGlobal('Object', Object);
env.addGlobal('clone', clone);
env.addGlobal('extend', extend);
env.addGlobal('isNaN', isNaN);

env.addGlobal('configs', configs);
env.addGlobal('url', url);
env.addGlobal('package', package_);

// Make nunjucks to work with koa
//
// @param {String} template
// @param {Object} context
// @return {Function}  // thunkify
//
function render(template, context) {
  return function(callback) {
    env.render(template, context, callback);
  };
}

exports.render = render;
