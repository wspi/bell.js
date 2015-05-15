// https://travis-ci.org/eleme/bell.js

const assert   = require('assert');
const ntt      = require('ntt');
const protocol = require('./lib/protocol');

ntt('bell', function(test) {
  test('protocol.encode', function(done) {
    var datapoints = [['foo', [1413045998, 3.0]]];
    var buf = protocol.encode(datapoints);
    var str = '24\n[["foo",[1413045998,3]]]';
    assert.equal(buf.toString(), str);
    done();
  });

  test('protocol.decode', function(done) {
    var buf = new Buffer('24\n[["foo",[1413045998,3]]]');
    var result = protocol.decode(buf);
    assert.deepEqual(result[0], [['foo', [1413045998, 3.0]]]);
    assert.deepEqual(result[1], new Buffer(''));
    done();
  });

  test('protocol.decode with unfinished data', function(done) {
    var buf = new Buffer('24\n[["foo",[1413045998,3]]]45\n["aaa');
    var result = protocol.decode(buf);
    assert.deepEqual(result, [[['foo', [1413045998, 3.0]]],
                     new Buffer('45\n["aaa')]);
    done();
  });

  test('protocol with large size data', function(done) {
    var datapoints = [];

    for (var i = 0; i < 1e4; i++) {
      datapoints.push(['foo', [i, i * 2]]);
    }

    var buf = protocol.encode(datapoints);  // length: 203k+
    var result = protocol.decode(buf);
    assert.deepEqual(result, [datapoints, new Buffer('')]);
    done();
  });

  test('protocol.decode with multiple chunks', function(done) {
    var chunks = [[['foo', [1413045998, 3.0]]], [['bar', [1413045998, 6.0]]]];
    var datapoints = [];
    var buf = new Buffer('');

    for (var i = 0; i < chunks.length; i++) {
      var chunk = chunks[i];
      buf = Buffer.concat([buf, protocol.encode(chunk)]);
      [].push.apply(datapoints, chunk);
    }

    var result = protocol.decode(buf);
    assert.deepEqual(result, [datapoints, new Buffer('')]);
    done();
  });
});
