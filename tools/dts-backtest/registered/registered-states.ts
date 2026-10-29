// Names and params across `Register` and the two `RegisteredStates` modules beside it.
import type {
  ParamsOf,
  RegisteredStates,
  StateName,
  StatesOf,
  TypedStateService,
} from 'ui-router-registry';
import type { adminStates } from './admin-states.js';
import type { ItemHelpState } from './help-states.js';

declare const stateService: TypedStateService;

export const names: StateName[] = [
  'home',
  'admin.users.user',
  'admin.audit',
  'item.edit.help',
];

// @ts-expect-error a module's future-state placeholder isn't a target
export const placeholder: StateName = 'admin.reports.**';

export const userParams: ParamsOf<'admin.users.user'> = {
  orgId: 'o1',
  userId: 1,
};

// @ts-expect-error a child inherits its module parent's required param
export const orphanParams: ParamsOf<'admin.users.user'> = { userId: 1 };

export const helpHref: string = stateService.href('item.edit.help', {
  id: 1,
  topic: 'sharing',
});

// @ts-expect-error a parent registered through `Register` keeps its required param
export const orphanHref: string = stateService.href('item.edit.help', {});

declare const helpRow: RegisteredStates['item.edit.help'];

// A hand-registered class keeps its constructor as the row.
export const helpClass: typeof ItemHelpState = helpRow;

declare const byName: StatesOf<typeof adminStates>;

// A class-declared row is keyed by its instance's name, not `Function.name`.
export const adminRows: typeof adminStates = [
  byName.admin,
  byName['admin.users'],
  byName['admin.users.user'],
  byName['admin.audit'],
  byName['admin.reports.**'],
];
