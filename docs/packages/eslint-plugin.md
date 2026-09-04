---
title: ESLint Plugin
description: Directive-aware linting with eslint-plugin-lit-ui-router — four rules covering hrefless anchors, inert hrefs, aria-current conflicts and misplaced directives, where a uiSref element part counts as the href it assigns at runtime
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
plugin instead ships its own copy of the base rule, taught that the directive
counts as the `href` it assigns, and reports everything the base rule would
otherwise still catch.

That vendored rule is the origin story rather than the whole package. The
other three cover the mistakes the directives make _possible_, rather than the
ones they mask: an `href` written to an element that has none, an
`aria-current` the directive silently takes over, and a directive used outside
the part type it accepts.

::: warning Release candidate
The current release is `1.0.0-rc.2`, published under the `rc` dist-tag: the
API shape is final and covered by tests, but the stable number waits on the
[1.0 bar](https://github.com/simshanith/lit-ui-router/issues/667). Install it
as `eslint-plugin-lit-ui-router@rc` until it moves to `latest`.
:::

## Installation

```bash
pnpm add -D eslint-plugin-lit-ui-router@rc
# or
npm install --save-dev eslint-plugin-lit-ui-router@rc
```

`eslint` (`^9.0.0 || ^10.0.0`) is the only **peer** dependency.
`anchor-is-valid` is vendored from
[`eslint-plugin-lit-a11y`](https://www.npmjs.com/package/eslint-plugin-lit-a11y)
rather than wrapped around it, so lit-a11y is an **optional sibling** you may
also run for the rest of its rules, never a requirement.

The package is published as ESM only. Flat config loads ESM natively; a
CommonJS config can `require()` it on Node `^20.19.0` or `>=22.12.0`.

## Usage

Flat config (`eslint.config.js`), with lit-a11y alongside:

```js
import litA11y from 'eslint-plugin-lit-a11y';
import litUiRouter from 'eslint-plugin-lit-ui-router';

export default [
  litA11y.configs.recommended,
  ...litUiRouter.configs.recommended,
];
```

Order matters: `configs.recommended` must come **after** lit-a11y's own
config, because it turns `lit-a11y/anchor-is-valid` off in favor of ours. It
deliberately does not register the `lit-a11y` plugin key itself — the host's
instance owns it. Without lit-a11y installed that `off` line is simply inert,
so the ordering rule costs nothing either way.

## The rules

| Rule                                                                                                                                                            | What it catches                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`anchor-is-valid`](https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/docs/rules/anchor-is-valid.md)                   | an anchor with no `href` — where a `uiSref` element part counts as one                                                                    |
| [`sref-assign-href`](https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/docs/rules/sref-assign-href.md)                 | an inert `href` written to a `<button>`, `<tr>` or `<div>`; fix adds `'auto'`                                                             |
| [`sref-active-aria-current`](https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/docs/rules/sref-active-aria-current.md) | an authored `aria-current` the directive silently takes over and later removes                                                            |
| [`directive-position`](https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/docs/rules/directive-position.md)             | a directive outside the part type it accepts — `uiSref` and `uiSrefActive` are element-part only, and throw on first render anywhere else |

All four are in `configs.recommended` at `error`. The last three are the
directives' own runtime development warnings and throw, said statically: they
report at author time, across the whole codebase, and in a production build —
where the runtime says nothing at all.

Every rule is syntax-only, with no type information, so they also load into
[oxlint](https://oxc.rs) as JS plugins.

## What `anchor-is-valid` does

`lit-ui-router/anchor-is-valid` is lit-a11y's `anchor-is-valid`, vendored from
`eslint-plugin-lit-a11y@5.1.1` and extended so a `uiSref` element part counts
as the href it assigns at runtime. lit-a11y is an optional sibling you may
also run, not a dependency — our `recommended` turns its copy off so only one
of them reports. The extension suppresses exactly those reports and nothing
else:

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
options (`allowHash`, `aspects`) are carried over untouched.

The generated
[rule documentation](https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/docs/rules/anchor-is-valid.md)
is the reference: every example above, the option table, and the
configuration the rule ships in.

## Example

[`examples/lint-eslint`](https://github.com/simshanith/lit-ui-router/tree/main/examples/lint-eslint)
is the consumer wiring, installed from npm exactly as a consumer would:
`eslint.config.js` spreads `litA11y.configs.recommended` first and
`...litUiRouter.configs.recommended` after, and a local Vite plugin runs
ESLint's Node API at build time and renders the result in the page — a custom
panel and an iframe of ESLint's own `html` formatter, over the same results.

`src/violations.ts` is a gallery with one deliberate violation per
`recommended` rule, so the report is not empty: the embed below is that built
page, and its report is static (`4 problems`, one per rule, each rule id
linked to its docs). Open it on StackBlitz to edit the sources and watch the
report re-run.

<LiveExample name="lint-eslint" />

For the positive control, delete `${uiSref('eslint-html')}` from the second
tab in `src/main.ts`: `lit-ui-router/anchor-is-valid` now reports against the
app itself rather than the gallery, as an error — and the tab stops
navigating, which is the whole reason the rule exists.

- [Open on StackBlitz](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/lint-eslint)
- [Source on GitHub](https://github.com/simshanith/lit-ui-router/tree/main/examples/lint-eslint)

## Semver policy

Following ESLint core's own policy: a change that makes `recommended` or an
existing rule stricter — new reports on code that previously passed — ships
as a **major**. The option-aware tier widened `recommended` before 1.0.0,
while the package is still a release candidate and a widening costs nobody a
major; the remaining roadmap (a state-aware tier) is the same trajectory, so
expect majors rather than silent tightening, and pin accordingly.

## Status

- **npm**:
  [`eslint-plugin-lit-ui-router`](https://npmx.dev/package/eslint-plugin-lit-ui-router)
  — `1.0.0-rc.2` on `rc`. `latest` still points at the empty seed publish
  until the stable release lands.
- **Source**:
  [`packages/eslint-plugin-lit-ui-router`](https://github.com/simshanith/lit-ui-router/tree/main/packages/eslint-plugin-lit-ui-router)
  — the four rules, their tests, and the generated rule docs.
- **Dogfood**: this repository's own lint run uses the plugin against the
  sample apps, where every navigation anchor is a `uiSref` call site, and
  `examples/lint-eslint` exercises every `recommended` rule from an
  npm-installed copy.
- **Next**: the [1.0 bar](https://github.com/simshanith/lit-ui-router/issues/667)
  — registry-install verification at both ends of the peer range, and the
  decision on which rule tiers `recommended` carries at 1.0.

## Further reading

- [Design System Links](/guides/design-system-links) — what `uiSref` does to
  an anchor, and why the href only exists at runtime
- [`uiSref` API](/api/reference/directives/uiSref) — the directive itself,
  including `assignHref`
