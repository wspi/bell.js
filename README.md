Node-Bell
=========

![build](https://travis-ci.org/eleme/node-bell.svg)

![snap](snap.png)

Node-Bell is a real-time anomalies detection system for periodic time series, built to be
able to monitor a large quantity of metrics. It collects metrics from clients like [statsd](https://github.com/etsy/statsd),
analyzes them with the [3-sigma rule](http://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule)
and visualizes results on the web. Once enough anomalies were found in a short time, it alerts
you via alerters like hipchat.

Latest version: v0.4.3

Use Case
--------

We ([Eleme](http://ele.me)) use node-bell to monitor our services interfaces, including stats:

   - interface called frequency
   - interface response time
   - exceptions count
   - etc..

Services and applications send these statistics to [statsd](https://github.com/etsy/statsd),
then statsd sends aggregates to node-bell (listener), node-bell analyzes the current stats
and show us the trending, and alerts us if the current trending behaves anomalous.
