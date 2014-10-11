/**
 * Net protocol between sockets. (clients <=> listener & analyzers <=> alerter)
 *
 *   Packet := Block+
 *   Block  := Size '\n' Data
 *   Size   := literal_integer
 *   Data   := literal_stringify_json
 *
 * this module exports two apis:
 *
 *   * encode   encode datapoints to buffer
 *   * decode   decode buffer to chunks of datapoints
 */


/**
 * encode datapoints to buffer
 *
 * example
 *
 *   encode([['foo', [1412073046, 3.0]]])
 *   // => Buffer('')
 *
 * @param {Array} datapoints
 * @return {Buffer}
 */
function encode(datapoints) {
  var str = JSON.stringify(datapoints);
  var len = Buffer.byteLength(str);
  var buf = new Buffer([len, str].join('\n'));
  return buf;
}

exports.encode = encode;


/**
 * decode buffer to chunks of datapoints
 *
 * @param {Buffer} buf
 * @return {Array}  // [datapoints, unfinished]
 */
function decode(buf) {
}
