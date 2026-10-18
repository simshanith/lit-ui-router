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

Part of the lit-ui-router family, maintained in
[simshanith/lit-ui-router](https://github.com/simshanith/lit-ui-router). Not
affiliated with the UI-Router project.

## Installation

```bash
npm install --save-dev ui-router-registry@rc
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

| Type                              | What it holds                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Register`                        | the interface an app augments with its `as const` state declarations                                                                  |
| `StateName`                       | the registered state names; dotted names and `parent:` both resolve, and a future state's `name.**` placeholder is left out           |
| `ParamsOf` and `ResolvedParamsOf` | the params a state accepts and the params it reads back, its ancestors' included; url placeholders are required, query params are not |
| `TypedStateService`               | `go`, `transitionTo`, `target`, `href`, `is` and `includes` over registered names; relative refs and object targets stay loose        |
| `TypedRouteSnapshot`              | the route snapshot the reactive packages share, whose `includes(name)` narrows `current` and `params` to that state's subtree         |

## Further reading

- [API reference](/api/ui-router-registry/)
- [UI-Router — state declarations](https://ui-router.github.io/core/docs/latest/interfaces/_state_interface_.statedeclaration.html)
