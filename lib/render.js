/**
 * @overview  Template Renderer function.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

const clone    = require('clone');
const extend   = require('extend');
const nunjucks = require('nunjucks');
const config   = require('./config');
const consts   = require('./consts');
const pkg      = require('../package');
const url      = require('./url');
const util     = require('./util');

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

module.exports = redner;
