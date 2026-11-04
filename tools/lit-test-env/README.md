# lit-test-env

Spec helpers shared by the lit suites and the packages that render HTML:
vitest setup, router helpers, fixtures, a semantic DOM matcher, and two HTML
parsers. Each module is a subpath export of `@tools/lit-test-env` (see
[`package.json`](./package.json)), consumed as source.

## Testing HTML output

Pick the helper by what the test checks, as the "Testing HTML output" section
of [CONTRIBUTING](../../docs/CONTRIBUTING.md#testing-html-output) lays out.

### `parse-html.ts`: what a page means

`parseHtml(html)` parses a page with happy-dom's `DOMParser`, without
registering any globals, into a `Document` whose `defaultView` answers
testing-library's style lookups. Query it with `@testing-library/dom`:

```ts
const link = getByRole(parseHtml(page).body, 'link', { name: '7B' });
assert.equal(link.getAttribute('href'), '/sheet/7B');
```

testing-library's types need lib.dom, so a node test that queries a parsed page
typechecks under a `tsconfig.dom.json` that adds it.

### `ssr-tree.ts`: the format of Lit SSR output

`ssr-tree.ts` parses markup with parse5 and reads the tree it builds, with
comments, template contents and child order intact. A declarative shadow
root is the contents of a `<template shadowrootmode>`, kept apart from the
host's light children.

| Export                                             | Returns                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `parseMarkup(markup)`                              | the parse5 fragment for `markup`                                          |
| `element(root, tag, attrs?)`                       | the first matching element below `root`; throws when there is none        |
| `elements(root, tag, attrs?)`                      | every matching element, in document order                                 |
| `shadowRoot(host)`                                 | the contents of `host`'s declarative shadow root; throws when it has none |
| `lightChildren(host)`                              | `host`'s child nodes, less its shadow root                                |
| `childNodes(node)`                                 | a node's own child nodes; a template has none                             |
| `getAttribute(el, name)`, `hasAttribute(el, name)` | an attribute's value, or whether it is set                                |
| `text(node)`                                       | the text below `node`, comments skipped                                   |
| `comments(node)`                                   | the data of every comment below `node`                                    |
| `litPart(node)`                                    | the Lit marker a comment spells, or `null`                                |
| `outline(node)`                                    | one label per child: `<tag>`, `<!--data-->` or the text                   |
| `outlineTree(node, { digests? })`                  | an indented outline of the whole subtree                                  |

Lookups (`element`, `elements`, `text` and `comments`) search shadow roots
too.

`litPart` reads `lit-part <digest>` and `lit-part` as
`{ kind: 'open', digest }`, `/lit-part` as `{ kind: 'close' }` and
`lit-node <n>` as `{ kind: 'node', index }`. Each carries the `prefix`
before `lit-`, such as `served:`.

`outlineTree` writes one line per node, indented two spaces per level:

- tags with their attributes;
- `#shadow <mode>` for a declarative shadow root;
- markers as `{open digest}`, `{open}`, `{close}` and `{node n}`, after any
  prefix;
- text trimmed and quoted;
- whitespace-only text left out.

`{ digests: false }` writes every digest as `*`.

```ts
const tree = parseMarkup(emit(html`<ui-view><p>fallback</p></ui-view>`));

expect(outlineTree(tree, { digests: false })).toEqual([
  '{open *}',
  '<ui-view>',
  '  #shadow open',
  '    {open *}',
  '    <slot>',
  '    {close}',
  '  <p>',
  '    "fallback"',
  '{close}',
]);
```
