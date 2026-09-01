# lit-ui-router/anchor-is-valid

📝 Lit-a11y's anchor-is-valid, wrapped so a uiSref element part counts as the href it assigns at runtime.

💼 This rule is enabled in the ✅ `recommended` config.

<!-- end auto-generated rule header -->

`<a ${uiSref('state')}>` carries no static `href` — the element-part directive assigns one at runtime — so the stock [lit-a11y rule](https://github.com/open-wc/open-wc/blob/master/packages/eslint-plugin-lit-a11y/docs/rules/anchor-is-valid.md) reports every correct call site. This wrap suppresses exactly those reports and nothing else: an anchor with neither an `href` nor a directive still reports, and so does `assignHref: false`, where the base rule is right for the right reason.

An anchor counts as navigable when its `uiSref` is imported from `lit-ui-router` (a foreign package's `uiSref` proves nothing) and the call doesn't opt out of href assignment — only a literal `assignHref: false` is a definite no; `'auto'` assigns on a native `<a>`, and a non-literal option is unknowable, so both stay suppressed rather than guessed.

## Examples

Correct — the directive assigns the `href` at runtime:

```js
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

html`<a ${uiSref('home')}>Home</a>`;
```

Incorrect — still reported, exactly as the base rule would:

```js
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

html`<a>Home</a>`;
html`<a @click=${() => {}}>Home</a>`;
html`<a ${uiSref('home', undefined, { assignHref: false })}>Home</a>`;
```

## Options

The base rule's options pass through untouched.

<!-- begin auto-generated rule options list -->

| Name        | Type     | Default |
| :---------- | :------- | :------ |
| `allowHash` | Boolean  | `true`  |
| `aspects`   | String[] |         |

<!-- end auto-generated rule options list -->
