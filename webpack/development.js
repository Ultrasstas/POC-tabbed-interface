const webpack = require('webpack');
const path = require('path');
const merge = require('webpack-merge');
const common = require('./common');

/**
 * See: https://webpack.js.org/concepts/
 */
module.exports = merge(common('development'), {
  output: {
    filename: '[name].[hash].js',
  },
  devtool: 'inline-source-map',
  plugins: [
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
  ],
  devServer: {
    contentBase: path.resolve(__dirname, '../dist'),
    disableHostCheck: true,
    historyApiFallback: true,
    port: 3000,
    hot: true,
    open: true,
  },
  watch: true,
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300,
    poll: 1000,
  },
});
