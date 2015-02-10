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
 *
 * Actualy, this protocol can be used in any json data.
 */


/**
 * Encode datapoints to buffer
 *
 * example
 *
 *   encode([['foo', [1412073046, 3.0]]])
 *   // => Buffer('24\n[["foo",[1412073046,3]]]')
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
 * Decode buffer to chunks of datapoints
 *
 * example
 *
 *   decode(new Buffer('24\n[["foo",[1412073046,3]]]'))
 *   // => [[["foo",[1412073046,3]]],{"type":"Buffer","data":[]}]
 *
 * @param {Buffer} buf
 * @return {Array}  // [datapoints, unfinished]
 */
function decode(buf) {  // jshint ignore: line
  var chunks = [];
  var len = buf.length;

  var p = 0;  // to loop over buffer
  var q = 0;  // the index of first '\n'
  var n = 0;  // the index of next chunk

  while (p < len) {
    q = [].indexOf.apply(buf, [10, p]);

    if (q < 0) {
      // no '\n' was found
      break;
    }

    // data size infomation
    var size = +buf.slice(p, q);

    // skip '\n'
    var t = p = q + 1;  // jshint ignore: line

    // p: move to end of data
    p += size;

    if (p > len) {
      // exceeds length
      break;
    }

    var data = buf.slice(t, p);
    chunks.push(data.toString());

    // record the index of next unit
    n = p;
  }

  var unfinished = buf.slice(n);

  var datapoints = [];

  for (var i = 0; i < chunks.length; i++) {
    var chunk = JSON.parse(chunks[i]);
    [].push.apply(datapoints, chunk);
  }
  return [datapoints, unfinished];
}

exports.decode = decode;
