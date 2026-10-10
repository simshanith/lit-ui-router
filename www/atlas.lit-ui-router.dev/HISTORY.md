# The Altitude Atlas — revision history (frozen record)

This file is the **frozen revision record** of the drawing set. The sheets themselves carry present-state copy only; every `REV` clause and every historical paragraph the generators have carried lives here, quoted verbatim. A history sheet or appendix may later be drawn from it.

Quoted text is the **source** text: template expressions (`${...}`) appear as written, with the value the build resolves them to given after `→` where it is not obvious.

The record is load-bearing. `diagrams/generator/emit-app.mjs` parses it at build time into the app's `/log` page, reading three things and nothing else: each `## <sheet>` heading, each `### REV X` subhead under it, and that rev's first `> ` quote block (or the one following `resolved →`). Editing any of those three edits the published issue log.

Under each sheet, **Record notes** carries what the clauses assume but do not say: the date and commit each rev landed on, the superseded figures its prose is measured against, and the plate the sheet's numbers are read from.

---

## Cover — THE ALTITUDE ATLAS (build.mjs)

- **file** `diagrams/generator/build.mjs`

The cover carries no `sub` line and no REV of its own. Its history lives in two places: the roster rows in `SHEET_ROWS`, whose one-line verdicts pin *another sheet's* rev letter, and the "the set has grown since its first printing" paragraph, which is the set-level narrative of what changed and why.

### Roster verdicts that pin a sheet revision (verbatim source)

- **3** — the yard re-massed from sloc × files — gate severity in colour: the smallest blocks stop the line (REV D: the task-manager inset reads the plates too, so it can no longer disagree with 3A)
- **3A** — turbo caches mise — and the loop is a DAG in a loop costume: the 7 callers and the 7 called never touch (REV D: counts imported; mise unmoved a third time, turbo at 98 definitions in 17 files)
- **3B** — footprint = watched files, height = command sloc — most blocks are one-line pads (REV E: #693 re-platted the root yard); the tallest is the 401-sloc //#lint:elements spire
- **7** — the census with districts and roads — tests as annexes, every edge cited: the 8-line harness stops every PR (REV E: 32 members recounted on the scc ruler)
- **7A** — the shadow survey — the tests are the light: where a suite reaches it burns near-full (REV E: RE-METERED, ${SURVEY_META.metered} members under their own suites' meters at ${SURVEY_META.sha}, so the light and the census are one measurement and the daggers retire)
- **7B** — the synthesis plate — rust, steam, lamps and pipes on one city: every pipe connects, the flagship runs old AND hot, and rev B’s one alarm — which rang over the drawings themselves — is drawn struck through, answered by ffd4ef7
- **9** — the wire survey — Dickens outweighs the code, and at REV F the prose pages overtook the fonts
- **11** — the split view — sixteen doors priced alone; fifteen of them reprobe byte-identical at REV D
- **12** — the punched inventory — 70% of the graph runs nothing, and at REV D real→real edges fell a quarter while the node count barely moved

### The set-level history paragraph (verbatim source)

> <p>The set has grown since its first printing. Sheet 1 is now REV C — first staged isometric at the client's ask, then given one deliberate metaphor break: the document is drawn the way Firefox's old Tilt inspector drew it, a browser window whose DOM rises as stacked plates. Sheets 7–10 are a survey quartet: what we wrote (the monorepo by mass), what npm delivered (the sample app's <code>node_modules</code>, 297× the app it serves), what the browser downloads (the docs deploy on the wire — where the prose and the fonts outweigh every line of code — the demo corpora that once towered over both left the deploy at rev G), and who actually occupies the bytes after tree-shaking (one bundle opened up — the machine the router wraps is 22.5% of the wire; the router itself, 3.9%). The set has already changed its own subject twice: sheet 8's rev A drew lodash as the tallest building in the delivered city, and that drawing became a merged <code>lodash-es</code> swap — the building halved, the wire chunk cut 84%; then sheet 10's first printing drew two complete lit majors riding in every app, and that drawing became the merged single-lit + lazy api-viewer dedupe (#618). Sheets 8, 9 and 10 have each been remeasured after the merge they argued for; sheet 11 cuts the same wire the other way — five package quarters, sixteen doors, each priced alone. Sheet 12 leaves the wire entirely and draws the monorepo as its own CI reads it: the pull-request task graph punched onto a register plate, where two thirds of the holes turn out to be scaffolding. Sheet 14 turns the instrument on itself: the census pipeline that produced almost every number in this set, drawn as a flow of archive → probe stations → filed plates → drawings, and introspected from the generator at build time rather than described by hand.</p>

**Record notes**

- 2026-09-11, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ 65e2843 (commit 2026-09-11), all 17 plates re-run at the one ref, with three new workspace members — `@tools/bootstrap` (`tools/bootstrap`), `@tools/eslint` (`tools/eslint`) and `@tools/repo-checks` (`tools/repo-checks`) — and the `docs` member now `@www/lit-ui-router.dev`; `basis.mjs` installs the materialized checkout with mise-provisioned pnpm, corepack having left the repo. On the app's cover the card's four keys are drawn as a mini title block (subject | projection glyph and word over basis | mode lamp, INTERACTIVE only) instead of uniform kv chips, and the same strip repeats in the sheet page's `.plate-data`; cards are `<article>` with one stretched primary link so the slot links are valid, and card lists are keyed by id, which fixes a stale `uiSrefActive` after a client-side filter. The article "the" became one shared rule set in `chrome.mjs` — on the baseline at 0.8em of the data face, HWT catchword on the kit host with a 15px floor, the 0.6em superior retired; the rail shows "the" once at its head with muted ″ ditto marks (U+2033) under it for every "the…" title, rail head and cover title share the treatment, and at ≤900 the collapsed bar shows the plain wordmark. The header line "THE ALTITUDE ATLAS — DRAWING SET" and the title block's PROJECT field carry the same mark on every sheet, flat set included, so the catchword guard script now ships in every generated page. Published the same day: the site at atlas.lit-ui-router.dev (Pages deploy) and the artifact at Version 24.
- 2026-09-11, later, no rev clause: the unified article was unwound on the user's decision — "ok i don't like the sidebar edit at all. i miss uppercase THE in THE ALTITUDE ATLAS i prefer that consistency … i do like the superscript + din on the sheet title on the sheet itself restore", then "i want the catchword `the ALTITUDE ATLAS — DRAWING SET` for the project title on the sheet in the header, and in the block", settled as "right so we have two variants -- condensed with wordmark, used in block and sheet header, full uppercase, used in sidebar and homepage". So the atlas's name has exactly two forms: CONDENSED — the HWT catchword "the" (24px floor; the 15px floor was a smudge) over a `sup.art` fallback, then ALTITUDE ATLAS in the data face — on every sheet's header line and the title block's PROJECT field; FULL UPPERCASE — THE ALTITUDE ATLAS in the display face — on the rail head and the cover title. The rail's article head and its ″ ditto column are gone; sheet titles and index cards keep the 0.6em DIN superior; the title block's SHEET TITLE alone sets "the" inline in lowercase DIN at the title's size and baseline. Published the same day: Pages deploy and artifact Version 25.
- 2026-09-11, later still, no rev clause: the condensed wordmark's name moved from the data face to the display face — user: "stick to flw eaglefeather for the sheet header `altitude atlas`" and "i do want eaglefeather for altitude atlas everywhere in block and project title etc". `PROJECT_MARK` now wraps the name in `<span class="mark">` (Eaglefeather, 600, 1.06em — the ratio of DIN's 0.690 cap to Eaglefeather's 0.651, so the name's cap height equals the ledger's), so every emitter of the mark gets it: the sheet header line, the title block's PROJECT field (back on `--display`) and the interactive plates' own heads; only the "— DRAWING SET" tail stays in the ledger data face. The catchword was tuned by the user in devtools and adopted as sent: 20px flat and `vertical-align: sub`, centred on the Eaglefeather cap band. The user had seen the superior instead of the catchword on the live site after the Version 25 deploy; that was a browser-cached `atlas.css` (a four-hour public max-age on a fixed URL, with the markup renamed `.art` → `.cw` under it), cleared by a hard refresh — so `stage-site.mjs` now stamps `?v=<sha256[:8]>` of the stylesheet on every routed page's link; the flat set and the artifact inline the CSS and need nothing. Published the same day: Pages deploy and artifact Version 26.
- 2026-09-11, evening, no rev clause: the atlas moved out of `diagrams/` into `www/atlas.lit-ui-router.dev/`, beside the flagship site. The user's framing: "the atlas is a great promoted out of examples/ example — it goes beyond a stackblitz demo to full blown website", with the "eventual goal to move build to cloudflare workers on main commit like flagship docs site, deprecate artifact publishing". Main was merged into this branch first (71 commits; only a gitignore line and one oxlint override overlapped), then the tree was renamed with history and every literal `diagrams/` path swept — 48 generator files, the app's manifest and views, and 22 provenance fields across 17 filed plates (`wasGeneratedBy`, `used`), the path text only; no probe was re-run and no measured value changed. Root tenancy is the examples' shape, named in `www/README.md`: not a workspace package, its own npm lockfile against the published router at the version floor, a knip ignore, formatter ignores for the tracked generated files, the oxlint override re-pointed. `HISTORY.md` keeps every old path verbatim, so the /log entries that quote it still say `diagrams/`. The "this branch never merges" rule ends here: the atlas merges to main as one squash PR, and after that is ordinary PR work. Published the same day from the new path: Pages deploy and artifact Version 27.
- 2026-09-11, night, no rev clause: T16 — every card on the cover now leads with a 259 × 150 picture of its own plate. `generator/thumbs.mjs` photographs the flat set this same build wrote, in headless Chromium (playwright through `tools/embed-heights`, the lanes' cytoscape served out of `app/node_modules`, so the step needs no network), re-lays each plate at the card's width, slices it to the card's ratio and writes `app/public/thumbs/<id>.webp` and `<id>-dark.webp` at 2× — 48 tracked files, 709,666 bytes, beside the fragments they crop. A raster and not inline SVG by measurement: the set's first plates are 1,085,034 bytes of SVG, 373,671 gzipped, against a cover that already ships a 104 KB manifest. The plates letter in the theme's own tokens, so each is shot in both themes and the card carries both images with the three-state rule from `chrome.mjs` choosing one; a `display: none` lazy image is never requested, so the pair still costs one file. `emit-app.mjs` refuses a manifest whose card has no picture, which gives a new plate the pass order build → thumbs → build, written into the generated `README.md`; `artifact.ts` bakes all 48 as data URIs, taking the single file from 3,307,402 to 4,259,631 bytes. The city card is the exception and draws `cover.hero`, the build-time SVG the cover already carries. The crop is centred unless a plate takes a row in `thumbs.mjs`'s `TUNING` table; thirteen have one, and per-sheet tuning of the rest is its own pass.
- 2026-09-11, night, later, no rev clause: the seven weak crops were tuned, and `TUNING` took one more knob to do it. `zoom` enlarges the target that many times before the 259 × 150 window is cut, so the card holds 1/zoom of the drawing at full detail and `x` finally has something to move within — a plate is re-laid `259 × zoom` wide before the shot, a lane is already drawn at the 1400 px stage and has its window narrowed into that canvas instead. Sheets 5, 6 and 13 are now plate enlargements (13 at 2.6×, down onto `packages/ — THE PRODUCT`); lanes 1i, 2B, 12i and 14i are windows on their fitted graphs, 14i placed at `x` 0.78 so the stranded basis cluster off to the left falls outside the card. The knob is inert at 1, so the other seventeen plates re-render byte-identical; three flags on `thumbs.mjs` — `--only`, `--out` and `--tuning` — let a row be tried against a scratch directory without touching a tracked picture, and the generated `README.md` names all four knobs.
- 2026-09-11, late, no rev clause: three loose ends off the design review, closed in one pass. (1) The cover's KEY INDEX chips mark themselves from the filter instead of from `uiSrefActive`. The directive caches its status and recomputes it on a transition, but a chip's target params are rewritten by the render that transition causes — and the ALL chips' target, the filter minus that one key, moves on every click — so nothing recomputed after the new target registered and a moved chip read one navigation behind; the directive's target set only grows, so it could also light a chip on a target it no longer had. Measured at `/?projection=graph`: the MODE and SUBJECT ALL chips counted 5 and drew unlit, then lit on the next unrelated click. `chip()` in `app/src/views.ts` now takes an `on` flag — a value chip is on when the key holds it, ALL when the key holds nothing — and writes `aria-current="page"` with the class; `without()` from `manifest.ts` supplies the ALL target and its count. The cards' key slots keep `uiSrefActive`, their targets being the plate's own fixed labels. (2) `/specimen` stopped scrolling sideways: its fourteen TITLE ARTICLE buttons run 1,120 px intrinsic on a flex row that could not break, giving `scrollWidth` 1,406 against a 1,400 viewport. `.sp-group` wraps now, with the seams on the buttons and a −1px bottom margin so the last row's rule lands on the group's own border, and `.specimen` drops the centred `max-width: 1240px` no other page carries; 720 / 900 / 1180 / 1400 / 2560 / 3008 all measure `scrollWidth === clientWidth`, with the button labels — which are the specimen — untouched. (3) `.mark`, the span `PROJECT_MARK` wraps the wordmark's name in, is `.project-mark`: named after its emitter, in `chrome.mjs`'s rule and replacement and in the twins in `app/src/views.ts` and `app/prerender.ts`. No other rule selected it; the 23 tracked sheets, `megacanvas.html`, `gallery.html`, the 25 app fragments and `app/public/sheets/atlas.css` carry the rename by regeneration, and sheets 1 and 2 re-photograph byte-identical against their tracked WebPs, so no plate picture was re-cut.
- 2026-09-12, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ 2ac53a0 (commit 2026-09-11) — the 1.13.0 release (#820, f37cd04), #821 and the examples pin bump #823 — with all 17 plates re-run at the one ref. No workspace member was born since 65e2843, so the five hand tables took no new row and the new-member checklist was a no-op. The general survey reads 695 tracked paths, 664 of them classified, 52,768 sloc (was 688 / 657 / 51,913). Two hand-written figures in the gallery prose that the new plates contradicted are now plate-derived: the sample app's `node_modules` is `${SHEET8_TIMES}`× the app it serves — 300, against a hand-written 297 that had been stale since 185d414 — and the tree-shaking shares are `${SHEET10_CORE_SHARE}` / `${SHEET10_ROUTER_SHARE}`, 22.3% and 4.2% against a hand-written 22.5% and 3.9%. The frozen "has grown" paragraph keeps its own 22.5% / 3.9% / 297×, which is what a rev-history figure is for. One harness fault was fixed to run the refresh at all: `basis.mjs`'s `ROOT` was still `../../`, correct under `diagrams/` and one directory short under `www/atlas.lit-ui-router.dev/`, so `git archive` measured the atlas's own tree and every probe died on a missing `pnpm-workspace.yaml`; it is `../../../`.
- 2026-09-12, late, no rev clause: the cover's index cards hold their plate back until the hand asks for it. At rest a card is its text in the order it always had — number line, title, scale, caption, meta, key block — and on `:hover` or `:focus-within` the plate picture fills the whole card behind it while the type gathers onto a translucent paper panel, floated 12 px in from the card's rule on three sides and stopped a line above its foot, with a hairline `--line` border and a ground of 38% paper over a 3 px backdrop blur (50% where `backdrop-filter` is unsupported). Both grounds are mixed from `--paper`, so the one rule reads in vellum and cyanotype alike, and the dark crop of the pair is the one the dark theme reveals. Revealed, the caption clamps to two lines rather than three so the panel ends higher and more of the plate stands below it; the line is given back to the body as padding and the panel's foot pulled up by the same `--cap-line` (21 px, the caption's own line, declared once on `.card`), so the body's box is identical either way — all 25 captions run past three lines, so the clamp always bites and the trade is always even. `.alt` and `.meta`, the two lines set faintest for paper, are mixed a step towards the ink while the plate shows, which is what keeps the panel as thin as it is. The picture covers rather than stacks — `.card-pic` is `inset: 0` with `object-fit: cover`, and the city card's `cover.hero` SVG is sized off the card's height and allowed to run past its sides — so a card measures the same height resting and revealed and the grid never shifts under the pointer (asserted in the verification pass over all 25 cards, none drifting; the first measures 264.25 px both ways). The text moved into a new `.card-body` wrapper in `app/src/views.ts` and its twin in `app/prerender.ts`, which the panel is drawn against; since that wrapper is now the stretched link's containing block, `.card-go::after` carries the card's own padding negated so the title still covers the whole card, and the key block keeps its `z-index: 1`, so a slot chip inside a revealed card still navigates to the filtered index. Without a pointer there is nothing to answer: under `@media (hover: none)` the picture keeps its old place above the text, the panel is not drawn and the stretched link returns to `inset: 0`. The 160 ms opacity transition is declared only under `prefers-reduced-motion: no-preference`.
- 2026-09-12, late, no rev clause: a card's keys are an icon row and the KEY INDEX is its legend. The keys are one line of hairline-separated cells drawn in KEYS order minus the blanks — the subject's icon, the basis beside it as detail text where the plate is a city (`MEASURED`, `DELIVERED`, `REAL 3D ISOMETRIC`), the projection's glyph, and the interactive lamp — with no field names and no words on any cell but the basis: a key the plate does not carry draws nothing at all, so the row is exactly as long as the plate is, and every cell is still the `uiSref` filter link it was, `uiSrefActive` echo and all, named for a reader by `aria-label` and by `title`. The icons are named once, in the cover's KEY INDEX, where every value chip now draws the same symbol ahead of its word — the filter block and the cards read as one system, and only the ALL chips, `static` and the basis phrases, which are drawn nowhere, stay words. One inline `<symbol>` sprite carries all nineteen, built once per page from `app/src/icons.ts` into the app shell and the prerendered twin and referenced by `<use href="#ic-…">`, so nothing is fetched at runtime and no icon package is installed: ten subjects and the mode lamp are Lucide line drawings (ISC), their 24-grid paths restroked onto the house's 16 viewBox through a `scale(2/3)` group at a stroke that lands on 1.3; the six projection glyphs are the house's own, unchanged; `register` (a punched card) and `spine` (a bar with three ribs each side) are drawn here, because no stock set has either. Icons draw at 14 px on a card and 12 px in a chip, the basis detail at 10 px tracked 0.11em in the data face, all of it on the theme tokens. The row keeps its `z-index: 1` and takes a 70% paper ground so it reads over a revealed plate. The colophon credits Lucide.
- 2026-09-12, late, no rev clause: the KEY INDEX filters the cover in place. A chip re-enters `atlas.gallery` — the state is deliberately not `dynamic`, so a filter change re-renders the page the reader is already standing on — and the app stopped treating that as a page change: no scroll to the top and no sheet-to-sheet view transition, while every other shape (gallery to sheet, sheet to sheet, sheet back to index) keeps both exactly as before. The rule is one exported predicate, `isIndexFilterChange(transition)` in `app/src/router.ts`, true when from and to are both `atlas.gallery`; ui-router's hook criteria can match a pair but have no form for excluding one, so the slideshow in `app/src/experimental/view-transitions.ts` tests the same function's inverse in its `onBefore` snapshot and in its no-API fallback rather than restating the rule. Holding the scroll takes more than skipping the call: a shorter filtered index can collapse the document and let the browser clamp `scrollTop`, so `holdScroll()` records `scrollY` and restores it once lit has finished the `ui-view` swap, awaited on the hosts' own `updateComplete` and not on a timeout — inlined in `router.ts` rather than importing `experimental/view-rendered.ts`, because nothing in `src/*.ts` may depend on the experimental layer. `document.title` still updates on every transition.
- 2026-09-12, late, no rev clause: the cover's cards are windows onto one geometry. The card is a fixed stack again — a 259 × 150 picture box across its head, then number line, title, scale, a three-line caption, meta and the key row — and hover and focus change one property, an opacity: every descendant of all 25 cards measures identically at rest and hovered. The floating panel of the same day is retired; it held the grid's box constant but still reflowed the caption and floated a panel under the type, which is layout shift where the reader is looking. The box now draws only a translucent tint (`color-mix(in oklab, var(--paper) 28%, transparent)`) and a 1 px `--line` foot rule, the card itself carries no background and the paper moved to `.card-body`, so the window is a hole; the theme pair of `<img>`s and the city's hero SVG sit in it at `opacity: 0` and fade to 1 in 160 ms under `prefers-reduced-motion: no-preference`, over the tint, and under `hover: none` they stand there at rest. `.card-go::after` is back to `inset: 0` and the key row keeps its `z-index: 1`. Behind each grid, `app/src/lattice.ts` defines `<atlas-lattice>` and draws one wireframe cube lattice on a canvas — orthographic, one turn about the vertical axis every 90 s under a 21° pitch, well off the plates' 30° isometric; 124 px footprint, 96 px rise, two levels, `--ink` at 22%, 1 px, round joins, ~1,300 segments in a single path per frame, hand-written projection and no three.js, which stays loaded on demand for the city alone. It is seen ONLY through the windows: each frame clips to the union of the cards' `.card-pic` rects, so nothing paints in the 14 px gaps or in an empty track, and because it is one field in one set of coordinates a line leaving one window enters the next on its true path. The canvas is one viewport tall and sticky inside the field, its offset down the field turned into a ground translation taken modulo the cell — the same infinite lattice, at the viewport's cost rather than the grid's. The loop pauses on a hidden tab and on an `IntersectionObserver` miss, holds one angle (37°) under `prefers-reduced-motion: reduce`, re-reads its ink from computed `color` on `data-theme` and `prefers-color-scheme`, sizes to DPR, and re-measures the windows on a `ResizeObserver` and a `MutationObserver`. Prerendered, the tag is an inert unknown element and the window is its tint; `main.ts` defines it on the client, artifact build included.
- 2026-09-12, late, no rev clause: the catchword is dropped, on the user's word — "the catchword just isn't dialed in yet -- drop it everywhere". The CONDENSED wordmark is now the `sup.art` superior article (0.6em lowercase DIN, the same superior the sheet titles carry) followed by ALTITUDE ATLAS in the display face (`.project-mark`, 1.06em), and it draws identically on every host: the HWT Catchwords key `e`, the `html[data-catchwords="on"] .cw::before` and `.cw sup.art` rules, the `.cw` wrapper in all three `PROJECT_MARK` emitters (`generator/chrome.mjs`, `app/src/views.ts`, `app/prerender.ts`) and the FontFaceSet guard script in both its copies (`chrome.mjs`'s `CATCHWORD_SCRIPT` and its twin in `app/index.html`) are all gone. The 20px flat, `vertical-align: sub` tuning of 2026-09-11 was the last try. The type specimen keeps its CATCHWORD rows: the study stays, the shipped treatment does not. FULL UPPERCASE on the rail head and the cover title is untouched, as is the Adobe kit injection — `hwt-catchwords` is simply no longer asked for outside the specimen.
- 2026-09-12, late, no rev clause: the lattice is sparser, slower and dotted, and the card's text sits on a translucent panel. The user's words: "the index card animation is cool but too much. thinking sparser slower -- make the text always on translucent panel so it shows behind", with "maybe dotted lines for the lattice too". `app/src/lattice.ts` keeps two levels of cubes and its 21° pitch but widens the footprint from 124 px to 220 and the rise from 96 to 160, drops the ink from 22% to 16% alpha, and takes 240 s for one turn about the vertical axis where it took 90; the line is dotted, `setLineDash([1, 3])` at 1 px under a round cap so each dash lands as a round point on a 4 px pitch, with `lineDashOffset` pinned at 0 so the phase belongs to the path and the dots never crawl between frames. `.card-body` now carries the paper mixed rather than flat — `color-mix(in oklab, var(--paper) 76%, transparent)`, and `--paper-2` at the same 76% hovered or current — and the clip follows it: each frame clips to the union of the whole `.card` rects, not the `.card-pic` rects, so one field runs under the window and under the writing alike, unbroken across the rule between them, while the 14 px gaps and the empty tracks stay pure ground. The window keeps its lighter 28% tint and so still reads as the thinner pane within the panel. Over `--ground` the caption at `--ink-soft` measures 5.36:1 in vellum and 6.24:1 in cyanotype (5.07 and 6.91 on the hovered `--paper-2` ground, 5.03 and 5.64 where a lattice line runs under the letters), and the key row's 70% paper ground is unchanged. Hover and focus are still one opacity: all 25 cards were walked rect by rect on the built `dist` at 1400 and no descendant moves, the plate is 0 at rest and 1 hovered, focused or under `hover: none`, a key chip inside a hovered card still filters the index, a gap still hits the grid rather than the canvas, the loop still flattens off screen, and under `prefers-reduced-motion: reduce` two frames six seconds apart are identical.
- 2026-09-12, late, no rev clause: the superior article is dropped from the ledger wordmark, and the atlas has ONE name again. The user's word, and the whole reason: "hmm seems the altitude atlas is back to superior the -- want no special treatment just uppercase everywhere now". Where the sheet-head PROJECT line and the title block's PROJECT value drew `<sup class="art">the</sup>` before the name, they now draw the name whole — `<span class="project-mark">THE ALTITUDE ATLAS</span>`, plain uppercase in the display face, the same mark the rail head and the cover title have always carried. There is no CONDENSED variant left to distinguish: one wordmark, four sites, and only the size differs — `.project-mark` keeps its measured 1.06em so the name's cap still sits on the ledger line's (12.19 px of display beside 11.5 px of data in a sheet head, 14.31 px inside the 13.5 px `.dsp` in a title block). All three `PROJECT_MARK` emitters moved together (`generator/chrome.mjs`, `app/src/views.ts`, `app/prerender.ts`), so the site, the flat set and the artifact draw the mark identically, as they did through the catchword's removal the same day. The T9 article is untouched where it belongs: every sheet title still opens with the `sup.art` superior ("the MEASURED CITY"), the cover cards still carry it, and the title block's SHEET TITLE field still sets `the` inline in lowercase DIN at the value's own size. Verified on the built `dist` at 1400: sheet 7's `.proj` reads "THE ALTITUDE ATLAS — DRAWING SET" and its title block `.dsp` "THE ALTITUDE ATLAS", neither holding a `sup.art`, while `.sheet-title` still holds exactly one.
- 2026-10-04, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ 4dc0cbb7 (commit 2026-10-04), the thirteenth refresh, all 17 plates re-run at the one ref — `lit-ui-router` 1.16.1 and 1.16.2 (#1103, #1116), `lit-ui-router-ssr` 0.2.0 (#1117), `lit-ui-router-effect` 0.2.0 (#1118), `lit-ui-router-mobx` 1.1.0 (#1119) and `eslint-plugin-lit-ui-router` 1.2.0 (#1120). Between 6d41d21e and the ref, main delivered the placeholder router's upgrade to subscribers (#1082, #1099, #1100, #1113), which put `router-subscription.ts` in the flagship and sends the companions' seek over `context-request` first, and added `@tools/repo-checks#check:package-coverage` (#1090). No member was born, renamed or removed: 39 members, seven published. The general survey reads 853 tracked paths, 818 classified, 74,083 sloc (was 845 / 810 / 71,286). The registry, re-read after the last release workflow finished, serves all five releases under `latest`, published 2026-10-04: LATEST SHIPPED reads `1.16.2 · 2026-10-04`, PUBLISHABLE PACKAGES reads eslint-plugin 1.2.0, lit-ui-router 1.16.2, effect 0.2.0, mobx 1.1.0 and ssr 0.2.0; 7 package quarters, 22 doors. The frame audit read 0 viewBox escapes and 8 lettering-over-mass hits above 1 px over the set at the old ref (3B's title block under the guard house, sheet 7's №35 schedule row, 7B's typedoc caption) and 4 and 37 once the plates moved; the moves recorded under sheets 2, 3, 3B, 7, 7A, 7B, 11 and 13 bring it to 0 and 0. The T3 chain ran about 5½ min warm. Thumbs re-shot for every plate the census moved, `bricks` and `a3` included.
- 2026-10-03, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ 6d41d21e (commit 2026-10-03), the twelfth refresh, all 17 plates re-run at the one ref — `lit-ui-router-ssr` 0.1.1 (#1037), on npm 2026-09-29 under `latest`. Between 63c0b823 and the ref, main replaced turbo's `with` sidecars with umbrella tasks (#1038) — `lint`, `typecheck` and `format:check` are script-less umbrellas over the leaves `lint:oxlint`, `typecheck:tsc` and `format:check:oxfmt` in every package — added `@tools/repo-checks#check:single-version` (#1036), a root `//#lint:complexity` ceiling (#1058), the report-only `@tools/crap` (#1056), the ssr hydration signature (#1070) and the eslint plugin's `allowElementParts` (#1068). ONE member was born: №39 `@tools/crap` (tools/, private) — 39 members, seven published. The general survey reads 845 tracked paths, 810 classified, 71,286 sloc (was 823 / 788 / 68,351). LATEST SHIPPED reads `1.16.0 · 2026-09-28`; PUBLISHABLE PACKAGES reads ssr at 0.1.1; 7 package quarters, 22 doors. The city card describes the 3D lane's translucent walls and the working plant on each roof.
- 2026-10-04, no rev clause: every figure carries a FILL WINDOW button. The user's word: "most figures could benefit from a focus / full screen / fill window view so their window can be size appropriately on big displays". A `.fillable` box (every plate, the four cytoscape lanes' stages, the city and plant stages, the bricks frame) carries one `.fill` button; the page answers it once, by delegation — `FILL_SCRIPT` in `chrome.mjs` for the flat set, `src/fill.ts` in the app — asking the browser for fullscreen on the box and, where that is refused, pinning the box over the page as `.is-filled` under `html.has-filled`. The same button, or Escape, leaves. A filled plate is centred and takes the window's width under its own `--plate-ar`; a lane's graph, the city canvas and the bricks viewer take the window's height, and the lanes refit on the `atlas-fill` event the box dispatches (with a window `resize`). A plate's button hangs in the margin above its top-right corner, because the lettering reaches the corners; the stages carry theirs inside. Thumbs are unchanged: they photograph the figure, never the box.
- 2026-10-04, no rev clause: the cover's cards show their pictures at rest, and the lattice is gone. The user's word: "let's drop the lattice animation from the index cards despite how cool it was and standardize around the images now … each card should have its thumb on in the gallery". `src/lattice.ts` and the `<atlas-lattice>` field wrappers are deleted; the card is four layers — a gradient ground (one of six, paper tinted by the page's own accent, red and ink tokens through `color-mix`, cycled down the grid by position so they follow the theme), the plate's picture over it, the clear head window, and the body in opaque paper. The hover reveal is gone with the lattice: nothing in a card moves.
- 2026-10-04, later, no rev clause: the figure button reads ENLARGE, and in the app it opens `<atlas-lightbox>` (`app/src/lightbox.ts`), one Lit element on the body that takes a plate fitted to the viewport with 2D zoom and pan (wheel, pinch, drag, double-click, arrow keys, −, +, FIT, 1:1) and lays only CLOSE and FULL SCREEN over a stage. The user's words: "more of a lightbox full viewport on the diagram with 2d zoom and pan controls as appropriate", "design as its own lit component", and on the label, "fill window is accurate but maybe something clearer". The box rides the url as `?enlarge=<figure id>`, a dynamic uninherited param beside `?focus`, pushed on open so Back closes it; the user's pick among the routing options: "option 1 go". The flat set keeps its fullscreen script under the new label.
- 2026-10-04, later, no rev clause: the rail folds the sheet list into altitude bands, native `<details>` with a drawn caret — ONE PACKAGE, COMPANIONS, MONOREPO, ECOSYSTEM, SURVEY QUARTET, PR CI GRAPH, APPENDIX — sheets 11 and 13 standing alone; the current band open on every page, a viewer's own clicks remembered under `atlas-rail-open`. The user's word: "the sidebar needs vitepress-esque grouping with collapsed sections to avoid overwhelming".
- 2026-10-09, no rev clause: an axe-core 4.13 pass over the published pages, light and dark, reads clean on every rule it raised (colour contrast, a scrollable region without focus, an empty table header, a pin too close to its neighbour, and on the flat set a page without a language, a main landmark or a sound heading order). The faint ink is `#626760` on vellum and `#8099BA` on cyanotype, 4.7:1 and 4.9:1 on the paper (from 2.35 and 3.9), and the key index's chip counts wear it rather than a 65% copy of the chip's ink. A plate's `.figure-wrap` is a focusable, named group with a drawn focus ring, so a keyboard reaches its sideways scroll. The survey table's bar column carries a hidden header. The four lanes' read panels head at `<h3>` under the lane's `<h2>`. Appendix A1's plate is a `group`, not an image, so its credit links are reachable. The flat set's pages are whole documents — doctype, `<html lang="en">`, `<head>`, `<body>`, one `<main>` — and render in standards mode, which only sets the survey table's rows taller. The audit came from a sibling session's axe run over the live site; the re-run after the fixes covers the same eleven pages plus A1 and 2B.
- 2026-10-09, later, no rev clause: the stylesheets follow the good-css rules, in two commits at the user's word ("yeah lets go"). First the hygiene: logical properties throughout, every hover behind a hover-and-fine-pointer query with its keyboard twin outside, focus rings of max(2px, 0.08em) accent, a press state on every pressable with its transition inside the reduced-motion query, transitions that name their properties and ease with `--ease-out`, overflow that clips unless an ellipsis or a line clamp needs hidden, tabular figures on numbers only, balanced headings and pretty prose, a reset of min-width 0, a stable scrollbar gutter, break-word, touch-action and the colour-scheme meta; font-synthesis stays on, since the prose face loads at one weight and the notes set `<strong>`. Then the tokens: one set on `:root` as `light-dark(oklch(), oklch())`, byte-identical to the hex values they replace, `color-scheme: light dark` with the `data-theme` stamps setting `light` or `dark`, so the three states hold and the themer, the Artifact host's stamp and the OS all land on the same side; the halo is `color-mix(in oklch, var(--accent) 10%, transparent)`, 12% in the dark. Because a token is now a `light-dark()` expression rather than a hex, every script that read one (`mv-kit.mjs` for the model tints, the four lanes for cytoscape, `check-scenes.mjs`) resolves it through a probe element's computed colour and parses `oklch()`; cytoscape receives `rgb()`. The brick legend's swatches and the lit pin's ink are oklch literals because they match colours baked into the glTF, not the page's tokens. The docs site's own pass (#1160, #1161) kept its hex palette.
- 2026-10-09, later still, no rev clause: the rail reads in one face. The user: "the fonts aren't working (visually) for me in the sidenav now. the flw font is hard to mix and stagger like that." The altitude bands of 2026-10-04 had set their summaries in the data face at 10px while the sheet entries kept the Exhibition title face at 12px, so the top level of the rail staggered DIN rows (ONE PACKAGE, SURVEY QUARTET) against Exhibition rows (ENTRY QUARTERS, WEATHERING MAP). A band summary now takes the entry treatment: the number in the data face, accent, 600, tabular; the label in the title face at 12px, 600, 0.04em. The shut-band dimming and the open-band ink stay, as does the narrow rail, which shows numbers alone.
- 2026-10-09, later still, no rev clause: the bricks plate's viewer fills its stage. The user sent a screenshot of `/bricks?focus=6` at a wide viewport ("wat"): the model stood in the left two thirds of the stage and the right third was bare paper. The brick scene has taken `laneCss('bk')` for its bar chrome since it stood in the round (2026-10-04), and that stylesheet lays a lane stage out as two columns, the graph and a `clamp(300px, 1rem + 25vw, 400px)` info rail; the bricks stage holds only the viewer, so the second column sat empty above 860px. `.bk-stage` is now `display: block`, and the viewer measures the whole stage at 2000 and 1280 wide; the 84 scene checks hold.
- 2026-10-09, later still, no rev clause: the walked lanes paint their panel at boot. The user: "https://atlas.lit-ui-router.dev/sheet/1i/ often shows cytoscape did not load message." An agent traced it: the prerendered page carries the lane's inline script, so the parser runs it once before the app has loaded cytoscape and that run writes the fallback into the panel; the app's rerun after `loadCytoscape()` drew the graph but `apply()` returned early with no pin set, before `walkTo()` could paint, so the fallback stood beside a working canvas on every direct load without a focus (10 of 10 cold, warm and throttled), and never on rail entry, with a focus, or on the flat set. The loop walk now calls `walkTo(0)` before `apply()`, and the register lane `show(null)`, so the at-rest panel is painted unconditionally; six of six cold loads of 1i, 1i with a focus, 12i and the flat 1i paint it. `col()` was not involved.
- 2026-10-10, no rev clause: the cover carries the client's mark. The user: "i want the fancy homepage hero image with filtered color fx etc featured somewhere in the atlas too." The docs site's home hero draws the lit-ui-router logo over the Lit flame, blurred and brightened in light and hue-turned, inverted and dimmed in dark, the logo multiplied over it or adding light. The cover's name block is now a grid, the name and its stamp at the start and the mark at the end (beneath, centred, under 640px): `generator/brand.mjs` carries the two SVGs from `www/lit-ui-router.dev/public/images/` as data URIs through `app/src/generated/brand.js`, so the prerender, the site and the artifact draw them with no request; the glow overhangs the logo by a quarter, the filter stack follows the scheme through the same two-rule pattern as the cards' pictures, and the caption links the docs site. Verified in chromium and webkit, light and dark, at 1280 and 480.
- 2026-09-29, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ 63c0b823 (commit 2026-09-28 PDT), the eleventh refresh, all 17 plates re-run at the one ref — `lit-ui-router-ssr` 0.1.0, on npm 2026-09-29 under `latest` (#1026) after 0.1.0-rc.4 (#1025), with its `rc` tag gone; the flagship's `rc` tag is gone too, so every published package is served under `latest` alone. Between 9b1b1bf3 and the ref, main also taught ssr to settle a server router on a path before rendering (#1010, a new `settle.ts`), to report a served view's hydration outcome as a value (#1020) and to warn on two prerender mistakes (#1021, #1022); declared `@oxc-project/runtime` as an ssr dependency (#1024); added a weekly lockfile audit workflow (#1015); installed only the release closure in publish-npm (#1009); and moved pnpm settings (#1011–#1017, among them a `check:dedupe` lint lane). NO member was born or renamed — 38 members, seven published. The general survey reads 823 tracked paths, 788 of them classified, 68,351 sloc (was 820 / 785 / 67,260). LATEST SHIPPED still reads `1.16.0 · 2026-09-28` with no `main at` clause; PUBLISHABLE PACKAGES reads ssr at 0.1.0. The quarters and doors derive from `census-doors.json` as before: 7 package quarters, 22 doors. The frame audit read 0 viewBox escapes and 0 lettering-over-mass hits above 1 px before the build; after the plates moved it read one — sheet 9's SCALE line under the grown html-pages cap — which is fixed, and the final audit reads 0 and 0 again. basis.mjs installed the ref with the worktree's mise-provisioned pnpm 12.3.4, which ignores the ref's new `autoDedupe` and `trustPolicyExcludePrune` settings with a warning; the frozen install succeeded.
- 2026-09-28, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ 9b1b1bf3 (commit 2026-09-28), the tenth refresh, all 17 plates re-run at the one ref — `lit-ui-router` 1.16.0, on npm 2026-09-28 under `latest` (#1005), with `rc` still pointing at 1.16.0-rc.3 behind it. The ref is two commits past the release: the examples take `^1.16.0` (#974) and `lit-ui-router-ssr` peers the released `^1.16.0` (#1006). Between fe44598e and it, main also cut 1.16.0-rc.2 (#987) and rc.3 (#1001), `lit-ui-router-ssr` 0.1.0-rc.3 (#988), `lit-ui-router-effect` 0.1.2 (#1000) and 0.1.3 (#1004), and `ui-router-navigation-location-plugin` 1.0.1 (#984); `<ui-view>` adopts a late provider's router before its first render (#990); the effect bindings read the scoped router (#994), which renamed the peer catalogs to `publishedPeerEffect` / `publishedPeerMobx` / `publishedPeerSsr`; the release tool packs in place with a `beforePacking` hook (#995); and the eslint plugin proves a 9.0.0 floor in its own lane (#1002). NO member was born or renamed — 38 members, seven published. The general survey reads 820 tracked paths, 785 of them classified, 67,260 sloc (was 819 / 784 / 66,533). The version guard passes on the `latest` tag now, so LATEST SHIPPED reads `1.16.0 · 2026-09-28` with no `main at` clause: the clause prints only when the repo's version is served under a tag other than `latest`, and here it is not. PUBLISHABLE PACKAGES reads the flagship at 1.16.0, effect 0.1.3, ssr 0.1.0-rc.3 and the plugin 1.0.1. The quarters and doors derive from `census-doors.json` as before: 7 package quarters, 22 doors. The frame audit ran before the build and after: 0 viewBox escapes and 0 lettering-over-mass hits above 1 px both times; on 7B the lint plugin's 0.6 px piece is now 0.89 px and the typedoc-plugin callout touches a grown block by 0.73 px, both under the 1 px bar.
- 2026-09-26, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ fe44598e (commit 2026-09-25), the ninth refresh, all 17 plates re-run at the one ref — `ui-router-navigation-location-plugin` 1.0.0, on npm 2026-09-26 under `latest` with no `rc` tag beside it (was 0.3.2 of 2026-09-13), released through 1.0.0-rc.0 (#973) and 1.0.0 (#976). Behind it on main, six commits and every one the plugin's: the service intercepts the navigations it starts (#946), the public surface settled for 1.0 (#965 — `composeNavigateUrl` left the barrel for its own `src/compose-navigate-url.ts`), and two README passes (#968, #967). NO member was born or renamed and no core file changed — 38 members, seven published — and every label on the set that counts them was read true again. The general survey reads 819 tracked paths, 784 of them classified, 66,533 sloc (was 818 / 783 / 66,257). PUBLISHABLE PACKAGES prints the plugin at 1.0.0, read from `census-files.json` as always. The version guard asks only that the repo's `lit-ui-router` version be served under some dist-tag, and it passes untouched: LATEST SHIPPED still reads `1.15.0 · 2026-09-14 · main at 1.16.0-rc.1 · rc`. The quarters and doors derive from `census-doors.json` as before: 7 package quarters, 22 doors. The frame audit ran before the build and after: 0 viewBox escapes and 0 lettering-over-mass hits above 1 px; the one 0.6 px piece on 7B is the eighth refresh's, unchanged.
- 2026-09-26, no rev clause: the app takes `ui-router-navigation-location-plugin` at `^1.0.0` (from `^0.3.2`), whose service intercepts the navigations it starts (#946, closing #945), so the app's own `navigate` listener in `app/src/router.ts` is deleted. The plugin's new `intercept` option carries the one thing the app still says about those navigations: `scroll: 'manual'` when the tail of `router.globals.successfulTransitions` is an index filter change (`isIndexFilterChange`), `'after-transition'` otherwise — the option is called after the transition committed, so that tail is the navigation's own transition. That retired `holdScroll()` (the 2026-09-12 note above): the browser's push scroll-to-top was the fight it won, and the ui-view swap was measured not to collapse the document on the way. Measured at 1400 × 900 against the built `dist` with Playwright: chip clicks from `scrollY` 600, 900 and 2000 hold exactly, with no scroll event during the swap, under the Navigation API and with it deleted (pushState fallback); a card into a sheet lands at 0; rail clicks, back and forward stay same-document (a window marker survives, no `load` or `pagehide`), and `navigation.currentEntry` matches `router.urlService.url()`. With `scroll` left at `'after-transition'` and no hold, the same chip lands at 0.
- 2026-09-23, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ 38c9fa1c (commit 2026-09-22), the eighth refresh, all 17 plates re-run at the one ref — the `lit-ui-router-mobx` 1.0.2 and `lit-ui-router-effect` 0.1.1 releases, both on npm 2026-09-21 under `latest`, effect's `rc` tag gone with it, and two release candidates under `rc`, `lit-ui-router` 1.16.0-rc.1 and `lit-ui-router-ssr` 0.1.0-rc.2. Behind them on main: the hydration seam lifted out of `ui-view` into the ssr served view (#941), the ssr register entry (#940), the workspace-catalog experiment merged and reverted (#950, #961), eslint 10, ubuntu-26.04 runners, turbo 2.11.2, pnpm 12.5.1 and node 24.21. NO member was born since 4223ffc7 — 38 members, seven published — and every label on the set that counts them was asserted and read true. The general survey reads 818 tracked paths, 783 of them classified, 66,257 sloc (was 789 / 754 / 62,036). The cover's one edit is its version guard, and it threw: `build.mjs` held the repo's `lit-ui-router` version against npm's `version`, which is the `latest` TAG, so the moment main carried 1.16.0-rc.1 against a latest of 1.15.0 the build stopped. The guard now requires the repo version be served under SOME dist-tag in `census-npm.json`'s `tags` map — still a hard throw — and LATEST SHIPPED reads what shipped, then where main stands: `1.15.0 · 2026-09-14 · main at 1.16.0-rc.1 · rc`. The quarters and doors derive from `census-doors.json` as before: 7 package quarters, 22 doors. The frame audit ran before the recompositions and after — the same SAT lettering check, tmp tooling — and the set closes at 0 viewBox escapes and 0 lettering-over-mass hits above 1 px; one lettering piece on 7B stands 0.6 px into a mass, new this refresh and inside tolerance.
- 2026-09-14, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ 4223ffc7 (commit 2026-09-14), the seventh refresh, all 17 plates re-run at the one ref — the `lit-ui-router` 1.15.0 and `ui-router-server` 0.2.0 releases, both on npm 2026-09-14, the prerender stack behind them (#806), and two release candidates under npm's `rc` tag, `lit-ui-router-effect` and the new `lit-ui-router-ssr`, both 0.1.0-rc.0. ONE member was born since 9896b3c1 — №38 `lit-ui-router-ssr`, the prerender bridge, `ui-router-server` verdicts in and `@lit-labs/ssr` pages out — and №37 `lit-ui-router-effect` flipped private → public with it, so the district ships SEVEN published packages where the sixth refresh's true sentence was five. Every five on the set was re-derived or re-lettered: sheet 11's altitude reads SEVEN PACKAGES, sheet 2A's SIX PACKAGES, sheet 4's bay gate `all five`, sheet 2 schedules six moulded bricks and draws four, and this cover's own paragraph derives its quarters and doors from `census-doors.json` — 7 package quarters, 20 doors. The general survey reads 789 tracked paths, 754 of them classified, 62,036 sloc (was 757 / 723 / 58,995); `SHEET8_TIMES` holds at 277× and the wire shares at 22.2% / 4.3%, the consumer's own source being unmoved. The frozen “has grown” paragraph keeps its own five quarters and sixteen doors, which is what a rev-history figure is for. A full-set frame audit ran after this record: a SAT lettering check over all 20 SVG plates — tmp tooling, not a generator station — found type standing on grown masonry on NINE of them (2, 3A, 7, 7A, 7B, 9, 11, 13, 14), and one hand table with no gate at all, 7A's `NOTE`. Every hit is recomposed; the set closes at 0 viewBox escapes and 0 lettering-over-mass hits above 1 px, and 40 of the 48 card pictures were re-photographed for it (1i, 5, 6 and A1 unchanged).
- 2026-09-13, no rev clause (the cover narrates in prose only): the cabinet refreshed to origin/main @ 9896b3c1 (commit 2026-09-12), the sixth refresh, all 17 plates re-run at the one ref — the 1.14.0 release (#853) and the five patch releases behind it (#860–#864, every published package of the family on npm the same day), the `srefHref` attribute directives (#827), the `SrefStatusController` (#830), the eslint plugin's new rules (#828), the typedoc-plugin trims (#831/#832) and its notDocumented work (#850–#852), and the Effect pair — the sample app (#721) and the bindings package (#833/#855). TWO members were born since 2ac53a0, the first since the fourth refresh, so the new-member checklist ran for real: №36 `sample-app-lit-effect` and №37 `lit-ui-router-effect` took a row in every one of the five hand tables, and one neighbour moved for them — №2 `ui-router-server` off 200 to 222 on sheets 7 and 13, because `assertPlots` threw when lit-ui-router's annex grew into its west wall. `lit-ui-router-effect` is `"private": true` at this ref, so it takes no brick, no door, no coupling and no npm row, and FIVE PUBLISHED PACKAGES is still the true sentence. The general survey reads 757 tracked paths, 723 of them classified, 58,995 sloc (was 695 / 664 / 52,768). The honesty sweep found five present-state claims the new plates contradicted, all now plate-derived: sheet 9's skyline ranking and the gallery prose's “prose and fonts outweigh every line of code”, which the examples district has overtaken the fonts to falsify; sheet 8's declared hand count of the consumer's own source, 592 → 646 lines, which drops `SHEET8_TIMES` from 300× to 277×; sheet 7B's rust step for the typedoc plugin, R4 → R3, which leaves the plate with no R4 at all; sheet 7's “all five packages” roads, now counted off the district; and sheet 13's “did not exist two months ago”, false at 69 days. The frozen “has grown” paragraph keeps its own old figures, which is what a rev-history figure is for.
- No lettered revisions: the cover narrates change in running prose only.
- Basis: origin/main @ 185d414, counted 2026-09-07 (`COUNTED_AT` / `COUNTED_ON`, from `diagrams/data/census-files.json`; city and shadow plates at the same sha).
- The "has grown" paragraph was first written 987f909 2026-08-17 and last touched cf45bb0 2026-09-07. Its pinned figures: 297× (`node_modules` over the app it serves), 22.5% / 3.9% (sheet 10's wire shares), 84% (the lodash chunk cut), #618.
- Dated claims elsewhere on the cover: `eslint-plugin-lit-ui-router` graduated to `packages/` 2026-09-02, after sheets 1–13 were first drawn; the sheets were drawn 2026-08-16–17 and the survey office added 2026-09-03; since 2026-09-06 every label on the plates draws in the data face (DIN 2014 / Barlow Semi Condensed) and mono is reserved for code; "Generated 2026-08-16 by Fable (Claude, AI)".
- The issue log rode the cover's right-hand column until 2026-09-06, where it pushed the sheet index off the first screen; it has had a page of its own at `/log` since. The cover keeps a `LATEST` band rendering `manifest.issueLog[0]`.
- `splitRevs()` in `chrome.mjs` states the freeze rule the whole record depends on: "each sheet's `sub` is written once, at the revision it records, and never edited."

## Sheet 1 — THE RENDER LOOP

- **file** `diagrams/generator/sheet1.mjs` · **id** `package` · **current rev** H
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 1 — lit-ui-router 1.11.2 · the client circuit

### REV D — undated in the copy; first in git 2026-08-16

**`sub` clause** (verbatim source):

> REV D: the loop routed on the iso grid

**other rev-bearing copy** (`sheet1.mjs`):

> caption: 'Rev D puts the loop on the ground: every leg is a road that turns along the iso axes and stops short of the wall it points at. The city still breaks its metaphor once, on purpose: the document is not a building — it is a browser window whose DOM rises in plates. The core matches, the hall runs its hook bays, Lit commits onto a layer, and a click on the topmost plate flies back to location.',

### REV E — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV E: the version reads census-files.json — 1.9.0 was a hand-typed relic

### REV F — 2026-09-06

**`sub` clause** (verbatim source):

> REV F 2026-09-06: fills — every block’s left face and the Tilt plates’ flanks now carry their paper-2 tint, and the right faces their hatch (a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); no geometry moved

### REV G — 2026-09-06

**`sub` clause** (verbatim source):

> REV G 2026-09-06: the five doors re-cut — each frame tightened to the DIN line it now carries (144 → 116 wide) and the strip hung on the right end of the footer rule, so the band reads title left, doors right instead of trailing 200px of empty paper

**Record notes**

- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the lead reads lit-ui-router 1.16.0 (was 1.16.0-rc.1) from `census-files.json`, and the door strip re-prices off `census-doors.json`: `.` 8,719 → 8,837 gz, `./pure` 8,678 → 8,680, `./register` 3,389 → 3,508, `./context` 718 unmoved — #990 moved the router adoption into `willUpdate`.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: nothing on the sheet moved. The lead reads lit-ui-router 1.16.0-rc.1 from `census-files.json`, and the six doors re-read off `census-doors.json` at the same prices — `.` 8,719 gz, `./pure` 8,678, `./register` 3,389, `./context` 718 — no flagship file having changed. Only the title block's date and ref advance.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the lead reads lit-ui-router 1.16.0-rc.1, read from `census-files.json` as always — the repo's version, which npm serves under `rc` while `latest` stays 1.15.0. The six doors re-priced on #940 and #941: `.` 8,206 → 8,719 gz, `./pure` 8,139 → 8,678, `./register` 2,837 → 3,389, `./context` 633 → 718. The circuit and every station are unchanged.
- 2026-09-14, REV H (the `sub` carries no REV clause — the copy has been present-state since the rev G pass): the door strip is SIX doors, `./context` joining the five the footer has carried since rev G, and the band is re-cut to hold it. The lead reads lit-ui-router 1.15.0 from `census-files.json` as always; the circuit and every station are unchanged.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the lead reads lit-ui-router 1.14.1, read from `census-files.json` as always. The circuit, the five doors and every station are unchanged; only the version and the title block's date moved.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the lead reads lit-ui-router 1.13.0, read from `census-files.json` as always. The circuit, the five doors and every station are unchanged; only the version and the title block's date moved.
- REV D — 2026-08-16 (b2f972f "docs: route sheet 1 arrows as iso roads and re-mass sheet 4 from sloc x files") · REV E — 2026-09-03 (1ff332a "feat: census pipeline — sheets 1, 2A and 3 cite plates, last relic numbers retired") · REV F and REV G — 2026-09-06, dated in their clauses.
- Superseded figures: rev E retired the hand-typed `1.9.0`, and the altitude line prints `${LIT_V}` [1.11.2]; rev G recut the door frames 144 → 116 wide and reclaimed 200px of trailing paper.
- No REV A / B / C clause survives: the sub jumps from the altitude line straight to REV D.
- Basis: none stated; the altitude line reads `diagrams/data/census-files.json` for the version.

## Sheet 1i — THE RENDER LOOP, WALKED
- 2026-10-03, no rev clause: the link carries the pin as well as the step. A tapped station writes its id (`?focus=core`), a tapped leg its ends (`?focus=core>hall`), and a pin held while walking rides with the step (`?focus=3:core>hall`); opening any of those links restores step and pin, and Escape clears the pin while the lane has focus. The other three cytoscape lanes and the city link their pins the same way.

- **file** `diagrams/generator/sheet1i.mjs` · **id** `loop-walked` · **current rev** A
- **basis** (source): `const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 1 — sheet 1's circuit, stepped · one navigation walked leg by leg · 10 STATIONS · 12 LEGS · 12 STEPS · surveyed at origin/main @ 185d414 (commit 2026-09-06)

_No REV clauses, historical paragraphs or rev-bearing callouts: this plate has only ever been issued at its current revision._

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: #1082 and #1113 rebuilt `ui-view.ts`'s router seek around the new `router-subscription.ts`, and `census-loop.mjs` stopped on `ui-view.ts:503`. 31 of the 52 cites relocated by content across `ui-view.ts`, `ui-router.ts` and `transition-controller.ts` (the hall reads at ui-view.ts:534), and one re-texted: the at-rest step's `this.soughtRouter = UIRouterLitElement.seekRouter(this);` at 294 reads `this.soughtRouter = this.seekProvidedRouter();` at 309, the seek now going through `subscribeRouter()`. 10 stations, 12 legs, 12 steps, 30 evidence lines.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: no commit since 63c0b823 moved a cited line in `packages/lit-ui-router/src`, and all 52 of the loop probe's cites held on the first run. 10 stations, 12 legs, 12 steps, 30 evidence lines.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: no commit since 9b1b1bf3 touches `packages/lit-ui-router/src`, and all 52 of the loop probe's cites held on the first run. 10 stations, 12 legs, 12 steps, 30 evidence lines; only the basis line re-pins.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the probe threw on the first run — `ui-view.ts:670 does not read «render(): TemplateResult | typeof nothing {»` — because #990 added twelve lines to `ui-view.ts` above the render method (a doc block and the first-update adoption in `willUpdate`). Six citations moved, all by that uniform +12: the `render` station 670 → 682, the `render` leg and step 8's props line 689 → 701, step 5's resolvables 678 → 690 and its filter 682 → 694, step 8's resolves 684 → 696. The other 46 of the probe's 52 cited lines held, 26 of the 30 walk evidence lines among them; no expected text was loosened. 10 stations, 12 legs, 12 steps, 30 evidence lines.
- 2026-09-25, no rev clause: the lane's chrome carries restroked Lucide glyphs from the shared icon table (`generator/icons.mjs`, the one the app's card keys draw from) — `chevron-left` / `chevron-right` on PREV and NEXT in place of the ◀ ▶ marks, `rotate-ccw` on RESET, the card's own `circuit` on the at-rest head, `footprints` on THE WALK, `arrow-up-from-line` / `arrow-down-to-line` on LEGS OUT / LEGS IN. The stations are house sprites and are untouched.
- 2026-09-11, no rev clause (the copy is present-state): re-surveyed at origin/main @ 65e2843 and the `census-loop` citations relocated — 30 line numbers moved under upstream edits, and the `return this.component({` snippet is gone since #755, so the walk cites the props binding at `ui-view.ts:404` (span 3) in its place.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the probe ran clean and relocated nothing: no file under `packages/lit-ui-router/src` changed between 38c9fa1c and fe44598e, so all 30 evidence lines hold where the eighth refresh re-pinned them — 10 stations, 12 legs, 12 steps, `ui-view.ts:503` still the transition hall.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the probe threw on `ui-view.ts:311`, and this time the file had not SHIFTED — #941 lifted the hydration seam out into the ssr served view and REWROTE `ui-view.ts`, which came back longer, 698 lines. So the citations relocated by content, not by a uniform shift: 39 re-pinned and 4 re-texted, none widened — `seekParentView`'s signature at 266, `render()` at 670, `seekRouter`'s span of 2 at 294, and the `parentView` assignment at 273, which lost its `!`. `ui-sref.ts` and `ui-sref-active.ts` did move uniformly, +1; nearest-match was ambiguous once more, `ui-sref-active.ts` 333 → 334 finding two candidates, 334 and 342, and 334 is the one the shift gives. `sref-internals.ts:194`, `core.ts` and `transition-controller.ts` are unmoved. The walk's narration was re-read against the rewritten file and holds.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the probe threw again and every citation was RELOCATED, never loosened — 16 (file, line) pairs re-pinned, 0 re-texted, 0 widened, `ui-sref.ts` losing 129 lines and `ui-sref-active.ts` 104. This is the walk's first FILE move: `clickBelongsToBrowser`'s `isNativeLink(element) &&` guard left `ui-sref.ts` for `sref-internals.ts:194`, so the plate reads SEVEN source files where it read six. Nearest-match was ambiguous once — `ui-sref-active.ts:437` had two candidates, 333 and 341, and 333 is the one the uniform shift gives. Totals otherwise unchanged: 10 stations, 12 legs, 12 steps, 30 evidence lines.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: #827's `srefHref`/`srefActive` attribute directives and #830's `SrefStatusController` rewrote the files this walk cites, and the probe threw as designed. Every citation was RELOCATED, never loosened: 44 of 52 (file, line) pairs re-pinned, 0 re-texted, 0 widened — `ui-view.ts` slid 2 lines on #830's import, `ui-sref.ts` grew some 70 lines under #827, and `ui-sref-active.ts` took 7 moves. One pin was chosen by hand against the nearest match: `isNativeLink(element) &&` went 390 → 230, not to 379, because 379 is #827's new DEV `assignHref` warning and not the guard the step is about. Totals unchanged: 10 stations, 12 legs, 12 steps, 30 evidence lines over 6 files.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: #821 (a `<ui-view>` whose `<ui-router>` upgrades late) rewrote `ui-view.ts`, and the probe threw exactly as designed — `ui-view.ts:236 does not read «router.transitionService.onBefore({}, (trans) => {»`. Every citation was RELOCATED, never loosened: 41 (file, line) pairs re-pinned across `ui-view.ts`, `ui-sref.ts` and `ui-sref-active.ts`, and one expectation re-texted, because the line it named no longer exists — step 1's `ui-view.ts:197 this.uiRouter = this.uiRouter || UIRouterLitElement.seekRouter(this);` is now `ui-view.ts:207 this.uiRouter = UIRouterLitElement.seekRouter(this)!;`, the seek having moved inside `seekRouter()` behind the late-upgrade guard. Totals unchanged: 10 stations, 12 legs, 12 steps, 30 evidence lines over 6 files.
- Issued once, at REV A. Basis `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0,10)})` from `diagrams/data/census-loop.json` [origin/main @ 185d414, commit 2026-09-06].

## Sheet 2 — THE BRICK ASSEMBLY

- **file** `diagrams/generator/sheet2.mjs` · **id** `companions` · **current rev** F
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2 — one baseplate, six bricks, 51 authored files

### REV A — undated in the copy

**prose paragraph** (`sheet2.mjs`):

> <p><strong>Why bricks.</strong> Rev A drew these packages as sockets and panels and conceded the form broke. The mechanism they actually share is a <em>standardised coupling</em>: each companion attaches to <code>@uirouter/core</code> through a published extension point, none of them attaches to another, and any one can be left in the box without disturbing the rest. That is a stud, and a stud is worth drawing. So this is an exploded isometric — the LEGO instruction manual's own idiom — with a numbered part per package, a drop line onto the exact stud it takes, and a parts callout. Nothing is drawn seated, because a seated assembly hides the undersides, and the undersides are the argument.</p>

### REV B — undated in the copy; first in git 2026-08-16

**`sub` clause** (verbatim source):

> REV B: the companions redrawn as an exploded LEGO assembly, every coupling named to its API call, source ${COUNTED}

resolved →

> REV B: the companions redrawn as an exploded LEGO assembly, every coupling named to its API call, source counted at origin/main @ 185d414 (2026-09-07)

### REV C — 2026-09-05

**`sub` clause** (verbatim source):

> REV C 2026-09-05: hidden line — every brick, plate and stud face is drawn OPAQUE now (a stroke class’s fill:none was outranking the fill attribute, so the flanks were see-through: brick 1’s top edge and studs read straight through brick 3, and the second plate’s studs through brick 4), and the two masses that fault had hidden are recomposed for air — brick 3 lifts clear of the seat ring it drops onto, and brick 4 moves onto its own plate’s iso axis, its left face standing over the plate’s left edge

### REV F — 2026-10-04

**`sub` clause** (verbatim source):

> REV F 2026-10-04: the finished model joins the exploded view — the same parts seated in three steps at the drawing’s own corner, then the whole from two more corners, in a landscape of two levels — browser ground under the client plate, a server shelf under the headless plate — so the bridge spans the no-DOM line

### REV E — 2026-09-27

**`sub` clause** (verbatim source):

> REV E 2026-09-27: all ${WORD[BRICKS.length]} runtime companions stand on the plate — brick 1 lies long side to the rail’s far seats, bricks ${listOf(ON1)} step up over its cap, and brick ${BRIDGE} bridges to brick 4, whose plate comes in beside the client plate so one brick can reach both

resolved →

> REV E 2026-09-27: all six runtime companions stand on the plate — brick 1 lies long side to the rail’s far seats, bricks 3, 5 and 6 step up over its cap, and brick 6 bridges to brick 4, whose plate comes in beside the client plate so one brick can reach both

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: `lit-ui-router` re-letters 1.16.2 at 22 files / 2,752 sloc and rises to 8 courses (was 21 / 2,605, 7); effect 0.2.0 at 288, mobx 1.1.0 at 204, ssr 0.2.0 at 1,094, the plugin 1.2.0. The TOTAL reads 6 bricks · 54 authored files · 5,690 sloc (was 53 / 5,439). The eighth course put brick 1's parts icon into the PARTS heading, so the callout's rows drop 10 (brick 1 at 118, from 108). #1099 and #1100 have the mobx and effect controllers ask over stud G first, `requestRouter(host, { subscribe: true })`, and fall back to `seekRouter(host)`; the notes, schedule rows 3 and 5 and stud G's key row say so, and both seats stay drawn on F.
- 2026-10-04, REV F (census unmoved): a band under the exploded view draws the same parts seated — THE FINISHED MODEL. Three steps at the drawing's own corner (U 14): bricks 1 and 2 on the plate; bricks 3 and 5 on brick 1's cap; brick 6 bridging G to H with the second plate and brick 4. Then the whole from two more corners (U 22): the opposite one (turn 2), where brick 6 reads as a bridge and the free rail seats stay ringed, and the server side (turn 1), where the dashed plate and brick 4 stand in front with the bridge landing on H. The model stands on a landscape of two levels — a slab of browser ground one course deep under the client plate, and a server shelf under the headless plate, `GROUND + P2_UP × CRS` tall with `P2_UP = courses(1) − courses(4)`, because brick 6 seats on brick 1's cap AND brick 4's and the caps must meet; the plate's origin is the one plan point that puts stud H under the bridge (`SSR_REACH − B4_SEAT`). The band letters the two grounds (the shelf as a request runtime with no DOM, node engine read from ui-router-server's package.json, its adapters named) and that the dashed plate on it is the optional peer, reached by lazy import, while the ground is real; the key gains a ground row. The brick, plate and stud builders move to `brick-iso.mjs` as a kit at any pitch, with `seated()` (parts of kind ground, plate or brick, each standing `on` another; painter's order by axis separation, topologically sorted; covered plate studs not drawn; stud rings turn with the model) and `turnRect`/`turnStud` for the four iso corners; the exploded view draws through the same kit at U 40, unchanged but for the second plate’s studs, which take the plate’s dash as its faces always did. The sheet grows by the band (ART_H from 862 to the band's bottom + 56); the rev E clause is replaced by rev F's; the "Why bricks" paragraph says the exploded view seats nothing and the finished model is drawn seated; the index row reads "exploded, then seated". Thumb 2 re-photographed.
- 2026-10-04, later, no rev clause: the plates and ground in the round wear the page's own paper, and the viewer's empty space is a soft gradient. The user's words: "want a dark grey for the ground, maybe match theme for the base plates? … white transparent looks pretty good but very high contrast on dark mode" and "empty space overall could use more muted background, maybe soft gradient". The glTF still bakes vellum paper and ink; the scene retints the `cap`, `flank` and `edge` materials (and their ghosts at 0.45) from `--paper`, `--paper-2` and `--ink` at load and on every theme turn (a `data-theme` observer and the colour-scheme query), waiting on `ensureLoaded()` because a material only the edge lines use is loaded lazily, so the cyanotype theme stands the bricks on navy plates under light edges. `.bk-view` is a radial gradient of `--paper` through `--paper-2` to `--ground`, centred a little above the model, in both themes.
- 2026-10-04, no rev clause: the finished model stands in the round as an app-only plate, `/bricks` (`atlas.bricks`, id `bricks`, SHEET 2 · 3D, REV A, THE BRICK ASSEMBLY, IN THE ROUND), seated after 2B in the rail and the index, with sheet 2's own plates. `sheet2.mjs` exports its `MODEL` as `BRICK_MODEL` and an `EXPLODE` map — each brick's exploded hover less its seated z0, both measured from its own plate: brick 1 132, brick 2 116, brick 3 252, brick 4 88, brick 5 150, brick 6 160 plan units — and the sheet's own drawing is byte-identical. `generator/brick-glb.mjs` writes the model as one dependency-free glTF binary, `app/public/models/bricks.glb` (6,816 triangles, about 400 KB): cuboids and 24-sided studs at one unit per stud pitch, every face graded by vertex colour (the cap from its near corner across, the flanks from the top edge down), ink edges as line primitives, each brick in its own hue (cap and plain studs in it, flanks a step darker; the hue sits on the brick's row in `sheet2.mjs` and rides the badges and the pinned line), paper caps over `--paper-2` flanks on the plates and ground, accent caps on the ringed studs, the red location seat, the headless plate at alpha 0.45, one node per part named by its id, and one clip, `assemble`, 0 → 1.5 s, dropping each brick from seated + lift to its seat. Covered plate studs are kept in the model, unlike the sheet's seated band, because the explosion uncovers them and the location seat is one. `generator/brick-scene.mjs` writes the fragment and `src/generated/bricks-init.js`: a `<model-viewer>` (`@google/model-viewer` 4.3.1, loaded by the state's `viewer` resolve) with a numbered badge per brick riding the clip, three corner buttons at the iso elevation (the drawing's corner at 45°, the opposite corner at 225°, the server side at 135°), an EXPLODE ⇄ ASSEMBLE button and a scrub slider, and the pinned brick in `?focus`.
- 2026-10-04, later, no rev clause: the assemble clip is re-authored from a three-way study (`MOTION-STUDY-2026-10-04.md`) at the user's ask: "brick 5 doesn't explode out from 1 fast enough; the animation could use some snappier easing and higher explosion multiplier i think. lots of fun animations imaginable to accompany." The study found the lifts measured from the plate left brick 5's foot six units inside brick 1's cap for the whole clip. The clip is 1.2 s: sheet 2's hovers ×1.5, a stacked brick a stud clear of the brick it stands on, cubic ease-in at 24 keys in two windows so bricks 3, 5 and 6 leave brick 1 first on EXPLODE and brick 1 seats first on ASSEMBLE; a dashed leader ties each hovering brick to the stud it left; the badges and the pinned target read the clip's own keys; the unpinned target rises with the stack and the radius dollies out so the exploded pose fits every stage; and TURN, off by default, sweeps the camera 30° on the clip's own curve about the pinned brick or the model, the one slider driving clip and camera together. The user's words on the camera: "2 with 3 folded in sounds good, tho what about the spin as its own control, with the main slider controlling both". Rejected in the study: yaw, fan, stud snap, overshoot, the plate lift and a step-by-step order.
- 2026-10-09, no rev clause: a brick's badge stands over its cap's centre, or, on a cap other bricks seat on, over the open stud farthest from their badges — brick 1's at its front-left stud — so at every corner on a desktop no two 26 px pins stand closer than 28 px, where bricks 1 and 3 stood 23.7 px apart. On a phone the seated model is small enough that 1 and 3 still touch.
- 2026-10-03, geometry (census unmoved): brick 1 hovers at z 144, from 96. At 96 its underside sat 4 px above the plate's back edge on screen, so the seven-course tower read as standing on the ground behind the plate rather than over the rail; at 144 two courses of plate show under it. The plate drops 48 (OY 420 → 468) with brick 4, the second plate and every label under the tower, so bricks 1, 3, 5 and 6 and their lettering keep their screen positions; brick 2 keeps its position too and its fall onto the LOCATION SEAT lengthens to match. The spare-parts box and ART_H move with the plate, so the sheet grows 48 tall.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: `lit-ui-router-ssr` re-letters 0.1.1 at 11 files / 1,093 sloc (was 0.1.0, 10 / 985), still a 2×4 of 4 courses. The TOTAL reads 6 bricks · 53 authored files · 5,439 sloc.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: `lit-ui-router-ssr` re-letters 0.1.0 at 10 files / 985 sloc (was 0.1.0-rc.3, 9 / 800), which quantizes to 7 studs: a 2×4 of 4 courses, where it stood a 2×3 of 3. The massing note's guard threw — it named 1 and 4 as the 2×4s and 6 as the 2×3 — and the note now reads “the three bricks that carry a renderer, a server and the prerender bridge between them are all 2×4s”, the count from the plate and the guard holding 1, 4 and 6; “A companion that needed to be a 2×4” reads “A plug that needed to be a 2×4”, since the bridge is a companion that is one. The taller brick crowded brick 6's label stack by 0.67 px, so the five lines rise 3 px. The TOTAL reads 6 bricks · 52 authored files · 5,331 sloc.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the bricks re-letter their versions — `lit-ui-router` 1.16.0 at 21 files / 2,605 sloc (was 1.16.0-rc.1, 2,596), `lit-ui-router-effect` 0.1.3 at 5 / 213 (was 0.1.1, 211), `lit-ui-router-ssr` 0.1.0-rc.3 at 9 / 800 (was rc.2, 796), the plugin 1.0.1 at 2 / 141 — and no brick changed its stud plan or course count. The TOTAL reads 6 bricks · 51 authored files · 5,146 sloc; the tile line reads “141, 176 and 213 lines”, and ssr's drop-line sentence quotes its new peer, `lit-ui-router ^1.16.0`.
- 2026-09-27, REV E at origin/main @ fe44598e (census unmoved): the two bricks rev D scheduled as rows 5 and 6, `A BRICK, NOT DRAWN IN THIS REV`, are drawn — `lit-ui-router-effect` 0.1.1 (5 files / 211 sloc, 1×2 over 2 courses) and `lit-ui-router-ssr` 0.1.0-rc.2 (9 / 796, 2×3 over 3). `OFF_PLATE` is gone: both come through `BRICKS`, which now throws if a census row moulds a different shape than the sheet's rule or if a published package is neither a brick nor the lint plugin; a `COUPLES` table of brick-to-brick joints throws unless it equals the brick-to-brick peer rows in `census-couplings.json`. The TOTAL reads 6 bricks drawn · 51 authored files · 5,131 sloc (was 4 drawn of the 6 moulded, 37 / 4,124); the altitude reads SIX PACKAGES; the parts box PARTS — 6 BRICKS, 2 PLATES. What moved: brick 1 turns long side to the rail over seats 4–7 (drawn 4×2 from its census 2×4) so the rail stays in view and its cap reaches the plate's right corner; the location seat moves to the rail's first stud and brick 2 with it; the second plate comes in from x 1130 to beside the client plate's right corner, its origin solved from the one screen column the bridge falls through; the parts box moves to the upper left at six rows, the stud schedule to the upper right with three brick seams (F `seekRouter`, G `lit-ui-router/context`, H `createServerRouter`) under a rule of their own, the spare parts to the lower left, and the named-stud labels into one band under the plate. Drop lines: 1 → rail stud A seat 7; 2 → the red LOCATION SEAT; 3 → F on brick 1's cap; 5 → F on brick 1's cap; 6 → G on brick 1's cap AND H on brick 4's cap; 4 → A′ and D′ on its own plate. Heights step so no brick hides another's fall — the bridge lowest (z 340) over brick 1's far end, brick 5 (z 330) overhanging its front edge, brick 3 (z 432) over both. The source read corrected rev D's schedule guess: effect seats through `UIRouterLitElement.seekRouter(host)` (the same seam as mobx, `router-ref-controller.ts:60`), not `lit-ui-router/context`, and hooks `transitionService.onSuccess` (`route-ref.ts:89`) and reads `globals` like brick 3; ssr uses `provideRouter`/`withRouterSync` (`prerender.ts:352`, `:336`), `getScopedRouter` (`ui-view-renderer.ts:186`), `requestContext` (`served-view.ts:200`), `provideContext` (`client.ts:384`), `withServedRender(UiView)` (`register.ts:17`) and `createServerRouter` (`prerender.ts:309`); it imports neither `memoryLocationPlugin` nor `installServerLocation`, so its second drop lands on brick 4, not the second plate. Frame audit before (rev D) and after: escapes 0 · hits>1px 0 · text-on-text 0 on both. Build, sheet 2A's sub (“the six companions sheet 2 seats”) and the 2 / 2A verdict lines re-worded to match.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: `ui-router-navigation-location-plugin` 1.0.0 is 2 files / 141 sloc, up from 1 / 105 — #965 moved `composeNavigateUrl` into a file of its own — and still moulds a 1×1 of one course, so brick 2 keeps its shape and its seat. The TOTAL reads 37 authored files · 4,124 sloc (was 36 / 4,088), and the massing note's tile pair reads “141 and 176 lines”. No brick joined or left the schedule.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: `lit-ui-router` 1.16.0-rc.1 is 21 files / 2,596 sloc, up from 20 / 2,384 — 18 studs, from 16. `lit-ui-router-ssr` 0.1.0-rc.2 is 9 files / 796 sloc, up from 2 / 253, and moulds 2×3 over 3 courses where it moulded 1×2 over one. That row threw nothing and would have printed wrong: both scheduled rows carried a hand-typed `course` / `courses`, so ssr would have read “3 course”; the plural derives from the count now. No brick joined or left the schedule — four drawn, two scheduled `A BRICK, NOT DRAWN IN THIS REV`.
- 2026-09-14, REV D (no clause in the copy): the effect bindings and the new `lit-ui-router-ssr` are both published at this ref, so the plate moulds EIGHT bricks and still draws four — the two newcomers are scheduled as rows 5 and 6, `A BRICK, NOT DRAWN IN THIS REV`, and the schedule's total says four drawn of the six moulded. `lit-ui-router` is 20 files / 2,384 sloc, up from 18 / 2,214; `ui-router-server` 9 / 1,211, up from 1,157; `lit-ui-router-ssr` is 2 files / 253 sloc and `lit-ui-router-effect` 5 / 211. Core 5,272, the eslint plugin 12 / 1,317, the mobx companion 176 and the navigation plugin 105 are unmoved, and the drawn four carry 35 authored files between them. After the record, the frame audit: bricks 1 and 3's label blocks lay across the tall brick's cap and studs — 11 hits at depths 6–32 — so both blocks move out to x 560, each aligned with the height of its own badge.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: lit-ui-router's brick is 18 files / 2,214 sloc, up from 14 / 1,471 with #827 and #830 — 15 studs over 6 courses, from 10 over 5. The eslint plugin is 12 files / 1,317 sloc, up from 10 / 771 on #828's new rules, and now out-masses `ui-router-server` (1,157, unmoved). Core 5,272, the mobx companion 176 and the navigation plugin 105 are all unmoved. The effect bindings are private at this ref and take no brick.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: lit-ui-router's brick is 1,471 sloc, up from 1,399 with the SSR work (#814, #818) and #821; the other five bricks — core 5,272, ui-router-server 1,141, the eslint plugin 771, the mobx companion 176, the navigation plugin 105 — are unmoved.
- REV A — before 2026-08-16; referenced only, never a clause, and surviving solely inside the rev B prose above · REV B — 2026-08-16 (628d82d "docs: redraw sheet 2 as an exploded LEGO brick assembly") · REV C — 2026-09-05, dated in the clause.
- Basis: `counted at ${PLATE.ref} @ ${PLATE.sha}` from `diagrams/data/census-bricks.json` [origin/main @ 185d414, generated 2026-09-07].

## Sheet 2A — THE COUPLING PLAN

- **file** `diagrams/generator/sheet2a.mjs` · **id** `companions-couplings` · **current rev** E
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2 — ALTERNATE PLATE: the same four companions as sheet 2, rev A’s arrangement, every coupling drawn to read

### REV A — undated in the copy

**prose paragraph** (`sheet2a.mjs`):

> <p><strong>This plate is the legibility companion to sheet 2.</strong> The exploded assembly (sheet 2, THE BRICK ASSEMBLY) shows the whole stack and where every brick falls; this plate isolates the couplings and draws each one at reading size. It deliberately returns to rev A’s spatial arrangement — core central, companions at its right, the server in a request lane below the no-DOM line — but renders the packages as shallow solids and spends the recovered space entirely on the joints.</p>

### REV B — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV B: rows read census-bricks.json @ ${B.sha} — lit-ui-router 1.9.0 · 12f · 1,325 was the 2026-08-17 hand count

resolved →

> REV B: rows read census-bricks.json @ 185d414 — lit-ui-router 1.9.0 · 12f · 1,325 was the 2026-08-17 hand count

### REV C — 2026-09-06

**`sub` clause** (verbatim source):

> REV C 2026-09-06: fills — the slab tops now carry their paper-2 tint and the right flanks their hatch, sheet 2’s rev C fault in this plate’s own slab helper; nothing moved

### REV D — 2026-09-06

**`sub` clause** (verbatim source):

> REV D 2026-09-06: the two clamped companions re-cut to the line they frame — the location plugin 180 → 156 wide and the mobx brick 160 → 136, both slabs having been sized to the mono lettering the data face replaced; every other block keeps its sloc-proportional face

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: blocks re-letter `lit-ui-router` at 2,752 sloc, effect at 288, mobx at 204 and ssr at 1,094, and ssr's tie reads ^1.16.1 (#1108). The coupling paragraph names `seekRouter(host)` as the fallback mobx takes when no `context-request` provider answers (#1099). No block moved.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: block 6 re-letters `lit-ui-router-ssr` 0.1.1 at 11 files / 1,093 sloc; its peers are unmoved. No block moved.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: block 6 re-letters `lit-ui-router-ssr` 0.1.0 at 10 files / 985 sloc (was 0.1.0-rc.3, 9 / 800); its peers are unmoved at `^1.16.0` and `^0.2.0`. No block moved.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the peer ranges re-read after #994 and #1006 renamed the catalogs: block 5 (effect 0.1.3, 5f · 213 sloc) peers `lit-ui-router ^1.15.0` (was ^1.7.0), block 6 (ssr 0.1.0-rc.3, 9f · 800 sloc) peers `^1.16.0` (was ^1.16.0-rc.1), and block 1 letters 1.16.0 over 2,605 sloc. 9 nodes, 7 published, 22 contracts, unmoved; no block moved.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: block 2 re-letters `location-plugin 1.0.0` over `2f · 141 sloc · core only` (was 0.3.2, 1f · 105). 9 nodes, 7 published, 22 contracts — 20 peers, 2 deps, 2 optional — unmoved; the plugin still declares `@uirouter/core` ^6.0.8 and nothing else. No block moved.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: 9 nodes, 7 published, 22 contracts (was 21) — 20 peers, 2 deps, 2 optional. The new contract is `lit-ui-router-ssr` → `@lit-labs/ssr-client` ^1.1.0, the client half its `./client` door adopts a served render through, and ssr's contract on the flagship reads ^1.16.0-rc.1. No block moved.
- 2026-09-14, REV E: the plan takes two blocks it never carried, both packages being published now — 9 nodes, 7 published, 21 contracts, 19 peers, 2 deps, 2 optional, 1 uncoupled. Block 5 is `lit-ui-router-effect` at 1180,120, hanging off a stud on block 1's right face, the same kind of joint the mobx companion takes and nothing on the wall. Block 6 is `lit-ui-router-ssr` at 1000,775, and it is the one that changed the drawing's shape: a single L-shaped arm with a stud on block 1's face above the no-DOM line and a second on block 4's below it, run down the right edge of the plate — the only part in the family declaring both the flagship and the server, so the only one whose drawing spans both halves. The altitude reads SIX PACKAGES.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: re-read at the new ref with nothing moved — 7 nodes, 5 published, 12 contracts, 10 peers, 2 deps, 2 optional, 1 uncoupled. `lit-ui-router-effect` is private at this ref, so the plate does not carry it and no joint was cut. Only the versions on the rails and the title block's date changed.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: re-read at the new ref with nothing moved — 7 nodes, 5 published, 12 contracts, 10 peers, 2 deps, 2 optional, 1 uncoupled. Only the versions on the rails and the title block's date changed.
- REV A — before 2026-08-16; referenced only, and this plate deliberately *returns* to its arrangement · REV B — 2026-09-03 (1ff332a) · REV C and REV D — 2026-09-06, dated in their clauses.
- Superseded figures: rev B retired the 2026-08-17 hand count `lit-ui-router 1.9.0 · 12f · 1,325` (rows read 1.11.2 · 13f · 1,383 now); rev D recut the location-plugin slab 180 → 156 wide and the mobx brick 160 → 136, both having been sized to the mono lettering the data face replaced.
- The front-face scale is ≈ 35 px² per sloc, with the two smallest companions (1×1 and 1×2) clamped up to a legible minimum — their smallness is already sheet 2's finding.
- Basis: `census-bricks.json @ ${B.sha}` [origin/main @ 185d414].

## Sheet 2B — THE COUPLING BENCH

- **file** `diagrams/generator/sheet2b.mjs` · **id** `coupling-bench` · **current rev** D
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2 — INTERACTIVE PLATE: sheet 2A’s joints made live · 7 nodes · every one of the 7 drawn edges is a published contract, with its declared range under the pointer

### REV B — undated in the copy; first in git 2026-09-06

**`sub` clause** (verbatim source):

> REV B: the intra-column lit-ui-router-mobx → lit-ui-router tie bowed out of the column, because it ran straight through the navigation plugin standing between them

**prose paragraph** (`sheet2b.mjs`):

> <p><strong>The middle column is an argument, not a spacer.</strong> Four of the five published packages need <code>lit</code> or need something that does; <code>ui-router-navigation-location-plugin</code> needs neither, and the bench says so by standing it in a column of its own between the wall and the lit column, on the wall’s own baseline. Every other building on this bench reaches left across two column gaps; this one reaches across one, along a straight horizontal run, and that run is the whole of its coupling. Rev B drew it inside the lit column and had to bow the <code>lit-ui-router-mobx</code> tie around it — a single curve on a plate of straight lines, which is the shape a layout takes when it is hiding a fault rather than fixing one. With the plugin moved out, nothing stands between <code>lit-ui-router-mobx</code> and <code>lit-ui-router</code>: the tie is a plain vertical, and the generator now <em>throws</em> if any same-column tie is laid through a third building.</p>

### REV C — 2026-09-06

**`sub` clause** (verbatim source):

> REV C 2026-09-06: the bow deleted and the bench recomposed in four columns — ui-router-navigation-location-plugin declares core and nothing else, so it leaves the lit column for a middle column of its own on the wall’s baseline, its one tie a straight horizontal run; with nothing left standing between them the mobx tie is a plain vertical, a same-column tie laid through a third building is now a build error rather than a curve drawn around it, and the two longest bands letter over their node so the fit is priced on the buildings rather than on the captions

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: the head is unmoved at 9 NODES · 14 DRAWN CONTRACTS OF 23 · 20 PEERS / 3 DEPENDENCIES · 3 OPTIONAL; two ranges moved under it — mobx's `lit-ui-router` peer reads ^1.15.0 (was ^1.7.0, #1099) and ssr's ^1.16.1 (was ^1.16.0, #1108).
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: #1027 made ssr's `@lit-labs/ssr-client` an optional peer, so the head reads 9 NODES · 14 DRAWN CONTRACTS OF 23 · 20 PEERS / 3 DEPENDENCIES · 3 OPTIONAL (was 2 optional). The cover card's picture lifts the `lit-ui-router-mobx` label above its node after the quarter turn, where it had landed on `lit-ui-router`'s label and the ^1.7.0 tie (`thumbs.mjs` `labelTop`).
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: #1024 gave ssr a shipped dependency, `@oxc-project/runtime >=0.50.0`, so the head reads 14 DRAWN CONTRACTS OF 23 · 20 PEERS / 3 DEPENDENCIES (was 22 / 2). “neither of the two shipped dependencies is a router” had typed the count; it now reads “none of the 3 shipped dependencies is a router”, and the build throws if a shipped dependency is a router, if the flagship stops shipping exactly one, or if mobx declares one. The flagship's helper sentence names the other carrier off the plate — “`lit-ui-router-ssr` ships the same helper at the same range” — and throws if the ranges part; the cover verdict reads “no dependency is a router”.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the bench holds at 9 NODES · 14 DRAWN CONTRACTS of 22 · 20 PEERS / 2 DEPENDENCIES · 2 OPTIONAL. The notes read the new floors off the couplings plate: effect's one sibling tie is `lit-ui-router ^1.15.0`, ssr declares `^1.16.0`, and mobx's `^1.7.0` is a floor the flagship sits above at 1.16.0.
- 2026-09-25, no rev clause: the bench's chrome carries restroked Lucide glyphs from the shared icon table (`generator/icons.mjs`) — `move` on DRAG TO PAN, `scan` on FIT, the card's own `coupling` on the panel's at-rest head, `arrow-up-from-line` / `arrow-down-to-line` on DECLARES / DECLARED BY. The buildings are house sprites and are untouched.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the bench re-pinned on the couplings plate and holds at 9 NODES · 14 DRAWN CONTRACTS of 22 · 20 PEERS / 2 DEPENDENCIES · 2 OPTIONAL. The plugin's node files 1.0.0 in its data, same column, same one tie to the socket wall.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the bench re-pinned on the couplings plate — 9 NODES · 14 DRAWN CONTRACTS of 22 · 20 PEERS / 2 DEPENDENCIES · 2 OPTIONAL. The new `@lit-labs/ssr-client` tie stays off the bench beside `@lit-labs/ssr`, `effect` and `eslint`, so no column was cut and `coupling-bench.mjs`'s same-column assertion had nothing to catch.
- 2026-09-14, REV D (bench REV C → D): two nodes joined and the bench grew a FIFTH column. `lit-ui-router-effect` and `lit-ui-router-ssr` stand at x 900, not in the 680 column, because both tie `lit-ui-router` and a tie laid down that column would run straight through `lit-ui-router-mobx` — which is the one thing `coupling-bench.mjs` throws on, so the column was chosen by the guard rather than by eye. `ui-router-server` drops y 200 → 260 to clear the ssr arm and the eslint bay moves out to (1120, −300), a bay of its own that couples to nothing here. The scale derives from the plate: 9 NODES · 14 DRAWN CONTRACTS of 21 · 19 PEERS / 2 DEPENDENCIES · 2 OPTIONAL, `effect`, `@lit-labs/ssr` and `eslint` being the three the bench does not draw.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the bench re-pinned on the same couplings plate — no node joined, no tie moved, and `coupling-bench.mjs`'s same-column assertion had nothing to catch.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the bench re-pinned on the same couplings plate; no tie moved and `coupling-bench.mjs`'s same-column assertion had nothing to catch.
- REV A — 2026-09-03 (0746423 "feat: sheet 2B THE COUPLING BENCH — package contracts interactive"), with no clause of its own · REV B — introduced with the sheet at 0746423, superseded 2026-09-06 · REV C — 2026-09-06 (fd54400 "feat: coupling bench rev c — the navigation plugin gets a column of its own; design review memo").
- Rev B drew the navigation plugin inside the lit column and had to bow the mobx tie around it; rev C's four columns delete the bow, and a same-column tie laid through a third building is a build error now. The bench carries 7 nodes and 12 drawn contracts.
- Basis: not stated in the sub; every figure is a throwing lookup in `diagrams/data/census-couplings.json` [origin/main @ 185d414, generated 2026-09-07].

## Sheet 3 — THE INSTRUMENT YARD

- **file** `diagrams/generator/sheet3.mjs` · **id** `monorepo` · **current rev** H
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3 — 5 publishable packages · 20 tools · 70 turbo task names · one packer, many readers

### REV A — undated in the copy

**prose paragraph** (`sheet3.mjs`):

> <p><strong>Mass is volume; volume does not predict authority.</strong> Footprint side is <code>1.6 · √sloc</code>, so plan area tracks lines; height is <code>1.5 px</code> per authored file, so a block's volume is its <code>sloc × files</code>. The two heaviest masses on the sheet are <em>material</em>: the sample apps (${nfl(18)}) and <code>packages/*/src</code> (${nfl(1)}). The ${PR_GATES.length} structures that can stop a pull request total ${PR_GATES.reduce((a, n) => a + nf(n), 0)} files between them, and one of them — <code>dts-backtest</code> — is a single ${nl(9)}-line <code>run.ts</code>. Rev A encoded severity as height and so implied the opposite; the census says a gate's authority has nothing to do with how much code it is.</p>

### REV B — undated in the copy

**other rev-bearing copy** (`sheet3.mjs`):

> caption: 'The monorepo drawn as what it functionally is: a short conveyor that turns source into one tarball, inside a yard of instruments built to measure that tarball. Rev B gives every structure its measured mass — footprint ∝ √sloc, height ∝ authored files — and moves gate severity out of height and into colour, because the two never correlated: the blocks that stop the line are among the smallest on the sheet.',

### REV C — undated in the copy; first in git 2026-09-02

**`sub` clause** (verbatim source):

> REV C: census refresh — every mass ${COUNTED} from diagrams/data/census-yard.json (scc Code lines), ${TOT_F} authored files and ${fmt(TOT_L)} sloc across ${massed.length} massed structures

resolved →

> REV C: census refresh — every mass counted at origin/main @ 185d414 (2026-09-07) from diagrams/data/census-yard.json (scc Code lines), 203 authored files and 13,998 sloc across 17 massed structures

**prose paragraph** (`sheet3.mjs`):

> <p><strong>Rev C — census refresh (${COUNTED}) and a change of ruler.</strong> Nothing about the argument changed; the numbers under it did, for two separate reasons that are worth keeping apart. <em>The ruler changed:</em> sloc is now <code>scc</code>'s string-aware <code>Code</code> count instead of a homegrown blank-and-comment filter, which adds roughly 0.9% across the yard because a template literal's interior now counts line by line. Measured both ways over one identical file set — rev B's twenty-five source directories — the old ruler reads 11,560 lines and <code>scc</code> reads 11,658, so of everything below, about a hundred lines are the tape measure and the rest is code. <em>The code changed:</em> re-measured on the plate, <code>packages/*/src</code> went 2,568 → ${fmt(nl(1))}, the sample apps 2,995 → ${fmt(nl(18))}, Cypress <code>e2e</code> 5 files/405 → ${nf(17)} files/${fmt(nl(17))}. And the yard gained three instruments — <code>@tools/lint-elements</code>, <code>@tools/warn-lanes</code> (#639) and <code>@tools/eslint-ts-parser</code> — which is why <code>tools/</code> now reads nineteen packages and the lint &amp; probe fleet is the one block that visibly grew, 13 files/732 lines to ${nf(14)}/${fmt(nl(14))}. Structure 15 shifted 13 plan units right to keep air around it. Totals: ${TOT_F} authored files, ${fmt(TOT_L)} lines, up from 171/10,652. A note on the count: <code>@tools/wintercg-globals</code> is a member of the workspace but massed nowhere, because its entire source is one <code>globals.d.ts</code> and declaration files are outside this basis — it has always been invisible to this sheet. In the inset, only turbo moved: the <code>ci</code> graph went 501 → 535 nodes (<code>turbo run ci --dry=json</code>, turbo 2.10.11), while mise held at 48 tasks and Actions at 37 call sites across eight workflows. The tarball's readers, the gate tiers and the loop are unchanged.</p>

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: the task-manager inset reads census-handoff.json + census-plate.json — ci ${CI_NODES} nodes, no longer a hand-pasted 535

resolved →

> REV D: the task-manager inset reads census-handoff.json + census-plate.json — ci 605 nodes, no longer a hand-pasted 535

**prose paragraph** (`sheet3.mjs`):

> <p><strong>Rev D — the inset is off the clipboard too.</strong> The whole plate cabinet was re-counted at ${PLATE.ref} @ ${PLATE.sha} in one pass, and the yard moved with it: ${TOT_F} authored files and ${fmt(TOT_L)} sloc across ${massed.length} massed structures, up from rev C's 187 / 12,798. The correction rev D exists for is the inset. Its four task-manager figures were the last hand-pasted constants on this sheet, and by rev C's own printing one of them was wrong in the same build that printed it: the inset said the <code>ci</code> graph was 535 nodes while plates 3A and 12, reading <code>census-plate.json</code>, said 590. All four now read from the same two plates 3A draws — <code>census-handoff.json</code> for the workflow, mise and call-site counts, <code>census-plate.json</code> for the graph — so the three sheets cannot disagree about the machine again. At this ref that is ${HW.calling} workflows, ${HW.callSites} call sites over ${HW.targets} distinct tasks, ${HM.tasks} mise tasks with ${HM.withDepends} declaring <code>depends</code>, and <code>ci</code> at ${CI_NODES} nodes. The gate tiers, the loop and the argument are unchanged.</p>`,

### REV E — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV E: the altitude line reads the plates — 44 task names was a hand-typed relic

### REV F — 2026-09-06

**`sub` clause** (verbatim source):

> REV F 2026-09-06: fills — every mass’s left-face tint and right-face hatch draw for the first time (the fault sheet 7’s rev C worked around per plate — a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); no mass moved

### REV G — 2026-09-06

**`sub` clause** (verbatim source):

> REV G 2026-09-06: mass 1’s badge takes the far corner of its roof — at the data face the aqua-tool-belt caption reached under the old centred badge, so the site now keeps clear of the inset’s frame rather than pushing a label through it

### REV H — 2026-09-07

**`sub` clause** (verbatim source):

> REV H 2026-09-07: the shopfront's district lettering reads apps/ + www/ — #717 moved the documentation site out of docs/, and no directory of that name is left to letter

**Record notes**

- 2026-09-13, after the refresh, no rev clause: the frame audit. Block 14 `lint & probe fleet` moved 175,320 → 175,298 and the yard's own frame deepened, `district(10, 175, 445, 385)` → `district(10, 175, 445, 393)`: row B's giant hung 17.9 units below the dashed yard frame — a fault since the fleet took `tools/eslint`, and worse at this ref's sloc — so the block steps 22 north of its row mates and the frame drops 8 to close behind it. No other mass moved and no ruler changed.
- 2026-09-11, no rev clause: re-counted at origin/main @ 65e2843 — `INSTRUMENTS` in `census-yard.mjs` gains "repo checks — graph edges, task inputs, knip, patches" and "bootstrap — pre-install manifest reads", and `tools/eslint/` joins the "lint & probe fleet"; orphans 0. The yard stands at 19 rows, 217 files / 15,094 sloc.
- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: the TOTAL reads 17 massed structures · 254 authored files · 19,521 sloc (was 253 / 19,006), the head 24 tools and 90 turbo task names (was 89), the inset's ci graph 864 nodes. `src (7 published packages)` is 66 / 7,191; `lint & probe fleet` 33 f / 3,369, `orphans 0`. The grown source slab (1) reached the AQUA TOOL BELT caption and the PACKAGES/* heading, and moves 20 → 25 along x.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: the TOTAL reads 17 massed structures · 253 authored files · 19,006 sloc (was 249 / 18,375), the head 24 tools and 89 turbo task names (was 23 / 79), the inset's ci graph 863 nodes. `src (7 published packages)` is 65 / 6,940; the new member `tools/crap` joins the `lint & probe fleet` rule (33 f / 3,128), `orphans 0`.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: the TOTAL reads 17 massed structures · 249 authored files · 18,375 sloc (was 248 / 18,126) and the head 79 turbo task names (was 78). `src (7 published packages)` is 64 / 6,648 with #1010's `settle.ts`; `publish — release-it` 1,247 sloc (was 1,201) with #1009's release-closure check; oxc-emit 241, compat-guards 172. The aria-label typed “thirty-seven call sites across eight workflows”; it now reads both counts off `census-handoff.json`. The inset note named `setup → turbo_link_worktree`, a task renamed `turbo_pin_worktree` before this ref, and read as if its two named edges were all 15; it now names `turbo_pin_worktree` and says “among them”.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the TOTAL reads 17 massed structures · 248 authored files · 18,126 sloc (was 247 / 18,010) and the head 78 turbo task names (was 77). `src (7 published packages)` is 63 / 6,463; `lint & probe fleet` 30 / 2,835 with #994's `tools/eslint/rules/catalog-fields.ts`; `peer-floor tier-1` 128 and tier-2 116 sloc (was 107 / 74). #995 deleted `pack-staged.ts` and moved `packPublishTarball` into a new `pack-publish.ts` beside `strip-manifest.pnpmfile.mjs`, which the yard's pack rule did not name — the first run filed both under `publish — release-it` (28 files) and left the packer's own slab at 10, with `orphans 0` because the broader release rule caught them. `census-yard.mjs` now names `pack-publish` and `strip-manifest` where it named `pack-staged`: `pack — packPublishTarball` reads 12 files / 301 sloc (was 12 / 353), publish 26 / 1,201 as before.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: `src (7 published packages)` is 63 files / 6,448 sloc (was 62 / 6,412), the plugin's new `compose-navigate-url.ts` the one file; the parenthesis is asserted and still reads seven. `sample apps` 66 files / 3,763 (was 3,760). The TOTAL reads 17 massed structures · 247 authored files · 18,010 sloc (was 246 / 17,971). `orphans 0`, no rule added or removed; the slab's badge rides its grown mass and no lettering was hand-moved.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: `src (7 published packages)` is 62 files / 6,412 sloc (was 54 / 5,657), and the parenthesis is asserted against the plate now — seven, still true. `orphans 0`, and no rule was added or removed. The grown slab reached the district lettering a second refresh running, so `PACKAGES/* — THE MATERIAL` moves x 50 → 40.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the yard stands at 19 rows, 245 files / 17,708 sloc (was 20 / 239 / 17,161), and the one hand edit is a DELETION. `census-yard.mjs`'s sixth-refresh carve-out, `src — lit-ui-router-effect (private)`, is gone — the package is published at this ref — and the slab it was protecting is re-lettered `src (7 published packages)`, 54 files / 5,657 sloc; sheet 3's row 20 goes with the rule and row 1 is re-keyed. `orphans 0`, and that line was never going to say otherwise: the `/^packages\//` catch-all had already claimed №38 `lit-ui-router-ssr` under a label that still read “5 published”, so the plate drew a seven-package slab and counted five in its own lettering. A label that counts must be asserted against the data; this one was a string nothing checked. The sub reads 7 publishable packages · 23 tools · 77 turbo task names · 236 authored files and 17,072 sloc across 17 massed structures.
- 2026-09-14, after the refresh, no rev clause: the caption audit, off a maintainer's report. Two label pairs were standing on masonry the refresh had grown under them — the tool-belt caption (“… none installable by node”) ran under mass 1's cap at a SAT depth of 22.1, and the grown 54-file `src` cap struck “cache key over tools…” at 9.6. The caption is shortened, the pair moves x 430 → 520 into clear air, and the `PACKAGES/* — THE MATERIAL` column follows it 55 → 50. The last hand count on the plate went with them: the tools district's “twenty packages” is the plate's own `TOOLS` figure now, 23. `assertPlots` covers ground rects, not words, so type over a grown footprint is read by eye after every refresh.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the yard stands at 20 rows, 239 files / 17,161 sloc (was 19 / 218 / 15,221). The new row is the one hand edit: `census-yard.mjs` took a rule `src — lit-ui-router-effect (private)` — 5 files / 211 sloc — placed BEFORE the five-published rule, so the published slab stays exactly the five packages the sheet letters it as, and the private bindings are drawn as row 20 at -10,140. orphans 0.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the yard stands at 19 rows, 218 files / 15,221 sloc (was 217 / 15,094). Inside it: src across the 5 published packages 3,592 → 3,664, `@tools/shared` 216 → 244 over 5 → 6 files (#816's execve helper), e2e cypress 674 → 701. orphans 0, so `INSTRUMENTS` took no new rule.
- REV A — 2026-08-16 or earlier (c73b65b "docs: add the six-altitudes diagram set") · REV B — 2026-08-16 (237edc7) · REV C — 2026-09-02 (be01a38 "feat: census pipeline I4 wave 1") · REV D — 2026-09-03 (96f89fe "full cabinet refresh at origin/main eb32b4e") · REV E — 2026-09-03 (1ff332a) · REV F and REV G — 2026-09-06 · REV H — 2026-09-07, dated.
- Rev B's scale rule, still the plate's: footprint side `KS = 1.6 · √sloc`, height `KH = 1.5` px per authored file.
- Superseded figures: rev B's totals 171 files / 10,652 sloc; rev C's 187 / 12,798 and its hand-pasted `ci` 535 nodes against plates 3A and 12's 590 in the same build; rev E's retired hand-typed 44 turbo task names. The yard reads 203 files / 13,998 sloc across 17 massed structures now, and `ci` 605 nodes.
- `@tools/wintercg-globals` is a workspace member massed nowhere: its whole source is one `globals.d.ts`, and declaration files are outside this basis.
- Basis: `counted at ${PLATE.ref} @ ${PLATE.sha}` from `diagrams/data/census-yard.json`; the task-manager inset reads `census-handoff.json` + `census-plate.json` [origin/main @ 185d414, generated 2026-09-07].

## Sheet 3A — THE HANDOFF WORKS

- **file** `diagrams/generator/sheet3a.mjs` · **id** `handoff` · **current rev** E
- **basis** (source): `const BASIS = `counted at ${HANDOFF.ref} @ ${HANDOFF.sha} (${HANDOFF.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3 · ALTERNATE PLATE — the sheet-3 task-manager inset at full size: 8 of 11 workflows · 49 mise tasks in 4 homes · turbo ci 605 nodes, 183 real · 4 seam types · 3 service doors

### REV A — undated in the copy

**prose paragraph** (`sheet3a.mjs`):

> <p><strong>Method — one census, cited throughout.</strong> Every count on this plate comes from a fresh 2026-08-17 census of the repo at HEAD: the 11 workflow files, all 17 <code>turbo.json</code> files, <code>.config/mise/**</code> and both member <code>mise.toml</code> files read directly, cross-checked against <code>mise tasks ls --all</code> and bare <code>turbo run ci --dry=json</code>. Three figures on the sheet-3 inset had drifted and were corrected at rev A: 36→37 workflow call sites, 51→48 repo-defined mise tasks (the 51 had mixed in four user-global <code>rtk:*</code> tasks), and 483→501 ci graph nodes after the lit dedupe — the phantom share held at 68.5%.</p>

### REV B — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV B: census refresh 2026-08-31

**prose paragraph** (`sheet3a.mjs`):

> <p><strong>Rev B — census refresh, 2026-08-31.</strong> The plate was re-measured from the same sources at HEAD, and the finding it exists to make survived intact: <em>the mise machine did not move a single task.</em> 48 tasks in the same four homes, 2 <code>depends</code> declarations, 21 <code>$usage_*</code> specs, 37 workflow call sites across the same 8 of 11 workflows, the same 7 ★ / 7 ↩ disjoint sets, the same 6 re-entrant ports, the same one dead task. Only turbo's graph grew, and only because the workspace did: three new members — <code>@tools/lint-elements</code>, <code>@tools/warn-lanes</code> (#639) and <code>@tools/eslint-ts-parser</code> — take the <code>ci</code> graph from 501 nodes / 158 real to 535 / 165, edges 1,294 → 1,375, real→real 116 → 117, and the phantom share from 68.5% to 69.2%. <code>ci:main</code> now stands at 567 nodes / 170 real. The turbo <em>definitions</em> are unchanged at 91 across the same 17 files: every new node is fan-out, not authorship. Two other figures were corrected in passing — the repo holds 12 <code>cache:false</code> definitions, not 11 (7 at root, 5 in member files; still zero reachable from <code>ci</code>) — and four <code>turbo.json</code> line citations moved as <code>//#lint:elements</code> landed above them. A new root lint lane, <code>//#lint:elements</code>, joins the <code>lint</code> fan but is <em>not</em> a re-entrant port: it runs a node bin, not <code>mise run</code>.</p>

### REV C — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV C: the vanished tmp/ census is a scripted probe — every count imported from diagrams/data/census-handoff.json + census-plate.json

**prose paragraph** (`sheet3a.mjs`):

> <p><strong>Rev C — the census is a script now, and the mise machine still has not moved.</strong> The 2026-08-17 generator this plate was measured with lived in <code>tmp/</code> and is gone; it is reconstructed as <code>diagrams/generator/census-handoff.mjs</code>, a T1 tree probe that counts workflow <code>mise run</code> call sites, mise task tables and turbo task definitions from a materialized archive of the ref — no mise, no turbo, nothing executed. Run against rev B's own ref (0e4ab36) it reproduces every printed figure exactly: ${W.files} workflows, ${W.calling} calling mise, the same per-file counts, ${W.callSites} call sites, ${W.targets} targets, ${M.tasks} tasks in ${M.homes} homes, ${M.withUsage} arg specs, 17 <code>turbo.json</code> files, 91 definitions (45 + 46) and 12 <code>cache:false</code>. Two <code>depends</code> figures that read as a contradiction turn out to be two different counts, and the plate now carries both: ${M.withDepends} tasks <em>declare</em> a <code>depends</code>, and between them they declare ${M.dependsEdges} dependency edges (setup 1 + lint_workflows 4) — the mise header counts tasks, seam row D2 counts edges. Re-measured at origin/main @ 35c6766, the finding this plate exists to make held a second time: <em>the mise machine still had not moved a task</em> — 48 tasks, 21 arg specs, 37 call sites, 28 targets, all identical, and <code>playwright_deps</code> still dead. turbo moved again, and again only because the workspace did: <code>packages/eslint-plugin-lit-ui-router</code> brought an 18th <code>turbo.json</code> with five definitions and the root file gained <code>check:dev-split</code>, so definitions went 91 → 97 (46 root + 51 member) and <code>ci:pull_request</code> listed eleven <code>dependsOn</code> lanes, not ten. <code>cache:false</code> held at 12, none of it reachable from <code>ci</code>. The graph figures came from <code>diagrams/data/census-plate.json</code> — 590 nodes / 176 real / 1,504 edges / 126 real→real, phantom share 70.2% — with <code>ci:main</code> at 623 / 181. One editorial claim did not survive the recount: the production docs deploy no longer bootstraps with <code>npx pnpm@11.21.0</code>. <code>tools/workers-builds/cloudflare-build.sh</code> now clears corepack's shims and installs <code>pnpm@12.2.1</code> globally through npm before <code>npx turbo docs#build</code> (:26-38) — a different way through the same door, and still the one production path that never sees mise.</p>

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: whole-cabinet refresh — mise unmoved a third time, turbo down to 17 files / 96 definitions

**prose paragraph** (`sheet3a.mjs`):

> <p><strong>Rev D — the first full-cabinet refresh, and the mise machine has still not moved.</strong> Every plate in <code>diagrams/data/</code> was re-counted at ${HANDOFF.ref} @ ${HANDOFF.sha} in one pass, the first time the whole cabinet has been turned over at a single ref rather than sheet by sheet. This plate's own finding survives a third measurement without a single figure moving: 48 mise tasks in ${M.homes} homes, ${M.withUsage} arg specs, ${M.withDepends} declaring tasks and ${M.dependsEdges} edges, ${W.callSites} call sites across ${W.calling} of ${W.files} workflows, ${W.targets} targets, and <code>playwright_deps</code> still dead. turbo moved, and this time it moved <em>down</em>: <code>apps/sample-app-shared/turbo.json</code> is gone (#696 restored <code>turbo run e2e</code> and its two definitions went with it) and the root file swapped <code>//#check:docs-api-deps</code> for <code>//#check:graph-edges</code> and <code>//#check:task-inputs</code> (#693), so files go 18 → 17 and definitions 97 → 96 (47 root + 49 member) — the first recount in this sheet's history where the schedule shrank. <code>cache:false</code> holds at 12 (7 root + 5 member), still with none reachable from <code>ci</code>. The <code>ci</code> graph followed: 586 nodes / 177 real / 1,382 edges / 96 real→real against rev C's 590 / 176 / 1,504 / 126, phantom share 70.2% → 69.8%, <code>ci:main</code> 623 / 181 → 619 / 182. The sharp one is real→real, down a quarter, and it has a single cause: #693 replaced the three <code>^docs:api</code> fan-outs with four package-qualified <code>&lt;pkg&gt;#docs:api</code> edges, because <code>^</code> walks direct deps only and <code>docs</code> was carrying devDependencies it never imports just to let it reach. The <code>docs:api</code> column collapses from 9 nodes to 4, all of them real, and the fan's edges went with it — the same work, wired by name instead of by a fiction. Six line citations moved with the two <code>turbo.json</code> edits and were re-verified against the archive: <code>ci:pull_request</code> 316-330 → 351-365 (still eleven lanes), the <code>//#lint:workflows</code> virtual node 215-225 → 250-260, the three cache-gasket input blocks 228-232 · 245-251 · 256-262 → 263-267 · 280-286 · 291-297, and <code>package.json</code>'s <code>lint:toml</code> script :31 → :32. Everything else this plate cites — <code>config.toml</code>:71, :88, :116, :131-135, :185-212, :196, <code>tools/release/mise.toml</code>:97 and :104-107, <code>tools/build_and_test/mise.toml</code>:72-76, <code>deflake-e2e.yml</code>:73 and :87, <code>cloudflare-build.sh</code>:26-38 — reads at the same lines it did. Basis: ${BASIS}; graph ${GRAPH_BASIS}.</p>

**plate lettering** (`sheet3a.mjs`):

> ${txt(1360, 62, 'REV D whole-cabinet refresh — mise STILL unmoved at 48 tasks / 37 call sites · turbo 96 definitions in 17 files (97 in 18 at rev C) · ci 590→586 nodes, 176→177 real', 'lblf', 'end')}

### REV E — 2026-09-06

**`sub` clause** (verbatim source):

> REV E 2026-09-06: recomposed to the data face — every frame on this plate was drawn to the old mono advance and is now sized to the widest DIN line it holds, so the spine is computed rather than hand-set: the Actions panel, the mise compartments and the service-door catalogue tighten to their own measure, the freed width goes to the two seam corridors and to the turbo core, which finally fits its re-entrant-ports line, one leading runs through all four mise compartments and each is as tall as its task list, and the bottom band files as three columns on even gutters · ${BASIS}

resolved →

> REV E 2026-09-06: recomposed to the data face — every frame on this plate was drawn to the old mono advance and is now sized to the widest DIN line it holds, so the spine is computed rather than hand-set: the Actions panel, the mise compartments and the service-door catalogue tighten to their own measure, the freed width goes to the two seam corridors and to the turbo core, which finally fits its re-entrant-ports line, one leading runs through all four mise compartments and each is as tall as its task list, and the bottom band files as three columns on even gutters · counted at origin/main @ 185d414 (2026-09-07)

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: ci 864 nodes, 235 real; 127 turbo definitions in 22 files (was 126); 54 mise tasks, 27 with `$usage_*` specs (was 22) — #1089, #1095 and #1105 gave `lint_actionlint` a `--github` flag and `build_www`, `ci`, `ci_main` and `codecov_bundle` an `--output-logs` flag. Typed cites relocated by content at the ref: `ci:pull_request` turbo.json:383-397, `//#lint:workflows` 280-288, the cache-gasket inputs 291-295 · 309-315 · 320-326 and 291-326, mise `lint_workflows` config.toml:154-158, `turbo run ci` config.toml:249, `lint_toml`'s run line config.toml:139, the mise → turbo span config.toml:201-231, `lint:toml` package.json:39, `mise run ci` build-test-run.yml:122, deflake-e2e.yml:75 and :89, `playwright_deps` mise.toml:93-97 (still called by nothing).
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: ci 863 nodes, 234 real; 126 turbo definitions in 22 files (was 114). #1038 made `//#lint:workflows` a `dependsOn` umbrella where it was a virtual `with` node: the box, the twins column and the curiosities paragraph now say so. Typed cites relocated by content at the ref: `ci:pull_request` turbo.json:375-389, `//#lint:workflows` 273-281, the cache-gasket inputs 284-288 · 301-307 · 312-318 and 284-318, `lint:toml` package.json:38, `mise run ci` build-test-run.yml:116. The phantom shroud's caption names the umbrellas beside transit and the ^build carriers.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: 13 workflows (was 12) — #1015's `dependency-audit` calls no mise, so 8 of 13 call mise over the same 37 sites — and 114 turbo definitions over 79 names (was 113 / 78), the new one `@tools/repo-checks#check:dedupe`. The no-mise list wraps to five lines, so the branch-gate footnote now rides below the list rather than at a fixed 532, and throws if it would pass the panel floor. The aria-label typed “lists eleven workflows, eight of which call mise for a total of thirty-seven call sites”, already false at twelve; it reads all three counts off the plate. The typed `file:line` cites had drifted before this refresh and are relocated by content at the ref: `lint_workflows` config.toml:145-149 (was 139-143), `//#lint:workflows` turbo.json:252-262, the ci run line config.toml:234, `lint_toml` 130, the taplo pin 82, the cache-gasket inputs turbo.json:265-269 · 282-288 · 293-299 and 265-299, `ci:pull_request` 353-367, the mise → turbo block 192-219, tools/release/mise.toml:100,108-111, tools/release/turbo.json:39-51 and `playwright_deps` mise.toml:87-91; the D2 delegation cites `tasks/turbo_login:44`, where `turbo_login` now calls `mise run read_secret`, and the task list names `turbo_pin_worktree`.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: 54 mise tasks, 22 with `$usage_*` specs, and 113 turbo definitions over 78 names (was 112 / 77) — #1002 gave the eslint plugin a `test:peer-floor` lane. The ci graph reads 717 nodes, 226 real (was 716 / 225), 491 phantoms unmoved; the workflow rows are unmoved.
- 2026-09-25, no rev clause: service door 3 cites `tools/workers-builds/cloudflare-build.ts:71-76`, the script the `.sh` wrapper execs, and names what those lines run: a global npm install of the `packageManager` pin of pnpm, then `npx turbo @www/lit-ui-router.dev#build`. The box note is reflowed across the same ten lines so the longer name clears the box, and its doubled "the" is gone.
- 2026-09-11, no rev clause: re-counted at origin/main @ 65e2843 and the CITES rows rekeyed — `check:graph-edges`, `check:task-inputs` and `check:patches` now live at `@tools/repo-checks`, `docs#typecheck:vue` became `@www/lit-ui-router.dev#typecheck:vue`, and `knip` joins the recognised externals.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: nothing moved: 54 mise tasks, 22 with `$usage_*` specs, 112 turbo definitions, and the ci graph at 716 nodes, 225 real, 1 dead task. The workflow rows are unmoved a seventh time.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: this time mise moved and turbo did not. mise stands at 54 tasks (was 52) with 15 `depends` edges between them, up from 6; turbo holds at 22 files and 112 definitions, and the workflow rows are unmoved a sixth time. The turbo inset reads the ci graph at 716 nodes, 225 real, unchanged.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: turbo moved and the other two machines did not, a second time: 22 turbo files (was 21), 112 definitions (111), of which 68 are member definitions (67), the 77 distinct names unchanged — the new member's own `turbo.json` is the whole of the difference. mise stands at its 52 tasks over 4 homes and the workflow rows are unmoved a fifth time, 8 of 12 workflows entering mise. The turbo inset reads the ci graph at 716 nodes, 225 real. After the record, the frame audit: the `no mise:` list ran clean through the GITHUB ACTIONS panel wall at a depth of 92.9, so it wraps to the panel's own measure now — `NO_MISE_LINES`, 26 characters to a line — and the `branch_ci_gate` footnote drops 522 → 532 to clear it.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: turbo moved and the other two machines did not: 21 turbo files (was 19), 77 distinct names (76), 111 definitions (107), of which 67 are member definitions (63). mise stands at its 52 tasks over 4 homes and the workflow rows are unmoved a fourth time. The install-harness lettering is re-texted for the harness itself — mise-provisioned pnpm, corepack having left the repo.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: re-read at the ref; the workflow, mise and turbo rows are unchanged and the loop is drawn from the same counts the yard's inset reads.
- REV A — 2026-08-17 (8882ef1 "docs: add plate 3A, the handoff works") · REV B — 2026-08-31, dated · REV C — 2026-09-03 (c34644f "sheet 3A handoff census reconstructed as a T1 probe") · REV D — 2026-09-03 (96f89fe) · REV E — 2026-09-06, dated.
- Superseded figures: rev A corrected 36 → 37 workflow call sites, 51 → 48 mise tasks (the 51 had mixed in four user-global `rtk:*`) and 483 → 501 `ci` nodes; rev B 501/158 → 535/165, edges 1,294 → 1,375, phantom 68.5% → 69.2%, and recounted `cache:false` at 12, not 11; rev C re-measured at 35c6766 — 590/176/1,504/126, definitions 91 → 97 in 18 files; rev D 97 → 96 in 17 files and 590 → 586 nodes, real→real down a quarter on #693. Live: 605 nodes, 183 real.
- The finding this plate exists to make has now survived three recounts: the mise machine has not moved a task — 48 tasks in 4 homes, 21 arg specs, 37 call sites across 8 of 11 workflows, and `playwright_deps` still dead.
- Basis: `counted at ${HANDOFF.ref} @ ${HANDOFF.sha}` from `census-handoff.json`, graph from `census-plate.json` [both origin/main @ 185d414, generated 2026-09-07].

## Sheet 3B — THE WATCHED CITY

- **file** `diagrams/generator/sheet3b.mjs` · **id** `graphcity` · **current rev** H
- **basis** (source): `const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3 · ALTERNATE PLATE B — the PR ci graph as a city: 183 real tasks in 28 massed structures · footprint = watched files (46,781 task-file hashes) · height = command sloc (2,118) · 422 phantom plots

### REV B — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV B: hidden-line pass — opaque walls painted back to front, and the main-line annex reseated clear of the plain’s lettering

**prose paragraph** (`sheet3b.mjs`):

> <p><strong>The city is flat, and that is still the finding.</strong> ${FLAT} of ${CI.real} real tasks have command mass 1 — one script line handing the work to a pinned binary; the ratio barely moved as the graph grew a fifth package. The whole city executes ${fmt(TOT_M)} sloc of repo-written command while watching ${fmt(TOT_I)} task-file hashes. The skyline is inverted from intuition: <code>@tools/dts-backtest#test</code> is a ${slocOf('@tools/dts-backtest#test')}-line <code>run.ts</code> on a ${TOWER}-file lot — sheet 3 calls it "one 291-line run.ts holds the TS 5.0 floor", and the graph survey agrees to the line — while the largest footprint, the examples plain, watches ${fmt(CELL.get(25).inputs)} files (format:check ${fmt(row('examples#format:check').inputs)} + lint ${fmt(row('examples#lint').inputs)} alone) under ${CELL.get(25).mass} lines of command. The tallest command is still the root yard's <code>//#lint:elements</code>, which rev B drew as "one eslint line" on the shared root surface and which now runs the repo's own <code>lint-elements</code> bin — ${slocOf('//#lint:elements')} sloc over <code>warn-lanes.core.ts</code>'s ${slocOf('//#lint:elements', 1)} — a ${row('//#lint:elements').mass}-sloc spire on an unchanged footprint. The new quarter arrives flat: <code>eslint-plugin-lit-ui-router</code> brings ${CELL.get(27).tasks} tasks and ${CELL.get(27).mass} sloc, and all but its two <code>oxc-emit</code> build lanes are one line apiece.</p>

### REV C — 2026-08-31

**`sub` clause** (verbatim source):

> REV C 2026-08-31: re-surveyed at ${TURBO} — the graph grew, the plain widened by a third, and //#lint:elements stopped being a one-line lane

resolved →

> REV C 2026-08-31: re-surveyed at turbo 2.10.11 — the graph grew, the plain widened by a third, and //#lint:elements stopped being a one-line lane

**prose paragraph** (`sheet3b.mjs`):

> <p><strong>Method — the graph, imported.</strong> Every mass and footprint on this plate is read from <code>diagrams/data/census-mass3b.json</code>, the checked-in snapshot <code>census-mass3b.mjs</code> writes from a bare <code>turbo run ci --dry=json</code> on an installed archive of the ref — ${BASIS}, ${TURBO}: ${CI.nodes} nodes, ${CI.real} real, ${fmt(CI.edges)} edges, ${CI.realEdges} real→real, against rev C's 535/165/1,375/117. Nothing below is hand-pasted; a structure whose tasks have left the plate throws at build time rather than drawing a stale number, and the schedule totals are the plate's own sums. <em>Footprint</em> is the per-task <code>inputs</code> map — the files whose hashes decide that task's cache key — at 1.2·√files per side. <em>Height</em> is command mass: the package.json script line plus the repo script or bin file it executes, sloc-counted by <code>census-mass3b.mjs</code> on <code>scc</code> 4.0.0's <code>Code</code> basis (guards, emitters and mise task files each cited in the schedule; external binaries like <code>tsc</code> and <code>oxlint</code> contribute only their one line, because that is all this repo wrote). Wall-clock and cache-hit rates are excluded as geometry by design: they are properties of runs, not of the graph.</p>

### REV C corrected — 2026-09-01

**`sub` clause** (verbatim source):

> REV C corrected 2026-09-01: every height re-derived on scc 4.0.0 by census-mass3b.mjs — command sloc 1,737 → 1,774, flat blocks 134 → 130, and the plain re-measured on a clean tree at 17,692 files

### REV D — 2026-09-02

**`sub` clause** (verbatim source):

> REV D 2026-09-02: every number now imported from diagrams/data/census-mass3b.json — the re-based survey grew a fifth package quarter (eslint-plugin-lit-ui-router, ${CELL.get(27).tasks} tasks), 165 → 176 real tasks and 1,774 → 2,022 command sloc

resolved →

> REV D 2026-09-02: every number now imported from diagrams/data/census-mass3b.json — the re-based survey grew a fifth package quarter (eslint-plugin-lit-ui-router, 9 tasks), 165 → 176 real tasks and 1,774 → 2,022 command sloc

### REV E — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV E: whole-cabinet refresh — #693 swapped one root guard for two, so the yard is re-platted and the plate stands at ${CI.real} real tasks in ${M.length} structures

resolved →

> REV E: whole-cabinet refresh — #693 swapped one root guard for two, so the yard is re-platted and the plate stands at 183 real tasks in 28 structures

**prose paragraph** (`sheet3b.mjs`):

> <p><strong>REV E — the root yard re-platted, and one lot got its ground back.</strong> The whole plate cabinet was re-surveyed at ${PLATE.ref} @ ${PLATE.sha} in one pass, and every change on this plate is #693's. It retired <code>//#check:docs-api-deps</code> and put two guards where it stood — <code>//#check:graph-edges</code>, which watches ${fmt(row('//#check:graph-edges').inputs)} files — tied with <code>//#lint:package-json</code> for the widest lot in the yard, and the only one of the two that runs more than a line — and <code>//#check:task-inputs</code> on the root surface — so the yard is drawn with ${M.length} structures rather than 27 and reconciles ${CI.real} real tasks rather than 176. The same PR gave <code>//#check:patches</code> the root <code>$TURBO_DEFAULT$</code> glob it had been missing: its footprint goes 24 files to ${fmt(row('//#check:patches').inputs)}, which is why the yard's thinnest sliver is now a proper block and its note no longer calls it one. The plain, the tower and the five equal slabs did not move. Flatness held through all of it — ${FLAT} of ${CI.real} blocks are still a single script line — and the city now watches ${fmt(TOT_I)} task-file hashes against rev D's 27,953, almost all of it that one guard's new lot.</p>

### REV F — 2026-09-04

**`sub` clause** (verbatim source):

> REV F 2026-09-04: refreshed after the 1.11.2 + mobx 1.0.0 releases — @tools/embed-heights (#703) takes four rows on the instrument terrace, and the examples plain grew from 17,821 to ${fmt(CELL.get(25).inputs)} watched files, so the harbour's note moved to clear its corner — ${BASIS}

resolved →

> REV F 2026-09-04: refreshed after the 1.11.2 + mobx 1.0.0 releases — @tools/embed-heights (#703) takes four rows on the instrument terrace, and the examples plain grew from 17,821 to 31,866 watched files, so the harbour's note moved to clear its corner — surveyed at origin/main @ 185d414 (2026-09-07)

### REV G — 2026-09-06

**`sub` clause** (verbatim source):

> REV G 2026-09-06: the schedule re-ruled — the right column stood half a pixel off the longest //# row, so the band's spare measure is now split evenly into a 40px gutter and a 40px right margin, and the roads note wraps rather than running 57px off the sheet

### REV H — 2026-09-07

**`sub` clause** (verbatim source):

> REV H 2026-09-07: re-surveyed at origin/main @ 185d414 after #716 and #717 — the examples plain grew again and its south vertex crossed the old art edge into the schedule band, so the art region is 70px deeper and the plain's own lettering sits clear beneath the vertex instead of under it

**Record notes**

- 2026-09-13, after the refresh, no rev clause: the frame audit. Three roads off the quarters row were leaving from inside a building, the sixth quarter (27 `lit-ui-router-effect`) having been founded under them and the fifth (2) having grown: quarters → release y 50 → 64, quarters → dts tower (the dashed leg) y 54 → 68, and typedoc's return leg 62 → 84, so it drops with them instead of running two units off the release lane. No quarter moved.
- 2026-09-11, no rev clause: re-surveyed at origin/main @ 65e2843. Structure 24 "the harbour" repoints from `docs` to `@www/lit-ui-router.dev`; `@tools/repo-checks` is drawn whole as structure 1, "the guard house" — 8 tasks, 763 files, 299 sloc — sited off the root yard's west edge, and the former structures 2 and 28, the separate check plots, fold into it; the eslint-plugin quarter renumbers 27 → 2 so the badges stay contiguous at 1–26. `TERRACE` holds 18 packages, `@tools/bootstrap` and `@tools/eslint` among them. The root yard's lettering and notes are rewritten: six equal slabs watch 688 root files, and the four guards (graph-edges, task-inputs, patches, knip) are named in the root lint task's `with` list rather than as root tasks of their own. The floating harbour label moved to open ground at (560, 660).
- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: 235 real tasks in 29 structures over 13,307 task-file hashes and 3,029 command sloc (was 234 / 13,064 / 2,921); the root surface 851 files (was 843). #1090's `check:package-coverage` joins the `lint` umbrella's `dependsOn`, so the guard-house sentence names seven repo-checks lanes, five of them guards (124, 109, 70, 62 and 107 lines). `census-mass3b.mjs` takes its CITES row by hand (`node` is EXTERNAL, no DRIFT), and its `miseRunLine` reads a `'''` run block, since #1089 rewrote `lint_actionlint`'s run as one and the probe printed `declared mise-run but … resolves to no run line`. The guard house (1) rose to 483 sloc of command (was 379), its roof standing in the plate's title block, and moves 10,155 → 355,585, south-west of the yard; the paragraph says so. At 483 it out-tops the spire, so the spire caption reads "the tallest one command" where it said "the city's tallest", and the build throws if `//#lint:elements` stops being the tallest task.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: 234 real tasks in 29 structures over 13,064 task-file hashes and 2,921 command sloc (was 227 / 28 / 11,899 / 2,828). #1038 renamed every package's leaf tasks (`lint:oxlint`, `typecheck:tsc`, `format:check:oxfmt`), so the examples plain cites them. New structure 28 `//#lint:complexity` stands in the root yard's second slab row; the equal-slab count derives from the plate (seven, was a typed six). `census-mass3b.mjs` cites `check-single-version.ts` for the new guard (66 sloc), and the guard-house sentence names the six repo-checks lanes in the `lint` umbrella's `dependsOn` list, four of them guards, the build throwing if a named guard is one script line. The typed "291-line run.ts" quote reads the plate (293). `@tools/crap` joins the instrument terrace (19 tools).
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: 227 real tasks (was 226) over 11,899 task-file hashes (was 11,770) and 2,828 command sloc (was 2,718). `census-mass3b.mjs` printed a new DRIFT line — `@tools/repo-checks#check:dedupe: unrecognised executable pnpm` — and `pnpm` joins the EXTERNAL binaries, a judgement (pnpm is not repo-written), so the lane masses one script line; the three `check:dev-split` lines remain. #1016 put `check:dedupe` into `lint`'s `with` list, which made “four of its 8 tasks … are named in the `lint` task's `with` list” false: the notes now name five, “Three of the five” guards, and “the other two are one script line each — `knip` hashing 635 files, the widest lot in the block, and `pnpm dedupe --check` hashing 62”. The `with` list is a hand list (the dry run records no `with`); the build throws if a named lane is missing, if either one-liner carries mass, or if knip stops being the block's widest lot. The eslint-plugin quarter reads 170 sloc with `build:js` at 69.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: 226 real tasks (was 225) watched over 11,770 task-file hashes (was 11,718) and executing 2,718 command sloc (was 2,656). `census-mass3b.mjs` printed a fourth DRIFT line — `eslint-plugin-lit-ui-router#test:peer-floor` runs the repo-written `peer-floor-guard` with no cite — and CITES now files `tools/compat-guards/src/peer-floor-guard.ts` for it, the way the lit 2 and mobx 6 lanes file their guards; the same three `check:dev-split` DRIFT lines remain. That cite made the notes' “the eslint-plugin quarter is flat throughout … all but its two `oxc-emit` build lanes are one line apiece” false: the quarter is 10 tasks / 157 sloc with a 72-line lane. The sentence now names the quarter's lanes above one line off the plate — “all but `build:js` (56), `build:types` (22) and `test:peer-floor` (72) are one line apiece” — and the build throws if plot 2 and the package disagree on their task count. The root surface reads 820 files, `@tools/repo-checks` 924, knip 632.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the city is watched over 11,718 task-file hashes (was 11,701) against the same 225 command-bearing tasks and 2,656 command sloc, read by turbo 2.11.2. The root surface is 819 files (was 818), so the six equal root slabs and the root-files label read 819; `@tools/repo-checks` watches 923 (was 922) and its knip line 631 (was 630). The `nav-location-plugin` quarter watches 183 files over its 10 tasks (was 173) and is still the smallest quarter, which its caption says. `census-mass3b.mjs` carries the same three DRIFT lines. No quarter took a row.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the city is watched over 11,701 task-file hashes (was 11,188) against the same 225 command-bearing tasks, 177 of them on mass 1, read by turbo 2.11.2. `TERRACE`, `APPS` and the seven package quarters took no row, and `census-mass3b.mjs` carries the same three DRIFT lines, the effect, mobx and ssr `#check:dev-split`. Two quarter captions are re-texted present-state: effect's drops “published at 0.1.0-rc.0”, 0.1.1 being `latest` now, and ssr's drops “new to this survey”.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the city is watched over 11,188 task-file hashes against 225 command-bearing tasks and 2,656 sloc of command text (was 10,622 / 213 / 2,438), in 28 massed structures over 491 phantom plots. `TERRACE` and `APPS` took no row — no tool and no app was born — but a SEVENTH package quarter was cut, 38 `lit-ui-router-ssr` at 445,30, the row's east end and 5.6 units clear of quarter 27, whose own caption is re-texted now the effect bindings are published at 0.1.0-rc.0. `census-mass3b.mjs` filed no absent-CITES error and now carries a THIRD DRIFT line beside the effect and mobx ones: `lit-ui-router-ssr#check:dev-split` runs the repo-written `oxc-emit-check-dev-split` with no cite.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the city is watched over 10,622 task-file hashes against 213 command-bearing tasks and 2,438 sloc of command text (was 9,606 / 195 / 2,212). `TERRACE` took no row, but two hand tables did: `APPS` gained `sample-app-lit-effect`, and a sixth package quarter was cut — 27, `lit-ui-router-effect`, at 418,30 — which the plate demanded by throwing on 17 unclaimed real tasks. `census-mass3b.mjs` filed no absent-CITES error and now carries a second DRIFT line beside the mobx one: `lit-ui-router-effect#check:dev-split` runs the repo-written `oxc-emit-check-dev-split` with no cite. `@tools/lit-template-lint#test` flipped placeholder → real.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the city is watched over 9,606 task-file hashes, up from 9,479, against the same 195 command-bearing tasks and the same 2,212 sloc of command text — the growth is input coverage, not new commands. `census-mass3b.mjs` filed no absent-CITES error, and its one standing DRIFT line is unchanged: `lit-ui-router-mobx#check:dev-split` runs the repo-written `oxc-emit-check-dev-split` (`tools/oxc-emit/`) with no cite. `TERRACE` took no new row — no member was born since 65e2843.
- REV A — before 2026-08-31, referenced only · REV B — 2026-08-31 (053cc87 "hidden-line pass") · REV C — 2026-08-31, corrected 2026-09-01 · REV D — 2026-09-02 · REV E — 2026-09-03 (96f89fe) · REV F — 2026-09-04 · REV G — 2026-09-06 · REV H — 2026-09-07; every rev from C on is dated in its own clause.
- Superseded figures: rev C command sloc 1,737 → 1,774, flat blocks 134 → 130, the plain at 17,692 files on a clean tree; rev D 165 → 176 real tasks and 1,774 → 2,022 command sloc; rev E 27 structures → 28, 176 → 183 real, `//#check:patches` 24 files → 646, and rev D's 27,953 task-file hashes → 46,781; rev F the examples plain 17,821 → 31,866; rev G split the band's spare measure into a 40px gutter and a 40px right margin, ending a 57px overrun; rev H deepened the art region 70px.
- The graph stands at 605 nodes / 183 real / 1,424 edges / 99 real→real against rev C's 535/165/1,375/117.
- Basis: `surveyed at ${PLATE.ref} @ ${PLATE.sha}` from `census-mass3b.json`, graph counts from `census-plate.json`, toolchain turbo 2.10.11 [origin/main @ 185d414, generated 2026-09-07].

## Sheet 4 — THE FAMILY SPINE

- **file** `diagrams/generator/sheet4.mjs` · **id** `family` · **current rev** F
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 4 — one core, four living adapters, four dormant instruments

### REV B — undated in the copy

**other rev-bearing copy** (`sheet4.mjs`):

> caption: `Not a loop and not a city: a spine. Every limb shares @uirouter/core and none of the limbs talk to each other — so the honest drawing is radial. Rev B gave every limb its measured mass and a gate on every stem; rev C stops typing the registry by hand — versions and publish dates now come from the checked-in npm plate, which is how @uirouter/angular ${npmRow('@uirouter/angular').version} (${npmRow('@uirouter/angular').published}) arrived on the sheet: upstream is consolidating ui-router into a monorepo, and the family is waking up.`,

### REV C — undated in the copy; first in git 2026-09-02

**`sub` clause** (verbatim source):

> REV C: every version and publish date imported from census-npm.json (${REGISTRY}), core and this repo's mass from census-bricks.json

resolved →

> REV C: every version and publish date imported from census-npm.json (npm registry read 2026-09-07), core and this repo's mass from census-bricks.json

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: whole-cabinet refresh — the lint plugin's schedule line now prints BOTH its npm version and its in-repo version, which the rc.2 release pulled apart

### REV E — 2026-09-04

**`sub` clause** (verbatim source):

> REV E 2026-09-04: this repo's gates — the shared core gate and mobx's own on lit-ui-router — now read census-couplings.json instead of two hand-typed ranges, and the build throws if the companions ever stop sharing one

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: the registry re-read after the release workflows — `lit-ui-router` 1.16.2, `lit-ui-router-ssr` 0.2.0, `lit-ui-router-effect` 0.2.0, `lit-ui-router-mobx` 1.1.0 and `eslint-plugin-lit-ui-router` 1.2.0, all under `latest`, published 2026-10-04; the NOT MASSED row reads the plugin at 1.2.0 on npm and in the repo. The TOTAL reads 14 packages · 236 authored files · 16,736 sloc (was 235 / 16,485); the flagship limb 22 files / 2,752 lines, mobx at ^1.15.0 and ssr at ^1.16.1 on the spine.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: the registry re-read — `lit-ui-router-ssr` 0.1.0 → 0.1.1 under `latest`, published 2026-09-29. The TOTAL reads 14 packages · 235 authored files · 16,485 sloc (was 234 / 16,377); ssr is 11 files and 1,093 lines.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: the registry re-read — `lit-ui-router-ssr` 0.0.1-alpha.0 → 0.1.0 under `latest`, published 2026-09-29, its `rc` tag gone, and the flagship's `rc` tag gone. No row quotes an `rc`, so every row prints bare (`0.1.0 · 10f`) and the rc paragraph prints its empty-case sentence, “Every version on this sheet is the one npm serves under `latest`.” The TOTAL reads 14 packages · 234 authored files · 16,377 sloc (was 233 / 16,192); core falls to 32% of the family; ssr, the bridge, is 10 files and 985 lines.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the registry re-read — `lit-ui-router` 1.15.0 → 1.16.0 under `latest`, published 2026-09-28, with `rc` at 1.16.0-rc.3 no longer ahead of it, so its row prints the bare `1.16.0`; `lit-ui-router-effect` 0.1.1 → 0.1.3, the plugin 1.0.0 → 1.0.1; ssr still quotes `0.1.0-rc.3 · rc` over its `0.0.1-alpha.0` latest. The rc paragraph said “`lit-ui-router-ssr` ships its newest work under npm's `rc` tag rather than `latest`, and so does the flagship itself” — typed, and false once the flagship released. It now names the rows the sheet quotes under `rc`, collected as the rows are built: “`lit-ui-router-ssr` ships its newest work under npm's `rc` tag rather than `latest`, the one package on this sheet that does”. The TOTAL reads 14 packages · 233 authored files · 16,192 sloc (was 16,177); effect's gate reads `^1.15.0`.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the registry re-read — `ui-router-navigation-location-plugin` 0.3.2 → 1.0.0, published 2026-09-26 under `latest` with no `rc` tag, so its row prints the bare `1.0.0 · 2f` and its label `1.0.0 — 2f · 141 sloc · 71 l/f · gate ^6.0.8` (was 0.3.2, 1f · 105 · 105 l/f). The companion bay adds 2,535 lines behind the shared gate (was 2,499). The TOTAL reads 14 packages · 233 authored files · 16,177 sloc (was 232 / 16,141). The flagship still quotes `1.16.0-rc.1 · rc`, ssr `0.1.0-rc.2 · rc`.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the registry re-read — `lit-ui-router-mobx` 1.0.1 → 1.0.2 and `lit-ui-router-effect` to 0.1.1, both published 2026-09-21 under `latest`, effect's `rc` tag gone with it, so its row prints the bare 0.1.1. The rc rides two other rows now: `lit-ui-router` files latest 1.15.0 against rc 1.16.0-rc.1, and `lit-ui-router-ssr` latest 0.0.1-alpha.0 against rc 0.1.0-rc.2, so the sheet prints `1.16.0-rc.1 · rc` and `0.1.0-rc.2 · rc`. The rc paragraph is re-texted to name ssr and the flagship where it named effect.
- 2026-09-14, REV F: the registry re-read — `lit-ui-router` 1.14.1 → 1.15.0 and `ui-router-server` 0.1.2 → 0.2.0, both published 2026-09-14; the other repo rows and the eight upstream rows are unchanged. The companion bay is FIVE now, `lit-ui-router-ssr` joining `lit-ui-router-effect` behind the one shared core gate, so the bay is re-laid and its gate letters `all five`. The new companion is the only member on the sheet whose peers include a second companion — it declares `lit-ui-router` ^1.15.0 AND `ui-router-server` ^0.2.0 — so its row is tied to the server's by a dashed bridge and the key names it: a bridge between the element library and the server router, not a limb off either. `census-npm.mjs` records a dist-tag map per row from this refresh, `version` staying `latest`, so the two release candidates file latest 0.0.1-alpha.0 with rc 0.1.0-rc.0 and the sheet quotes `0.1.0-rc.0 · rc` where the rc leads latest.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the registry re-read, and every published member of the family moved on one day: `lit-ui-router` 1.13.0 → 1.14.1, `lit-ui-router-mobx` 1.0.1, `ui-router-navigation-location-plugin` 0.3.2, `ui-router-server` 0.1.2 and `eslint-plugin-lit-ui-router` 1.1.0, all published 2026-09-13. The eight upstream rows are unchanged.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the registry re-read — `lit-ui-router` 1.12.0 (published 2026-09-09) → 1.13.0 (2026-09-12). The other twelve rows, the eight upstream members included, are unchanged.
- REV A — 2026-08-16 (c73b65b) · REV B — 2026-08-16 (b2f972f) · REV C — 2026-09-02 (b346a9a "sheet 4 registry facts from the npm plate") · REV D — 2026-09-03 (96f89fe) · REV E — 2026-09-04 (395d092), dated.
- Rev B's scale rule: `KW = 2.7`, `KH = 2.2`.
- The upstream adapters' and instruments' files and sloc have no plate: they are clone counts taken from the ui-router org repos on 2026-08-16 and kept verbatim. The gates were hand-typed until rev E.
- Basis: `census-npm.json` (npm registry read 2026-09-07) for versions and publish dates, `census-bricks.json` for this repo's mass, `census-couplings.json` for its gates.

## Sheet 5 — THE DESIGN SPACE

- **file** `diagrams/generator/sheet5.mjs` · **id** `runtime` · **current rev** B
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 5 — routers in the JS runtime · positions are editorial, argued in the notes

### REV B — 2026-09-06

**`sub` clause** (verbatim source):

> REV B 2026-09-06: the empty-quarter callout re-cut to the line it frames (330 → 236 wide) — the dashed box had been drawn to the mono lettering and, at the data face, crossed the first column boundary into the server column it says nothing about; no point moved

**Record notes**

- REV A — 2026-08-16 (c73b65b; label-collision pass 693e6d8 the same day) · REV B — 2026-09-06, dated in the sub, committed 2026-09-07 (cf45bb0).
- The empty-quarter callout was 330 wide at rev A and is 236 now, 86 tall.
- Basis: none — positions are editorial, argued in the notes; no plate, no ref, no census import.

## Sheet 6 — THE ROUTING STRATA

- **file** `diagrams/generator/sheet6.mjs` · **id** `planet`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 6 — routing in general · the altitude where prose outranks pictures

_No REV clauses, historical paragraphs or rev-bearing callouts: this plate has only ever been issued at its current revision._

**Record notes**

- No REV material of any kind: `sheet6` has no `rev` key, and no lettering, paragraph, caption or key row on the plate references a revision. Untouched since its two 2026-08-16 commits (c73b65b, and 693e6d8's label-collision pass).
- Basis: none — the sheet is a definition, not a measurement.

## Sheet 7 — THE MEASURED CITY

- **file** `diagrams/generator/sheet7.mjs` · **id** `census` · **current rev** F
- **basis** (source): `const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3½ — the same city as sheet 3, surveyed by mass · 32 members · 4 districts

### REV B — undated in the copy; first in git 2026-08-16

**`sub` clause** (verbatim source):

> REV B: districts, gate severity in colour, and the roads between them — counted 2026-08-16

**other rev-bearing copy** (`sheet7.mjs`):

> caption: 'Sheet 3 drew the monorepo as a process; this sheet counts who lives in it. Rev B keeps the census — footprint ∝ √sloc, height ∝ authored files, tests drawn as annexes rather than deleted — and adds the two things a census alone cannot say: which districts these members belong to, and which roads actually run between them. Every road is a workspace dependency or a turbo task edge, never an impression.',

### REV C — 2026-08-31

**`sub` clause** (verbatim source):

> REV C 2026-08-31: hidden-line pass — the masses now carry opaque faces and are painted back to front, so no rear iso edge reads through a front wall

### REV D — 2026-08-31

**`sub` clause** (verbatim source):

> REV D 2026-08-31: recount — three new instruments massed (28 lint-elements, 29 warn-lanes, 30 eslint-ts-parser), and every sloc rebased on scc 4.0.0’s Code count; on one identical file set the new ruler reads about +0.9% over the old “neither blank nor comment-only” filter, and the rest of the movement is code · every number now imported from diagrams/data/census-city.json

**prose paragraph** (`sheet7.mjs`):

> <p><strong>REV D — two things moved at once, and the plate keeps them apart.</strong> First the <em>ruler</em>: sloc is now <code>scc</code> 4.0.0's <code>Code</code> count rather than the old "neither blank nor comment-only" filter. Measured both ways over one identical file set — sheet 3 rev B's twenty-five source directories at today's HEAD — the old counter reads 11,560 and <code>scc</code> reads 11,658, about +0.9%. So roughly a hundred lines of the growth below is the tape measure, not the building. Second the <em>city</em>: fourteen days, one release (<code>lit-ui-router@1.10.0</code>, tagged 2026-08-17) and three new instruments. №28 <code>@tools/lint-elements</code> and №29 <code>@tools/warn-lanes</code> were both born 2026-08-31 (#639); №30 <code>@tools/eslint-ts-parser</code> was born 2026-08-16 (#557) and is the "28th member, not yet on any map" that plate 7B recorded — it can be placed now, and at 1 authored line it lands on the drawing's minimum footprint, the smallest thing in the yard. The yard is where the growth is: 16 members and 4,684 sloc become ${DT.n} and ${fmt(DT.sl)}, and it stays the city's largest district by a wide margin.</p>

### REV E — 2026-09-04

**`sub` clause** (verbatim source):

> REV E 2026-09-04: cabinet refresh after the 1.11.2 + mobx 1.0.0 releases — №32 @tools/embed-heights (#703) massed on the yard's middle row, and two schedule notes shortened to fit the frame

### REV F — 2026-09-07

**`sub` clause** (verbatim source):

> REV F 2026-09-07: re-surveyed after #717 moved the documentation site from docs/ to www/lit-ui-router.dev/ and #716 dropped the sample app's markov seed pipeline — member №10 is massed at its new path and the shopfront's district lettering follows it; the member keeps the name docs, which is still what its package.json and every turbo task id say — ${BASIS}

resolved →

> REV F 2026-09-07: re-surveyed after #717 moved the documentation site from docs/ to www/lit-ui-router.dev/ and #716 dropped the sample app's markov seed pipeline — member №10 is massed at its new path and the shopfront's district lettering follows it; the member keeps the name docs, which is still what its package.json and every turbo task id say — counted at origin/main @ 185d414 (2026-09-07)

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: 39 members in 4 districts, 294 authored files / 24,550 sloc plus 154 spec files / 27,313 (was 291 / 23,832 and 151 / 25,850). No member was born. №39 `@tools/crap` moves 560,430 → 570,430 off repo-checks' annex, which reaches 562.2. №35's note reads "graph edges, inputs, versions, coverage, patches, deps" — #1090 added a guard — and the row ends inside its column (measured off the kit face it reached 1,570 against the 1,560 viewBox). The district lettering `packages/ — THE PRODUCT` moves 815 → 824 off the flagship's roof (to x 817).
- 2026-10-04, no rev clause: two lines re-set to their columns, measured in the kit face. №35 `@tools/repo-checks`' schedule note reads "graph edges, inputs, single version, patches, knip, dedupe · lint lane" (it ran 66 units past the right column), and road E in the register drops "turbo" as rows C and D already do (it reached the register's frame). The user's word: "sheet 7 legend has some text overflow issues".
- 2026-09-29, no rev clause: №12 `@tools/release` moves 20,430 → 0,455. At 20,430 its 150 px tower and 69 px annex stand in front of №14 `@tools/dts-backtest`, №30 `@tools/eslint-ts-parser` and №23 `@tools/lit-test-env` on the 350 row and hide their masses; from 0,455 the tower's band clears all three, so none of them moves and roads C and D keep their lanes. №16 `@tools/shared` moves 20,550 → -16,550 with it, so its badge rides west of the tower's face; road G's last leg drops y 430 → 475 to end at the tower's west edge (trim 66 → 61) clear of that badge, and the release callout's leader follows the tower. №25 `@tools/lcov-rebase` moves 415,350 → 180,395, off the row's east end, where №35 `@tools/repo-checks`' roof and badge stand over its annex. `assertPlots` passes; the frame audit reads 0 escapes, 0 hits and 0 text-on-text.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: 39 members in 4 districts, 291 authored files / 23,832 sloc plus 151 spec files / 25,850 (was 38, 281 / 22,725 and 146 / 24,662). №39 `@tools/crap` (#1056) is placed at 560,430, report tier. `assertPlots` moved №21 `@tools/release-config` 280 → 288 off oxc-emit's grown annex, and №28 `@tools/lint-elements` 388 → 394; №19 and №32 carry their badges on their own roofs. №14's note reads its run.ts sloc off the plate (293) where it typed 291, and throws if the member stops being one file.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: 38 members in 4 districts, 281 authored files / 22,725 sloc plus 146 spec files / 24,662 spec sloc (was 280 / 22,476 and 145 / 24,213). The packages district reads 64 files / 6,648 sloc; `lit-ui-router-ssr` is 10 / 985 under 10 / 2,578 (2.6×, was 2.7×) and `@tools/release` 50 / 2,413. `assertPlots` passed and no lot moved.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: 38 members in 4 districts, 280 authored files / 22,476 sloc plus 145 spec files / 24,213 spec sloc (was 279 / 22,360 and 145 / 23,874). The packages district reads `7 members, 7 published · 63 files · 6,463 sloc`, asserted and true; `lit-ui-router` is 21 / 2,605 under 28 / 8,011 (3.1×), effect's annex 2.2× → 2.7× and ssr's 2.6× → 2.7×. `tools/eslint` gained `catalog-fields.ts` (5 files, 262 sloc) and `@tools/release` reads 50 / 2,367 after #995. `assertPlots` passed and no lot moved.
- 2026-09-25, no rev clause: road E's task citation is `@www/lit-ui-router.dev#wrangler:dev`, the `with:` turbo's `e2e` task actually names; the member row keeps the short label `docs` for the site.
- 2026-09-13, after the refresh, no rev clause: the frame audit, and not one `PLACED` coordinate moved. TESTS road 5 — `@tools/dts-backtest` under the runtime packages — took its lane x 33 → 20, the old lane running 3 units inside №37 `lit-ui-router-effect`'s new src plot at x 30; 20 is west of every plot on the way down. And `cityHero()`'s extent now folds the four district-rect corners in with the mass corners — viewBox 85.4 18 1192.2 754.6 → 20 18 1300 790 — because the hero draws the district frames but was measured off the blocks they gird alone, so the routed cover's city card cut three of the four dashed frames.
- 2026-09-13, OPEN — flagged on the frame audit, no decision taken and nothing moved: the accent “typecheck reads” trunk (road 4, y = 115) now runs under `lit-ui-router`'s annex, whose south face grew 105.8 → 121, for x 85.3–212, so the “two stubs, one trunk” reading the road was drawn for is lost. Every clear lane below is blocked by the y = 130 package row, so the move is the user's to make.
- 2026-09-11, no rev clause (the copy is present-state): №15 `@tools/build_and_test` moved x 330 → 300 and №32 `@tools/embed-heights` x 430 → 440 on the works row, after 15's spec annex grew across 32's plot; `iso-hidden.mjs::assertPlots` now stops the build on any such overlap (DESIGN-REVIEW §T53).
- 2026-09-11, cabinet refresh at origin/main @ 65e2843: `PLACED` gains rows 33 `@tools/bootstrap` (490, 350), 34 `@tools/eslint` (514, 530) and 35 `@tools/repo-checks` (449, 385, pr tier), and №32 `@tools/embed-heights` moved again — 440,430 → 449,462 — to open the lot, its nearest air going 10.9 → 19.9. The notes now read seven members that can stop a PR, repo-checks added.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: 38 members in 4 districts, 279 authored files / 22,360 sloc plus 145 spec files / 23,874 spec sloc (was 278 / 22,321 and 145 / 23,672). №4 `navigation-location-plugin` is 2 files / 141 sloc under 7 spec files / 612 (was 1 / 105 and 7 / 410), its annex 3.9× → 4.3×; `assertPlots` passed and no lot moved. The packages district reads `7 members, 7 published · 63 files · 6,448 sloc`, asserted and true. Two sentences went false with nothing to catch them: №4's schedule note was the hand string “one 105-line file, seven spec files”, and the annex paragraph said the plugin “is one ${g(4).sl}-line file” with the count interpolated and the “one” typed. The note is now the plugin's role and its derived annex ratio, like its neighbours' (“the location seat, core's pushStateLocation swapped out · annex 4.3×”), and the paragraph derives the file count and its plural: “141 lines in 2 files under 7 spec files (4.3×)”. In the apps district `sample-app-shared` is 39 / 2,354 (was 2,351).
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: 38 members in 4 districts, 278 authored files / 22,321 sloc plus 145 spec files / 23,672 spec sloc (was 267 / 21,404 and 132 / 20,900). No member was born and `assertPlots` threw anyway, a third refresh running on the same cause: `lit-ui-router` is 21 files / 2,596 sloc with 28 spec files / 7,920, its annex 233.9 × 132.0, so №2 `ui-router-server` goes 226 → 240 and №3 `lit-ui-router-mobx` y 136 → 146. A SECOND annex grew this time: №38 `lit-ui-router-ssr` is 9 files / 796 sloc with 9 spec files / 2,070 (was 2 / 253 and 1 / 421), and its annex spans x 215–288, straight across the oxc-emit road's old lane at x 238 — so road 3 is drawn to the nearest `packages/` member it serves, which is №38 now, turning west under the annex. The district's `7 members, 7 published` is asserted and true. In the yard: `tools/release` 50 / 2,398 · 24 / 2,707, `tools/repo-checks` 7 / 607 · 5 / 639, `tools/happy-dom` 2 / 14 · 1 / 54.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: 38 members in 4 districts, 267 authored files / 21,404 sloc plus 132 spec files / 20,900 spec sloc (was 37 / 262 / 20,900 and 124 / 19,471). `PLACED` took №38 `lit-ui-router-ssr` at 160,210 — the district's south row, east of the effect bindings, a lot with nothing tall in front of it and 9.7 units west of the oxc-emit lane; two earlier lots were drawn and rejected, (330,130) and (360,125), both standing inside №31's block. THREE neighbours moved, all of them on grown annexes rather than on the new lot: №2 `ui-router-server` 222 → 226 (the flagship's annex reaches 223.3 at this ref), №3 `lit-ui-router-mobx` y 130 → 136, and №28 `@tools/lint-elements` 380 → 388. The lettering moved with the masonry — `packages/ — THE PRODUCT` 772 → 815 — and `PUBLISHED_PKGS` lost its `- 1`: with no private member left in the district, the count is the district's own. One road-register claim went the other way: row C's `@tools/dts-backtest` tally, “five of the six” and already overstated, is replaced by an uncounted phrase, because no plate on the set carries devDep edges to count it from. After the record, the frame audit: schedule row 35, `@tools/repo-checks`, ran 74 units past the frame, so its note is reworded shorter with all four check names kept.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: 37 members in 4 districts, 262 authored files / 20,900 sloc plus 124 spec files / 19,471 spec sloc (was 35 / 242 / 18,927 and 109 / 16,279). Two members were born and `PLACED` took both — 36 `sample-app-lit-effect` at 660,100 and 37 `lit-ui-router-effect` at 30,210, both `line` tier — and one neighbour had to move for them: №2 `ui-router-server` goes 200 → 222, because lit-ui-router's annex grew to 126.7 units and `assertPlots` threw on a 12.0 × 54.4 overlap with the server's west wall. The road register re-counted with the district: `@tools/oxc-emit` is a devDependency of all six packages/ members, `@tools/dts-backtest` of five of them, and `lit-ui-router` builds into four sample apps.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: 35 members in 4 districts, 242 authored files / 18,927 sloc plus 109 spec files / 16,279 spec sloc (was 241 / 18,823 and 106 / 15,710) — the spec annex carries most of the growth, the two new `<ui-view>` SSR spec files among it. No member was born since 65e2843, so `PLACED` took no row and `assertPlots` had nothing to move.
- REV A — 2026-08-16 (fed935c) · REV B — 2026-08-16 (8428701 "rework sheet 7 as the measured city"; heights doubled b504dbe the same day) · REV C and REV D — 2026-08-31, dated (053cc87; 8033db3, plate import be01a38 2026-09-02) · REV E — 2026-09-04 (4332b21) · REV F — 2026-09-07 (cf45bb0).
- Rev B's scale rule: `KS = 1.6` (footprint = 1.6·√sloc), `KH = 3.0` px per authored file — doubled from rev A's 1.5.
- Superseded figures: rev D changed the ruler as well as the city — over one identical file set (sheet 3 rev B's twenty-five source directories) the old "neither blank nor comment-only" filter reads 11,560 and scc 4.0.0 reads 11,658, about +0.9%, so roughly a hundred lines of that growth is the tape measure. The city went 27 members → 30, the yard 16 members / 4,684 sloc, and `@tools/oxc-emit` had been hand-kept at 3 files / 100 lines.
- Basis: `counted at ${PLATE.ref} @ ${PLATE.sha}` from `diagrams/data/census-city.json` [origin/main @ 185d414, generated 2026-09-07].

## Sheet 7A — THE SHADOW SURVEY

- **file** `diagrams/generator/sheet7a.mjs` · **id** `shadow` · **current rev** E
- **basis** (source): `const BASIS = `metered at ${SHADOW.ref} @ ${SHADOW.sha} (${SHADOW.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3½ — ALTERNATE PLATE TO SHEET 7: the measured city under its own test light · same city as sheet 7, 32 members

### REV B — undated in the copy; first in git 2026-08-17

**`sub` clause** (verbatim source):

> REV B: polarity corrected — the tests are the light, shadow is the untested

**prose paragraph** (`sheet7a.mjs`):

> <p><strong>REV B — the polarity is corrected, not the data.</strong> This plate's first printing drew coverage as cast shadow, so the best-tested district read gloomiest — the metaphor upside down, as the client noted: the tests are the light, and shadow should mean what shadow means. Every number below is rev A's, unchanged; only the optics flipped. The spec annex is now the lamp, covered source glows, and the members with no suite at all are finally the dark buildings they always were.</p>

### REV C — 2026-08-31

**`sub` clause** (verbatim source):

> REV C 2026-08-31: lettering pass — no district boundary is drawn through a caption

### REV D — 2026-08-31

**`sub` clause** (verbatim source):

> REV D 2026-08-31: footprints refreshed to sheet 7 rev D’s census; the light was NOT re-metered and the plate said so

**prose paragraph** (`sheet7a.mjs`):

> <p><strong>The gate first: the reconstruction had to reproduce the sheet before it was allowed to replace it.</strong> Run against the old metering's own ref, <code>3557c29</code>, the probe returns rev D's printed figures exactly — the same thirteen metered members with the same category letters, and line, branch and function coverage identical to the last decimal on every one of them; the schedule's grand total comes back as 5,427 of 5,539 lines, 1,283 of 1,351 branches, 419 of 437 functions, which is what rev D printed. It also reproduces the meter footprints the old header narrated: <code>lit-ui-router</code> at 1,325 sloc and <code>@tools/shared</code> at 9 files / 300. <strong>One figure did not reproduce, and it is worth the space:</strong> <code>@tools/build_and_test</code> was recorded at 7 files / 756 sloc with 464 lit, and the probe reads 7 files / 779 with 487. The file sets are identical; the 23 lines are all in <code>error-summary.core.ts</code>, which the old "neither blank nor comment-only" counter reads at 233 and <code>scc</code> 4.0.0 reads at 256 — the string-aware ruler sheet 7 changed to at its own rev D, counting template-literal interiors as code. So the meter reproduces perfectly and the tape measure moved, which is exactly the distinction this plate exists to keep.</p>

**prose paragraph** (`sheet7a.mjs`):

> <p><strong>REV D — the footprints moved, the light did not.</strong> Sheet 7's census was re-taken on 2026-08-31 on a new sloc ruler (<code>scc</code> 4.0.0's <code>Code</code> count) and grew from 27 members to 30, so this plate's footprints, annexes and districts were refreshed to match — the two plates still overlay building for building. The <em>light</em> was <strong>not</strong> re-metered. This plate's 13-member, 5,539-line universe came from bespoke <code>census-shadow.mjs</code> runs (nine of the thirteen members were metered by nothing the repo itself schedules), and re-running <code>turbo run test:coverage</code> reproduced only the four packages — 2,380 of 2,397 lines, 99.29%. So the verdict box and the schedule total were printed as what they were: the 2026-08-17 metering, unmoved, and labelled as not re-run. The census had by then overtaken the meter in three places, daggered in the schedule; the sharpest looked like <code>@tools/build_and_test</code>, which grew 756 → 1,128 sloc when the error summary landed and lost a lamp on plate 7B — a reading rev E has since shown to be an artefact of the dagger, not a suite that stopped covering. The three new members were drawn dark or untethered on their first appearance: <code>lint-elements</code> and <code>eslint-ts-parser</code> had no suite at all, and <code>warn-lanes</code> had a real <code>.core.test.ts</code> that was believed to leave no lcov.</p>

### REV E — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV E: RE-METERED — census-shadow.mjs is a scripted probe now, so the light is measured at the same ref as the census (${BASIS}); the daggers retire, №31 is metered for the first time, and nothing on this plate is hand-pasted

resolved →

> REV E: RE-METERED — census-shadow.mjs is a scripted probe now, so the light is measured at the same ref as the census (metered at origin/main @ 185d414 (2026-09-07)); the daggers retire, №31 is metered for the first time, and nothing on this plate is hand-pasted

**prose paragraph** (`sheet7a.mjs`):

> <p><strong>REV E — the light is a plate, and the daggers are gone.</strong> Every earlier printing of this sheet carried a caveat the rest of the atlas had grown out of: the footprints were a filed census and the <em>light</em> was a hand-pasted transcription of a 2026-08-17 run of a generator that lived in <code>tmp/</code> and no longer exists. That generator is reconstructed as <code>diagrams/generator/census-shadow.mjs</code>, a T3 probe on the same harness every other execution probe uses — materialize the ref, <code>corepack pnpm install --frozen-lockfile</code>, then meter each member under <em>its own</em> suite's meter and parse the lcov, never a stdout table. The consequence worth saying plainly: <strong>the meter and the census are now the same measurement of the same tree</strong> (${BASIS}), so the three daggers rev D printed — members whose census had overtaken their metering — are retired rather than explained.</p>

**prose paragraph** (`sheet7a.mjs`):

> <p><strong>What re-metering moved, and the dagger mechanism's own bill.</strong> Sixteen members metered at rev E instead of thirteen — ${T.metered} now, №32 <code>@tools/embed-heights</code> having joined under its own <code>node:test</code> meter. Three were new light at rev E: №31 <code>eslint-plugin-lit-ui-router</code> is metered for the first time and comes in lit wall to wall (${g(31).r[10]}/${g(31).r[6]} files, ${pctS(g(31).r[12])}, line ${pctS(g(31).r[13])}); №29 <code>@tools/warn-lanes</code>, drawn at rev D as an outline of light on the guess that no lcov left it, in fact meters clean at ${pctS(g(29).r[12])} of its source; and №20 <code>@tools/oxc-emit</code>, drawn dark, has grown a suite and lights ${pctS(g(20).r[12])}. The daggered pair moves the most, and in the direction that indicts the dagger rather than the members: rev D drew <code>build_and_test</code> at 41.1% reach and <code>shared</code> at 82.4%, both computed by dividing an August lit figure by an end-of-August census — measured properly at one ref they are ${pctS(g(15).r[12])} and ${pctS(g(16).r[12])}. <em>The dagger systematically understated the members it marked</em>, which is why retiring it matters more than relabelling it. Nothing brightened everywhere: №12 <code>@tools/release</code> reaches further than it did (54.1% → ${pctS(g(12).r[12])}) and burns dimmer inside that reach (line 98.4% → ${pctS(g(12).r[13])}, function 96.8% → ${pctS(g(12).r[15])}), which is what a growing instrument with a lagging suite looks like from the air.</p>

**Record notes**

- 2026-09-11, no rev clause: re-metered at origin/main @ 65e2843, and `census-shadow.mjs`'s e2e guard now reads the `test:e2e:*` lanes — a non-empty set required, and `test:e2e:vanilla` on cypress — because the app carries no bare `test` script any more. The semantics are unchanged.
- 2026-09-29, no rev clause: the plan follows sheet 7's three moved lots — №12 `@tools/release` at 0,455, №16 `@tools/shared` at -16,550, №25 `@tools/lcov-rebase` at 180,395. №16's badge steps 9 units west (`BADGE_DX`) off the release footprint's south-west corner, and the №12 and №16 leaders re-aim at their own blocks. The frame audit reads 0 escapes, 0 hits and 0 text-on-text.
- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: re-metered at the ref — 25 members under their own suites, 11,937 of 19,307 metered src sloc lit, 12,400 of 12,575 lines at 98.6% (was 11,343 / 18,590 and 11,905 / 12,080); categories unmoved (m 25 · e 3 · u 1 · n 9 · z 1). `@tools/repo-checks` meters 557 of 1,029 sloc with two tests failing in the archive (#1088's `mise-pin.test.ts` runs `git ls-files`, which an archive cannot answer); `census-shadow.mjs` strips its log tmpdir to `<logs>` in the note so the plate diffs clean. The district lettering stands as four lines from y 304, measure and price split, each stopping short of member 3 (block to x 327, halo to y 334).
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: re-metered at the ref — 25 members under their own suites (was 24), 11,343 of 18,590 metered src sloc lit, 11,905 of 12,080 lines at 98.6%. #1038 left the eslint plugin's suite under `test:unit`, which `census-shadow.mjs` now reads when `test` is an umbrella (1,495 / 1,501 lit). №39 `@tools/crap` meters 82 of 118 sloc, its CLI in shadow; the NOTE table takes its row and throws on a missing one. №16's callout ranks its line coverage off the plate (the second-palest, behind oxc-emit's 86.5%), and the shopfront's examples line reads 35 of 3,647 sloc lit, where it typed "never lit".
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: re-metered at the ref — 24 members under their own suites, 10,591 of 17,778 metered src sloc lit, and 11,208 of 11,359 metered lines lit at 98.7%; branches 2,869 / 3,066, functions 961 / 981. ssr meters 382 of 382 lines over 9 of its 10 files. The published packages meter 99.5% of 5,377 lines; process-edge code never loaded reads 2,803 sloc across 52 files (was 2,764). The same two suites fail in the archive as at the tenth (`sample-app-shared`, `@tools/repo-checks`, which needs a git checkout). No lettering moved.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: re-metered at the ref — 38 rows, 24 members under their own suites, 10,382 of 17,529 metered src sloc lit, and 11,102 of 11,253 metered lines lit at 98.7%; branches 2,818 / 3,014, functions 943 / 963. The published packages meter 99.5% of 5,305 lines. `@tools/release`'s shadow list swaps `src/steps/pack-staged.ts` for `src/steps/pack-publish.ts`; process-edge code never loaded reads 2,764 sloc across 52 files (was 2,750 / 51). The annex range stays 1.5–4.3×. No lettering moved.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: re-metered at the ref — 38 rows, 24 members under their own suites, 10,363 of 17,496 metered src sloc lit (59.2%, from 59.1%), and 11,093 of 11,244 metered lines lit at 98.7%; branches 2,802 / 2,992, functions 939 / 959. `navigation-location-plugin` meters 2 of 2 files, 141 of 141 sloc, and all three meters still read 100 (lines 41, branches 27, functions 12, was 28 / 18 / 8). The published packages meter 99.5% of 5,293 lines over 98.4% of their source (was 5,280 / 98.3%). The annex range the packages lettering and the notes quote is derived, and it moved: 1.5–3.9× → 1.5–4.3×, the plugin's annex now the widest. No lettering moved.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: re-metered at the ref — 38 rows, 24 members under their own suites, 10,327 of 17,460 metered src sloc lit (59.1%, from 57.0%), and 11,080 of 11,231 metered lines lit at 98.7%. `lit-ui-router-ssr` meters 8 of its 9 files at 98.6% (branches 91.1%), from 1 of 2 at 96%; `lit-ui-router` 96.5 → 96.8, `@tools/happy-dom` 0 → 42.9, `@tools/release` 59.8 → 61.5, `@tools/repo-checks` 50.6 → 52.1. The happy-dom figure broke a sentence nothing asserted: the seventh cabinet's hand claim that №26 “owns a lit lamp and still stands dark — its canary lights happy-dom upstream, never its own source” went FALSE at this ref, the tool having gained `src/inner-html.ts` (`setInnerHTMLDetached`, the happy-dom innerHTML workaround) and its conformance canary now importing it — so №26 meters 1 of 2 files, 6 of 14 sloc lit (42.9% extent, lines 100%), while `append.ts` stays in shadow, lit only from `lit-ui-router`'s lamp as borrowed light. Four sites are re-written from the row: the aria label, schedule note 26 (“canary lights inner-html.ts, not append.ts”), №26's callout, which derives its `lit of src sloc` now, and the yard-habit notes paragraph. repo-checks' new `runner-label.test.ts` shells git and fails “not a git repository” inside the `git archive` tmpdir; the member still meters from the turbo run. The packages lettering is rewrapped to two lines clear of №3's halo, which reaches y 328 at this ref, and the “1.5–3.9×” annex range it and the notes quote is DERIVED from the plate's own spec-to-source ratios now — still 1.5–3.9×.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: re-metered at the ref — 38 rows, 24 members under their own suites (was 37 / 22), 9,427 of 16,543 metered src sloc lit (57.0%, from 8,731 of 15,793 = 55.3%), and 10,585 of 10,736 metered lines lit at 98.6%. The category split is m 24 · e 3 · u 1 · n 9 · z 1. `lit-ui-router-ssr` arrives metered on its first survey: one of its two source files under the lamp, 86 of 86 lines lit, extent 96. After the record, the frame audit — and this plate's hand table had no gate on it: `NOTE` was keyed 1–32, so members 33–38 printed `undefined` in the schedule, the new bridge among them. Six notes written. Four drawings moved with them: the packages caption 348 → 316, №12's callout down 24 and №5's down 16, and the brightness ladder measures itself now — a row too long for the box carries its numbers on a continuation line and the box's height is cut to whatever that leaves.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: re-metered at the ref — 37 rows, 22 members under their own suites (was 35 / 20), 8,731 of 15,793 metered src sloc lit (55.3%, from 7,140 of 13,972 = 51.1%). The category split is m 22 · e 3 · u 1 · n 10 · z 1, and `apps/sample-app-shared` keeps its `u` on the second, meter-less run.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: re-metered at the ref — 20 members under their own suites, 7,140 of 13,972 metered src sloc lit (51.1%, from 7,040 of 13,868 = 50.8%), lines 98.6%. `packages/lit-ui-router` reads 10/14f, 1,391 of 1,471 lit (94.6%). The category split holds at m 20 · e 3 · u 1 · n 10 · z 1, and `apps/sample-app-shared` keeps its `u` on the second, meter-less run.
- REV A — 2026-08-17 (2d96885) · REV B — 2026-08-17 (2de9b65 "flip plate 7A to rev B — the tests are the light") · REV C and REV D — 2026-08-31, dated (053cc87; 8033db3) · REV E — 2026-09-03 (2e72a39 "7A lamps reconstructed as census-shadow probe").
- Rev B flipped the optics only: "Every number below is rev A's, unchanged."
- Superseded figures: rev D printed a 13-member, 5,539-line universe metered 2026-08-17 at 3557c29 and explicitly not re-run — grand total 5,427 of 5,539 lines, 1,283 of 1,351 branches, 419 of 437 functions — with three daggered members whose census had overtaken their meter. Rev E meters 16 members at one ref [17 now] and retires the daggers, moving `build_and_test` from a dagger-computed 41.1% reach and `shared` from 82.4%, and `@tools/release` from 54.1% reach / 98.4% line / 96.8% function.
- The one figure the reconstruction did not reproduce, and the reason it is worth the space: `@tools/build_and_test` was recorded at 7 files / 756 sloc with 464 lit, and the probe reads 7 / 779 with 487 — the 23 lines are all in `error-summary.core.ts`, which the old counter reads at 233 and scc 4.0.0 at 256. The meter reproduced perfectly; the tape measure moved.
- Basis: `metered at ${SHADOW.ref} @ ${SHADOW.sha}` from `census-shadow.json`; footprints, annexes and districts from sheet 7's own `census-city.json` [both origin/main @ 185d414, 2026-09-07].

## Sheet 7B — THE WORKING CITY

- **file** `diagrams/generator/sheet7b.mjs` · **id** `working` · **current rev** H
- **basis** (source): `const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3½ — SYNTHESIS PLATE TO SHEET 7: the census city as a working plant · weathering (13) × test light (7A) × gates (7) × live build, one sprite per member · re-surveyed 2026-08-31

### REV B — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV B: hidden-line pass — opaque plant walls painted back to front, and the pipes now stop inside the annex gap

**prose paragraph** (`sheet7b.mjs`):

> <p><strong>The one alarm rev B drew has been answered — and the register keeps the record.</strong> Rev B's alert channel found exactly one red gate at HEAD: <code>//#lint:root</code>, oxlint failing with 16 errors, every one of them inside <code>diagrams/generator/</code>. The atlas had broken its own lint line drawing itself, and the triangle hung over the drafting office rather than over any plant. Commit <code>ffd4ef7</code> — "answer plate 7B's alarm: oxlint-clean the atlas generator" — fixed exactly that, and oxlint over <code>diagrams/generator</code> exits 0 at HEAD. So rev C strikes the triangle through instead of deleting it: an answered alarm is a record, and this is the third time the set has moved its own subject, after the lodash swap on sheet 8 and the lit dedupe on sheet 10.</p>

### REV C — 2026-08-31

**`sub` clause** (verbatim source):

> REV C 2026-08-31: 30 plants (three new machines), rust ladder RE-CUT on the fresh idle distribution — an R2 here is not rev B’s R2 — and rev B’s one alarm struck through: //#lint:root is answered · steam now IMPORTED from diagrams/data/census-steam.json (window ${WINDOW} · ${BASIS}) and the massing from sheet 7’s own plate, so the fifth package joins the city as №31

resolved →

> REV C 2026-08-31: 30 plants (three new machines), rust ladder RE-CUT on the fresh idle distribution — an R2 here is not rev B’s R2 — and rev B’s one alarm struck through: //#lint:root is answered · steam now IMPORTED from diagrams/data/census-steam.json (window 2026-06-09..2026-09-06 · counted at origin/main @ 185d414 (2026-09-07)) and the massing from sheet 7’s own plate, so the fifth package joins the city as №31

**prose paragraph** (`sheet7b.mjs`):

> <p><strong>Every channel is measured, and every threshold comes from a distribution.</strong> RUST is the weathering census (sheet 13): median days since last touch per member, five steps cut where the idle histogram actually cuts — re-cut at rev C, see below. The top step is still the empty gap nothing occupies (now 61–180 days), so R4 means genuinely sealed, and only the typedoc plugin wears it. STEAM is distinct commits touching the member in a trailing 90-day window, now read from the checked-in plate <code>diagrams/data/census-steam.json</code> — window ${WINDOW}, ${BASIS}. The band edges are rev C's and are kept: 0 puffs ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16. What no longer holds is the claim that those edges sit in empty air — 3, 9 and 16 are all occupied on this window, so the bands are stated here as editorial, not as gaps. Six plants steam at three puffs where rev B drew three: <code>lit-ui-router</code> (${g(1).steam}), <code>sample-app-shared</code> (${g(5).steam}), <code>docs</code> (${g(10).steam}), <code>@tools/release</code> (${g(12).steam}), <code>sample-app-lit-e2e</code> (${g(9).steam}) and, since rev F's window, <code>examples</code> (${g(11).steam}). LAMPS compress plate 7A's meter to one number, lit share = extent × line coverage — and at rev E that number is <em>read</em> from plate 7A's own snapshot, <code>diagrams/data/census-shadow.json</code>, metered at ${SHADOW.ref} @ ${SHADOW.sha}, rather than transcribed off a printed sheet: three lamps at ${'≥'}90, two at ${'≥'}50, one above zero, and the accent lamp is 7A's honest category for light no meter reads. PIPES are the <code>turbo run build</code> graph, read at rev D from <code>diagrams/data/census-plate.json</code>: ${BUILD.real} real tasks in ${BUILD.nodes} nodes, last run green on 2026-08-17 (all cache hits — a replay of green, stated as such), so every pipe on the sheet connects and the key says so rather than inventing a broken one.</p>

**prose paragraph** (`sheet7b.mjs`):

> <p><strong>REV C — the ladder was re-cut, so read the labels afresh.</strong> Two more weeks of clock pushed nine members' median idle into a 42–58-day band that rev B's ladder had no step for: its steps were cut at the 2026-08-17 histogram's gaps (R3 ≤41, R4 &gt;180 because nothing sat between 60 and 180). The plate's stated method is "thresholds cut at the distributions' own gaps", so honouring the method meant new numbers rather than forcing old ones: rev C cuts at 0 ≤14 · R1 ≤30 · R2 ≤37 · R3 ≤58 · R4 &gt;180, where 14 and 30 are histogram walls, 37 is the median idle and 58 is the top of the occupied band. <strong>A step label therefore does not mean the same thing across revs — rev B's R2 is not rev C's R2</strong>, and the ladder shape is preserved (№13 remains the sole cracked R4) rather than the ladder's numbers. Three members are drawn here for the first time: <code>@tools/lint-elements</code> and <code>@tools/warn-lanes</code> (born 2026-08-31, #639) and <code>@tools/eslint-ts-parser</code> (born 2026-08-16, #557) — the "28th member on no map" rev B recorded in its own total, now placed. All three are still the cleanest machines in the yard for rust — none above R1 — though <code>lint-elements</code> has since lit its first puff (${g(28).steam} commits). The steam total (${TOT_STEAM} member-touches from ${PLATE.windowCommits} window commits) double-counts commits that touch several members, as any per-member count must; the window commit count is given so the two are never confused.</p>

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: whole-cabinet refresh — the PIPES channel now reads the build graph off census-plate.json (${BUILD.real} real of ${BUILD.nodes} nodes) instead of a hand-pasted 22 of 113

resolved →

> REV D: whole-cabinet refresh — the PIPES channel now reads the build graph off census-plate.json (24 real of 114 nodes) instead of a hand-pasted 22 of 113

**prose paragraph** (`sheet7b.mjs`):

> <p><strong>The sprite decorates; the census still governs.</strong> Every block is sheet 7 rev D's, unchanged: footprint 1.6·√sloc, height 3 px per authored file, spec annexes beside their buildings, gate severity in the same colours with the same uniform hatch including the cap. The Working Plant sprite (concept 3 of the sprite studies) adds four state channels as overlays. The design guard from the study is enforced: rust is a dotted <em>speckle</em> at partial opacity on the flanks only — never the cap, never a 45° line hatch — so a red-gated pristine plant (uniform hatch, cap included) and a rusting never-gating plant cannot be confused, in either theme.</p>

**prose paragraph** (`sheet7b.mjs`):

> <p><strong>REV D — the last hand-pasted channel, and one contradiction closed.</strong> The whole plate cabinet was re-counted at ${PLATE.ref} @ ${PLATE.sha} in one pass, which caught the PIPES channel disagreeing with the atlas about its own subject: this plate said the <code>turbo run build</code> graph was 22 real tasks in 113 nodes while <code>census-plate.json</code>, drawn by sheets 3, 3A and 12, said ${BUILD.real} in ${BUILD.nodes}. PIPES now reads that plate, so the four sheets share one graph. STEAM moved with the window — ${PLATE.windowCommits} window commits against rev C's 358 — and the band edges hold: the same five plants steam at three puffs, and nothing crossed a band. RUST and LAMPS are unchanged and stay what they have always been on this plate: editorial constants keyed by badge, rust from sheet 13's weathering census and lamps from plate 7A's 2026-08-17 metering, neither re-run here.</p>

**prose paragraph** (`sheet7b.mjs`):

> <p><strong>The channels disagree, which is the point.</strong> A single wreck-to-splendor axis would have to average these stories away: <code>lit-ui-router</code> is the oldest masonry in the city <em>and</em> its hottest steam <em>and</em> fully lamped — old and running. The typedoc plugin is the only R4 rust on the sheet, cracked flanks and all, yet still emits a puff, because <code>index.ts</code> takes commits while <code>symbols/</code> sleeps its 234 days. <code>examples</code> steams at ${PUFFS(g(11).steam)} puffs with zero lamps and only R1 rust — worked on, untested, and no longer aging — and <code>docs</code> pairs the city's second-hottest steam with its dimmest metered light (${g(10).eff}% lit). The disagreement rev D drew sharpest here — <code>@tools/build_and_test</code> steaming while its lamp went <em>out</em> — turned out not to be one, and rev E says so: that reading divided a 2026-08-17 lit figure by a 2026-08-31 denominator, and re-metering finds the error summary lit like the rest of the cores, ${g(15).eff}% and two lamps. Work and light do move independently — <code>examples</code> and <code>docs</code> still prove it — but this particular plant was never dark. <code>@tools/happy-dom</code> keeps plate 7A's strangest fact: a plant with its own spec annex and no lamp lit, because the spec is a canary pointed upstream.</p>

### REV E — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV E: the LAMPS channel is imported too — plate 7A's light is a filed snapshot now (census-shadow.json, ${SHADOW.ref} @ ${SHADOW.sha}), so rust is the last editorial channel on this sheet and №31 finally reads a lamp

resolved →

> REV E: the LAMPS channel is imported too — plate 7A's light is a filed snapshot now (census-shadow.json, origin/main @ 185d414), so rust is the last editorial channel on this sheet and №31 finally reads a lamp

**prose paragraph** (`sheet7b.mjs`):

> <p><strong>REV E — the lamps stop being a transcription, and one of them was never out.</strong> Plate 7A's light was the last figure on this sheet that still travelled by clipboard: a column of lit-share percentages typed off a printed plate whose own metering dated from 2026-08-17, while every channel around it had moved to a filed snapshot. 7A's metering is a scripted probe now, so the lamps are <em>read</em> from its plate — <code>diagrams/data/census-shadow.json</code>, ${SHADOW.ref} @ ${SHADOW.sha} — and a plant this sheet draws that the light plate does not carry is a build error rather than an empty slot. Seven plants change: №31 <code>eslint-plugin-lit-ui-router</code> reads ${g(31).lamps} lamps at ${g(31).eff}% where rev D had no slots to read at all, №29 <code>@tools/warn-lanes</code> turns out to have a meter after all and lights ${g(29).lamps} at ${g(29).eff}% rather than the accent lamp rev D gave it, №20 <code>@tools/oxc-emit</code> lights its first (${g(20).eff}%), and №1, №12, №15 and №16 all move a little now that light and mass are counted at one ref. The largest of those is the one worth naming: <code>@tools/build_and_test</code> goes from one lamp to ${g(15).lamps} at ${g(15).eff}%, because rev D's "lamp that went out" was an artefact of dividing an August meter by an end-of-month census, not a suite that stopped covering. RUST is now the only editorial constant on this sheet.</p>

### REV F — 2026-09-04

**`sub` clause** (verbatim source):

> REV F 2026-09-04: cabinet refresh after the 1.11.2 + mobx 1.0.0 releases — №32 @tools/embed-heights joins the plant at rust 0, its lamp metered by its own node:test suite

### REV H — 2026-09-13

**REV clause** (verbatim source comment, `sheet7b.mjs` — the `sub` has carried no REV clause since the present-state copy pass):

> REV H: the rust ladder DERIVES — five steps re-cut from the weather plate's own idle distribution every cabinet, and the hand map is gone.

**prose paragraph** (`sheet7b.mjs`):

> RUST is sheet 13's weathering census, read from <code>www/atlas.lit-ui-router.dev/data/census-weather.json</code> at ${WEATHER.ref} @ ${WEATHER.sha}: the member's median idle days — the very number sheet 13's schedule prints as "idle Nd" — stepped by a ladder this build <em>cuts for itself</em>. The rule is the plate's stated method, mechanised: sort the distinct readings, measure the joints between them, and cut at the widest. The top step is reserved for a true outlier and opens only when the topmost joint is also the widest in the distribution; otherwise R4 is pinned above the highest reading and stands EMPTY.

resolved →

> RUST is sheet 13's weathering census, read from census-weather.json at origin/main @ 9896b3c1: the member's median idle days — the very number sheet 13's schedule prints as "idle Nd" — stepped by a ladder this build cuts for itself. … At this cabinet it stays shut: the topmost joint, 56d to 65d, is not the widest joint in the distribution, so R4 sits above the highest idle on the plate and nothing occupies it. The ladder cuts 0 ≤13d · R1 ≤35 · R2 ≤46 · R3 ≤65 · R4 >65, the deepest rust in the city is R3 (sample-app-lit-mobx and @tools/happy-dom), 25 of the 36 dated plants stand clean at 0, and the cracked flanks the key draws stand unworn.

### REV G — 2026-09-06

**`sub` clause** (verbatim source):

> REV G 2026-09-06: the telemetry box re-cut — the rust ladder had outgrown the wall it was drawn to and ran off the plate, so the reading takes a continuation line and the box is sized to the widest line that remains and hung on the plate’s right margin, clear of the packages lettering

**Record notes**

- 2026-09-13, REV H: the rust channel stops being an editorial hand map. The `RUST` Map keyed by badge is deleted; `rustOf` takes a member DIRECTORY and reads `medIdle` out of `census-weather.json` — the same field sheet 13's schedule prints as "idle Nd", so a member's step on 7B is now the ladder applied to 13's own number and the two sheets cannot disagree. The ladder itself is cut at build time, by a rule stated in the source, in the telemetry box, in the key and in the notes: take the DISTINCT readings sorted; the differences between neighbours are the distribution's joints; R4 opens only if the TOPMOST joint is also the WIDEST joint, in which case it is everything above the second-highest reading, and otherwise it is pinned above the highest reading and stands empty; the three cuts below are the three widest remaining joints, each cut at the joint's LOWER lip (a step reads "≤ lip"), ties to the lower lip. Deterministic: the same distribution gives the same cuts. At this cabinet the topmost joint is 56→65 against a widest of 13→28, so R4 stays shut and the ladder cuts **0 ≤13d · R1 ≤35 · R2 ≤46 · R3 ≤65 · R4 >65 (reserved, unoccupied)** — 25 / 6 / 3 / 2 / 0 plants across the steps, one member (`@tools/wintercg-globals`, no dated source) carrying no step at all. Nineteen members moved off the hand map, most of them DOWN: №1 `lit-ui-router` 3 → 0 (idle 2d — the hand map was reading its AGE, not its idleness), №2 `ui-router-server` 3 → 2, №5, №6, №8, №12 and №24 all 3 → 0 or 1, and №13 the typedoc plugin 3 → 2. The deepest rust in the city is now R3 on №7 `sample-app-lit-mobx` (65d) and №26 `@tools/happy-dom` (56d). Every rust claim on the plate derives from the computed steps: the aria label, the caption, both prose paragraphs, the four district callouts, the flagship and typedoc callouts, the key's rust and cracks rows, the schedule header (which prints the ladder) and the schedule total (which prints the step counts and the idle basis). The telemetry box grew 148 → 182 px to carry the third rust line and the two lines saying the steps are re-cut every cabinet.
- 2026-09-11, no rev clause: re-drawn at origin/main @ 65e2843 over sheet 7's new `PLACED`; the `RUST` map gains rows 33, 34 and 35 at step 0, all three born 2026-09-07/08.
- 2026-09-29, no rev clause: sheet 7's lot moves arrive through the imported `PLACED` — №12 `@tools/release` at 0,455, №16 `@tools/shared` at -16,550, №25 `@tools/lcov-rebase` at 180,395 — so №14, №30 and №23 stand clear of the release plant and №25 clear of `@tools/repo-checks`' roof and badge. №12's badge lift drops 26 → 20, off the flagship callout's last line. The frame audit reads no hits above 1 px; the two sub-pixel pieces are the refresh's, unchanged.
- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: steam reads 643 window commits, 2026-07-06 to 2026-10-04, 430 member-touches (was 619 / 421); the ladder re-cut to 0 ≤16d · R1 ≤35 · R2 ≤57 · R3 ≤68 · R4 >68, rust 9/21/5/2/1 (was 5/25/5/2/1), the flagship at rust 0. Nine plants steam at three puffs (was seven). The `packages/` lettering moves 772 → 786 (its third line met the flagship's roof), and the typedoc caption 440 → 356, west of the plant row whose bases reach y 646, where it had stood 2.75 deep since before the refresh.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: steam reads 619 window commits, 2026-07-05 to 2026-10-03, 421 member-touches; the rust ladder re-cut to 0 ≤6d · R1 ≤34 · R2 ≤56 · R3 ≤67 · R4 >67 and R4 opens, `sample-app-lit-mobx` wearing the cracked flanks — the notes say so where they typed "stand unworn". Seven plants steam at three puffs. The shopfront callout and the notes' docs sentence typed "top steam band", "second-hottest steam" and "dimmest metered light" for docs (2 puffs, 10% lit, second-dimmest behind examples at 1%) and "0 lamps" for examples; both now read lamps, puffs and the dimness rank off the plates.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: steam reads 597 window commits, 2026-07-01 to 2026-09-28 (was 580), 400 member-touches (was 390); the rust ladder re-cut itself to 0 ≤10d · R1 ≤29 · R2 ≤51 · R3 ≤62 · R4 >62, and five plants stand clean (was one). `@tools/workers-builds` reaches 16 commits, so the derived three-puff sentence lists six plants. The frame audit reads no hits above 1 px; the lint plugin's piece is 0.89 px and the typedoc-plugin callout 0.73 px, as before.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: steam reads 580 window commits, 2026-06-30 to 2026-09-28 (was 552), 390 member-touches (was 369), and the rust ladder re-cut itself: 0 ≤1d · R1 ≤29 · R2 ≤51 · R3 ≤62 · R4 >62 (was ≤7 / 26 / 48 / 59); only one plant stands clean at 0 (was 3). Two typed pieces went false or had been false: the notes named “Six plants” at three puffs by hand, including `docs` at 10 commits — two puffs, and two puffs at the ninth refresh too — and the caption read “1 plants stand clean, `sample-app-lit-mobx` carry the deepest rust”. The three-puff sentence now lists the top band off the plate, busiest first — “Five plants steam at three puffs: `lit-ui-router` (56), `sample-app-shared` (34), `@tools/release` (31), `sample-app-lit-e2e` (25) and `examples` (22)” — and the counts pick their verbs. The frame audit reads no hits above 1 px; the lint plugin's piece is 0.89 px and the typedoc-plugin callout touches a grown block by 0.73 px.
- 2026-09-28, later, no rev clause: the plate's aria-label names the rustiest plants in plain text. The caption borrowed the notes' `codes()` and so carried literal `<code>` tags inside the attribute, where a screen reader spells the angle brackets; the label now joins the same list with `names()`, the notes keep their markup.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the synthesis re-pinned at the new ref — steam reads 552 window commits, 2026-06-28 to 2026-09-25 (was 546), 369 member-touches (was 365), and the rust ladder re-cut itself off the idle distribution: 0 ≤7d · R1 ≤26 · R2 ≤48 · R3 ≤59 · R4 >59 (was ≤4 / 23 / 45 / 56). `navigation-location-plugin` went from rust R2 to clean — median idle 45 → 3 days — with 11 commits in the window (was 9), still two puffs, so the city reads 3 plants clean and rust 3 / 25 / 6 / 2 / 1 across 0–R4 (was 2 / 25 / 7 / 2 / 1). `sample-app-lit-mobx` still carries the deepest rust, R4. No `RUST` row was taken. The frame audit's 0.6 px lettering piece is unchanged.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the synthesis re-pinned on the one city universe at the new ref — steam reads 38 members over 546 window commits, 2026-06-25 to 2026-09-22 (was 500), and the lamps follow 7A's new extents. No `RUST` row was taken, no member being born. №26 `@tools/happy-dom` now carries one lamp, drawn correctly off the plate, while the hand caption beside it still said “0 lamps” — the drawing and its lettering disagreed on one sheet. The happy-dom callout derives its effective percentage and sloc from the row now, and the “channels disagree” notes paragraph is re-written to match. The frame audit's one sub-pixel reading sits here: a lettering piece 0.6 px into a mass, new this refresh, inside the 1 px tolerance and left.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the synthesis re-pinned on the one city universe at the new ref — steam reads 38 members over 500 window commits (was 37 / 488), 349 member-touches, and the lamps follow 7A's new extents. `RUST` took one row at step 0 for №38, and the derived ladder re-cut itself on the aged distribution: 0 ≤15d · R1 ≤37 · R2 ≤48 · R3 ≤67 · R4 >67, reserved and unoccupied, where the sixth refresh cut 13 / 35 / 46 / 65. 26 / 7 / 2 / 2 / 0 plants stand across the steps, 26 of the 37 dated plants clean at 0, the deepest rust in the city is still R3, and the cracked flanks the key draws stand unworn a second cabinet running — which is the plate's own point about a step label being good only for the plate it is printed on. After the record, the frame audit: the packages caption 110 → 74, having stood on the flagship's top face; the typedoc callout 624 → 652, having run through building 34; the schedule rect down 17 with its TOTAL split to two lines, and the viewBox 17 taller to hold them.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the synthesis re-pinned on the one city universe at the new ref — steam reads 37 members over 488 window commits (was 35 / 456) and the lamps follow 7A's new extents. `RUST` took two rows at step 0 for the effect pair, and one step DOWN: №13, the typedoc plugin, leaves R4 for R3. That channel is editorial but it is keyed to sheet 13's ladder, and the ladder gives R3 — the plugin is two files at a median idle of 43 days, inside the ≤58 cut, its `symbols/` wing having left the tree. So no plant on this plate wears R4 at this ref: the cracked flanks the key draws stand unworn, and the callout at 440,624 and both prose claims that named the plugin “the only R4” are re-texted and now read `census-weather.json` for the plugin's own file count and idle days.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the synthesis re-pinned on the one city universe at the new ref — steam reads 35 members / 307 commits (was 299) and the lamps follow 7A's new extents. `RUST` is declared editorial and took no step; no member was born since 65e2843, so it took no row either.
- REV A — 2026-08-17 (8160cf3 "the first sprite plate, the census running") · REV B — 2026-08-31 (053cc87) · REV C — 2026-08-31, dated (8033db3; steam import 5eaabba 2026-09-02) · REV D — 2026-09-03 (96f89fe) · REV E — 2026-09-03 (2e72a39) · REV F — 2026-09-04 (4332b21) · REV G — 2026-09-06 (2795066 "the plates draw in DIN").
- The rust ladder is the one channel whose labels do not mean the same thing across revs — and since rev H the plate says so itself. Rev B cut it R3 ≤41 · R4 >180, with an R2 of 30–34 days; rev C re-cut it by hand on the 2026-08-31 distribution at 0 ≤14 · R1 ≤30 · R2 ≤37 · R3 ≤58 · R4 >180, the top step being the empty 61–180 gap nothing occupies; rev H stopped cutting it by hand at all, and at this ref the derived cuts are 0 ≤13 · R1 ≤35 · R2 ≤46 · R3 ≤65 · R4 >65 (reserved, unoccupied). The steam bands are rev C's and are kept: 0 puffs ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16 — stated as editorial, because 3, 9 and 16 are all occupied now.
- Superseded figures: rev B's one alarm was `//#lint:root`, oxlint failing with 16 errors, every one inside `diagrams/generator/` — the atlas breaking its own lint line drawing itself — answered by ffd4ef7 and drawn struck through since rev C. Rev D retired a hand-pasted PIPES figure of 22 real tasks in 113 nodes (the file's own head comment said 22 of 103) for the plate's 24 of 114, and rev C's window held 358 commits. Rev E replaced the lamps' transcription of the 2026-08-17 metering, moving seven plants. Rev G sized the telemetry box 388 × 148 at x=1152, y=96.
- Basis: STEAM from `census-steam.json` with `WINDOW`; massing and gate tiers from `census-city.json` via sheet 7's `PLACED`; lamps from `census-shadow.json`; pipes from `census-plate.json`; RUST from `census-weather.json`'s `medIdle`, stepped by a ladder the build cuts from that distribution — since rev H no channel on this sheet is editorial.

## Sheet 8 — THE DELIVERED CITY

- **file** `diagrams/generator/sheet8.mjs` · **id** `delivered` · **current rev** D
- **basis** (source): `const BASIS = `measured at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)}), closure of ${PLATE.app}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 1½ — what npm actually installs for one consumer · sample-app-lit-vanilla

### REV A — undated in the copy

**prose paragraph** (`sheet8.mjs`):

> <p><strong>The drawing changed the city — twice.</strong> Rev A drew lodash 4.18.1 as the tallest building on the skyline — 45,205 lines, 1,048 files, delivered for four imports (<code>isEqual</code>, <code>cloneDeep</code>, <code>get</code>, <code>set</code>). That finding became PR #604: the swap to <code>lodash-es</code> halved the building to ${fmt(pkg('lodash-es').l)} lines and ${pkg('lodash-es').f} files, dropping it to fourth place behind dompurify, hono, and @uirouter/core. The bundler always tree-shook the wire cost — sheet 9 charts that collapse, 25 KB → 4 KB — but the delivered city is what installs, audits, and updates, and it is 23,000 lines lighter.</p>

### REV B — undated in the copy

**plate lettering** (`sheet8.mjs`):

> ${txt(1120, 48, 'rev B drew the lit stack twice (2.8.0 · 3.3.3);', 'lbla', 'end')}

### REV C — undated in the copy; first in git 2026-08-17

**`sub` clause** (verbatim source):

> REV C: recounted after the lit de-duplication · 2026-08-17

**prose paragraph** (`sheet8.mjs`):

> <p><strong>Rev C: the lit twins are gone.</strong> Rev B found the demo chrome shipping a second, complete lit — <code>lit-dialog</code> and the api-viewer panels hard-depend on lit ^2, so lit, lit-html, lit-element, and @lit/reactive-element were each delivered twice, twin pairs on the skyline. That finding became PR #618: scoped pnpm overrides (<code>@api-viewer/docs&gt;lit</code>, <code>@api-viewer/common&gt;lit</code>, <code>lit-dialog&gt;lit</code> → ^3.3.3) retire the 2.8.0-era tree. Four buildings vanished — lit 2.8.0, lit-html 2.8.0, lit-element 3.3.3, @lit/reactive-element 1.6.3: 287 files and 14,114 lines of code, plus 7,781 d.ts lines — and the city shrank from 36 delivered packages to 32, 190,122 lines to 176,022. The same PR made the api-docs panel lazy-load, which is why <code>sample-app-shared</code>'s dist grew 14 lines (3,776 → 3,790); every other surviving building measures exactly what it did in rev B. And <code>hono</code> (30,489 lines) still stands here because <code>ui-router-server</code> names it a peer: a server framework delivered into a client demo by peer auto-install.</p>

**prose paragraph** (`sheet8.mjs`):

> <p><strong>Numbers by import, not by paste.</strong> Every count on the drawing and in this note is now read from <code>diagrams/data/census-nm.json</code>, the snapshot <code>census-nm.mjs</code> writes after installing and building the ref itself; this file holds the drawing order, the hand-placed districts and the prose only, and a package it draws that the plate does not carry — or a package the plate carries that no district draws — is a build error rather than a stale constant. The same ${DELIVERED} buildings stand: the set has not changed since the hand count, only the counts. <code>lit-ui-router</code>'s own delivered shape moved most — ${fmt(pkg('lit-ui-router').l)} lines over ${pkg('lit-ui-router').f} files against the 798 over 12 pasted here in rev C, several releases of dist ago (the plate reads ${pkg('lit-ui-router').label}) — and the rest is drift in the registry: <code>hono</code> ${pkg('hono').label} delivers ${fmt(pkg('hono').l)} where 4.13.1 delivered 30,489, <code>sample-app-shared</code>'s dist is ${fmt(pkg('sample-app-shared').l)} where it was 3,790, and <code>@oxc-project/runtime</code> advanced three minors to ${pkg('@oxc-project/runtime').label} without changing a single line it delivers. The city totals ${fmt(TOT_L)} lines against rev C's hand-counted 176,022.</p>`,

### REV D — 2026-08-31

**`sub` clause** (verbatim source):

> REV D 2026-08-31: hidden-line pass — opaque faces, masses painted back to front, no rear wall through a front one · every number now imported from diagrams/data/census-nm.json — ${BASIS}

resolved →

> REV D 2026-08-31: hidden-line pass — opaque faces, masses painted back to front, no rear wall through a front one · every number now imported from diagrams/data/census-nm.json — measured at origin/main @ 185d414 (2026-09-07), closure of apps/sample-app-lit-vanilla

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: 32 delivered packages carrying 173,820 lines of code, with 41,155 d.ts lines beside them (was 173,596 / 41,079), still 269× the app's own 646; `lit-ui-router` delivers 3,152 lines over 44 files, 55× smaller than the city (was 2,928 / 42 / 59×).
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: 32 delivered packages carrying 173,596 lines of code, with 41,079 d.ts lines beside them (was 179,513 / 41,639), 269× the app's own 646 (was 278×); `@oxc-project/runtime` 0.152.0 and hono 4.13.10 re-letter.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: 32 delivered packages carrying 179,513 lines of code, with 41,639 d.ts lines beside them (was 179,302 / 41,652), still 278× the app's own 646. The one mover is `dompurify` 3.4.13 → 3.4.16 (38,755 lines).
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: 32 delivered packages carrying 179,302 lines of code, with 41,652 d.ts lines beside them (was 179,288 / 41,637), still 278× the app's own 646. `lit-ui-router` re-letters 1.16.0 (ws) — 42f 2,928 · dts 2,963 (was 1.16.0-rc.1, 2,924 / 2,948), the plugin 1.0.1.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: 32 delivered packages carrying 179,288 lines of code, with 41,637 d.ts lines beside them (was 179,260 / 41,590) — 278× the app's own 646 lines (was 277×). The plugin's building re-letters `ui-router-navigation-location-plugin 1.0.0 (ws) — 2f 84 · dts 155` (was 0.3.2, 1f 58 · dts 108).
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: 32 delivered packages carrying 179,260 lines of code, with 41,590 d.ts lines beside them (was 178,981 / 41,292).
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: 32 delivered packages carrying 178,981 lines over 2,056 files (was 178,793 over 2,051), with 41,292 d.ts lines beside them. The plate's one declared hand count, the consumer's own source, is unmoved at 11 files / 646 lines, so the verdict holds at 277× and the cover's `SHEET8_TIMES` with it.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: 32 delivered packages carrying 178,793 lines over 2,051 files (was 177,514 over 2,040). The plate's one declared hand count moved with them: the consumer's own source, re-counted at this ref by `census-nm.mjs`'s own ruler, is 11 files / 646 lines against the 592 the sheet had carried, so the verdict falls 300× → 277× and the cover's `SHEET8_TIMES` follows it there.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: 32 delivered packages carrying 177,514 lines (was 177,392). The consumer's own 592 lines are the plate's one declared hand count and did not move, so the verdict holds at 300× — the figure the cover's gallery prose now imports as `SHEET8_TIMES` instead of its hand-written 297×.
- REV A — 2026-08-16 (652def4) · REV B — 2026-08-16 (c517fbc "remeasure sheets 8-9 to rev b after the lodash-es swap") · REV C — 2026-08-17 (51e0bd4), dated · REV D — 2026-08-31 (053cc87; the "every number imported" half landed af7af45 2026-09-02).
- Superseded figures: rev A drew lodash 4.18.1 at 45,205 lines over 1,048 files, delivered for four imports, which became #604's `lodash-es` swap [22,193 over 644 now]; rev B drew the lit stack twice, which became #618 — lit 2.8.0, lit-html 2.8.0, lit-element 3.3.3 and @lit/reactive-element 1.6.3 gone, 287 files and 14,114 lines plus 7,781 d.ts lines, the city 36 delivered packages → 32 and 190,122 → 176,022 lines, and `sample-app-shared`'s dist 3,776 → 3,790 as the api-docs panel went lazy; rev C's hand-pasted `lit-ui-router` at 798 lines over 12 files and `hono` 4.13.1 at 30,489. The city totals 177,091 lines over 32 packages now.
- Note the vertical scale: drawn at the workspace's own scale even the halved `lodash-es` would stand 653 px tall — 1 px ≈ 250 lines here, against sheet 7's ≈ 34. The compression *is* the finding.
- Basis: `measured at ${PLATE.ref} @ ${PLATE.sha}, closure of ${PLATE.app}` from `census-nm.json` [origin/main @ 185d414, 2026-09-07, closure of apps/sample-app-lit-vanilla].

## Sheet 9 — THE SHIPPED CITY

- **file** `diagrams/generator/sheet9.mjs` · **id** `shipped` · **current rev** G
- **basis** (source): `const BASIS = `measured at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)}) · ${PLATE.wasGeneratedBy}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2¾ — what the browser downloads · lit-ui-router.dev, one deploy · 575 files, 3.1 MB on the wire

### REV A — undated in the copy

**prose paragraph** (`sheet9.mjs`):

> <p><strong>The ghost district was the instrument, twice.</strong> Rev A reported twelve orphan files, 138 KB of dead weight in every deploy — but that survey read an accumulated local <code>dist/</code>, where parallel app builds pile up stale hashes. Rev C rebuilt from a clean checkout and reported exactly one unreachable file, a 1.7 KB custom-elements manifest, and the drawing made a rule of it: a clean tree ships exactly one. That rule was also an artifact. The scripted probe's reachability walk follows the backtick-quoted asset URLs the app chunks build by hand, and the manifest is reachable after all: the orphan list on this plate is <em>empty</em>. The hatched ghost block is struck from the drawing, and the caution survives it in stronger form — twice now, the orphans were a property of the instrument, not of the deploy.</p>

### REV B — undated in the copy

**prose paragraph** (`sheet9.mjs`):

> <p><strong>The panel that waited its turn.</strong> The api-viewer docs panel — marked, dompurify, three <code>@api-viewer</code> packages — only renders behind a feature flag, but rev B's apps carried it in the eager main chunk anyway. It now arrives as a lazy <code>api-docs</code> chunk, and every app's main chunk drops 34 → 7 KB gz: the hash app's whole district is ${HASH.files} files and ${KB(HASH.gz)}. Same bytes on the CDN, different bytes on the critical path.</p>

### REV C — undated in the copy

**prose paragraph** (`sheet9.mjs`):

> <p><strong>The product is a guest in its own city.</strong> The three routed sample apps — the thing the site exists to demonstrate — total ${KB(APPS)} gzipped, ${APP_PCT}% of the deploy. The rise from rev C's 173 KB / 4.5% is mostly bookkeeping: that survey counted the visualizer chunk with the page chunks, and on the scripted census, first claim seats <code>visualizer.esm</code> (and the custom-elements manifest) in <code>app: vanilla</code>, which is why that district reads ${VANILLA.files} files and ${KB(VANILLA.gz)}. The bytes on the CDN did not move. What did move at rev C stands: PR #618 scoped an override so the <code>@api-viewer</code>/<code>lit-dialog</code> stack shares one lit 3.3.3, and identical lit chunks now hash identically <em>across</em> apps, so part of mobx's download is chunks vanilla already shipped.</p>

**prose paragraph** (`sheet9.mjs`):

> <p><strong>One example outweighs the router.</strong> The examples district (${EXAMPLES.files} files, ${KB(EXAMPLES.gz)}, and two examples wider than rev C — the design-system-links tutorial and the lint-eslint example) is led by the hellogalaxy demo's <code>model-viewer</code> chunk at ${KB(EXAMPLES.top.gz)} on its own — heavier than all three sample apps combined, delivered so one tutorial page can spin a galaxy.</p>`,

### REV D — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV D: hidden-line pass — opaque tenant walls painted back to front

### REV E — 2026-09-03

**`sub` clause** (verbatim source):

> REV E 2026-09-03: every count now imported from diagrams/data/census-shipped.json — the ghost district is struck from the drawing

### REV F — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV F: whole-cabinet refresh — the HTML pages overtook Inter, measured at origin/main @ b2338d0 (2026-09-04)

**prose paragraph** (`sheet9.mjs`):

> <p><strong>REV F — the whole cabinet, one ref, and a district changed places.</strong> Every plate in <code>diagrams/data/</code> was re-counted at origin/main @ b2338d0 in one pass, and this deploy moved where the shopfront grew: 593 files against rev E's 586, the same 12 districts, still no orphans, 4.0 MB on the wire — 126,991 gzipped bytes more than rev E, on a four-megabyte deploy. The examples district took most of it (four more files, the lint-eslint example landing); the three documentation districts — html pages, page chunks and the VitePress framework — each gained a percent or two as the guides grew, and that was enough to settle the closest race on the sheet. The HTML pages have overtaken Inter: 883,505 gz against 866,700, a 16,805-byte lead where rev E had the fonts ahead by 504. The reading stands as it did, only sharper — the two tallest things this documentation site ships are prose and typography, and the corpora still tower over both.</p>

### REV G — 2026-09-07

**`sub` clause** (verbatim source):

> REV G 2026-09-07: re-surveyed after #716 dropped the sample app's markov seed pipeline — the corpora district (15 files, 899 KB, the tallest tower since rev A) left the deploy with three static data files, so ${all.length} districts stand and the HTML pages are the skyline; the corpora's lot is drawn vacant — ${BASIS}

resolved →

> REV G 2026-09-07: re-surveyed after #716 dropped the sample app's markov seed pipeline — the corpora district (15 files, 899 KB, the tallest tower since rev A) left the deploy with three static data files, so 11 districts stand and the HTML pages are the skyline; the corpora's lot is drawn vacant — measured at origin/main @ 185d414 (2026-09-06) · diagrams/generator/census-shipped.mjs

**prose paragraph** (`sheet9.mjs`):

> <p><strong>The tallest building is the prose.</strong> For five revisions the skyline belonged to the demo corpora — novels, Beowulf, an RFC, pre-gzipped <code>.txt.gz</code> so compression couldn't help further. They are gone (see REV G), and the city's tallest district is now the site's ${PAGES.files} prerendered HTML pages at ${KB(PAGES.gz)}, with Inter's ${INTER.files} <code>woff2</code> faces ${PAGES_LEAD ? `${fmt(LETTER_GAP)} bytes behind` : `${fmt(LETTER_GAP)} bytes ahead`} at ${KB(INTER.gz)}. Code still doesn't crack the top two: on the wire, this documentation site is mostly prose and typography, and the first script district — the examples, led by one galaxy — stands third at ${KB(EXAMPLES.gz)}.</p>

**prose paragraph** (`sheet9.mjs`):

> <p><strong>REV G — the tallest tower left town.</strong> PR #716 dropped the sample app's markov seed pipeline, and with it the fifteen pre-gzipped corpora that had been this city's tallest district since rev A: 899 KB of Dickens, Beowulf, Flatland and an RFC, plus three of the static data files that fed them. Re-surveyed at ${PLATE.ref} @ ${PLATE.sha}, the deploy is ${fmt(PLATE.totals.files)} files against rev F's 593 and ${MB(PLATE.totals.gzBytes)} on the wire against 4.0 — ${fmt(4164505 - PLATE.totals.gzBytes)} gzipped bytes lighter, ${((1 - PLATE.totals.gzBytes / 4164505) * 100).toFixed(0)}% of the deploy, on a change that touched no page and no script. Nothing else moved: Inter is identical to the byte, the HTML pages gained ${fmt(PAGES.gz - 883505)}. The corpora's lot stays on the plan, drawn vacant beside the images, because a skyline that loses its landmark should show where it stood. The routed apps' share rises to ${APP_PCT}% without a byte of theirs changing — the same arithmetic that made rev C's 4.5% a bookkeeping number cuts the other way when the city shrinks around them.</p>

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: the wire re-counted at 890 files, 31,765,147 raw / 4,987,887 gz over the same 12 districts (was 31,731,144 / 4,980,372), 0 unclassified; the routed apps 319 KB.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: the wire re-counted at 890 files, 31,731,144 raw / 4,980,372 gz over the same 12 districts (was 884 / 31,356,476 / 4,952,920), 0 unclassified.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: the wire re-counted at 884 files, 31,356,476 raw / 4,952,920 gz (was 860 / 29,905,743 / 4,853,751): `html pages` 236 files at 1,781,804 gz and `page chunks` 454. The grown html-pages cap reached y 15.6 and put a 12.7 px lettering hit on the one-line SCALE label; the label is now two short lines east of the cap. “— a race close enough that a few new guides, or one more demo, decide it” had not been close for several refreshes (711,550 bytes behind here); it now reads “— the prose outweighs the runner-up 1.7 to 1”, and the build throws if the plate stops ranking `html pages` first.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the wire re-counted at 860 files, 29,905,743 raw / 4,853,751 gz (was 29,825,024 / 4,839,949), over the same 12 districts: `html pages` 228 files at 1,701,643 gz, `examples` 22 files at 1,070,254, `page chunks` 438 files; the four apps each gained a few hundred bytes with the 1.16.0 build. No lettering was hand-moved.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the wire re-counted at 860 files, 29,825,024 raw / 4,839,949 gz (was 857 files, 29,557,041 / 4,823,157), over the same 12 districts: `html pages` 228 files, 1,697,667 gz (was 227, 1,684,492), `page chunks` 438 files (was 436), and all four apps 316 KB (was 315). The district badges moved with their towers by fractions of a unit; no lettering was hand-moved and the audit reads clean.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the wire re-counted at 857 files, 29,557,041 raw / 4,823,157 gz (was 788 files, 25,846,553 / 4,542,847), over the same 12 districts. `html pages` stands 170.7 units, so `page chunks` [330,166] → [330,178]. The Inter caption stood on that tower's cap, which reaches y 38 at this ref, and is re-hung as four lines beside its east wall at x 975. №1 `inter fonts` stands nearly occluded behind the html-pages tower now; the occlusion is the drawing telling the truth about the two heights, and it is left.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the wire re-counted at 788 files, 25,846,553 raw / 4,542,847 gz (was 680 files, 19,875,213 / 4,097,046), over the same 12 districts — no district was born this time and `unclassified` stayed empty, the fourth app shell having been taught to the plate at the sixth refresh. The PLAN's one edit is a placement: `page chunks` [330,160] → [330,166], the district having grown to 390 files. The tallest district on the wire is `html pages`, 204 files / 1,461,126 gz. After the record, the frame audit: the group label “the documentation site” stood inside tower 1 and moves (866,200) → (985,318), and the Inter callout drops 96 → 60.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the wire re-counted at 680 files, 19,875,213 raw / 4,097,046 gz (was 582 files, 16,570,091 / 3,693,316), over 12 districts rather than 11. The twelfth is the fourth app shell: `census-shipped.mjs` had been sorting `app-effect.html` and its chunks into the loud `unclassified` catch-all, which prints rather than throws, so the district had to be taught by hand — `app: effect`, 6 files / 111,363 gz, placed at 660,295, with first claim now vanilla → mobx → effect → hash. “Three routed sample apps” is four everywhere on the plate. The honesty sweep took the skyline with it: the examples district (1,063,701 gz) has overtaken the Inter faces (868,670), so the ranking is read off the plate rather than typed — the lettering callout, the prose, the aria and the cover's own verdict all name positions the plate computes — and the model-viewer comparison is re-based to vanilla, mobx and hash (207,346 gz) because all four together (318,709) would have made it false.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the wire re-counted at 582 files, 16,570,091 raw / 3,693,316 gz (was 579 files, 16,353,574 / 3,670,964), over the same 11 districts.
- REV A — 2026-08-16 (b227928) · REV B — 2026-08-16 (c517fbc) · REV C — 2026-08-17 (987f909) · REV D — 2026-08-31 (053cc87) · REV E — 2026-09-03 (3cb58f3), dated · REV F — 2026-09-05 (999e663 "stale-claims pass at b2338d0"; the sheet states its measured ref as origin/main @ b2338d0, 2026-09-04) · REV G — 2026-09-07 (cf45bb0), dated.
- Superseded figures: rev A's twelve orphan files / 138 KB and rev C's single 1.7 KB manifest were both artefacts of the instrument, and the orphan list is empty now; rev B's eager main chunk fell 34 → 7 KB gz when the api-viewer panel went lazy; rev C read the routed apps at 173 KB / 4.5% pre-attribution [6.2% now]; rev E had 586 files in 12 districts with the fonts ahead by 504 bytes; rev F had 593 files and 4.0 MB, the HTML pages taking the lead at 883,505 gz against Inter's 866,700.
- Rev G: #716 took the fifteen pre-gzipped corpora out — 899 KB, the tallest district since rev A — leaving 575 files and 3.1 MB, 900,044 gzipped bytes lighter, 22% of the deploy, on a change that touched no page and no script. The lot stays on the plan, drawn vacant.
- Basis: `measured at ${PLATE.ref} @ ${PLATE.sha} · ${PLATE.wasGeneratedBy}` from `census-shipped.json` [origin/main @ 185d414, 2026-09-06; totals 575 files, 15,115,644 raw, 3,264,461 gz].

## Sheet 10 — THE BUNDLED CITY

- **file** `diagrams/generator/sheet10.mjs` · **id** `bundled` · **current rev** E
- **basis** (source): `const BASIS = `${PLATE.app} · counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2⅞ — inside the wire: what the bundler kept · apps/sample-app-lit-vanilla, one bundle

### REV A — undated in the copy

**prose paragraph** (`sheet10.mjs`):

> <p><strong>The déjà vu is gone.</strong> Rev A's one redundancy tree-shaking could not reach — a second, complete lit 2.8.0 riding in with the docs-viewer stack, 5.2 KB of wire déjà vu — was a version split, so it took a dependency edit, not a bundler: PR #618 scopes a pnpm override (<code>^3.3.3</code>, a floor, not a pin) to <code>@api-viewer/*</code> and <code>lit-dialog</code>, and the census now counts one lit: ${KB(G('lit').gz)} gz across ${G('lit').mods} modules where two majors cost 12.5 KB. The intentional <code>lit-2</code> compat alias in <code>packages/*</code> is untouched — it is a test lane, and it never shipped.</p>

### REV C — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV C: every byte now read from the census-bundle plate — ${BASIS}

resolved →

> REV C: every byte now read from the census-bundle plate — apps/sample-app-lit-vanilla · counted at origin/main @ 185d414 (2026-09-06)

**prose paragraph** (`sheet10.mjs`):

> <p><strong>REV C — the numbers by import.</strong> The sheet no longer carries a hand-pasted census: every footprint, height, schedule row and door price is read at build time from the checked-in plates, and a group the drawing places but the plate does not carry is a build error rather than a stale constant. Two things the constants had smoothed over show up immediately. The plate names <code>lit</code> and <code>@api-viewer</code> as groups, so the old display labels that baked in a version number and a package count are gone — the module count each group actually contributes (×${G('lit').mods} and ×${G('@api-viewer').mods}) is printed instead, because that is a measured fact and the label was not. And <code>sample-app-routes</code>, which the previous print folded into the app's own source as a parenthesis, is a group of its own: ${fmt(G('sample-app-routes').r)} bytes kept, ${fmt(G('sample-app-routes').gz)} on the wire, one module — the smallest building on the map, and the shared route table three apps import.</p>

### REV D — 2026-09-06

**`sub` clause** (verbatim source):

> REV D 2026-09-06: fills — every mass’s left-face tint and right-face hatch draw for the first time (a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); no mass moved

### REV E — 2026-09-06

**`sub` clause** (verbatim source):

> REV E 2026-09-06: the paper re-ruled — the five door frames tightened to the DIN line (144 → 116), the structure schedule opened to the plate’s full measure so its two columns get a real gutter instead of the left column running into the right, and every flush-right note now hangs on one margin at 1150

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: 123,271 gz in 17 chunks (was 122,792), 682,220 kept → 381,553 emitted; `lit-ui-router` 6.1 KB, 5.1% of the wire; the residual against sheet 9's vanilla district is 4,917 gz over one file.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: 122,792 gz in 17 chunks (was 122,732), 679,542 kept → 379,979 emitted; the residual against sheet 9's vanilla district is 4,614 gz over one file.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: 122,732 gz in 17 chunks (was 122,215), 680,902 kept → 379,815 emitted. `dompurify` 3.4.16 renders 61,689 bytes and now ranks above `marked` in the plate's order; both lots are keyed by group name and neither moved. The residual against sheet 9 reads 4,615 gz over one file.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: 122,215 gz in 17 chunks (was 122,101), 678,411 kept → 378,859 emitted. The flagship's group is 34,737 rendered bytes, 5,825 estimated gz (was 34,211 / 5,741), and now ranks above `lit` (34,560) in the plate's order; both lots are keyed by group name and neither moved. The `.` door reads 8,837 and the residual against sheet 9 4,612 gz over one file.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the vite build re-run inside the installed archive — 122,101 gz in 17 chunks (was 122,052), 677,950 kept → 378,532 emitted. `router plugins` grew a module with the plugin's new file: 5 modules, 19,926 rendered bytes, 3,970 estimated gz (was 4, 19,013, 3,828). `dompurify` (59,206 rendered) now ranks above `sample-app-shared` (59,192, was 59,473) in the plate's order; both lots are keyed by group name and neither moved. The flagship's group reads 5,741 estimated gz (was 5,742), the `.` door 8,719, and the residual against sheet 9 holds at 4,611 gz over one file.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the vite build re-run inside the installed archive — 122,052 gz in 17 chunks (was 121,650), the flagship's group 34,211 rendered bytes / 5,742 estimated gz over 14 modules (was 30,786 / 5,253 / 13). The footer's six priced doors re-read off `census-doors.json`: `.` 8,719 gz, `./pure` 8,678, `./register` 3,389, `./context` 718.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the vite build re-run inside the installed archive — 672,155 kept → 376,351 emitted → 121,650 gz in 17 chunks (was 671,739 / 375,344 / 121,239), the flagship's own chunk 30,786 rendered bytes. The footer's priced strip is SIX doors, `./context` joining the five, and the plate no longer trusts the hand list: a `lit-ui-router` door that `census-doors.json` carries and the strip does not price is a build error now.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the vite build re-run inside the installed archive — 671,739 kept → 375,344 emitted → 121,239 gz in 17 chunks (was 666,717 / 373,654 / 120,630). Every share on the plate, the chrome caption's multiple included, is read from the plate as it has been since the fifth refresh.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the vite build re-run inside the installed archive — 666,717 kept → 373,654 emitted → 120,630 gz in 17 chunks (was 665,308 / 372,660 / 120,477), core at 22.3% of the wire and the router at 4.2%. The plate's one hand-stated figure went with it: the chrome caption read "5× the router they document", true at 4.81× under 65e2843 and false at 4.47× here, so it is `Math.round(CHROME_GZ / G('lit-ui-router').gz)` now and draws 4×.
- REV A — 2026-08-16 (693e6d8) · REV B — 2026-08-17 (987f909 "remeasure sheets 9 and 10 after the lit dedupe merge"), with no clause of its own — it is the unnamed "before" of the lazy-chunk note · REV C — 2026-09-03 (91c6843) · REV D and REV E — 2026-09-06 (b1c0942 "design pass p1"), dated.
- Superseded figures: rev A shipped two lit majors at 12.5 KB gz, 5.2 KB of it déjà vu, retired by #618's scoped `^3.3.3` floor on `@api-viewer/*` and `lit-dialog` [one lit now, 8.8 KB over 19 modules]; rev C dropped the display labels that baked in a version number and a package count, and split `sample-app-routes` out of the app's own source; rev E recut the five door frames 144 → 116 and hung every flush-right note on 1150.
- The intentional `lit-2` compat alias in `packages/*` is untouched by any of it — it is a test lane, and it never shipped.
- Basis: `${PLATE.app} · counted at ${PLATE.ref} @ ${PLATE.sha}` from `census-bundle.json` [origin/main @ 185d414, 2026-09-06; 17 chunks, 663,008 kept → 371,713 emitted → 120,098 gz].

## Sheet 11 — THE ENTRY QUARTERS

- **file** `diagrams/generator/sheet11.mjs` · **id** `entries` · **current rev** F
- **basis** (source): `const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2⅞ — the same wire, cut by published package · every exported entry priced alone · 16 doors, 5 packages

### REV A — undated in the copy

**prose paragraph** (`sheet11.mjs`):

> <p><strong>The server is a storefront, not a tower.</strong> Eight doors: an index at ${fmt(SRV.gz)} gz — rev A caught it within 12 bytes of lit-ui-router's flagship, a coincidence #590 promptly broke and the summer has widened to ${fmt(SRV_GAP)} — redirect and matcher wings, and four framework adapters — hono, fetch, vite, connect — packed within ${ADAPTER_SPREAD} bytes of one another: thin skins over one core. <code>./simulate</code>, the test double, is ${SIM.gz} bytes. All eight of these doors reprobe byte-identical against rev B.</p>

### REV B — undated in the copy

**generator comment** (`sheet11.mjs`):

> // graduated after rev B, so it takes 16 and leaves rev B's numbering intact.

### REV C — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV C: every byte now read from diagrams/data/census-doors.json

**prose paragraph** (`sheet11.mjs`):

> <p><strong>Rev C — the numbers by import, and a fifth quarter.</strong> The sheet no longer carries a hand-pasted probe: it reads the plate, keyed by package and door, and throws on a miss. Reprobing at ${PLATE.ref} @ ${PLATE.sha} moves two things. The <em>city</em>: sixteen doors rather than fifteen, with the lint plugin taking a new one-door quarter in the lower middle — the navigation-location quarter slid down and right to give it air, so the three one-door quarters now read as a row along the bottom. The <em>client</em>: only <code>lit-ui-router</code> moved. Four of its doors — the flagship, <code>./pure</code>, <code>./register</code> and <code>./ui-view.register</code> — each grew about 5% as main advanced past rev B's ref, while the other eleven doors, <code>./ui-router.register</code> plus both runtime plugins plus all eight server doors, reprobe byte-identical. The registration premium held its shape through that growth: ${REG_COST} gz, against rev B's 85. Rev B's own findings stand — #590's two flagship jumps, and the door name corrected from <code>./url-matcher</code> to <code>./matcher</code>.</p>

### REV D — undated in the copy; first in git 2026-09-05

**`sub` clause** (verbatim source):

> REV D: whole-cabinet re-probe — 14 of ${DOOR_N} doors byte-identical, the lint plugin's up 1,917 → ${fmt(LINT.gz)} gz on #689's three new rules and the mobx door 650 → ${fmt(MOBX.gz)} gz at mobx 1.0.0 — ${BASIS}

resolved →

> REV D: whole-cabinet re-probe — 14 of 16 doors byte-identical, the lint plugin's up 1,917 → 3,510 gz on #689's three new rules and the mobx door 650 → 908 gz at mobx 1.0.0 — counted at origin/main @ 185d414 (2026-09-06)

**prose paragraph** (`sheet11.mjs`):

> <p><strong>Rev D — two doors moved, and one of them is the one no browser opens.</strong> The whole plate cabinet was re-probed at ${PLATE.ref} @ ${PLATE.sha} in one pass. Fourteen of the ${DOOR_N} doors come back byte-identical — every <code>lit-ui-router</code> door, the navigation-location plugin and all eight server doors price exactly as they did at rev C, so the registration premium, the umbrella economics and the adapter spread are unchanged figures, not re-rounded ones. The mover that matters is <code>eslint-plugin-lit-ui-router</code>, which #689 gave three more rules — <code>sref-assign-href</code>, <code>sref-active-aria-current</code> and <code>directive-position</code> — taking its one door from 4,559 / 1,917 to ${fmt(LINT.m)} / ${fmt(LINT.gz)} gz, three quarters heavier across two release candidates. That moves the comparison rev C drew with it: the plugin was about a third of the flagship's weight and is now ${LINT_SHARE}% of it. Its quarter is drawn to the same scale as the rest, so the sixteenth tower simply grew. The other mover is the mobx door, 650 → ${fmt(MOBX.gz)} gz at <code>lit-ui-router-mobx@1.0.0</code> — still a footnote against the flagship.</p>`,

### REV E — 2026-09-06

**`sub` clause** (verbatim source):

> REV E 2026-09-06: fills — every quarter’s left-face tint and right-face hatch draw for the first time (a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); no door moved

**Record notes**

- 2026-09-13, after the refresh, no rev clause: the frame audit. The `eslint-plugin-lit-ui-router|.` door block moved 330,285 → 320,258: the door grew 9.7 → 16.9 KB minified at the 1.14.1 ref and its old lot pushed the block's base 10.5 units out through the dashed quarter frame's south-east dashes. No other door moved and no price was re-probed.
- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: twenty-two doors in seven quarters, 182,451 minified / 64,574 gz (was 174,062 / 62,120); the flagship's `.` door 8,837 → 9,354 gz, effect 1,163 → 1,449, mobx 911 → 1,019, ssr's `./client` 2,711. npm serves ssr under `latest` at 0.2.0, the version the ref carries. The `.` door stands 234 px and its roof left the viewBox top by 9.7, so its lot moves [26, 46] → [26, 74]; the effect door moves [40, 365] → [46, 385], its badge having risen into the register note.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: twenty-two doors in seven quarters, 174,062 minified / 62,120 gz (was 169,798 / 60,661); ssr's `.` door 3,084 → 3,384 gz with #1070's signature, `./client` 2,695. npm serves ssr under `latest` at 0.1.1, the version the ref carries.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: twenty-two doors in seven quarters, 167,944 → 169,798 minified and 59,915 → 60,661 gz. ssr re-priced: `.` 2,273 → 3,084 gz with `settle()` (#1010), `./client` 2,231 → 2,307, `./register` 1,408 → 1,267. The rc guard threw as designed — ssr no longer leads with an `rc` — and the paragraph now reads `census-npm.json` and `census-files.json`: “npm serves it under `latest` at `0.1.0`, the version its `package.json` carries at this ref”, throwing if an `rc` leads ssr again or if the served and the ref's versions part. The footnote paragraph said the effect and ssr index doors “are not much dearer” than mobx and the plugin, false at 3,084; it now derives both comparisons — mobx and the plugin under “the 1,631-byte gap between `./register` and its two element doors”, effect and ssr “under half the flagship's own `.` door at 8,837” — and throws if either fails.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: twenty-two doors in SEVEN package quarters, 166,649 → 167,944 minified and 59,435 → 59,915 gz. The flagship's doors re-priced with #990 — `.` 8,719 → 8,837 gz, `./pure` 8,680, `./register` 3,508, the element doors 1,675 and 3,464 — and `.`/`./pure` now differ by 157 bytes (was 41); effect's door 1,163 (was 1,136), ssr's `./client` 2,231 (was 2,196). The ssr paragraph said “It ships its newest work under npm's `rc` tag, and so does `lit-ui-router`”, typed and false once 1.16.0 released. The sheet now reads `census-npm.json` for which quarters lead with an `rc`, throws if ssr stops being one of them, and prints “It ships its newest work under npm's `rc` tag, the one quarter here that does”.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: twenty-two doors in SEVEN package quarters, 166,259 → 166,649 minified and 59,307 → 59,435 gz across the set. Only the plugin's door re-priced: `ui-router-navigation-location-plugin` `.` 1,309 → 1,699 minified, 670 → 798 gz, its tower taller and its badge risen with it; the door-count guard held at 22 and no quarter was cut. The plugins paragraph reads the plugin at 798, still cheaper than the gap between `./register` and its two element doors. Every other door is byte-identical.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: twenty-two doors in SEVEN package quarters, 145,882 → 166,259 minified and 52,328 → 59,307 gz across the set. The door-count guard threw at 22 — `ORDER` had 20 rows — and seated ssr's two new doors: `./client` 5,341 / 2,196 gz at [632,262] and `./register` 3,109 / 1,408 at [652,300], the index moving [620,285] → [592,262] and repricing 1,431 → 2,273 gz. The quarter is lettered “three doors” beside the flagship's six and the server's nine. `lit-ui-router`'s `.` door is 8,206 → 8,719 gz and stands 218 px tall, so its badge left the viewBox from [30,15]: `.` sets back to [26,46] and `./pure` to [98,45]. The aria text, the companion callout (“the four companion index doors”) and the effect/ssr paragraph are rewritten present-state; `ui-router-server`'s doors are unchanged.
- 2026-09-14, REV F: twenty doors in SEVEN package quarters, 133,986 → 145,882 minified and 46,939 → 52,328 gz across the set. Two quarters were cut — `lit-ui-router-effect` and `lit-ui-router-ssr`, both published at this ref — and four doors priced for the first time: `lit-ui-router` `./context` 1,140/633 at [305,105], `ui-router-server` `./location` 614/329 at [690,195], `lit-ui-router-effect` `.` 2,307/1,135 at [40,365] and `lit-ui-router-ssr` `.` 2,745/1,431 at [620,285]. `ORDER` is 20 rows and throws against the plate's own door count, so a door priced nowhere stops the build; the altitude reads SEVEN PACKAGES where it read FIVE. After the record, the frame audit: the PROBE recipe had outgrown its one line and ran across the tallest door's cap, so it hangs stage by stage on the plate's right margin now, one line to a stage.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: sixteen doors re-priced, 107,301 → 133,986 minified and 40,921 → 46,939 gz across the set, on #827's attribute directives and #828's rules. The quarter count is unmoved: `lit-ui-router-effect` is private at this ref and opens no door, so the plate still prices the five published packages.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: sixteen doors re-priced and four moved, all of them lit-ui-router's — `.` 5,609 → 5,953, `./pure` 5,520 → 5,859, `./register` 2,491 → 2,625, `./ui-view.register` 2,476 → 2,609. `./ui-router.register` and the other eleven doors reprobe byte-identical, so the register economics the sheet argues are unchanged in shape.
- REV A — 2026-08-16 (aa35ad9) · REV B — 2026-08-17 (3557c29 "reprobe sheet 11 rev B after #590 and correct the matcher door name") · REV C — 2026-09-03 (2aaca5e) · REV D — 2026-09-03 (96f89fe) · REV E — 2026-09-06 (b1c0942), dated.
- Superseded figures: rev A caught the server index within 12 bytes of the flagship, a coincidence #590 promptly broke [the gap is 642 now]; rev B corrected the door name `./url-matcher` → `./matcher` and set the registration premium at 85 gz [90 now]; rev C found sixteen doors rather than fifteen, with four `lit-ui-router` doors up about 5% and the other eleven byte-identical; rev D re-probed 14 of 16 byte-identical, the lint plugin's door 4,559 / 1,917 → 9,703 / 3,510 gz on #689's three new rules (`sref-assign-href`, `sref-active-aria-current`, `directive-position`) and the mobx door 650 → 908 gz at mobx 1.0.0 — the plugin was about a third of the flagship's weight and is 63% of it now.
- The lint plugin graduated after rev B, so it takes door 16 and leaves rev B's numbering intact.
- Basis: `counted at ${PLATE.ref} @ ${PLATE.sha}` from `census-doors.json` [origin/main @ 185d414, 2026-09-06; 16 doors, 5 packages, probed with rolldown, minify, declared deps and peers external, annotations off].

## Sheet 12 — THE REGISTER PLATE

- **file** `diagrams/generator/sheet12.mjs` · **id** `graph` · **current rev** F
- **basis** (source): `const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)}) · ${TURBO}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3¼ — the monorepo as its CI reads it · every task node punched · turbo 2.10.11

### REV B — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV B: census refresh 2026-08-31 — three new members, three new rows, the phantom share held

**prose paragraph** (`sheet12.mjs`):

> <p><strong>Rev B — census refresh, 2026-08-31.</strong> Two weeks and one release (<code>lit-ui-router@1.10.0</code>) after the first printing, the plate was re-punched from a fresh <code>--dry=json</code>. Three rows joined the tools block — <code>@tools/eslint-ts-parser</code>, <code>@tools/lint-elements</code> and <code>@tools/warn-lanes</code> (#639) — taking the register from 27 packages to 30 and the graph from 483 nodes / 154 real to 535 / 165; edges 1,280 → 1,375, real edges 116 → 117. The <em>shape</em> is what held: the phantom share moved only 68% → 69%, the eighteen fanned names are the same eighteen, and all three new rows punch the same sparse pattern every small instrument does: <code>typecheck</code>, <code>lint</code>, <code>format:check</code> — three holes of eighteen — plus <code>test</code> for <code>@tools/warn-lanes</code>, which is the only one of the three with a suite. That is the plate's own thesis holding under a new measurement: a new member adds eighteen stations to the register and punches three or four of them. Elsewhere: the ragged tail gained <code>//#lint:elements</code> (25 → 26 singletons, fifteen of them root); the deepest chain grew a rung to thirteen — still five real — because <code>@tools/warn-lanes#build:types</code> now sits above <code>build_and_test</code>; the longest all-real chain shortened from seven <code>test</code> tasks to six; and the uncacheable tier was recounted across all seventeen <code>turbo.json</code> files rather than the root alone, which is twelve definitions, not seven. Still none of them reachable from <code>ci</code>.</p>

### REV C — undated in the copy; first in git 2026-09-02

**`sub` clause** (verbatim source):

> REV C: every number now imported from diagrams/data/census-plate.json — the fifth publishable package joined the register and the graph grew to 590 nodes / 176 real

**prose paragraph** (`sheet12.mjs`):

> <p><strong>Rev C — off the plate.</strong> The hand-pasted constants are gone: rows, columns, cells, tallies, the overlay and the schedule are all read from <code>diagrams/data/census-plate.json</code> at draw time, and the sheet throws rather than draws if a pipeline or a fanned name it needs is missing. Re-surveyed at origin/main @ 35c6766, the graph had grown again: <code>packages/eslint-plugin-lit-ui-router</code> is the fifth publishable package, taking the register from 30 fanned rows to 31 and the graph from 535 nodes / 165 real to 590 / 176; edges 1,375 → 1,504, real edges 117 → 126, phantom share 69% → 70%. There was also a 19th fanned column — <code>check:dev-split</code>, the dev-warning split guard, command-bearing in 1 package and a placeholder in the other 30 — which is the same story the eighteen told, one column wider. The ragged tail took the new package's three singletons (<code>lint:docs</code>, <code>lint:rules</code>, <code>test:oxlint</code>) and stood at 29; the deepest chain was 13 rungs with 5 real, and the longest all-real chain went back up to 7 <code>test</code> tasks — a new publishable package with a suite is exactly the sort of member that lengthens it.</p>

### REV D — undated in the copy; first in git 2026-09-05

**`sub` clause** (verbatim source):

> REV D: whole-cabinet refresh at eb32b4e — 586 nodes / 177 real, and real→real edges down a quarter to 96 · ${BASIS}

resolved →

> REV D: whole-cabinet refresh at eb32b4e — 586 nodes / 177 real, and real→real edges down a quarter to 96 · surveyed at origin/main @ 185d414 (2026-09-07) · turbo 2.10.11

**prose paragraph** (`sheet12.mjs`):

> <p><strong>Rev D — the whole cabinet, one ref, and the first recount that shrank.</strong> Every plate in <code>diagrams/data/</code> was re-counted at origin/main @ eb32b4e in one pass. The register keeps its shape — 31 fanned rows, 19 fanned columns, 13 rungs at the deepest and 7 at the longest all-real — but the punched inventory did not simply grow: nodes 586 against rev C's 590 and edges 1,382 against 1,504, real tasks up one to 177, the ragged tail up one to 30 as the root swapped one guard for two, and the phantom share easing from 70.2% to 69.8%. Two root singletons changed hands — <code>//#check:docs-api-deps</code> left, <code>//#check:graph-edges</code> and <code>//#check:task-inputs</code> arrived with #693 — and <code>apps/sample-app-shared</code> gave up its own <code>turbo.json</code> when #696 restored <code>turbo run e2e</code>. The figure that actually moved is real→real: 96 against rev C's 126, down a quarter on a graph the same size. That is #693's doing, and it is this plate's own thesis arriving from the other side. The <code>docs:api</code> column stood in nine packages and was command-bearing in four; the other five holes existed because <code>docs#build</code> reached its producers through <code>^docs:api</code>, and <code>^</code> walks direct dependencies, so <code>docs</code> carried devDependencies it never imports to make the walk land. #693 names the four producers instead — <code>lit-ui-router#docs:api</code> and its three siblings — and the column collapses to 4 holes, every one of them punched. Scaffolding came out of the graph and the real work stayed. Two thirds of the holes still run nothing.</p>`,

### REV E — 2026-09-06

**`sub` clause** (verbatim source):

> REV E 2026-09-06: the ci:main overlay holes and their key swatch now carry the accent hatch (a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); the register is otherwise untouched

### REV F — 2026-09-06

**`sub` clause** (verbatim source):

> REV F 2026-09-06: the uncacheable tier’s reason column hangs on the plate’s right margin — at the data face the longest reason no longer fitted a left-set column and ran off the sheet; the register, the overlay and the tail are untouched

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: the register re-punched at 864 nodes, 235 real, 3,024 edges, 109 real→real (was 863 / 234 / 2,985 / 109); the fanned tail is 40 names (was 39), the deepest chain 14, the deepest real run 6.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: the register re-punched at 863 nodes, 234 real, 2,985 edges, 109 real→real (was 718 / 227 / 1,932 / 111). #1038's leaves take three columns — `typecheck:tsc`, `lint:oxlint`, `format:check:oxfmt` — beside their umbrellas, which run nothing, so SIX COLUMNS RUN NOTHING; the pitch narrows 23 → 20 so the ci:main overlay keeps its lane. The notes name the umbrellas among the all-placeholder columns and throw if that set moves. The deepest chain retraced at 14. Two claims had been false since #780 moved `test` onto `^build`: `test` and `test:coverage` were listed as ^self chains, and the longest all-real chain was "6 test tasks … serialized by ^test"; the self-chain list is `transit`, `build:types`, `build`, and the 6-deep run is read off the edge list as build steps, `@tools/typedoc-plugin-lit-ui-router#build:types` to `sample-app-lit-e2e#build`.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: the register re-punched at 718 nodes and 227 command-bearing (was 717 / 226) over 1,932 dependency edges (was 1,920), 111 of them real; the ragged tail reads 34 one-offs (was 33). The new node is `@tools/repo-checks#check:dedupe` (#1016). No hand table took a row.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the register re-punched at 717 nodes and 226 command-bearing (was 716 / 225) over 1,920 dependency edges (was 1,897), 111 of them real; the ragged tail reads 33 one-offs (was 32) and the phantom share 68% (was 69%). The new node is `eslint-plugin-lit-ui-router#test:peer-floor` (#1002). No hand table took a row.
- 2026-09-28, later, no rev clause: the overlay note derives what `ci:main` buys. "three engine tests, one d.ts back-test and one pack check" was a typed tally that agreed with sheet 3B's five main-only tasks only by coincidence of names; the sentence now counts each overlay name's command-bearing nodes off the graph, prints the task each phrase means (`test:engines`, `test:matrix`, `check:pack`) so it reads as 3B does, and throws if those three counts stop summing to the overlay's real nodes.
- 2026-09-25, no rev clause: the row blocks catch up with the site's rename. The `DOCS + EXAMPLES` rule matched the package name `docs`, so `@www/lit-ui-router.dev` fell through the publishable block's negative test and stood among the published packages; the rule is now the `@www/` scope, the publishable rule excludes it, and the site rows with `examples` under `DOCS + EXAMPLES ×2`. The uncacheable tier cites the site's four `cache:false` definitions under their real package, with the `@www/` scope elided beside `@tools/` so the names clear the reason column, and `check:embeds` reads "reads the HOST" in the tier's own idiom; the two prose citations of `docs#check:embeds` and `docs#build` carry the scoped name.
- 2026-09-11, no rev clause: re-surveyed at origin/main @ 65e2843, and the hand-traced chain node `docs#build` is now `@www/lit-ui-router.dev#build`.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the register re-punched at the same 716 nodes and 225 command-bearing, against the same 1,897 dependency edges. No hand table took a row.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the register re-punched at the same 716 nodes and 225 command-bearing, against the same 1,897 dependency edges. No hand table took a row.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the register re-punched at 716 nodes and 225 command-bearing (was 697 / 213), against 1,897 dependency edges, up from 1,760, of which 111 join two real tasks, up from 94. `ci:main` reads 756/230. No hand table took a row — `APP_ORDER` is unmoved, no app having been born — and the phantom share and the hand-listed `^self` names stand as they were.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the register re-punched at 697 nodes and 213 command-bearing (was 660 / 195), against 1,760 dependency edges, up from 1,567, of which 94 join two real tasks, up from 73. `ci:main` reads 736/218. `register-graph.mjs`'s `APP_ORDER` took `sample-app-lit-effect`; the phantom share and the hand-listed `^self` names are unmoved.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the register re-punched at 660 nodes and 195 command-bearing — both unchanged — against 1,567 dependency edges, up from 1,544. The phantom share and the hand-listed `^self` names are unmoved.
- REV A — 2026-08-16 (d974286 "add sheet 12, the CI task graph as a punched register plate") · REV B — 2026-08-31 (73bc1cd), dated · REV C — 2026-09-02 (af7af45) · REV D — 2026-09-05 (999e663) · REV E and REV F — 2026-09-06, dated.
- Superseded figures: rev B took the register 27 packages → 30 and the graph 483/154 → 535/165, edges 1,280 → 1,375, the ragged tail 25 → 26 singletons, the deepest chain to thirteen rungs, and recounted the uncacheable tier across all seventeen `turbo.json` files — twelve definitions, not seven; rev C added the fifth publishable package and a 19th fanned column, 535/165 → 590/176 and edges → 1,504; rev D shrank for the first time — 586 nodes / 177 real, real→real 126 → 96 on #693 alone. Rev F hangs the reason column on the plate's right margin at 1130.
- The plate letters "THE UNCACHEABLE THIRTEEN" as a hand-set word that must track `UNCACHED.length`.
- Basis: `surveyed at ${PLATE.ref} @ ${PLATE.sha} · ${TURBO}` from `census-plate.json` [origin/main @ 185d414, 2026-09-07, turbo 2.10.11].

## Sheet 12i — THE REGISTER, WALKED

- **file** `diagrams/generator/sheet12i.mjs` · **id** `register-interactive` · **current rev** A
- **basis** (source): `const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0, 10)}) · ${R.turbo}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3¼ — sheet 12's plate, live under the pointer · the whole ci graph carried node by node · 605 NODES · 183 RUN A COMMAND · 1,424 EDGES · 99 JOIN TWO REAL TASKS · surveyed at origin/main @ 185d414 (commit 2026-09-06) · turbo 2.10.11

_No REV clauses, historical paragraphs or rev-bearing callouts: this plate has only ever been issued at its current revision._

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: the lane's head reads 864 NODES · 235 RUN A COMMAND · 3,024 EDGES · 109 JOIN TWO REAL TASKS.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: the lane's head reads 863 NODES · 234 RUN A COMMAND · 2,985 EDGES · 109 JOIN TWO REAL TASKS. The notes' "6 test tasks, serialized by ^test" read the same false claim as sheet 12; they now name the deepest real run's build steps off the edge list.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: the lane's head reads 718 NODES · 227 RUN A COMMAND · 1,932 EDGES · 111 JOIN TWO REAL TASKS over 53 task-name columns (was 52); the shroud carries 491 nodes and 1,821 edges, 68.4%.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the lane's head reads 717 NODES · 226 RUN A COMMAND · 1,920 EDGES · 111 JOIN TWO REAL TASKS over 52 task-name columns (was 51); the shroud carries 491 nodes and 1,809 edges, 68.5%.
- 2026-09-25, no rev clause: the lane's chrome carries restroked Lucide glyphs from the shared icon table (`generator/icons.mjs`) — `move` and `mouse` on DRAG TO PAN and SCROLL TO ZOOM, `ghost` beside the PHANTOM SHROUD checkbox, `scan` on FIT, the card's own `register` on the at-rest head, `arrow-down-up` on DEGREE, `hourglass` on DEPENDS ON, `arrow-up-from-line` on REQUIRED BY. The cells are house sprites and are untouched.
- 2026-09-25, no rev clause: the lane's row blocks share sheet 12's corrected rule, so `@www/lit-ui-router.dev` is filed under `DOCS + EXAMPLES` here as well and no longer among the publishable packages.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the same plate walked at the new ref, nothing moved; the lane's head reads 716 NODES · 225 RUN A COMMAND · 1,897 EDGES.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the same plate walked at the new ref, nothing moved; the lane's head reads 716 NODES · 225 RUN A COMMAND · 1,897 EDGES.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the same plate walked at the new ref; the build-time rank-from-edges preset recomputed over the 137 added edges, with the row blocks and the pitch unchanged. The lane's head reads 716 NODES · 225 RUN A COMMAND · 1,897 EDGES · 111 JOIN TWO REAL TASKS.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the same plate walked at the new ref; the build-time rank-from-edges preset recomputed over the 193 added edges, with the row blocks and the pitch unchanged.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the same plate walked at the new ref; the build-time rank-from-edges preset recomputed over the 23 added edges, with the row blocks and the pitch unchanged.
- Issued once, at REV A. Basis `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0,10)}) · ${R.turbo}` [origin/main @ 185d414, commit 2026-09-06, turbo 2.10.11].

## Sheet 13 — THE WEATHERING MAP

- **file** `diagrams/generator/sheet13.mjs` · **id** `weathering` · **current rev** F
- **basis** (source): `const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE t — the same city as sheet 7, surveyed in time · 319 files dated from the whole history · three construction seasons, 10 silent months

### REV B — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV B: drafting pass — the timeline rows now clear their own tallest bar, and no badge sits on a caption

### REV C — undated in the copy; first in git 2026-09-02

**`sub` clause** (verbatim source):

> REV C: re-dated off the plate at TODAY = ${TODAY}, with the fifth published package in the universe; every date and count is now imported from diagrams/data/census-weather.json

resolved →

> REV C: re-dated off the plate at TODAY = 2026-09-06, with the fifth published package in the universe; every date and count is now imported from diagrams/data/census-weather.json

**prose paragraph** (`sheet13.mjs`):

> <p><strong>REV C — the numbers by import, and a fifth package on the map.</strong> The sheet no longer carries a hand-pasted census: every per-file date, touch count, member roll-up and monthly bar is read from <code>census-weather.json</code>, and a member the drawing places but the plate does not carry is a build error rather than a stale constant. Re-dating at the plate's ref moves two things at once. The <em>clock</em>: <code>TODAY</code> is ${TODAY} rather than the working-tree date the old constants were counted at, so every idle figure is larger for reasons that are calendar, not neglect. The <em>city</em>: 286 dated files rather than 272, with <code>packages/eslint-plugin-lit-ui-router</code> (#676) drawn for the first time — ${filesOf(row(31))} files, none older than ${Math.max(...(byMember.get('packages/eslint-plugin-lit-ui-router') ?? []).map((r) => days(r.first)))} days, the youngest stone on the map. Sheet 7 gives it the plan slot 350,170; in this flat projection that lands underneath the reading box, so it takes the free third row of the packages district instead, beside №3 and №4. The <em>bands</em> survived the recount intact.</p>

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: whole-cabinet refresh — ${TOT_F} dated files, every band re-tested and held

resolved →

> REV D: whole-cabinet refresh — 319 dated files, every band re-tested and held

**prose paragraph** (`sheet13.mjs`):

> <p><strong>REV D — the whole cabinet at one ref, and the bands hold a third time.</strong> Every plate in <code>diagrams/data/</code> was re-counted at origin/main @ eb32b4e in one pass. <code>TODAY</code> advanced under a day, so nothing on this map aged by more than one, and the city gained 11 walls net — 6 new in <code>@tools/shared</code> and 8 in the lint plugin, where #693 and #689 built, against three <code>@tools/release</code> walls that came down. All the new stone is summer stone. Season III was 253 files, 85% of the city. Every editorial cut this plate makes was re-tested against the new distribution rather than assumed: the per-block touches-per-file gap is still clean between 4.65 and 6.0, so HOT stays ≥${HOT}; the per-file median is still ${COLD}, so COLD stays below it; 6 source blocks run hot and the same 6 files sit beyond the ${SEAL}-day seal. One number in the prose did move with the clock and is now derived rather than typed — the empty stretch the seal sits in read 62 to 228 at that ref, where rev C printed 61 to 227.</p>

### REV E — 2026-09-04

**`sub` clause** (verbatim source):

> REV E 2026-09-04: refreshed again after the 1.11.2 + mobx 1.0.0 releases — №32 @tools/embed-heights laid the day it was cut

**prose paragraph** (`sheet13.mjs`):

> <p><strong>REV E — refreshed at ${PLATE.ref} @ ${PLATE.sha}.</strong> ${TOT_F} dated files, ${SEASON_N[2]} of them Season III (${Math.round((SEASON_N[2] / TOT_F) * 100)}% of the city); №32 <code>@tools/embed-heights</code> (#703) is the newest stone, laid on <code>TODAY</code> itself. The bands held a fourth time: ${HOT_BLOCKS} source blocks run hot, the same ${SEALED_F} files sit beyond the ${SEAL}-day seal, and the empty stretch the seal sits in reads ${IDLE_GAP[0]} to ${IDLE_GAP[1]}.</p>

### REV F — 2026-09-07

**`sub` clause** (verbatim source):

> REV F 2026-09-07: re-dated after #717 moved the documentation site to www/lit-ui-router.dev/ — the most-weathered wall in the city is the same file under a new address, and its callout and the verdict now name it there; the rename chain is followed backwards, so its first date and touch count carry across the move — ${BASIS}

resolved →

> REV F 2026-09-07: re-dated after #717 moved the documentation site to www/lit-ui-router.dev/ — the most-weathered wall in the city is the same file under a new address, and its callout and the verdict now name it there; the rename chain is followed backwards, so its first date and touch count carry across the move — counted at origin/main @ 185d414

**Record notes**

- 2026-09-11, no rev clause: the same 15 → 300 / 32 → 440 move as sheet 7, applied to this sheet's own `PLACED` table, which had carried the same overlap; asserted by `assertPlots` as well (DESIGN-REVIEW §T53).
- 2026-09-11, cabinet refresh at origin/main @ 65e2843: this sheet's own `PLACED` takes the same three new rows as sheet 7 — 33 `@tools/bootstrap` (490, 350), 34 `@tools/eslint` (514, 530), 35 `@tools/repo-checks` (449, 385) — and the same №32 step, 440,430 → 449,462.
- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: 448 dated files, 1,641 touches (was 442 / 1,604). №39 follows sheet 7 to 570,430. №37's annex reached 340.4 under the CHURN key and moves 316,104 → 316,101, and `assertPlots` threw on №4's annex against it, so №4 moves 330,150 → 330,158.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: 442 dated files, 1,604 touches. №39 `@tools/crap` takes sheet 7's lot (560,430). `assertPlots` threw on №4 against №38's grown annex; row two recomposes, №38 165 → 172 and №4 310 → 330, and №21 and №28 follow sheet 7 (288, 394). The notes' "hottest multi-file block-average" (docs) and "largest district by mass" (the yard) are asserted against the plate.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: 427 dated files (was 425), 1,541 touches, seasons 26 / 15 / 386; the cohort means hold at ×12.2 · ×8.3 · ×2.8 and 121 of 427 files have been touched once. ssr's annex grew to 2,578 spec sloc and `assertPlots` threw — the plugin's block (4) crossed it by 5.5 units — so the plugin's lot moves east from x 303 to 310; its callout leader derives its foot and follows.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: 425 dated files (was 424), 1,517 touches (was 1,474), seasons 26 / 15 / 384, TODAY 2026-09-28 from the ref's commit date; the cohort means read ×12.2 · ×8.3 · ×2.8, and 121 of 425 files have been touched once. №4's callout derives as the ninth refresh left it and reads “its January index.ts chiselled 14 times”, the block ×7.5/f and still the sixth-highest on the map. No claim needed a change.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: 424 dated files, up from 423, 1,474 touches, seasons 26 / 15 / 383, with TODAY derived from the ref's own commit date (2026-09-25); the cohort means read ×12.2 · ×8.1 · ×2.7 (was ×12.1 · ×7.9 · ×2.7), and 2026-09 took 252 package touches (was 245), inside the plate-capped scale. №4's block went from one file to two when `compose-navigate-url.ts` was laid 2026-09-23, and it broke three claims no gate held: the callout's “one January wall, chiselled 11 times” interpolated the BLOCK's touch total into a one-file sentence (it would have read 14), its “the highest churn intensity on the map” was typed, and the notes called the plugin “the smallest building on the map” with “the highest per-file churn anywhere”. At this ref the block averages ×7.0/f (was ×11.0/f), sixth on the map behind `docs`' ×10.1. The callout now names its walls off the plate — “its January index.ts chiselled 13 times; / one September wall beside it, touched 1×” — and the notes derive the month, the touches, the file count and the rank (“the sixth-highest on the map”), and call it the smallest PACKAGE, which the build now asserts.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: 423 dated files, up from 399, with TODAY derived from the ref's own commit date (2026-09-22). `PLACED` could no longer copy sheet 7's grown packages district and is RECOMPOSED here: row one №2 at 240,20, №3 at 240,104 and №37 at 316,104, in the strip under the flagship's annex; row two, west to east, №31 at 16,149, №38 at 165,156 and №4 at 303,150, the plugin last so its callout's leader drops straight to the lettering and derives from №4's lot. The reading box's west wall moves 620 → 668, its contents +48, because `ui-router-server`'s annex reaches x 655 in row one; the masonry callout drops 44. And the FOUR SEASONS timeline overflowed: 2026-09 took 245 package touches and 242 tool touches (was 189 / 216), and the 245 bar ran out of its row because each row's scale was a hand constant. Both scales are capped from the plate's own busiest month now, the four district rows sharing one.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: 399 dated files, up from 386, with TODAY derived from the ref's own commit date (2026-09-14) as the probe requires. `PLACED` took №38 `lit-ui-router-ssr` at 285,175 — sheet 7's south lot falls under this plate's reading box, so the two plates differ deliberately again, the same class of divergence they already carry for №31 and №37 — and followed sheet 7 on the three neighbours its grown annexes moved: №2 to 226, №3 to y 136 and №28 to 388, with №31 `eslint-plugin-lit-ui-router` dropping to y 136 for the same clearance. No artery moved. After the record, the frame audit: the district's north wall reaches x 187 now, so the packages note takes two short lines under its label, and the examples callout moves x 1250 → 1262.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: 386 dated files, up from 351, with TODAY derived from the ref's own commit date (2026-09-12) as the probe requires. `PLACED` took the effect pair, and one of the two deliberately differs from sheet 7 again: 37 stands at 200,172 here, because sheet 7's south lot falls under this plate's ORIGINAL MASONRY callout; №2 moved 200 → 222 with sheet 7. The map's sealed wing is gone — `symbols/` left the tree with #831/#832 (the plugin is 2 files / 343 sloc, from 5 / 759) — so the citation relocates to `src/index.ts`, the callout is re-texted as THE YARD'S ONE WINTER WALL, and the three slabs still sealed all stand in `examples/`. The honesty sweep took three more: the `navigation-location-plugin` callout is recomposed to 500,548, the annex it had stood on having grown under it; its “chiselled ten times” is the plate's own figure now (11); and `@tools/release`'s “did not exist two months ago” — false at 69 days — is the derived age.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: 351 dated files, up from 347, with TODAY derived from the ref's own commit date (2026-09-11) as the probe requires. `PLACED` took no row — no member was born since 65e2843 — and the city's own placements still match sheet 7's.
- REV A — 2026-08-17 (bf7593d) · REV B — 2026-09-01 (8033db3) · REV C — 2026-09-02 (5eaabba) · REV D — 2026-09-03 (96f89fe) · REV E — 2026-09-04, dated · REV F — 2026-09-07, dated.
- `TODAY` is not a wall-clock date: it is the measured ref's own commit date, 2026-09-06. Every idle figure is measured against it, which is why re-dating alone ages the map.
- Superseded figures: rev C re-dated 272 → 286 files at the plate's ref and drew the fifth published package for the first time; rev D counted 319 dated files at eb32b4e with Season III at 253 files / 85%, and derived the seal's empty stretch at 62–228 where rev C had printed 61–227 [65–231 now]; rev E held the bands a fourth time — 6 hot source blocks, the same 6 files beyond the 180-day seal. The editorial cuts have survived every recount: the touches-per-file gap is still clean between 4.65 and 6.0, so HOT stays ≥6, and the per-file median is still 2, so COLD stays below it.
- Basis: `counted at ${PLATE.ref} @ ${PLATE.sha}` from `census-weather.json` [origin/main @ 185d414].

## Sheet 14 — THE SURVEY OFFICE

- **file** `diagrams/generator/sheet14.mjs` · **id** `pipeline` · **current rev** D
- **basis** (source): `const BASIS = `${A.ref} @ ${A.sha} · commit ${A.commitDate}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3½ — the atlas measuring itself · 17 probes, 17 plates, 20 drawings · every station, plate and edge on this sheet introspected from diagrams/generator/ at build time · all plates pinned to origin/main @ 185d414 · commit 2026-09-06

### REV A — 2026-09-06

**`sub` clause** (verbatim source):

> REV A ${A.commitDate}: first printing — the instrument drawn by itself

resolved →

> REV A 2026-09-06: first printing — the instrument drawn by itself

### REV B — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV B: the schedule now clears the instrument ledger however tall the rack grows, and long READ BY lists wrap

### REV C — 2026-09-06

**`sub` clause** (verbatim source):

> REV C 2026-09-06: the master-snapshot plate now carries its accent hatch (a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); nothing else moved

### REV D — 2026-09-06

**`sub` clause** (verbatim source):

> REV D 2026-09-06: the external-instrument ledger runs as one column instead of two — the 140px half-column had been cut for the mono line and clipped ten of the eleven instruments to an ellipsis; on the full measure all but the tarball URL stand whole

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: re-introspected over the same 17 plates, all pinned to origin/main @ 4dc0cbb7; 853 tracked paths, 818 rows.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: re-introspected over the same 17 plates, all pinned to origin/main @ 6d41d21e; 845 tracked paths, 810 rows.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: re-introspected at the new ref over the same 17 plates; the master plate reads 788 rows (was 785). Sheet 11 now reads `census-files.json` for the ssr version, so the office draws one more read: 101 edges (was 100), 54 reads.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: re-introspected at the new ref over the same 17 plates; the master plate reads 785 rows (was 784). Sheet 11 now reads `census-npm.json` for its rc sentence, so the office draws one more read: 100 edges (was 99), 53 reads.
- 2026-09-25, no rev clause: the plate is filed as appendix A2 (`generator/sheetA2.mjs`, `num: 'A2'`, `appendix: true`), outside the ascent beside A1 — its subject is the atlas measuring itself, not the codebase. The `sub` opens `APPENDIX · META` where it read `ALTITUDE 3½`, the head plate reads `APPENDIX A2 · META`, and thirteen altitudes remain. `/office`, `/sheet/14` and `/sheet/14i` redirect to A2 and A2i; this record's heading keeps the number the revs were issued under.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: re-introspected at the new ref over the same 17 plates and the same station set; no station joined or left. The basis reads 819 tracked paths and the master plate 784 rows (was 818 / 783).
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: re-introspected at the new ref over the same 17 plates and the same station set; no station joined or left.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: re-introspected at the new ref over the same 17 plates and the same station set — 17 probes, 17 plates, 20 drawings, and no station joined or left. `census-npm.mjs` learned to record a dist-tag map per row this pass, which is a field on a plate and not a station, so the office is unmoved by it. After the record, the frame audit: the bus's reads label nudged 4 units clear of the rail it letters.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: re-introspected at the new ref over the same 17 plates and the same station set; no station joined or left. The install harness's own lettering, its aria sentence and its notes now say mise-provisioned pnpm, which is what `basis.mjs` has run since the fourth refresh.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: re-introspected at the new ref over the same 17 plates and the same station set. `census-loop.mjs` had to be run with the others to get there: it is the one probe outside the T1/T2/T3 run order the operating notes name, and a cabinet left without it straddles two shas, which is exactly what `census-atlas.mjs` throws on.
- REV A — 2026-09-06, written as a template (`REV A ${A.commitDate}`); the module first printed 9c5ef4b 2026-09-03 "feat: census pipeline I6 — sheet 14, the survey office" · REV B — undated, the sheet's own drafting pass after 9c5ef4b · REV C and REV D — 2026-09-06, dated.
- Rev D's 140px half-column had been cut for the mono line and clipped ten of the eleven external instruments to an ellipsis; on the full measure all but the tarball URL stand whole.
- The rev A body is the six unlabelled notes paragraphs. One of them, "Five faults of the old regime", is the pipeline's own history written in the present tense — a basis that was whatever was checked out, frozen 30-entry member lists, numbers travelling by clipboard, hard-coded time, and inputs from out of band. The one relic still in the drawer is drawn struck through: `census.mjs`, a working-tree walker imported by nothing and writing no plate.
- Basis: `${A.ref} @ ${A.sha} · commit ${A.commitDate}`, introspected by `census-atlas.mjs` — all 17 filed plates pinned to origin/main @ 185d414 · commit 2026-09-06, and the introspection throws rather than draws if they disagree about the ref.

## Sheet 14i — THE SURVEY OFFICE — INTERACTIVE

- **file** `diagrams/generator/pipeline-graph.mjs` · **id** `pipeline-interactive` · **current rev** A
- **subject line / lead** (resolved, present-state — not history):

> THE CENSUS PIPELINE AS A LIVE GRAPH · 69 NODES · 95 EDGES · 17 WRITES / 48 READS / 30 IMPORTS

_No REV clauses, historical paragraphs or rev-bearing callouts: this plate has only ever been issued at its current revision._

**Record notes**

- 2026-10-04, cabinet refresh at origin/main @ 4dc0cbb7: the lane re-drawn from the re-introspected pipeline at the new ref.
- 2026-10-03, cabinet refresh at origin/main @ 6d41d21e: the lane re-drawn from the re-introspected pipeline at the new ref.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: the lane re-drawn from the re-introspected pipeline: 69 NODES · 101 EDGES · 17 WRITES / 54 READS / 30 IMPORTS (was 100 / 53), the new edge sheet 11's read of the master plate.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the lane re-drawn from the re-introspected pipeline: 69 NODES · 100 EDGES · 17 WRITES / 53 READS / 30 IMPORTS (was 99 / 52), the new edge sheet 11's read of the registry plate.
- 2026-09-25, no rev clause: A2i's chrome carries restroked Lucide glyphs from the shared icon table (`generator/icons.mjs`) — `move` and `mouse` on DRAG TO PAN and SCROLL TO ZOOM, `wrench` beside the TOOLS LEDGER checkbox, `scan` on FIT, the card's own `pipeline` on the at-rest head, `arrow-down-to-line` on the ties in (WRITTEN BY, READS, IMPORTED BY) and `arrow-up-from-line` on the ties out (WRITES, READ BY, IMPORTS). The stations are house sprites and are untouched.
- 2026-09-25, no rev clause: the lane is filed as appendix A2i (`sheetA2i` in `generator/pipeline-graph.mjs`), the appendix's interactive row beside A2 and outside the ascent; it mounts at `#pipeline-graph` in the gallery's appendix, the head plate reads `APPENDIX A2i · META · REV A`, and thirteen altitudes remain.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the same office in the lane, re-drawn from the re-introspected pipeline; no station joined or left.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the same office in the lane, re-drawn from the re-introspected pipeline; no station joined or left.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the same office in the lane, re-drawn from the re-introspected pipeline; no station joined or left.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the same office in the lane, re-drawn from the re-introspected pipeline; no station joined or left.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the same office in the lane, re-drawn from the re-introspected pipeline; no station joined or left.
- Issued once, at REV A: `export const REV = 'A'`, and the only revision lettering on the page is the head plate's `SHEET 14 · REV ${REV}`. First printing 151f13f 2026-09-03 "feat: census pipeline I7 — interactive cytoscape survey office in the gallery".
- Basis: none stated as a `BASIS` string; the sub carries the graph size only.

## Sheet A1 — THE SPRITE STUDY

- **file** `diagrams/generator/sheetA1.mjs` · **id** `sprites` · **current rev** A
- **subject line / lead** (resolved, present-state — not history):

> APPENDIX · META — the research behind the building sprites, drawn in the set it argues about · three concepts on one demo member, five states each

### REV A — 2026-09-06

**`sub` clause** (verbatim source):

> REV A 2026-09-06: rolled into the set from the standalone sprite-studies exploration; the reference strip of game screenshots is cited in the notes rather than re-drawn, because the atlas draws no images

**Record notes**

- 2026-09-11, no rev clause: the reference strip is DRAWN. Six fair-use thumbnails — Horizon Zero Dawn, Ta Prohm, SimCity 2000, SCURK, FFF-355 and FFF-228 — stand in a band at the foot of the plate, grouped by study and credited, inlined as data URIs at build (`generator/a1-refs.mjs` + `generator/assets/a1/*.jpg`, 251,139 bytes); the viewBox deepens 1560×1216 → 1560×1530. They are the set's only rasters, by decision: this is the one plate whose subject is other people's drawings. The rev A clause and the note above stand as written — they record the rule as it was.
- REV A — 2026-09-06, dated (ce41fdd "feat: appendix a1 — the sprite study rolled in; specimen off the prerendered rail").
- What the roll-in dropped: the original studies' reference strip of six annotated screenshots — Horizon Zero Dawn, Angkor's Ta Prohm, SimCity 2000, SCURK and two Factorio Friday Facts posts — because the atlas draws no images. The teaching survives as citations in the notes.
- Basis: none, by design. The plate is META and carries no census plate and no measured number; the only figures on it are the demo member's massing (16 files · 1,900 sloc).

## Sheet A3 — THE ATLAS, MEASURED

- **file** `www/atlas.lit-ui-router.dev/generator/sheetA3.mjs` · **id** `self` · **current rev** A
- **basis** (source): `data/census-city.json` for the codebase and `data/survey-self.json` for the atlas, two grounds named on the plate
- **subject line / lead** (resolved, present-state — not history):

> APPENDIX · META — the atlas as a census city on sheet 7's ruler, standing beside the codebase it draws · four members, 17,835 sloc · measured at www/atlas @ bed7a858, outside the cabinet, which is main's (origin/main @ 6d41d21e)

### REV A — 2026-10-04

**`sub` clause** (verbatim source):

> REV A 2026-10-04: first printing — the city census turned on the atlas itself, at the maintainer's ask: "i think the atlas desires a city render of itself in the appendix, comparing to the rest of the codebase"

**Record notes**

- Basis: a separate plate outside the cabinet. `generator/survey-self.mjs` archives the atlas's own branch and runs the cabinet's scc 4.0.0 over it, filing `data/survey-self.json` under a `survey-` name so appendix A2's one-ref check stays about main.
- The fixed-point rule: the atlas counts what it writes by hand and serves to a browser, never what it draws. Four members (drawing office, survey office, routed site, site build); plates, generated pages, `app/public/`, `app/src/generated/` and prose stand outside and are tallied on the plate.
- One ruler: `S()`, `H()` and `AG` are exported from `sheet7.mjs` and imported, and file admission is `onCityRuler` in `census-query.mjs`, the predicate the city census itself runs.
- 2026-10-04, re-measured: `survey-self.mjs` re-run at www/atlas @ e1fbec96 (was bed7a858), a commit that holds `survey-self.mjs` itself, against the cabinet at origin/main @ 4dc0cbb7. The atlas reads four members, 92 files · 18,243 sloc (was 89 / 17,835) — the survey office 23 files · 2,242 — 2.5× the product's 7,191 (was 2.6× / 6,940) and 74% of the codebase's 24,550.

## City — SHEET 7’S CENSUS CITY IN THE ROUND (city-scene.mjs)

- **file** `generator/city-scene.mjs` (model `generator/city-glb.mjs`) · **id** `city` · **current rev** H
- **basis** (source): `const BASIS = `${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> SHEET 7'S CENSUS CITY IN THE ROUND · 39 MEMBERS · 38 MASSED · 27 SPEC ANNEXES · 4 DISTRICTS · ONE GLTF BINARY · ONE CLIP RAISES IT FROM THE GROUND, RAISE ⇄ GROUND · THE CAMERA ORBITS FREE AND TURNS TO THE FOUR TRUE DIAGONALS · A SECOND LANE RELIGHTS THE CITY FROM SHEET 7A'S FILED SHADOW PLATE

### REV C — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV C: A SECOND LANE RELIGHTS THE CITY FROM SHEET 7A'S SHADOW SURVEY

**other rev-bearing copy** (`city-scene.mjs`):

> const BASIS_TEXT = `BASIS — the same geometry sheet 7 draws: every footprint, height and position here is <code>generator/sheet7.mjs</code>'s computed <code>CITY</code> export, embedded verbatim as JSON, massed from <code>diagrams/data/census-city.json</code> — ${BASIS}. Nothing is re-derived, so a mass in the model cannot drift from the mass on the plate. Walls are semi-opaque over a girding frame per the pinned sprite note; gate severity is colour, never height; the <code>off</code> tier is drawn frame-only because there is nothing to mass. Camera is orthographic at the true isometric elevation, atan(1/√2) ≈ 35.264°; the azimuth is free under the pointer and eased onto the nearest diagonal on release — instantly under <code>prefers-reduced-motion</code>. Each src mass carries a billboarded number chip — sheet 7's own numbering, drawn at runtime into a canvas in the page's own mono stack and redrawn when the theme turns, dropped below zoom ${DATA.chip.min} so a pulled-back plan stays a plan. District names are lettered FLAT on their ground plates, turned onto the opening diagonal so they read level at rest and foreshorten with the ground as a site plan's lettering does. Hovering or tapping a mass lights that member and fills the reading panel from the same row the schedule prints.  three.js ${THREE_URL.match(/three\.js\/([\d.]+)\//)[1]} is imported only once the plate scrolls into view, and the scene renders on demand — nothing runs while you read.  REV C adds a SECOND MATERIAL LANE over the same geometry: <code>TEST LIGHT</code> relights the city from <code>generator/sheet7a.mjs</code>'s exported <code>SURVEY</code>, so the model and the flat shadow plate cannot drift either. Its polarity is sheet 7A's — covered source is LIT, source no suite loads is SHADOW, and the spec annex is the LAMP that throws the light; a metered member's mass splits along its footprint, the lit slab being side × the extent the meter recorded, taken from the annex (east) side, its tint stepping down through the line-coverage bands. Shadow lerps toward BLACK rather than the ink, because <code>--ink</code> is light in the cyanotype theme and a shadow that brightens in the dark is not a shadow.  REV D re-lights the lane from a PLATE: sheet 7A's light is no longer a transcribed one-off but <code>diagrams/data/census-shadow.json</code>, ${SURVEY_META.basis} — the same ref the geometry is massed at, with ${SURVEY_META.metered} members metered under their own suites' meters. Every mass in this model therefore has a survey row (a mass without one is a build error), so the blank-paper case for a member the old metering predated is gone along with the metering that needed it.`;

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: THAT SURVEY IS NOW A FILED PLATE, METERED AT THE CITY'S OWN REF

### REV E — 2026-09-07

**`sub` clause** (verbatim source):

> REV E 2026-09-07: THE STAGE IS VIEWPORT-RELATIVE — 80VH, CAPPED AT 1400PX AND FLOORED AT 520 — SO THE MODEL STANDS AS TALL AS A CONTAINED PLATE INSTEAD OF A FIXED 620PX BAND

### REV F — 2026-09-12

**prose paragraph** (`city-scene.mjs`, the basis strip — the `sub` has carried no REV clause since the 2026-09-07 present-state pass):

> The masses are drawn on PAPER, the way the flat plates draw them: faces are opaque and remove what stands behind them, the cap takes the tier's own fill and each right-hand wall takes the tier's hatch over a <code>--paper-2</code> stone, with the tier's hue pulled 22% of the way in so the tiers still part at a glance.

### REV G — 2026-10-03

**commit subject** (b62fe922, where `city-scene.mjs` exports `REV = 'G'`; the `sub` carries no rev clause):

> every city building is crowned by a working plant

### REV H — 2026-10-04

**`sub` clause** (the record's own, the `sub` carrying no rev clause):

> REV H 2026-10-04: the city in the round as one glTF binary in Google's model-viewer, at the maintainer's ask: "i think reworking the 3d working city as model viewer like this would be better than another forced isometric experience"

### REV (unattributed) — undated in the copy

Two source comments in `city-scene.mjs` describe how `revBlock` files a rev's basis note under its headline. No drawing revision; carried here because the subhead is part of the record.

**Record notes**

- 2026-10-04, REV H: the city in the round is one glTF binary in `@google/model-viewer` 4.3.1, on the bricks plate's pattern, and the plate is app-only: the flat gallery draws no copy, and its index row links to the routed `/city`. `generator/city-glb.mjs` writes `app/public/models/city.glb` (195,436 bytes, 3,428 triangles, 70 materials) and the working twin's `plant.glb` on `generator/glb.mjs`, the container lifted out of `brick-glb.mjs` (bricks.glb byte-identical); `generator/mv-kit.mjs` carries the script both model-viewer plates share — the linear retint, the iso corners, the wheel gate, the pin walk and the reveal hold. One plan unit is one model unit. Per member a `mass-<n>` node with its origin at the footprint's ground corner, `annex-<n>` beside it; every mass written as its TEST LIGHT slabs from the start (the shadow slab west at side × (1 − extent), the lit slab east, one slab for the n, e, u and z categories), each slab a cap and a wall primitive graded by COLOR_0 (cap 1.0, walls 1.0 → 0.9 top to foot). Materials are unlit and baked in the vellum palette: tier faces `cap-`/`wall-<tier>`, hatch `hatch-<def>`, light faces `L-<band>-cap`/`-wall`, one `frame-<n>` per member, `edge-annex`, `edge-district`, `plate`, `grid`, and `void` at alpha 0; a band no member reaches at the census is left out. The page recomputes every one from its tokens in linear light with `DRESS_JS`, the same function the bake runs, on load and on every theme turn, and holds the model behind its poster (`reveal="manual"`, `loading="eager"`) through that first retint, so the cyanotype theme never shows the baked vellum. The second lane is the KHR_materials_variants variant `test-light`; a primitive that belongs to one lane only maps to `void` in the other. Hover and pin recolour the member's `frame-<n>` to the accent. Picking is model-viewer's own `positionAndNormalFromPoint` against per-member boxes in the island; pins are 39 hotspots and the four district names four more. The camera is perspective at 14° (4°–20°, the viewer widening a narrow stage's field itself), opening at the 45° diagonal on the iso polar 54.736°, aimed at the ground's centre, at the radius that frames the plan's diagonal at 94% of the stage's width, set on load from the stage's own aspect; four corner buttons, free orbit under the viewer's damping, and `disable-tap`. The unpinned pins fold to 9 px dots once the plan stands below 62% of its desktop home size on screen, a phone's stage included. One clip, `rise`, 2.4 s: every `mass-<n>` and `annex-<n>` scales up from 0.001 in sheet 7's schedule order, district by district, each over 0.6 s, the crowns over the last 0.4 s; the plate opens raised and never plays by itself, RAISE ⇄ GROUND and a slider drive it on the bricks plate's clock (held 1e-4 s short of the end), and the pins ride it through `updateHotspot`. Known changes against REV G: no snap (the orbit is free and the corners are buttons); no flat lettering (district names are hotspot labels); the hatch is a pattern tile in world space, not a screen-space stripe; every stroke is a strip of triangles on its faces, because model-viewer neither retints nor remaps a line primitive (GLTFLoader gives a line its own material copy, which model-viewer files under `Default`, and its scene graph wraps meshes only), so the edges carry no 1 px weight; the shadow stripe is a tile multiplied into the shadow slab's own material. To hold the budgets (city 200 KiB, plant 350 KiB, asserted at build), positions are int16 under KHR_mesh_quantization, and index runs, vertex grading and the clip's keys are shared across primitives. The flat gallery's `citySection()`, three.js 0.169.0 off cdnjs, the screen-space hatch shader, the orthographic camera and its snap, the sprites, the raycaster and the forced context loss are retired with it; model-viewer keeps one renderer for every viewer on the page.
- 2026-10-03, REV G: every massed member is crowned by a working plant that `generator/city-plant.mjs` plans from its census row (b62fe922): stacks up the west edge (one per 10 src files, up to four, banded in the tier's edge colour), tanks along the north edge by sloc (150 / 600 / 1,800) joined to the stacks by a header pipe on sleepers, vents on the leftover roof cells from a PRNG seeded on the member's name, a portal gantry at footprint ≥45 and a catwalk at ≥28, risers and deck rings by wall height, and on annexes a two-pipe rack with three module lamps lit by sheet 7A's line coverage. Walls translucent (caps 88%, walls 80%) with the frame drawn at 30% through them; the plant one merged mesh with baked vertex shading. Draw calls 493 → 558, triangles 848 → 30,740. The same day the plant moved to a sheet of its own (see Plant).
- 2026-10-03, no rev clause: the city stands as two sheets. `/city` (`atlas.city`, id `city`) is the measured city: opaque paper walls inside their girding frames, the TEST LIGHT lane, and no plant. `/plant` (`atlas.plant`, id `plant`, SHEET 7B · 3D, REV A, THE WORKING CITY — ISOMETRIC) is the same scene with every massed member crowned by a working plant that `generator/city-plant.mjs` plans from its census row, walls at 80% and caps at 88%, and the girding frame drawn at 30% where a wall stands in front of it. One body in `city-scene.mjs` draws both; the JSON island's `plant` field is the switch. The plant sheet is filed only in the app, seated right after the city, and the flat gallery carries the city alone.
- 2026-09-12, REV F: the model takes the plates' own materials. A wall is paper, not a tint — `--paper` (or `--paper-2` where sheet 7's `capCls` is `fp2`) with the tier's hue pulled only `TINT` [0.22] of its old factor, so the tiers still part in the round without the model reading as colour. The right-hand wall (+x/−z, the SVG's right face) carries the tier's hatch over a `--paper-2` stone, the left wall is flat `--paper-2`, and `pr` and `late` take sheet 7's ROOF WASH — the cap hatched like the side; `halt`'s cap stays the red fill and takes none. The hatch is chrome.mjs's four pattern defs in three dimensions (`hx` 6px `--line`, `hd` 5px `--ink-soft`, `hr` 6px `--red-hatch` at .55, `ha` 6px `--accent` at .5) laid in SCREEN space off `gl_FragCoord` through an `onBeforeCompile` hook on the stock `MeshBasicMaterial` — stroke, alpha, rake and spacing all uniforms, one program for the hooked family under a `customProgramCacheKey`, no texture and no new dependency. That is what `patternUnits="userSpaceOnUse"` means: one rake and one spacing on every wall at every azimuth. Severity is the RAKE, `hr` running against the other three, exactly as on the plate; measured on the shot, 5.98 device px across the rake against the defs' 6. Faces are OPAQUE now (`depthWrite`, a hair of polygon offset under the frame), so the model removes hidden surfaces as `iso-hidden.mjs` does flat; only the light lane's slabs and the district plates stay translucent. Frames take sheet 7's edge ladder by COLOUR — `skr` red for halt and pr, `ska` accent for late, `skf` `--line` for report, `sks` soft for off and the annexes, `sk` ink for line — and the shadow slab is 7A's `-sh`: the black wash at .38 with a `--ink` stripe at .30 over it, replacing the old .74 lerp. **Known gap:** the weight half of that ladder (1.3 / 2 / 1 / 1.1 / 1.6 / 1.4) does not travel. A `LineBasicMaterial` carries no width on any desktop GL, and `Line2` would mean a fat-line dependency and a second geometry per frame; the colour alone is the ladder here until that trade is worth taking.
- 2026-09-29, cabinet refresh at origin/main @ 63c0b823: the city re-massed off sheet 7's shared universe at the new ref — 38 members, none born; `lit-ui-router-ssr` stands a file taller with a grown annex and no lot moved.
- 2026-09-28, cabinet refresh at origin/main @ 9b1b1bf3: the city re-massed off sheet 7's shared universe at the new ref — 38 members, none born; `tools/eslint` stands a file taller and no lot moved.
- 2026-09-23, no rev clause: the plate's general notes are recomposed. The one `BASIS_TEXT` paragraph, set at 13.5 px under a 68ch right-padding measure, is retired for `BASIS_NOTES`: seven labelled notes (BASIS, PAPER, HATCH, CAMERA, LETTERING, TEST LIGHT, POLARITY) at the set's notes measure, 18/1.8 prose in `--ink` in columns no narrower than 24em, each label a tracked data-face key on its own line, each code chip on `--paper` and unbroken at desktop; the two JSON paths are cited as `data/census-city.json` and `data/census-shadow.json`. The reading panel's idle state drops the repeated `THE CITY — ISOMETRIC` title and keeps only its hint, the hover heading is an `h3`, and the hint and the stage note move from `--ink-faint` to `--ink-soft`. In the app, `plate()` and `CityView` render one template on both sides of the seam — the fragment as `<atlas-plate>`'s child, the properties beside it — so `hydrate()` adopts the served plate on /city and on every sheet instead of rendering a second copy after it; `<atlas-plate>` and `<atlas-city>` are `ReactiveElement`s that run the fragment's scripts and the scene and draw nothing of their own.
- 2026-09-26, cabinet refresh at origin/main @ fe44598e: the city re-massed off sheet 7's shared universe at the new ref — 38 members, none born, and №4's block standing a file taller in the round; no lot moved.
- 2026-09-23, cabinet refresh at origin/main @ 38c9fa1c: the city re-massed off sheet 7's shared universe at the new ref — 38 members, none born, №2 moved east and №3 south with sheet 7, and №38's grown annex standing in the round.
- 2026-09-14, cabinet refresh at origin/main @ 4223ffc7: the city re-massed off sheet 7's shared universe at the new ref — 38 members now, №38 `lit-ui-router-ssr` standing on sheet 7's own lot, and №2, №3 and №28 moved east and south with it.
- 2026-09-13, cabinet refresh at origin/main @ 9896b3c1: the city re-massed off sheet 7's shared universe at the new ref — 37 members now, the effect pair standing on sheet 7's own lots, and №2 moved east with it.
- 2026-09-12, cabinet refresh at origin/main @ 2ac53a0: the city re-massed off sheet 7's shared universe at the new ref — same 35 members, same placements, new masses.
- REV A / REV B — not filed. The plate first landed 115e82e 2026-09-03 "city scene — I8 redirected to a three.js isometric city", and no REV A or REV B clause was ever written · REV C — 2026-09-03 (8a4bdc3 "the shadow survey as a TEST LIGHT lane"), undated in the string · REV D — 2026-09-03 (2e72a39), undated in the string · REV E — 2026-09-07, dated.
- Rev E made the stage viewport-relative — `clamp(520px, 80vh, 1400px)` — retiring a fixed 620px band. Rev D's light is `SURVEY_META.basis` [metered at origin/main @ 185d414 (2026-09-07)] over `SURVEY_META.metered` [17] members, and a mass without a survey row is a build error.
- The REV C and REV D prose above survives only here: `city-scene.mjs` exports `REV = 'E'` and its `sub` carries no REV clause at all since the 2026-09-07 present-state copy pass, so the exported letter and the sub no longer disagree.
- Basis: `${PLATE.ref} @ ${PLATE.sha}` from `census-city.json` [origin/main @ 185d414, 2026-09-07]; the TEST LIGHT lane cites `census-shadow.json` at the same ref.

## Plant — SHEET 7B'S WORKING CITY IN THE ROUND (city-scene.mjs)

- **file** `generator/city-scene.mjs` (model `generator/city-glb.mjs`, plan `generator/city-plant.mjs`) · **id** `plant` · **current rev** B
- **subject line / lead** (resolved, present-state — not history):

> SHEET 7'S CENSUS CITY IN THE ROUND, AT WORK · 39 MEMBERS · 38 MASSED · EACH CROWNED BY A WORKING PLANT SIZED FROM ITS OWN CENSUS · 27 SPEC ANNEXES · 4 DISTRICTS · ONE GLTF BINARY · ONE CLIP RAISES IT FROM THE GROUND AND CROWNS IT, RAISE ⇄ GROUND · THE CAMERA ORBITS FREE AND TURNS TO THE FOUR TRUE DIAGONALS · A SECOND LANE RELIGHTS THE CITY FROM SHEET 7A'S FILED SHADOW PLATE

### REV A — 2026-10-03

**commit subject** (06431ae8):

> the city stands twice, measured and working

### REV B — 2026-10-04

**`sub` clause** (the record's own, the `sub` carrying no rev clause):

> REV B 2026-10-04: the working city in the round as one glTF binary in Google's model-viewer, every plant merged per material on its member's roof, at the maintainer's ask: "i think reworking the 3d working city as model viewer like this would be better than another forced isometric experience"

**Record notes**

- 2026-10-04, REV B: the working city is `app/public/models/plant.glb` (352,896 bytes, 17,310 triangles, 81 materials), the city's model with a `crown-<n>` node on every massed member's roof. `city-plant.mjs`'s `plantPlan()` is unchanged; `city-glb.mjs` lays each plan out as hexahedra — a box as itself, a pipe under radius 1.5 as a square bar, a stack or tank as two squares turned an eighth apart (an octagon), a dome as two turned frustums — merged into one primitive per material per crown (`plant-m`, `plant-p`, `plant-g`, `band-<tier>`, `lamp-on`, `lamp-off`) and shaded 0.78 → 1.0 foot to head by COLOR_0, the rails strips of `edge-plant`. The walls are opaque, like the city's. The EXT_mesh_gpu_instancing spike failed: three's GLTFLoader builds an InstancedMesh for which model-viewer 4.3.1's scene graph finds no primitive association, its variant bookkeeping throws, and the model never reveals; so the plant is merged, not instanced. Hover tints the member's frame, not its plant.
- 2026-10-03, REV A (06431ae8): `/plant` (`atlas.plant`, SHEET 7B · 3D) is the city with every massed member crowned by its working plant, the walls at 80% and caps at 88% with the frame drawn through them at 30%; one body in `city-scene.mjs` drew both sheets, the island's `plant` field the switch. Draw calls 575, 31,486 triangles.

## Notes on this record

- **What the build reads.** Only the `## ` sheet headings, the `### REV` subheads under them, and each rev's first `> ` quote block — or the one after a `resolved →` line. Everything else here is for readers; changing any of those three changes the published `/log`.
- **Verbatim, with its numbers.** A superseded figure stays inside the quote that names it — `1.9.0 · 12f · 1,325` (2A rev B), 535 then 590 then 586 `ci` nodes (3 / 3A / 12), 176,022 lines (8 rev C), 504 bytes of font lead (9 rev F), the rust ladder `R3 ≤41 · R4 >180` (7B rev B) — because a number only means something with the sentence that qualifies it.
- **Dates.** A rev is dated here when its own clause carries a date. Where it does not, "first in git" is the oldest commit under `diagrams/generator/` in which the clause text appears (`git log -S`), which is an upper bound on when the rev was drawn, not the rev date itself.
- **`REV X corrected`.** Sheet 3B carries one, `REV C corrected 2026-09-01`. `splitRevs()` in `chrome.mjs` allows the trailing ` corrected`, so it files as its own row in the revision table.
- **REV A is usually implicit.** A sheet's `sub` gains a clause only when it is revised, so the first printing goes unlettered on every plate whose clause list starts at B or later.
- **Sheets with no history at all:** 1i, 6, 12i, 14i — and A1, issued once at REV A.
- **What this record no longer carries.** Captions, plate lettering and source comments that only restated a rev clause have been dropped: git has the text, and the sheets are re-drafted freely. The ones kept name a figure or a decision that survives nowhere else — most of the REV prose paragraphs are in that class, having been cut from the generators by the 2026-09-07 present-state copy pass. Each sheet's **Record notes** fold in a second, independent read of the generator module; the commit attributions there were spot-checked against `git log`.
