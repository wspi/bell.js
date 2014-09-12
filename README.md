Bell
====

Bell is a realtime anomalies detection system, designed only for periodic time series,
built to be able to monitor thousands of metrics.
It collects metrics from [statsd](https://github.com/etsy/statsd), analyzes them
with the [3-sigma rule](http://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule)
, and visualizes analyzation results on the web. Once enough anomalies were found in
a short time, it alerts you via alerters like hipchat etc.

![](https://github.com/eleme/node-bell/raw/master/snap.png)

Latest version: v0.3.0

Requirements
------------

- [node.js](http://nodejs.org/) 0.11.x  (bell is written in nodejs)
- [ssdb](https://github.com/ideawu/ssdb) 1.6.8.8+  (datastore)
- [beanstalkd](https://github.com/kr/beanstalkd)  (job queue between listener and analyzers)
- [statsd](https://github.com/etsy/statsd)  (metrics source)

Installation
------------

```bash
npm install node-bell -g
```

then add `node-bell` to statsd's backends in statsd's config.js:

```js
{
, backends: ["node-bell"]
}
```

Quick Start
-----------

1. Start ssdb & beanstalkd & statsd
2. Generate sample configuration and edit it, default [config/configs.toml](config/configs.toml):

   ```bash
   $ bell -s
   $ mv sample.configs.toml configs.toml
   $ vi configs.toml
   ```
3. Start listener & analyzers (optional: webapp).

   ```bash
   bell analyzer -c configs.toml
   bell listener -c configs.toml  # default port: 8889
   bell webapp -c configs.toml  # default port: 8989
   bell alerter -c configs.toml  # default port: 8789
   ```

Services
--------

1. **listener**: receives incoming metrics from statsd, then put them to job queue.
2. **analyzer(s)**: get job from job queue, and then analyze if current metric an anomaly or not.
3. **webapp**: visualizes analyzation result on web.
4. **alerter**: alerts once enough anomalies were detected.

Write my own alerters
---------------------

Bell comes with a built-in alerter: [hipchat.js](alerters/hipchat.js), but you can completely write one
on your own, here are brief steps:

1. An alerter is a nodejs module which should export a function `init`:

   ```js
   init(configs, alerter, log)
   ```

2. Complete the module and add it to `alerter.modules` in [configs.toml](config/configs.toml):

   ```toml
   [alerter]
   modules = ["my_module"]
   ```

3. Restart service alerter.


And events currently available for module `alerter` (also the second parameter in the `init` function):

- Event **'anomaly detected'**

   Parameters: `datapoint` , an array like `[metric_name, [timestamp, metric_value, analyzation_result]]`

   Emitted when an anomaly was detected.

Look Inside
-----------

### Algorithm  (How do you actually detect anomalies?)

See **3-sigma** or called **68-95-99.7** rule, [reference](http://en.wikipedia.org/wiki/68%E2%80%9395%E2%80%9399.7_rule)

### Storage

Analyzers store metrics in ssdb, using zset, here is storage format for a single time series:

```
key       |  score
-----------------------------------------------
timestamp | value:anomalous multiples:timestamp
```

### Data Flow


```
 [statsd]
    |
    v        send to queue
[listener] -----------------> [beanstalkd]
                                  |
                                  | reserve
            history metrics       v     anomalies detected
            ---------------> [analyzers] ------------------
            |                     |                       |
            |                     | put to ssdb           |
            |                     v                       V
            ------------------- [ssdb]                [alerter]
                                  |
                                  v
                               [webapp]
```

Questions?
----------

See [faq.md](faq.md) or open an issue.

License
--------

MIT.  Copyright (c) 2014 Eleme, Inc.
