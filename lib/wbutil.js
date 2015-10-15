'use strict';

const clone     = require('clone');
const extend    = require('extend');
const nunjucks  = require('nunjucks');
const util      = require('util');
const config   = require('./config');
const logging   = require('logging.js');
const package_  = require('../package');
const path      = require('./util').path;
const cleanWith = require('./util').cleanWith;
const log       = logging.get('bell.webapp');

/**
 * Build url by route and params.
 *
 * e.g.
 *
 *   url('/user', {name: 'foo', age: 17})
 *   // => '/user?name=foo&age=17'
 *
 *  @param {String} route
 *  @param {Object} params
 *  @return {String}
 */

function url(route, params) {
  var url_, pairs, key;

  url_ = path.join('/', config.webapp.root, route);

  if (typeof params !== 'undefined') {
    pairs = [];

    for (key in params) {
      pairs.push(
        [encodeURIComponent(key), encodeURIComponent(params[key])].join('='));
    }
    url_ += '?' + pairs.join('&');
  }
  return url_.replace(/\?$/g, '');
}

//----------------------------------------------------
// Nunjucks Env Globals
//----------------------------------------------------
const loader = new nunjucks.FileSystemLoader(path.view);
const env = new nunjucks.Environment(loader);

env.addGlobal('JSON', JSON);
env.addGlobal('Object', Object);
env.addGlobal('clone', clone);
env.addGlobal('extend', extend);
env.addGlobal('isNaN', isNaN);

env.addGlobal('config', config);
env.addGlobal('url', url);
env.addGlobal('package', package_);
env.addGlobal('cleanWith', cleanWith);

//----------------------------------------------------
// Nunjucks Renderer
//----------------------------------------------------

/**
 * Make nunjucks to work with koa
 *
 *   @param {String} template
 *   @param {Object} context
 *   @return {Function} // thunkify
 */

function render(template, context) {
  return function(callback) {
    env.render(template, context, callback);
  };
}

/**
 * Logging Request
 */
function logreq(path, params) {
  var chunks = [];

  for (var key in params)
    chunks.push(util.format('%s: %j', key, params[key]));

  return log.info('%s => %s', path, chunks.join(', '));
}

// exports
exports.url    = url;
exports.render = render;
exports.logreq = logreq;
