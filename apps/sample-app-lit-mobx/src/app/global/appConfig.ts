import { makeAutoObservable } from 'mobx';

/**
 * This service stores and retrieves user preferences in session storage.
 *
 * Its fields are MobX observables, so components that select them through a
 * ReactionController — e.g. the nav header showing the logged-in user —
 * update automatically when they change.
 */
export class AppConfig {
  sort = '+date';
  emailAddress: string | undefined = undefined;
  restDelay = 100;

  constructor() {
    makeAutoObservable(this);
    this.load();
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
    sessionStorage.setItem('appConfig', JSON.stringify({ ...this }));
  }
}

const instance = new AppConfig();
export default instance;
