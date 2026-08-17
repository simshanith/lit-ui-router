import { customElement } from 'lit/decorators.js';
import { LitDialog } from 'lit-dialog';

import dialogService from './dialogService.js';

@customElement('sample-dialog')
export class Dialog extends LitDialog {
  renderContent() {
    return dialogService.renderContent();
  }

  /* eslint-disable wc/no-self-class, wc/no-child-traversal-in-connectedcallback -- deliberate host+subtree class aliasing onto a third-party element (see below); the timing is under review in the a11y/lifecycle follow-up, not here */
  connectedCallback() {
    super.connectedCallback();
    // lit-dialog renders Bootstrap 3 modal markup; alias it with the class
    // names the react/angular sample apps use, so the shared dialog styles
    // in styles.css (and the e2e selectors) apply to it unchanged.
    this.classList.add('dialog');
    this.querySelector('#modal')?.classList.add('dialog');
    this.querySelector('#backdrop')?.classList.add('backdrop');
    this.querySelector('.modal-dialog')?.classList.add('wrapper');
    this.querySelector('.modal-content')?.classList.add('content');
  }
}
