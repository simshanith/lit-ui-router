import { html, LitElement } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { isEqual } from 'lodash';
import { Rejection } from '@uirouter/core';
import { UIViewInjectedProps, RoutedLitElement } from '@uirouter/lit';

import { MessagesStorage } from '../global/dataSources.js';
import AppConfig from '../global/appConfig.js';
import DialogService from '../global/dialogService.js';
import { Message } from './interface.js';

@customElement('sample-compose')
export class Compose extends RoutedLitElement {
  createRenderRoot() {
    return this;
  }

  @state()
  pristineMessage: Message;

  @state()
  message: Message;

  static sticky = true;

  get stateParams(): { message: Partial<Message> } {
    return this._uiViewProps!.resolves.$stateParams;
  }

  get messageStateParam() {
    return this.stateParams.message;
  }

  blankMessage: Message = {
    body: '',
    to: '',
    subject: '',
    from: AppConfig.emailAddress,
  };

  buildPristineMessage(): Message {
    return {
      ...this.blankMessage,
      ...this.messageStateParam,
    };
  }

  async willUpdate() {
    let pristineMessage;
    if (
      !isEqual(
        this.pristineMessage,
        (pristineMessage = this.buildPristineMessage()),
      )
    ) {
      this.pristineMessage = pristineMessage;
      this.message = { ...this.pristineMessage };
    }
  }

  uiOnParamsChanged(changedProperties) {
    console.info('uiOnParamsChanged', changedProperties, this.stateParams);

    this.willUpdate();
  }

  canExit: boolean;

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
  async gotoPreviousState() {
    const { transition, router } = this._uiViewProps;
    const hasPrevious = !!transition?.from().name;
    const exitState = 'mymessages.messagelist';
    const previousState = hasPrevious ? transition.from() : exitState;
    const previousParams = hasPrevious ? transition.params('from') : {};
    try {
      await router.stateService.go(exitState);
      await router.stateService.go(previousState, previousParams);
    } catch (e) {
      if (e instanceof Rejection) {
        console.warn(e);
      } else {
        throw e;
      }
    }
  }

  /** "Send" the message (save to the 'sent' folder), and then go to the previous state */
  send() {
    const { message } = this;
    MessagesStorage.save({
      ...message,
      date: new Date(),
      read: true,
      folder: 'sent',
    })
      .then(() => (this.canExit = true))
      .then(() => this.gotoPreviousState());
  }

  handleChangeMessage = (detail: string) => (e) => {
    this.message = {
      ...this.message,
      [detail]: e.target.value,
    };
  };

  /** Save the message to the 'drafts' folder, and then go to the previous state */
  save() {
    const { message } = this;
    MessagesStorage.save({
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
