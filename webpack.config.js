module.exports = {
  module: {
    loaders: [
      { test: /\.json$/, loader: 'json' }
    ]
  },
  output: {
    path: __dirname,
    filename: '5eShapedCompanion.js',
    library: 'ShapedScripts'
  },
  externals: {
    'underscore': '_'
  }
};
