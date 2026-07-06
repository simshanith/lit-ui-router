import { makeAutoObservable, observable, runInAction } from 'mobx';

import { appModulesRegistered } from 'sample-app-shared/app/global/appModules.js';
import { MessagesStorage } from 'sample-app-shared/app/global/dataSources.js';
import AppConfig from '../global/appConfig.js';
import { Message } from 'sample-app-shared/app/mymessages/interface.js';

/**
 * An observable cache of the fake REST MessagesStorage.
 *
 * The storage's 'commit' event (message sent, drafted, deleted, marked read)
 * is funneled into a single observable array here, so components observing
 * it through ReactionController selectors re-render automatically when
 * messages change between route transitions — resolves only run during
 * transitions and would otherwise go stale.
 */
export class MessagesStore {
  messages: Message[] = [];

  /** False until the first fetch resolves; callers may fall back to resolves. */
  loaded = false;

  constructor() {
    makeAutoObservable(
      this,
      {
        messages: observable.ref,
        // Not an action: reads inside actions are untracked, and this must
        // be trackable from observer renders.
        byFolder: false,
      },
      { autoBind: true },
    );
    MessagesStorage.addEventListener('commit', this.refresh);
    // This module evaluates during the bootstrap import chain, before
    // registerAppModules() provides AppConfig to the storage.
    appModulesRegistered.then(this.refresh);
  }

  refresh() {
    MessagesStorage.all((messages: Message[]) =>
      runInAction(() => {
        this.messages = [...messages];
        this.loaded = true;
      }),
    );
  }

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
        `${message[toFromAttr] ?? ''}`.includes(emailAddress),
    );
  }
}

const instance = new MessagesStore();
export default instance;
