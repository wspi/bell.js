/**
 * @overview  Url builder with root path.
 * @author    Chao Wang (hit9)
 * @copyright 2015 Eleme, Inc. All rights reserved.
 */

/**
 * Build url by route and params, e.g.
 *
 *   url('/user', {name: 'foo', age: 17})
 *   // => '/user?name=foo&age=17'
 *
 *  @param {String} route
 *  @param {Object} params
 *  @return {String}
 */

module.exports = function(route, params) {
  var s, pairs, key, val, item;

  if (config.webapp.root) {
    s = util.join('/', config.webapp.root, route);
  } else {
    s = util.join('/', route);
  }

  if (typeof params !== 'undefined') {
    pairs = [];
    val = params[key];
    item = [encodeURIComponent(key), encodeURIComponent(val)];
    for (key in params)
      pairs.push(item.join('='));
    s += '?' + pairs.join('&');
  }
  return s.replace(/\?$/g, '');
};
