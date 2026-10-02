---
title: Component Lifecycle Hooks
description: React to routing events from inside routed components with uiCanExit and uiOnParamsChanged
---

# Component Lifecycle Hooks

Routed components can participate in the routing lifecycle by implementing
two optional interfaces. Unlike
[transition hooks](./route-guards) registered on the `TransitionService`,
these are declared on the component itself and only fire while that
component is active inside a `<ui-view>`.

| Interface                                                     | Method                                 | Called when…                                                     |
| ------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| [`UiOnExit`](/api/reference/hooks/UiOnExit)                   | `uiCanExit(trans?)`                    | a transition is about to exit the component's state              |
| [`UiOnParamsChanged`](/api/reference/hooks/UiOnParamsChanged) | `uiOnParamsChanged(newParams, trans?)` | dynamic parameter values change without recreating the component |

## uiCanExit: confirm or block navigation

`uiCanExit` is called before a transition that would exit the component's
state. Return `true`/`undefined` to allow it, `false` to cancel it, or a
Promise to make the transition wait — the classic "unsaved changes" prompt:

```ts
import { LitElement, html } from 'lit';
import { Transition, HookResult } from '@uirouter/core';
import { UiOnExit } from 'lit-ui-router';

class EditContact extends LitElement implements UiOnExit {
  private dirty = false;

  uiCanExit(trans?: Transition): HookResult {
    if (this.dirty) {
      return window.confirm('Discard unsaved changes?');
    }
    return true;
  }
}
```

The pending transition is passed in, so the component can inspect where the
user is heading — or return a
[`TargetState`](https://ui-router.github.io/core/docs/latest/classes/state.targetstate.html)
to redirect instead of cancel.

::: tip Async confirmation
Returning a `Promise<boolean>` works too — for example, awaiting a custom
dialog element instead of `window.confirm`. The transition pauses until the
promise settles. The sample app's
[EditContact](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/contacts/EditContact.ts)
does exactly this with a dialog service.
:::

## uiOnParamsChanged: react to dynamic parameters

Normally, when a parameter in the URL changes, UI-Router exits and re-enters
the state — destroying and recreating the component. Declaring a parameter
**dynamic** changes that: the transition still runs, but the component
instance is kept, and `uiOnParamsChanged` is called with the changed values:

```ts
const messagesState: LitStateDeclaration = {
  name: 'messages',
  url: '/messages?folder',
  params: {
    folder: { dynamic: true, value: 'inbox' },
  },
  component: MessageList,
};
```

```ts
import { RawParams, Transition } from '@uirouter/core';
import { UiOnParamsChanged } from 'lit-ui-router';

class MessageList extends LitElement implements UiOnParamsChanged {
  uiOnParamsChanged(newParams: RawParams, trans?: Transition) {
    // Only *changed* values are present on newParams
    if (newParams.folder) {
      this.loadFolder(newParams.folder);
    }
  }
}
```

This is the right tool for parameters that tweak a view rather than replace
it — sort order, filters, pagination, a selected tab — where a full
destroy/recreate cycle would throw away scroll position, focus, and fetched
data.

## After the transition: waiting for the view to render

A transition settling is not the view rendering. `onSuccess` hooks run and
`transition.promise` resolves when the transition has succeeded; `<ui-view>`
swaps in the new component in a Lit update scheduled after that. Code that
needs the new DOM — a View Transition, a scroll restore, a focus move, a
measurement — and reads it on the promise alone finds the outgoing view.

`<ui-view>` is a `LitElement`, so its `updateComplete` is the promise for the
update that does the swap. Await `transition.promise`, then `updateComplete` on
every `<ui-view>` (nested views each swap in their own update), then on any
element the new view rendered, whose own update lands one step later.

Do not wait for a frame instead. `requestAnimationFrame` does not fire while a
View Transition snapshot is held, so a release that waits a frame hangs until
the browser's own timeout ends the transition.

```ts
import type { ReactiveElement } from 'lit';

const settle = (selector: string) =>
  Promise.all(
    [...document.querySelectorAll<ReactiveElement>(selector)].map(
      (element) => element.updateComplete,
    ),
  );

async function viewRendered(): Promise<void> {
  await Promise.resolve(); // lets the swap's update queue
  await settle('ui-view');
  await settle('contact-detail'); // the element the new view rendered
}

router.transitionService.onStart({}, (trans) => {
  if (!document.startViewTransition) return;
  let captured!: () => void;
  const oldViewCaptured = new Promise<void>((resolve) => (captured = resolve));
  document.startViewTransition(async () => {
    captured();
    await trans.promise;
    await viewRendered();
  });
  return oldViewCaptured; // the transition waits for the old snapshot
});
```

## Where these fit among the other hooks

- **Global concerns** (auth, analytics, error handling) belong in
  [`TransitionService` hooks](./route-guards) — they run regardless of which
  components are on screen.
- **Per-component concerns** (unsaved changes, reacting to a dynamic param)
  belong in these component lifecycle hooks.
- **Re-rendering on navigation** doesn't need hooks at all — see the
  [`TransitionController`](/api/reference/controllers/TransitionController)
  reactive controller.
