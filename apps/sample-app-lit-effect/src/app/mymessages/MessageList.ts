import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { UIViewInjectedProps } from 'lit-ui-router';

import { MessageListResolves } from 'sample-app-shared/app/mymessages/interface.js';
import 'sample-app-shared/app/mymessages/MessageTable.js';

import { RefController } from '../effect/refController.js';
import { byFolder, messages$, MessagesSnapshot } from './messagesStore.js';

@customElement('sample-message-list')
export class MessageList extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps<MessageListResolves>) {
    super();
  }

  // Re-renders when the messages cache changes (message sent, drafted,
  // deleted, marked read) — the route's `messages` resolve only covers the
  // initial load. The current folder comes from (non-reactive) view props, so
  // render() derives fresh data via the getters below; this controller only
  // needs to signal that the underlying cache moved.
  storeUpdates = new RefController(
    this,
    [messages$],
    (snapshot: MessagesSnapshot) => snapshot,
  );

  get folder() {
    return this._uiViewProps.resolves.folder;
  }

  get messages() {
    const snapshot = this.storeUpdates.value;
    return snapshot.loaded
      ? byFolder(snapshot, this.folder._id)
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
