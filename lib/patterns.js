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
    mean_90: 'timer.mean_90.*'
  },
  counter: {
    rate: 'counter.*'
  }
};
