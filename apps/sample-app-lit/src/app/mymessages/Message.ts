import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { UIViewInjectedProps } from 'lit-ui-router';

import { MessagesStorage } from '../global/dataSources.js';
import DialogService from '../global/dialogService.js';
import { Message } from './interface.js';

const messageBody = (msg = '') => msg.split(/\n/).map((p) => html`<p>${p}</p>`);
const prefixSubject = (prefix: string, message: Message) =>
  prefix + message.subject;
const makeResponseMsg = (prefix: string, msg: Message): Partial<Message> => ({
  from: msg.to,
  to: msg.from,
  subject: prefixSubject(prefix, msg),
  body: quoteMessage(msg),
});
const quoteMessage = (message: Message) => `

---------------------------------------
Original message:
From: ${message.from}
Date: ${message.date}
Subject: ${message.subject}

${message.body}`;

@customElement('sample-message')
export class MessageElement extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps) {
    super();
  }

  get message(): Message {
    return this._uiViewProps.resolves?.message;
  }

  get nextMessageGetter(): (_id: string) => string {
    return this._uiViewProps.resolves?.nextMessageGetter;
  }

  get folder(): { actions: string[] } {
    return this._uiViewProps.resolves?.folder;
  }

  get actions() {
    return this.folder.actions.reduce(
      (obj, action) => {
        obj[action] = true;
        return obj;
      },
      {} as Record<string, true>,
    );
  }

  get stateService() {
    return this._uiViewProps.router.stateService;
  }

  /**
   * When the user views a message, mark it as read and save (PUT) the resource.
   */
  connectedCallback() {
    super.connectedCallback();
    if (this.message.read) {
      return;
    }
    this.message.read = true;
    MessagesStorage.put(this.message);
  }

  /**
   * Compose a new message as a reply to this one
   */
  reply = () => {
    const replyMsg = makeResponseMsg('Re: ', this.message);
    this.stateService.go('mymessages.compose', { message: replyMsg });
  };

  /**
   * Compose a new message as a forward of this one.
   */
  forward = () => {
    const fwdMsg = makeResponseMsg('Fwd: ', this.message);
    delete fwdMsg.to;
    this.stateService.go('mymessages.compose', { message: fwdMsg });
  };

  /**
   * Continue composing this (draft) message
   */
  editDraft = () => {
    this.stateService.go('mymessages.compose', { message: this.message });
  };

  /**
   * Delete this message.
   *
   * - confirm deletion
   * - delete the message
   * - determine which message should be active
   * - show that message
   */
  removeMessage = () => {
    const { message, nextMessageGetter } = this;
    const nextMessageId = nextMessageGetter(message._id);
    const nextState = nextMessageId
      ? 'mymessages.messagelist.message'
      : 'mymessages.messagelist';
    const params = { messageId: nextMessageId };

    DialogService.confirm('Delete?', undefined)
      .then(() => MessagesStorage.remove(message))
      .then(() =>
        this.stateService.go(nextState, params, {
          reload: 'mymessages.messagelist',
        }),
      );
  };

  render() {
    const { message } = this;
    return html`<div class="message">
      <div class="header">
        <div>
          <h4>${message.subject}</h4>
          <h5>
            ${message.from} <i class="fa fa-long-arrow-right"></i> ${message.to}
          </h5>
        </div>
        <div class="line2">
          <div>
            ${this.actions.edit
              ? html`<button class="btn btn-primary" @click=${this.editDraft}>
                  <i class="fa fa-pencil"></i> <span>Edit Draft</span>
                </button>`
              : null}
            ${this.actions.reply
              ? html`<button class="btn btn-primary" @click=${this.reply}>
                  <i class="fa fa-reply"></i> <span>Reply</span>
                </button>`
              : null}
            ${this.actions.forward
              ? html`<button class="btn btn-primary" @click=${this.forward}>
                  <i class="fa fa-forward"></i> <span>Forward</span>
                </button>`
              : null}
            ${this.actions.delete
              ? html`<button
                  class="btn btn-primary"
                  @click=${this.removeMessage}
                >
                  <i class="fa fa-close"></i> <span>Delete</span>
                </button>`
              : null}
          </div>
        </div>
      </div>
      ${
        null /* Pass the raw (plain text) message body through the messageBody function to format slightly nicer */
      }
      <div class="body">${messageBody(message.body)}</div>
    </div>`;
  }
}

export default MessageElement;
