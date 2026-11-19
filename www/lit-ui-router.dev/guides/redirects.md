---
title: Redirects
description: Redirect users in lit-ui-router with state redirectTo, transition hooks, and URL rules — and know when to move redirects to the server
type: guide
topic: transitions
---

# Redirects

`lit-ui-router` supports three client-side redirect mechanisms, depending on
whether the redirect belongs to a single state, a cross-cutting rule across
many states, or a raw URL path:

| Mechanism                | Best for                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| State `redirectTo`       | Default child states, legacy state aliases, canonicalizing a state's param |
| `transitionService` hook | Auth gates, role checks, or rules spanning an entire subtree               |
| `urlService.rules`       | App-root landing page (`initial` / `when`), URL-only rewrites, 404s        |

## Static `redirectTo` on a state

When a parent shell state should never stay active on its own, set `redirectTo`
to a target state name (or a `{ state, params }` object):

```ts check
import { html } from 'lit';
import type { LitStateDeclaration } from 'lit-ui-router';

const galaxyState = {
  name: 'galaxy',
  url: '/galaxy',
  component: () => html`<ui-view></ui-view>`,
  redirectTo: 'galaxy.stars',
} satisfies LitStateDeclaration;
```

Navigating directly to `galaxy` (or visiting `/galaxy`) forwards straight into
`galaxy.stars`. Navigating to another child such as `galaxy.astronaut` enters
`galaxy` as a parent without triggering `redirectTo`, because `redirectTo` runs
only when the state itself is the **target** of the transition.

The [Hello Galaxy tutorial](/tutorial/hellogalaxy#parent-child-relationships)
uses this on `galaxy`.

## Dynamic and async `redirectTo` functions

Pass a function `(transition: Transition) => ...` when the redirect depends on
the incoming params or async data. Return:

- `undefined` to let the transition continue;
- a state name string or `{ state, params }` (a string keeps the transition's
  params; `{ state, params }` replaces them, and `{ params }` alone redirects
  to the same state);
- a `TargetState` (from `transition.targetState().withParams(...)` or
  `transition.router.stateService.target(state, params, options)` when you also
  need custom `TransitionOptions`); or
- a `Promise` resolving to any of the above.

The [Hello Solar System tutorial](/tutorial/hellosolarsystem#redirecting-numbered-urls)
canonicalizes numbered body URLs (`/planets/4` → `/planets/earth`, counting the
Sun as the first body) this way:

```ts check
import { html } from 'lit';
import type { Transition } from '@uirouter/core';
import type { LitStateDeclaration } from 'lit-ui-router';

const SLUGS = ['sun', 'mercury', 'venus', 'earth', 'mars'] as const;

const planetState = {
  name: 'planet',
  url: '/planets/:planetId',
  component: (props) =>
    html`<h1>Planet ${props.transition?.params().planetId}</h1>`,
  redirectTo: (transition: Transition) => {
    const raw = String(transition.params().planetId ?? '');
    const index = Number(raw) - 1;
    const slug = /^\d+$/.test(raw) ? SLUGS[index] : undefined;
    return slug
      ? transition.targetState().withParams({ planetId: slug })
      : undefined;
  },
} satisfies LitStateDeclaration;
```

`@uirouter/core` runs `redirectTo` in an `onStart` hook: after `onBefore`
guards, and before the state is entered or its resolves fetch. A resolve
declared `policy: { when: 'EAGER' }` is the exception; it runs first.

## Redirecting from transition hooks

When a redirect applies across many states — such as sending unauthenticated
users to `login` — register an `onBefore` hook on `router.transitionService`
and return `transition.router.stateService.target(...)`:

```ts check
import type { Transition } from '@uirouter/core';
import type { UIRouterLit } from 'lit-ui-router';

declare const router: UIRouterLit;
declare function isSignedIn(): boolean;

router.transitionService.onBefore(
  { to: (state) => Boolean(state?.data?.requiresAuth) },
  (transition: Transition) => {
    if (!isSignedIn()) {
      return transition.router.stateService.target('login', undefined, {
        location: false,
      });
    }
  },
);
```

Returning a `TargetState` ends the original transition as superseded and runs
the target in its place; a `stateService.go()` that started it resolves with
the redirect's result. `{ location: false }` keeps the attempted URL in the
address bar. [Route Guards](./route-guards) builds this guard step by step,
return-after-login included; upstream's
[Redirecting a transition](https://ui-router.github.io/guide/transitionhooks#redirecting-a-transition)
covers hook return values.

## History and the Back button

A redirect is a new transition, and only the transition that succeeds writes
the URL. A redirect started from a link or `stateService.go()` adds one
history entry, the target's.

A redirect that started from a URL (a typed address, a bookmark, Back) runs
with `location: 'replace'`: the redirecting URL gives up its history entry, so
Back does not bounce off it. Two exceptions:

- a target that sets `location: false`, as the login guard above does, leaves
  the address bar and history alone;
- the stock `hashLocationPlugin` ignores `replace` and always pushes, so the
  redirecting URL stays in history. See
  [`replace` under the hash plugin](./unmatched-urls#replace-under-the-hash-plugin).

The new transition knows where it came from: `transition.redirectedFrom()`
returns the transition it replaced, and `transition.originalTransition()` the
first in a chain. [Route Guards](./route-guards#return-the-user-after-login)
uses it to return the user after login. Core cuts a chain off after 20
redirects, so two states that redirect to each other fail with "Too many
consecutive Transition redirects (20+)" rather than loop.

## URL-level rules (`initial`, `when`, `otherwise`)

Use `router.urlService.rules` when matching raw URLs rather than registered
states:

```ts check
import type { UIRouterLit } from 'lit-ui-router';

declare const router: UIRouterLit;

// Send a legacy path to its new URL; the rewrite replaces the history entry
router.urlService.rules.when('/old-about', '/about');

// Land the empty root URL on home and replace its history entry
router.urlService.rules.when(/^\/?$/, () => ({
  state: 'home',
  options: { location: 'replace' },
}));
```

- `urlService.rules.initial({ state: 'home' })` matches the empty root path
  **only before the first transition has run**. If you also register an
  `otherwise` rule for 404s, use `when(/^\/?$/, ...)` with
  `location: 'replace'` instead so navigating Back to `/` does not fall through
  to 404 — see [Unmatched URLs (404)](./unmatched-urls#caveat-the-app-root) and
  [Location Plugins](./location-plugins#the-initial-rule).
- `urlService.rules.when(pattern, handler)` is matched on every URL sync; its
  handler returns a replacement URL string, a `{ state, params, options }`
  object or a `TargetState`.

## On a server

A client-side redirect runs only after the browser has loaded the app, so a
crawler or an HTTP client never sees it. The same `redirectTo` declarations can
answer as HTTP redirects: `ui-router-server` reads a string or
`{ state, params }` `redirectTo` from the URL alone, and a `lit-ui-router-ssr`
render or prerender follows a `redirectTo` function. See
[Redirects: data until they need code](/guides/server-route-matching#redirects-data-until-they-need-code)
and
[Page, response state or redirect](/packages/lit-ui-router-ssr#page-response-state-or-redirect-which-decides-when).

## Further reading

- [Route Guards](./route-guards) — transition-hook redirects for protected
  subtrees
- [Unmatched URLs (404)](./unmatched-urls) — `otherwise`, the app-root caveat,
  `replace` under the hash plugin, and preserving query parameters on initial
  redirects
- [Location Plugins](./location-plugins) — `initial` and choosing hash,
  pushState, or Navigation API URLs
- [`@uirouter/core` — `StateDeclaration.redirectTo`](https://ui-router.github.io/core/docs/latest/interfaces/_state_interface_.statedeclaration.html#redirectto)
  and [`UrlRules`](https://ui-router.github.io/core/docs/latest/classes/_url_urlrules_.urlrules.html)
