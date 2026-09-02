# eslint-plugin-lit-ui-router

[![npm version](https://img.shields.io/npm/v/eslint-plugin-lit-ui-router.svg)](https://npmx.dev/package/eslint-plugin-lit-ui-router)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=eslint-plugin-lit-ui-router@*)](https://github.com/simshanith/lit-ui-router/releases/?q=eslint-plugin-lit-ui-router)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev/packages/eslint-plugin)

ESLint rules that understand [lit-ui-router](https://lit-ui-router.dev) directives.

A lit-ui-router anchor carries no static `href` — the element-part directive assigns one at runtime — so stock accessibility rules report every correct call site. These rules keep the base rules' real coverage while understanding what the directives do.

The rest are the directives' own runtime dev warnings, statically: the inert `href` on a native non-link, the silent `aria-current` takeover, and the element-part-only constructor throw. Each reports at author time, on the whole codebase, in a production build — where the runtime says nothing.

## Install

```sh
npm install --save-dev eslint-plugin-lit-ui-router
```

`eslint` (`^9.0.0 || ^10.0.0`) is the only peer dependency. `anchor-is-valid` is vendored from [`eslint-plugin-lit-a11y`](https://github.com/open-wc/open-wc/tree/master/packages/eslint-plugin-lit-a11y), not wrapped around it: lit-a11y is an **optional sibling** you may also run, never a requirement.

## Usage

Flat config (`eslint.config.js`):

```js
import litUiRouter from 'eslint-plugin-lit-ui-router';

export default [...litUiRouter.configs.recommended];
```

With lit-a11y alongside, `configs.recommended` must come **after** lit-a11y's config: it turns `lit-a11y/anchor-is-valid` off in favor of ours, which reports the same three messages plus the `uiSref` carve-out.

```js
import litA11y from 'eslint-plugin-lit-a11y';
import litUiRouter from 'eslint-plugin-lit-ui-router';

export default [
  litA11y.configs.recommended,
  ...litUiRouter.configs.recommended,
];
```

Without lit-a11y installed, that `off` line is inert — flat config accepts a severity for an unregistered plugin's rule — so there is nothing to change either way.

## oxlint (alpha)

The rules also load into [oxlint](https://oxc.rs) as JS plugins — every one is syntax-only, with no type information. oxlint does not consume `configs.recommended`, so list them explicitly in `.oxlintrc.json`:

```json
{
  "jsPlugins": ["eslint-plugin-lit-ui-router"],
  "rules": {
    "lit-ui-router/anchor-is-valid": "error",
    "lit-ui-router/directive-position": "error",
    "lit-ui-router/sref-active-aria-current": "error",
    "lit-ui-router/sref-assign-href": "error"
  }
}
```

No lit-a11y `off` line is needed: oxlint ships no lit-a11y rules. `eslint` is imported type-only, so an oxlint-only host does not need ESLint installed.

oxlint's `jsPlugins` is alpha and explicitly outside semver. This package's `test:oxlint` lane gates against the **exact pinned oxlint version** in its own devDependencies and claims nothing beyond it; a break in a later oxlint surfaces on that bump, not in your lint run.

## Running ESLint and oxlint together

ESLint-only, oxlint-only and both-at-once are all supported. If you run both, the recommended split is **oxlint owns every `lit-ui-router/*` rule** — it is the fast lane, and one report is better than two — while ESLint keeps only the lit-a11y `off`.

`.oxlintrc.json` — the rules run here:

```json
{
  "jsPlugins": ["eslint-plugin-lit-ui-router"],
  "rules": {
    "lit-ui-router/anchor-is-valid": "error",
    "lit-ui-router/directive-position": "error",
    "lit-ui-router/sref-active-aria-current": "error",
    "lit-ui-router/sref-assign-href": "error"
  }
}
```

`eslint.config.js` — **do not** spread `configs.recommended`; turn lit-a11y's rule off by hand:

```js
import litA11y from 'eslint-plugin-lit-a11y';
import oxlint from 'eslint-plugin-oxlint';

export default [
  litA11y.configs.recommended,
  {
    // oxlint owns every lit-ui-router/* rule; this displaces lit-a11y's.
    rules: { 'lit-a11y/anchor-is-valid': 'off' },
  },
  oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
];
```

The manual `off` is the whole trick: `eslint-plugin-oxlint` de-duplicates only oxlint's **native** rule names, and has no handling for `jsPlugins` rules at all. Spreading `configs.recommended` on top of the oxlint lane would register all four rules a second time, and every finding would report twice.

This repository runs exactly this split — see [`.oxlintrc.json`](../../.oxlintrc.json) and [`eslint.config.ts`](../../eslint.config.ts).

Optionally, exempt test fixtures, whose elements exist to be driven rather than shipped, and whose specs often import `uiSref` by relative path (which the rule cannot recognise as ours):

```json
{
  "overrides": [
    {
      "files": ["**/*.spec.ts", "**/src/specs/**"],
      "rules": {
        "lit-ui-router/anchor-is-valid": "off",
        "lit-ui-router/sref-assign-href": "off"
      }
    }
  ]
}
```

## Rules

<!-- begin auto-generated rules list -->

💼 Configurations enabled in.\
✅ Set in the `recommended` configuration.\
🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).

| Name                                                               | Description                                                                                             | 💼 | 🔧 |
| :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :- | :- |
| [anchor-is-valid](docs/rules/anchor-is-valid.md)                   | anchor-is-valid for lit templates, where a uiSref element part counts as the href it assigns at runtime | ✅  |    |
| [directive-position](docs/rules/directive-position.md)             | require each lit-ui-router directive to sit in the template position its part type allows               | ✅  |    |
| [sref-active-aria-current](docs/rules/sref-active-aria-current.md) | disallow an authored aria-current on an element a uiSrefActive element part manages                     | ✅  | 🔧 |
| [sref-assign-href](docs/rules/sref-assign-href.md)                 | require assignHref: 'auto' when a uiSref element part rides a native element with no href               | ✅  | 🔧 |

<!-- end auto-generated rules list -->

## Semver policy

Following ESLint core's own policy: a change that makes `recommended` or an existing rule stricter — new reports on code that previously passed — ships as a **major**. The option-aware tier (`sref-assign-href`, `sref-active-aria-current`, `directive-position`) widened `recommended` before 1.0.0, while the package is still a release candidate and a widening costs nobody a major. The remaining roadmap (a state-aware tier) is the same trajectory, so expect majors, not silent tightening.

## Module format and Node support

Published as ESM only. Flat config loads ESM natively; a CommonJS config can `require()` this package on Node `^20.19.0` or `>=22.12.0`. The `engines` range mirrors what the ESLint peer range itself supports, not this repository's own Node version.

## The template-analyzer deep import

The rule imports `eslint-plugin-lit/lib/template-analyzer.js`, a path with no `exports`-map guarantee, against `eslint-plugin-lit@^2.0.0` (a regular dependency, installed for you). That is the same path and range `eslint-plugin-lit-a11y` itself relies on — a break there breaks lit-a11y first — and this package's test suite runs against the pinned floor versions, so a break surfaces on the bump, not in your lint run.
