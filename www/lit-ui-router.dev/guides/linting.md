---
title: Linting
description: Linting a lit-ui-router app — router-aware ESLint rules, Lit template checks, and stylelint for component CSS
type: guide
topic: builds
---

# Linting

Linting a lit-ui-router app covers three distinct surfaces: router directives
in templates, Lit HTML templates themselves, and CSS inside components. Each
surface has its own tool, and you can adopt them independently.

| Surface                                    | Published tool                                                                                                              | What it catches                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Router directives (`uiSref`, `sref*`, ...) | [`eslint-plugin-lit-ui-router`](/packages/eslint-plugin-lit-ui-router)                                                      | missing `href`, inert `href` on non-links, `aria-current` gaps, bad part types |
| Lit HTML templates                         | [`eslint-plugin-lit`](https://npmx.dev/package/eslint-plugin-lit) / [`lit-analyzer`](https://npmx.dev/package/lit-analyzer) | invalid HTML, binding positions, duplicate bindings, template type mismatches  |
| Component CSS (`css` tagged templates)     | [`stylelint`](https://stylelint.io) + [`postcss-lit`](https://npmx.dev/package/postcss-lit)                                 | invalid CSS syntax, unknown properties and functions, duplicate selectors      |

## Router-aware rules (`eslint-plugin-lit-ui-router`)

[`eslint-plugin-lit-ui-router`](/packages/eslint-plugin-lit-ui-router) is a
published ESLint plugin (`eslint` `^9.0.0 || ^10.0.0`) that understands
lit-ui-router's directives.

```bash
npm install --save-dev eslint-plugin-lit-ui-router
```

In flat config (`eslint.config.js`):

```js
import litA11y from 'eslint-plugin-lit-a11y';
import litUiRouter from 'eslint-plugin-lit-ui-router';

export default [
  // Optional sibling: keep litUiRouter after it so anchor-is-valid is replaced.
  litA11y.configs.recommended,
  ...litUiRouter.configs.recommended,
];
```

`eslint-plugin-lit-a11y` is optional; without it installed, the `off` rule
inside `litUiRouter.configs.recommended` is inert.

`configs.recommended` enables six rules at `error`:

- **`anchor-is-valid`** — flags anchors with no `href`, while recognizing a
  `uiSref` element part as the `href` it assigns at runtime (unless
  `assignHref: false`).
- **`sref-assign-href`** — flags `uiSref` writing an inert `href` onto native
  non-link elements (`<button>`, `<tr>`, `<div>`) and autofixes to
  `assignHref: 'auto'`.
- **`sref-active-aria-current`** — flags an authored `aria-current` on an
  element managed by `uiSrefActive`, which silently overwrites and removes it.
- **`sref-active-class-aria-current`** and **`sref-status-aria-current`** —
  flag active-styled links using `srefActiveClass` or `SrefStatusController`
  that omit an `aria-current` binding.
- **`directive-position`** — flags any lit-ui-router directive bound outside
  the Lit part type it accepts, which otherwise throws on first render.

Three `settings` tailor the rules to your app:

- `settings.linkElements` declares custom link tags such as `['sp-link']` so
  the rules treat them like `<a>` (see [Design System Links](./design-system-links)).
- `settings.litUiRouterSources` lists wrapper modules (for example a typed
  `uiSref` re-export) whose exports count as lit-ui-router's.
- `settings.allowElementParts: false` (scoped with `files` to prerendered
  templates) checks templates as `@lit-labs/ssr` serves them, where element
  parts do not run.

Every rule is syntax-only, so the plugin also loads into
[oxlint](https://oxc.rs) via `jsPlugins`. See the
[`eslint-plugin-lit-ui-router` package page](/packages/eslint-plugin-lit-ui-router)
for rule details, oxlint configuration, and a live example.

Suppress an individual line with standard ESLint comments
(`// eslint-disable-next-line lit-ui-router/<rule> -- <reason>`), or scope rule
overrides with `files` for test fixtures.

## Lit templates

For general Lit template checks, there are two published options:

- **[`eslint-plugin-lit`](https://npmx.dev/package/eslint-plugin-lit)** runs
  inside ESLint with no type checker. Its `flat/recommended` preset catches
  invalid HTML inside `html` templates, invalid binding positions, duplicate
  bindings, unescaped attribute entities, legacy syntax, and property mutations
  in `update()`.
- **[`lit-analyzer`](https://npmx.dev/package/lit-analyzer)** runs as a CLI
  and editor plugin with TypeScript type checking, validating attribute,
  property, boolean, and event bindings against element declarations.

```bash
npm install --save-dev eslint-plugin-lit
```

Add `lit.configs['flat/recommended']` to `eslint.config.js` alongside
`eslint-plugin-lit-ui-router`:

```js
import lit from 'eslint-plugin-lit';
import litUiRouter from 'eslint-plugin-lit-ui-router';

export default [
  lit.configs['flat/recommended'],
  ...litUiRouter.configs.recommended,
];
```

For type-checked template bindings, run `lit-analyzer` from the command line:

```bash
npm install --save-dev lit-analyzer
npx lit-analyzer "src/**/*.ts"
```

This repository replaced `lit-analyzer` with an internal TypeScript 7.1
template checker (`tools/lit-template-lint`) that is not published; see
[How this repo does it](#how-this-repo-does-it) below. For applications outside
this repository, use `eslint-plugin-lit` and `lit-analyzer` (and optionally
[`eslint-plugin-wc`](https://npmx.dev/package/eslint-plugin-wc) for custom
element lifecycle rules).

## Component CSS (`stylelint` + `postcss-lit`)

[Stylelint](https://stylelint.io) checks standalone `.css` files out of the box.
To check Lit `css` tagged templates in `.ts` and `.js` files as well, pair it
with [`postcss-lit`](https://npmx.dev/package/postcss-lit) as a `customSyntax`
override:

```bash
npm install --save-dev stylelint stylelint-config-recommended postcss-lit
```

In `stylelint.config.mjs` (matching the override shape in this repo's
[`stylelint.config.mjs`](https://github.com/simshanith/lit-ui-router/blob/main/stylelint.config.mjs)):

```js
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-recommended'],
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  overrides: [
    {
      files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
      customSyntax: 'postcss-lit',
    },
  ],
};
```

Run it across both stylesheets and component modules:

```bash
npx stylelint "src/**/*.{css,ts,js}"
```

`stylelint-config-recommended` catches syntax errors, unknown properties,
duplicate selectors and properties, invalid hex colors, and empty blocks inside
every `css` tagged template. `postcss-lit` supports complete-syntax
interpolations (an entire selector, property, value, statement, or block) and
warns and skips a template it cannot parse.

### Suppressions

- **Single rule inside CSS:** place a stylelint comment inside the `css`
  template with a reason:

  ```ts check
  import { css } from 'lit';

  export const styles = css`
    .host {
      /* stylelint-disable-next-line property-no-unknown -- custom layout token */
      custom-prop: 1;
    }
  `;
  ```

  With `reportDescriptionlessDisables` and `reportNeedlessDisables` enabled, a
  disable comment without a `-- <reason>` or one that suppresses no violation
  fails the run.

- **Whole template:** put `// postcss-lit-disable-next-line` on the line
  immediately before a template to skip it completely (for instance when an
  expression sits inside part of a selector or value that `postcss-lit` cannot
  parse):

  ```ts check
  import { css, unsafeCSS } from 'lit';

  declare const variant: string;

  // postcss-lit-disable-next-line
  export const dynamicStyles = css`
    .item-${unsafeCSS(variant)} {
      color: inherit;
    }
  `;
  ```

HTML comments inside a template (such as `<!-- @ts-expect-error -->`) do not
reach stylelint.

### The `<style>` gap inside `html` templates

`postcss-lit` parses `css` tagged templates only. It does not inspect `<style>`
elements written inside `html` or `svg` templates — upstream declined adding
`<style>` support (`43081j/postcss-lit#47`).

Prefer `` static styles = css`...` `` on `LitElement` classes instead of `<style>`
elements inside `render()`, as
[Lit's styles documentation](https://lit.dev/docs/components/styles/)
recommends. Static styles are shared across instances via constructable
stylesheets and are linted directly by `postcss-lit`.

This repository covers the `<style>` elements that remain in its own `html` and
`svg` templates with an internal custom syntax, `@tools/postcss-lit-html`
([`tools/postcss-lit-html`](https://github.com/simshanith/lit-ui-router/tree/main/tools/postcss-lit-html)),
which is not published on npm.

## How this repo does it

Alongside `eslint-plugin-lit-ui-router` (run as an oxlint JS plugin) and
stylelint, this repository maintains four internal checks under `tools/`. None
of them are published to npm or intended to be installed by external apps:

- **Template type-checking — [`tools/lit-template-lint`](https://github.com/simshanith/lit-ui-router/tree/main/tools/lit-template-lint):**
  The `//#lint:templates` task replaces `lit-analyzer`
  ([#1650](https://github.com/simshanith/lit-ui-router/issues/1650)) by lowering
  Lit `html` templates to TypeScript and type-checking them on the TypeScript
  7.1 API. It validates tag names, attributes, properties, and events (from
  `lib.dom`, `@fires` tags, and literal `dispatchEvent` calls), with
  `<!-- @ts-expect-error -->` suppressing the next element's checks.
- **CSS including `<style>` in templates — [`tools/postcss-lit-html`](https://github.com/simshanith/lit-ui-router/tree/main/tools/postcss-lit-html):**
  The `//#lint:css` task runs stylelint with `@tools/postcss-lit-html`
  ([#1956](https://github.com/simshanith/lit-ui-router/issues/1956)) as
  `customSyntax` in
  [`stylelint.config.mjs`](https://github.com/simshanith/lit-ui-router/blob/main/stylelint.config.mjs),
  extending `postcss-lit` to parse `<style>` elements inside `html` and `svg`
  templates with accurate source positions and `--fix` write-back.
- **JSDoc `@example` type-checking — [`tools/doc-example-check`](https://github.com/simshanith/lit-ui-router/tree/main/tools/doc-example-check):**
  The `//#lint:doc-examples` task type-checks every `ts` code block inside a
  published `@example` tag as its own module against the built `dist`
  declarations on TypeScript 7.1 (`ts nocheck` opts out fragments).
- **Markdown fence type-checking — [`tools/md-content-mapper`](https://github.com/simshanith/lit-ui-router/tree/main/tools/md-content-mapper):**
  The `//#lint:md-examples` task runs a TypeScript 7.1 content mapper via
  `tsc --runExternalCode` to type-check every `ts check` code fence in the
  repo's Markdown docs as its own module.
