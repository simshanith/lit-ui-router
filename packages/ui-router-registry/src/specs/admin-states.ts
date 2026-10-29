import type { StatesOf } from '../index.js';

export class AdminAuditState {
  readonly name = 'admin.audit';

  readonly url = '/audit';

  static __uiRouterState = true;
}

// The lazy module behind `states.ts`' `admin.**`, registering its own table.
export const adminStates = [
  { name: 'admin', url: '/admin' },
  { name: 'admin.users', url: '/:orgId/users?role' },
  { name: 'admin.users.user', url: '/{userId:int}' },
  AdminAuditState,
  // A future state's placeholder inside a module.
  { name: 'admin.reports.**', url: '/reports' },
] as const;

declare module '../index.js' {
  interface RegisteredStates extends StatesOf<typeof adminStates> {}
}
