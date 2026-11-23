---
title: Linting
description: 'Catch routing mistakes in a lit-ui-router app at author time: router-aware ESLint rules, and where they sit beside typed routes and development warnings'
type: guide
topic: builds
---

# Linting

Some routing mistakes pass TypeScript. A few throw on first render; others never
throw, and leave a dead link or a page that screen readers misread. Linting
catches both kinds before you run the app.

## What breaks without linting

### A dead `href` on a button

Under the 1.x default (`assignHref: true`), `uiSref` writes an inert `href` onto
a `<button>` and prints a development warning:

<LintExample rule="lit-ui-router/sref-assign-href" label="Incorrect and correct usage of uiSref on a button" fixable>

<template #incorrect>

```ts
html`<button ${uiSref('home')}>Home</button>`;
```

</template>
<template #diagnostic>

```text
uiSref writes an href to <button>, which has no href in HTML. Pass { assignHref: 'auto' } to write it only to links; 'auto' becomes the default in 2.0.
```

</template>
<template #correct>

```ts
html`<button ${uiSref('home', {}, { assignHref: 'auto' })}>Home</button>`;
```

</template>
</LintExample>

`lit-ui-router/sref-assign-href` catches this and `--fix` rewrites the call to
`uiSref('home', {}, { assignHref: 'auto' })` (see
[Design System Links](./design-system-links) for how `assignHref` treats native
and custom elements).

### A directive in the wrong template part

Binding `uiSref` as an attribute value throws in the directive constructor on
first render (``The `uiSref` directive must be used as an element``):

<LintExample rule="lit-ui-router/directive-position" label="Incorrect and correct template position for uiSref">

<template #incorrect>

```ts
html`<a href=${uiSref('home')}>Home</a>`;
```

</template>
<template #diagnostic>

```text
`uiSref` must be used as an element part (`<a ${uiSref(...)}>`); it throws in attribute or child position.
```

</template>
<template #correct>

```ts
// Element part: uiSref manages href and click navigation
html`<a ${uiSref('home')}>Home</a>`;

// Attribute part: srefHref computes the href string
html`<a href=${srefHref('home')}>Home</a>`;
```

</template>
</LintExample>

`lit-ui-router/directive-position` flags misplaced directives with no autofix;
move `uiSref` to an [element part](./links-and-navigation) or switch to
`srefHref`.

### An active link with no `aria-current`

`srefActiveClass` paints CSS classes only, so an active link looks right while
screen readers receive no active-page signal:

<LintExample rule="lit-ui-router/sref-active-class-aria-current" label="Incorrect and correct aria-current pairing with srefActiveClass" fixable>

<template #incorrect>

```ts
html`<a
  href=${srefHref('home')}
  class=${srefActiveClass({ state: 'home', activeClasses: ['active'] })}
  >Home</a
>`;
```

</template>
<template #diagnostic>

```text
srefActiveClass marks this <a> active for CSS only; bind aria-current=${srefAriaCurrent({ state: 'home' })} beside it so assistive technology gets the same signal.
```

</template>
<template #correct>

```ts
html`<a
  href=${srefHref('home')}
  class=${srefActiveClass({ state: 'home', activeClasses: ['active'] })}
  aria-current=${srefAriaCurrent({ state: 'home' })}
  >Home</a
>`;
```

</template>
</LintExample>

`lit-ui-router/sref-active-class-aria-current` reports the missing attribute and
`--fix` binds `aria-current=${srefAriaCurrent({ state: 'home' })}` beside
`class`.

## Add the plugin

Install [`eslint-plugin-lit-ui-router`](/packages/eslint-plugin-lit-ui-router):

```bash
npm install --save-dev eslint-plugin-lit-ui-router
```

`configs.recommended` sets no `files`, so ESLint 9 and 10 apply it only to the
`.js`, `.mjs`, and `.cjs` files they lint by default and skip `.ts` files
without a message. A TypeScript app needs a config entry whose `files` glob
covers `.ts` and that sets a TypeScript parser. `typescript-eslint`'s
`configs.recommended` does both; its `configs.base` or a bare
`languageOptions.parser` sets no `files` and still lints nothing. Spread
`...litUiRouter.configs.recommended` into your existing flat config after that
TypeScript entry and after `eslint-plugin-lit-a11y` (the Lit accessibility
plugin, whose `anchor-is-valid` rule ours replaces):

```js
import litA11y from 'eslint-plugin-lit-a11y';
import litUiRouter from 'eslint-plugin-lit-ui-router';
import tseslint from 'typescript-eslint';

export default [
  ...tseslint.configs.recommended,
  litA11y.configs.recommended, // optional
  ...litUiRouter.configs.recommended,
];
```

See [`examples/lint-eslint`](https://github.com/simshanith/lit-ui-router/tree/main/examples/lint-eslint)
on GitHub for a complete TypeScript config, and the
[rules table](/packages/eslint-plugin-lit-ui-router#the-rules) for all six
recommended rules. Configure
[settings](https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/README.md#settings)
when your app uses design-system link elements (`linkElements`), a typed
`uiSref` wrapper module (`litUiRouterSources`), or prerendered templates
(`allowElementParts: false`). Because every rule is syntax-only, the plugin also
runs under [oxlint](https://oxc.rs) as a JS plugin (alpha); see the
[oxlint setup](https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/README.md#oxlint-alpha)
in the package README.

## Where lint sits among author-time checks

Each layer catches a different class of mistake:

- **Typed routes** ([`ui-router-registry`](/packages/ui-router-registry)) catch
  misspelled state names and wrong parameter shapes during TypeScript checking.
- **Lint** (`eslint-plugin-lit-ui-router`) catches misplaced directives, inert
  `href`s, hrefless anchors, and missing or overwritten `aria-current` bindings
  across every file, including code paths a development run may never visit (see
  [Catching the same problems at author time](./development-builds#catching-the-same-problems-at-author-time)).
- **Development warnings** ([The warnings](./development-builds#the-warnings))
  catch runtime wiring faults such as a missing `<ui-router>` ancestor or
  duplicate copies of `lit` while the app runs in development.

Once ESLint is configured to match and parse your TypeScript files, every
recommended rule defaults to `error`, so `npx eslint .` fails in CI on
violations and editor ESLint integrations surface the same diagnostics and
autofixes as you edit.

## The rest of your Lit code

- **[`eslint-plugin-lit`](https://github.com/43081j/eslint-plugin-lit#readme)**
  checks general Lit `html` templates in ESLint for invalid HTML, duplicate
  bindings, and legacy syntax.
- **[`lit-analyzer`](https://github.com/runem/lit-analyzer#readme)** type-checks
  template bindings against element declarations, though its last npm release
  was January 2024 (`2.0.3`), so verify TypeScript compatibility before adopting
  it.
- **[`stylelint`](https://stylelint.io)** with
  **[`postcss-lit`](https://github.com/43081j/postcss-lit#readme)** lints CSS
  inside `css` tagged templates, not `<style>` elements in `html` templates.
  Prefer `` static styles = css`...` `` on `LitElement` classes over `<style>`
  in `render()`, as
  [Lit's styles documentation](https://lit.dev/docs/components/styles/)
  recommends, so styles are shared and linted directly.

## Gaps in today's Lit tooling

Several parts of the Lit ecosystem sit at an awkward seam as older tools age out
and faster native tools take shape. Two small internal wrappers under `tools/`
close the gaps for our own workspace; neither is published to npm, and both are
short enough to read or copy if you need the same coverage:

- **Template type-checking.** `lit-analyzer` is unmaintained (`2.0.3` from
  January 2024 is still `latest`).
  [`tools/lit-template-lint`](https://github.com/simshanith/lit-ui-router/tree/main/tools/lit-template-lint)
  parses `html` templates with `parse5`, lowers them to TypeScript using element
  and attribute data from `@webref/elements`, `@webref/idl`, and
  `@vscode/web-custom-data`, and checks them through the TypeScript 7.1 beta
  `typescript/sync` API (`typescript@7.1.0-beta`). Native ports of that same
  API, such as [`tsrs`](https://github.com/oxc-project/tsrs) (a Rust port of
  TypeScript 7 exposing `./sync`, untested here), show where fast template
  checking is heading.
- **`<style>` in templates.** `postcss-lit` parses `css` tagged templates only.
  [`tools/postcss-lit-html`](https://github.com/simshanith/lit-ui-router/blob/main/tools/postcss-lit-html/README.md)
  wraps `postcss-lit` as one stylelint `customSyntax` that locates `html` and
  `svg` templates with `@babel/parser`, extracts `<style>` elements with
  `parse5`, maps findings back to source positions, and writes `stylelint --fix`
  changes back in place.
- **Faster linting with oxlint.** Because `eslint-plugin-lit-ui-router` is
  syntax-only, it loads into [oxlint](https://oxc.rs) through `jsPlugins`
  (alpha) alongside oxlint's native rules, as in
  [`.oxlintrc.json`](https://github.com/simshanith/lit-ui-router/blob/main/.oxlintrc.json);
  see the plugin README's
  [`#oxlint-alpha`](https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/README.md#oxlint-alpha)
  section for the config.
