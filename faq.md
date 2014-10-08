Node-bell FAQ
=============

Analyzers Cluster
-----------------

The more metrics, the more analyzers should be up. If the analyzation cant
catch up with the incomming datapoints, we should increase analyzer instances.
[Beanstats](https://github.com/hit9/beanstats) is a simple console tool to 
watch a single beanstalk tube, and show you how fast jobs are going in and 
out of the queue.

We can start multiple analyzers via [cluster-master](https://github.com/isaacs/cluster-master),
for example, `analyzer-cluster.js`:

```js
var clusterMaster = require('cluster-master');

clusterMaster({
  exec: '/usr/bin/bell',  // bell bin path
  size: 5,  // workers count
  args: ['analyzer', '-c', './configs.toml']
})
```

run it like this:

```bash
$ node --harmony-generators analyzer-cluster.js
```

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
