---
title: State Parameters
description: Declare path, query, typed, optional, dynamic, and non-URL state parameters in lit-ui-router, pass them in links, and read them safely in Lit components
type: guide
topic: urls
---

# State Parameters

State parameters carry values into a state from the URL path, the query string,
or in-memory navigation calls. `@uirouter/core` owns parameter parsing,
validation, and serialization; this guide covers how parameters are declared
and read in Lit components, and links to `@uirouter/core` for the full option
reference.

## Path and query parameters

Name path segments in a state's `url` with `:param` or `{param}`. Brace syntax
also accepts a built-in type such as `{itemId:int}` or an inline regular
expression:

```ts check
import { html } from 'lit';
import type { LitStateDeclaration } from 'lit-ui-router';

const userState = {
  name: 'user',
  url: '/users/:userId',
  component: (props) =>
    html`<h1>User ${props.transition?.params().userId}</h1>`,
} satisfies LitStateDeclaration;

const itemState = {
  name: 'item',
  url: '/items/{itemId:int}',
  component: (props) => {
    const id: number | undefined = props.transition?.params().itemId;
    return html`<p>Item #${id}</p>`;
  },
} satisfies LitStateDeclaration;
```

Child states inherit their parent's URL and parameters automatically — a child
`user.post` with `url: '/posts/:postId'` matches `/users/42/posts/7` and
receives both `userId` and `postId`. A URL whose segment does not match a typed
parameter (such as `/items/abc` for `{itemId:int}`) does not match the state;
the router treats it as an [unmatched URL](./unmatched-urls).

List query parameter names after `?` separated by `&`, and configure defaults
in `params`:

```ts check
import { html } from 'lit';
import type { LitStateDeclaration } from 'lit-ui-router';

const searchState = {
  name: 'search',
  url: '/search?q&{page:int}',
  params: {
    q: { value: '', squash: true },
    page: { value: 1, squash: true },
  },
  component: (props) => {
    const { q, page } = props.transition?.params() ?? {};
    return html`<p>Results for "${q}" (page ${page})</p>`;
  },
} satisfies LitStateDeclaration;
```

A query parameter is always optional and is `undefined` when absent. Setting
`value` in `params` gives a parameter a default, and makes a path parameter
optional. As with typed path segments, an invalid typed query value (such as
`/search?page=abc`) does not match the state; the router treats it as an
[unmatched URL](./unmatched-urls).

## Parameter options

The parameter declaration model comes from `@uirouter/core`:

- **Built-in types**: `int`, `bool`, `date`, `json`, `string`, `path`, `query`,
  `hash`, `any`, and inline regexes — see
  [`ParamTypes`](https://ui-router.github.io/core/docs/latest/classes/_params_paramtypes_.paramtypes.html).
- **Defaults and `squash`**: set
  [`value`](https://ui-router.github.io/core/docs/latest/interfaces/_params_interface_.paramdeclaration.html#value)
  and
  [`squash`](https://ui-router.github.io/core/docs/latest/interfaces/_params_interface_.paramdeclaration.html#squash)
  on `params`. `squash: true` omits a default value from the URL; on a query
  parameter the key is dropped.
- **Non-URL parameters**: declare a key in
  [`params`](https://ui-router.github.io/core/docs/latest/interfaces/_state_interface_.statedeclaration.html#params)
  without naming it in `url` to pass in-memory values (such as a `draft`
  object) across transitions without exposing them in the address bar; they do
  not persist across a full page reload.
- **Custom types**: register a custom type with
  [`router.urlService.config.type()`](https://ui-router.github.io/core/docs/latest/classes/_url_urlconfig_.urlconfig.html#type)
  before registering any state that names it (URLs compile synchronously at
  registration, so an unregistered type name in `{slug:slug}` is treated as a
  regex).

## Dynamic parameters

By default, changing one of a state's own parameters exits and re-enters that
state and its children, re-running their resolves and rebuilding their routed
components. Mark a parameter `dynamic: true` in `params` to keep the component
mounted and react to changed values in
[`uiOnParamsChanged`](./component-lifecycle#uionparamschanged-react-to-dynamic-parameters);
resolves do not re-run on dynamic updates (see
[Reading params](./routed-components#reading-params)).

## Passing and reading parameters in Lit

Pass parameter objects to [`uiSref`](/reference/lit-ui-router/directives/uiSref),
[`srefHref`](/reference/lit-ui-router/directives/srefHref) (see
[Navigation Links](/packages/lit-ui-router#navigation-links)), or
`router.stateService.go()`:

```ts check
import { html } from 'lit';
import { uiSref, type UIRouterLit } from 'lit-ui-router';

declare const router: UIRouterLit;

const link = html`<a ${uiSref('search', { q: 'lit', page: 2 })}>Page 2</a>`;

// Pass inherit: false to clear unspecified query params from the current state
await router.stateService.go('search', { q: 'router' }, { inherit: false });
```

How a Lit component reads parameters depends on where it sits:

- **Template functions** can read `props.transition?.params()` directly for
  lightweight views, as shown above.
- **Routed `LitElement` classes** should declare a resolve reading
  `$transition$.params()` and receive the typed value on `uiViewProps.resolves`
  rather than reading `router.globals.params` — see
  [Reading params](./routed-components#reading-params).
- **Components outside `<ui-view>`** can read current params reactively through
  [`TransitionController`](./reactive-components).

## Further reading

- [Routed Components](./routed-components#reading-params) — reading and typing
  params through resolves
- [Component Lifecycle Hooks](./component-lifecycle#uionparamschanged-react-to-dynamic-parameters) —
  reacting to `dynamic: true` parameter updates
- [Reactive Components](./reactive-components) — reading params outside
  `<ui-view>` with `TransitionController`
- [Unmatched URLs (404)](./unmatched-urls#a-landing-state-that-reads-the-query) —
  preserving query parameters on an initial redirect
- [`@uirouter/core` — `ParamDeclaration`](https://ui-router.github.io/core/docs/latest/interfaces/_params_interface_.paramdeclaration.html) —
  full parameter option reference
