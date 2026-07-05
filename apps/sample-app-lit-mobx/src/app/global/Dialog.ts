import { customElement } from 'lit/decorators.js';
import { LitDialog } from 'lit-dialog';

import dialogService from './dialogService.js';

@customElement('sample-dialog')
export class Dialog extends LitDialog {
  renderContent() {
    return dialogService.renderContent();
  }
}
