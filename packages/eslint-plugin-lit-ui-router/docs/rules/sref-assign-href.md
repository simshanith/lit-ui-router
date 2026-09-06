# lit-ui-router/sref-assign-href

📝 Require assignHref: 'auto' when a uiSref element part rides a native element with no href.

💼 This rule is enabled in the ✅ `recommended` config.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

Under the 1.x default (`assignHref: true`), [`uiSref`](https://lit-ui-router.dev/api/reference/directives/uiSref) writes the generated `href` to whatever element carries it. On a `<button>`, `<tr>` or `<div>` that attribute is inert: HTML gives those elements no `href`, so nothing reads it. The runtime notices and warns once, in lit's development build, naming `'auto'` as the fix. This rule is that warning at author time, on the whole codebase, with the fix applied for you.

`'auto'` writes the `href` only where HTML defines one — `<a>`, `<area>`, SVG `<a>` — and becomes the default in 2.0, so the fix is also the migration.

## What is exempt

- **`<a>` and `<area>`** — `'auto'` already writes to them; the default is right.
- **Custom elements** (any tag with a `-`) — `'auto'` tests the tag name, not the shape, so a `<sp-link>` that forwards `href` to an internal anchor wants the `true` default. Only its author can say, so the rule does not guess. See [Design System Links](https://lit-ui-router.dev/guides/design-system-links).
- **Declared link elements** — see below.
- **A non-literal options argument, a spread, or a non-literal `assignHref` value** — unknowable statically, so it stays suppressed rather than guessed. This is the same posture [`anchor-is-valid`](./anchor-is-valid.md) takes.

## Link elements

`<sp-link>` is exempt because the rule cannot tell it apart from `<sp-button>`. [`settings.linkElements`](../../README.md#settings) is how its author says which is which, and it is shared with [`anchor-is-valid`](./anchor-is-valid.md) — declare once, both rules stop guessing:

```js
export default [
  ...litUiRouter.configs.recommended,
  { settings: { linkElements: ['sp-link'] } },
];
```

What a declaration changes:

- **A declared tag is quiet**, the way `<a>` and `<area>` are. It honours an `href`, so the `true` default is right for it — and unlike a native link, `'auto'` would write it *nothing*, so the default is the only right answer. [`anchor-is-valid`](./anchor-is-valid.md) says the other half: a declared link element with `assignHref: 'auto'` reports as a dead link.
- **An undeclared custom element is still exempt.** Declaring `sp-link` is a claim about `sp-link`; it does not turn every other tag in the file into a declared non-link. `<sp-button>` stays unknown, not known-wrong, so the blanket custom-element exemption holds for every tag nobody has declared. That also keeps the shared setting safe to adopt: adding one entry for `anchor-is-valid` never floods this rule with reports.
- **A declared *native* tag is quiet too**, taken at its word. Only `<a>`, `<area>` and SVG `<a>` have an `href` in HTML, so declaring `button` a link element is a claim the runtime cannot make true — `assignHref: true` still writes an inert attribute there. The option is meant for custom elements; a native non-link in the list silences the rule without fixing anything.

## Options

`linkElements` replaces `settings.linkElements` for this rule, wholesale; `[]` means "declare nothing here".

<!-- begin auto-generated rule options list -->

| Name           | Description                                                                              | Type     |
| :------------- | :--------------------------------------------------------------------------------------- | :------- |
| `linkElements` | Element tags to treat as link elements, replacing `settings.linkElements` for this rule. | String[] |

<!-- end auto-generated rule options list -->

## Examples

Incorrect:

```js
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

html`<button ${uiSref('home')}>Home</button>`;
html`<tr ${uiSref('detail', { id: 1 })}>…</tr>`;
html`<div ${uiSref('home', {}, { assignHref: true })}>Home</div>`;
```

Correct:

```js
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

html`<button ${uiSref('home', {}, { assignHref: 'auto' })}>Home</button>`;
// the app writes the attribute itself
html`<div ${uiSref('home', {}, { assignHref: false })}>Home</div>`;
// a native link, and a custom element that forwards href
html`<a ${uiSref('home')}>Home</a>`;
html`<sp-link ${uiSref('home')}>Home</sp-link>`;
```

## Fix

The fix appends `{ assignHref: 'auto' }` as the options argument, adding an empty `{}` params argument first when the call passes only a state:

```diff
-html`<button ${uiSref('home')}>Home</button>`;
+html`<button ${uiSref('home', {}, { assignHref: 'auto' })}>Home</button>`;
```

An existing options literal gains the property, and an explicit `assignHref: true` is rewritten to `'auto'`. Where the intent was `false`, apply that by hand instead — the rule cannot tell an app-managed `href` from an oversight.
