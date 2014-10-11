var should = require('should');
var protocol = require('./lib/protocol');


describe('node-bell', function(){
  it('protocol.encode', function(){
    var datapoints = ['foo', [1413045998, 3.0]];
    var buf = protocol.encode(datapoints);
    var str = '22\n["foo",[1413045998,3]]';
    should(buf.toString()).eql(str);
  });

  it('protocol.decode', function(){
    var buf = new Buffer('22\n["foo",[1413045998,3]]');
    var result = protocol.decode(buf);
    should(result[0]).eql(['foo', [1413045998, 3.0]]);
    should(result[1]).eql(new Buffer(''));
  });

  it('protocol.decode with unfinished data', function(){
    var buf = new Buffer('22\n["foo",[1413045998,3]]45\n["aaa');
    var result = protocol.decode(buf);
    should(result[0]).eql(['foo', [1413045998, 3.0]]);
    should(result[1]).eql(new Buffer('45\n["aaa'));
  });
});
