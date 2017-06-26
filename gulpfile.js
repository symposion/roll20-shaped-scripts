'use strict';
const gulp = require('gulp');
const mocha = require('gulp-mocha');
const eslint = require('gulp-eslint');
const webpack = require('webpack-stream');
const tagVersion = require('gulp-tag-version');
const bump = require('gulp-bump');
const git = require('gulp-git');
const conventionalChangelog = require('gulp-conventional-changelog');
const conventionalRecommendedBump = np(require('conventional-recommended-bump'));
const gulpIgnore = require('gulp-ignore');
const readPkg = require('read-pkg');
const injectVersion = require('gulp-inject-version');
const toc = require('gulp-doctoc');
const webpackConfig = require('./webpack.config.js');
const addSrc = require('gulp-add-src');
const concat = require('gulp-concat');

gulp.task('default', ['test', 'lint'], () => runWebpackBuild());

gulp.task('lint', () =>
  gulp.src('./lib/**/*.js')
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
);

gulp.task('test', () =>
  gulp.src('test/test-*.js', { read: false })
    .pipe(mocha())
);

gulp.task('buildReleaseVersionScript', ['bumpVersion'], () => runWebpackBuild());

gulp.task('release', ['changelog', 'doctoc', 'buildReleaseVersionScript'], (done) => {
  // Get all the files to bump version in
  gulp.src(['./package.json', './CHANGELOG.md', './README.md'])
    .pipe(git.commit('chore(release): bump package version and update changelog [ci skip]', { emitData: true }))
    .pipe(gulpIgnore.exclude(/CHANGELOG.md|README.md/))
    // **tag it in the repository**
    .pipe(tagVersion({ prefix: '' }))
    .on('end', done);
  return undefined;
});

gulp.task('doctoc', () =>
  gulp.src('README.md')
    .pipe(toc({ depth: 2 }))
    .pipe(gulp.dest('./'))
);


gulp.task('changelog', ['bumpVersion'], () =>
  gulp.src('./CHANGELOG.md', { buffer: false })
    .pipe(conventionalChangelog({ preset: 'angular' }, { currentTag: readPkg.sync().version }))
    .pipe(gulp.dest('./'))
);

gulp.task('bumpVersion', (done) => {
  conventionalRecommendedBump({ preset: 'angular' })
    .then(result =>
      gulp.src('./package.json')
        .pipe(bump({ type: result.releaseType }))
        .pipe(gulp.dest('./'))
        .on('end', done)
    );

  return undefined;
});

function runWebpackBuild() {
  return gulp.src('./lib/entry-point.js')
    .pipe(webpack(webpackConfig))
    .pipe(injectVersion({
      replace: /%%GULP_INJECT_VERSION%%/g,
    }))
    .pipe(addSrc('./data/5eSRDData.js'))
    .pipe(concat('./5eShapedCompanion.js'))
    .pipe(gulp.dest('./'));
}

function np(method) {
  return function promiseWrapper() {
    const self = this;
    const args = Array.prototype.slice.call(arguments);
    return new Promise((resolve, reject) => {
      args.push((err, data) => {
        if (err !== null) {
          return reject(err);
        }
        return resolve(data);
      });
      return method.apply(self, args);
    });
  };
}

function sp(method) {
  return function promiseWrapper() {
    const self = this;
    const args = Array.prototype.slice(arguments);
    return new Promise((resolve) => {
      args.push(data => resolve(data));
      return method.apply(self, args);
    });
  };
}
