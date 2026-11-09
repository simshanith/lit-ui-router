# postcss-lit-html

[postcss-lit](https://github.com/43081j/postcss-lit) plus the CSS of `<style>` elements in lit `html` and `svg` templates: one PostCSS syntax, so stylelint checks both with the same config.

## Installation

The package is private and unpublished, so it is workspace-only for now: packages in this repo use it as `postcss-lit-html`, resolved from `packages/postcss-lit-html`. Until it is published, it has no npm install.

## Usage

This repo's [`stylelint.config.mjs`](../../stylelint.config.mjs) uses it in place of `postcss-lit` as stylelint's `customSyntax` for script files:

```js
export default {
  overrides: [
    {
      files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
      customSyntax: 'postcss-lit-html',
    },
  ],
};
```

A `<style>` element is checked when all its children are text, including one nested in other elements or in a `<template>`. Its expressions become postcss-lit placeholders, as in a `css` template. postcss-lit's `babelOptions` in `package.json` apply to both, and `// postcss-lit-disable-next-line` skips a `css`, `html` or `svg` template, as postcss-lit does: a line comment on the template or an ancestor.

## How it works

Each `<style>` element's contents parse as their own root. Every finding lands at its line and column in the file, including after `\\` escapes and on a template's first line, where postcss-lit's own positions drift.

`stylelint --fix` writes fixes back into the `css` templates and `<style>` contents and leaves the rest of the file byte for byte. In a `<style>` element, text a fix leaves alone is written back as it was in the source, escapes included. postcss-lit writes `css` templates itself, and doubles their lone backslashes, so `—` comes back as `\\u2014`.

When postcss-lit skips a template it can't parse, with its own warning, the other `<style>` elements and `css` templates in the file are still checked. When the `<style>` elements can't be told apart from the rest of the file, such as one nested in another's expression, the file falls back to plain postcss-lit with a `[postcss-lit-html] Skipping <style> elements` warning.

## Suppressions

Use stylelint's comments inside the CSS, such as `/* stylelint-disable-next-line <rule> -- <reason> */`. `// postcss-lit-disable-next-line` skips a whole template.
