import { Transition } from '@uirouter/core';
import { FoldersStorage, MessagesStorage } from '../global/dataSources.js';
import MessageListUI from './messageListUIService.js';
import { Folder, Message } from './interface.js';

import { Compose, MessageList } from '../global/appModules.js';
import { mymessagesTable } from 'sample-app-routes/state-table/mymessages';
import type { AssertNoCollisions, StatesOf } from 'ui-router-registry';

import { bindStates } from '../../registry/bind.js';
import type { RegisteredRows } from '../../registry/states.js';
import MyMessages from './MyMessages.js';
import MessageComponent from './Message.js';

import { dsrRedirectToDefaultFromWithin } from '../util/dsr-default-redirect-within.js';

function againable<T>(fn: () => T) {
  return function $again(): Promise<Awaited<T>> & {
    $again: () => Promise<Awaited<T>>;
  } {
    return Object.assign(Promise.resolve(fn()), {
      $again,
    });
  };
}

/** The mymessages module's states, bound by name to its table. */
export const states = bindStates(mymessagesTable, {
  /**
   * This state allows the user to compose a new message, edit a drafted message, send a message,
   * or save an unsent message as a draft.
   *
   * Its `message` param (a draft, not in the URL) defaults to an empty object in the table.
   *
   * This state uses view-targeting to take over the ui-view that would normally be filled by the 'mymessages' state.
   */
  'mymessages.compose': {
    data: { title: 'New message' },
    views: {
      // Absolutely targets the ui-view named 'mymessages' (which is nested inside an unnamed ui-view) with the 'Compose' component.
      // Absolute targeting finds the nested ui-view in the DOM, using view names.
      '!$default.mymessages': Compose,
    },
  },
  /**
   * This state shows the contents of a single message.
   * It also has UI to reply, forward, delete, or edit an existing draft.
   */
  'mymessages.messagelist.message': {
    resolve: {
      // Fetch the message from the Messages service using the messageId parameter
      message: {
        deps: ['$transition$'],
        resolveFn: ($transition$: Transition) =>
          MessagesStorage.get($transition$.params().messageId),
      },
      // Provide the component with a function it can query that returns the closest message id
      nextMessageGetter: {
        deps: ['messages'],
        resolveFn: (messages: Message[]) =>
          MessageListUI.proximalMessageId.bind(MessageListUI, messages),
      },
    },
    data: {
      title: (transition: Transition) =>
        // SAFETY: this state's `message` resolve yields a Message
        (transition.injector().get('message') as Message).subject,
      analyticsTitle: 'Message',
      keepScroll: true,
    },
    views: {
      // Relatively target the parent-state's parent-state's 'messagecontent' ui-view
      // This could also have been written using ui-view@state addressing: 'messagecontent@mymessages'
      // Or, this could also have been written using absolute ui-view addressing: '!$default.$default.messagecontent'
      '^.^.messagecontent': MessageComponent,
    },
  },
  /**
   * This state shows the contents (a message list) of a single folder.
   * The table makes 'inbox' its `folderId` default.
   */
  'mymessages.messagelist': {
    resolve: {
      // Fetch the current folder from the Folders service, using the folderId parameter
      folder: {
        deps: ['$transition$'],
        resolveFn: ($transition$: Transition) =>
          FoldersStorage.get($transition$.params().folderId),
      },
      // The resolved folder object (from the resolve above) is injected into this resolve
      // The list of message for the folder are fetched from the Messages service
      messages: {
        deps: ['folder'],
        resolveFn: (folder: Folder) =>
          againable(() => MessagesStorage.byFolder(folder))(),
      },
    },
    data: {
      title: (transition: Transition) => {
        const folderId = String(transition.params().folderId);

        return folderId.charAt(0).toUpperCase() + folderId.slice(1);
      },
    },
    views: {
      // This targets the "messagelist" named UIView added to the DOM in the parent state 'mymessages'
      messagelist: MessageList,
    },
  },
  /**
   * The mymessages state. This is the main state for the mymessages page.
   *
   * This state shows the list of folders for the current user. It retrieves the folders from the
   * Folders service.  If a user navigates directly to this state, the state redirects to the 'mymessages.messagelist'.
   */
  mymessages: {
    resolve: {
      // All the folders are fetched from the Folders service
      folders: { resolveFn: () => FoldersStorage.all() },
    },
    views: {
      mymessages: MyMessages,
    },
    // Mark this state as requiring authentication.  See ../routerhooks/requiresAuth.js.
    data: { requiresAuth: true },
    // If mymessages state is directly activated, redirect the transition to the most recent
    // child state that was previously activated, or 'mymessages.messagelist' (by default)
    dsr: {
      default: 'mymessages.messagelist',
      fn: dsrRedirectToDefaultFromWithin,
    },
    sticky: true,
  },
});

// Registered here, not in the table package, which can't name the param types RegisteredRows adds.
type Rows = RegisteredRows<typeof mymessagesTable>;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<Rows> {}
}

/** The mymessages module's rows, each the one registered under its name. */
export type MyMessagesStates = AssertNoCollisions<Rows>;
