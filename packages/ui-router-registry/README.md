# ui-router-registry

Typed state names and params for [UI-Router](https://ui-router.github.io): a types-only registry for `@uirouter/core`. It emits no JavaScript.

## Installation

```bash
npm install --save-dev ui-router-registry
```

## Features

- **`Register`**: the interface an app augments with its `as const` state declarations. Until it does, every type below falls back to core's `string` and `RawParams`.
- **`StateName`**: the registered state names. Dotted names and `parent:` both resolve; a future state's `name.**` placeholder and a widened `string` name are left out.
- **`ParamsOf` and `ResolvedParamsOf`**: the params a state accepts and the params it reads back, its ancestors' included. Url placeholders are required, query params and params with a default are optional to pass, and defaults are present to read. A `value: null` default adds `null` to a url or typed param; an untyped non-url param is core's `any` and reads as its default's type, `unknown` for `null`. `int`, `bool`, `date` and `json` placeholders and `type:`s map to TypeScript types.
- **`TypedStateService`**: a view of core's `StateService` whose `go`, `transitionTo`, `target`, `href`, `is` and `includes` take registered names and their params. Relative refs are checked by their tail with loose params; object targets and `UncheckedRef` stay loose. Core's class is assignable to it, so a typed getter needs no cast.
- **`TypedRouteSnapshot`**: a view of the route snapshot the reactive packages share. `includes(name)` is a type predicate that narrows `current` and `params` to that state's subtree.
- **`ui-router-registry/signals`, `/effect` and `/mobx`**: type-only entry points that fill the `RouteTypes` interface of `ui-router-signals`, `ui-router-effect` and `ui-router-mobx` from the registry, so their route snapshots are `TypedRouteSnapshot`s. `RegisteredRouteTypes` holds the members they fill in.

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

### Reactive adapters

`ui-router-signals`, `ui-router-effect` and `ui-router-mobx` each declare an empty `RouteTypes` interface. A type-only import of the matching entry point, next to the `Register` augmentation, fills it in:

```typescript
import type {} from 'ui-router-registry/signals';
```

| Entry point                  | Fills in                                                 | Typed                                                                                                                         |
| ---------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ui-router-registry/signals` | `ui-router-signals`' `RouteTypes.snapshot`               | `RouterSignals.route`, and the selector of `lit-ui-router-signals`' `RouterSignalController`                                  |
| `ui-router-registry/effect`  | `ui-router-effect`'s `RouteTypes.snapshot`               | the value `routeRef` holds, and the selector of `lit-ui-router-effect`'s `RouterRefController`; `snapshotRoute` stays untyped |
| `ui-router-registry/mobx`    | `ui-router-mobx`'s `RouteTypes.snapshot` and `snapshots` | `RouterStore`'s `current`, `params` and `includes`, where `includes(name)` narrows the store                                  |

The snapshot narrows as `TypedRouteSnapshot` does:

```typescript
const route = RouterSignals.for(router).route.get();

if (route.includes('contacts.contact')) {
  route.params.contactId; // string
}
```

Until an app registers, the adapters keep their untyped `RouteSnapshot`, `StateDeclaration` and `RawParams`.

### Relative refs and unchecked targets

A relative ref (`.child`, `^`, `^.sibling`, or `.` for the base state itself) resolves against the `uiSref`'s context or `options.relative`, which types can't see. Its tail is checked against the registered names, so `.contcat` fails, and its params stay loose. A relative ref also lets a link reuse the current params instead of restating them: `uiSref('.edit')` from `contacts.contact` inherits `contactId`.

A target the registry can't see, such as a name built at runtime or a state registered at runtime, is a `string` and fails once an app registers. Opt out explicitly with `UncheckedRef`; its params are loose:

```typescript
import type { UncheckedRef } from 'ui-router-registry';

uiSref(link.state as UncheckedRef, link.params);
stateService.go(name as UncheckedRef);
```

### Annotate members and templates that call typed targets

A state declaration that names a component and is checked with `satisfies` against a type that inspects the component, such as `LitStateDeclaration`, makes that component part of `Register`'s type. If one of the component's members calls a typed target (`go`, `href`, a typed `uiSref` wrapper) and has no declared return type, TypeScript has to infer that member from `Register` while still building `Register`, and reports a circular type (TS7022, TS7023, TS7024, TS2456, TS2502 or TS2313). Declare the member's return type:

```typescript
render(): TemplateResult {
  return html`<a href=${this.stateService.href('contacts.contact', { contactId })}>…</a>`;
}
```

A template written inline on the state declaration is inferred the same way, so declare its return type too:

```typescript
{
  name: 'account',
  url: '/account',
  component: (): TemplateResult => html`<a ${uiSref('contacts.contact', { contactId })}>…</a>`,
}
```

## Dependencies

`@uirouter/core` is a peer dependency, for its types only. `ui-router-signals`, `ui-router-effect` and `ui-router-mobx` are optional peers at `^0.2.0`, each needed only by its entry point. Install one copy of this package per app: two copies mean two `Register`s, and the augmentation types only one.
