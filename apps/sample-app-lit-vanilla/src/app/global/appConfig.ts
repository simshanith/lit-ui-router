/**
 * This service stores and retrieves user preferences in session storage
 */
export class AppConfig {
  sort: string;
  emailAddress: string | undefined;
  restDelay: number;

  constructor() {
    this.sort = '+date';
    this.emailAddress = undefined;
    this.restDelay = 100;
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
    // eslint-disable-next-line typescript/no-misused-spread -- serialize own props only
    sessionStorage.setItem('appConfig', JSON.stringify({ ...this }));
  }
}

const instance = new AppConfig();
export default instance;
