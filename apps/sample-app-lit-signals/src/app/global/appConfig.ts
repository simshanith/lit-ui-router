import { Signal } from 'signal-polyfill';

interface AppConfigFields {
  sort: string;
  emailAddress: string | undefined;
  restDelay: number;
}

/**
 * This service stores and retrieves user preferences in session storage.
 *
 * Each field is backed by a `Signal.State`, so components that read them —
 * through a SignalController, or in a SignalWatcher render like the nav
 * header — update automatically when they change.
 */
export class AppConfig {
  readonly #sort = new Signal.State('+date');
  readonly #emailAddress = new Signal.State<string | undefined>(undefined);
  readonly #restDelay = new Signal.State(100);

  constructor() {
    this.load();
  }

  get sort() {
    return this.#sort.get();
  }
  set sort(value: string) {
    this.#sort.set(value);
  }

  get emailAddress() {
    return this.#emailAddress.get();
  }
  set emailAddress(value: string | undefined) {
    this.#emailAddress.set(value);
  }

  get restDelay() {
    return this.#restDelay.get();
  }
  set restDelay(value: number) {
    this.#restDelay.set(value);
  }

  load() {
    try {
      // SAFETY: `appConfig` in sessionStorage is written only by save(), from these fields
      const saved = JSON.parse(
        sessionStorage.getItem('appConfig') || '{}',
      ) as Partial<AppConfigFields>;

      if (saved.sort !== undefined) this.sort = saved.sort;

      if (saved.emailAddress !== undefined)
        this.emailAddress = saved.emailAddress;

      if (saved.restDelay !== undefined) this.restDelay = saved.restDelay;
    } catch (error) {
      console.error(error);
    }
  }

  save() {
    const fields: AppConfigFields = {
      sort: this.sort,
      emailAddress: this.emailAddress,
      restDelay: this.restDelay,
    };

    sessionStorage.setItem('appConfig', JSON.stringify(fields));
  }
}

const instance = new AppConfig();

export default instance;
