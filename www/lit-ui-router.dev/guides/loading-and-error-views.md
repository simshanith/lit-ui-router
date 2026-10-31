---
title: Loading and Error Views
description: Show a pending indicator while a transition runs, render NOWAIT resolves behind a skeleton, and route failed transitions to an error view
---

# Loading and Error Views

A transition fetches its resolves before any view changes, so loading and
failure belong to the transition rather than to the view. This guide builds
each state of a page from transition hooks and one resolve policy: a pending
indicator while the transition runs, a skeleton for data the transition does
not wait for, and an error view when it fails. [Route Guards](./route-guards)
covers how hooks are registered and matched.

## Pending indicator

The view a transition leaves stays mounted while the transition runs: core
swaps views in an `onSuccess` hook. Start an indicator in
[`onStart`](https://ui-router.github.io/core/docs/latest/classes/_transition_transitionservice_.transitionservice.html#onstart)
and stop it when the transition's
[`promise`](https://ui-router.github.io/core/docs/latest/classes/_transition_transition_.transition.html#promise)
settles, which it does on success and on failure alike. `onFinish` is no end
signal: it is the last hook before success and never runs once an earlier
hook or resolve rejects.

```ts
import type { Transition } from '@uirouter/core';
import type { UIRouterLit } from 'lit-ui-router';

const DELAY = 150; // ms a transition runs before the indicator shows
const MIN_SHOWN = 400; // ms the indicator stays once shown

export function trackPending(router: UIRouterLit, region: HTMLElement): void {
  let latest: Transition | undefined;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let shownAt: number | undefined;

  const settle = (trans: Transition) => {
    // A superseded transition settles too; only the latest owns the indicator.
    if (trans !== latest) return;
    region.removeAttribute('aria-busy');
    clearTimeout(showTimer);
    showTimer = undefined;
    if (shownAt === undefined) return;

    setTimeout(
      () => {
        if (trans !== latest) return;
        shownAt = undefined;
        region.classList.remove('pending');
      },
      Math.max(0, shownAt + MIN_SHOWN - Date.now()),
    );
  };

  router.transitionService.onStart({}, (trans) => {
    latest = trans;
    region.setAttribute('aria-busy', 'true');
    if (shownAt === undefined && showTimer === undefined) {
      showTimer = setTimeout(() => {
        shownAt = Date.now();
        region.classList.add('pending');
      }, DELAY);
    }

    const done = () => settle(trans);
    void trans.promise.then(done, done);
  });
}
```

`region` is the element around the `<ui-view>`, such as `<main>`. The delay
keeps a fast transition from flashing the indicator, and the minimum keeps a
slow one from flickering it off as the view lands. `aria-busy` marks the
region as updating for assistive technology from the moment the transition
starts. The promise is handled on both sides because a failed transition
rejects it, and the error is the `onError` hook's to report.

The recipe assumes LAZY resolves, the default. Core fetches an
[EAGER](https://ui-router.github.io/core/docs/latest/interfaces/_resolve_interface_.resolvepolicy.html#when)
resolve from its own `onStart` hook, which runs ahead of this one, so the
indicator only starts once that fetch settles and never shows for it. For
EAGER resolves, register the same hook with `onBefore`.

Inside a Lit element, a
[`TransitionController`](/api/reference/controllers/TransitionController)
observing `onStart` registers the same hook for as long as the element is
connected, and hands its callback the transition:

```ts
import type { Transition } from '@uirouter/core';
import { LitElement, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { TransitionController } from 'lit-ui-router';

class AppShell extends LitElement {
  @state() private pending?: Transition;

  private transitions = new TransitionController(this, {
    events: ['onStart'],
    callback: (trans, reason) => {
      if (reason !== 'onStart' || !trans) return;
      this.pending = trans;

      // Only the latest transition clears the flag.
      const done = () => {
        if (this.pending === trans) this.pending = undefined;
      };
      void trans.promise.then(done, done);
    },
  });

  render() {
    return html`<main aria-busy=${this.pending ? 'true' : nothing}>
      <ui-view></ui-view>
    </main>`;
  }
}
```

The callback also runs with the reason `'hostConnected'` each time the element
connects, which the guard skips. The delay and minimum display time from the
function above apply here unchanged, as timers around `pending`.

## Skeletons for NOWAIT resolves

A resolve with the
[`resolvePolicy`](https://ui-router.github.io/core/docs/latest/interfaces/_resolve_interface_.resolvepolicy.html)
`{ async: 'NOWAIT' }` starts with the transition, but the transition does not
wait for it. The routed component renders straight away and receives the
resolve's promise under its token in `resolves`:

```ts
import type { LitStateDeclaration } from 'lit-ui-router';

interface ContactResolves {
  contacts: Promise<Contact[]>;
}

const contactsState = {
  name: 'contacts',
  url: '/contacts',
  component: ContactList,
  resolve: [{ token: 'contacts', resolveFn: fetchContacts }],
  resolvePolicy: { async: 'NOWAIT' },
} satisfies LitStateDeclaration<ContactResolves>;
```

`resolvePolicy` on the state applies to all of its resolves; a single resolve
takes the same object as its `policy`. Render the promise with
[`@lit/task`](https://lit.dev/docs/data/task/), which runs again only when the
promise it is handed changes:

```ts
import { Task } from '@lit/task';
import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';
import type { UIViewInjectedProps } from 'lit-ui-router';

class ContactList extends LitElement {
  @property({ attribute: false })
  _uiViewProps?: UIViewInjectedProps<ContactResolves>;

  private contacts = new Task(this, {
    task: ([contacts]) => contacts,
    args: () => [this._uiViewProps?.resolves.contacts],
  });

  render() {
    return this.contacts.render({
      pending: () => html`<contact-skeleton></contact-skeleton>`,
      complete: (list) =>
        html`<ul>
          ${list?.map((contact) => html`<li>${contact.name}</li>`)}
        </ul>`,
      error: () => html`<p>Contacts failed to load.</p>`,
    });
  }
}
```

A template function can hand the promise to lit's
[`until()`](https://lit.dev/docs/templates/directives/#until) instead:
`until(resolves.contacts.then(renderList), skeleton)`. The `.then()` builds a
new promise on every render, so each re-render rebuilds the skeleton in the
DOM; it paints only while the promise is pending.

A rejected NOWAIT resolve does not fail the transition, which has already
succeeded; the component renders that failure itself, as the task's `error`
branch does above. Core still leaves the rejection unhandled on its own copies
of the promise, so the page's `unhandledrejection` event and any error tracker
listening to it see the failure too.

## Error views

[`onError`](https://ui-router.github.io/core/docs/latest/classes/_transition_transitionservice_.transitionservice.html#onerror)
runs for every transition that does not succeed, including one superseded by a
newer transition, one redirected by a hook, and one a guard cancelled. A real
failure, a resolve that rejected or a hook that threw, is the transition's
[`error()`](https://ui-router.github.io/core/docs/latest/classes/_transition_transition_.transition.html#error)
with the
[`RejectType`](https://ui-router.github.io/core/docs/latest/enums/_transition_rejectfactory_.rejecttype.html)
`ERROR`.

State `data` is inherited, so a subtree can name its own error state once:

```ts
const contactsState = {
  name: 'contacts',
  url: '/contacts',
  component: Contacts,
  data: { errorState: 'contacts.error' },
} satisfies LitStateDeclaration;

const contactsErrorState = {
  name: 'contacts.error',
  params: { failed: null },
  component: ContactsError,
} satisfies LitStateDeclaration;
```

The hook sends a failed transition to the error state its target inherits,
with the failed target as a param:

```ts
import { RejectType } from '@uirouter/core';

router.transitionService.onError({}, (trans) => {
  if (trans.error()?.type !== RejectType.ERROR) return;

  const errorState: unknown = trans.to().data?.errorState;
  // The error state inherits its own name, so its failure stops here.
  if (typeof errorState !== 'string' || errorState === trans.to().name) return;

  void router.stateService.go(
    errorState,
    { failed: trans.targetState() },
    { location: false },
  );
});
```

`{ location: false }` leaves the address bar alone, so a reload retries the
page that failed rather than the error view. Entering `contacts.error`
re-enters `contacts` if it is not already active, so a failure in `contacts`'
own resolves needs an error state outside the subtree: give `contacts` a
`data.errorState` that points elsewhere and its children their own.

Failed transitions also reach the
[`defaultErrorHandler`](https://ui-router.github.io/core/docs/latest/classes/_state_stateservice_.stateservice.html#defaulterrorhandler),
which logs them to the console. Replace it to send failures to an error
tracker.

## Retry

The error view holds the failed
[`TargetState`](https://ui-router.github.io/core/docs/latest/classes/_state_targetstate_.targetstate.html)
in its `failed` param. Retrying is a new transition to it:

```ts
import type { TargetState } from '@uirouter/core';
import { html } from 'lit';
import type { RoutedLitTemplate } from 'lit-ui-router';

const ContactsError: RoutedLitTemplate = ({ router, transition }) => {
  const failed: TargetState | undefined = transition?.params().failed;

  return html`<p>This page failed to load.</p>
    <button
      @click=${() => failed && router.stateService.go(failed.state(), failed.params())}
    >
      Retry
    </button>`;
};
```

A component that rendered a failed NOWAIT resolve retries in place with
[`stateService.reload(state)`](https://ui-router.github.io/core/docs/latest/classes/_state_stateservice_.stateservice.html#reload),
which runs the resolves of that state and its descendants again.

## Example

The example puts the recipes together. Report and Profile wait on a slow
resolve, so the shell shows the pending view their state's `data` names:
`account` sets a skeleton that Profile inherits, and Report gets the shell's
default. Activity's resolve is NOWAIT, so its view renders at once and fills in
when the promise settles. Check _Fail requests_ to see the default error state,
the `account.error` state that `account`'s `data` names for its subtree, and
Activity's in-place retry with `reload`.

<LiveExample name="loading-and-error-views" />
