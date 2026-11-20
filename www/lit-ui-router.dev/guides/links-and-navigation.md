---
title: Links and Navigation
description: Navigate between states with uiSref, style active links with uiSrefActive and aria-current, choose attribute-part forms or SrefStatusController, and navigate programmatically with stateService
type: guide
topic: views
---

# Links and Navigation

Navigation in `lit-ui-router` targets **state names**, not raw URL strings.
The router builds each link's `href` from the active location plugin and state
parameters, intercepts plain left-clicks, and keeps active classes and
`aria-current` synchronized as transitions complete.

For the full directive API summary and attribute-part details, see
[Navigation Links](/packages/lit-ui-router#navigation-links) on the
`lit-ui-router` package page.

The snippets assume a router already running under `<ui-router>` with its states
registered, as in [Quick Start](/packages/lit-ui-router#quick-start) or the
[tutorial](/tutorial/helloworld).

## Declarative links with `uiSref`

[`uiSref`](/reference/lit-ui-router/directives/uiSref) binds a state name,
optional params, and optional transition options onto an element:

```ts check
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

const nav = html`
  <nav aria-label="Primary">
    <a ${uiSref('home')}>Home</a>
    <a ${uiSref('users.detail', { userId: '42' })}>Profile</a>
    <a ${uiSref('settings', {}, { location: 'replace' })}>Settings</a>
  </nav>
`;
```

On an `<a>` element, `uiSref` computes the matching `href` (for example
`#/users/42` under hash routing or `/users/42` under pushState or Navigation
API) and lets modified clicks
(<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>/<kbd>Shift</kbd>/<kbd>Alt</kbd>-click) and
non-primary clicks (middle-click, context menu) keep native browser behavior.

### Non-anchor and custom elements

The third argument accepts `assignHref` alongside `@uirouter/core`'s
`TransitionOptions`:

- `assignHref: true` is the 1.x default: `href` is written to whatever element
  carries the directive. Pass it explicitly on a design-system link custom
  element such as `<sp-link>`, which forwards `href` to an internal anchor, so
  the link keeps its `href` when the default changes in 2.0.
- `assignHref: 'auto'` writes `href` only where HTML defines one (`<a>`,
  `<area>`, SVG `<a>`) and becomes the default in 2.0. Pass it on a
  `<button>`, `<tr>` or `<div>` today: under the 1.x default those elements
  get an inert `href`, and the development build warns once per element.
- `assignHref: false` never writes `href`; the click still navigates.

See [Design System Links](./design-system-links) for a live comparison of
`true` and `'auto'`, and its table for `false`.

## Active classes and `aria-current`

[`uiSrefActive`](/reference/lit-ui-router/directives/uiSrefActive) adds CSS
classes when a linked state is active and manages `aria-current` for assistive
technology:

```ts check
import { html } from 'lit';
import { uiSref, uiSrefActive } from 'lit-ui-router';

const nav = html`
  <nav aria-label="Primary">
    <a
      ${uiSref('users')}
      ${uiSrefActive({
        activeClasses: ['active'],
        exactClasses: ['current'],
      })}
      >Users</a
    >
  </nav>
`;
```

- **`activeClasses`** apply when the target state **or any child state** is
  active (`users` and `users.detail`).
- **`exactClasses`** apply only when the target state itself is active
  (`users`, not `users.detail`).
- **`aria-current="page"`** is set automatically on link elements (`<a>`,
  `<area>`, `[role="link"]`) on **exact** match only, so parent section links
  do not falsely claim to be the current page.

### Wrapper elements and `ariaCurrentValue`

Place `uiSrefActive` on a parent container (such as an `<li>`) to highlight the
wrapper whenever any link inside it is active. A non-link wrapper gets no
`aria-current` unless you pass `ariaCurrentValue` on it, so the usual split is
classes on the wrapper and `aria-current` on the link:

```ts check
import { html } from 'lit';
import { uiSref, uiSrefActive } from 'lit-ui-router';

const listItem = html`
  <li ${uiSrefActive({ activeClasses: ['is-open'] })}>
    <a
      ${uiSref('users')}
      ${uiSrefActive({
        ariaCurrentValue: { exact: 'page', active: 'location' },
      })}
      >Users</a
    >
  </li>
`;
```

The object form marks an ancestor as well as the current page: the link above
carries `aria-current="page"` at `users` and `aria-current="location"` at
`users.detail`. A single token (`ariaCurrentValue: 'step'`) replaces `'page'`
on exact match. [Accessible active links](/packages/lit-ui-router#accessible-active-links)
covers every form.

Pass `ariaCurrentValue: false` when your own code manages `aria-current`. You
can also pass `state` (or `targetStates` built with `router.stateService.target()`)
directly to `uiSrefActive` when highlighting an element that has no `uiSref`
inside it.

## Relative state references

Inside a component rendered by `<ui-view>`, `uiSref` resolves relative names
against the view's owning state (the same syntax `@uirouter/core` uses in
`stateService.go`):

| Target        | Meaning                                              |
| ------------- | ---------------------------------------------------- |
| `'.detail'`   | Child state of the current view's state              |
| `'^'`         | Parent state                                         |
| `'^.sibling'` | Sibling state (up one level, then down to `sibling`) |
| `'^.^.other'` | Two levels up, then `other`                          |

Outside any `<ui-view>`, such as an app shell's nav, there is no base state for
a relative name — calling `uiSref('.edit')` there throws
`Error: No reference point given for path '.edit'` — so use full state names
there.

```ts check
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

const actions = (id: string) => html`
  <a ${uiSref('.edit', { id })}>Edit</a>
  <a ${uiSref('^')}>Back to list</a>
`;
```

See [Hello Galaxy](/tutorial/hellogalaxy#relative-state-references) for a
working tree of nested states using `.` and `^` links.

## Attribute-part forms (`srefHref`, `srefActiveClass`, `srefAriaCurrent`)

`uiSref` and `uiSrefActive` are **element-part** directives: they sit on the
element tag and write attributes from outside. When a template needs explicit
attribute bindings — for server-side rendering, static HTML linters, or
design-system links without `assignHref` — use the attribute-part counterparts:

```ts check
import { html } from 'lit';
import { srefActiveClass, srefAriaCurrent, srefHref } from 'lit-ui-router';

const navLink = (locked: boolean) => html`
  <a
    href=${srefHref('users')}
    class=${srefActiveClass({
      state: 'users',
      activeClasses: ['active'],
      classes: { 'nav-link': true, disabled: locked },
    })}
    aria-current=${srefAriaCurrent({ state: 'users' })}
    >Users</a
  >
`;
```

Use either `uiSref` or `href=${srefHref(...)}` on a given element, never both.
Because a `class` attribute holds only one toggling directive, pass any
conditional classes through `srefActiveClass`'s `classes` option rather than
combining it with `classMap`; static classes can stay in the template.

See [Attribute-part forms](/packages/lit-ui-router#attribute-part-forms) and
[Links a server renderer can read](./server-route-matching#links-a-server-renderer-can-read)
for how these serialize during SSR and prerendering.

## Composing with `classMap` via `SrefStatusController`

When a component already uses Lit's `classMap` or wants reactive booleans
(`active`, `exact`, `entering`, `exiting`) in its own template logic, use
[`SrefStatusController`](/reference/lit-ui-router/controllers/SrefStatusController)
instead of `uiSrefActive` or `srefActiveClass`:

```ts
@property({ type: Boolean }) locked = false;
private users = new SrefStatusController(this, { state: 'users' });
// class=${classMap({ 'nav-link': true, active: this.users.active, disabled: this.locked })}
// aria-current=${this.users.ariaCurrent()}
```

See [Active-link status](./reactive-components#active-link-status) for the
complete component example and additional `SrefStatusController` options.

## Programmatic navigation with `stateService`

Use `router.stateService` when navigation happens after a form submit, an async
action, or an imperative event rather than a link click:

```ts check
import type { UIRouterLit } from 'lit-ui-router';

declare const router: UIRouterLit;

// Navigate to a state with params
await router.stateService.go('users.detail', { userId: '42' });

// Replace the current history entry instead of pushing a new one
await router.stateService.go('login', {}, { location: 'replace' });

// Re-run every active state's resolves and re-enter them
await router.stateService.reload();

// Compute a URL without navigating; `absolute: true` adds the origin,
// which a copied or emailed link needs
const url = router.stateService.href(
  'users.detail',
  { userId: '42' },
  { absolute: true },
);
```

`go` and `reload` return promises that reject when the transition does not
finish: a hook aborted it, a newer navigation superseded it, or the target
state does not exist. Catch the rejection where the next step depends on
arriving. A `redirectTo` resolves with the state it ended on.

Inside a routed component, read the router from `this.uiViewProps?.router`
(see [Reading params](./routed-components#reading-params)). A component outside
`<ui-view>` gets it from a `TransitionController`'s `router`, or from
`requestRouter(this)`, which is exported from `lit-ui-router/context` rather
than the package root; see [Router discovery](./reactive-components#router-discovery).

Common [`TransitionOptions`](https://ui-router.github.io/core/docs/latest/interfaces/_transition_interface_.transitionoptions.html)
passed as the third argument to `stateService.go`:

| Option     | Effect                                                                           |
| ---------- | -------------------------------------------------------------------------------- |
| `location` | `true` (push, default), `'replace'` (replace history entry), or `false` (no URL) |
| `inherit`  | `true` (default) inherits current params; `false` drops unspecified params       |
| `relative` | Base state object or name for resolving `.child` / `^` targets                   |
| `reload`   | `true` reloads all active states, or pass a state name to reload from that point |

## Further reading

- [Navigation Links](/packages/lit-ui-router#navigation-links) — the directive
  summary, attribute-part forms and every `aria-current` option on the
  `lit-ui-router` package page
- [Design System Links](./design-system-links) — `assignHref: true` vs
  `srefHref` with custom link elements
- [Routed Components](./routed-components) — reading state params via resolves
  and lazy-loading route elements
- [Reactive Components](./reactive-components) — `TransitionController` and
  `SrefStatusController`
- [`@uirouter/core` — `StateService`](https://ui-router.github.io/core/docs/latest/classes/_state_stateservice_.stateservice.html) —
  programmatic navigation and `TransitionOptions` reference
