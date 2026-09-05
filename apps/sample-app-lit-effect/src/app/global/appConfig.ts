import { SubscriptionRef } from 'effect';

import { runtime } from '../effect/runtime.js';

/**
 * This service stores and retrieves user preferences in session storage.
 *
 * The logged-in user is a `SubscriptionRef`, so components that select it
 * through a RefController — e.g. the nav header — update automatically when
 * it changes. The shared `AppConfig` contract is synchronous, so the getter
 * and setter run the ref's Effects with `runtime.runSync`.
 */
export class AppConfig {
  sort = '+date';
  restDelay = 100;

  /** The logged-in user, as a stream-able ref. */
  readonly emailAddress$ = runtime.runSync(
    SubscriptionRef.make<string | undefined>(undefined),
  );

  constructor() {
    this.load();
  }

  get emailAddress(): string | undefined {
    return runtime.runSync(SubscriptionRef.get(this.emailAddress$));
  }

  set emailAddress(emailAddress: string | undefined) {
    runtime.runSync(SubscriptionRef.set(this.emailAddress$, emailAddress));
  }

  load() {
    try {
      Object.assign(this, {
        ...JSON.parse(sessionStorage.getItem('appConfig') || '{}'),
      });
    } catch (error) {
      console.error(error);
    }
  }

  save() {
    // Named fields, not a spread: `emailAddress` is an accessor over the ref,
    // so it is not an own property.
    const { sort, emailAddress, restDelay } = this;
    sessionStorage.setItem(
      'appConfig',
      JSON.stringify({ sort, emailAddress, restDelay }),
    );
  }
}

const instance = new AppConfig();
export default instance;
