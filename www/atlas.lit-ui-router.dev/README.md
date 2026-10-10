# www/atlas.lit-ui-router.dev/ — The Altitude Atlas

A drawing set: one subject, the lit-ui-router monorepo, surveyed at every altitude. Fourteen altitudes
on 22 plates — the numbered sheets, their A/B alternates and three interactive lanes —
each in the form that altitude earns, with sheets 2 and 7 standing in the round in the routed app, and an appendix of 4 more about the atlas itself. Sheets 7–10 are a survey
quartet (the workspace by mass, a consumer's node_modules, a deploy on the wire, the inside of
one bundle); 11 prices every published entry alone; appendix A2 draws the census pipeline that
measured the rest, and A3 masses the atlas itself on sheet 7's ruler beside the codebase. The form riffs on an isometric codebase visualization seen in the wild; the notes on
each sheet argue where that form fits and where it lies.

| Sheet | Altitude | Form |
| --- | --- | --- |
| [1](sheet-1-the-render-loop.html) | ONE PACKAGE | ISO CIRCUIT |
| [1i](sheet-1i-the-render-loop-walked.html) | ONE PACKAGE | INTERACTIVE CIRCUIT |
| [2](sheet-2-the-brick-assembly.html) | SIX PACKAGES | BRICK ASSEMBLY |
| [2A](sheet-2A-the-coupling-plan.html) | SIX PACKAGES | COUPLING PLAN |
| [2B](sheet-2B-the-coupling-bench.html) | 9 NODES · 14 DRAWN CONTRACTS | INTERACTIVE COUPLING GRAPH |
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
| [11](sheet-11-the-entry-quarters.html) | SEVEN PACKAGES | ENTRY QUARTERS |
| [12](sheet-12-the-register-plate.html) | PR CI GRAPH | REGISTER PLATE |
| [12i](sheet-12i-the-register-walked.html) | PR CI GRAPH | INTERACTIVE REGISTER |
| [13](sheet-13-the-weathering-map.html) | WORKSPACE × TIME | WEATHERING MAP |
| [14](sheet-14-the-upstream-works.html) | CITY × COMMONS | UPSTREAM WORKS |

## Appendix — plates about the atlas, not the codebase

| Plate | Subject | Form |
| --- | --- | --- |
| [A1](sheet-A1-the-sprite-study.html) | THE ATLAS ITSELF | SPRITE STUDIES |
| [A2](sheet-A2-the-survey-office.html) | THE CENSUS PIPELINE | FLOW GRAPH |
| [A3](sheet-A3-the-atlas-measured.html) | THE ATLAS ITSELF | ISOMETRIC CITY |
| [A2i](sheet-A2i-the-survey-office-interactive.html) | THE CENSUS PIPELINE | INTERACTIVE GRAPH |

- `megacanvas.html` — the 19 SVG plates on one page, ascent order.
- `gallery.html` — cover, index and the full set, interactive lanes included.

**Build and host.** From the repo root, in order:

```bash
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev  # the flat set + the app's fragments and manifest
npm --prefix www/atlas.lit-ui-router.dev/app run build               # the routed app, prerendered
npm --prefix www/atlas.lit-ui-router.dev/app run build:artifact      # the single-file build published as a claude.ai Artifact
node www/atlas.lit-ui-router.dev/generator/check-scenes.mjs www/atlas.lit-ui-router.dev  # checks the three models, drives the built app's 3D plates in headless Chromium
cd www/atlas.lit-ui-router.dev && mise exec -- node generator/stage-site.mjs   # dist/: app at /, this set at /set/, vendored libs
mise exec -- pnpm exec wrangler pages deploy dist --project-name altitude-atlas --branch www/atlas --commit-dirty=true
```

**The card pictures.** Every card on the cover carries a 300 x 400 picture of its own
plate — `app/public/thumbs/<id>.webp` and `<id>-dark.webp`, one per theme, tracked
generated files like the fragments beside them. `generator/thumbs.mjs` draws them by
photographing the flat set above in headless Chromium (playwright, reached through
`tools/embed-heights`; the lanes' cytoscape is served from `app/node_modules`), and the
three 3D cards (`city`, `plant`, `bricks`) from the BUILT app's prerendered `/city/`, `/plant/`
and `/bricks/` pages, each `<model-viewer>` on a transparent clear, its pins hidden for the shot. The three
models, `app/public/models/city.glb`, `plant.glb` and `bricks.glb`, are tracked generated files
`build.mjs` writes beside the fragments (`generator/city-glb.mjs` and `brick-glb.mjs` on `glb.mjs`). `build.mjs` REFUSES to emit a manifest whose card has no picture, so a new
plate takes the full order:

```bash
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev   # writes the flat set, then stops on the missing picture
npm --prefix www/atlas.lit-ui-router.dev/app run build                             # the app the 3D cards are shot from
node www/atlas.lit-ui-router.dev/generator/thumbs.mjs www/atlas.lit-ui-router.dev  # photographs it
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev   # green
npm --prefix www/atlas.lit-ui-router.dev/app run build                             # the app with every picture
```

The picture is the card's BACKDROP, not a strip across its head: the whole plate laid at
the card's width, top-anchored, transparent everywhere the ink is not, so the card's gradient
ground shows through it under the head window, with the opaque text panel over the rest. Where the default reads as
grey at card width, the plate gets a row in `thumbs.mjs`'s one `TUNING` table (`zoom` to
enlarge it into a detail, `x`/`focus` to place the card box, `fit: 'contain'` to letterbox
the whole drawing instead, `crop` to fit the drawing band alone, `target` for a lane's
canvas) and nothing else changes. To try a row without touching
the tracked pictures: `thumbs.mjs <outdir> --only <ids> --out <dir> --tuning <file.json>`.

Live at <https://atlas.lit-ui-router.dev/> — the app owns the root (`/`, `/sheet/7/`, `/city/`,
`/plant/`, `/bricks/`, `/log`) and the flat set sits beside it under `/set/`; the two link to each other. The SVG
sheets need nothing; the interactive lanes (1i, 2B, 12i, A2i) load cytoscape 3.31.0, which the stage step
vendors, and the app-only plates in the round (2·3D, 7·3D, 7B·3D) bundle `@google/model-viewer`. `app/` is the same set as a prerendered
lit-ui-router app (see `app/README.md`); `HISTORY.md` is the verbatim revision record, parsed
into the app's `/log` at build time. This file is written by `build.mjs`; edit the emitter, not the output.

**The cabinet.** Every figure on every plate is read from `data/*.json`, written by the
`generator/census-*.mjs` probes at one ref — currently origin/main @ 9e656ab3 — on the scc 4.0.0
`Code` basis. Lookups throw on a missing row; nothing is hand-pasted. One plate stands outside the
cabinet: `data/survey-self.json`, which `generator/survey-self.mjs` measures from an archive of the
atlas's own branch for appendix A3, because main does not hold the atlas. `INITIATIVES.md` records
the pipeline's design and the traps of refreshing it.

**Type and theme.** Plates letter in the data face (DIN 2014 on the site's kit, Barlow Semi
Condensed off it); monospace is reserved for code. Light is graphite-on-vellum, dark is
cyanotype. Drawn by Claude (Anthropic) with the maintainer, 2026-08-16 onward.
