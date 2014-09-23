Node-bell Changelog
===================

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
