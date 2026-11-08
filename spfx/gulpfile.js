'use strict';

const build = require('@microsoft/sp-build-web');

build.addSuppression(`Warning - [sass] The local CSS class 'ms-Grid' is not camelCase and will not be type-safe.`);

// the app is built by Vite (npm run build:spfx in the parent folder) into app/process-hub.js; webpack just bundles that file
build.configureWebpack.mergeConfig({
  additionalConfiguration: (config) => {
    config.resolve.alias = Object.assign({}, config.resolve.alias, { 'process-hub-app': require('path').resolve(__dirname, 'app/process-hub.js') });
    return config;
  }
});

var getTasks = build.rig.getTasks;
build.rig.getTasks = function () {
  var result = getTasks.call(build.rig);

  result.set('serve', result.get('serve-deprecated'));

  return result;
};

build.initialize(require('gulp'));
