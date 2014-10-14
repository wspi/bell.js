# coding=utf8

"""
Node-Bell Python (2 & 3) client example.
Copyright (c) 2014 Eleme, Inc. https://github.com/eleme/node-bell

Usage:

    client = Client(host='0.0.0.0', port=8889)
    while 1:
        time.sleep(10)
        client.send([['foo', [1412762335, 3.14]], ['bar', [1412762335, 314]]])
"""

import sys
import json
import socket


if sys.version > '3':
    # binary: cast str to bytes
    binary = lambda string: bytes(string, 'utf8')
    # string: cast bytes to native string
    string = lambda binary: binary.decode('utf8')
else:
    binary = str


class Client(object):

    def __init__(self, host='0.0.0.0', port=8889):
        self.host = host
        self.port = port
        self.sock = None

    def connect(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.setblocking(1)
        self.sock.connect((self.host, self.port))

    def send(self, datapoints):
        if self.sock is None:
            self.connect()
        string = json.dumps(datapoints)
        buf = '\n'.join([str(len(string)), string])
        return self.sock.sendall(binary(buf))
