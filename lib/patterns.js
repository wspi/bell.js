/**
 * default patterns.
 *
 * Schema:
 *
 *   {item: {subItem: pattern, ..}}
 */

exports = module.exports = {
  timer: {
    count_ps: 'timer.count_ps.*',
    upper_90: 'timer.upper_90.*'
  },
  counter: {
    rate: 'counter.*'
  }
};
