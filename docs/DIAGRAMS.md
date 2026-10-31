# Diagram spec

The docs diagrams are hand-written SVG files in [`www/lit-ui-router.dev/public/diagrams/`](../www/lit-ui-router.dev/public/diagrams/). Pages inline them with `<!--@include: …-->`, so they take their colors from the site theme. [`.vitepress/test/diagram-spec.test.ts`](../www/lit-ui-router.dev/.vitepress/test/diagram-spec.test.ts) fails any diagram that breaks a rule below. Each rule names its section.

The rules follow the 1976 NASA Graphics Standards Manual (NHB 1430.2): every diagram sits in an outline box (§5.8), and labels away from what they name hang on leaders (§7.8). Dark mode keeps the same line language in the theme's grays.

## Canvas

- The root is `<svg viewBox="0 0 720 H" width="100%" style="max-width: 720px" role="img" aria-label="…">`. The canvas is always 720 wide, and the height fits the drawing.
- `<title>` comes first. `aria-label` reads the whole diagram as prose.
- One `<g>` sets the base font family for the drawing.

## Frame and caption

- The site draws the frame: [`custom.css`](../www/lit-ui-router.dev/.vitepress/theme/custom.css) puts every inlined diagram in a 1px `--vp-c-divider` outline box with an 8px radius. A diagram doesn't draw its own outer border.
- A caption or footnote is the drawing's last line: 10px, `text-2`, aligned to the left or right edge of the content.
- A label for the whole drawing is 11px, weight 600, `text-2`, at the bottom left.

## Type

- Families: `var(--vp-font-family-base, …)` for prose, `var(--vp-font-family-mono, …)` for code, paths and identifiers.
- Sizes: 13 for node titles, 12 for node body text, code and lane heads, 11 for labels, edge labels and notes, 10 for fine print and captions.
- Weights: regular, or 600 for titles and emphasis. Italic is for asides only.
- No letter-spacing.

## Lines

| Line                                  | Stroke          | Width                     | Ends                           |
| ------------------------------------- | --------------- | ------------------------- | ------------------------------ |
| Connector (flow, message, dependency) | `text-2`        | 1.25                      | the file's one arrowhead       |
| Outline (node, lane head, zone)       | role color      | 1 (default)               | —                              |
| Lifeline, rule, bracket               | `divider`       | 1                         | —                              |
| Leader (callout to subject)           | callout's color | 1                         | none, 4px short of the subject |
| Text halo                             | `bg`            | 4, `paint-order="stroke"` | —                              |

- Each file has one `<marker>`: an 8-unit triangle filled `text-2`, `markerWidth`/`markerHeight` 7, `orient="auto-start-reverse"`, with an id named `arr-<diagram>`.
- There is one dash pattern, `5 4`. Use it for returns, optional paths, and zones that group without containing.
- Icon glyphs (a nested `<svg>`) keep their own drawing; the stroke and radius rules skip them.

## Shapes

- Corner radius is 4 for tags, chips and icon tiles (24px tall or less) and 8 for every other box.
- A round mark is a circle (`rx` = half the side of a square).
- A rect without `rx` is only a knockout: filled `bg`, no stroke, masking a line behind a label.

## Color

Colors are roles, not values. Every `fill` and `stroke` is `none` or `var(--role, light-value)` from the palette in [`diagram-spec.ts`](../www/lit-ui-router.dev/.vitepress/test/diagram-spec.ts):

| Role                                     | Use                                                               |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `text-1`                                 | titles and primary labels                                         |
| `text-2`                                 | secondary labels, connectors and arrowheads                       |
| `bg`, `bg-soft`                          | knockouts and halos; node fill                                    |
| `divider`                                | node outlines, lifelines and rules                                |
| `brand-1`, `brand-soft`                  | the subject: lit-ui-router's own part or the path being explained |
| `default-soft`                           | a neutral tile                                                    |
| `green`, `red`, `purple` (`-1`, `-soft`) | success, failure, optional or lazy                                |
| `status-*`, `status-*-ink`               | HTTP status, from the status color table in `custom.css`          |

- The `var()` fallback is the role's light value, so a file opened on its own still draws.
- The file's `<style>` gives the dark value of every role the file uses and nothing else. It applies only when the file is the document root; inlined, the page theme wins.
- A third-party brand color is allowed only on a brand mark, which is an element or subtree with `data-brand="<name>"`. Opacity attributes are allowed only there too.
