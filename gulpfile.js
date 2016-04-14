'use strict';
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var jshint = require('gulp-jshint');
var webpack = require('webpack-stream');
var tagVersion = require('gulp-tag-version');
var bump = require('gulp-bump');
var git = require('gulp-git');
var addSrc = require('gulp-add-src');
var conventionalChangelog = require('gulp-conventional-changelog');
var conventionalRecommendedBump = require('conventional-recommended-bump');

gulp.task('default', ['test', 'lint'], function () {
  return gulp.src('./lib/entry-point.js')
    .pipe(webpack(require('./webpack.config.js')))
    .pipe(gulp.dest('./'));
});

gulp.task('lint', function () {
  return gulp.src('./lib/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('test', function () {
  return gulp.src('test/test-*.js', { read: false })
    .pipe(mocha());
});

gulp.task('release', ['changelog'], function (done) {
  conventionalRecommendedBump({ preset: 'angular' }, function (err, importance) {
    // Get all the files to bump version in
    gulp.src('./package.json')
      .pipe(bump({ type: importance }))
      .pipe(gulp.dest('./'))
      .pipe(addSrc.append('./CHANGELOG.md'))
      .pipe(git.commit('chore(release): bump package version and update changelog', { emitData: true }))
      // **tag it in the repository**
      .pipe(tagVersion());
    done(err);
  });


});

gulp.task('changelog', function () {
  return gulp.src('./CHANGELOG.md', { buffer: false })
    .pipe(conventionalChangelog({ preset: 'angular' }))
    .pipe(gulp.dest('./'));
});

