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
  template that declares the view. A prerendered view, which the document parser can fill
  after connecting it, captures at its wake instead — see below.
- **The same nodes every time.** The fallback is moved, never copied, so the
  nodes on screen are the authored ones and they keep their identity across
  any number of round trips through a routed component. A reference you hold
  stays valid, state inside them survives, and a binding an enclosing lit
  template owns keeps updating them.
- **It is not a `<slot>` in the browser.** `<ui-view>` renders to itself
  rather than to a shadow root, so there is no slot assignment and no
  `::slotted()` styling at runtime — style the fallback with ordinary
  selectors. The one place a `<slot>` appears is a server render without
  [`lit-ui-router-ssr`](/packages/ssr); see below.

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

A prerendered shell containing `<ui-view>` renders, and the client fills it in
on load. What becomes of the fallback content depends on which renderer drew
the document.

Under plain [`@lit-labs/ssr`](https://lit.dev/docs/ssr/overview/), every
`LitElement`'s output is wrapped in a declarative shadow root, and a
`<ui-view>` that was never connected has no fallback set — so it renders a
`<slot>` rather than an empty shadow root. An empty one would hide the light
DOM; the slot keeps the server-rendered fallback visible and later projects
whatever the client renders into the light DOM. For
`<ui-view><p>fallback</p></ui-view>`, the server emits:

```text
<ui-view><template shadowroot="open" shadowrootmode="open"><!--lit-part Pz0gobCCM4E=--><slot></slot><!--/lit-part--></template><p>fallback</p></ui-view>
```

[`lit-ui-router-ssr`](/packages/ssr) draws the view itself instead. Its
renderer writes the routed component into the view's light DOM — no
declarative shadow root and no `<slot>` — and the served view, the `<ui-view>`
that `lit-ui-router-ssr/register` defines, arrives asleep, holding that markup
until the client's hydrate wakes it. Three things follow for fallback content:

- **Authored content in a served view is that view's fallback set.** It is
  emitted as written and shows while the document loads. At the wake the view
  takes the children standing ahead of the render it holds, exactly as a cold
  view takes its authored children, and parks them when a component occupies
  the view.
- **The server's own render is never captured.** Everything from the view's
  render markers down belongs to the render the client adopts, so a view the
  server filled and nothing else has no fallback set.
- **A view the server drew empty is nothing to adopt.** An address no state
  routes is served as an empty pair of render markers, which is exactly what
  the client's own first render of that view produces, so the view renders
  after them, cold and silent.

Fallback content reads the same on both sides, then: the nodes an author wrote
inside a `<ui-view>` are that view's fallback set whether the client created it
or a prerender drew it. The prerender and hydration model as a whole is on the
[`lit-ui-router-ssr` page](/packages/ssr).

Prerendered links are a separate question. `uiSref` is an element-part
directive and `@lit-labs/ssr` skips element parts, so it emits nothing; the
attribute directive `srefHref` writes a real `href` into the served markup.
[Design System Links](./design-system-links#element-part-or-attribute-part)
covers the choice.

Rendering is a separate axis from routing verdicts. See the closing section
of [Server-Side Routing](./server-route-matching) for where that axis stands.

## Related

- [Hello Galaxy: nested ui-view with fallback content](/tutorial/hellogalaxy#nested-ui-view-with-fallback-content)
- [Component Lifecycle Hooks](./component-lifecycle)
- [Server-Side Routing](./server-route-matching)
- [`lit-ui-router-ssr`](/packages/ssr)
- [`<ui-view>` API reference](/api/reference/components/UiView)
