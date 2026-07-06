import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { UIViewInjectedProps } from 'lit-ui-router';

import { MessagesStorage } from 'sample-app-shared/app/global/dataSources.js';
import { StoreCommitController } from '../util/storeCommitController.js';
import { Message } from 'sample-app-shared/app/mymessages/interface.js';
import 'sample-app-shared/app/mymessages/MessageTable.js';

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
  }

  commits = new StoreCommitController(this, MessagesStorage);

  get folder() {
    return this._uiViewProps.resolves!.folder;
  }

  get messages() {
    return this._uiViewProps.resolves!.messages ?? [];
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
