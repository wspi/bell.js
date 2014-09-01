/**
 * Tthe based service function, interface to be inherited:
 *
 *   - createSocketServer(port, callback)  => service.sock
 *   - createBeansClient()  => service.beans
 *   - createSsdbClient() => service.ssdb
 */

var events = require('events');
var net = require('net');
var inherits = require('util').inherits;
var fivebeans = require('fivebeans');
var ssdb = require('ssdb');
var configs = require('./configs');
var patches = require('./util').patches;
var fatal = require('./util').fatal;
var idm = require('./util').idm;
var log = require('./util').log;


/**
 * incoming buffer parser
 *
 * net protocols between sockets (statsd -> listener & analyzers -> alerter)
 * are the same:
 *   response: <size>\n<body>
 */
function bufferParser() {}


/**
 * parse buffer to string chunks
 *
 * @param {Buffer} buf
 * @return {Array}
 */
bufferParser.prototype.parse = function(buf) {
  this.unfinished = this.unfinished || '';
  var data = this.unfinished + buf.toString();
  this.unfinished = '';

  var cursor = 0, last = 0, chunks = [];

  while (cursor < data.length) {
    var pos = data.indexOf('\n', cursor);

    if (pos > 0) {
      var sstr = data.slice(cursor, pos);
      cursor = ++pos;
      var size = parseInt(sstr, 10);
      var body = data.slice(cursor, cursor + size);
      cursor += size;
      if (cursor <= data.length) {
        chunks.push(body);
        last = cursor;
      }
    }
  }

  if (cursor > data.length) {
    this.unfinished = data.slice(last);
  }

  return chunks;
};


/**
 * the basic service function
 */
function Service() {
  events.EventEmitter.call(this);
}
inherits(Service, events.EventEmitter);


/**
 * sockect server creator
 * @param {Number} port
 * @param {Function} callback
 * @api public
 */
Service.prototype.createSocketServer = function(port, callback) {
  var self = this;

  if (!this.bufferParser) {
    this.bufferParser = new bufferParser();
  }

  this.sock = net.createServer(function(conn) {
    conn.id = idm.create();
    log.info('New connection established, id: %d', conn.id);

    conn.on('data', function(buf) {
      var chunks = self.bufferParser.parse(buf);
      callback(chunks);
    });

    conn.on('close', function(){
      log.info('Client disconnected, id: %d', idm.remove(conn.id));
    });
  })
  .on('error', function(err){
    log.error('Socket error: %s', err);
  })
  .listen(port, function() {
    log.info('Listening on port: %d..', port);
  });

  return this;
};


/**
 * beanstalk client creator
 */
Service.prototype.createBeansClient = function() {
  var host = configs.beanstalkd.host;
  var port = configs.beanstalkd.port;

  this.beans = new fivebeans.client(host, port);
  patches.patchBeansClient(this.beans);
  return this;
};


/**
 * connect beanstalkd the sync like way
 */
Service.prototype.connectBeans = function *(action) {
  // action: 'use' / 'watch'
  action = action || 'use';

  var self = this;
  var beans = this.beans;
  var tube = configs.beanstalkd.tube;
  var _action = {use: 'using', watch: 'watching'}[action];

  beans.on('connect', function(){
    beans[action](tube, function(e, _){
      log.info('Beanstalkd connected, %s tube %s', _action, tube);
      self.emit('beans connected');
    });
  }).connect();

  beans.on('error', function(err){
    fatal('Beanstalkd connect error: %s', err);
  });

  // yield until beans was connected
  yield function(done) {
    self.on('beans connected', done);
  };

  return this;
};


/**
 * create this service a ssdb client
 */
Service.prototype.createSsdbClient = function() {
  var options = {
    port: configs.ssdb.port,
    host: configs.ssdb.host
  };
  this.ssdb = ssdb.createClient(options).thunkify();
  this.ssdb.on('error', function(err){
    fatal('SSDB connect error: %s', err);
  });
  return this;
};


exports = module.exports = Service;
