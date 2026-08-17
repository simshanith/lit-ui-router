# diagrams/ — The Altitude Atlas

A drawing set: one subject surveyed at every altitude, thirteen sheets (sheets 7–10 are a survey
quartet — the monorepo by mass, the sample app's node_modules, the docs deploy on the
wire, and the inside of one bundle — and sheet 11 cuts that wire the other way, pricing
every published entry alone), each in the form that altitude earns. Riffs on an isometric codebase-visualization form seen in the wild; the
notes on each sheet argue where that form fits and where it lies.

| Sheet | Altitude | Form |
| --- | --- | --- |
| [1](sheet-1-the-render-loop.html) | ONE PACKAGE | ISO CIRCUIT |
| [2](sheet-2-the-brick-assembly.html) | FOUR PACKAGES | BRICK ASSEMBLY |
| [2A](sheet-2A-the-coupling-plan.html) | FOUR PACKAGES | COUPLING PLAN |
| [3](sheet-3-the-instrument-yard.html) | THE MONOREPO | ISOMETRIC CITY |
| [3A](sheet-3A-the-handoff-works.html) | TWO TASK MANAGERS | COUPLING SCHEMATIC |
| [4](sheet-4-the-family-spine.html) | UI-ROUTER ECOSYSTEM | MASSED SPINE |
| [5](sheet-5-the-design-space.html) | JS ECOSYSTEM | POSITIONED CHART |
| [6](sheet-6-the-routing-strata.html) | EVERYTHING | CORE SAMPLE |
| [7](sheet-7-the-measured-city.html) | WHOLE WORKSPACE | MEASURED CITY |
| [8](sheet-8-the-delivered-city.html) | ONE CONSUMER | DELIVERED CITY |
| [9](sheet-9-the-shipped-city.html) | ONE DEPLOY | SHIPPED CITY |
| [10](sheet-10-the-bundled-city.html) | ONE BUNDLE | BUNDLED CITY |
| [11](sheet-11-the-entry-quarters.html) | FOUR PACKAGES | ENTRY QUARTERS |
| [12](sheet-12-the-register-plate.html) | PR CI GRAPH | REGISTER PLATE |
| [13](sheet-13-the-weathering-map.html) | WORKSPACE × TIME | WEATHERING MAP |

- `megacanvas.html` — all thirteen sheets on one page, ascent order.
- `gallery.html` — cover, index, and the full set (also published as an Artifact).

Static HTML, no build, no dependencies. Light theme is graphite-on-vellum; dark is cyanotype.
Regenerate with `node generator/build.mjs .` from this directory.
Generated 2026-08-16 by Fable (Claude, AI); npm dates fetched same day.
