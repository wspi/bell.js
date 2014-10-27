Node-bell Changelog
===================

v0.4.3
------

- Built in cluster support for webapp & analyzer #57

v0.4.1
------

- Merge all patterns to one place `patterns.js`
- add trend to enters

v0.4.0
------

- Revert to old `pattern` way instead of `prefix` way

v0.3.9
------

- Use `prefix` to filter & query metrics, instead of `pattern`. issue#51

v0.3.8
------

- Add clients for py, rb, path change: 'upstream' => 'clients'
- Add `cache` for webapp, issue#41, commit#3e1d7272cb7c6065e9cf41f6dc574fcbf956d5e3

v0.3.7
------

- New protocol for listener <=> clients & analyzers <=> alerter  issue#42

v0.3.6
-------

- issue#32 https://github.com/eleme/node-bell/issues/32
   - add comman used client
   - export statsd as `node-bell/upstream/statsd`

v0.3.5
------

- default timer type 'upper_90' => 'mean_90'
- minor fixes (including css, typo..)

v0.3.4
------

- add new service cleaner, issue#29
- trending with time relatived, issue#30

v0.3.3
------

- remove `trending values` support, new trending: z-score + wma
- add option `stop` to webapp
- multi can be negative values now
- trending up/down in alerter
- simple loader gif to webapp

v0.3.2
------

- make `analyzer.filter` async, analyzer is faster
- switch logging library from @TJ log.js to bunyan.
- analyzers/webapp cluster how to in faq.md
- trending: using `wma & zset`, no more `hash` or `zcount`
- ability to see history data
- rebuild alerter, using ssdb `setx`
