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

::: tip Under the development build
`assignHref: true` on a non-anchor logs a one-time console warning naming
`'auto'` as the fix, because it cannot know your element forwards `href`. It
is gated on both this package's development build and lit's own, and the
message text is not present in a production bundle at all — see
[Development & Production Builds](./development-builds). Pass `false` and set
the property yourself if you would rather not see it in development.
:::

## Element part or attribute part

`assignHref` exists because `uiSref` is an **element part**: it sits on the
element and writes the `href` from the outside, so it needs a rule for where
to write. [`srefHref`](/api/reference/directives/srefHref) is the same link
bound as an **attribute part** — it _is_ the `href`, so there is no
`assignHref` and no rule to pick. The attribute is written wherever it was
bound:

```ts
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
[`srefActiveClass`](/api/reference/directives/srefActiveClass) follows lit's
[`classMap`](https://lit.dev/docs/templates/directives/#classmap) contract —
bound in `class`, toggling only the classes it names — and
[`srefAriaCurrent`](/api/reference/directives/srefAriaCurrent) covers the
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
[`SrefStatusController`](/api/reference/controllers/SrefStatusController)
hands the status to the host instead of writing an attribute — see
[Active-link status](./reactive-components#active-link-status).

## Setting up the example

The [example](https://github.com/simshanith/lit-ui-router/tree/main/examples/design-system-links)
is a standalone Vite app that installs Spectrum Web Components from npm:

```bash
npm install @spectrum-web-components/link @spectrum-web-components/theme
```

```ts
import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/scale-medium.js';
import '@spectrum-web-components/link/sp-link.js';
```

Spectrum's components need a theme ancestor, so the router lives inside one.
`sp-theme` takes a literal color stop — `lightest`, `light`, `dark`, or
`darkest`, with no `auto` — so following the reader's OS preference is the
app's job.

Each stop is a separate theme fragment, and importing it is what registers it
with `sp-theme`. Import both statically and every reader downloads a stop they
will never see; load them on demand and only the one in use ships, with the
other arriving on its own chunk if the preference ever flips. A reactive
controller owns both halves — the media query and the fragment:

```ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';

const themeFragments = {
  light: () => import('@spectrum-web-components/theme/theme-light.js'),
  dark: () => import('@spectrum-web-components/theme/theme-dark.js'),
} satisfies Record<string, () => Promise<unknown>>;

export type ThemeColor = keyof typeof themeFragments;

export class ColorSchemeController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #query = window.matchMedia('(prefers-color-scheme: dark)');
  readonly #loaded = new Set<ThemeColor>();
  #applied?: ThemeColor;

  constructor(host: ReactiveControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  /** the preferred stop, once its fragment is registered */
  get color(): ThemeColor | undefined {
    return this.#applied;
  }

  get #preferred(): ThemeColor {
    return this.#query.matches ? 'dark' : 'light';
  }

  hostConnected(): void {
    this.#query.addEventListener('change', this.#onChange);
    void this.#adopt();
  }

  hostDisconnected(): void {
    this.#query.removeEventListener('change', this.#onChange);
  }

  readonly #onChange = () => void this.#adopt();

  async #adopt(): Promise<void> {
    const wanted = this.#preferred;
    if (!this.#loaded.has(wanted)) {
      try {
        await themeFragments[wanted]();
        this.#loaded.add(wanted);
      } catch (error) {
        // a fragment that never arrives must not blank the app: keep the stop
        // already on screen, or adopt this one unthemed if there is none yet
        console.error(`could not load the ${wanted} theme fragment`, error);
        this.#applied ??= wanted;
        this.#host.requestUpdate();
        return;
      }
    }
    // re-read the query: whatever it says now is what should be on screen
    const preferred = this.#preferred;
    if (this.#loaded.has(preferred)) this.#applied = preferred;
    this.#host.requestUpdate();
  }
}
```

A fragment can also fail to arrive — a stale chunk after a deploy, a flaky
network — and an example that renders nothing until one loads would go blank.
The catch keeps the stop already on screen, or adopts the wanted one unthemed
when there is nothing to fall back to: unstyled chrome beats a blank page, and
a later flip retries the import.

The re-read is what keeps this honest. A fragment that finishes loading applies
the preference as it stands _then_, not the one it was asked for, so overlapping
flips converge on the current scheme without anyone tracking which load started
last — and the stop already on screen stays put while an unloaded one is still
in flight.

The host is an ordinary element that holds the router and waits for a
registered stop, mounted straight from the HTML:

```ts
@customElement('app-shell')
export class AppShell extends LitElement {
  private readonly scheme = new ColorSchemeController(this);

  private readonly router = createRouter();

  render() {
    const { color } = this.scheme;
    // hold the first paint until a stop is registered — sp-theme adopts the
    // one it is told to, and an unregistered stop leaves it nothing to adopt
    if (!color) return nothing;
    return html`
      <sp-theme system="spectrum" color=${color} scale="medium">
        <ui-router .uiRouter=${this.router}>
          <app-root></app-root>
        </ui-router>
      </sp-theme>
    `;
  }
}
```

Chrome around the components reads its colors from Spectrum's own tokens —
`var(--spectrum-gray-800)` for text, `var(--spectrum-gray-300)` for rules —
which inherit through the shadow boundary and re-resolve with the theme.

Reading the preference instead of exposing a theme control of its own buys one
thing worth knowing about: the live example above follows _this page's_
appearance toggle, not just your OS setting. A page that sets `color-scheme`
propagates it to a same-origin `<iframe>`, so the embedded document's
`prefers-color-scheme` flips with the docs theme and the controller re-renders
on the spot — the dark fragment arriving on the first flip. An app with its own
bespoke toggle would have needed the embedding page to plumb the scheme in.

Nothing about the pairing is Spectrum-specific: any link-shaped custom element
takes the same option.
