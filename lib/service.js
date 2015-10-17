/**
 * @overview  The based service function.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

'use strict';

const events = require('events');
const fivebeans = require('fivebeans');
const net = require('net');
const ssdb = require('ssdb');
const Sequelize = require('sequelize');
const config = require('./config');
const log = require('./log');
const protocol = require('./protocol');
const util = require('./util');

/**
 * Connection buffer parser.
 */
function ConnBufferParser() {
  this.unfinished = new Buffer('');
}

/**
 * Parse buffer to string chunks.
 *
 * @param {Buffer} buf
 * @return {Array}
 */
ConnBufferParser.prototype.parse = function(buf) {
  var result;
  // pick up the unfinished buffer last time
  buf = Buffer.concat([this.unfinished, buf]);
  result = protocol.decode(buf);
  this.unfinished = result[1];
  return result[0];
};

/**
 * Base service class.
 */
function Service() {
  events.EventEmitter.call(this);
}
util.inherits(Service, events.EventEmitter);

/**
 * Create a socket tcp server (using bell protocol).
 *
 *  @param {Number} port
 *  @param {Function} cb  // function(datapoints)
 *  @return {Service} // this
 */
Service.prototype.createSocketServer = function(port, cb) {
  this.sock = net.createServer(function(conn) {
    var fd = conn._handle.fd;
    log.info("new connection established (fd %d)", fd);
    if (!conn._bufferParser) {
      conn._bufferParser = new ConnBufferParser();
    }
    //------------------ conn on data -----------------------
    conn.on('data', function(buf) {
      var datapoints;
      try {
        datapoints = conn._bufferParser.parse(buf);
      } catch (e) {
        log.warn("invalid input: %s", buf.slice(0, 45));
        return;
      }
      cb(datapoints);
    });
    //------------------ conn on close -----------------------
    conn.on('close', function() {
      delete conn._bufferParser;
      log.info("client disconnected (fd %d)", fd);
    });
  })
  //------------------ server on error -----------------------
  .on('error', function(err) {
    log.error('socket error: %s', err);
  })
  //-------------------- bind server -----------------------
  .listen(port, function() {
    log.info("listening on port %d..", port);
  });
  return this;
};

/**
 * Create beanstalk client and patch it.
 */
Service.prototype.createBeansClient = function() {
  var host = config.beanstalkd.host;
  var port = config.beanstalkd.port;
  this.beans = new fivebeans.client(host, port);
  util.patchBeansClient(this.beans);
  return this;
};

/**
 * Connect to beanstalkd (yield blocking).
 *
 *   @param {String} action // 'use'/'watch'
 */
Service.prototype.connectBeans = function *(action) {
  var self = this,
      beans = this.beans,
      tube = config.beanstalkd.tube;
  action = action || 'use';

  beans.on('connect', function() {
    beans[action](tube, function(err) {
      if (err)
        throw err;
      log.info('beanstalkd connected, %s tube %s', action, tube);
      self.emit('beans connected');
    });
  }).connect();

  // yield until beans was connected
  yield function(done) {
    self.on('beans connected', done);
  };

  return this;
};

/**
 * Create ssdb client pool.
 *
 * @return {Service} // this
 */
Service.prototype.createSsdbPool = function() {
  var options = {
    port: config.ssdb.port,
    host: config.ssdb.host,
    size: config.ssdb.size,
    promisify: true
  };

  if (config.ssdb.auth && config.ssdb.auth.length > 0) {
    options.auth = config.ssdb.auth;
  }
  this.ssdb = ssdb.createPool(options);
  return this;
};

/**
 * Create sequelize instance.
 *
 * @return {Service} // this
 */
Service.prototype.createSequelize = function() {
  this.sequelize = new Sequelize(null, null, null, {
    dialect: 'sqlite',
    storage: config.sqlite.file,
    logging: false,
  });
  return this;
};

module.exports = Service;
