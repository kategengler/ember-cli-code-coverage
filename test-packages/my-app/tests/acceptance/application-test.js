import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL } from '@ember/test-helpers';

module('Acceptance | app', function(hooks) {
  setupApplicationTest(hooks); 

  test('visiting /', async function (assert) {
    await visit('/');

    assert.equal(currentURL(), '/');
  });
});