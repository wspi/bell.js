/**
 * Common used node-bell client.
 *
 * Example
 *
 *    var bell = require('node-bell');
 *    var client = bell.createClient({port: 8889});
 *
 *    // send datapoints every 10 seconds
 *    setInterval(function(){
 *      client.send([['foo', [1412762335, 3.14]], ['bar', [1412762335, 314]]])
 *    }, 1e4);
 *
 * API
 *
 *   - createClient(options)
 *   - client.send(datapoints)
 *   - client.destroy()
 *
 * Events on client
 *
 *   - 'connecte'
 *   - 'error'
 *   - 'close'
 *   - 'timeout'
 *   - 'end'
 *   - 'drain'
 *
 * Net Protocol
 *
 *   Packet := Block+ '\n'
 *   Block  := Size '\n' Data
 *   Size   := literal_integer
 *   Data   := literal_stringify_json
 */

var events = require('events');
var net = require('net');
var util = require('util');


/**
 * Node-Bell client constructor
 *
 * options:
 *
 *   port, Number, default: 8889
 *   host, String, default: '0.0.0.0'
 *
 * @param {Object} options  // {port: 8889, host: '0.0.0.0'}
 * @return {Object}  // this
 */
function Client(options) {
  this.options = options;
  return this;
}
inherits(Client, events.EventEmitter);


/**
 * connect to bell listener
 *
 * @return {Object}  // this
 */
Client.prototype.connect = function() {
  this.conn = net.connect({
    host: this.options.host || '0.0.0.0',
    port: this.options.port || 8889,
  });
  this.conn.on('connect', function(){self.emit('connect');});
  this.conn.on('error', function(err){self.emit('error', err);});
  this.conn.on('timeout', function(){self.emit('timeout');});
  this.conn.on('end', function(){self.emit('end');});
  this.conn.on('close', function(){self.emit('close');});
  this.conn.on('drain', function(){self.emit('drain');});
  return this;
};


/**
 * destroy client to bell connection
 *
 * to auto reconnect:
 *
 *    client.on('error', function(){
 *      self.destroy();
 *    });
 */
Client.prototype.destroy = function() {
  this.conn.destroy();
  this.conn = undefined;
};


/**
 * send datapoints to Node-Bell
 *
 * @param {Array} datapoints  // e.g. [[name, [timestamp, value]], ..]
 * @param {Function} callback  // parameter
 * @return {Object} // this
 */
Client.prototype.send = function(datapoints, callback) {
  var string = JSON.stringify(datapoints);
  var buffer = new Buffer([string.length, string].join('\n'));

  // lazy connect
  if (!this.conn) {
    this.connect();
  }

  this.conn.write(buffer, 'utf8', callback);
};


exports.createClient = function(options) {
  return new Client(options);
};
