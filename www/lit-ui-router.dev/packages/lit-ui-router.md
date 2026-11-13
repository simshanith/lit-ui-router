---
title: lit-ui-router
description: The Lit renderer for UI-Router — the router class, the <ui-router> and <ui-view> elements, link directives and controllers, and their entry points
type: package
---

# lit-ui-router

<p class="badges">
<a href="https://npmx.dev/package/lit-ui-router" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/lit-ui-router" /></a>
<a href="https://lit-ui-router.dev/gh/releases/lit-ui-router/latest" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router@*" /></a>
</p>

[`lit-ui-router`](https://npmx.dev/package/lit-ui-router) is a
[UI-Router](https://ui-router.github.io/) implementation for
[Lit](https://lit.dev/): `@uirouter/core` with Lit view handling, the
`<ui-router>` and `<ui-view>` elements, and directives and controllers for
links and router state. The [companion packages](/packages/) build on it.

## Installation

```bash
npm install lit-ui-router lit @uirouter/core
```

## Quick Start

```ts
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  LitStateDeclaration,
} from 'lit-ui-router';
import { hashLocationPlugin } from '@uirouter/core';
import { html } from 'lit';

// 1. Create router and add location plugin
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);

// 2. Define states
const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home', component: () => html`<h1>Home</h1>` },
  { name: 'users', url: '/users', component: UserListElement },
];

// 3. Register states and start
states.forEach((state) => router.stateRegistry.register(state));
router.urlService.rules.initial({ state: 'home' });
router.start();
```

```html
<!-- 4. Use in your app -->
<ui-router .uiRouter="${router}">
  <nav>
    <a ${uiSref('home')} ${uiSrefActive({ activeClasses: ['active'] })}>Home</a>
    <a ${uiSref('users')} ${uiSrefActive({ activeClasses: ['active'] })}>Users</a>
  </nav>
  <ui-view></ui-view>
</ui-router>
```

`rules.initial({ state: 'home' })` lands on the state with no params; a landing
state that reads the query needs the function form — see
[Unmatched URLs](/guides/unmatched-urls#a-landing-state-that-reads-the-query).

## Entry Points

| Import                                        | Effect                                                                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `import { ... } from 'lit-ui-router'`         | The router, the elements, the directives and the controllers. Any value import registers the `<ui-router>`/`<ui-view>` custom elements as a side effect.                                                           |
| `import { ... } from 'lit-ui-router/pure'`    | The same API — element classes included — with no registration and no `HTMLElementTagNameMap` globals.                                                                                                             |
| `import 'lit-ui-router/register'`             | Registration only: defines `<ui-router>`/`<ui-view>` and carries their `HTMLElementTagNameMap` entries.                                                                                                            |
| `import 'lit-ui-router/ui-view.register'`     | Single-element registration: defines just that element with its tag-map entry (`ui-router.register` ditto).                                                                                                        |
| `import { ... } from 'lit-ui-router/context'` | The only home of the `context-request` key, event and request helper, and of the tree-less router hand-off — nothing from `lit` — see [Reactive Components](/guides/reactive-components#router-discovery).         |
| `lit-ui-router/custom-elements.json`          | The [Custom Elements Manifest](https://custom-elements-manifest.open-wc.org/) for `<ui-router>` and `<ui-view>`, also named by the `customElements` field. Bundlers load it as a URL or JSON, e.g. `?url` in Vite. |
| `import type { ... } from 'lit-ui-router'`    | Types are erased at compile time — always free, from any entry.                                                                                                                                                    |

These entries are the supported import paths. Deep `lit-ui-router/dist/...` paths still resolve, but they are unsupported and 2.0 removes them.

The root entry is exactly `pure` + `register`: reach for `lit-ui-router/pure`
when you need the APIs (or the element classes themselves, e.g. for scoped
registries or custom tag names) without touching the global registry, and pair
it with `lit-ui-router/register` — or a single `*.register` entry — to opt
into registration explicitly.

## Development and Production Builds

Every entry point above publishes twice: `dist/development/*.js` alongside
`dist/*.js`, picked by the `development` export condition, which bundlers
resolve automatically. Nothing to configure.

The development build carries three console warnings — `uiSref` writing an
inert `href`, `uiSrefActive` taking over an `aria-current` it did not set, and
any binding finding no `<ui-router>` ancestor. Each is gated on lit's own
development build as well, and none of them, message text included, is
present in a production bundle. See
[Development and Production Builds](/guides/development-builds) for what each
warning means and how the split is verified.

## Component Styles

lit-ui-router supports multiple ways to define route components:

**Inline Template Function** (simplest)

```ts
{ name: 'home', url: '/', component: () => html`<h1>Home</h1>` }
```

**Template with Route Parameters**

```ts
{
  name: 'user',
  url: '/user/:id',
  component: (props) => html`<h1>User ${props?.transition?.params().id}</h1>`
}
```

**Template with Resolved Data**

```ts
{
  name: 'users',
  url: '/users',
  component: (props) => html`
    <ul>${props?.resolves?.users?.map(u => html`<li>${u.name}</li>`)}</ul>
  `,
  resolve: [{ token: 'users', resolveFn: () => fetchUsers() }]
}
```

**LitElement Class** (for complex components with lifecycle/state)

```ts
{ name: 'dashboard', url: '/dashboard', component: DashboardElement }
```

| Style                      | Best For                                       |
| -------------------------- | ---------------------------------------------- |
| `` () => html`...` ``      | Simple static views                            |
| `` (props) => html`...` `` | Views needing params or resolves               |
| `MyElement`                | Complex views with lifecycle, state, or styles |

[Routed Components](/guides/routed-components) covers reading params and
typing a state's resolves.

## Reacting to Transitions

Any element (routed or not) can stay synchronized with the router using the
[`TransitionController`](/reference/lit-ui-router/controllers/TransitionController)
reactive controller. It registers transition hooks when the host connects,
calls `host.requestUpdate()` on matching transitions, and deregisters
everything when the host disconnects — no manual `requestUpdate()` plumbing or
leaked hooks.

```ts
import { TransitionController } from 'lit-ui-router';

class NavHeader extends LitElement {
  private transitions = new TransitionController(this);

  render() {
    // Re-evaluated after every successful transition
    return html`Current state: ${this.transitions.current?.name}`;
  }
}
```

Scope it to specific states or react to parameter changes with a callback:

```ts
class UserDetail extends LitElement {
  private transitions = new TransitionController(this, {
    criteria: { to: 'users.detail' },
    callback: () => this.loadUser(this.transitions.params.userId),
  });
}
```

See [Reactive Components](/guides/reactive-components).

## Navigation Links

`uiSref` and `uiSrefActive` bind a link from the element; `srefHref`,
`srefActiveClass` and `srefAriaCurrent` bind the same link from inside the
attribute it writes.

- **[`uiSref`](/reference/lit-ui-router/directives/uiSref)** - Creates navigation links to states
- **[`uiSrefActive`](/reference/lit-ui-router/directives/uiSrefActive)** - Adds CSS classes when linked state is active, and sets `aria-current` on active links
- **[`srefHref`](/reference/lit-ui-router/directives/srefHref)** - `uiSref` bound in the `href` attribute
- **[`srefActiveClass`](/reference/lit-ui-router/directives/srefActiveClass)** - `uiSrefActive`'s classes, bound in the `class` attribute
- **[`srefAriaCurrent`](/reference/lit-ui-router/directives/srefAriaCurrent)** - `uiSrefActive`'s `aria-current`, bound in the attribute

### Attribute-part forms

`uiSref` and `uiSrefActive` are element parts: they sit on the element and
write to it from the outside, so a reader that is not a live browser — a
server renderer, an accessibility linter — sees an `<a>` with no `href`.
The `sref*` directives do the same jobs from inside the attribute they
affect, so the template says what the browser will show. A linter reads that,
and so does a server render given a router — see
[Server-Side Routing](/guides/server-route-matching#the-router-on-the-server):

```html
<a href=${srefHref('users')}
   class="nav-link ${srefActiveClass({ state: 'users', activeClasses: ['active'] })}"
   aria-current=${srefAriaCurrent({ state: 'users' })}>Users</a>
<!-- while at `users`:        <a href="/users" class="nav-link active" aria-current="page"> -->
<!-- while at `users.detail`: <a href="/users" class="nav-link active"> -->
```

- `srefHref` takes `uiSref`'s arguments and does everything `uiSref` does —
  the click navigates, and an enclosing `uiSrefActive` still tracks it. There
  is no `assignHref`: the attribute is the binding. Use one form or the other
  on an element, not both.
- `srefActiveClass` follows lit's
  [`classMap`](https://lit.dev/docs/templates/directives/#classmap): bind it in
  `class`, alone or beside static classes, and it toggles only the classes it
  names. It cannot share the attribute with `classMap` itself, so pass those
  classes as `classes: { 'nav-link': true, disabled: locked }`. Leave
  `state` out on a wrapper to watch the `srefHref` links inside it, as
  `uiSrefActive` does.
- `srefAriaCurrent` is the one piece a `class` binding cannot reach, so it is
  its own directive. Binding the attribute is the opt-in: it writes `'page'`
  while the exact state is active and removes the attribute otherwise, on any
  element, with none of `uiSrefActive`'s link detection or takeover rules.
  `value` picks another token or `{ exact, active }` for ancestors.

### Composing with `classMap`

A `class` attribute holds one toggling directive, so `srefActiveClass` and
`classMap` cannot share it. When a component wants both — the active flag
next to its own bindings —
[`SrefStatusController`](/reference/lit-ui-router/controllers/SrefStatusController) hands
the status to the host instead of writing an attribute, and the template
composes it freely:

```ts
@property({ type: Boolean }) locked = false;
private users = new SrefStatusController(this, { state: 'users' });
// class=${classMap({ 'nav-link': true, active: this.users.active, disabled: this.locked })}
// aria-current=${this.users.ariaCurrent()}
```

See [Reactive Components](/guides/reactive-components#active-link-status).

### Accessible active links

`uiSrefActive` conveys active state to assistive technology as well as to CSS. On a
link element (`<a>`, `<area>`, or anything with `role="link"`) it sets
`aria-current="page"` while the **exact** linked state is active, and removes the
attribute when it is not — so the nav above needs no extra markup:

```html
<a ${uiSref('users')} ${uiSrefActive({ activeClasses: ['active'] })}>Users</a>
<!-- while at `users`:            <a href="/users" class="active" aria-current="page"> -->
<!-- while at `users.detail`:     <a href="/users" class="active"> -->
```

`aria-current="page"` is applied on exact match only, deliberately: an ancestor
state being active means the link points at a section containing the current page,
not at the current page itself, and a nav in which several ancestor links all claim
`aria-current="page"` is worse for a screen reader user than one with none.

Three knobs, via `ariaCurrentValue`:

- **Another token** — `'page'` (default), `'step'`, `'location'`, `'date'`,
  `'time'`, or `'true'`. Passing a value explicitly also opts **non-link** elements
  in, which is otherwise off; `aria-current` on a wrapping `<li>` or `<tr>` is valid
  ARIA but rarely what an author means, so wrappers stay silent unless asked.

  ```html
  <li ${uiSrefActive({ activeClasses: ['active'] })}>
    <!-- classes on the wrapper, aria-current on the link -->
    <a ${uiSref('users')} ${uiSrefActive({})}>Users</a>
  </li>

  <!-- an explicit value opts a non-link element in; 'auto' keeps href off it -->
  <tr ${uiSref('.message', { messageId }, { assignHref: 'auto' })}
      ${uiSrefActive({ activeClasses: ['active'], ariaCurrentValue: 'true' })}></tr>
  ```

- **`false`** — leave `aria-current` alone entirely; the directive will neither set
  nor remove it. This is the opt-out to reach for when the application manages
  `aria-current` itself: a value written in the template survives untouched, in
  every routing state.

  ```html
  <a ${uiSref('home')} ${uiSrefActive({ activeClasses: ['active'], ariaCurrentValue: false })}>Home</a>
  ```

- **`{ exact, active }`** — mark ancestors too, which is otherwise off. `active`
  applies while a child state is active and this one is not the exact match;
  `'location'` is the ARIA token meant for exactly that.

  ```html
  <a ${uiSref('users')}
     ${uiSrefActive({
       activeClasses: ['active'],
       ariaCurrentValue: { exact: 'page', active: 'location' },
     })}>Users</a>
  <!-- while at `users`:        aria-current="page"     -->
  <!-- while at `users.detail`: aria-current="location" -->
  ```

  Note this pair does **not** combine the way `activeClasses` and `exactClasses`
  do. Both class sets land in `class` on an exactly-active link, because an exact
  match is also an active one. `aria-current` is a single attribute with a single
  value, so the two are branches of one decision: an exactly-active element takes
  `exact` and never falls through to `active`. Each key keeps its own default when
  omitted, so `{ active: 'location' }` alone still defaults `exact` to `'page'` on
  links — write `{ exact: false, active: 'location' }` to mark only ancestors.

The directive only removes an `aria-current` it wrote itself. A value authored in the
template is therefore left alone — but only until the directive first writes one of its
own, after which it owns the attribute and will clear it on the next inactive render.
`ariaCurrentValue: false` is the way to keep a template-authored value for good, since
the directive then never writes and never takes ownership.

## Router and Views

### Router

[`UIRouterLit`](/reference/lit-ui-router/core/UIRouterLit) is the main router class. It extends `@uirouter/core`'s UIRouter with Lit-specific view handling.

[`viewRendered(router, transition?)`](/reference/lit-ui-router/core/viewRendered) resolves once every `<ui-view>` registered with the router, and the element each one rendered, has completed its update for the transition. It waits on `updateComplete`, never on a frame — see [Component Lifecycle](/guides/component-lifecycle#after-the-transition-waiting-for-the-view-to-render).

### Elements

- [**`<ui-router>`**](/reference/lit-ui-router/components/UIRouterLitElement) - Root component that provides router context to descendants
- [**`<ui-view>`**](/reference/lit-ui-router/components/UiView) - Viewport that renders the component for the current state

### Lifecycle Hooks

Routed components can implement these interfaces to respond to routing events;
[Component Lifecycle Hooks](/guides/component-lifecycle) covers both:

- **[`UiOnExit`](/reference/lit-ui-router/hooks/UiOnExit)** - Called before navigating away (can cancel navigation)
- **[`UiOnParamsChanged`](/reference/lit-ui-router/hooks/UiOnParamsChanged)** - Called when route parameters change

### Injected Props

Routed components receive [`UIViewInjectedProps`](/reference/lit-ui-router/types/UIViewInjectedProps) with:

- `router` - The UIRouter instance
- `transition` - The current transition
- `resolves` - Resolved data from state declarations

[Routed Components](/guides/routed-components) covers what a routed component
reads from them.

## Further reading

- [API reference](/reference/lit-ui-router/)
- [Changelog](/packages/lit-ui-router/changelog) — every stable release, newest first
- [Tutorial](/tutorial/helloworld)
- [Location Plugins](/guides/location-plugins) — hash, pushState and Navigation API URLs
- [Server-Side Routing](/guides/server-route-matching#the-router-on-the-server) — the router hand-off in `lit-ui-router/context`
- [Companion packages](/packages/)
- [@uirouter/core docs](https://ui-router.github.io/core/docs/latest/)
