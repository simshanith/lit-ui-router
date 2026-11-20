---
title: Design System Links
description: "Driving a design system's link component with uiSref, and why assignHref: true is the option for it"
type: guide
topic: views
---

# Design System Links

Your design system almost certainly ships a link component —
[`<sp-link>`](https://opensource.adobe.com/spectrum-web-components/components/link/),
`<md-*>`, Shoelace's `<sl-...>`, or an in-house one. It is a custom element
that declares its own `href` property and renders an anchor inside its shadow
root. It is a link in every way that matters to a reader, and in no way that
matters to `document.querySelector('a')`.

[`uiSref`](/reference/lit-ui-router/directives/uiSref) drives it, but the `href` needs
one option: **`assignHref: true`**.

```ts check
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

html`<sp-link ${uiSref('components', {}, { assignHref: true })}
  >Components</sp-link
>`;
```

<LiveExample name="design-system-links" />

## Why `'auto'` refuses it

[`assignHref`](/reference/lit-ui-router/types/UiSrefOptions) decides where the
generated `href` is written:

| value    | behaviour                                                              |
| -------- | ---------------------------------------------------------------------- |
| `true`   | write it to whatever element carries the directive — the 1.x default   |
| `'auto'` | write it only where HTML defines an `href`: `<a>`, `<area>`, SVG `<a>` |
| `false`  | never write it; the app manages the attribute itself                   |

`'auto'` tests the element's tag name, not its shape. A design-system link's
`localName` is `sp-link`, not `a`, so `'auto'` skips it — deliberately. The
rule it enforces is "no inert `href` on elements that cannot use one", and it
has no way to tell a `<sp-link href>` that means it from a `<div>` that does
not. `true` is the escape hatch for the elements that do mean it, which is why
it survives the 2.0 default flip.

The example above stages all three `assignHref` cases side by side and prints
each element's live `href` attribute:

- `<sp-link>` with `assignHref: true` — carries `href="#/components"`
- `<sp-link>` with `assignHref: 'auto'` — no `href` attribute at all
- `<a>` with `assignHref: 'auto'` — carries `href="#/tokens"`, because `'auto'`
  writes to real anchors

All three navigate on click. `assignHref` governs the attribute only; the
click handler is never affected by it.

## What the `href` buys you

The `href` is not decoration on a link-shaped custom element. It is what makes
the component behave like the link it renders:

- the browser shows the target URL in the status bar on hover
- middle-click and <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>-click open a new tab
- "Copy link address" produces a working URL
- assistive technology announces a link, and
  [`uiSrefActive`](/reference/lit-ui-router/directives/uiSrefActive) can mark it with
  `aria-current`

Most design-system link components forward `href` to their internal anchor, so
writing the attribute on the host is enough for all of it.

## Choosing the option

| your element                                   | option                               |
| ---------------------------------------------- | ------------------------------------ |
| `<a>` / `<area>`                               | nothing — `'auto'` already writes it |
| a custom element with its own `href`           | `assignHref: true`                   |
| `<button>`, `<tr>`, `<div>` — no `href` at all | `assignHref: 'auto'`                 |
| an element whose `href` you set yourself       | `assignHref: false`                  |

For a control whose state cannot be encoded in a URL — a sref carrying
non-URL parameters — no `href` beats a wrong one, whatever the element is.
See [Unmatched URLs](./unmatched-urls) for the related case of routing a URL
that matches no state.

::: tip Under the development build
`assignHref: true` on a non-anchor logs a one-time console warning naming
`'auto'` as the fix, because it cannot know your element forwards `href`. It
is gated on both this package's development build and lit's own, and the
message text is not present in a production bundle at all — see
[Development and Production Builds](./development-builds). Pass `false` and set
the property yourself if you would rather not see it in development.
:::

## Element part or attribute part

`assignHref` exists because `uiSref` is an **element part**: it sits on the
element and writes the `href` from the outside, so it needs a rule for where
to write. [`srefHref`](/reference/lit-ui-router/directives/srefHref) is the same link
bound as an **attribute part** — it _is_ the `href`, so there is no
`assignHref` and no rule to pick. The attribute is written wherever it was
bound:

```ts check
import { html } from 'lit';
import { srefHref } from 'lit-ui-router';

html`<sp-link href=${srefHref('components')}>Components</sp-link>`;
```

The example's fourth row is that spelling of its first: the same `<sp-link>` to
the same state, carrying the same `href="#/components"` without an option to
say so.

| your case                                                      | form                              |
| -------------------------------------------------------------- | --------------------------------- |
| the element takes an `href` you can bind in the template       | `href=${srefHref(...)}`           |
| the `href` goes somewhere else — a property, a nested slot     | `uiSref` with `assignHref`        |
| a reader outside the browser must see the link (SSR, a linter) | `href=${srefHref(...)}`           |
| you are already on `uiSref` and it works                       | leave it — the two are equivalent |

Both navigate on click, both announce their target to an enclosing
`uiSrefActive`, and both accept the same state, params and transition
options. Use one or the other on an element, never both. The server-side
reasons are in
[Server-Side Routing](./server-route-matching#links-a-server-renderer-can-read).

The active-status pair splits the same way.
[`srefActiveClass`](/reference/lit-ui-router/directives/srefActiveClass) follows lit's
[`classMap`](https://lit.dev/docs/templates/directives/#classmap) contract —
bound in `class`, toggling only the classes it names — and
[`srefAriaCurrent`](/reference/lit-ui-router/directives/srefAriaCurrent) covers the
`aria-current` a `class` binding cannot reach. A `class` attribute holds one
toggling directive, so `srefActiveClass` cannot share it with `classMap`:
pass what `classMap` would have taken as `classes` instead.

```ts
html`<sp-link
  href=${srefHref('components')}
  class=${srefActiveClass({
    state: 'components',
    activeClasses: ['active'],
    classes: { 'nav-link': true, disabled: this.locked },
  })}
  aria-current=${srefAriaCurrent({ state: 'components' })}
  >Components</sp-link
>`;
```

When a component wants plain `classMap` and its own bindings,
[`SrefStatusController`](/reference/lit-ui-router/controllers/SrefStatusController)
hands the status to the host instead of writing an attribute — see
[Active-link status](./reactive-components#active-link-status).

## Setting up the example

The [example](https://github.com/simshanith/lit-ui-router/tree/main/examples/design-system-links)
is a standalone Vite app using Adobe Spectrum Web Components
(`@spectrum-web-components/link` and `@spectrum-web-components/theme`). See
[`examples/design-system-links/src`](https://github.com/simshanith/lit-ui-router/tree/main/examples/design-system-links/src)
for the complete `<sp-theme>` setup and lazy light/dark theme loader that
follows the page's color scheme. The live demo above follows this page's
appearance toggle as well as your OS setting because a page that sets
`color-scheme` propagates it to a same-origin `<iframe>`, flipping the embedded
document's `prefers-color-scheme` with the docs theme.

Nothing about the pairing is Spectrum-specific: any link-shaped custom element
takes the same option.
