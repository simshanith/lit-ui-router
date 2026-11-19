---
title: State Parameters
description: Declare path, query, typed, optional, dynamic, and non-URL state parameters in lit-ui-router, pass them in links, and read them safely in Lit components
type: guide
topic: urls
---

# State Parameters

State parameters carry values into a state from the URL path, the query string,
or in-memory navigation calls. `@uirouter/core` parses, validates, and
serializes parameters; `lit-ui-router` passes them through `uiSref`, resolves,
and component lifecycle hooks.

For the full parameter declaration schema, see
[`@uirouter/core` — `ParamDeclaration`](https://ui-router.github.io/core/docs/latest/interfaces/_params_interface_.paramdeclaration.html).

## Path parameters

Name path segments in a state's `url` with `:param` or `{param}`:

```ts check
import { html } from 'lit';
import type { LitStateDeclaration } from 'lit-ui-router';

const userState = {
  name: 'user',
  url: '/users/:userId',
  component: (props) =>
    html`<h1>User ${props.transition?.params().userId}</h1>`,
} satisfies LitStateDeclaration;
```

Child states inherit their parent's URL and parameters automatically. A child
`user.post` with `url: '/posts/:postId'` matches `/users/42/posts/7` and
receives both `userId` and `postId`.

### Built-in parameter types

Brace syntax accepts a built-in type (`int`, `bool`, `date`, `json`, `string`,
`path`, `query`, `hash`, `any`) or an inline regular expression:

```ts check
import { html } from 'lit';
import type { LitStateDeclaration } from 'lit-ui-router';

const itemState = {
  name: 'item',
  url: '/items/{itemId:int}',
  component: (props) => {
    const id: number | undefined = props.transition?.params().itemId;
    return html`<p>Item #${id}</p>`;
  },
} satisfies LitStateDeclaration;
```

A URL whose segment does not match the type (such as `/items/abc` for
`{itemId:int}`) does not match the state and falls through to
[Unmatched URLs (404)](./unmatched-urls).

## Query parameters

List query parameter names after `?` separated by `&`, and give them types or
defaults in `params`:

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

## Defaults, optional parameters, and `squash`

Setting `value` in `params` makes a parameter optional and gives it a fallback
when omitted from the URL. `squash` controls how the default value is
serialized back into the URL:

| `squash` value    | Behavior when param equals its default `value`                        |
| ----------------- | --------------------------------------------------------------------- |
| `false` (default) | Writes the default value into the URL (for example `/search?page=1`)  |
| `true`            | Omits the default value from the URL (`/search`)                      |
| `'-'` (string)    | Replaces the default value with that placeholder token in path params |

## Non-URL parameters

Declare a parameter in `params` without mentioning it in `url` to pass
in-memory values across transitions without exposing them in the address bar:

```ts check
import { html } from 'lit';
import type { LitStateDeclaration } from 'lit-ui-router';

const loginState = {
  name: 'login',
  url: '/login',
  params: {
    returnTo: null as string | null,
  },
  component: () => html`<app-login></app-login>`,
} satisfies LitStateDeclaration;
```

Non-URL parameters are not persisted across a full page reload, so give them a
safe default such as `null`.

## Dynamic parameters

By default, changing any parameter exits and re-enters the state, re-running
its resolves and rebuilding its routed component. Set `dynamic: true` on a
parameter (such as a filter, sort column, or pagination cursor) to update the
URL **without** exiting the state or recreating the Lit component:

```ts check
import { LitElement, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { Transition } from '@uirouter/core';
import type {
  LitStateDeclaration,
  UIViewInjectedProps,
  UiOnParamsChanged,
} from 'lit-ui-router';

export class ContactList extends LitElement implements UiOnParamsChanged {
  @property({ attribute: false })
  uiViewProps?: UIViewInjectedProps;

  @state()
  private filter = '';

  override connectedCallback() {
    super.connectedCallback();
    this.filter = String(this.uiViewProps?.transition?.params().filter ?? '');
  }

  uiOnParamsChanged(newParams: Record<string, unknown>, _trans: Transition) {
    if ('filter' in newParams) {
      this.filter = String(newParams.filter ?? '');
    }
  }

  override render() {
    return html`<p>Filter: ${this.filter || 'all'}</p>`;
  }
}

export const contactsState = {
  name: 'contacts',
  url: '/contacts?filter',
  params: {
    filter: { value: '', dynamic: true, squash: true },
  },
  component: ContactList,
} satisfies LitStateDeclaration;
```

Because resolves do **not** re-run on a dynamic parameter change, react to the
updated values in
[`uiOnParamsChanged`](./component-lifecycle#uionparamschanged-react-to-dynamic-parameters).

## Custom parameter types

Register a custom type on `router.urlService.config.type()` before calling
`router.start()` when you want domain objects or custom formats encoded and
decoded once at the router boundary:

```ts check
import type { UIRouterLit } from 'lit-ui-router';

declare const router: UIRouterLit;

router.urlService.config.type('slug', {
  encode: (val: string) => val,
  decode: (val: string) => val,
  is: (val: unknown): val is string =>
    typeof val === 'string' && /^[a-z0-9-]+$/.test(val),
  equals: (a: string, b: string) => a === b,
  pattern: /[a-z0-9-]+/,
});
```

See
[`@uirouter/core` — `ParamTypeDefinition`](https://ui-router.github.io/core/docs/latest/interfaces/_params_interface_.paramtypedefinition.html)
for every hook a custom type can define.

## Passing and reading parameters in Lit

Pass parameter objects to `uiSref`, `srefHref`, or `router.stateService.go()`:

```ts check
import { html } from 'lit';
import { uiSref, type UIRouterLit } from 'lit-ui-router';

declare const router: UIRouterLit;

const link = html`<a ${uiSref('search', { q: 'lit', page: 2 })}>Page 2</a>`;

// Pass inherit: false to clear unspecified query params from the current state
await router.stateService.go('search', { q: 'router' }, { inherit: false });
```

Inside a routed `LitElement`, read parameters through a **resolve** rather than
`router.globals.params` so the component receives a typed input bound to the
transition that rendered it — see
[Reading params](./routed-components#reading-params).

## Further reading

- [Routed Components](./routed-components#reading-params) — reading and typing
  params through resolves
- [Component Lifecycle Hooks](./component-lifecycle#uionparamschanged-react-to-dynamic-parameters) —
  reacting to `dynamic: true` parameter updates
- [Unmatched URLs (404)](./unmatched-urls#a-landing-state-that-reads-the-query) —
  preserving query parameters on an initial redirect
- [`@uirouter/core` — `ParamDeclaration`](https://ui-router.github.io/core/docs/latest/interfaces/_params_interface_.paramdeclaration.html) —
  full parameter option reference
