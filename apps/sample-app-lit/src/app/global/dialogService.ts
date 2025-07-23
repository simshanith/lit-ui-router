import { Dialog } from './Dialog.js';
import { html } from 'lit';

export interface DialogProps {
  message: string;
  details: string;
  confirmMsg: string;
  denyMsg: string;
}

export class DialogService implements DialogProps {
  message: string;
  details = 'Are you sure?';
  confirmMsg = 'Yes';
  denyMsg = 'No';

  component = new Dialog(null);

  renderContent() {
    const { message, details, confirmMsg, denyMsg, component } = this;

    return html`
      ${message ? html`<h4>${message}</h4>` : null}
      ${details ? html`<div>${details}</div>` : null}
      <div style="paddingTop: 1em;">
        <button class="btn btn-primary" @click=${() => component.resolve(true)}>
          ${confirmMsg}
        </button>
        <button class="btn btn-primary" @click=${() => component.reject(false)}>
          ${denyMsg}
        </button>
      </div>
    `;
  }

  confirm = (
    message,
    details = 'Are you sure?',
    confirmMsg = 'Yes',
    denyMsg = 'No',
  ) => {
    Object.assign(this, {
      message,
      details,
      confirmMsg,
      denyMsg,
    });
    return this.component.open();
  };
}

const instance = new DialogService();
export default instance;
