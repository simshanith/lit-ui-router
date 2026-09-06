# lit-ui-router/anchor-is-valid

📝 Anchor-is-valid for lit templates, where a uiSref element part counts as the href it assigns at runtime.

💼 This rule is enabled in the ✅ `recommended` config.

<!-- end auto-generated rule header -->

`<a ${uiSref('state')}>` carries no static `href` — the element-part directive assigns one at runtime — so the stock [lit-a11y rule](https://github.com/open-wc/open-wc/blob/master/packages/eslint-plugin-lit-a11y/docs/rules/anchor-is-valid.md) reports every correct call site. This rule is that one, vendored from `eslint-plugin-lit-a11y@5.1.1` and extended: an element-part `uiSref` counts as the `href` it assigns. Nothing else changes — an anchor with neither an `href` nor a directive still reports, and so does `assignHref: false`, where the base rule is right for the right reason. The `noHref` / `invalidHref` / `preferButton` aspects, the `allowHash` option and the three message ids are all the upstream ones, so a host moving off lit-a11y's rule changes nothing but the rule name. The [`settings.litHtmlSources` gating](../../README.md#settings) is upstream's too, with one stricter edge: an `html` alias or namespace only counts when imported from a listed source, where lit-a11y accepts one from any import once the file is gated in.

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

## Link elements

The rule checks `<a>`. A design-system link — `<sp-link>`, `<my-link>` — is a custom element, and only its author knows it forwards `href` to an internal anchor, so nothing is checked there by default. Declare the tags and they are checked exactly as an `<a>` is:

```js
export default [
  ...litUiRouter.configs.recommended,
  { settings: { linkElements: ['sp-link'] } },
];
```

[`settings.linkElements`](../../README.md#settings) is shared with [`sref-assign-href`](./sref-assign-href.md) — declare once and both rules stop guessing. A `linkElements` option on this rule replaces the setting for this rule, wholesale; `[]` means "declare nothing here".

One asymmetry with `<a>`: `assignHref: 'auto'` tests the tag name against HTML's link elements, and a declaration does not join that set, so on a declared link element `'auto'` assigns nothing and the element reports as dead. Keep the `true` default there — which is what `sref-assign-href` already asks for.

```js
html`<sp-link ${uiSref('home')}>Home</sp-link>`; // ok, the default assigns
html`<sp-link>Home</sp-link>`; // noHref
html`<sp-link ${uiSref('home', undefined, { assignHref: 'auto' })}>Home</sp-link>`; // noHref
```

## Options

The base rule's options, unchanged, plus `linkElements`.

<!-- begin auto-generated rule options list -->

| Name           | Description                                                                              | Type     | Default |
| :------------- | :--------------------------------------------------------------------------------------- | :------- | :------ |
| `allowHash`    | Whether a bare `#` counts as a valid href.                                               | Boolean  | `true`  |
| `aspects`      | Which anchor checks are active.                                                          | String[] |         |
| `linkElements` | Element tags to treat as link elements, replacing `settings.linkElements` for this rule. | String[] |         |

<!-- end auto-generated rule options list -->
