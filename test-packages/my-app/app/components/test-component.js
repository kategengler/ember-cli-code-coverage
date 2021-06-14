import Component from '@ember/component';

export default Component.extend({    
    init() {
        this._super(...arguments);
        this.data = [1, 2, 3];
        this.a = false;
    },

    someAction() {
        this.set('a', this.data ? false: true);
        this.set('data', null);
    }
});