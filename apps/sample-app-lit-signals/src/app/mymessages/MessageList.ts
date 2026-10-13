import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { computed, SignalWatcher, watch } from '@lit-labs/signals';
import { UIViewInjectedProps } from 'lit-ui-router';

import MessagesStore from './messagesStore.js';
import { MessageListResolves } from 'sample-app-shared/app/mymessages/interface.js';
import 'sample-app-shared/app/mymessages/MessageTable.js';

@customElement('sample-message-list')
export class MessageList extends SignalWatcher(LitElement) {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps<MessageListResolves>) {
    super();
  }

  get folder() {
    return this._uiViewProps.resolves.folder;
  }

  // A folder change builds a new instance, so only the store moves this signal.
  readonly messages = computed(() =>
    MessagesStore.loaded
      ? MessagesStore.byFolder(this.folder._id)
      : (this._uiViewProps.resolves.messages ?? []),
  );

  render() {
    return html`<div class="messagelist">
      <div class="messages">
        <sample-message-table
          .columns=${this.folder.columns}
          .messages=${watch(this.messages)}
        ></sample-message-table>
      </div>
    </div>`;
  }
}

export default MessageList;
