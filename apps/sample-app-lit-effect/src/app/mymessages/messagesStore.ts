import { Effect, Stream, SubscriptionRef } from 'effect';

import { appModulesRegistered } from 'sample-app-shared/app/global/appModules.js';
import { MessagesStorage } from 'sample-app-shared/app/global/dataSources.js';
import { Message } from 'sample-app-shared/app/mymessages/interface.js';

import { runtime } from '../effect/runtime.js';
import AppConfig from '../global/appConfig.js';

export interface MessagesSnapshot {
  messages: Message[];

  /** False until the first fetch resolves; callers may fall back to resolves. */
  loaded: boolean;
}

/**
 * A `SubscriptionRef` cache of the fake REST MessagesStorage.
 *
 * The storage's 'commit' event (message sent, drafted, deleted, marked read)
 * is funneled into this one ref, so components following it through
 * RefController selectors re-render automatically when messages change
 * between route transitions — resolves only run during transitions and would
 * otherwise go stale.
 */
export const messages$ = runtime.runSync(
  SubscriptionRef.make<MessagesSnapshot>({ messages: [], loaded: false }),
);

// MessagesStorage is untyped JS; the explicit type argument pins what `all`
// hands back.
const refresh = Effect.promise<Message[]>(() =>
  MessagesStorage.all((messages: Message[]) => messages),
).pipe(
  Effect.flatMap((messages) =>
    SubscriptionRef.set(messages$, { messages: [...messages], loaded: true }),
  ),
);

// One daemon fiber for the app's lifetime: MessagesStorage is a plain event
// target with no teardown, so the subscription is never interrupted.
runtime.runFork(
  Stream.runForEach(
    Stream.fromEventListener<Event>(MessagesStorage, 'commit'),
    () => refresh,
  ),
);

// The initial load: MessagesStorage.all reads AppConfig.restDelay, which is
// only bound once the app registers its modules.
void appModulesRegistered.then(() => runtime.runFork(refresh));

/**
 * The current user's messages in a folder (same matching rules as
 * MessagesStorage.byFolder). A pure function of the snapshot, so a component
 * can derive it from whatever the ref last emitted.
 */
export function byFolder(
  snapshot: MessagesSnapshot,
  folderId: string,
): Message[] {
  const toFromAttr = ['drafts', 'sent'].includes(folderId) ? 'from' : 'to';
  const emailAddress = AppConfig.emailAddress ?? '';
  return snapshot.messages.filter(
    (message) =>
      message.folder === folderId &&
      (message[toFromAttr] ?? '').includes(emailAddress),
  );
}
