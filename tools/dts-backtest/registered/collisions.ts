// `CollisionsOf` over one table of every kind of row.
import type {
  AssertNoCollisions,
  CollisionsOf,
  StatesOf,
} from 'ui-router-registry';

export class AccountAuditState {
  readonly name = 'account.audit';

  readonly url = '/audit';

  static __uiRouterState = true;
}

export const accountAuditStates = [
  AccountAuditState,
  { name: 'account.audit.log', url: '/log' },
] as const;

declare module 'ui-router-registry' {
  // oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- the members come from StatesOf
  interface RegisteredStates extends StatesOf<typeof accountAuditStates> {}
}

export type AccountAuditStates = AssertNoCollisions<typeof accountAuditStates>;

declare const registered: CollisionsOf<typeof accountAuditStates>;

export const noCollisions: never = registered;

declare const mixed: readonly [
  { readonly name: 'account'; readonly url: '/me' },
  typeof AccountAuditState,
  { readonly name: 'billing'; readonly url: '/billing' },
  { name: string },
];

declare const mixedCollisions: CollisionsOf<typeof mixed>;

// The changed and the unregistered rows collide; the registered class and the widened name don't.
export const collided: 'account' | 'billing' = mixedCollisions;

export const collisions: (typeof mixedCollisions)[] = ['account', 'billing'];

// @ts-expect-error the registered class row doesn't collide
export const audit: typeof mixedCollisions = 'account.audit';
