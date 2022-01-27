const path = require('path');
const glob = require('glob');
const webpack = require('webpack');
const fs = require('fs');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CleanTerminalPlugin = require('clean-terminal-webpack-plugin');

const common = {
  context: __dirname,
  output: {
    filename: '[name].js',
    libraryTarget: 'amd',
    path: path.resolve(__dirname, 'FileCabinet/SuiteScripts/BerganKDV'),
  },
  resolve: {
    extensions: ['.ts', '...'],
    alias: {
      'N': 'node_modules/@hitc/netsuite-types/N',
      'N/*': 'node_modules/@hitc/netsuite-types/N/*',
    },
  },
  cache: {
    type: 'memory',
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: false,
          mangle: false,
          keep_classnames: true,
          keep_fnames: true,
          format: {
            beautify: true,
            comments: /ISC, Copyright \(c\) \d{4}, BerganKDV/,
            indent_level: 2,
          },
        },
        extractComments: false,
      }),
    ],
  },
  plugins: [
    new webpack.WatchIgnorePlugin({
      paths:[
        /\.js$/,
        /\.d\.ts$/
      ],
    }),
    new ESLintPlugin({
      files: './src/**/*.ts',
      cache: true,
    }),
    new ForkTsCheckerWebpackPlugin({
      eslint: {
        files: './src/**/*.ts',
      },
    }),
    new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, /en$/),
    new webpack.BannerPlugin({
      banner: (data) => {
        const filename = path.resolve(__dirname, `src${data.chunk.name}.ts`);
        const contents = fs.readFileSync(filename, 'UTF-8');
        const comments = contents.match(/\/\*[\s\S]*?\*\//);
        const buildDate = new Date().toLocaleString();
        const license = `ISC, Copyright (c) ${new Date().getFullYear()}, BerganKDV`;
        return comments && comments.length ? comments[0].replace(/^(\s*?)(\*\/)$/m, `$1* Build Date: ${buildDate}$1* License: ${license}$1$2`) : '';
      },
      raw: true,
      entryOnly: true,
    }),
    new CleanTerminalPlugin(),
  ],
  externals: [
    /^N\//,
    /netsuite_modules/,
  ],
  stats: {
    preset: 'minimal',
  },
};

const client = {
  entry: glob.sync('./src/Client/**/*.ts').reduce((obj, el) => {
    obj[el.replace(/(\.\/src)|(\.ts)/g, '')] = el;
    return obj;
  }, {}),
  target: 'es5',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
              },
              target: 'es5',
            },
          },
        },
      },
    ],
  },
  ...common,
}

const server = {
  entry: glob.sync('./src/**/*.ts', { 'ignore': ['./src/Client/**', './src/netsuite_modules/**'] }).reduce((obj, el) => {
    obj[el.replace(/(\.\/src)|(\.ts)/g, '')] = el;
    return obj;
  }, {}),
  target: 'es2019',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
              },
              target: 'es2019',
            },
          },
        },
      },
    ],
  },
  ...common,
}

module.exports = [client, server];