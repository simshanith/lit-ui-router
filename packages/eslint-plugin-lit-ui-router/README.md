# eslint-plugin-lit-ui-router

ESLint rules that understand [lit-ui-router](https://lit-ui-router.dev) directives.

A lit-ui-router anchor carries no static `href` — the element-part directive assigns one at runtime — so stock accessibility rules report every correct call site. These rules keep the base rules' real coverage while understanding what the directives do.

## Install

```sh
npm install --save-dev eslint-plugin-lit-ui-router eslint-plugin-lit-a11y
```

`eslint` (`^9.0.0 || ^10.0.0`) and `eslint-plugin-lit-a11y` (`^5.0.0`) are peer dependencies: the plugin extends the host's copy of the base rule, so a duplicated instance would be the shadowed-copy class of bug.

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

`configs.recommended` must come **after** lit-a11y's config: it turns `lit-a11y/anchor-is-valid` off in favor of the wrapped rule, and it deliberately does not register the `lit-a11y` plugin key itself — the host's instance owns it.

## Rules

<!-- begin auto-generated rules list -->

💼 Configurations enabled in.\
✅ Set in the `recommended` configuration.

| Name                                             | Description                                                                                           | 💼 |
| :----------------------------------------------- | :---------------------------------------------------------------------------------------------------- | :- |
| [anchor-is-valid](docs/rules/anchor-is-valid.md) | lit-a11y's anchor-is-valid, wrapped so a uiSref element part counts as the href it assigns at runtime | ✅  |

<!-- end auto-generated rules list -->

## Semver policy

Following ESLint core's own policy: a change that makes `recommended` or an existing rule stricter — new reports on code that previously passed — ships as a **major**. The roadmap (option-aware and state-aware rule tiers) is exactly that trajectory, so expect majors, not silent tightening.

## Module format and Node support

Published as ESM only. Flat config loads ESM natively; a CommonJS config can `require()` this package on Node `^20.19.0` or `>=22.12.0`. The `engines` range mirrors what the ESLint peer range itself supports, not this repository's own Node version.

## The template-analyzer deep import

The wrap imports `eslint-plugin-lit/lib/template-analyzer.js`, a path with no `exports`-map guarantee, against `eslint-plugin-lit@^2.0.0`. That is the same path and range `eslint-plugin-lit-a11y` itself relies on — a break there breaks lit-a11y first — and this package's test suite runs against the pinned floor versions, so a break surfaces on the bump, not in your lint run.
