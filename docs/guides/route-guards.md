---
title: Route Guards
description: Protect states with transition hooks - the requiresAuth pattern
---

# Route Guards (Transition Hooks)

Every navigation in UI-Router is a
[Transition](https://ui-router.github.io/core/docs/latest/classes/transition.transition-1.html),
and transitions can be observed and altered with **transition hooks**. A hook
that redirects or cancels a transition is a route guard. Because guards run
in the router — not in components — a single hook can protect any number of
states.

This page walks through the authentication guard the
<a href="/app" target="_self">sample app</a> uses
([`requiresAuth.hook.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/global/requiresAuth.hook.ts)).

## Mark states that need protection

State declarations accept an arbitrary `data` object. Child states inherit
(and may override) their parent's `data`, so marking one parent protects a
whole subtree:

```ts
const contactsState: LitStateDeclaration = {
  name: 'contacts',
  url: '/contacts',
  component: Contacts,
  data: { requiresAuth: true },
};

// contacts.detail, contacts.edit, … inherit requiresAuth automatically
```

## Write the guard

A hook has two parts: **criteria** choosing which transitions it applies to,
and a **callback** that decides what happens. Returning a `TargetState`
redirects the transition; returning `false` cancels it; returning nothing
lets it proceed.

```ts
import { StateObject, Transition } from '@uirouter/core';

const requiresAuthHook = {
  // Matches transitions to any state whose data has a truthy `requiresAuth`
  criteria: {
    to: (state: StateObject | undefined) =>
      state?.data && state.data.requiresAuth,
  },
  // Redirect to login if the user is not authenticated
  callback: (transition: Transition) => {
    const $state = transition.router.stateService;
    if (!AuthService.isAuthenticated()) {
      return $state.target('login', undefined, { location: false });
    }
  },
};
```

`{ location: false }` keeps the attempted URL in the address bar during the
redirect, so logging in can return the user to where they were headed.

## Register it

```ts
router.transitionService.onBefore(
  requiresAuthHook.criteria,
  requiresAuthHook.callback,
  { priority: 10 },
);
```

`onBefore` runs before the transition starts any work (before resolves
fetch). Higher `priority` hooks run first. The
[TransitionService](https://ui-router.github.io/core/docs/latest/classes/transition.transitionservice.html)
offers the full lifecycle — `onBefore`, `onStart`, `onEnter`, `onRetain`,
`onExit`, `onFinish`, `onSuccess`, `onError` — and all of them accept the
same criteria/callback shape.

## Return the user after login

The redirect above targets a `login` state. To send the user back where they
were going, the login state resolves its return target from the transition
that redirected to it:

```ts
const loginState: LitStateDeclaration = {
  name: 'login',
  url: '/login',
  component: Login,
  resolve: [{ token: 'returnTo', deps: ['$transition$'], resolveFn: returnTo }],
};

/** The state to return to after a successful login. */
function returnTo($transition$: Transition) {
  // Redirected here by the guard? Return to the original target.
  if ($transition$.redirectedFrom()) {
    return $transition$.redirectedFrom().targetState();
  }

  const $state = $transition$.router.stateService;

  // Navigated here directly? Go back to the previous state.
  if ($transition$.from().name !== '') {
    return $state.target($transition$.from(), $transition$.params('from'));
  }

  // Otherwise (deep-linked straight to /login), fall back to home.
  return $state.target('home');
}
```

After authenticating, the login component navigates to the resolved target:

```ts
const { returnTo } = this._uiViewProps.resolves;
router.stateService.go(returnTo.state(), returnTo.params(), {
  reload: true,
});
```

## Async guards

Hook callbacks may return a Promise; the transition waits for it. That makes
guards a natural place for "check the session with the server" logic:

```ts
router.transitionService.onBefore(criteria, async (transition) => {
  const ok = await AuthService.checkSession();
  if (!ok) {
    return transition.router.stateService.target('login');
  }
});
```

## Guards in components

For per-component concerns — like an edit form warning about unsaved changes
before the user navigates away — implement the `uiCanExit` lifecycle hook on
the routed component instead of a global guard. See the
[UiOnExit](/api/reference/hooks/UiOnExit) interface.
