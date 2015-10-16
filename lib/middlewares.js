/**
 * @overview  Koa middlewares.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const log = require('./log');

module.exports = {
  error401: function *(next) {
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
  },
  log: function *(next) {
    var startAt = new Date();
    var ctx = this;
    var done = function() {
      var elapsed = new Date() - startAt;
      log.info("%sms %s %s %s", elapsed, ctx.method,
               ctx.originalUrl, ctx.status);
    };
    ctx.res.once('finish', done);
    ctx.res.once('close', done);
    yield next;
  }
}
