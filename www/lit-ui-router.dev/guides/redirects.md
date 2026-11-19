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

The [Hello Galaxy tutorial](/tutorial/hellogalaxy) uses this exact pattern on
`galaxy`.

## Dynamic and async `redirectTo` functions

Pass a function `(transition: Transition) => ...` when the redirect depends on
the incoming params or async data. Return:

- `undefined` (or a falsy value) to let the transition continue normally;
- a state name string or `{ state, params }`;
- a `TargetState` (from `transition.targetState().withParams(...)` or
  `transition.router.stateService.target(state, params, options)` when you also
  need custom `TransitionOptions`); or
- a `Promise` resolving to any of the above.

The [Hello Solar System tutorial](/tutorial/hellosolarsystem) canonicalizes
numbered body URLs (`/planets/4` → `/planets/earth`, since `solarBodies[0]` is
the Sun) this way:

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

Because `@uirouter/core` runs `redirectTo` in an `onStart` hook, it fires after
`onBefore` guards and before the state is entered.

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

Returning a `TargetState` cancels the original transition cleanly and starts
the replacement transition instead — no intermediate view flashes. See
[Route Guards](./route-guards) for the complete authentication and
return-after-login pattern.

## URL-level rules (`initial`, `when`, `otherwise`)

Use `router.urlService.rules` when matching raw URLs rather than registered
states:

```ts check
import type { UIRouterLit } from 'lit-ui-router';

declare const router: UIRouterLit;

// Rewrite a legacy path before state matching runs
router.urlService.rules.when('/old-about', '/about');

// Land the empty root URL on home, replacing the history entry so Back works
router.urlService.rules.when(/^\/?$/, (_match, _urlParts, r) =>
  r?.stateService.target('home', undefined, { location: 'replace' }),
);
```

- `urlService.rules.initial({ state: 'home' })` matches the empty root path
  **only before the first transition has run**. If you also register an
  `otherwise` rule for 404s, use `when(/^\/?$/, ...)` with
  `location: 'replace'` instead so navigating Back to `/` does not fall through
  to 404 — see [Unmatched URLs (404)](./unmatched-urls#caveat-the-app-root) and
  [Location Plugins](./location-plugins#the-initial-rule).
- `urlService.rules.when(pattern, handler)` runs on every URL sync and can
  return a replacement URL string or a `TargetState`.

## Server-side HTTP redirects

Client-side redirects only run after the browser downloads and boots your app,
so crawlers and HTTP clients see a `200 OK` response before the URL changes.
When you need real HTTP `301`, `302`, or `308` responses — or static host
`_redirects` rules emitted from your route table — declare them with
`ui-router-server`; see
[Redirects: data until they need code](./server-route-matching#redirects-data-until-they-need-code).

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
