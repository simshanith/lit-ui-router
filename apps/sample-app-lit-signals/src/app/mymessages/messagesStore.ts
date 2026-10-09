import { Signal } from 'signal-polyfill';

import { appModulesRegistered } from 'sample-app-shared/app/global/appModules.js';
import { MessagesStorage } from 'sample-app-shared/app/global/dataSources.js';
import AppConfig from '../global/appConfig.js';
import { Message } from 'sample-app-shared/app/mymessages/interface.js';
import { snapshot } from 'sample-app-shared/app/mymessages/snapshot.js';

/**
 * A signal-backed cache of the fake REST MessagesStorage.
 *
 * The storage's 'commit' event (message sent, drafted, deleted, marked read)
 * is funneled into a single `Signal.State` here, so components watching it
 * through SignalController selectors re-render automatically when messages
 * change between route transitions — resolves only run during transitions
 * and would otherwise go stale.
 */
export class MessagesStore {
  readonly #messages = new Signal.State<readonly Message[]>([]);
  readonly #loaded = new Signal.State(false);

  constructor() {
    MessagesStorage.addEventListener('commit', this.refresh);
    void appModulesRegistered.then(this.refresh);
  }

  get messages(): readonly Message[] {
    return this.#messages.get();
  }

  /** False until the first fetch resolves; callers may fall back to resolves. */
  get loaded(): boolean {
    return this.#loaded.get();
  }

  refresh = () => {
    void MessagesStorage.all((messages: Message[]) => {
      this.#messages.set(snapshot(messages));
      this.#loaded.set(true);
    });
  };

  /**
   * The current user's messages in a folder (same matching rules as
   * MessagesStorage.byFolder).
   */
  byFolder(folderId: string): Message[] {
    const toFromAttr = ['drafts', 'sent'].includes(folderId) ? 'from' : 'to';
    const emailAddress = AppConfig.emailAddress ?? '';
    return this.messages.filter(
      (message) =>
        message.folder === folderId &&
        (message[toFromAttr] ?? '').includes(emailAddress),
    );
  }
}

const instance = new MessagesStore();
export default instance;
