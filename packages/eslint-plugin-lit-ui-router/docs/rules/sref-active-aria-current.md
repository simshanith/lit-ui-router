# lit-ui-router/sref-active-aria-current

📝 Disallow an authored aria-current on an element a uiSrefActive element part manages.

💼 This rule is enabled in the ✅ `recommended` config.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

[`uiSrefActive`](https://lit-ui-router.dev/api/reference/directives/uiSrefActive) sets `aria-current` while its state is active and **removes** the attribute when the state goes inactive — including an `aria-current` the author wrote. Taking over is deliberate (restoring the old value would leave an inactive link asserting `aria-current="page"`), but it is silent, and the loss only surfaces a navigation later. The runtime warns once in lit's development build; this rule says the same thing at author time.

The fix is the runtime's own: `ariaCurrentValue: false` keeps the attribute under the app's control, and the directive stops touching it.

## What is exempt

- **No authored `aria-current`** — nothing is taken over.
- **`ariaCurrentValue: false`** — the opt-out.
- **A non-literal params argument, a spread, or a non-literal `ariaCurrentValue`** — unknowable statically, so it stays suppressed rather than guessed.

An explicit non-`false` `ariaCurrentValue` still reports — the takeover is real — but carries no fix: rewriting a deliberate choice is not this rule's business.

## Examples

Incorrect:

```js
import { html } from 'lit';
import { uiSrefActive } from 'lit-ui-router';

html`<a href="/home" aria-current="page" ${uiSrefActive({})}>Home</a>`;
html`<a href="/home" aria-current=${current} ${uiSrefActive({ activeClasses: 'on' })}>Home</a>`;
```

Correct:

```js
import { html } from 'lit';
import { uiSrefActive } from 'lit-ui-router';

// let the directive own it
html`<a href="/home" ${uiSrefActive({})}>Home</a>`;
// or keep it yourself
html`<a href="/home" aria-current="page" ${uiSrefActive({ ariaCurrentValue: false })}>Home</a>`;
```

## Fix

The fix adds `ariaCurrentValue: false` to the params literal, creating one when the call has no argument:

```diff
-html`<a href="/home" aria-current="page" ${uiSrefActive()}>Home</a>`;
+html`<a href="/home" aria-current="page" ${uiSrefActive({ ariaCurrentValue: false })}>Home</a>`;
```

If the authored attribute was the oversight rather than the directive, delete the attribute instead.
