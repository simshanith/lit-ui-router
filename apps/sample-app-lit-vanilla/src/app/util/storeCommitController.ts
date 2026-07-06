import { ReactiveController, ReactiveControllerHost } from 'lit';

/** The event-emitting surface of a fake REST store (see ./sessionStorage.js) */
interface CommitEventSource {
  addEventListener: EventTarget['addEventListener'];
  removeEventListener: EventTarget['removeEventListener'];
}

/**
 * A ReactiveController that re-renders its host whenever a fake REST store
 * commits data (message saved/deleted, marked read, etc).
 *
 * Route resolves only run during transitions, so data mutated between
 * transitions needs a push-based refresh; this controller provides it with
 * automatic subscribe/unsubscribe tied to the host's DOM lifecycle.
 */
export class StoreCommitController implements ReactiveController {
  constructor(
    private host: ReactiveControllerHost,
    private store: CommitEventSource,
  ) {
    host.addController(this);
  }

  private onCommit = () => this.host.requestUpdate();

  hostConnected() {
    this.store.addEventListener('commit', this.onCommit);
  }

  hostDisconnected() {
    this.store.removeEventListener('commit', this.onCommit);
  }
}
