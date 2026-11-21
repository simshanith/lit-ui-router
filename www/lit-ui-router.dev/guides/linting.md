---
title: Linting
description: 'Catch routing mistakes in a lit-ui-router app at author time: router-aware ESLint rules, and where they sit beside typed routes and development warnings'
type: guide
topic: builds
---

# Linting

Some routing mistakes pass TypeScript and only show up in the browser, or never
throw at all. Linting catches them across your whole app before you run it.

## What breaks without linting

- **Dead `href` on a `<button>` (`lit-ui-router/sref-assign-href`).** Under the
  1.x default (`assignHref: true`), `<button ${uiSref('home')}>` writes an inert
  `href` and prints a development warning. Lint reports:
  `uiSref writes an href to <button>, which has no href in HTML. Pass { assignHref: 'auto' } to write it only to links; 'auto' becomes the default in 2.0.`
  Running `--fix` rewrites it to `uiSref('home', {}, { assignHref: 'auto' })`.
- **Directive in the wrong part (`lit-ui-router/directive-position`).** Binding
  `<a href=${uiSref('home')}>` throws in the directive constructor on first
  render (``The `uiSref` directive must be used as an element``). Lint reports:
  `` `uiSref` must be used as an element part (`<a ${uiSref(...)}>`); it throws in attribute or child position. ``
  Move `uiSref` to an element part (`<a ${uiSref('home')}>`), or switch to
  `href=${srefHref('home')}`.
- **Active link with no `aria-current` (`lit-ui-router/sref-active-class-aria-current`).**
  `<a href=${srefHref('home')} class=${srefActiveClass({ state: 'home' })}>`
  paints the active class for CSS, so the page looks right while screen readers
  get no active-page signal. Lint reports:
  `srefActiveClass marks this <a> active for CSS only; bind aria-current=${srefAriaCurrent({ state: 'home' })} beside it so assistive technology gets the same signal.`
  Running `--fix` adds `aria-current=${srefAriaCurrent({ state: 'home' })}`.

## Add the plugin

Install [`eslint-plugin-lit-ui-router`](/packages/eslint-plugin-lit-ui-router):

```bash
npm install --save-dev eslint-plugin-lit-ui-router
```

Add `configs.recommended` to `eslint.config.js`:

```js
import litUiRouter from 'eslint-plugin-lit-ui-router';

export default [...litUiRouter.configs.recommended];
```

See the [rules table](/packages/eslint-plugin-lit-ui-router#the-rules) for all
six rules, `eslint-plugin-lit-a11y` ordering, and settings. Every rule is
syntax-only, so the plugin also runs under [oxlint](https://oxc.rs) as a JS
plugin (see the [package page](/packages/eslint-plugin-lit-ui-router#the-rules)).

## Where lint sits among author-time checks

Each layer catches a different class of mistake:

- **Typed routes** ([`ui-router-registry`](/packages/ui-router-registry)) catch
  misspelled state names and wrong parameter shapes during TypeScript checking.
- **Lint** (`eslint-plugin-lit-ui-router`) catches misplaced directives, inert
  `href`s, hrefless anchors, and missing or overwritten `aria-current` bindings
  across every file, including code paths a development run may never visit.
- **Development warnings**
  ([Catching the same problems at author time](./development-builds#catching-the-same-problems-at-author-time))
  catch runtime wiring faults such as a missing `<ui-router>` ancestor or
  duplicate copies of `lit` while the app runs in development.

Every recommended rule defaults to `error`, so running `npx eslint .` in CI
fails the build on any violation. Editor ESLint integrations surface the same
diagnostics and autofixes as you edit.

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
  inside `css` tagged templates. Prefer `` static styles = css`...` `` on
  `LitElement` classes over `<style>` elements in `render()`, as
  [Lit's styles documentation](https://lit.dev/docs/components/styles/)
  recommends; `postcss-lit` does not read `<style>` elements in `html`
  templates.

## How this site and the sample apps are checked

Alongside the published plugin above, we maintain two internal checks for the
docs site and sample apps. We built a template type-checker that replaced
`lit-analyzer`, and a custom stylelint syntax that reads `<style>` elements
inside `html` and `svg` templates. Both tools are internal and unpublished. Apps
built with `lit-ui-router` do not need either one and can stay on the published
plugins above. For contributor setup and tooling details, see
[`docs/CONTRIBUTING.md`](https://github.com/simshanith/lit-ui-router/blob/main/docs/CONTRIBUTING.md)
on GitHub.
