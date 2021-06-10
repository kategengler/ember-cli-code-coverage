import myCoveredUtil from 'my-app/utils/my-covered-util';
import { module, test } from 'qunit';
import { visit, currentURL, render } from '@ember/test-helpers';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

module('Unit | Utility | my covered util');

// Replace this with your real tests.
test('it works', function(assert) {
  let result = myCoveredUtil();
  assert.ok(result);
});

// module('Acceptance | app');
// setupRenderingTest(hooks); 

// test('visiting /', async function (assert) {
//   await render(hbs`<TestComponent/>`)
//   assert.ok(this.element)
// });