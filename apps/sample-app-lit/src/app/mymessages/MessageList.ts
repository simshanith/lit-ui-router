import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { UIViewInjectedProps } from 'lit-ui-router';

import { MessagesStorage } from '../global/dataSources.js';
import { Message } from './interface.js';
import './MessageTable.js';

interface MessageListResolves {
  folder: { columns: string[] };
  messages: Message[];
}

@customElement('sample-message-list')
export class MessageList extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps<MessageListResolves>) {
    super();
    this.onCommit = this.onCommit.bind(this);
  }

  get folder() {
    return this._uiViewProps.resolves!.folder;
  }

  get messages() {
    return this._uiViewProps.resolves!.messages ?? [];
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
