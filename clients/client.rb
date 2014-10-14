# Node-Bell Ruby client example
# Copyright (c) 2014 Eleme, Inc. https://github.com/eleme/node-bell
#
# Usgae
#
#   client = Client.new
#
#   loop do
#     sleep(10)
#     client.send [['foo', [1412762335, 3.14]], ['bar', [1412762335, 314]]]
#   end

require 'json'
require 'socket'


class Client

  def initialize(host = "0.0.0.0", port = 8889)
    @host = host
    @port = port
    @sock = nil
  end

  def send(datapoints)
    if @sock.nil?
      @sock = TCPSocket.new(@host, @port)
    end
    str = datapoints.to_json
    buf = str.length.to_s + "\n" + str
    @sock.send buf, 0
    @sock.flush
  end

end
