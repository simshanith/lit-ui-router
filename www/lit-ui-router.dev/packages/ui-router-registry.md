---
title: UI-Router Registry
description: Typed state names and params for a @uirouter/core router with ui-router-registry, a types-only registry
---

# ui-router-registry

<p class="badges">
<a href="https://npmx.dev/package/ui-router-registry" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-registry" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-registry" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-registry@*" /></a>
</p>

[`ui-router-registry`](https://npmx.dev/package/ui-router-registry) types the
state names and params of a `@uirouter/core` router from the app's own
`as const` state declarations. It is types only and emits no JavaScript.

## Installation

```bash
npm install --save-dev ui-router-registry
```

`@uirouter/core` is a peer dependency, for its types only. `ui-router-signals`,
`ui-router-effect` and `ui-router-mobx` are optional peers at `^0.2.0`, each
needed only by its entry point. Install one copy of this package per app: two
copies mean two registries, and the augmentations type only one.

## Registering states

Register each module's declarations next to its state table:

```ts
import type { StatesOf } from 'ui-router-registry';

export const contactsStates = [
  { name: 'contacts', url: '/contacts' },
  { name: 'contacts.contact', url: '/:contactId' },
] as const;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof contactsStates> {}
}
```

Each module, lazy ones included, adds its own line, and every file sees every
module's names. A class-declared state can sit in the table or be registered by
hand: `interface RegisteredStates { about: typeof AboutState }`. Two modules
that register one name with different rows are a TS2320 error in the
registry's declarations; on TypeScript 5 `skipLibCheck` hides it and the first
row wins, which [`AssertNoCollisions`](#collisions-across-modules) checks for.

`Register` takes every declaration at one site instead:

```ts
import type { appStates, lazyStates } from './states';

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof appStates)[number] | (typeof lazyStates)[number];
  }
}
```

The registry reads both, so the two forms mix.

Until an app registers, every type falls back to core's `string` and
`RawParams`, so existing calls compile unchanged.

## Collisions across modules

When two modules register one name with different rows, the first row wins.
TypeScript 7 reports TS2320 at each module's augmentation, and core throws
`State '…' is already defined` when the second module registers. On TypeScript 5
the error lands in the registry's declarations, where `skipLibCheck` hides it.
The check is opt-in: `AssertNoCollisions` takes a module's table and fails
unless every row in it is the one registered under its name. Assert it next to
the module's augmentation:

```ts
import type { AssertNoCollisions, StatesOf } from 'ui-router-registry';

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof contactsStates> {}
}

export type ContactsStates = AssertNoCollisions<typeof contactsStates>;
```

A row that collides fails at that line, as a missing
`'not the row registered under'` key holding the state's name. The assertion is
a type, so it emits nothing; the `export` keeps `noUnusedLocals` quiet. A table
that never augmented `RegisteredStates` collides on every name. `CollisionsOf`
gives the colliding names as a union, `never` when there are none.

## Typed calls

Annotate where the router is used. `TypedStateService` extends core's
`StateService`, so the two are assignable both ways: the annotation needs no
cast, and the view, or a `UIRouter` whose `stateService` is typed with it,
passes wherever core's type is expected:

```ts
import type { TypedStateService } from 'ui-router-registry';

const stateService: TypedStateService = router.stateService;

stateService.go('contacts.contact', { contactId: 'c1' });
```

| Type                                    | What it holds                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RegisteredStates` and `StatesOf`       | the interface each module augments with its `as const` state declarations, keyed by name                                                                            |
| `AssertNoCollisions` and `CollisionsOf` | the check that a module's table is the one registered under each of its names, and the names that collide                                                           |
| `Register`                              | the interface that takes every state declaration at one augmentation site                                                                                           |
| `StateName`                             | the registered state names; dotted names and `parent:` both resolve, and a future state's `name.**` placeholder is left out                                         |
| `ParamsOf` and `ResolvedParamsOf`       | the params a state accepts and the params it reads back, its ancestors' included; url placeholders are required, query params are not                               |
| `TypedStateService`                     | `go`, `transitionTo`, `target`, `href`, `is`, `includes` and `reload` over registered names; relative refs are checked by their tail, and object targets stay loose |
| `TypedRouteSnapshot`                    | the route snapshot the reactive packages share, whose `includes(name)` narrows `current` and `params` to that state's subtree                                       |
| `RegisteredRouteTypes`                  | the members the `/signals`, `/effect` and `/mobx` entry points fill the adapters' `RouteTypes` interfaces from                                                      |

`lit-ui-router`'s `uiSref`, `srefHref`, `uiSrefActive`, `srefActiveClass`,
`srefAriaCurrent` and `SrefStatusController` read `Register` themselves, with no
import line. `lit-ui-router` takes this package as an optional peer.

## Reactive adapters

`ui-router-signals`, `ui-router-effect` and `ui-router-mobx` each declare an
empty `RouteTypes` interface. A type-only import of the matching entry point,
next to an augmentation, fills it in:

```ts
import type {} from 'ui-router-registry/signals';
```

| Entry point                  | Fills in                                                 | Typed                                                                                                                         |
| ---------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ui-router-registry/signals` | `ui-router-signals`' `RouteTypes.snapshot`               | `RouterSignals.route`, and the selector of `lit-ui-router-signals`' `RouterSignalController`                                  |
| `ui-router-registry/effect`  | `ui-router-effect`'s `RouteTypes.snapshot`               | the value `routeRef` holds, and the selector of `lit-ui-router-effect`'s `RouterRefController`; `snapshotRoute` stays untyped |
| `ui-router-registry/mobx`    | `ui-router-mobx`'s `RouteTypes.snapshot` and `snapshots` | `RouterStore`'s `current`, `params` and `includes`, where `includes(name)` narrows the store                                  |

The snapshot narrows as `TypedRouteSnapshot` does:

```ts
const route = RouterSignals.for(router).route.get();

if (route.includes('contacts.contact')) {
  route.params.contactId; // string
}
```

Until an app registers, the adapters keep their untyped `RouteSnapshot`,
`StateDeclaration` and `RawParams`.

## Relative refs and unchecked targets

A relative ref (`.child`, `^`, `^.sibling`, or `.` for the base state
itself) resolves against the `uiSref`'s context or `options.relative`, which types can't see. Its tail is checked
against the registered names, so `.contcat` fails, and its params stay loose. A
relative ref also lets a link reuse the current params instead of restating
them: `uiSref('.edit')` from `contacts.contact` inherits `contactId`.

A target the registry can't see, such as a name built at runtime or a state
registered at runtime, is a `string` and fails once an app registers. Opt out
explicitly with `UncheckedRef`; its params are loose:

```ts
import type { UncheckedRef } from 'ui-router-registry';

uiSref(link.state as UncheckedRef, link.params);
stateService.go(name as UncheckedRef);
```

## Check components that call typed targets

A state declaration that names a component and is checked with `satisfies`
against a type that inspects the component, such as `LitStateDeclaration`, makes
that component part of the registered states' type. If one of the component's members
calls a typed target (`go`, `href`, `uiSref`) and has no
declared return type, TypeScript has to infer that member from the registry
while still building it, and reports a circular type (TS7022, TS7023, TS7024,
TS2456, TS2502 or TS2313).

For `lit-ui-router` states, check the declarations with
`TypedLitStateDeclaration`, which checks a LitElement class by its public
members and a template function by its parameters, so it never infers `render()`
or a template's body:

```ts
const contactState = {
  name: 'contacts.contact',
  url: '/:contactId',
  component: ContactView,
} as const satisfies TypedLitStateDeclaration;
```

Classes clear this way on every supported TypeScript, templates on TypeScript
5.5 and later. A component checked against a type that inspects it, or a
template on TypeScript before 5.5, still needs a declared return type:

```ts
render(): TemplateResult {
  return html`<a href=${this.stateService.href('contacts.contact', { contactId })}>…</a>`;
}
```

A template written inline on the state declaration is inferred the same way, so
declare its return type too:

```ts
{
  name: 'account',
  url: '/account',
  component: (): TemplateResult => html`<a ${uiSref('contacts.contact', { contactId })}>…</a>`,
}
```

## Further reading

- [API reference](/api/ui-router-registry/)
- [UI-Router — state declarations](https://ui-router.github.io/core/docs/latest/interfaces/_state_interface_.statedeclaration.html)
