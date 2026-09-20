---
title: View Fallback Content
description: What <ui-view> renders when no routed component is active — the capture rules, the master/detail idiom, and prerendered shells
---

# View Fallback Content

`<ui-view>` renders into the light DOM, so whatever markup you write
_inside_ it is real content the browser paints. That markup is the view's
**fallback content**: it shows whenever no routed component occupies the
view, and it is replaced the moment one does.

```html
<ui-view>
  <p>Select a contact</p>
</ui-view>
```

## The four moments it shows

| Moment                                               | Why no component is active                 |
| ---------------------------------------------------- | ------------------------------------------ |
| Before `router.start()`                              | No transition has run yet                  |
| While the first transition resolves                  | Resolves are still pending                 |
| The active state declares no view for this view name | A parent state is active with no child yet |
| After navigating away to a state without a view here | The previous component was torn down       |

The third row is the interesting one: it is the master/detail case, and it
is the reason fallback content exists at all.

## How the capture works

On connect, `<ui-view>` takes its light-DOM children as the view's fallback
set and parks them in a `DocumentFragment`. From then on the nodes are
_moved_ between that fragment and the light DOM: they stand in the element
while no component is active, and go back to the fragment while one is.
Three consequences are worth knowing:

- **Captured on connect.** Children appended to a `<ui-view>` _after_ it
  connects are not part of the fallback set, so they never come back once a
  routed component has replaced them. Write the fallback into the markup or
  template that declares the view.
- **The same nodes every time.** The fallback is moved, never copied, so the
  nodes on screen are the authored ones and they keep their identity across
  any number of round trips through a routed component. A reference you hold
  stays valid, state inside them survives, and a binding an enclosing lit
  template owns keeps updating them.
- **It is not a `<slot>` in the browser.** `<ui-view>` renders to itself
  rather than to a shadow root, so there is no slot assignment and no
  `::slotted()` styling at runtime — style the fallback with ordinary
  selectors. Server rendering is the one exception; see below.

The fallback set stands ahead of the render marker `<ui-view>` writes for
its own output, so routed content and fallback content never interleave.

## Master/detail

The idiom is a list beside a detail pane, where the detail pane is a nested
`<ui-view>` filled by a grandchild state. Until the user picks something,
the pane shows the prompt:

```ts
class StarsContainer extends LitElement {
  render() {
    return html`
      <div class="container">
        <div class="list">
          ${this.stars.map((star) => this.renderStar(star))}
        </div>
        <div class="detail">
          <ui-view>
            <p class="hint">Select a star from the list</p>
          </ui-view>
        </div>
      </div>
    `;
  }
}
```

<LiveExample name="hellogalaxy" />

That is the
[Hello Galaxy](/tutorial/hellogalaxy#nested-ui-view-with-fallback-content)
example — deliberately minimal, one concept at a time. The
[sample app](/sample-app) is the real-application tier: its contacts pane
does the same thing in
[`Contacts.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/contacts/Contacts.ts),
showing `Select a contact` until the `contacts.contact` state activates.

## Before the router starts

The first two moments are the same mechanism used as a loading state. A
view declared before `router.start()` paints its fallback immediately, so
the shell is never blank:

```html
<ui-router>
  <ui-view>
    <p class="loading">Loading…</p>
  </ui-view>
</ui-router>
```

Once `start()` runs and the first transition finishes resolving, the routed
component replaces it.

## Prerendered shells and server rendering

A prerendered shell containing `<ui-view>` renders, and the client fills it
in on load. [`@lit-labs/ssr`](https://lit.dev/docs/ssr/overview/) wraps
every `LitElement`'s output in a declarative shadow root, and a `<ui-view>`
that was never connected has no fallback set — so it renders a `<slot>`
rather than an empty shadow root. An empty one would hide the light DOM;
the slot keeps the server-rendered fallback visible and later projects
whatever the client renders into the light DOM. For
`<ui-view><p>fallback</p></ui-view>`, the server emits:

```text
<ui-view><template shadowroot="open" shadowrootmode="open"><!--lit-part Pz0gobCCM4E=--><slot></slot><!--/lit-part--></template><p>fallback</p></ui-view>
```

Two limits are worth stating plainly:

- **Hydration is not supported yet.** `@lit-labs/ssr-client` hydration of a
  routed tree is tracked in
  [issue #348](https://github.com/simshanith/lit-ui-router/issues/348). What
  works today is a server-rendered shell that the client boots into.
- **`uiSref` emits nothing under SSR.** It is an element-part directive, and
  `@lit-labs/ssr` skips element parts, so prerendered links carry no `href`
  until the client attaches —
  [issue #564](https://github.com/simshanith/lit-ui-router/issues/564).

Rendering is a separate axis from routing verdicts. See the closing section
of [Server-Side Routing](./server-route-matching) for where that axis stands.

## Related

- [Hello Galaxy: nested ui-view with fallback content](/tutorial/hellogalaxy#nested-ui-view-with-fallback-content)
- [Component Lifecycle Hooks](./component-lifecycle)
- [Server-Side Routing](./server-route-matching)
- [`<ui-view>` API reference](/api/reference/components/UiView)
