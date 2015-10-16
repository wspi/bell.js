/**
 * @overview  WebApp Util functions
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const clone    = require('clone');
const extend   = require('extend');
const nunjucks = require('nunjucks');
const logging  = require('logging.js');
const config   = require('./config');
const util     = require('./util');
const pkg      = require('../package');
const log      = logging.get('bell.webutil');

//------------------------------------------
// Exports
//------------------------------------------
module.exports = {
  url        : url,
  render     : render,
  logRequest : logRequest,
};

//------------------------------------------
// Util functions
//------------------------------------------
/**
 * Build url by route and params, e.g.
 *
 *   url('/user', {name: 'foo', age: 17})
 *   // => '/user?name=foo&age=17'
 *
 *  @param {String} route
 *  @param {Object} params
 *  @return {String}
 */

function url(route, params) {
  var s, pairs, key;

  s = path.join('/', config.webapp.root, route);

  if (typeof params !== 'undefined') {
    pairs = [];

    for (key in params) {
      pairs.push(
        [encodeURIComponent(key), encodeURIComponent(params[key])].join('='));
    }
    s += '?' + pairs.join('&');
  }
  return s.replace(/\?$/g, '');
}

//----------------------------------------------------
// Nunjucks Env Globals
//----------------------------------------------------
const viewPath = util.join(__dirname, '..', 'view');
const loader = new nunjucks.FileSystemLoader(viewPath);
const env = new nunjucks.Environment(loader);

env.addGlobal('JSON', JSON);
env.addGlobal('Object', Object);
env.addGlobal('clone', clone);
env.addGlobal('extend', extend);
env.addGlobal('isNaN', isNaN);
env.addGlobal('config', config);
env.addGlobal('url', url);
env.addGlobal('package', pkg);
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
 * Logging one request
 */
function logRequest(path, params) {
  var chunks = [];

  for (var key in params)
    chunks.push(util.format('%s: %j', key, params[key]));

  return log.info('%s => %s', path, chunks.join(', '));
}
