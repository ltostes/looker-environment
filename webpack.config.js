const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  entry: {
    myCustomViz: "./src/visualizations/my-custom-viz.tsx",
    portfolioPeriodTable: "./src/visualizations/portfolio-period-table.tsx",
    observablePlotPrototyper: "./src/visualizations/observableplot_prototyper.tsx"
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "dist"),
    library: "[name]",
    libraryTarget: "umd"
  },
  resolve: {
    extensions: [".ts", ".js", ".scss", ".css"]
  },
  plugins: [],
  module: {
    rules: [
    { test: /\.js$/, loader: "babel-loader" },
    { test: /\.tsx$/, use: ["babel-loader","ts-loader"] },
      { test: /\.ts$/, loader: "ts-loader" },
      { test: /\.css$/, use: [ "to-string-loader", "css-loader" ] },
      { test: /\.scss$/,
        use: [
          "style-loader",
          "css-loader",
          "sass-loader",
        ]
      }
    ]
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()]
  },
  devServer: {
    static: "./dist",
    compress: true,
    port: 3443,
    https: true
  },
  devtool: "eval",
  watch: true
};
