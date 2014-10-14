// Node-Bell Go client example
// Copyright (c) 2014 Eleme, Inc. https://github.com/eleme/node-bell

package node-bell


import (
	"fmt"
	"net"
)

type Client struct {
	Host string
	Port int
	Sock nil
}


func New(host string, port int) *Client {
	client := Client{Host: host, Port: port}
	return &client
}


func (client *Client) Connect() {
	address := fmt.Sprintf("%s:%d", client.Host, client.Port)
	client.Sock = net.Dail("tcp", address)
}
