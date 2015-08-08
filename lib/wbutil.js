'use strict';

const clone    = require('clone');
const extend   = require('extend');
const nunjucks = require('nunjucks');
const util     = require('util');
const configs  = require('./configs');
const logging  = require('logging.js');
const package_ = require('../package');
const path     = require('./util').path;

const log      = logging.get('bell.webapp');

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

// nunjucks env
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
env.addGlobal('path', path);

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

// logging request
function logreq(path, params) {  // eslint-disable-line
  var chunks = [];

  for (var key in params)
    chunks.push(util.format('%s: %j', key, params[key]));

  return log.info('%s => %s', path, chunks.join(', '));
}

// exports
exports.url    = url;
exports.render = render;
exports.logreq = logreq;
