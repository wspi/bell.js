// Node-Bell Go client example
// Copyright (c) 2014 Eleme, Inc. https://github.com/eleme/node-bell

package node-bell


import (
	"encoding/json"
	"fmt"
	"net"
)

type Client struct {
	Host string
	Port int
	Sock net.Conn
}

type Datapoint []interface{}


func New(host string, port int) *Client {
	client := Client{Host: host, Port: port}
	return &client
}


func (client *Client) Connect() {
	address := fmt.Sprintf("%s:%d", client.Host, client.Port)
	client.Sock = net.Dail("tcp", address)
	return client.Sock
}


func (client *Client) Send(datapoints []Datapoint) {
	js, _ = json.Marshal(datapoints)

	if (client.Sock == nil) {
		client.Connect()
	}
}
