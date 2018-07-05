const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/**
 * Main folders
 * @type {{APP: *, SRC: *, DIST: *}}
 */
const FOLDERS = {
  APP: path.resolve(__dirname, '../src/app'),
  SRC: path.resolve(__dirname, '../src'),
  DIST: path.resolve(__dirname, '../dist'),
};

/**
 * See: https://webpack.js.org/concepts/
 * @param mode
 * @returns {*}
 */
module.exports = function (mode) {
  return {
    mode: mode,
    entry: {
      app: path.resolve(FOLDERS.APP, 'index.js'),
    },
    output: {
      path: FOLDERS.DIST,
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          loader: 'babel-loader',
        }, {
          test: /\.scss$/, // See: https://github.com/webpack-contrib/sass-loader
          use: ['style-loader', 'css-loader', 'sass-loader'],
        }, {
          test: /\.css/, // See: https://github.com/webpack-contrib/sass-loader
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|woff|woff2|eot|ttf|svg)$/,
          loader: 'url-loader?limit=100000',
        },
      ],
    },
    resolve: {
      modules: [
        'node_modules',
        FOLDERS.APP,
      ],
      extensions: ['.js', '.json', '.jsx', '.css'],
    },
    plugins: [
      /**
       * See: https://webpack.js.org/plugins/html-webpack-plugin/
       */
      new HtmlWebpackPlugin({
        template: path.resolve(FOLDERS.SRC, 'index.html'),
      }),
      /**
       * See: https://www.npmjs.com/package/copy-webpack-plugin
       */
      new CopyWebpackPlugin([
        {from: path.resolve(FOLDERS.SRC, 'assets'), to: FOLDERS.DIST},
        {from: path.resolve(FOLDERS.SRC, 'meta'), to: FOLDERS.DIST},
      ]),
    ],
  };
};
