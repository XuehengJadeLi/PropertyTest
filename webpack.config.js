"use strict";
const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

const cesiumSource = path.resolve(__dirname, "node_modules/cesium/Build/Cesium");

module.exports = {
  context: __dirname,
  entry: {
    app: "./src/index.js",
  },
  output: {
    filename: "app.js",
    path: path.resolve(__dirname, "dist"),
    sourcePrefix: "",
    clean: true,
    publicPath: '/'
  },
  resolve: {
    fallback: { 
      "https": false, 
      "zlib": false, 
      "http": false, 
      "url": require.resolve("url/"),
      "punycode": require.resolve("punycode/"),
      "IPv6": false,
      "SecondLevelDomains": false
    },
    alias: {
      cesium: path.resolve(__dirname, "node_modules/cesium")
    }
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|gif|jpg|jpeg|svg|xml|json)$/,
        type: "asset/resource",
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", { 
                "targets": "defaults",
                "modules": false
              }]
            ],
            plugins: [
              "@babel/plugin-transform-runtime",
              "@babel/plugin-syntax-import-meta"
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "src/index.html",
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(cesiumSource, "Workers"),
          to: "Workers"
        },
        {
          from: path.join(cesiumSource, "ThirdParty"),
          to: "ThirdParty"
        },
        {
          from: path.join(cesiumSource, "Assets"),
          to: "Assets"
        },
        {
          from: path.join(cesiumSource, "Widgets"),
          to: "Widgets"
        }
      ]
    }),
    new webpack.DefinePlugin({
      CESIUM_BASE_URL: JSON.stringify("")
    }),
    new NodePolyfillPlugin()
  ],
  mode: "development",
  devtool: "eval",
  devServer: {
    port: 8080,
    hot: true,
    open: true,
    static: {
      directory: path.join(__dirname, "dist")
    }
  }
};