# typedoc-plugin-lit-ui-router

Two TypeDoc 0.28 plugins post-processing the markdown API reference this repo
publishes with `typedoc-plugin-markdown` + `typedoc-vitepress-theme`.

## `@tools/typedoc-plugin-lit-ui-router`

For packages using `"router": "category"` (currently `lit-ui-router`).

- `Converter.EVENT_RESOLVE_END` — rewrites the custom-elements-manifest
  `@slot` / `@fires` block tags (declared in the package's `tsdoc.json`) into
  one aggregate `@slots` / `@events` tag holding a markdown list, so a class
  page gets a single Slots / Events section. TypeDoc has no renderer for the
  analyzer's `{Type} name - description` syntax, and `@event` is reserved by
  TypeDoc, hence the `@fires` alias.
- `RendererEvent.END` — writes `<category>/index.md` for each category folder
  that has member pages (title and blurb from the plugin's category table,
  plus VitePress `prev`/`next` frontmatter), then retitles each
  `typedoc-sidebar.json` entry and points it at `/api/reference/<category>`.
  An uncharted `@category` value is title-cased rather than dropped.

## `@tools/typedoc-plugin-lit-ui-router/kind-indexes`

For packages on the default kind router (`lit-ui-router-mobx`,
`navigation-location-plugin`, `ui-router-server`).

- `RendererEvent.END` — writes an `index.md` into each kind folder
  (`classes/`, `interfaces/`, `type-aliases/`, …) so the bare folder URL does
  not 404, links the sidebar group headings at those pages, and retitles a
  multi-entry package's root `index` module to the package name. Folder links
  are resolved against the `docsRoot` option.

## Options read

`docsRoot` (vitepress theme) and the output directory TypeDoc reports on the
render event. Everything else — categories, ordering, sidebar shape — comes
from each package's `typedoc.json` and the `@category` tags in source.

## Cross-references

Doc comments use plain TypeDoc `{@link Symbol}`. Links to symbols outside the
package resolve through `externalSymbolLinkMappings` in that package's
`typedoc.json`; add an entry there rather than to this plugin.
