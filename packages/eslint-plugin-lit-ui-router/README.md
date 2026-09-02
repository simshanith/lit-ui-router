# eslint-plugin-lit-ui-router

ESLint rules that understand [lit-ui-router](https://lit-ui-router.dev) directives.

A lit-ui-router anchor carries no static `href` — the element-part directive assigns one at runtime — so stock accessibility rules report every correct call site. These rules keep the base rules' real coverage while understanding what the directives do.

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

The rule also loads into [oxlint](https://oxc.rs) as a JS plugin. oxlint does not consume `configs.recommended`, so list the rule explicitly in `.oxlintrc.json`:

```json
{
  "jsPlugins": ["eslint-plugin-lit-ui-router"],
  "rules": {
    "lit-ui-router/anchor-is-valid": "error"
  }
}
```

No lit-a11y `off` line is needed: oxlint ships no lit-a11y rules. `eslint` is imported type-only, so an oxlint-only host does not need ESLint installed.

oxlint's `jsPlugins` is alpha and explicitly outside semver. This package's `test:oxlint` lane gates against the **exact pinned oxlint version** in its own devDependencies and claims nothing beyond it; a break in a later oxlint surfaces on that bump, not in your lint run.

## Running ESLint and oxlint together

ESLint-only, oxlint-only and both-at-once are all supported. If you run both, the recommended split is **oxlint owns `lit-ui-router/anchor-is-valid`** — it is the fast lane, and one report is better than two — while ESLint keeps only the lit-a11y `off`.

`.oxlintrc.json` — the rule runs here:

```json
{
  "jsPlugins": ["eslint-plugin-lit-ui-router"],
  "rules": {
    "lit-ui-router/anchor-is-valid": "error"
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
    // oxlint owns lit-ui-router/anchor-is-valid; this displaces lit-a11y's.
    rules: { 'lit-a11y/anchor-is-valid': 'off' },
  },
  oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
];
```

The manual `off` is the whole trick: `eslint-plugin-oxlint` de-duplicates only oxlint's **native** rule names, and has no handling for `jsPlugins` rules at all. Spreading `configs.recommended` on top of the oxlint lane would register the rule a second time and every anchor would report twice.

This repository runs exactly this split — see [`.oxlintrc.json`](../../.oxlintrc.json) and [`eslint.config.ts`](../../eslint.config.ts).

Optionally, exempt test fixtures, whose elements exist to be driven rather than shipped, and whose specs often import `uiSref` by relative path (which the rule cannot recognise as ours):

```json
{
  "overrides": [
    {
      "files": ["**/*.spec.ts", "**/src/specs/**"],
      "rules": { "lit-ui-router/anchor-is-valid": "off" }
    }
  ]
}
```

## Rules

<!-- begin auto-generated rules list -->

💼 Configurations enabled in.\
✅ Set in the `recommended` configuration.

| Name                                             | Description                                                                                             | 💼 |
| :----------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :- |
| [anchor-is-valid](docs/rules/anchor-is-valid.md) | anchor-is-valid for lit templates, where a uiSref element part counts as the href it assigns at runtime | ✅  |

<!-- end auto-generated rules list -->

## Semver policy

Following ESLint core's own policy: a change that makes `recommended` or an existing rule stricter — new reports on code that previously passed — ships as a **major**. The roadmap (option-aware and state-aware rule tiers) is exactly that trajectory, so expect majors, not silent tightening.

## Module format and Node support

Published as ESM only. Flat config loads ESM natively; a CommonJS config can `require()` this package on Node `^20.19.0` or `>=22.12.0`. The `engines` range mirrors what the ESLint peer range itself supports, not this repository's own Node version.

## The template-analyzer deep import

The rule imports `eslint-plugin-lit/lib/template-analyzer.js`, a path with no `exports`-map guarantee, against `eslint-plugin-lit@^2.0.0` (a regular dependency, installed for you). That is the same path and range `eslint-plugin-lit-a11y` itself relies on — a break there breaks lit-a11y first — and this package's test suite runs against the pinned floor versions, so a break surfaces on the bump, not in your lint run.
