import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL, click } from '@ember/test-helpers';

module('Acceptance | app', function(hooks) {
  setupApplicationTest(hooks); 

  test('visiting /', async function (assert) {
    await visit('/');

    assert.equal(currentURL(), '/');
    assert.dom('.abcd').exists();

    await click('.abcd');
    assert.dom('.efgh').exists();
    await click('.efgh');

    assert.dom('.yield-content').hasText('yield content');
    assert.dom('input').hasValue('yield');
  });
});