// The based service function, interface to be inherited:
//
//   - createBeansClient()  => service.beans
//   - createSsdbPool() => service.ssdb
//   - createSocketServer(port, callback)  => service.sock
//

'use strict';

const events = require('events');
const fivebeans = require('fivebeans');
const net = require('net');
const logging = require('logging.js');
const inherits = require('util').inherits;
const ssdb = require('ssdb');
const configs = require('./configs');
const protocol = require('./protocol');
const patches = require('./util').patches;

const log = logging.get('service');

function BufferParser() {
  this.unfinished = new Buffer('');
}

// Parse buffer to string chunks
//
// @param {Buffer} buf
// @return {Array}  // datapoints
//
BufferParser.prototype.parse = function(buf) {
  // pick up the unfinished buffer last time
  buf = Buffer.concat([this.unfinished, buf]);
  var result = protocol.decode(buf);
  this.unfinished = result[1];
  return result[0];
};

function Service() {
  events.EventEmitter.call(this);
}
inherits(Service, events.EventEmitter);

// Sockect server creator
//
// @param {Number} port
// @param {Function} callback  // callback(datapoints)
//
Service.prototype.createSocketServer = function(port, host, callback) {
  this.sock = net.createServer(function(conn) {

    if (!conn._bellBufferParser) {
      conn._bellBufferParser = new BufferParser();
    }

    var fd = conn._handle.fd;
    log.info('New connection established, fd: %d', fd);

    conn.on('data', function(buf) {
      try {
        var datapoints = conn._bellBufferParser.parse(buf);
      } catch (e) {
        log.warn('Invalid input: %s', buf.slice(0, 45));
        return;
      }
      callback(datapoints);
    });

    conn.on('close', function() {
      delete conn._bellBufferParser;
      log.info('Client disconnected, fd: %d', fd);
    });
  })
  .on('error', function(err) {
    log.error('Socket error: %s', err);
  })
  .listen(port, host, function() {
    log.info('Listening on port: %d..', port);
  });

  return this;
};

Service.prototype.createBeansClient = function() {
  var host = configs.beanstalkd.host;
  var port = configs.beanstalkd.port;

  this.beans = new fivebeans.client(host, port); // eslint-disable-line
  patches.patchBeansClient(this.beans);
  return this;
};

// @param {String} action // 'use'/'watch'
Service.prototype.connectBeans = function *(action) {
  action = action || 'use';

  var self = this;
  var beans = this.beans;
  var tube = configs.beanstalkd.tube;
  var _action = {use: 'using', watch: 'watching'}[action];

  beans.on('connect', function() {
    beans[action](tube, function(err) {
      if (err) {
        throw err;
      }
      log.info('Beanstalkd connected, %s tube %s', _action, tube);
      self.emit('beans connected');
    });
  }).connect();

  // yield until beans was connected
  yield function(done) {
    self.on('beans connected', done);
  };

  return this;
};

Service.prototype.createSsdbPool = function() {
  var options = {
    port: configs.ssdb.port,
    host: configs.ssdb.host,
    size: configs.ssdb.size,
    promisify: true
  };

  if (configs.ssdb.auth && configs.ssdb.auth.length > 0) {
    options.auth = configs.ssdb.auth;
  }
  this.ssdb = ssdb.createPool(options);
  return this;
};

exports = module.exports = Service;
