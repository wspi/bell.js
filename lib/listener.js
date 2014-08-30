/**
 * Receive metrics from statsd-bell over ctp and unpack them, then put
 * metrics to job queue.
 */

var net = require('net');
var inherits = require('util').inherits;
var minimatch = require('minimatch');
var configs = require('./configs');
var service = require('./service');
var log = require('./util').log;
var idm = require('./util').idm;


/**
 * incoming buffer parser
 */
function Parser() {}


/**
 * parse buffer to string chunks
 */
Parser.prototype.parse = function(buf) {
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
 * listener, socket evented
 */
function Listener() {}
inherits(Listener, service);


/**
 * sockect server creator
 */
Listener.prototype.createSocketServer = function() {
  var self = this;
  var port = configs.listener.port;

  this.sock = net.createServer(function(conn) {
    conn.id = idm.create();
    log.info('New connection established, id: %d', conn.id);
    conn.on('end', function(){
      log.info('Client disconnected, id: %d', idm.remove(conn.id));
    });
    conn.on('data', function(buf) {
      return self.parse(buf);
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
 * test if a metric matches our patterns
 */

Listener.prototype.match = function(name) {
  var matches = configs.listener.patterns.matches;
  var ignores = configs.listener.patterns.ignores;

  for (var i = 0; i < matches.length; i++) {
    if (minimatch(name, matches[i])) {
      for (var k = 0; k < ignores.length; k++) {
        if (minimatch(name, ignores[k])) {
          log.debug('%s matches ignore pattern %s', name, ignores[k]);
          return false;
        }
      }
      return true;
    }
  }
  log.debug('%s dosent match any match patterns', name);
  return false;
};


/**
 * put a job to beanstalkd
 */

Listener.prototype.putJob = function(data) {
  var job = JSON.stringify(data);
  return this.beans.put(0, 0, 60, job, function(err, jid){
    // put(priority, delay, ttr, payload, callback)
    if (err) {
      log.warnig('Error on putting job: %s, error: %s', job, err);
    } else {
      log.info('Queued: %s, job id: %d', job, jid);
    }
  });
};


/**
 * parser creator
 */
Listener.prototype.createParser = function() {
  this.parser = new Parser();
  return this;
};


/**
 * parse incoming buffer
 */
Listener.prototype.parse = function(buf) {
  var i;
  var metrics = [];
  var chunks = this.parser.parse(buf);

  for (i = 0; i < chunks.length; i++) {
    var list = JSON.parse(chunks[i]);
    Array.prototype.push.apply(metrics, list);
  }

  for (i = 0; i < metrics.length; i++) {
    var metric = metrics[i];
    if (this.match(metric[0]) && metric[1][1] !== null) {
      this.putJob(metric);
    }
  }
};


/**
 * serve forever
 */
Listener.prototype.serve = function *() {
  this.createParser()
  .createSocketServer()
  .createBeansClient();

  yield this.connectBeans('use');
};

exports = module.exports = new Listener();
