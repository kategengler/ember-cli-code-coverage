import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | yield-component', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`
      <YieldComponent>
        <div class="yield-content">
          yield content
        </div>
      </YieldComponent>

      <YieldComponent as |p|>
        <p.text value="yield"></p.text>
      </YieldComponent>
    `);

    assert.dom('.yield-content').hasText('yield content');
    assert.dom('input').hasValue('yield');
  });
});
