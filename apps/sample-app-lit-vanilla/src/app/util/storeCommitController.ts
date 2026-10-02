import { ReactiveController, ReactiveControllerHost } from 'lit';

/** The event-emitting surface of a fake REST store (see ./sessionStorage.js) */
interface CommitEventSource {
  addEventListener: EventTarget['addEventListener'];
  removeEventListener: EventTarget['removeEventListener'];
}

/**
 * A ReactiveController that reacts whenever a fake REST store commits data
 * (message saved/deleted, marked read, etc); by default it re-renders its host.
 *
 * Route resolves only run during transitions, so data mutated between
 * transitions needs a push-based refresh; this controller provides it with
 * automatic subscribe/unsubscribe tied to the host's DOM lifecycle.
 *
 * A host that derives state from the store instead of reading it in render
 * passes `onCommit` and re-derives there.
 */
export class StoreCommitController implements ReactiveController {
  constructor(
    host: ReactiveControllerHost,
    private readonly store: CommitEventSource,
    private readonly onCommit: () => void = () => host.requestUpdate(),
  ) {
    host.addController(this);
  }

  private readonly handleCommit = () => this.onCommit();

  hostConnected() {
    this.store.addEventListener('commit', this.handleCommit);
  }

  hostDisconnected() {
    this.store.removeEventListener('commit', this.handleCommit);
  }
}
