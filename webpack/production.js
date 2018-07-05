const merge = require('webpack-merge');
const common = require('./common');

/**
 * See: https://webpack.js.org/concepts/
 */
module.exports = merge(common('production'), {
  output: {
    filename: '[hash].js',
  },
  optimization: {
    minimize: true,
  },
});
