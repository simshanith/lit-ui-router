// A lazy module registering its own table, class-declared and object rows mixed.
import type { StatesOf } from 'ui-router-registry';

export class AdminAuditState {
  readonly name = 'admin.audit';

  readonly url = '/audit';

  static __uiRouterState = true;
}

export const adminStates = [
  { name: 'admin', url: '/admin' },
  { name: 'admin.users', url: '/:orgId/users?role' },
  { name: 'admin.users.user', url: '/{userId:int}' },
  AdminAuditState,
  { name: 'admin.reports.**', url: '/reports' },
] as const;

declare module 'ui-router-registry' {
  // oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- the members come from StatesOf
  interface RegisteredStates extends StatesOf<typeof adminStates> {}
}
