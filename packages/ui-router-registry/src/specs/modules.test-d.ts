// `RegisteredStates` filled by `admin-states.ts` and `contact-help-states.ts`,
// alongside `registry.test-d.ts`' `Register`. `tsc --noEmit` is the assertion;
// nothing runs this file.
import type {
  AssertNoCollisions,
  CollisionsOf,
  RegisteredStates,
  ResolvedParamsOf,
  StateName,
  StatesOf,
  TypedStateService,
} from '../index.js';
import type { adminStates } from './admin-states.js';
import type { ContactHelpState } from './contact-help-states.js';

declare const stateService: TypedStateService;

declare function accepts<T>(value: T): T;

// -- names from every source --------------------------------------------------

accepts<StateName>('admin.users.user');

accepts<StateName>('admin.audit');

accepts<StateName>('contacts.contact.help');

accepts<StateName>('home');

// @ts-expect-error a module's future-state placeholder isn't a target
accepts<StateName>('admin.reports.**');

accepts<keyof RegisteredStates>('admin.reports.**');

// A hand-registered class keeps its constructor as the row.
declare const helpRow: RegisteredStates['contacts.contact.help'];

accepts<typeof ContactHelpState>(helpRow);

// -- params across modules ----------------------------------------------------

void stateService.go('admin.users.user', { orgId: 'o1', userId: 1 });

// @ts-expect-error a child inherits its module parent's required param
void stateService.go('admin.users.user', { userId: 1 });

// @ts-expect-error a wrong param type: `{userId:int}` is a number
void stateService.go('admin.users.user', { orgId: 'o1', userId: '1' });

void stateService.go('admin.users', { orgId: 'o1', role: 'owner' });

void stateService.go('contacts.contact.help', { contactId: 'c1' });

// @ts-expect-error a parent registered through `Register` keeps its required param
void stateService.go('contacts.contact.help', { topic: 'sharing' });

declare const resolved: ResolvedParamsOf<'admin.users.user'>;

accepts<number>(resolved.userId);

accepts<string>(resolved.orgId);

// -- StatesOf -----------------------------------------------------------------

declare const byName: StatesOf<typeof adminStates>;

// A class-declared row is keyed by its instance's name, not `Function.name`.
accepts<typeof adminStates>([
  byName.admin,
  byName['admin.users'],
  byName['admin.users.user'],
  byName['admin.audit'],
  byName['admin.reports.**'],
]);

declare const widened: StatesOf<readonly [{ name: string }]>;

// @ts-expect-error a widened name registers no key
void widened.anything;

// -- collisions ---------------------------------------------------------------

// The admin module's class-declared and future-state rows are the registered ones.
export type AdminStates = AssertNoCollisions<typeof adminStates>;

declare const adminCollisions: CollisionsOf<typeof adminStates>;

accepts<never>(adminCollisions);

declare const conflicting: readonly [
  { readonly name: 'admin.users'; readonly url: '/members' },
  { readonly name: 'admin'; readonly url: '/admin' },
];

// @ts-expect-error the conflicting module's row lost
export type ConflictingStates = AssertNoCollisions<typeof conflicting>;

declare const conflictingCollisions: CollisionsOf<typeof conflicting>;

// Its other row is the registered one.
accepts<'admin.users'>(conflictingCollisions);

accepts<typeof conflictingCollisions>('admin.users');

declare const unregistered: readonly [
  { readonly name: 'billing'; readonly url: '/billing' },
  { readonly name: 'billing.invoices'; readonly url: '/invoices' },
];

// @ts-expect-error a table that never augmented collides on every name
export type UnregisteredStates = AssertNoCollisions<typeof unregistered>;

declare const unregisteredCollisions: CollisionsOf<typeof unregistered>;

accepts<'billing' | 'billing.invoices'>(unregisteredCollisions);

accepts<typeof unregisteredCollisions>('billing.invoices');

// A widened name registers no key, so it can't collide.
export type WidenedStates = AssertNoCollisions<
  readonly [{ name: string }, (typeof adminStates)[0]]
>;
