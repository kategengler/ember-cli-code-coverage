/* eslint-env node */

module.exports = {
    reporters: ['lcov', 'html', 'text', 'json-summary'],
    templateCoverage: true,
    includes: ['**/*.hbs'],

};
  