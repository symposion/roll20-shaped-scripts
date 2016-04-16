'use strict';
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var jshint = require('gulp-jshint');
var webpack = require('webpack-stream');
var tagVersion = require('gulp-tag-version');
var bump = require('gulp-bump');
var git = require('gulp-git');
var conventionalChangelog = require('gulp-conventional-changelog');
var conventionalRecommendedBump = np(require('conventional-recommended-bump'));
var conventionalGithubReleaser = np(require('conventional-github-releaser'));
var gulpIgnore = require('gulp-ignore');
var GitHubApi = require('github');
const github = new GitHubApi({ version: '3.0.0' });
var gitRev = require('git-rev');
var readPkg = require('read-pkg');
var gutil = require('gulp-util');
var injectVersion = require('gulp-inject-version');

const filesToUpload = ['5eShapedCompanion.js', 'CHANGELOG.md', 'README.md'];
let versionSuffix = '';
switch (process.env.CI && process.env.TRAVIS_BRANCH) {
  case 'master':
    //do nothing, keep bare version number
    break;
  case 'develop':
    versionSuffix = `-dev+${process.env.TRAVIS_BUILD_NUMBER}`;
    break;
  default:
    versionSuffix = '-local';
}


gulp.task('default', ['test', 'lint'], function () {
  const config = require('./webpack.config.js');
  return gulp.src('./lib/entry-point.js')
    .pipe(webpack(config))
    .pipe(injectVersion({
      append: versionSuffix
    }))
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
    .pipe(tagVersion({ prefix: '' }))
    .on('end', function () {
      git.push('origin', 'master', { args: '--follow-tags' }, function (err) {
        done(err);
      });
    });
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

  const auth = {
    type: 'oauth',
    token: process.env.GH_TOKEN
  };
  const config = {
    preset: 'angular'
  };
  const upload = np(github.releases.uploadAsset.bind(github.releases));

  checkReleaseTaggedVersion()
    .then(function (isRelease) {
      if (isRelease) {
        return conventionalGithubReleaser(auth, config)
          .then(function (response) {
            const release = getGHResponseValue(response);

            github.authenticate(auth);
            return Promise.all(filesToUpload.map(fileName => upload({
              owner: 'symposion',
              repo: 'roll20-shaped-scripts',
              id: release.id,
              name: fileName,
              filePath: `./${fileName}`
            })));
          })
          .then(function () {
            done();
          });
      }
      else {
        gutil.log('Skipping github release, tag on current commit doesn\'t match package.json version');
      }
    })
    .catch(function (error) {
      done(error);
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


function getGHResponseValue(response) {
  if (response && response[0]) {
    switch (response[0].state) {
      case 'rejected':
        throw new Error(response[0].reason);
      case 'fulfilled':
        return response[0].value;
    }
  }
  return response;
}


function checkReleaseTaggedVersion() {
  return Promise.all([readPkg(), sp(gitRev.tag)(), delay()])
    .then(function (results) {
      gutil.log(`Version from package.json: ${results[0].version}, version from tag: ${results[1]}`);
      return results[0].version === results[1];
    });
}

function delay() {
  return new Promise(function (resolve) {
    setTimeout(resolve, 500);
  });
}

function np(method) {
  return function () {
    const self = this;
    const args = Array.prototype.slice.call(arguments);
    return new Promise(function (resolve, reject) {
      args.push(function (err, data) {
        if (err !== null) {
          return reject(err);
        }
        resolve(data);
      });
      method.apply(self, args);
    });
  };
}

function sp(method) {
  return function () {
    const self = this;
    const args = Array.prototype.slice(arguments);
    return new Promise(function (resolve, reject) {
      args.push(function (data) {
        resolve(data);
      });
      method.apply(self, args);
    });
  };
}
