// Type-level probe for #1306: what augmenting @uirouter/core's StateService
// buys. Interface merging adds the typed signature as an overload, but core's
// own `go(to: StateOrName, params?: RawParams)` stays beside it, so every
// call the registry should reject still matches the loose overload.
import type {
  TransitionOptions,
  TransitionPromise,
  StateService,
} from '@uirouter/core';
import type {
  ParamArgs,
  StateName,
} from 'sample-app-shared/registry/registry.js';

declare module '@uirouter/core' {
  interface StateService {
    go<N extends StateName>(
      to: N,
      ...args: ParamArgs<N, TransitionOptions>
    ): TransitionPromise;
  }
}

declare const stateService: StateService;

// The typed overload resolves first, so a correct call infers through it.
void stateService.go('contacts.contact', { contactId: 'c1' });

// None of these errors: each falls through to core's loose overload.
void stateService.go('contcts');

void stateService.go('contacts.contact');

void stateService.go('contacts.contact', { contactId: 1 });

// The merge took: only the added overload is generic, and an explicit type
// argument selects it alone, which is the only way to get its checks back.
void stateService.go<'contacts.contact'>('contacts.contact', {
  contactId: 'c1',
});

// @ts-expect-error a missing required param, once the loose overload is excluded
void stateService.go<'contacts.contact'>('contacts.contact');
