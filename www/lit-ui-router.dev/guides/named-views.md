---
title: Named Views
description: Fill several <ui-view> viewports from one state with views, and target a view another state created with name@state, relative ^ anchors and absolute ! paths
---

# Named Views

A state with a `component` fills one viewport: the unnamed `<ui-view>` in its
parent state's template. A layout with more than one region (a folder list, a
message list, a reading pane) gives each `<ui-view>` a `name`, and the states
that fill it declare `views` instead of `component`.

## Naming a viewport

`<ui-view>` takes its view name from the `name` attribute. A view without one
is named `$default`.

```ts
import { LitElement, html } from 'lit';
import type { LitStateDeclaration } from 'lit-ui-router';

class MailLayout extends LitElement {
  render() {
    return html`
      <nav><ui-view name="folders"></ui-view></nav>
      <ui-view name="list"></ui-view>
      <main><ui-view></ui-view></main>
    `;
  }
}

const mailState = {
  name: 'mail',
  url: '/mail',
  component: MailLayout,
} satisfies LitStateDeclaration;
```

The name is read once, when the view connects and registers with the router.
Setting `name` on a connected view does not retarget it; render a different
`<ui-view>` instead.

## Filling several views from one state

`views` maps a view name to a view declaration. A value takes any form
`component` takes: a `LitElement` class, a template function, or an object
with a `component` property.

```ts
const folderState = {
  name: 'mail.folder',
  url: '/:folderId',
  views: {
    folders: FolderList,
    list: { component: MessageList },
    $default: () => html`<p>Select a message</p>`,
  },
} satisfies LitStateDeclaration;
```

A bare name targets a view in the parent state's template, just as `component`
targets that template's `$default` view. Each view's component
receives the `resolves` of the state that declares it, through
[`_uiViewProps`](./routed-components).

A state declares `views` or `component`, not both: when `views` is present,
`component` is ignored. A named `<ui-view>` that no active state fills shows
its [fallback content](./view-fallback-content).

## Targeting a view another state created

A key can name the state whose template holds the view, as `name@state`. A
grandchild state uses this to replace a view its parent filled:

```ts
const messageState = {
  name: 'mail.folder.message',
  url: '/:messageId',
  views: {
    '$default@mail': MessageView,
  },
} satisfies LitStateDeclaration;
```

While `mail.folder.message` is active, its `MessageView` replaces the
`Select a message` placeholder in `mail`'s `<main>`, and `mail.folder` keeps
the `folders` and `list` views.

The part after `@` is a state reference, so it can be relative: `^` is the
declaring state's parent, and `^.^` its grandparent. `'$default@^.^'` is the
same target as `'$default@mail'` here. A bare `list` is shorthand for
`list@^`.

### Absolute view paths

A key that starts with `!` names a path of nested view names from the root,
regardless of which state created them. The `<ui-view>` in the page is
`$default`, so the `list` view inside `MailLayout` is `$default.list`:

```ts
const composeState = {
  name: 'mail.compose',
  url: '/compose',
  views: {
    '!$default.list': ComposeMessage,
  },
} satisfies LitStateDeclaration;
```

Each `<ui-view>` finds its enclosing view by walking up the DOM, shadow roots
included, so nesting is the DOM's nesting, not the order the states declare.

## Top-level named views

A state with no parent fills the views at the page root, so the page can hold
sibling viewports:

```html
<ui-router>
  <ui-view name="header"></ui-view>
  <ui-view></ui-view>
</ui-router>
```

```ts
const homeState = {
  name: 'home',
  url: '/home',
  views: {
    header: () => html`<h1>Home</h1>`,
    $default: HomePage,
  },
} satisfies LitStateDeclaration;
```

## In the sample app

The sample app's messages feature uses every form above. `MyMessages`
([MyMessages.ts](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/mymessages/MyMessages.ts))
renders the `messagelist` and `messagecontent` views, and
[mymessages/states.ts](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/mymessages/states.ts)
fills them by name, by a relative anchor (`'^.^.messagecontent'`), and by an
absolute path (`'!$default.mymessages'`, which lets the compose state take over
the whole messages view). In
[contacts/states.ts](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/contacts/states.ts),
`contacts.contact.edit` replaces its parent's view with `'^.^.$default'`.

UI-Router's [Views guide](https://ui-router.github.io/guide/views) covers the
same targeting rules for every framework, including the general
`[view path]@[state]` form.
