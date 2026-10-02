import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { UIViewInjectedProps } from 'lit-ui-router';

import { MessagesStorage } from 'sample-app-shared/app/global/dataSources.js';
import { StoreCommitController } from '../util/storeCommitController.js';
import {
  Message,
  MessageListResolves,
} from 'sample-app-shared/app/mymessages/interface.js';
import { snapshot } from 'sample-app-shared/app/mymessages/snapshot.js';
import 'sample-app-shared/app/mymessages/MessageTable.js';

@customElement('sample-message-list')
export class MessageList extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps<MessageListResolves>) {
    super();
  }

  commits = new StoreCommitController(this, MessagesStorage, () =>
    this.refresh(),
  );

  /** The rendered rows: a frozen snapshot, never the store's live instances. */
  @state()
  messages: readonly Message[] = [];

  /** The `messages` resolve the current snapshot was taken from. */
  private resolved?: readonly Message[];

  get folder() {
    return this._uiViewProps.resolves.folder;
  }

  // discard a snapshot that landed after the folder moved on
  private refresh() {
    const { folder } = this;
    void MessagesStorage.byFolder(folder).then((rows: Message[]) => {
      if (this.folder === folder) this.messages = snapshot(rows);
    });
  }

  // <ui-view> re-delivers _uiViewProps every update, so re-seed only on a new resolve
  willUpdate() {
    const resolved = this._uiViewProps.resolves.messages ?? [];
    if (resolved !== this.resolved) {
      this.resolved = resolved;
      this.messages = snapshot(resolved);
    }
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
