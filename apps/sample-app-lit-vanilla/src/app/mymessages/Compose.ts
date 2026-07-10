import { html, LitElement } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { isEqual } from 'lodash';
import { TransitionController, UIViewInjectedProps } from 'lit-ui-router';

import { MessagesStorage } from 'sample-app-shared/app/global/dataSources.js';
import AppConfig from '../global/appConfig.js';
import DialogService from 'sample-app-shared/app/global/dialogService.js';
import { Message } from 'sample-app-shared/app/mymessages/interface.js';

interface ComposeResolves {
  $stateParams?: { message?: Partial<Message> };
}

@customElement('sample-compose')
export class Compose extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state()
  pristineMessage!: Message;

  @state()
  message!: Message;

  static sticky = true;

  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps<ComposeResolves>;

  canExit = false;

  constructor(_uiViewProps: UIViewInjectedProps<ComposeResolves>) {
    super();
    this._uiViewProps = _uiViewProps;
    this.resetMessage(_uiViewProps?.resolves?.$stateParams?.message);
  }

  // Resets the draft whenever a transition lands on this state. Sticky
  // instances survive between visits, so the constructor only runs once:
  // - hostConnected: the element (re)entered the DOM, start a fresh draft.
  // - onSuccess: a transition targeted this state while composing (Reply/
  //   Forward/Edit, or a DSR redirect back here); reset only if the message
  //   param actually changed, so an in-progress draft isn't clobbered.
  // Params are read from the transition itself, which is authoritative even
  // before <ui-view> pushes updated props. uiCanExit below still guards
  // against silently discarding unsaved edits.
  transitions = new TransitionController(this, {
    criteria: { to: 'mymessages.compose' },
    callback: (transition, reason) =>
      this.resetMessage(
        transition?.params().message as Partial<Message> | undefined,
        { force: reason === 'hostConnected' },
      ),
  });

  resetMessage(message: Partial<Message> = {}, { force = false } = {}) {
    const pristineMessage = {
      body: '',
      to: '',
      subject: '',
      ...message,
      from: AppConfig.emailAddress,
    } as Message;
    if (!force && isEqual(this.pristineMessage, pristineMessage)) return;
    this.pristineMessage = pristineMessage;
    this.message = { ...pristineMessage };
    this.canExit = false;
  }

  /**
   * Checks if the edited copy and the pristine copy are identical when the state is changing.
   * If they are not identical, the allows the user to confirm navigating away without saving.
   */
  uiCanExit = async () => {
    if (this.canExit || isEqual(this.pristineMessage, this.message))
      return true;

    const message = 'You have not saved this message.';
    const question = 'Navigate away and lose changes?';
    this.canExit = await DialogService.confirm(message, question, 'Yes', 'No');
    return this.canExit;
  };

  /**
   * Navigates back to the previous state.
   *
   * - Checks the transition which activated this controller for a 'from state' that isn't the implicit root state.
   * - If there is no previous state (because the user deep-linked in, etc), then go to 'mymessages.messagelist'
   */
  gotoPreviousState() {
    const { transition, router } = this._uiViewProps;
    const hasPrevious = !!transition?.from().name;
    const state = hasPrevious ? transition.from() : 'mymessages.messagelist';
    const params = hasPrevious ? transition.params('from') : {};
    void router.stateService.go(state, params);
  }

  /** "Send" the message (save to the 'sent' folder), and then go to the previous state */
  send() {
    const { message } = this;
    void MessagesStorage.save({
      ...message,
      date: new Date(),
      read: true,
      folder: 'sent',
    })
      .then(() => (this.canExit = true))
      .then(() => this.gotoPreviousState());
  }

  handleChangeMessage = (detail: string) => (e: Event) => {
    this.message = {
      ...this.message,
      [detail]: (e.target as HTMLInputElement).value,
    };
  };

  /** Save the message to the 'drafts' folder, and then go to the previous state */
  save() {
    const { message } = this;
    void MessagesStorage.save({
      ...message,
      date: new Date(),
      read: true,
      folder: 'drafts',
    })
      .then(() => (this.canExit = true))
      .then(() => this.gotoPreviousState());
  }

  render() {
    const { message } = this;
    return html`<div class="compose">
      <div class="header">
        <div class="flex-h">
          <label>Recipient</label>
          <input
            type="text"
            id="to"
            name="to"
            value=${message.to}
            @change=${this.handleChangeMessage('to')}
          />
        </div>
        <div class="flex-h">
          <label>Subject</label>
          <input
            type="text"
            id="subject"
            name="subject"
            value=${message.subject}
            @change=${this.handleChangeMessage('subject')}
          />
        </div>
      </div>

      <div class="body">
        <textarea
          name="body"
          id="body"
          cols="30"
          rows="20"
          @change=${this.handleChangeMessage('body')}
          .value=${message.body}
        ></textarea>

        <div class="buttons">
          <button class="btn btn-primary" @click=${this.gotoPreviousState}>
            <i class="fa fa-times-circle-o"></i><span>Cancel</span>
          </button>
          <button class="btn btn-primary" @click=${this.save}>
            <i class="fa fa-save"></i><span>Save as Draft</span>
          </button>
          <button class="btn btn-primary" @click=${this.send}>
            <i class="fa fa-paper-plane-o"></i><span>Send</span>
          </button>
        </div>
      </div>
    </div>`;
  }
}

export default Compose;
