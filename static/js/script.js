(function(){
  /**
   * cubism context with default settings
   */
  var context = cubism.context()
  .serverDelay(0)
  .clientDelay(0)
  .step(1e4)  // 10 seconds
  .size(3 * 60 * 60 / 10)  // 3 hours / 10s
  ;

  /**
   * parameters from node-bell backend
   */
  var pattern;
  var sort;
  var limit;
  var type;
  var past;
  var stop;
  var timestep;
  var api;
  // the seconds past
  var pastSecs;

  /**
   * document elements
   */
  var chartUntilSpan = document.getElementById('chart-until');
  var chartTimeStepSpan = document.getElementById('chart-timestep');
  var loader = document.getElementById('loader');


  /**
   * entry function
   */
  this.initBell = function(pattern_, sort_, limit_, type_, past_, stop_,
                           api_) {
    pattern = pattern_;
    sort = sort_;
    limit = limit_;
    type = type_;
    past = past_;
    stop = stop_;
    api = api_;

    pastSecs = timespan2secs(past);

    // reset context
    context
    .serverDelay(pastSecs * 1e3)  // past
    ;

    // stop update
    if (stop === 1) {
      context.stop();
    }

    plot();

    if (stop === 0) {
      setInterval(function(){
        d3.select('#chart').selectAll('*').remove();
        plot();
      }, 10 * 60 * 1e3);  // replot every 10 min
    }
  };


  /**
   * 'GET' request an url, and call callback with responsed JSON data
   *
   * @param {String} url
   * @param {Function} callback  // callback: @param {Object} data
   */
  function request(url, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open('GET', url, true);
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
        var data = JSON.parse(xmlhttp.responseText);
        callback(data);
      }
    };
  }


  /**
   * >Metrics source
   *
   * @param {String} name
   * @return {Object}  // context.metric
   */
  function makeMetric(name) {
    return context.metric(function(start, stop, step, callback){
      // cast to timestamp from date
      start = (+start - pastSecs) / 1e3;
      stop = (+stop - pastSecs) / 1e3;
      step = +step / 1e3;

      // api url to fetch metrics
      var url = [api, 'metrics'].join('/') + '?' + buildUrlParams({
        name: name,
        type: type,
        start: start,
        stop: stop
      });
      var values = [], i = 0;

      /**
       * request data and call callback with values
       *
       * data schema: {times: {Array}, vals: {Array}}
       */
      request(url, function(data){
        // the timestamps from statsd DONT have exactly steps `10`
        while (start < stop) {
          while (start < data.times[i]) {
            start += step;
            values.push(start > data.times[i] ? data.vals[i] : 0);
          }
          values.push(data.vals[i++]);
          start += step;
        }
        callback(null, values);
      });

      // udpate time range div
      chartUntilSpan.innerHTML = secs2str(stop);
    }, name);
  }


  /**
   * make a horizon chart (hmm, horizon chart is amazing..)
   */
  function horizon() {
    var hrz = context.horizon();

    if (type === 'm') {
      return hrz
      .extent([-2, 2])
      .mode('mirror')
      .colors(['#dd1144', 'teal', 'teal', '#dd1144'])
      ;
    } else if (type === 'v') {
      return hrz;
    }
  }


  /*
   * plot
   */
  function plot () {
    var url = [api, 'names'].join('/') + '?' + buildUrlParams({
      pattern: pattern,
      limit: limit,
      sort: sort
    });

    request(url, function(names){
      // hide loader
      loader.style.display = 'none';

      var data = [];
      for (var i = 0; i < names.length; i++) {
        data.push(makeMetric(names[i]));
      }

      d3.select('#chart').call(function(div) {
        div.append('div')
        .attr('class', 'axis')
        .call(context.axis().orient('top'));

        div.selectAll('.horizon')
        .data(data)
        .enter().append('div')
        .attr('class', 'horizon')
        .call(horizon());

        div.append('div')
        .attr('class', 'rule')
        .call(context.rule());
      });

      d3.selectAll('.title')
      .html(function(d){
        var name = d.toString();
        var params = {
          sort: sort,
          limit: 1,
          type: type,
          past: past
        };
        var url = root + name + '?' + buildUrlParams(params);
        return '<a href="' + url + '">' + name + '</a>';
      });
    });
  }

  /*
   * cubism context rule
   */
  context.on('focus', function(i){
    d3.selectAll('.value')
    .style('right', i === null ? null : context.size() - i + 'px');
  });
})(this);


/**
 * build url parameters
 *
 * example
 *
 *   buildUrlParams({'name': 'mike', 'age': 3})
 *   // => 'name=mike&age=3'
 *
 * @param {String} dict
 * @return {String}
 */

function buildUrlParams(dict) {
  var list = [];
  for (var key in dict) {
    list.push([key, '=', dict[key]].join(''));
  }
  return list.join('&');
}


/**
 * convert string format timespan to seconds
 *
 * example:
 *
 *   timespan2secs('1d')
 *   // => 86400
 *   timespan2secs('1h')
 *   // => 3600
 *   timespan2secs('1h2m')
 *   // => 3720
 *
 * @param {String} timespan
 * @return {Number}
 */
function timespan2secs(timespan) {
  var map = {
    's': 1,
    'm': 60,
    'h': 60 * 60,
    'd': 24 * 60 * 60
  };

  var secs = 0;

  while (timespan.length > 0) {
    for (var i = 0; i < timespan.length; i++) {
      var ch = timespan[i];
      var measure = map[ch];

      if (!isNaN(measure)) {
        var count = +timespan.slice(0, i);
        secs += count * measure;
        timespan = timespan.slice(i + 1);
        break;
      }
    }

    if (i === timespan.length) {
      return secs;
    }
  }

  return secs;
}


/**
 * convert unix timestamp to readable string format
 *
 * @param {Number} secs
 * @return {String}
 */
function secs2str(secs) {
  var date = new Date(secs * 1000);
  // getMonth() return 0~11 numbers
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();

  // normalize
  month = ('00' + month).slice(-2);
  day = ('00' + day).slice(-2);
  hours = ('00' + hours).slice(-2);
  minutes = ('00' + minutes).slice(-2);
  seconds = ('00' + seconds).slice(-2);

  return [month, day].join('/') + ' ' + [hours, minutes, seconds].join(':');
}
