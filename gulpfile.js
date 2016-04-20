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
const conventionalGithubReleaser = np(require('conventional-github-releaser'));
const gulpIgnore = require('gulp-ignore');
const GitHubApi = require('github');
const github = new GitHubApi({ version: '3.0.0' });
const gitRev = require('git-rev');
const readPkg = require('read-pkg');
const gutil = require('gulp-util');
const injectVersion = require('gulp-inject-version');
const toc = require('gulp-doctoc');
const webpackConfig = require('./webpack.config.js');

const filesToUpload = ['5eShapedCompanion.js', 'CHANGELOG.md', 'README.md'];
let versionSuffix = '';
switch (process.env.CI && process.env.TRAVIS_BRANCH) {
  case 'master':
    // do nothing, keep bare version number
    break;
  case 'develop':
    versionSuffix = `-dev+${process.env.TRAVIS_BUILD_NUMBER}`;
    break;
  default:
    versionSuffix = '-local';
}


gulp.task('default', ['test', 'lint'], () => runWebpackBuild());

gulp.task('lint', () =>
  gulp.src('./lib/*.js')
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
);

gulp.task('test', () =>
  gulp.src('test/test-*.js', { read: false })
    .pipe(mocha())
);

gulp.task('buildReleaseVersionScript', ['bumpVersion'], () => runWebpackBuild());

gulp.task('commitAndTag', ['changelog', 'doctoc', 'buildReleaseVersionScript'], (done) => {
  if (!process.env.CI) {
    return done();
  }
  // Get all the files to bump version in
  return gulp.src(['./package.json', './CHANGELOG.md', './README.md'])
    .pipe(git.commit('chore(release): bump package version and update changelog [ci skip]', { emitData: true }))
    .pipe(gulpIgnore.exclude(/CHANGELOG.md|README.md/))
    // **tag it in the repository**
    .pipe(tagVersion({ prefix: '' }))
    .on('end', () => git.push('origin', 'master', { args: '--tags' }, (err) => done(err)));
});

gulp.task('doctoc', ['checkoutMaster'], () =>
  gulp.src('README.md')
    .pipe(toc({ depth: 2 }))
    .pipe(gulp.dest('./'))
);

gulp.task('checkoutMaster', (done) => {
  if (!process.env.CI) {
    return done();
  }
  return git.checkout('master', done);
});

gulp.task('release', ['commitAndTag'], (done) => {
  if (!process.env.CI) {
    return done();
  }

  const auth = {
    type: 'oauth',
    token: process.env.GH_TOKEN,
  };
  const config = {
    preset: 'angular',
  };
  const upload = np(github.releases.uploadAsset.bind(github.releases));

  return checkReleaseTaggedVersion()
    .then(isRelease => {
      if (isRelease) {
        return conventionalGithubReleaser(auth, config)
          .then(response => {
            const release = getGHResponseValue(response);

            github.authenticate(auth);
            return Promise.all(filesToUpload.map(fileName => upload({
              owner: 'symposion',
              repo: 'roll20-shaped-scripts',
              id: release.id,
              name: fileName,
              filePath: `./${fileName}`,
            })));
          })
          .then(() => done());
      }

      gutil.log('Skipping github release, tag on current commit doesn\'t match package.json version');
      return done();
    })
    .catch(done);
});

gulp.task('changelog', ['bumpVersion'], () =>
  gulp.src('./CHANGELOG.md', { buffer: false })
    .pipe(conventionalChangelog({ preset: 'angular' }, { currentTag: readPkg.sync().version }))
    .pipe(gulp.dest('./'))
);

gulp.task('bumpVersion', ['checkoutMaster'], done => {
  if (!process.env.CI) {
    return done();
  }
  return conventionalRecommendedBump({ preset: 'angular' }, (err, result) => {
    if (err) {
      return done(err);
    }
    return gulp.src('./package.json')
      .pipe(bump({ type: result.releaseAs }))
      .pipe(gulp.dest('./'))
      .on('end', done);
  });
});

function runWebpackBuild() {
  return gulp.src('./lib/entry-point.js')
    .pipe(webpack(webpackConfig))
    .pipe(injectVersion({
      append: versionSuffix,
    }))
    .pipe(gulp.dest('./'));
}

function getGHResponseValue(response) {
  if (response && response[0]) {
    switch (response[0].state) {
      case 'rejected':
        throw new Error(response[0].reason);
      case 'fulfilled':
        return response[0].value;
      default:
        throw new Error(`unrecognised github response ${response[0].state}`);
    }
  }
  return response;
}


function checkReleaseTaggedVersion() {
  return Promise.all([readPkg(), sp(gitRev.tag)(), delay()])
    .then(results => {
      gutil.log(`Version from package.json: ${results[0].version}, version from tag: ${results[1]}`);
      return results[0].version === results[1];
    });
}

function delay() {
  return new Promise(resolve => setTimeout(resolve, 1000));
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
    return new Promise(resolve => {
      args.push(data => resolve(data));
      return method.apply(self, args);
    });
  };
}
