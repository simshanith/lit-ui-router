// `RegisteredStates` filled by `admin-states.ts` and `contact-help-states.ts`,
// alongside `registry.test-d.ts`' `Register`. `tsc --noEmit` is the assertion;
// nothing runs this file.
import type {
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

// The names in T whose rows aren't the ones registered under them.
type Collisions<T extends readonly { name: string }[]> = {
  [K in keyof StatesOf<T>]: K extends keyof RegisteredStates
    ? [StatesOf<T>[K], RegisteredStates[K]] extends [
        RegisteredStates[K],
        StatesOf<T>[K],
      ]
      ? never
      : K
    : K;
}[keyof StatesOf<T>];

declare function noCollisions<T extends readonly { name: string }[]>(
  ...ok: [Collisions<T>] extends [never] ? [] : [collisions: Collisions<T>]
): void;

noCollisions<typeof adminStates>();

declare const conflicting: readonly [
  { readonly name: 'admin.users'; readonly url: '/members' },
  { readonly name: 'admin'; readonly url: '/admin' },
];

noCollisions<typeof conflicting>('admin.users');

// @ts-expect-error the conflicting module's row lost
noCollisions<typeof conflicting>();

declare const unregistered: readonly [
  { readonly name: 'billing'; readonly url: '/billing' },
];

// A table that never augmented reads as colliding on every name.
noCollisions<typeof unregistered>('billing');
