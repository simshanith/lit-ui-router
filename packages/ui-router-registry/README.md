# ui-router-registry

Typed state names and params for [UI-Router](https://ui-router.github.io): a types-only registry for `@uirouter/core`. It emits no JavaScript.

## Installation

```bash
npm install --save-dev ui-router-registry@rc
```

## Features

- **`Register`**: the interface an app augments with its `as const` state declarations. Until it does, every type below falls back to core's `string` and `RawParams`.
- **`StateName`**: the registered state names. Dotted names and `parent:` both resolve; a future state's `name.**` placeholder and a widened `string` name are left out.
- **`ParamsOf` and `ResolvedParamsOf`**: the params a state accepts and the params it reads back, its ancestors' included. Url placeholders are required, query params and params with a default are optional to pass, and defaults are present to read. `int`, `bool`, `date` and `json` placeholders and `type:`s map to TypeScript types.
- **`TypedStateService`**: a view of core's `StateService` whose `go`, `transitionTo`, `target`, `href`, `is` and `includes` take registered names and their params. Relative refs are checked by their tail with loose params; object targets and `UncheckedRef` stay loose. Core's class is assignable to it, so a typed getter needs no cast.
- **`TypedRouteSnapshot`**: a view of the route snapshot the reactive packages share. `includes(name)` is a type predicate that narrows `current` and `params` to that state's subtree.
- **`ui-router-registry/lit`**: a type-only import, `import type {} from 'ui-router-registry/lit'`, that types `lit-ui-router`'s own `uiSref`, `srefHref`, `uiSrefActive`, `srefActiveClass`, `srefAriaCurrent` and `SrefStatusController` targets by filling in its `RouteTypes` interface. `lit-ui-router` is an optional peer, needed only by this entry point.

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

### Relative refs and unchecked targets

A relative ref (`.child`, `^`, `^.sibling`) resolves against the `uiSref`'s context or `options.relative`, which types can't see. Its tail is checked against the registered names, so `.contcat` fails, and its params stay loose. A relative ref also lets a link reuse the current params instead of restating them: `uiSref('.edit')` from `contacts.contact` inherits `contactId`.

A target the registry can't see, such as a name built at runtime or a state registered at runtime, is a `string` and fails once an app registers. Opt out explicitly with `UncheckedRef`; its params are loose:

```typescript
import type { UncheckedRef } from 'ui-router-registry';

uiSref(link.state as UncheckedRef, link.params);
stateService.go(name as UncheckedRef);
```

### Templates on TypeScript before 5.6

A `satisfies LitStateDeclaration` check reads a class component through its element brand and a template through its parameters, so neither is inferred from `Register`. TypeScript before 5.6 still infers a template's return from its body, so there a template under `component` or `views` that calls a typed target (`href`, a typed `uiSref`) reports a circular type (TS7022, TS2456). Declare its return type:

```typescript
component: (): TemplateResult => html`<a ${uiSref('contacts.contact', { contactId })}>…</a>`,
```

### JavaScript projects

The package ships no runtime code, and the adapters never import it, so JavaScript without `checkJs` sees no change. Under `checkJs`, a `Register` augmentation in any TypeScript file of the program checks the JavaScript files' calls too; the escape is a JSDoc cast:

```javascript
uiSref(/** @type {import('ui-router-registry').UncheckedRef} */ (name));
```

## Dependencies

`@uirouter/core` is a peer dependency, for its types only. Install one copy of this package per app: two copies mean two `Register`s, and the augmentation types only one.
