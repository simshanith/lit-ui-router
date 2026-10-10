---
title: Routed Components
description: Read a state's params in its routed component, and code-split the component's element module with a resolve or a lazyLoad future state
---

# Routed Components

A routed component gets its inputs from `<ui-view>`, which renders it with
[`UIViewInjectedProps`](/api/reference/types/UIViewInjectedProps): the
`router`, the `transition` that rendered the view, and the state's
`resolves`. This guide covers two things every routed component meets: reading
its state's params, and loading its own element module only when the state is
entered.

## Reading params

Declare the params the component needs as a resolve on its state. The resolve
depends on `$transition$`, reads the value once, and hands the component a
named, typed input:

```ts
import type { Transition } from '@uirouter/core';
import type { LitStateDeclaration } from 'lit-ui-router';

interface UserResolves {
  userId: string;
}

const userState = {
  name: 'user',
  url: '/users/:id',
  resolve: [
    {
      token: 'userId',
      deps: ['$transition$'],
      resolveFn: ($transition$: Transition) => $transition$.params().id,
    },
  ],
  component: UserDetail,
} satisfies LitStateDeclaration<UserResolves>;
```

```ts
import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';
import type { UIViewInjectedProps } from 'lit-ui-router';

class UserDetail extends LitElement {
  @property({ attribute: false })
  _uiViewProps?: UIViewInjectedProps<UserResolves>;

  render() {
    return html`<h1>User ${this._uiViewProps?.resolves.userId}</h1>`;
  }
}
```

The same resolve can fetch the record instead of passing the id through, so
the component renders with its data already loaded. The sample app's
`contacts.contact` state
([contacts/states.ts](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/contacts/states.ts))
resolves the contact from its `contactId` param this way.

Reading `router.globals.params` from the component instead ties it to whatever
state is current, not the state it was rendered for, and gives it no type.

A template function can read `props.transition.params()` directly for a quick
view; the [`RoutedLitTemplate`](/api/reference/types/RoutedLitTemplate)
reference shows that form.

### Params that change without re-entering the state

A non-dynamic param change exits and re-enters the state, so the component is
rebuilt with fresh resolves. A **dynamic** param keeps the component, and its
resolves keep the values they had when it was created. Read changed values in
[`uiOnParamsChanged`](./component-lifecycle#uionparamschanged-react-to-dynamic-parameters).

## Lazy-loading a route's element

Importing the element module inside `component` without awaiting it renders
an undefined element that upgrades whenever the chunk arrives, and a failed
chunk load surfaces as an unhandled rejection:

```ts
component: () => {
  import('./users/users.js'); // not awaited
  return html`<app-users></app-users>`;
},
```

### Await the module in a resolve

Return the import from a resolve. Resolves settle before the state is entered,
so the element is defined by the time `<ui-view>` renders it, and a failed
import rejects the transition, where
[transition hooks](./route-guards) and `stateService.defaultErrorHandler` see
it:

```ts
const usersState = {
  name: 'users',
  url: '/users',
  resolve: [
    {
      token: 'usersElement',
      resolveFn: () => import('./users/users.js'),
    },
  ],
  component: () => html`<app-users></app-users>`,
} satisfies LitStateDeclaration;
```

The [Hello Galaxy tutorial](/tutorial/hellogalaxy) loads
`@google/model-viewer` for one state the same way.

### Lazy-load a whole feature with a future state

When a feature owns several states, register one placeholder whose name ends
in `.**` and whose `lazyLoad` imports a module exporting `states`. The first
navigation into the URL prefix loads the module, registers its states in
place of the placeholder, and retries the transition:

```ts
const contactsFutureState = {
  parent: 'app',
  name: 'contacts.**',
  url: '/contacts',
  lazyLoad: () => import('./contacts/states.js'),
};
```

The state modules import their components statically, so the elements arrive
in the same chunk. The sample app splits contacts, prefs and messages this way
([main/states.ts](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/main/states.ts)).
