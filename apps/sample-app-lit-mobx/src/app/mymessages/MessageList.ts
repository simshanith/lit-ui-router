import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { UIViewInjectedProps } from 'lit-ui-router';
import { ReactionController } from 'lit-ui-router-mobx';

import MessagesStore from './messagesStore.js';
import { MessageListResolves } from 'sample-app-shared/app/mymessages/interface.js';
import 'sample-app-shared/app/mymessages/MessageTable.js';

@customElement('sample-message-list')
export class MessageList extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps<MessageListResolves>) {
    super();
  }

  // Re-renders when the MessagesStore cache changes (message sent, drafted,
  // deleted, marked read) — the route's `messages` resolve only covers the
  // initial load. The current folder comes from (non-observable) view props,
  // so render() derives fresh data via the getters below; this reaction only
  // needs to signal that the underlying cache moved.
  storeUpdates = new ReactionController(this, () => ({
    messages: MessagesStore.messages,
    loaded: MessagesStore.loaded,
  }));

  get folder() {
    return this._uiViewProps.resolves.folder;
  }

  get messages() {
    return MessagesStore.loaded
      ? MessagesStore.byFolder(this.folder._id)
      : (this._uiViewProps.resolves.messages ?? []);
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
