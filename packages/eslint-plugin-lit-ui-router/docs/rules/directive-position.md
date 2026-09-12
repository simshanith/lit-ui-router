# lit-ui-router/directive-position

📝 Require each lit-ui-router directive to sit in the template position its part type allows.

💼 This rule is enabled in the ✅ `recommended` config.

<!-- end auto-generated rule header -->

Every lit directive accepts exactly one part type and throws in its constructor for any other:

```text
The `uiSref` directive must be used as an element
```

That is a render-time crash, not a degraded render, and it is entirely visible in the source. This rule catches it in the lint run.

## Allowed positions

| Directive         | Position                                              |
| ----------------- | ----------------------------------------------------- |
| `uiSref`          | element part                                          |
| `uiSrefActive`    | element part                                          |
| `srefHref`        | attribute part, the whole value                       |
| `srefActiveClass` | attribute part, the `class` attribute, one expression |
| `srefAriaCurrent` | attribute part, the whole value                       |

The element-part and attribute-part directives are siblings, and the position each accepts is the table, not a coincidence of what shipped first. `srefActiveClass` follows [`classMap`](https://lit.dev/docs/api/directives/#classMap): it keeps the static classes written around it, so it only has to be the *only* expression in the attribute, where `srefHref` and `srefAriaCurrent` have to be the whole value.

## What reports

An element-part directive that is an expression of a lit template but is not the bare `${…}` inside a tag:

- an attribute value — `href=${uiSref('home')}`
- a property, event or boolean binding — `.href=${…}`, `@click=${…}`, `?hidden=${…}`
- a child position — `<nav>${uiSrefActive({})}</nav>`
- an interpolation inside a quoted attribute — `class="link ${uiSref('home')}"`

An attribute-part directive anywhere but the attribute it accepts:

- an element part — `<a ${srefHref('home')}>`
- a child position — `<nav>${srefHref('home')}</nav>`
- a property, event or boolean binding, which are their own part types — `.href=${srefHref('home')}`
- an attribute it shares with text or another expression — `href="/app${srefHref('home')}"`
- for `srefActiveClass`, any attribute but `class` — `part=${srefActiveClass({})}`

## What is exempt

A call outside any lit template. `const part = uiSref('home')` says nothing about where the result lands, and guessing there would be false positives rather than coverage — the template expression that consumes it is where this rule looks.

## Examples

Incorrect:

```js
import { html } from 'lit';
import { srefActiveClass, srefHref, uiSref, uiSrefActive } from 'lit-ui-router';

html`<a href=${uiSref('home')}>Home</a>`;
html`<nav>${uiSrefActive({})}</nav>`;
html`<a ${srefHref('home')}>Home</a>`;
html`<a part=${srefActiveClass({})}>Home</a>`;
```

Correct:

```js
import { html } from 'lit';
import {
  srefActiveClass,
  srefAriaCurrent,
  srefHref,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';

html`<a ${uiSref('home')} ${uiSrefActive({})}>Home</a>`;
html`<a
  href=${srefHref('home')}
  class="nav-link ${srefActiveClass({ state: 'home' })}"
  aria-current=${srefAriaCurrent({ state: 'home' })}
  >Home</a
>`;
```

There is no fix: the call is fine, the position is not, and only the author knows which element was meant.
