# postcss-lit-html

[postcss-lit](https://github.com/43081j/postcss-lit) plus the CSS of `<style>` elements in lit `html` and `svg` templates: one PostCSS syntax, so stylelint checks both with the same config.

## Installation

```bash
npm install --save-dev postcss-lit-html
```

## Usage

Use it in place of `postcss-lit` as stylelint's `customSyntax` for script files:

```js
export default {
  overrides: [
    {
      files: ['**/*.{ts,js}'],
      customSyntax: 'postcss-lit-html',
    },
  ],
};
```

A `<style>` element is checked when all its children are text, including one nested in other elements or in a `<template>`. Its expressions become postcss-lit placeholders, as in a `css` template. postcss-lit's `babelOptions` in `package.json` apply to both, and `// postcss-lit-disable-next-line` skips a `css`, `html` or `svg` template, as postcss-lit does: a line comment on the template or an ancestor.

## How it works

Each `<style>` element's contents parse as their own root, at the file's own line, column and offset, so a finding lands on its declaration. `stylelint --fix` writes fixes back into the `css` templates and `<style>` contents and leaves the rest of the file byte for byte.

## Suppressions

Use stylelint's comments inside the CSS, such as `/* stylelint-disable-next-line <rule> -- <reason> */`. `// postcss-lit-disable-next-line` skips a whole template.
