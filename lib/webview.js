/**
 * @overview  Bell webapp views.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const clone    = require('clone');
const extend   = require('extend');
const auth     = require('koa-basic-auth');
const mount    = require('koa-mount');
const route    = require('koa-route');
const static_  = require('koa-static');
const logging  = require('logging.js');
const nunjucks = require('nunjucks');
const consts   = require('./consts');
const config   = require('./config');
const util     = require('./util');
const pkg      = require('../package');
const log      = logging.get('bell.webutil');

//----------------------------------------------------
// Nunjucks Env Globals
//----------------------------------------------------
const loader = new nunjucks.FileSystemLoader(consts.viewPath);
const env = new nunjucks.Environment(loader);

env.addGlobal('JSON', JSON);
env.addGlobal('Object', Object);
env.addGlobal('clone', clone);
env.addGlobal('extend', extend);
env.addGlobal('isNaN', isNaN);
env.addGlobal('config', config);
env.addGlobal('url', url);
env.addGlobal('package', pkg);
env.addGlobal('util', util);

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

//----------------------------------------------------
// Exports Register
//----------------------------------------------------
exports.register = function(app) {
  app.use(mount(url('/static', static_(consts.staticPath))));
  app.use(error401);
  app.use(auth(config.webapp.auth));
};

//------------------------------------------
// Util functions
//------------------------------------------
/**
 * Error 401 handler middleware.
 */
function *error401(next) {
  try {
    yield next;
  } catch (err) {
    if (401 == err.status) {
      this.status = 401;
      this.set('WWW-Authenticate', 'Basic');
      this.body = 'Unauthorized';
    } else {
      throw err;
    }
  }
}

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
  var s, pairs, key, item;

  if (config.webapp.root) {
    s = util.join('/', config.webapp.root, route);
  } else {
    s = util.join('/', route);
  }

  if (typeof params !== 'undefined') {
    pairs = [];
    item = [encodeURIComponent(key), encodeURIComponent(params[key])];
    for (key in params)
      pairs.push(item.join('='));
    s += '?' + pairs.join('&');
  }
  return s.replace(/\?$/g, '');
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
