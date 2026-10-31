# Reference sheets

Maintainer reference drawings, one self-contained HTML file each. Open a file
in a browser; there is no build step. The page loads the Arimo web font from
Google Fonts and falls back to Helvetica or Arial offline.

| Sheet                                                    | Subject                                                                                                                   | Drawn from                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [ui-view-anatomy-sheet.html](ui-view-anatomy-sheet.html) | `<ui-view>` nesting, layer stack, one transition's lifecycle order, and the attributes a `uiSref` link receives           | `packages/lit-ui-router/src`, `examples/helloworld`                                |
| [nested-views-sheet.html](nested-views-sheet.html)       | Nested views, URL composition, state tree against view tree, view targets                                                 | `examples/hellogalaxy`, `packages/lit-ui-router/src`                               |
| [view-lifecycle-sheet.html](view-lifecycle-sheet.html)   | One `<ui-view>` through a successful and a failed transition: hooks, view states, DOM layers, settle order                | `examples/loading-and-error-views`, `packages/lit-ui-router/src`, `@uirouter/core` |
| [live-example-sheet.html](live-example-sheet.html)       | The docs site's `LiveExample` component, measured in CSS px: layout, breakpoints, frame heights, states, design conflicts | `www/lit-ui-router.dev/.vitepress/theme/components`                                |

The sheets follow the conventions of a dimensional drawing: monochrome line
work, a title block with general notes, and every dimension given as a code
whose value or formula is in a table on the sheet. Library sheets count order
and nesting rather than pixels. Source references are `file:line` (or a
two-letter file code and line, as each sheet's notes define) against the tree
the sheet is committed in.
