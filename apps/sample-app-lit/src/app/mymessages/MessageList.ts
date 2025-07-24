import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { UIViewInjectedProps } from '@uirouter/lit';

import { MessagesStorage } from '../global/dataSources.js';
import { Message } from './interface.js';
import './MessageTable.js';

@customElement('sample-message-list')
export class MessageList extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps) {
    super();
    this.onCommit = this.onCommit.bind(this);
  }

  get folder(): { columns: string[] } {
    return this._uiViewProps.resolves.folder;
  }

  get messages(): Message[] {
    return this._uiViewProps.resolves.messages;
  }

  onCommit() {
    this.requestUpdate();
  }

  connectedCallback() {
    MessagesStorage.addEventListener('commit', this.onCommit);
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    MessagesStorage.removeEventListener('commit', this.onCommit);
  }

  render() {
    return html`<div class="messagelist">
      <div class="messages">
        <sample-message-table
          .columns=${this.folder.columns}
          .messages=${this.messages}
        ></sample-message-table>
      </div>
    </div>`;
  }
}

export default MessageList;
