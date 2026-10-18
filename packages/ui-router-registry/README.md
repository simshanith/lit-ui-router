# ui-router-registry

Typed state names and params for [UI-Router](https://ui-router.github.io): a types-only registry for `@uirouter/core`. It emits no JavaScript.

Not yet published; its first release is `0.1.0`.

## Features

- **`Register`**: the interface an app augments with its `as const` state declarations. Until it does, every type below falls back to core's `string` and `RawParams`.
- **`StateName`**: the registered state names. Dotted names and `parent:` both resolve; a future state's `name.**` placeholder and a widened `string` name are left out.
- **`ParamsOf` and `ResolvedParamsOf`**: the params a state accepts and the params it reads back, its ancestors' included. Url placeholders are required, query params and params with a default are optional to pass, and defaults are present to read. `int`, `bool`, `date` and `json` placeholders and `type:`s map to TypeScript types.
- **`TypedStateService`**: a view of core's `StateService` whose `go`, `transitionTo`, `target`, `href`, `is` and `includes` take registered names and their params. Relative refs and object targets stay loose. Core's class is assignable to it, so a typed getter needs no cast.
- **`TypedRouteSnapshot`**: a view of the route snapshot the reactive packages share. `includes(name)` is a type predicate that narrows `current` and `params` to that state's subtree.

## Usage

Register the app's declarations once:

```typescript
import type { states } from './states';

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}
```

Then annotate where the router is used:

```typescript
import type { TypedStateService } from 'ui-router-registry';

const stateService: TypedStateService = router.stateService;

stateService.go('contacts.contact', { contactId: 'c1' });
```

## Dependencies

`@uirouter/core` is a peer dependency, for its types only. Install one copy of this package per app: two copies mean two `Register`s, and the augmentation types only one.
