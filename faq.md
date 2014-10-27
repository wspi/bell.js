Node-bell FAQ
=============

Write a client
--------------

For example, to write a common bell client via [clients/client.js](clients/client.js):

```js
var bell = require('node-bell');
var client = bell.createClient({port: 8889});

// send datapoints every 10 seconds
setInterval(function(){
  client.send([['foo', [1412762335, 3.14]], ['bar', [1412762335, 314]]])
}, 1e4);
```

For statsd users, just add `'node-bell/clients/statsd'` to statsd config:

```js
{
, backends: ['node-bell/clients/statsd']
}
```

All clients available in [clients](clients), feel free to send yours.

Analyzers Cluster
-----------------

The more metrics, the more analyzers should be up. If the analyzation cant
catch up with the incomming datapoints, we should increase analyzer instances.
[Beanstats](https://github.com/hit9/beanstats) is a simple console tool to
watch a single beanstalk tube, and show you how fast jobs are going in and
out of the queue, see also [Week Analyzation Ability](#week-analyzation-ability).

Custom Alerters
---------------

Node-Bell comes with a built-in alerter: [hipchat.js](alerters/hipchat.js), but you can completely write one
on your own, here are brief wiki:

1. An alerter is a nodejs module which should export a function `init`:

   ```js
   init(configs, alerter, log)
   ```

2. To make an alerter work, add it to `alerter.modules` in `configs.toml`:

   ```toml
   [alerter]
   modules = ["my_alerter_module"]
   ```

   and then restart service alerter.

3. Events currently available for module `alerter` (also the second parameter in the `init` function):

    - Event **'anomaly detected'**

       - Parameters: `datapoint`, an array like: `[metricName, [timestamp, metricValue, AnalyzationResult]]`
       - Emitted when an anomaly was detected.


Listener Net Protocol
---------------------

The net protocol between clients and node-bell listener is very simple:

```
Packet := Block+
Block  := Size '\n' Data
Size   := literal_integer
Data   := literal_stringify_json
```

example:

```
57
[['foo', [1412762335, 3.14]], ['bar', [1412762335, 314]]
58
[['foo', [1412762345, 3.15]], ['bar', [1412762345, 2348]]
```


Week Analyzation Ability
------------------------

What if our analyzers cannot catch up with incomming datapoints ? 
(beanstalkd hoards the jobs!)

- Increase analyzer workers.  *(Preferred solution)*
- Reduce `analyzer.filter.offset`, this makes IO faster.

Ssdb FAQ
--------

- **"Too many open files" in my ssdb log**

   You need to set your linux's max open files to at least 10k, see
   [how to](http://stackoverflow.com/questions/34588/how-do-i-change-the-number-of-open-files-limit-in-linux).

- **ssdb configuration suggestions**

   - **ssdb disk usage is too large?**

     set item `compression` to `yes` in `ssdb.conf`, or run `compact` in ssdb-cli.
