---
title: ESLint Plugin
description: Directive-aware accessibility linting with eslint-plugin-lit-ui-router — lit-a11y's anchor-is-valid, wrapped so a uiSref element part counts as the href it assigns at runtime
---

# eslint-plugin-lit-ui-router

<p class="badges">
<a href="https://npmx.dev/package/eslint-plugin-lit-ui-router" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/eslint-plugin-lit-ui-router" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=eslint-plugin-lit-ui-router" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=eslint-plugin-lit-ui-router@*" /></a>
</p>

[`eslint-plugin-lit-ui-router`](https://npmx.dev/package/eslint-plugin-lit-ui-router)
is a small set of ESLint rules that understand lit-ui-router's directives.

A lit-ui-router anchor carries no static `href` — the
[`uiSref`](/api/reference/directives/uiSref) element part assigns one at
runtime — so stock accessibility rules report every correct call site. The
usual escape is to disable the rule, which costs its real coverage. This
plugin instead wraps the base rule so the directive counts as the `href` it
assigns, and reports everything the base rule would otherwise still catch.

::: warning Release candidate
The current release is `1.0.0-rc.0`, published under the `rc` dist-tag: the
API shape is final and covered by tests, but the stable number waits on the
[1.0 bar](https://github.com/simshanith/lit-ui-router/issues/667). Install it
as `eslint-plugin-lit-ui-router@rc` until it moves to `latest`.
:::

## Installation

```bash
pnpm add -D eslint-plugin-lit-ui-router@rc eslint-plugin-lit-a11y
# or
npm install --save-dev eslint-plugin-lit-ui-router@rc eslint-plugin-lit-a11y
```

`eslint` (`^9.0.0 || ^10.0.0`) and
[`eslint-plugin-lit-a11y`](https://www.npmjs.com/package/eslint-plugin-lit-a11y)
(`^5.0.0`) are **peer** dependencies, not bundled ones: the plugin extends the
host's copy of the base rule, and a duplicated instance would be the
shadowed-copy class of bug — two rule objects, one config key, and reports
from whichever copy won.

The package is published as ESM only. Flat config loads ESM natively; a
CommonJS config can `require()` it on Node `^20.19.0` or `>=22.12.0`.

## Usage

Flat config (`eslint.config.js`):

```js
import litA11y from 'eslint-plugin-lit-a11y';
import litUiRouter from 'eslint-plugin-lit-ui-router';

export default [
  litA11y.configs.recommended,
  ...litUiRouter.configs.recommended,
];
```

Order matters: `configs.recommended` must come **after** lit-a11y's own
config, because it turns `lit-a11y/anchor-is-valid` off in favor of the
wrapped rule. It deliberately does not register the `lit-a11y` plugin key
itself — the host's instance owns it.

## What the rule does

`lit-ui-router/anchor-is-valid` is lit-a11y's `anchor-is-valid`, wrapped so a
`uiSref` element part counts as the href it assigns at runtime. It suppresses
exactly those reports and nothing else:

```js
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

// Fine: the directive assigns the href.
html`<a ${uiSref('home')}>Home</a>`;

// Still reported, exactly as the base rule would.
html`<a>Home</a>`;
html`<a @click=${() => {}}>Home</a>`;
html`<a ${uiSref('home', undefined, { assignHref: false })}>Home</a>`;
```

An anchor counts as navigable when its `uiSref` is imported from
`lit-ui-router` — a foreign package's `uiSref` proves nothing — and the call
doesn't opt out of href assignment. Only a literal `assignHref: false` is a
definite no: `'auto'` assigns on a native `<a>`, and a non-literal option is
unknowable, so both stay suppressed rather than guessed. The base rule's
options (`allowHash`, `aspects`) pass through untouched.

The generated
[rule documentation](https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/docs/rules/anchor-is-valid.md)
is the reference: every example above, the option table, and the
configuration the rule ships in.

## Semver policy

Following ESLint core's own policy: a change that makes `recommended` or an
existing rule stricter — new reports on code that previously passed — ships
as a **major**. The roadmap (option-aware and state-aware rule tiers) is
exactly that trajectory, so expect majors rather than silent tightening, and
pin accordingly.

## Status

- **npm**:
  [`eslint-plugin-lit-ui-router`](https://npmx.dev/package/eslint-plugin-lit-ui-router)
  — `1.0.0-rc.0` on `rc`. `latest` still points at the empty seed publish
  until the stable release lands.
- **Source**:
  [`packages/eslint-plugin-lit-ui-router`](https://github.com/simshanith/lit-ui-router/tree/main/packages/eslint-plugin-lit-ui-router)
  — the rule, its tests, and the generated rule docs.
- **Dogfood**: this repository's own lint run uses the plugin against the
  sample apps, where every navigation anchor is a `uiSref` call site.
- **Next**: the [1.0 bar](https://github.com/simshanith/lit-ui-router/issues/667)
  — registry-install verification at both ends of the peer range, and the
  decision on which rule tiers `recommended` carries at 1.0.

## Further reading

- [Design System Links](/guides/design-system-links) — what `uiSref` does to
  an anchor, and why the href only exists at runtime
- [`uiSref` API](/api/reference/directives/uiSref) — the directive itself,
  including `assignHref`
