# diagrams/ — The Altitude Atlas

A drawing set: one subject surveyed at every altitude, fourteen altitudes on 21 plates — the
numbered sheets, their A/B alternates, and two interactive lanes (sheets 7–10 are a survey
quartet — the monorepo by mass, the sample app's node_modules, the docs deploy on the
wire, and the inside of one bundle — and sheet 11 cuts that wire the other way, pricing
every published entry alone, and sheet 14 draws the census pipeline that measured most of them), each in the form that altitude earns. Riffs on an isometric codebase-visualization form seen in the wild; the
notes on each sheet argue where that form fits and where it lies.

| Sheet | Altitude | Form |
| --- | --- | --- |
| [1](sheet-1-the-render-loop.html) | ONE PACKAGE | ISO CIRCUIT |
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

- `megacanvas.html` — the 19 SVG plates on one page, ascent order.
- `gallery.html` — cover, index, and the full set, the interactive lanes included (also published as an Artifact).

Static HTML pages, written by `node generator/build.mjs .` from this directory. The SVG sheets need nothing;
the interactive plates (2B, 12i, 14i, 7·3D) load cytoscape 3.31.0 and three.js 0.169.0 from cdnjs, which
`generator/stage-site.mjs` vendors into `dist/` for hosting. `app/` is the same set as a prerendered
lit-ui-router app; `build.mjs` emits its fragments and manifest. Light theme is graphite-on-vellum; dark is cyanotype.
Generated 2026-08-16 by Fable (Claude, AI).
Every plate in `data/` — versions, dates and all — was re-counted at origin/main @ b2338d0 in one pass,
plate 7A's test light included: `generator/census-shadow.mjs` re-meters it at the same ref. The cover's general survey — every
tracked file on the scc 4.0.0 `Code` basis, origin/main @ b2338d0 — is imported from
`data/census-files.json`, the master snapshot `generator/census-scc.mjs` writes;
`generator/census-overview.mjs` prints the same rollup on the terminal.
