import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | co-located-component', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`<CoLocatedComponent />`);
    assert.equal(this.element.textContent.trim(), '1,2,3');

    await click('div');
    assert.equal(this.element.textContent.trim(), 'hello');
  });
});
