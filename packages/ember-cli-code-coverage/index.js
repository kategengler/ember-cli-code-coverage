'use strict';

var path = require('path');
var fs = require('fs-extra');
var attachMiddleware = require('./lib/attach-middleware');
var config = require('./lib/config');
const walkSync = require('walk-sync');
const VersionChecker = require('ember-cli-version-checker');

function getPlugins(appOrAddon) {
  let options = (appOrAddon.options = appOrAddon.options || {});
  options.babel = options.babel || {};
  return (options.babel.plugins = options.babel.plugins || []);
}

// Regular expression to extract the file extension from a path.
const EXT_RE = /\.[^\.]+$/;

module.exports = {
  name: require('./package').name,

  /**
   * Look up the file path from an ember module path.
   * @type {Object<String, String>}
   */
  fileLookup: null,

  // Ember Methods
  init() {
    this._super.init.apply(this, arguments);
    this.fileLookup = {};
  },

  setupPreprocessorRegistry: function(type, registry) {
    if (!this._isCoverageEnabled()) { return; }

    const buildTemplateInstrumenter = require('./lib/template-instrumenter');
    let TemplateInstrumenter = buildTemplateInstrumenter(
      this.parent.isEmberCLIAddon() ? 'dummy' : this.parent.name(),
      this.parent.root,
      this.registry.extensionsForType('template'),
      this.project.isEmberCLIAddon()
    );

    registry.add('htmlbars-ast-plugin', {
      name: "template-instrumenter",
      plugin: TemplateInstrumenter,
      baseDir: __dirname
    });
  },

  included(appOrAddon) {
    this._super.included.apply(this, arguments);

    this.parentRegistry = appOrAddon.registry;

    if (!this._registeredWithBabel && this._isCoverageEnabled()) {
      let checker = new VersionChecker(this.parent).for('ember-cli-babel', 'npm');

      if (checker.satisfies('>= 6.0.0')) {
        const IstanbulPlugin = require.resolve('babel-plugin-istanbul');
        const exclude = this._getExcludes();
        const include = this._getIncludes();

        [this.app, this._findCoveredAddon(), ...this._findInRepoAddons()]
          .filter(Boolean)
          .map(getPlugins)
          .forEach(plugins => plugins.push([IstanbulPlugin, { exclude, include }]));
      } else {
        this.project.ui.writeWarnLine(
          'ember-cli-code-coverage: You are using an unsupported ember-cli-babel version,' +
            'instrumentation will not be available.'
        );
      }

      this._registeredWithBabel = true;
    }
  },

  contentFor(type) {
    if (type === 'test-body-footer' && this._isCoverageEnabled()) {
      var template = fs
        .readFileSync(path.join(__dirname, 'lib', 'templates', 'test-body-footer.html'))
        .toString();
      return template.replace(
        '{%ENTRIES%}',
        JSON.stringify(Object.keys(this.fileLookup).map(file => file.replace(EXT_RE, '')))
      );
    }

    return undefined;
  },

  includedCommands() {
    return {
      'coverage-merge': require('./lib/coverage-merge'),
    };
  },

  /**
   * If coverage is enabled attach coverage middleware to the express server run by ember-cli
   * @param {Object} startOptions - Express server start options
   */
  serverMiddleware(startOptions) {
    if (!this._isCoverageEnabled()) {
      return;
    }
    attachMiddleware.serverMiddleware(startOptions.app, {
      configPath: this.project.configPath(),
      root: this.project.root,
      fileLookup: this.fileLookup,
    });
  },

  testemMiddleware(app) {
    if (!this._isCoverageEnabled()) {
      return;
    }

    if (Object.keys(this.fileLookup || {}).length === 0) {
      this.included(this);
    }
    const config = {
      configPath: this.project.configPath(),
      root: this.project.root,
      fileLookup: this.fileLookup,
    };
    // if we're running `ember test --server` use the `serverMiddleware`.
    if (process.argv.includes('--server') || process.argv.includes('-s')) {
      return this.serverMiddleware({ app }, config);
    }
    attachMiddleware.testMiddleware(app, config);
  },

  /**
   * Get project configuration
   * @returns {Configuration} project configuration
   */
  _getConfig() {
    return config(this.project.configPath());
  },

  /**
   * Get paths to include for coverage
   * @returns {Array<String>} include paths
   */
  _getIncludes() {
    return [
      ...this._getIncludesForAddonDirectory(),
      ...this._getIncludesForInRepoAddonDirectories(),
      ...this._getIncludesForAppDirectory(),
    ].filter(Boolean);
  },

  /**
   * Get paths to include for covering the "app" directory.
   * @returns {Array<String>} include paths
   */
  _getIncludesForAppDirectory() {
    const dir = path.join(this.project.root, 'app');
    let prefix = this.parent.isEmberCLIAddon() ? 'dummy' : this.parent.name();
    return this._getIncludesForDir(dir, prefix);
  },

  /**
   * Get paths to include for covering the "addon" directory.
   * @returns {Array<String>} include paths
   */
  _getIncludesForAddonDirectory() {
    let addon = this._findCoveredAddon();
    if (addon) {
      const addonDir = path.join(this.project.root, 'addon');
      const addonName = addon.moduleName ? addon.moduleName() : addon.name;
      const addonTestSupportDir = path.join(this.project.root, 'addon-test-support');
      return [
        ...this._getIncludesForDir(addonTestSupportDir, `${addonName}/test-support`),
        ...this._getIncludesForDir(addonDir, addonName),
      ];
    } else {
      return [];
    }
  },

  /**
   * Get paths to include for covering the in-repo-addon directories in "lib/*".
   * @returns {Array<String>} include paths
   */
  _getIncludesForInRepoAddonDirectories() {
    return this._findInRepoAddons().reduce((acc, addon) => {
      let addonDir =
        typeof addon.root === 'string'
          ? addon.root
          : path.join(this.project.root, 'lib', addon.name);

      let addonAppDir = path.join(addonDir, 'app');
      let addonAddonDir = path.join(addonDir, 'addon');
      const addonAddonTestSupportDir = path.join(addonDir, 'addon-test-support');

      return [
        ...acc,
        ...this._getIncludesForDir(addonAddonTestSupportDir, `${addon.name}/test-support`),
        ...this._getIncludesForDir(addonAddonDir, addon.name),
        ...this._getIncludesForDir(addonAppDir, this.parent.name()),
      ];
    }, []);
  },

  /**
   * Get paths to include for coverage
   * @param {String} dir Include all js files under this directory.
   * @param {String} prefix The prefix to the ember module ('app', 'dummy' or the name of the addon).
   * @returns {Array<String>} include paths
   */
  _getIncludesForDir(dir, prefix) {
    const hasEmberCliTypescript =
      this.project &&
      this.project.findAddonByName &&
      this.project.findAddonByName('ember-cli-typescript');
    if (fs.existsSync(dir)) {
      let dirname = path.relative(this.project.root, dir);
      let globs = this.parentRegistry.extensionsForType('js').map(extension => `**/*.${extension}`);
      globs = globs.concat( this.parentRegistry.extensionsForType('template').map(extension => `**/*.${extension}`));

      console.log(globs)
      return walkSync(dir, { directories: false, globs }).map(file => {
        const postfix = (hasEmberCliTypescript || file.endsWith('.hbs')) ? file : file.replace(EXT_RE, '.js');
        const module = prefix + '/' + postfix;
        this.fileLookup[module] = path.join(dirname, file);
        return module;
      });
    } else {
      return [];
    }
  },

  /**
   * Get paths to exclude from coverage
   * @returns {Array<String>} exclude paths
   */
  _getExcludes() {
    return this._getConfig().excludes || [];
  },

  /**
   * Determine whether or not coverage is enabled
   * @returns {Boolean} whether or not coverage is enabled
   */
  _isCoverageEnabled() {
    let envVar = this._getConfig().coverageEnvVar;
    let value = process.env[envVar] || '';
    return value.toLowerCase() === 'true';
  },

  /**
   * Find the addon (if any) that's being covered.
   * @returns {Addon} the addon under test
   */
  _findCoveredAddon() {
    if (!this._coveredAddon) {
      this._coveredAddon = this.project.findAddonByName(this.project.pkg.name);
    }

    return this._coveredAddon;
  },

  /**
   * Find the app's in-repo addons (if any).
   * @returns {Array<Addon>} the in-repo addons
   */
  _findInRepoAddons() {
    if (!this._inRepoAddons) {
      const pkg = this.project.pkg;
      const inRepoAddonPaths = pkg['ember-addon'] && pkg['ember-addon'].paths;
      this._inRepoAddons = (inRepoAddonPaths || []).map(addonPath => {
        let addonName = path.basename(addonPath);
        return this.project.findAddonByName(addonName);
      });
    }

    return this._inRepoAddons.filter(Boolean);
  },
};
