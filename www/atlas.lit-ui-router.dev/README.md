# www/atlas.lit-ui-router.dev/ — The Altitude Atlas

A drawing set: one subject, the lit-ui-router monorepo, surveyed at every altitude. Fourteen
altitudes on 24 plates — the numbered sheets, their A/B alternates, four interactive lanes, a
3D city and one appendix study — each in the form that altitude earns. Sheets 7–10 are a survey
quartet (the workspace by mass, a consumer's node_modules, a deploy on the wire, the inside of
one bundle); 11 prices every published entry alone; 14 draws the census pipeline that measured
the rest. The form riffs on an isometric codebase visualization seen in the wild; the notes on
each sheet argue where that form fits and where it lies.

| Sheet | Altitude | Form |
| --- | --- | --- |
| [1](sheet-1-the-render-loop.html) | ONE PACKAGE | ISO CIRCUIT |
| [1i](sheet-1i-the-render-loop-walked.html) | ONE PACKAGE | INTERACTIVE CIRCUIT |
| [2](sheet-2-the-brick-assembly.html) | FOUR PACKAGES | BRICK ASSEMBLY |
| [2A](sheet-2A-the-coupling-plan.html) | FOUR PACKAGES | COUPLING PLAN |
| [2B](sheet-2B-the-coupling-bench.html) | SEVEN NODES · TWELVE CONTRACTS | INTERACTIVE COUPLING GRAPH |
| [3](sheet-3-the-instrument-yard.html) | THE MONOREPO | ISOMETRIC CITY |
| [3A](sheet-3A-the-handoff-works.html) | TWO TASK MANAGERS | COUPLING SCHEMATIC |
| [3B](sheet-3B-the-watched-city.html) | THE CI TASK GRAPH | ISOMETRIC GRAPH CITY |
| [4](sheet-4-the-family-spine.html) | UI-ROUTER ECOSYSTEM | MASSED SPINE |
| [5](sheet-5-the-design-space.html) | JS ECOSYSTEM | POSITIONED CHART |
| [6](sheet-6-the-routing-strata.html) | EVERYTHING | CORE SAMPLE |
| [7](sheet-7-the-measured-city.html) | WHOLE WORKSPACE | MEASURED CITY |
| [7A](sheet-7A-the-shadow-survey.html) | WHOLE WORKSPACE | SHADOW PLAN |
| [7B](sheet-7B-the-working-city.html) | WHOLE WORKSPACE | WORKING CITY |
| [8](sheet-8-the-delivered-city.html) | ONE CONSUMER | DELIVERED CITY |
| [9](sheet-9-the-shipped-city.html) | ONE DEPLOY | SHIPPED CITY |
| [10](sheet-10-the-bundled-city.html) | ONE BUNDLE | BUNDLED CITY |
| [11](sheet-11-the-entry-quarters.html) | FIVE PACKAGES | ENTRY QUARTERS |
| [12](sheet-12-the-register-plate.html) | PR CI GRAPH | REGISTER PLATE |
| [12i](sheet-12i-the-register-walked.html) | PR CI GRAPH | INTERACTIVE REGISTER |
| [13](sheet-13-the-weathering-map.html) | WORKSPACE × TIME | WEATHERING MAP |
| [14](sheet-14-the-survey-office.html) | THE CENSUS PIPELINE | FLOW GRAPH |
| [14i](sheet-14i-the-survey-office-interactive.html) | THE CENSUS PIPELINE | INTERACTIVE GRAPH |

### Appendix — plates about the atlas, not the codebase

| Plate | Subject | Form |
| --- | --- | --- |
| [A1](sheet-A1-the-sprite-study.html) | THE ATLAS ITSELF | SPRITE STUDIES |

- `megacanvas.html` — the 19 SVG plates on one page, ascent order.
- `gallery.html` — cover, index and the full set, interactive lanes included.

**Build and host.** From the repo root, in order:

```
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev  # the flat set + the app's fragments and manifest
npm --prefix www/atlas.lit-ui-router.dev/app run build               # the routed app, prerendered
npm --prefix www/atlas.lit-ui-router.dev/app run build:artifact      # the single-file build published as a claude.ai Artifact
cd www/atlas.lit-ui-router.dev && mise exec -- node generator/stage-site.mjs   # dist/: app at /, this set at /set/, vendored libs
mise exec -- pnpm exec wrangler pages deploy dist --project-name altitude-atlas --branch worktree-altitude-atlas --commit-dirty=true
```

**The card pictures.** Every card on the cover carries a 259 x 150 crop of its own
plate — `app/public/thumbs/<id>.webp` and `<id>-dark.webp`, one per theme, tracked
generated files like the fragments beside them. `generator/thumbs.mjs` draws them by
photographing the flat set above in headless Chromium (playwright, reached through
`tools/embed-heights`; the lanes' cytoscape is served from `app/node_modules`, so the
step needs no network), and `build.mjs` REFUSES to emit a manifest whose card has no
picture. A new plate therefore takes one extra pass:

```
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev   # writes the flat set, then stops on the missing picture
node www/atlas.lit-ui-router.dev/generator/thumbs.mjs www/atlas.lit-ui-router.dev  # photographs it
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev   # green
```

The window is the plate at the card's own width, sliced to the card's ratio; where the
default slice lands on a schedule rather than a drawing, the plate gets a row in
`thumbs.mjs`'s one `TUNING` table (`target`, `focus`) and nothing else changes.

Live at https://atlas.lit-ui-router.dev/ — the app owns the root (`/`, `/sheet/7/`, `/city/`,
`/log`) and the flat set sits beside it under `/set/`; the two link to each other. The SVG
sheets need nothing; the interactive plates (1i, 2B, 12i, 14i, 7·3D) load cytoscape 3.31.0 and
three.js 0.169.0, which the stage step vendors. `app/` is the same set as a prerendered
lit-ui-router app (see `app/README.md`); `HISTORY.md` is the verbatim revision record, parsed
into the app's `/log` at build time. This file is written by `build.mjs`; edit the emitter, not the output.

**The cabinet.** Every figure on every plate is read from `data/*.json`, written by the
`generator/census-*.mjs` probes at one ref — currently origin/main @ 65e2843 — on the scc 4.0.0
`Code` basis. Lookups throw on a missing row; nothing is hand-pasted. `INITIATIVES.md` records
the pipeline's design and the traps of refreshing it.

**Type and theme.** Plates letter in the data face (DIN 2014 on the site's kit, Barlow Semi
Condensed off it); monospace is reserved for code. Light is graphite-on-vellum, dark is
cyanotype. Drawn by Claude (Anthropic) with the maintainer, 2026-08-16 onward.
