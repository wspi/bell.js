var should = require('should');
var protocol = require('./lib/protocol');


describe('node-bell', function(){
  it('protocol.encode', function(){
    var datapoints = [['foo', [1413045998, 3.0]]];
    var buf = protocol.encode(datapoints);
    var str = '24\n[["foo",[1413045998,3]]]';
    should(buf.toString()).eql(str);
  });

  it('protocol.decode', function(){
    var buf = new Buffer('24\n[["foo",[1413045998,3]]]');
    var result = protocol.decode(buf);
    should(result[0]).eql([['foo', [1413045998, 3.0]]]);
    should(result[1]).eql(new Buffer(''));
  });

  it('protocol.decode with unfinished data', function(){
    var buf = new Buffer('24\n[["foo",[1413045998,3]]]45\n["aaa');
    var result = protocol.decode(buf);
    should(result[0]).eql([['foo', [1413045998, 3.0]]]);
    should(result[1]).eql(new Buffer('45\n["aaa'));
  });

  it('protocol with large size data', function(){
    var datapoints = [];

    for (var i = 0; i < 1e4; i++) {
      datapoints.push(['foo', [i, i * 2]]);
    }

    var buf = protocol.encode(datapoints);  // length: 203k+
    var result = protocol.decode(buf);
    should(result[0]).eql(datapoints);
    should(result[1]).eql(new Buffer(''));
  });

  it('protocol.decode with multiple chunks', function(){
    var chunks = [[['foo', [1413045998, 3.0]]], [['bar', [1413045998, 6.0]]]];
    var datapoints = [];
    var buf = new Buffer('');

    for (var i = 0; i < chunks.length; i++) {
      var chunk = chunks[i];
      buf = Buffer.concat([buf, protocol.encode(chunk)]);
      [].push.apply(datapoints, chunk);
    }

    var result = protocol.decode(buf);
    should(result[0]).eql(datapoints);
    should(result[1]).eql(new Buffer(''));
  });
});
