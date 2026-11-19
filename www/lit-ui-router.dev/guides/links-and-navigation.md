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
API) and lets modifier clicks (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>-click,
middle-click, right-click → open in new tab) keep native browser behavior.

### Non-anchor and custom elements

The third argument accepts `assignHref` alongside `@uirouter/core`'s
`TransitionOptions`:

- `assignHref: 'auto'` writes `href` only to native HTML/SVG link elements
  (`<a>`, `<area>`, SVG `<a>`). Use `'auto'` on `<button>`, `<tr>`, or `<div>`
  so you do not attach an inert `href` attribute (this becomes the default in
  2.0).
- `assignHref: true` writes `href` to any element — needed for design-system
  link custom elements like `<sp-link>` that forward `href` to an internal
  anchor.
- `assignHref: false` skips writing `href` entirely while keeping the click
  handler.

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
wrapper whenever any nested `uiSref` inside it is active. Non-link wrappers do
not receive `aria-current` unless you opt in explicitly with
`ariaCurrentValue`:

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

```ts check
import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { SrefStatusController, srefHref } from 'lit-ui-router';

export class UsersNavItem extends LitElement {
  @property({ type: Boolean }) locked = false;

  private readonly status = new SrefStatusController(this, { state: 'users' });

  override render() {
    return html`
      <a
        href=${srefHref('users')}
        class=${classMap({
          'nav-link': true,
          active: this.status.active,
          disabled: this.locked,
        })}
        aria-current=${this.status.ariaCurrent()}
        >Users</a
      >
    `;
  }
}
```

See [Active-link status](./reactive-components#active-link-status) for
additional `SrefStatusController` options.

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

// Re-run resolves and re-enter the current state
await router.stateService.reload();

// Compute a URL without navigating (for copy-link buttons or emails)
const url = router.stateService.href('users.detail', { userId: '42' });
```

Inside a routed component, read the router from `this.uiViewProps?.router` (or
from `TransitionController` / `requestRouter` outside `<ui-view>`).

Common `TransitionOptions` passed as the third argument to `stateService.go`:

| Option     | Effect                                                                           |
| ---------- | -------------------------------------------------------------------------------- |
| `location` | `true` (push, default), `'replace'` (replace history entry), or `false` (no URL) |
| `inherit`  | `true` (default) inherits current params; `false` drops unspecified params       |
| `relative` | Base state object or name for resolving `.child` / `^` targets                   |
| `reload`   | `true` reloads all active states, or pass a state name to reload from that point |

## Further reading

- [Navigation Links](/packages/lit-ui-router#navigation-links) — complete
  directive reference on the `lit-ui-router` package page
- [Design System Links](./design-system-links) — `assignHref: true` vs
  `srefHref` with custom link elements
- [Routed Components](./routed-components) — reading state params via resolves
  and lazy-loading route elements
- [Reactive Components](./reactive-components) — `TransitionController` and
  `SrefStatusController`
- [`@uirouter/core` — `StateService`](https://ui-router.github.io/core/docs/latest/classes/_state_stateservice_.stateservice.html) —
  programmatic navigation and `TransitionOptions` reference
