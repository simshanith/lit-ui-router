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

| Directive      | Position     |
| -------------- | ------------ |
| `uiSref`       | element part |
| `uiSrefActive` | element part |

Both of today's directives are element-part directives, but the rule is built around the table rather than that coincidence: an attribute-part directive would get its own row, and only its own positions would be accepted.

## What reports

Any `uiSref` / `uiSrefActive` call that is an expression of a lit template but is not the bare `${…}` inside a tag:

- an attribute value — `href=${uiSref('home')}`
- a property, event or boolean binding — `.href=${…}`, `@click=${…}`, `?hidden=${…}`
- a child position — `<nav>${uiSrefActive({})}</nav>`
- an interpolation inside a quoted attribute — `class="link ${uiSref('home')}"`

## What is exempt

A call outside any lit template. `const part = uiSref('home')` says nothing about where the result lands, and guessing there would be false positives rather than coverage — the template expression that consumes it is where this rule looks.

## Examples

Incorrect:

```js
import { html } from 'lit';
import { uiSref, uiSrefActive } from 'lit-ui-router';

html`<a href=${uiSref('home')}>Home</a>`;
html`<nav>${uiSrefActive({})}</nav>`;
```

Correct:

```js
import { html } from 'lit';
import { uiSref, uiSrefActive } from 'lit-ui-router';

html`<a ${uiSref('home')} ${uiSrefActive({})}>Home</a>`;
```

There is no fix: the call is fine, the position is not, and only the author knows which element was meant.
