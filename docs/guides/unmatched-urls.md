---
title: Unmatched URLs (404)
description: Route unmatched URLs to a 404 state with urlService.rules.otherwise
---

# Unmatched URLs (404)

When no registered state matches the browser URL, UI-Router does nothing by
default: the URL sits in the address bar and no view renders. The
[`urlService.rules.otherwise`](https://ui-router.github.io/core/docs/latest/classes/_url_urlrules_.urlrules.html#otherwise)
rule lets you route those URLs somewhere deliberate — a 404 state, or a
redirect back home.

The [sample app](/app) implements the 404-state approach; this page walks
through that implementation
([`router.config.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/router.config.ts),
[`states.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/main/states.ts)).

## The rule

`otherwise()` only fires after every registered URL rule has failed to match,
so it can never shadow a real state:

```ts
urlService.rules.otherwise(() => ({
  state: 'notFound',
  params: { attemptedPath: urlService.path() },
}));
```

Passing the attempted path along as a param lets the 404 view show what
failed to match. If you'd rather silently return home, target your welcome
state instead — or use the string shorthand, `otherwise('/welcome')`.

## Caveat: the app root

`otherwise()` catches the app root too, and the root is rarely a state url of
its own. It is tempting to reach for
[`rules.initial`](https://ui-router.github.io/core/docs/latest/classes/_url_urlrules_.urlrules.html#initial),
but that rule matches **only while no transition has run yet**:

```ts
// only fires on the first sync — a later sync of '' or '/' falls through
urlService.rules.initial({ state: 'welcome' });
```

So the root works on load, then 404s the moment it is synced again. The common
way to hit that: the root pushes a _new_ history entry when it redirects, so
`/app` → `/app/welcome` leaves `/app` sitting in history. Pressing **Back**
returns to `/app`, `initial` no longer matches, and `otherwise()` renders the
404 — with an empty attempted path, since the root is the empty path.

Match the empty path on every sync instead, and replace the history entry so
the root never lingers there at all:

```ts
urlService.rules.when(/^\/?$/, () => ({
  state: 'welcome',
  options: { location: 'replace' },
}));
```

`/^\/?$/` covers both `''` and `'/'`, which is what the empty path looks like
with and without a trailing slash on the base href. `location: 'replace'` makes
Back from `/welcome` leave the app, rather than bouncing off the root.

With the [hash location plugin](https://ui-router.github.io/docs/latest/modules/vanilla.html)
the `replace` half doesn't apply: `HashLocationService` sets `location.hash`
directly and ignores the flag, so the root keeps its history entry. Landing on
it again just re-resolves to welcome. That is the trade — under `hashLocation`
the root is a redirect you cannot press Back through, but it never 404s.

## The 404 state

```ts
export const notFoundState = {
  parent: 'app',
  name: 'notFound',
  params: { attemptedPath: null },
  resolve: [
    {
      token: 'attemptedPath',
      deps: ['$transition$'],
      resolveFn: ($transition$: Transition) =>
        $transition$.params().attemptedPath,
    },
  ],
  component: NotFound,
};
```

The state intentionally declares **no `url`**: the unmatched URL stays in the
address bar (like a server-rendered 404 page), and the state can only be
activated by the rule. Anything that reads `transition.$to().url` — an
analytics hook, say — has to tolerate that `null`. The view is an ordinary
component that reads the resolved path:

```ts
export default (props: UIViewInjectedProps<NotFoundResolves>) =>
  html`<div class="container-fluid not-found">
    <h3>404 Page Not Found</h3>
    <p>
      No state matched the URL <code>${props.resolves.attemptedPath}</code>.
    </p>
    <button ${uiSref('welcome')} class="btn btn-primary">
      Return to Welcome
    </button>
  </div>`;
```

## Caveat: lazy-loaded future states

If your app lazy loads modules through
[future states](https://ui-router.github.io/guide/lazyloading) (`name:
'contacts.**'`), there is one gap `otherwise()` cannot cover on its own. A URL
like `/contacts/no/such/page` _does_ match the `contacts.**` wildcard, so the
future state's module lazy loads — and if nothing in the loaded module matches
either, `@uirouter/core` re-syncs the URL (correctly starting the `notFound`
transition) but then lets the original transition resume, re-activating the
already-replaced `.**` placeholder and superseding the 404.

Until that's addressed upstream, a low-priority hook that aborts transitions
to deregistered placeholders closes the gap:

<!-- prettier-ignore -->
```ts
// runs after the core lazyLoad hook (priority 0); aborts transitions to
// placeholders that lazy loading has already replaced in the registry
router.transitionService.onBefore(
  { to: (state) => !!state?.name.endsWith('.**') },
  (transition) =>
    transition.router.stateRegistry.get(transition.to().name ?? '') === null
      ? false
      : undefined,
  { priority: -10 },
);
```

With the rules, the state, and the hook in place, every case behaves: plain
garbage URLs render the 404 view, the app root goes to welcome, future-state
URLs still lazy load, and URLs left unmatched _after_ a lazy load land on the
404 view too. The sample app's `not_found.cy.js` Cypress spec pins each case.
