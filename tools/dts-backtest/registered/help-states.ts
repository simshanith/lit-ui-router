// A class-declared state registered by hand, under a parent from `Register`.
export class ItemHelpState {
  readonly name = 'item.edit.help';

  readonly url = '/help?topic';

  static __uiRouterState = true;
}

declare module 'ui-router-registry' {
  interface RegisteredStates {
    'item.edit.help': typeof ItemHelpState;
  }
}
