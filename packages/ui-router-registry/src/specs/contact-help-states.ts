// A class-declared state registered by hand, under a parent from `Register`.
export class ContactHelpState {
  readonly name = 'contacts.contact.help';

  readonly url = '/help?topic';

  static __uiRouterState = true;
}

declare module '../index.js' {
  interface RegisteredStates {
    'contacts.contact.help': typeof ContactHelpState;
  }
}
