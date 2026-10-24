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

`@uirouter/core` is a peer dependency, for its types only. Install one copy of
this package per app: two copies mean two `Register`s, and the augmentation
types only one.

## Registering states

Register the app's declarations once:

```ts
import type { states } from './states';

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}
```

Until an app registers, every type falls back to core's `string` and
`RawParams`, so existing calls compile unchanged.

## Typed calls

Annotate where the router is used. Core's `StateService` is assignable to
`TypedStateService`, so the annotation needs no cast:

```ts
import type { TypedStateService } from 'ui-router-registry';

const stateService: TypedStateService = router.stateService;

stateService.go('contacts.contact', { contactId: 'c1' });
```

| Type                              | What it holds                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Register`                        | the interface an app augments with its `as const` state declarations                                                                                      |
| `StateName`                       | the registered state names; dotted names and `parent:` both resolve, and a future state's `name.**` placeholder is left out                               |
| `ParamsOf` and `ResolvedParamsOf` | the params a state accepts and the params it reads back, its ancestors' included; url placeholders are required, query params are not                     |
| `TypedStateService`               | `go`, `transitionTo`, `target`, `href`, `is` and `includes` over registered names; relative refs are checked by their tail, and object targets stay loose |
| `TypedRouteSnapshot`              | the route snapshot the reactive packages share, whose `includes(name)` narrows `current` and `params` to that state's subtree                             |

## Relative refs and unchecked targets

A relative ref (`.child`, `^`, `^.sibling`) resolves against the `uiSref`'s
context or `options.relative`, which types can't see. Its tail is checked
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

## Annotate members that call typed targets

A state declaration that names a component and is checked with `satisfies`
against a type that inspects the component, such as `LitStateDeclaration`, makes
that component part of `Register`'s type. If one of the component's members
calls a typed target (`go`, `href`) and has no declared return type, TypeScript
has to infer that member from `Register` while still building `Register`, and
reports a circular type (TS7022, TS7023, TS2456). Declare the member's return
type:

```ts
render(): TemplateResult {
  return html`<a href=${this.stateService.href('contacts.contact', { contactId })}>…</a>`;
}
```

## Further reading

- [API reference](/api/ui-router-registry/)
- [UI-Router — state declarations](https://ui-router.github.io/core/docs/latest/interfaces/_state_interface_.statedeclaration.html)
