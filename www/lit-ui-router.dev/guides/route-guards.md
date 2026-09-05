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

<svg viewBox="0 0 720 256" width="100%" style="max-width: 720px" role="img" aria-label="The transition lifecycle: onBefore, onStart, onExit/onRetain/onEnter, onFinish, then onSuccess or onError. A route guard is an onBefore hook: returning a TargetState redirects, false cancels, nothing proceeds. Resolves fetch during the transition." xmlns="http://www.w3.org/2000/svg">
  <title>The transition lifecycle and where guards run</title>
  <defs>
    <marker id="arr-lifecycle" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L8 4L0 8z" fill="var(--vp-c-text-3, #929295)" />
    </marker>
  </defs>
  <g font-family="var(--vp-font-family-base, ui-sans-serif, system-ui, sans-serif)">
    <!-- chain -->
    <rect x="16" y="52" width="88" height="36" rx="8" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" stroke="var(--vp-c-brand-1, #3451b2)" />
    <text x="60" y="74" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">onBefore</text>
    <line x1="104" y1="70" x2="118" y2="70" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-lifecycle)" />
    <rect x="122" y="52" width="78" height="36" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="161" y="74" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">onStart</text>
    <line x1="200" y1="70" x2="214" y2="70" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-lifecycle)" />
    <rect x="218" y="52" width="186" height="36" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="311" y="74" font-size="11" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">onExit &#183; onRetain &#183; onEnter</text>
    <line x1="404" y1="70" x2="418" y2="70" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-lifecycle)" />
    <rect x="422" y="52" width="80" height="36" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="462" y="74" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">onFinish</text>
    <!-- fork -->
    <line x1="502" y1="64" x2="540" y2="42" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-lifecycle)" />
    <line x1="502" y1="76" x2="540" y2="98" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-lifecycle)" />
    <rect x="546" y="20" width="112" height="36" rx="8" fill="var(--vp-c-green-soft, rgba(16,185,129,0.14))" />
    <text x="602" y="42" font-size="12" font-weight="600" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-green-1, #18794e)" text-anchor="middle">onSuccess</text>
    <rect x="546" y="84" width="112" height="36" rx="8" fill="var(--vp-c-red-soft, rgba(244,63,94,0.14))" />
    <text x="602" y="106" font-size="12" font-weight="600" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-red-1, #b8272c)" text-anchor="middle">onError</text>
    <text x="666" y="42" font-size="10" fill="var(--vp-c-text-3, #929295)">views</text>
    <text x="666" y="54" font-size="10" fill="var(--vp-c-text-3, #929295)">render</text>
    <text x="666" y="106" font-size="10" fill="var(--vp-c-text-3, #929295)">cancelled</text>
    <text x="666" y="118" font-size="10" fill="var(--vp-c-text-3, #929295)">or failed</text>
    <!-- resolves bracket -->
    <line x1="122" y1="112" x2="122" y2="106" stroke="var(--vp-c-divider, #e2e2e3)" />
    <line x1="122" y1="112" x2="502" y2="112" stroke="var(--vp-c-divider, #e2e2e3)" />
    <line x1="502" y1="112" x2="502" y2="106" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="312" y="130" font-size="11" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">resolves fetch during the transition &#8212; data arrives before any view renders</text>
    <!-- guard callout -->
    <line x1="60" y1="148" x2="60" y2="94" stroke="var(--vp-c-brand-1, #3451b2)" stroke-width="1.25" marker-end="url(#arr-lifecycle)" />
    <rect x="16" y="150" width="330" height="94" rx="8" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" stroke="var(--vp-c-brand-1, #3451b2)" />
    <text x="30" y="172" font-size="12" font-weight="600" fill="var(--vp-c-brand-1, #3451b2)">a route guard is an onBefore hook</text>
    <text x="30" y="188" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-3, #929295)">criteria: { to: (s) =&gt; s.data.requiresAuth }</text>
    <text x="30" y="208" font-size="11" fill="var(--vp-c-text-1, #3c3c43)"><tspan font-family="var(--vp-font-family-mono, ui-monospace, monospace)">TargetState</tspan> &#8594; redirect (e.g. to login)</text>
    <text x="30" y="224" font-size="11" fill="var(--vp-c-text-1, #3c3c43)"><tspan font-family="var(--vp-font-family-mono, ui-monospace, monospace)">false</tspan> &#8594; cancel the transition</text>
    <text x="30" y="240" font-size="11" fill="var(--vp-c-text-1, #3c3c43)"><tspan font-family="var(--vp-font-family-mono, ui-monospace, monospace)">nothing</tspan> &#8594; proceed</text>
    <!-- async note -->
    <text x="368" y="208" font-size="10" fill="var(--vp-c-text-3, #929295)">guards can be async &#8212; the transition</text>
    <text x="368" y="221" font-size="10" fill="var(--vp-c-text-3, #929295)">waits for the returned Promise</text>
  </g>
</svg>

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
