'use strict';
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var jshint = require('gulp-jshint');
var webpack = require('webpack-stream');
var tagVersion = require('gulp-tag-version');
var bump = require('gulp-bump');
var git = require('gulp-git');
var conventionalChangelog = require('gulp-conventional-changelog');
var conventionalRecommendedBump = require('conventional-recommended-bump');
var conventionalGithubReleaser = require('conventional-github-releaser');
var gulpIgnore = require('gulp-ignore');

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

gulp.task('commitAndTag', ['changelog'], function (done) {
  if (!process.env.CI) {
    return done();
  }
  // Get all the files to bump version in
  gulp.src(['./package.json', './CHANGELOG.md'])
    .pipe(git.commit('chore(release): bump package version and update changelog [ci skip]', { emitData: true }))
    .pipe(gulpIgnore.exclude('CHANGELOG.md'))
    // **tag it in the repository**
    .pipe(tagVersion())

    .on('end', done);
});

gulp.task('checkoutMaster', function (done) {
  if (!process.env.CI) {
    return done();
  }
  git.checkout('master', done);
});

gulp.task('release', ['commitAndTag'], function (done) {
  if (!process.env.CI) {
    return done();
  }

  git.push('origin', 'master', { args: '--follow-tags' }, function (err) {
    if (err) {
      throw err;
    }

    conventionalGithubReleaser({
      type: 'oauth',
      token: process.env.GH_TOKEN
    }, {
      preset: 'angular'
    }, done);
  });
});

gulp.task('changelog', ['bumpVersion'], function () {
  return gulp.src('./CHANGELOG.md', { buffer: false })
    .pipe(conventionalChangelog({ preset: 'angular' }))
    .pipe(gulp.dest('./'));
});

gulp.task('bumpVersion', ['checkoutMaster'], function (done) {
  if (!process.env.CI) {
    return done();
  }
  conventionalRecommendedBump({ preset: 'angular' }, function (err, result) {
    if (err) {
      return done(err);
    }
    return gulp.src('./package.json')
      .pipe(bump({ type: result.releaseAs }))
      .pipe(gulp.dest('./'))
      .on('end', done);
  });
});



