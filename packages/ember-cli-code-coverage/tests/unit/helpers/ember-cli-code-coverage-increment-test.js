import { emberCliCodeCoverageIncrement } from 'dummy/helpers/ember-cli-code-coverage-increment';
import { module, test } from 'qunit';

const ORIGINAL_COVERAGE = window.__coverage__;

function registerFile(path) {
  window.__coverage__[path] = {
    "path": path,
    "s": {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0
    },
    "b": {
      "1": [0, 0],
      "2": [0, 0]
    },
    "f": { },
    "fnMap": { },
    "statementMap": {
      // not needed for testing
    },
    "branchMap": {
      // not needed for testing
    },
    "code": [
      // not needed for testing
    ]
  };
}

module('Unit | Helper | ember cli code coverage increment', {
  beforeEach() {
    window.__coverage__ = {};
  },

  afterEach() {
    window.__coverage__ = ORIGINAL_COVERAGE;
  }
});

test('it increments the given statement', function(assert) {
  let path = 'app/templates/foo';
  registerFile(path);

  emberCliCodeCoverageIncrement([], { path, statement: "1" });

  assert.equal(window.__coverage__[path].s["1"], 1, 'statement was incremented');
});

test('it increments the given branch', function(assert) {
  let path = 'app/templates/foo';
  registerFile(path);

  emberCliCodeCoverageIncrement([], { path, branch: '1', condition: '0' });

  assert.equal(window.__coverage__[path].b[1][0], 1, 'branch was incremented');
});
