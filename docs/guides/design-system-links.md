---
title: Design System Links
description: "Driving a design system's link component with uiSref, and why assignHref: true is the option for it"
---

# Design System Links

Your design system almost certainly ships a link component —
[`<sp-link>`](https://opensource.adobe.com/spectrum-web-components/components/link/),
`<md-*>`, Shoelace's `<sl-...>`, or an in-house one. It is a custom element
that declares its own `href` property and renders an anchor inside its shadow
root. It is a link in every way that matters to a reader, and in no way that
matters to `document.querySelector('a')`.

[`uiSref`](/api/reference/directives/uiSref) drives it, but the `href` needs
one option: **`assignHref: true`**.

```ts
html`<sp-link ${uiSref('components', {}, { assignHref: true })}
  >Components</sp-link
>`;
```

<LiveExample name="design-system-links" />

## Why `'auto'` refuses it

[`assignHref`](/api/reference/types/UiSrefOptions) decides where the
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

The example above stages all three cases side by side and prints each
element's live `href` attribute:

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
  [`uiSrefActive`](/api/reference/directives/uiSrefActive) can mark it with
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

::: tip Under lit's development build
`assignHref: true` on a non-anchor logs a one-time console warning naming
`'auto'` as the fix, because it cannot know your element forwards `href`. The
warning is gated to lit's dev build; production builds are silent. Pass
`false` and set the property yourself if you would rather not see it.
:::

## Setting up the example

The [example](https://github.com/simshanith/lit-ui-router/tree/main/examples/design-system-links)
is a standalone Vite app that installs Spectrum Web Components from npm:

```bash
npm install @spectrum-web-components/link @spectrum-web-components/theme
```

```ts
import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/theme-light.js';
import '@spectrum-web-components/theme/scale-medium.js';
import '@spectrum-web-components/link/sp-link.js';
```

Spectrum's components need a theme ancestor, so the router lives inside one:

```ts
render(
  html`
    <sp-theme system="spectrum" color="light" scale="medium">
      <ui-router .uiRouter=${router}>
        <app-root></app-root>
      </ui-router>
    </sp-theme>
  `,
  document.getElementById('root')!,
);
```

Nothing about the pairing is Spectrum-specific: any link-shaped custom element
takes the same option.
