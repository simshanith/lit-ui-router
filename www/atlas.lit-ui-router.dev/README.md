# www/atlas.lit-ui-router.dev/ — The Altitude Atlas

A drawing set: one subject, the lit-ui-router monorepo, surveyed at every altitude. Fourteen altitudes
on 23 plates — the numbered sheets, their A/B alternates and three interactive lanes —
each in the form that altitude earns, with sheets 2 and 7 standing in the round in the routed app, and an appendix of 5 more about the atlas itself. Sheets 7–10 are a survey
quartet (the workspace by mass, a consumer's node_modules, a deploy on the wire, the inside of
one bundle); 11 prices every published entry alone; appendix A2 draws the census pipeline that
measured the rest, and A3 masses the atlas itself on sheet 7's ruler beside the codebase, A4 its deploy
on sheet 9's ruler beside the docs deploy. The form riffs on an isometric codebase visualization seen in the wild; the notes on
each sheet argue where that form fits and where it lies.

| Sheet | Altitude | Form |
| --- | --- | --- |
| [1](https://atlas.lit-ui-router.dev/sheet/1) | ONE PACKAGE | ISO CIRCUIT |
| [1i](https://atlas.lit-ui-router.dev/sheet/1i) | ONE PACKAGE | INTERACTIVE CIRCUIT |
| [2](https://atlas.lit-ui-router.dev/sheet/2) | NINE PACKAGES | BRICK ASSEMBLY |
| [2A](https://atlas.lit-ui-router.dev/sheet/2A) | NINE PACKAGES | COUPLING PLAN |
| [2B](https://atlas.lit-ui-router.dev/sheet/2B) | 12 NODES · 21 DRAWN CONTRACTS | INTERACTIVE COUPLING GRAPH |
| [2C](https://atlas.lit-ui-router.dev/sheet/2C) | ONE BOX, EIGHT BUILDS | BUILD INSTRUCTIONS |
| [3](https://atlas.lit-ui-router.dev/sheet/3) | THE MONOREPO | ISOMETRIC CITY |
| [3A](https://atlas.lit-ui-router.dev/sheet/3A) | TWO TASK MANAGERS | COUPLING SCHEMATIC |
| [3B](https://atlas.lit-ui-router.dev/sheet/3B) | THE CI TASK GRAPH | ISOMETRIC GRAPH CITY |
| [4](https://atlas.lit-ui-router.dev/sheet/4) | UI-ROUTER ECOSYSTEM | MASSED SPINE |
| [5](https://atlas.lit-ui-router.dev/sheet/5) | JS ECOSYSTEM | POSITIONED CHART |
| [6](https://atlas.lit-ui-router.dev/sheet/6) | EVERYTHING | CORE SAMPLE |
| [7](https://atlas.lit-ui-router.dev/sheet/7) | WHOLE WORKSPACE | MEASURED CITY |
| [7A](https://atlas.lit-ui-router.dev/sheet/7A) | WHOLE WORKSPACE | SHADOW PLAN |
| [7B](https://atlas.lit-ui-router.dev/sheet/7B) | WHOLE WORKSPACE | WORKING CITY |
| [8](https://atlas.lit-ui-router.dev/sheet/8) | ONE CONSUMER | DELIVERED CITY |
| [9](https://atlas.lit-ui-router.dev/sheet/9) | ONE DEPLOY | SHIPPED CITY |
| [10](https://atlas.lit-ui-router.dev/sheet/10) | ONE BUNDLE | BUNDLED CITY |
| [11](https://atlas.lit-ui-router.dev/sheet/11) | TEN PACKAGES | ENTRY QUARTERS |
| [12](https://atlas.lit-ui-router.dev/sheet/12) | PR CI GRAPH | REGISTER PLATE |
| [12i](https://atlas.lit-ui-router.dev/sheet/12i) | PR CI GRAPH | INTERACTIVE REGISTER |
| [13](https://atlas.lit-ui-router.dev/sheet/13) | WORKSPACE × TIME | WEATHERING MAP |
| [14](https://atlas.lit-ui-router.dev/sheet/14) | CITY × COMMONS | UPSTREAM WORKS |

## Appendix — plates about the atlas, not the codebase

| Plate | Subject | Form |
| --- | --- | --- |
| [A1](https://atlas.lit-ui-router.dev/sheet/A1) | THE ATLAS ITSELF | SPRITE STUDIES |
| [A2](https://atlas.lit-ui-router.dev/sheet/A2) | THE CENSUS PIPELINE | FLOW GRAPH |
| [A3](https://atlas.lit-ui-router.dev/sheet/A3) | THE ATLAS ITSELF | ISOMETRIC CITY |
| [A4](https://atlas.lit-ui-router.dev/sheet/A4) | THE ATLAS ITSELF | SHIPPED CITY |
| [A2i](https://atlas.lit-ui-router.dev/sheet/A2i) | THE CENSUS PIPELINE | INTERACTIVE GRAPH |

**Build and host.** `generator/ship.mjs` runs the shipment one named step per call, from the repo root, in order:

```bash
mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs build     # the generator: fragments, models, manifest and this README
mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs app       # typecheck, then the vite build and prerender
mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs audit     # the frame audit, then light and dark photographs under tmp/shots/
mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs stage     # dist/: the app at /, its _redirects merged
mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs deploy    # the branch, tree and kit checks, then the Pages upload
mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs verify    # two live fetches agree; seven status codes match
mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs artifact  # the single-file build published as a claude.ai Artifact
```

`docs/SHIPPING.md` is the account of the whole run.

**The card pictures.** Every card on the cover carries a 300 x 400 picture of its own
plate — `app/public/thumbs/<id>.webp` and `<id>-dark.webp`, one per theme, tracked
generated files like the fragments beside them. `generator/thumbs.mjs` draws them by
photographing the BUILT app in headless Chromium (playwright, reached through
`tools/embed-heights`; the lanes' cytoscape is served from `app/node_modules`): each sheet's bare plate
at `/plate/<num>/`, and the three 3D cards (`city`, `plant`, `bricks`) from its prerendered `/city/`,
`/plant/` and `/bricks/` pages, each `<model-viewer>` on a transparent clear, its pins hidden for the shot. The three
models, `app/public/models/city.glb`, `plant.glb` and `bricks.glb`, are tracked generated files
`build.mjs` writes beside the fragments (`generator/city-glb.mjs` and `brick-glb.mjs` on `glb.mjs`). `build.mjs` REFUSES to emit a manifest whose card has no picture, so a new
plate takes the full order:

```bash
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev   # writes the fragments, then stops on the missing picture
npm --prefix www/atlas.lit-ui-router.dev/app run build                             # the app the cards are shot from
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

Live at <https://atlas.lit-ui-router.dev/> — the app owns the site (`/`, `/sheet/7/`, `/city/`,
`/plant/`, `/bricks/`, `/log`). `/plate/<num>` serves each sheet as one plate in a bare document with no
client bundle, prerendered from the same route table (`app/prerender.ts`), and every old standalone url redirects
there; the frame audit (`generator/audit-frames.mjs`, `shoot.mjs`) and the card pictures read those bare plates
from `app/dist/plate/`. The interactive lanes (1i, 2B, 12i, A2i) bundle cytoscape 3.31.0,
and the app-only plates in the round (2·3D, 7·3D, 7B·3D) bundle `@google/model-viewer`. `app/` is the same set as a prerendered
lit-ui-router app (see `app/README.md`); `HISTORY.md` is the verbatim revision record, parsed
into the app's `/log` at build time. This file is written by `build.mjs`; edit the emitter, not the output.

**The cabinet.** Every figure on every plate is read from `data/*.json`, written by the
`generator/census-*.mjs` probes at one ref — currently origin/main @ 108456af — on the scc 4.0.0
`Code` basis. Lookups throw on a missing row; nothing is hand-pasted. Two plates stand outside the
cabinet: `data/survey-self.json` and `data/survey-shipped.json`, which `generator/survey-self.mjs` and
`generator/survey-shipped.mjs` measure from an archive of the atlas's own branch for appendices A3 and
A4, because main does not hold the atlas. `INITIATIVES.md` records
the pipeline's design and the traps of refreshing it. `docs/ISOMETRIC.md` is the drawing recipe the
isometric sheets share, `docs/SHIPPING.md` the run that ships a change and `docs/COPY.md` the rules the
words follow; the skills under `.agents/skills/` point at them.

**Type and theme.** Plates letter in the data face (DIN 2014 on the site's kit, Barlow Semi
Condensed off it); monospace is reserved for code. Light is graphite-on-vellum, dark is
cyanotype. Drawn by Claude (Anthropic) with the maintainer, 2026-08-16 onward.
