import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitDialog } from 'lit-dialog';

import dialogService from './dialogService.js';

@customElement('sample-dialog')
export class Dialog extends LitDialog {
  renderContent() {
    return dialogService.renderContent();
  }

  /**
   * Render the same dialog markup as the other ui-router sample apps
   * (react/angular) instead of LitDialog's Bootstrap modal, so the
   * shared `.dialog` styles in styles.css apply.
   *
   * The `#modal`/`#backdrop` ids and `data-dismiss` attribute keep
   * LitDialog's open/dismiss wiring working; open() adds the `in`
   * class that styles.css uses to fade in the backdrop and drop the
   * content into place.
   */
  renderDialog() {
    return html`
      <div id="modal" class="dialog">
        <div id="backdrop" class="backdrop" data-dismiss></div>
        <div class="wrapper">
          <div class="content">${this.renderContent()}</div>
        </div>
      </div>
    `;
  }
}
