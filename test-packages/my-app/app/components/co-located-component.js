import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CoLocatedComponentComponent extends Component {
    @tracked data = [1, 2, 3]

    @action
    testAction() {
        this.data = "hello"
    }

    @action
    unCoveredAction() {
        void 0
    }
}
