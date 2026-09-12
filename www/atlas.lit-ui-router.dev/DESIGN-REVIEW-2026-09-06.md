# The Altitude Atlas — design review, 2026-09-06

A present-state memo. Section 1 is the direction. Sections 2–6 record the decisions as they stand today, stripped of the pre-fix measurements and the argument that led to them; a number survives here only if it is still the target. Section 7 is the triage ledger, and Status carries the open rows in full. Set history lives in `HISTORY.md` → `/log`; this file does not repeat it.

---

## 1. Guiding star

At its best this site reads like a bound set of construction documents for a piece of software: a title sheet, a numbered ascent of plates, and on every plate one drawing that carries the argument, with the writing subordinate to it and the ledger (title block, key, revisions) squared away in the corner where a drafter would put it. The pleasure of a drawing set is discipline — one measure, one lettering system, one line weight family, a lot of paper left blank — and the pleasure of *this* set is that every number on it was counted, so the chrome should feel metered rather than decorated. Right now the type system is settled and genuinely good; the weakness is that the chrome has not yet caught up to it. The plates are drawn at a size the page then shrinks; the prose runs as a single 2,300-pixel wall beside an empty column; the cover is a statistics table rather than a title sheet; the one thing on the site that moves, the city, is filed last.

Five principles to steer by:

1. **The plate is the page.** On a sheet the drawing sets the width; everything else fits around it. Nothing on the plate should render below ~8 px on a 1440 screen, and the chrome must never make the plate smaller than the drafter drew it without a reason.
2. **One measure, insets to the right.** Running text sits in a fixed column of 62–68ch. Everything that is not running text — key, title block, schedules, small figures, revisions — is an *inset* set against that column, not a second column that happens to be there.
3. **Air is composed, not left over.** Empty space is fine when it is a margin; it is a fault when it is a hole (the 1,660 px under the title block on every sheet). Recompose, never just de-collide — the user's own rule.
4. **Hierarchy through weight and size, not through more caps.** Six faces are already doing the work. Where things blur (rail, crumb, cover), the fix is a size step or a weight, not another tracked-caps line.
5. **Chrome in DIN, voice in Exhibition, one signature in the hand.** The roles are decided; hold them. The only role still leaking is DIN as *prose* (basis lines, sources, the city's info panel) — anything longer than a line belongs to Source Serif.

---

## 2. Type, role by role — settled

Six kit faces, five roles. All resolve on every host.

| role | face | where | size |
|---|---|---|---|
| display | Eaglefeather 700 | cover title, rail head, title-block PROJECT | 40–44 / 17 / 13.5 |
| title | Exhibition 700 | `.sheet-title`, card h3, about h2, SHEET TITLE | 24 / 15 / 19 / 13.5 |
| data | DIN 2014 400–700 | all chrome, plate lettering, tables | see below |
| prose | Source Serif Pro 400 / 400i | `.notes p`, `.gal-body p`, About, figcaption | 18 in notes, 15.5–16 elsewhere |
| code | Source Code Pro 400 | inline chips, `.cs-info h4` | 0.88em / 13 |
| hand | Eaglefeather Informal 400 | DRAWN BY, once | 16 |

Settled rules:

- **Tracking.** Exhibition is already wide-set: `.sheet-title` 0.06em at 24 px, 0.04em at 13.5–15 px (cards, title block). DIN keeps the heavier ledger tracking.
- **Two DIN small steps only.** Field labels 9.5 px / 0.16em (`.fld`, table `th`, stat `.k`); section kickers 10 px / 0.14em (`.rail-sec`, kicker, `.meta`). Nothing under 9.5.
- **The article.** Every FULL title keeps its article and draws it as `<sup class="art">the</sup>` — the data face at 0.6em of the title, lowercase, no tracking, `--ink-soft`, `line-height: 0`, and a no-break space of its own, so the heading still reads "the MEASURED CITY". Styled once in `chrome.mjs` (hence in `sheets/atlas.css`, hence on all three hosts); applied at RENDER by `articleTitle()` and its twins in `views.ts`/`prerender.ts` — the manifest titles stay frozen. The user's own answer, over both mock columns: "i kinda like the hwt catchwords sparingly but found myself converting `the` to a `<sup>` with .6em din-2014 font, lowercase". The RAIL strips the article instead. **HWT Catchwords ships in exactly ONE place** — the cover's `THE ALTITUDE ATLAS`, key `e` at the bench's cap-matched 1.08em, gated on a `document.fonts` check for a DECLARED `hwt-catchwords`; off the kit (the artifact) the same sup draws. Do not re-probe the kit's Exhibition for an alternative: it has no lowercase and no dlig/salt/swsh/smcp (measured 2026-09-06, identical 55.61-px advance under every feature), so a synthetic small-cap would be a fake.
- **DIN never sets prose.** The city basis, About SOURCES and `.provenance` are Source Serif 13.5/1.5 `--ink-soft` at 68ch. The city basis is **re-filed, not cut**: `fileBasisRevs()` splits the frozen string on the same ` REV <letter> ` seam `sheetSection()` uses and files each rev sentence under its own headline as prose. `din-2014-narrow` is reserved for plate schedule bodies if width is ever short — not for prose.
- **The code face is identity, not decoration.** `.cs-info h4` stays `--code` at 13 px because the heading is the member's verbatim package name (`@tools/lit-template-lint`), the same token the plates set as code; in `--data` it would read as a caption.
- **Chips** are `0.88em` with `0 3px` padding, a `--paper-2` fill and **no border** — a run of chips is a tint, not a row of boxes. `overflow-wrap: break-word`; `chipBreaks()` emits `<wbr>` after slashes (377 chips, all three hosts).
- Reserved and deliberately unused: Exhibition 400, `din-2014-narrow`, `p22-fllw-eaglefeather-sc` (the only legitimate small "THE" in the atlas *name*).

---

## 3. Layout — settled

- **Full width, no cap.** `.sheet { max-width: none }`; the sheet fills the content column at every viewport (the user reads on a 3008-px display). The plate takes `width: 100%; min-width: 1000px` and scrolls in its own wrap below that. Only running text keeps a ch measure. The type specimen is
under the same rule — the bench takes the content column whole, and its switcher groups wrap inside
their own boxes so a long run of knobs breaks rather than pushing the page sideways.
- **Notes are multi-column.** `column-count: calc((100cqw - var(--inset) - var(--inset-gap)) / 38rem)` on `.notes`, with `container-type: inline-size` on `.notes-grid` (`--inset: 352px`, `--inset-gap: 24px`). The container query must hang off an *ancestor* — an element's own container-type does not feed its own properties, and declared on `.notes` it resolves against the viewport and looks plausible while being wrong. Rounding down cannot satisfy both ends; round-to-nearest at **38rem** can: 4 / 3 / 2 columns at 3008 / 2560 / 1440, column widths 447–706 px across 1200–3400. Under 1180 the count is 1. Gap 44 px, `h3` at `column-span: all` up to 12.5 px with 18 px beneath it, paragraphs 18 px / 1.8 / 2em, no `max-width`. Letter-spacing left alone — at 18 px on a serif the size carries it, and 1 px of tracking on running prose reads as a caps treatment.
- **The inset strip** is 352 px (KEY, TITLE BLOCK, small figures) and is `position: sticky; top: 30px`, so it rides alongside whatever paragraph is on screen. That is what removes the hole as experienced.
- **Frame.** Sheet padding 32, inner border inset 12 at 1 px `--edge`. The ratio matters more than either number.
- **No blur.** `.sheet` carries `box-shadow: 0 1px 0 var(--edge)` only — paper on a light table does not cast a soft shadow.
- **Figure.** `.figure-wrap` margin `20px 0 14px`; the figcaption is flush-left on the prose column with a DIN "FIG. n —" lead, not centred.
- The two standalone interactive pages cap their notes cell at 878 px at every viewport, so they take the larger type and get no columns. That cap is the only thing keeping 1i, 12i, 14i and 2B off the full-width layout the rest of the set uses.

---

## 4. Cover and nav — settled

- The cover is a **title sheet**: Eaglefeather display title, motto on `.sheet-sub`, and the stamp (CLIENT · PLATES COUNTED) on its own `display: block` `.cover-sub .stamp` line in `--ink-faint`. The survey's language table and the thesis paragraphs live in About, which is the colophon.
- **Stat bar: `repeat(6, 1fr)` with a 1-px gap on an ink ground.** Three columns still left a cell half-empty at five items; six one-fraction cells do not. The three one-line facts (REPOSITORY · INSTRUMENTS · LATEST SHIPPED) take the top row at a third each, the two roster paragraphs (PUBLISHABLE PACKAGES · SHEETS) a half each below; `statBar` is ordered to match.
- **Cards** are `minmax(250px, 1fr)`, caption clamped to 3 lines, the verdict dropped (it lives on the sheet). **Each one now leads with a picture of its own plate** (T16): a 259 × 150 crop, drawn at build time by `generator/thumbs.mjs` and tracked under `app/public/thumbs/` — one WebP per theme, and only the theme's own file is ever fetched. The city card draws `cover.hero`, the SVG the cover already carries.
- **Payload rule: no three.js on `/`.** The cover's city is a build-time still (`cityHero()`); the scene loads only when its plate scrolls in on `/city`.
- **Nav is a bar, not a floating corner.** The crumb is a sticky 34-px strip spanning the content column: nav left, DOCS / GITHUB / FLAT SET / theme right. The themer is text buttons with an underline for the pressed state, not filled accent blocks.
- **Rail** at 240: the kicker is a link to lit-ui-router.dev, then the name, `INDEX · ABOUT` as one 10-px DIN line, then the sheets in Exhibition 700 / 12 px / `--ink` with the article stripped. The city is filed under 7B as `7·3D` — it is sheet 7's third plate.

---

## 5. Plates (SVG) — settled

- Lettering classes after the T39/T41 steps: `lbl` 11.5, `lbls` 10.5, `lblf` 10. T41's rule is **one class step per role, applied to what the plate is about and not to its footnotes**; a colour override (red) never comes with a size drop, so a head is never a size smaller than the head beside it. 12 and 14 now lead on `lbl` and are no longer the smallest-lettered in the set.
- Line weights are a settled family: `.sk` 1.3, `.sk2` 2, `.skf` 1, `.ska` 1.6.
- **Fit by span, not by extreme.** The city's vertical fit takes the SPAN (`baseH = (hiY − loY)/2`) with the frustum recentred on `midY`; taking `max |y|` about the ground centre makes a model that stands above that centre pay for its own height twice. Canvas 620 (860-px step 520). Width stays the fit's slack side by construction, so side air remains.
- **Any overlap probe must be CTM-aware.** `getBBox()` is blind to an element's own `transform`, so a rotated label reports its unrotated box. Map each label's four corners through its CTM into viewBox space and separate oriented boxes with SAT. The cytoscape lanes have no SVG plate at any host and are measured through `renderedBoundingBox({ includeLabels: true })` instead.
- Sheet 12's head band is lettered on the slant at −45° from the foot of its own column — the punchcard's own idiom, and the only arrangement whose clearance does not depend on name length (parallel heads sit 23 × cos45 = 16 px apart on the perpendicular).

---

## 6. Dark theme and responsive — settled

CYANO holds. Tokens: fill red `#D96C55`, with the salmon `#E38C6F` kept for hatch and strokes only so the chop keeps its Cherokee identity; `--paper-2: #0B1F3E` so the rail's active row, the stat bar and table heads keep their tint. Faint 9.5-px text is not a thing in either theme — the basis lines are Source Serif `--ink-soft`, which clears 3:1.

Breakpoints: **901–1180** gives a 56-px clipped rail with 240 px of inner width retained (every title keeps its accessible name), expanding on `:hover`/`:focus-within` by painting over the sheet without reflow. **≤ 900** collapses the rail to a 48-px header plus a disclosure. **≤ 720** the plate scrolls in its wrap with a right-edge fade and a DIN "SCROLL →". No horizontal overflow at any width.

---

## 7. Triage ledger

Severity: **P1** fix now · **P2** next pass · **P3** guiding star. Effort: S < 1 h, M half a day, L a day or more.

**Closed:** T1–T21, T23–T36, T38–T41, T47–T54.

**Moot:** T22 (`.revs` retired with the copy re-draft; history is `HISTORY.md` → `/log`), T42 (trigger removed by T1), T43 T44 T45 (kit faces reserved by design; the cover's article is HWT + `sup.art`).

**Open:**

| id | sev | issue | effort |
|---|---|---|---|
| T37 | P2 | `.gal-body p` measure is fixed at 72ch but still flush-left, with no col 9–12 insets; subsumed by T46 | S |
| T46 | P3 | 12-column model with feature insets — figures/tables floated into cols 9–12 beside the citing paragraph | L |
| T55 | P3 | the city orbits on one axis; no elevation, no pan, no momentum — the snow-globe camera | L |
| T56 | P2 | the atlas as the dogfooding surface: version floor, SSR findings, the Effect companion's first draft | M |

---

## Status

- **2026-09-06** — P1 pass (b1c0942) and P2 pass (cf45bb0) closed T1 T2 T3 T4 T5 T6 T8 T9 T10 T11 T12 T13 T14 T15 T17 T18 T19 T20 T21 T23 T24 T25 T26 T27 T29 T30 T31 T32 T33 T34 T35 T36 T38 T39 T47 T48 T49 T50 T51.
- **2026-09-07** — copy re-draft (6e92017); T22 retired as moot.
- **2026-09-10** — T7 (`chipBreaks()` in `chrome.mjs`, wired into `page()` and into `emit-app.mjs`'s `linkRefs` + cover fields — 377 slash-bearing chips, all three hosts) and T28 (the 901–1180 band in `www/atlas.lit-ui-router.dev/app/index.html`). **T52 landed**: the notes column became a container-query multi-column block — see §3 for the model and the container-type trap. Sheet 7 at 3008 went from one 569-px column 1,491 px tall to four filled columns 656 px tall, and 21 of 23 sheets roughly halve at 2560. Sticky keyblock verified unaffected at 1440, 2560 and 3008.
- **2026-09-11** — **T40 and T41 landed.** The per-sheet box backlog (3A 33, 2A 6, 1 5, 14 3, 4 3, 5 3, 10 2) and the seven overlaps blamed on T39's lettering step were a **`getBBox` rotation artifact**: the probe was transform-blind, so every rotated label reported its unrotated box. A CTM-aware probe read **0 overlaps and 0 out-of-viewBox on all 21 static plates at HEAD, before any edit**; sheets 5 and A1 needed nothing and were not touched. The lesson: a rotated label is a normal thing on these plates, and any future census measured with the old probe will chase ghosts again — retire it or port it onto the CTM (later the same day: neither probe was ever checked in — both were one-shot scripts, so there was nothing to retire; the build-path guard is T53's silhouette assertion). What remained was the design half of T40 — sheet 12's head band recomposed on the slant (§5), with the stage brackets, plate top, band caption and right annotation column moved to suit — and the whole of T41's one-class-step relettering on 12 and 14. The four cytoscape twins were measured through `renderedBoundingBox` and turned up one real defect: 14i's tier band heads sat 28 px above the first station in their band, so `BANDGAP` is now 44. Final: 1i 0/22 labels, 2B 0/19, 12i 0/89, 14i 0/75.
- **2026-09-11, later** — **ranks 1–3 of the backlog landed in one pass.** T56's floor: `www/atlas.lit-ui-router.dev/app` on `lit-ui-router@^1.12.0` (the app carried no #723-era workaround to strip). T53: `assertPlots()` in `iso-hidden.mjs`, wired into every plate that hand-places a census-sized footprint (3, 3B, 7, 7A, 7B, 9, 10, 11, 13); 15 → x 300 and 32 → x 440 on sheets 7 and 13 — sheet 13 keeps its own `PLACED` and carried the same overlap unnoticed. T54: `generator/labels.mjs` is the one vocabulary, `assertLabels()` gates the manifest, and the app's cover gained the key index with filter state in the route. Also: `build.mjs` writes `www/atlas.lit-ui-router.dev/README.md`, and had been silently reverting the hand-written runbook since the 2026-09-11 compaction; the emitter now carries that text.
- **2026-09-11, the cabinet refresh** — all 17 plates re-run at `origin/main` @ 65e2843, with three new members (`@tools/bootstrap`, `@tools/eslint`, `@tools/repo-checks`) through the five hand tables and `docs` renamed `@www/lit-ui-router.dev`. **T16-adjacent card work landed**: the four keys are drawn on each card as a mini title block instead of uniform kv chips, the card is restructured as an `<article>` with one stretched primary link and an overlay rather than nested anchors, and the card lists are keyed by id (a client-side filter had been leaving `uiSrefActive` stale). **The article “the” is unified** — one rule set in `chrome.mjs`, the HWT catchword on the kit host over a baseline 0.8em fallback, the 0.6em superior retired, applied to the cover title, the rail head and every sheet's header line and PROJECT field. **A1's reference strip is drawn**: six fair-use thumbnails inlined as data URIs, the set's only rasters and its one exception to the no-images rule.
- **2026-09-11, the article unwound** — the unified rule did not survive review: the rail's article head and ditto column were rejected outright ("i don't like the sidebar edit at all"), and the name settled as **two variants**: the condensed wordmark (catchword `the` at a 24px floor, then ALTITUDE ATLAS in the data face) on the sheet header line and the title block's PROJECT field, and the full uppercase THE ALTITUDE ATLAS in the display face on the rail head and the cover title. Sheet titles and cards keep the 0.6em superior; the title block's SHEET TITLE is the one place `the` sits inline at the title's size. The catchword guard still ships in every page because the flat set's header line needs it.
- **2026-09-11, the wordmark's face** — the condensed mark's name is Eaglefeather everywhere ("eaglefeather for altitude atlas everywhere in block and project title"): `.mark` at 1.06em rides on `PROJECT_MARK` itself, so the header line, the block's PROJECT field and the interactive plates' heads agree without per-site rules; only the "— DRAWING SET" tail is ledger DIN. Catchword adopted at the user's devtools values, 20px and `vertical-align: sub`. A stale-stylesheet trap surfaced on the Version 25 deploy (fixed URL, four-hour cache, renamed markup underneath) and is closed by a content-hash query on the routed pages' `atlas.css` link at stage time.

### T53 — buildings 15 and 32 overlap (P2, new)

Buildings 15 (`@tools/build_and_test`, x = 330) and 32 (`@tools/embed-heights`, x = 430) overlap on
the city sheets. Diagnosed: there is no plot allocator. `sheet7.mjs`'s `PLACED` array carries a
hand-written x/y per member, but the footprint drawn at that point is data-driven — side ∝ √sloc,
with a hatched annex ∝ √specSloc set `AG = 10` beyond it, and the isometric projection widens each
square's silhouette by about √3. Member 15 now measures 1128 src sloc against 1163 spec sloc, so its
block *and* an annex slightly larger than the block have to fit inside the 100 units to its
neighbour, and they no longer do. Member 32 is small (336 / 33) and did not move; 15 grew into it.

So it is not a sprite bug and nothing is resolving to the same slot — a census refresh walked a
fixed coordinate into its neighbour. That makes it the same class of problem as T40: hand-placed
lettering and hand-placed geometry both silently rot as the data behind them grows. Two ways out,
and the choice is a design call, not a repair:

- give the district a real allocator that packs from the measured silhouettes, so no coordinate is
  ever hand-held against live data again; or
- keep the hand placement (it is deliberate — the districts read as a site plan) and add a
  build-time assertion that fails when two silhouettes intersect, so the drawing cannot ship
  overlapped and the coordinate gets re-composed by hand when the census moves it.

The second is cheaper and fits the set's existing "one basis, computed, never guessed" posture — the
atlas already throws on a missing member. Worth pairing with the T40 probe: that census measures
`<text>` only, which is exactly why this went unseen.

**Landed 2026-09-11 — the second way.** `assertPlots(sheet, plots)` in `iso-hidden.mjs` tests the
drawn ground rects (block and annex separately) for strict intersection and throws naming the sheet,
both members, both parts and the overlap in units. Ground rects are the right test because every
projection in use is affine and invertible, so two footprints intersect on the plate exactly when
they intersect in plan; what a tall mass hides above ground is occlusion, drawn on purpose. Wired
module-level in the nine plates that hand-place a census-sized footprint (sheet 8 packs, so it
needs none). Before the fix it read `15 annex [393.7 429.6 → 448.3 484.2] intersects 32 block
[430.0 430.0 → 459.3 459.3] by 18.3 × 29.3`. Recomposed for air, not to the minimum: 15 slid west
into the 56 units it had free on that side (330 → 300) and 32 stepped east (430 → 440), both still on
the works row at y 430, so the tools district keeps its three site-plan rows and its east edge moves
1 unit. Sheet 13 carries its own `PLACED` and had the same overlap; both tables moved together.
Nearest remaining pair is 20's annex against 21's block at 0.7 units — passes, but it is the pair a
clearance floor would catch first. The `collide-flat` probe this row proposed retiring never
existed in the tree (see the T40 status line).

### T54 — the FORM field wants to be a tag index (P2, new)

The FORM value repeats across the set — many sheets are the same kind of drawing and say so in prose
that has to be read one sheet at a time. Catalogue it: make FORM (and the other title-block fields
that repeat) structured key/value labels in the k8s sense, emitted from one vocabulary rather than
typed per sheet, then index them and let the routed app's cards filter by tag. The pattern is
emergent, not designed up front — read what the 23 sheets already say in FORM and let the label set
fall out of that, rather than inventing a taxonomy and fitting sheets to it.

Note the cover INDEX already carries FORM as a column, so the vocabulary has one existing home and
`build.mjs`'s `verdicts` array is where it is spelled today.

**Audit, 2026-09-11.** Every one of the 24 FORM values is unique as a string, so "FORM repeats" is
false at the value level and true at the word level — the premise holds, one level down. The words
that repeat:

| word | sheets |
|---|---|
| CITY | 8 |
| INTERACTIVE · COUPLING · GRAPH · ISO/ISOMETRIC | 3 each |
| REGISTER · CIRCUIT · PLAN | 2 each |

So FORM is a compound of orthogonal keys written as one phrase, and the label set falls straight out
of splitting it:

- **subject** — city, register, circuit, coupling, spine, map, quarters, sample
- **projection** — isometric, plan, schematic, chart, graph, section (CORE SAMPLE)
- **mode** — interactive or static (the three INTERACTIVE sheets plus the cytoscape twins)
- **basis** — the qualifier the eight cities carry: working, shipped, measured, delivered, bundled,
  isometric, isometric graph — what the same city is counted on

Nothing here is invented; every value above is already on a sheet.

**Indices follow the key's type, not one table for all.** The cover INDEX works because ALTITUDE is
an ordinal — one ordered list is its right index. The other keys are not ordinals: mode is a boolean
and wants a toggle; subject is a small enum and wants a grouped index (the eight cities together,
the two registers together); basis is only meaningful within the city group. So the resolution is
one index per key, each shaped to its key, with the general key/value filter on the cards as the
fallback for combinations. FORM stays on the title block as the readable phrase; the keys are what
the app indexes. Direction from the user, 2026-09-11: "separate indices for special keys".

**Landed 2026-09-11.** `generator/labels.mjs` holds the vocabulary and every plate's key set;
`assertLabels()` runs inside `emitApp()` and throws on an unlabelled plate, a value outside the
vocabulary, a vocabulary value no plate uses, a non-city with `basis` or a city without one, and a
`mode` that disagrees with how the plate is actually drawn. The keys ride the manifest to the app
(and sit as chips under the FORM phrase in the cover INDEX's cell, columns untouched). The app's
cover gained a KEY INDEX between the ascent heading and the cards: one row per key with faceted
counts — `mode` as the toggle, `subject` and `projection` as grouped chips, `basis` drawn only
inside the city group — and a `key=value` box as the fallback. Every chip is a `uiSref` and marks
itself active from the filter it already holds; the filter is five nullable params on `atlas.gallery`
(`/?subject&projection&mode&basis&kv`), so `/?subject=city&basis=measured` is a link, the
unfiltered cover has no query string and stays the prerendered page, and the static twin degrades
to plain hrefs and a GET form. Where the landing read differently from the audit: four subjects
came off the title or ALTITUDE rather than FORM (`pipeline` 14/14i, `space` 5, `survey` 7A,
`sprite` A1); sheet 2 files under `coupling` with 2A/2B/3A; sheet 12 is `chart`, as its own note
argues; the 3D plate's basis is `real 3d isometric`; and the params are not `dynamic` — a filter
change re-enters the state, which is what redraws the view. Facets today: subject city 8 ·
coupling 4 · circuit/pipeline/register 2; projection isometric 13 · graph 5 · plan 3 · chart 2;
mode static 20 · interactive 5. **Consumer finding, from the first screenshot pass:** a hard load of
`/?subject=city` landed on the unfiltered gallery with the query erased, while chip clicks filtered
correctly. Cause, reproduced against bare `@uirouter/core`: `urlService.rules.initial({ state })`
matches the path alone and targets the state with NO params, and it wins the first sync over the
state's own url rule. The function form — `initial((_m, url) => ({ state, params: url.search }))` —
hands the search through. Recorded in `router.ts` beside the navigation-plugin finding; filed as #815
(docs, this repo); the core report waits behind the #25 outreach.

### T55 — the city's second camera axis, and pan (P3, new)

Sheet 7's 3D city orbits on ONE axis. `city-scene.mjs` fixes elevation at `atan(1/√2) ≈ 35.264°`
(`var EL`, no input reaches it), leaves azimuth free under a horizontal drag, and eases onto the
nearest of 45/135/225/315 on release. Zoom is orthographic scale, 0.45–4, wheel only — not a dolly.
There is no pan: the camera target never translates. `touch-action: pan-y` reserves the vertical
drag for page scroll.

Nothing tracks freeing the second axis. I8 in `INITIATIVES.md` is the closest entry and is NOT this:
it is the PIPELINE graph's 3D lane (CSS tilt over I7's cytoscape, three.js as a stretch). Worth
noting the inversion — the city scene already did the three.js isometric work I8 describes as a
stretch, so I8 should reuse it rather than re-derive it.

Three separable pieces, in dependency order:

- **Elevation.** Not a symmetric follow-on to azimuth. True isometric IS elevation = atan(1/√2), and
  the plate's BASIS text asserts exactly that. Free it and the view is isometric only at rest, so
  the snap has to become two-dimensional — azimuth to the nearest diagonal AND elevation home.
  Decide first whether sheet 7's city is an isometric drawing that can be nudged, or a 3D viewer
  that happens to rest at isometric. The answer picks the interaction.
- **Pan.** Orthogonal to both axes and cheap in isolation, but needs a bounded target — unbounded
  pan loses the city with no way back — and a re-centre affordance. The natural bound is the same
  all-four-diagonal fit the camera already computes at init.
- **Gestures.** The blocker both share on touch. `pan-y` spends the vertical drag on page scroll, so
  elevation and pan have no gesture left. Options: a modifier on desktop and an explicit mode toggle
  on touch, or a two-finger drag (which then contends with the existing pinch-zoom path).

Keep the isometric snap in all cases — it is the sheet's signature and the reason the model reads as
a drawing rather than a scene.

**Direction (user, 2026-09-10): a snow globe, not a viewer.** Momentum plus a magnetic settle, so
the city has weight and rights itself. This resolves the elevation question above rather than
deferring it: if elevation has exactly one stable state and always returns to it, the plate's
isometric claim survives as PHYSICS — the angle stops being a constraint and becomes the rest state,
and a tilt is only ever borrowed.

Today's release is the opposite of momentum: a fixed 380ms cubic ease from wherever the pointer let
go (`glide`/`step`, `D.snapMs`), identical for a flick and a nudge, with no velocity carried off the
drag.

The model is a spring-damper per axis, not a tween:

    target = nearest detent
    omega += (-k * (angle - target) - c * omega) * dt
    angle += omega * dt
    on release: omega = angular velocity sampled from the last few moves

The two axes take DIFFERENT physics, and the difference is the point:

| axis | stable states | feel | target |
|---|---|---|---|
| azimuth | 4 diagonals | detent wheel — a fling passes several and settles in one | recomputed each frame as it moves |
| elevation | 1, atan(1/√2) | righting force — tip it, it falls back | constant |

So they must not share a snap function. Azimuth's live target is what gives a fling real detent
feel; elevation's is fixed.

**Touch: two localized control areas, not full-canvas drags** (user, 2026-09-10). The twin-stick
convention, with the note that this scene has no locomotion — so the left area is PAN, not movement:

| area | drives |
|---|---|
| right | orbit — azimuth + elevation |
| left | pan — translate the camera target |
| the rest of the canvas | unchanged: tap a mass to read it |

This dissolves the `pan-y` blocker rather than working around it. Localized areas mean the canvas
never claims the vertical drag, so the page stays scrollable and tap-to-select survives — the
conflict only existed while both axes were assumed to be full-canvas gestures. It also lands pan,
which was otherwise parked.

It composes with the spring instead of fighting it: a stick is VELOCITY input, so deflection feeds
omega directly, release re-centres the stick, and the damper settles into a detent. Same physics,
different source. Desktop keeps the direct drag, which is displacement input into the same omega.

Use the convention people already know — sticks that read as sticks. An earlier draft of this row
argued for drawing them as a jog dial and cross-slide in the key's line weights, on the grounds that
a game HUD would break the plate metaphor. That was wrong, and the correction is worth keeping
(user, 2026-09-10): **the sheets are a delivery medium, not a constraint on interaction. The
interactive plates are little web apps — states of UI.** The drawing register governs how a plate
PRESENTS; it does not govern how a control behaves. A learned control beats a bespoke one that
happens to match the paper, and matching the paper is not a reason to make an affordance stranger.

Style them to sit in the palette — the set's inks, weights and type — but do not reinvent the
affordance.

Open before building: whether a fling may cross more than one detent, and whether pan wants the
fit's bounds as a hard clamp or a sprung edge (a sprung edge is the snow-globe-consistent answer).
Reduced motion needs no new work: `reduce.matches` already cuts straight to rest and should keep
doing so, since momentum is motion.

### T56 — the atlas as the dogfooding surface (P2, new)

The atlas has two jobs, and the second outranks the drawing register: the sheets are a VISUAL THEME,
and the plates are web apps that should show the best of the web and dogfood this repo's own
inventions (user, 2026-09-10). Recorded so the showcase job has a backlog instead of a slogan.

**Already exercised, and better than the dependency list suggests.** `uiSref` ×22, `uiSrefActive`
×10, nested `ui-view` ×7, `resolve:` ×5, typed `params:`, a `Transition` hook — and three location
plugins chosen at runtime in `router.ts`: `navigationLocationPlugin` where the Navigation API
exists, `pushStateLocationPlugin` otherwise, `hashLocationPlugin` under the artifact host. That
third case is real dogfooding: the artifact's constraints forced a third location strategy and the
plugin architecture absorbed it, with a consumer finding written down in the source.

**SSR — the atlas got there first, because it had to.** It prerenders 29 pages and runs SSR probes
in its own build, which is the first place in this repo the server story has been exercised at all;
no example or sample app has tried it (user, 2026-09-10: "i hadn't really tried that yet with an
example or sample app yet ... the gap is starting to bridge"). Two things follow:

- The prerender lane is built on `ui-router-server` (`^0.1.1`; `prerender.ts` drives off
  `createServerRouter`) and renders with `@lit-labs/ssr` directly — the repo's first `@lit-labs/ssr`
  attempt, though not the first `ui-router-server` consumer (www/lit-ui-router.dev is).
- The build's third probe reports `the client ShellView (rail + nested ui-view): THREW TypeError:
  document.createDocumentFragment is not a function`. That is a FINDING, not noise:
  `document.createDocumentFragment()` is a FIELD INITIALISER in
  `packages/lit-ui-router/src/ui-view.ts`, so it fires before any lifecycle hook can guard it —
  which is why the app keeps two template sets and why #348's client-hydration seam cannot land over
  it. Filed 2026-09-11 as #803; the rest of `SSR-VERDICT.md`'s asks are #804–#808, #812 and #813 (with #564 and #750
  before).

**The Effect companion, not mobx — and the atlas writes its first draft.** An earlier draft of this
note proposed `lit-ui-router-mobx` for the sheet 7 city. The better fit is Effect (user,
2026-09-10). Mobx would only model observable state; the city's hard parts are lifecycle and
cancellation, which is Effect's actual argument. There is no `lit-ui-router-effect` package yet
(2026-09-11: the Effect work lives in the galaxy example and the sample-app lane), and that is the
point rather than a blocker: the atlas is the place that MOTIVATES the companion's API. The user is
learning Effect on a substantial UI as it is built, and every seam where the router's lifecycle and
Effect's scope have to meet is a note that becomes the package's API sketch and an ecosystem writeup
(user, 2026-09-11: "want a substantial ui to learn as i build, and inform the api of any companion
package, sharing the learnings with the ecosystem"). The galaxy example set the precedent — its
interrupt-on-`onStart` finding became a rule.

Concretely this makes T55 and the Effect lane ONE job: the snow-globe camera is built as Effect code
inside `www/atlas.lit-ui-router.dev/app`, and its spring integrator is the fifth row of the table below — a long-lived
fiber that a route exit must interrupt cleanly. The city's parts, in the Effect vocabulary:

| the city already does | the Effect concept |
|---|---|
| three.js imported only when the plate scrolls in; renders on demand | scoped acquire / release |
| route exit while a large module is still loading | interruption, not a cleanup flag |
| TEST LIGHT as a second material lane over the same geometry | a switchable effect over a shared scope |
| hover raycast → reading panel | a stream, panel as its latest value |
| T55's spring-damper camera, running between frames | a long-lived fiber, interrupted on route exit |

It also lands on a known trap from the Effect work: interrupt on a superseding `onStart`, not
`onCreate`. A routed 3D scene is exactly where that bites.

**Version floor — done 2026-09-11.** `www/atlas.lit-ui-router.dev/app` pins `lit-ui-router: ^1.12.0`, so the atlas
runs the ui-view config identity gate (#755) — routed elements are no longer rebuilt on every
update, which matters most on the city and register plates. The app carried no #723-era workaround
to strip; its only `requestAnimationFrame` calls are the city's own render loop.

**Later.** When `srefHref` (#689) lands, the atlas's 22 `uiSref` call sites are its natural first
consumer. When a release carries #803, drop the app's second template set and try real hydration.

### Backlog, ranked 2026-09-11

Everything still open, ordered by actionability × impact. Effort scale as §7. The first three rows
of the morning's ranking (T56 floor, T53, T54) landed the same day and are struck from the table.

| rank | row | what | effort | why here |
|---|---|---|---|---|
| 1 | T55 + T56 · Effect | snow-globe camera as Effect code; twin touch areas | L | the user's stated goal — the Effect learning lane and the companion API's first draft. Design converged; the two open calls are made (flings may cross detents, pan edge is sprung) |
| 2 | T46 / T37 | 12-column model with feature insets | L | P3; T52 took the pressure off the prose column |
| — | T56 · later | `srefHref` consumer; hydration over #803 | — | blocked on #689 and a release |

- **2026-09-11, evening — the move.** The atlas now lives at `www/atlas.lit-ui-router.dev/`, promoted out of `diagrams/` as an example that became a site (user's framing). Two rows join the ranking ahead of T16, because the Effect work should land in the atlas's final home rather than be uprooted after: **the merge** — one squash PR of this branch to main, user-reviewed — and **the Worker** — its own PR on main: a small Worker (trailing-slash tolerance on `/sheet/*`, the 404 shell at 404 status), a wrangler config, a site parameter on the shared build and deploy scripts plus one `npm ci` step for the app, a second Workers Builds project (account change, user's), the kit and GA ids as dashboard variables. Branch previews then replace the artifact as the review surface and the artifact lane retires. The deploy stays direct-upload Pages until then.

- **2026-09-11, night — T16, the pictures.** Every card on the cover leads with a 259 × 150 picture of its own plate, so the index reads as a drawing index rather than a wall of type. The mechanism is a RASTER step, `generator/thumbs.mjs`, and the choice was made on bytes: the set's first plates are 1,085,034 bytes of SVG (373,671 gzipped, 402,614 of it appendix A1's data-URI reference strip), against a cover that ships a 104 KB manifest — inlining them would have multiplied the cover's payload for a picture nobody has scrolled to yet. Instead the step photographs the flat set in headless Chromium (playwright, reached through `tools/embed-heights`; the lanes' cytoscape is served out of `app/node_modules`, so it needs no network), re-lays each plate at the card's own width, slices it to the card's ratio and writes `app/public/thumbs/<id>.webp` at 2× — 48 files, 709,666 bytes, tracked exactly as the fragments beside them are. `emit-app.mjs` refuses to write a manifest whose card has no picture, which costs a new plate one extra pass (build, thumbs, build) and is documented in the generated `README.md`. **Two themes, one fetch:** the plates letter in `currentColor` and the theme tokens, so a light crop on a cyanotype card is a lit rectangle; every plate is therefore shot twice and the card carries both `<img>`s, with the three-state rule from `chrome.mjs` showing one. A `display: none` lazy image is never requested — measured, not assumed — so the pair costs a single file, and this is why it is two images rather than a `<picture>`, whose `media` query cannot see a pinned `data-theme`. **Caveats.** The render is offline and the Adobe kit is domain-allow-listed, so the labels fall to the Google stand-in's own fallback; at a sixth of plate scale the lettering is texture and not type, and the decision was to keep the step offline rather than buy a difference nobody can read. The artifact pays the full price — `artifact.ts` bakes all 48 as data URIs and the single file goes 3,307,402 → 4,259,631 bytes (392 KB gzipped) — which the Workers move will retire along with the artifact lane. The window is centred by default, `xMidYMid slice` by layout; where that lands on a schedule rather than a drawing the plate takes a row in `thumbs.mjs`'s one `TUNING` table (`target`, `focus`), and thirteen plates already have one. Weak by default and worth a pass: 2B, 5, 6, 12i and 14i, whose lanes and charts are mostly ground at this size.

- **2026-09-11, night, later — the tuning pass.** That pass ran, and `TUNING` gained one more knob to carry it: `zoom`, which enlarges the target that many times before the 259 × 150 window is cut, so the card holds 1/zoom of the drawing and `x` finally bites. The enlargement is real and not an upscale, by a different mechanism on each kind of target — a plate is re-laid `259 × zoom` wide before the shot, while a lane is already drawn at the 1400 px stage and so has its window narrowed into the canvas it already has. Seven ids took a row: 5, 6 and 13 as plate enlargements, 1i, 2B, 12i and 14i as lane windows (14i at `x` 0.78, which crops away the stranded basis cluster off to the left). Everything else is byte-identical — the knob is inert at 1 — and three scratch flags (`--only`, `--out`, `--tuning`) let a row be tried without touching a tracked picture.

- **2026-09-11, late — the loose ends.** Three small things the reviews had left lying, closed in one pass. **The KEY INDEX chips mark themselves.** `uiSrefActive` caches its status and recomputes it on a transition, but a chip's TARGET is rewritten by the render that transition causes, and the ALL chips' target — "the filter minus this key" — moves on every click; nothing recomputes once the new target registers, so a moved chip read one navigation behind, and the directive's target set, which only ever grows, could light it on a target it no longer has. At `/?projection=graph` the MODE and SUBJECT ALL chips counted 5 and drew unlit, then lit on the next unrelated click. The filter is already in hand at the render and says the answer outright: a value chip is on when the key holds it, ALL is on when the key holds nothing, and `aria-current` follows the class. The cards' key slots keep `uiSrefActive` — their targets are the plate's own fixed labels, which never move. **The type specimen fits.** Its fourteen TITLE ARTICLE buttons run 1,120 px intrinsic on a flex row that could not break, so the document scrolled sideways from 1400 down — 1,406 against a 1,400 viewport. A group wraps inside its own box now, the seams drawn on the buttons and pulled up a pixel so the last row's rule lands on the group's border, and the bench drops the centred 1240 cap no other page carries: 720 / 900 / 1180 / 1400 / 2560 / 3008 all measure `scrollWidth === clientWidth`, and the knobs keep their full labels, which are the specimen. **The wordmark's span is named.** `.mark` was the vocabulary's most generic name for the one thing it draws; it is `.project-mark`, after its emitter, in `chrome.mjs`'s rule and in `PROJECT_MARK` and the app's and the prerender's twins. No other rule reached for it, the 23 tracked sheets and `atlas.css` carry the rename by regeneration, and the plates' pictures are byte-identical — the markup moved, the pixels did not.

- **2026-09-12 — the fifth cabinet, 1.13.0.** Every plate re-pinned from `origin/main` @ 65e2843 to @ 2ac53a0: the 1.13.0 release (f37cd04), #821's late-upgrade fix and #823's examples pin bump. The set's headline numbers move the way a healthy week moves them — 695 tracked paths and 52,768 sloc on the cover (from 688 / 51,913), 242 authored files and 109 spec files on sheet 7, the spec annex carrying most of the growth; 51.1% of metered source lit on 7A; 1,567 register edges over an unchanged 660 nodes; 120,630 gz in the bundle; four of sixteen doors re-priced, all of them lit-ui-router's. **The refresh was a test of the guards, and they held.** `census-loop.mjs` refused to file, naming the exact line #821 had moved, and the answer was to relocate 41 citations and re-text one expectation — the seek is inside `seekRouter()` now — not to widen a single `expect`. `census-mass3b.mjs`'s CITES and `census-shadow.mjs`'s e2e guard passed untouched, and `assertPlots` had nothing to catch because no member was born since the fourth cabinet, which made the new-member checklist a no-op for the first time. **Two hand-written figures were found lying and retired.** Sheet 10's chrome caption said "5× the router they document"; it was 4.81× at the last cabinet and 4.47× at this one, so it computes the ratio now and draws 4×. The cover's gallery paragraph said the sample app's `node_modules` is 297× the app it serves and that the machine is 22.5% of the bundle against the router's 3.9% — 300×, 22.3% and 4.2% on the current plates, and all three import from the sheets that measure them. The frozen "has grown" paragraph keeps the old three, which is the whole point of freezing a rev paragraph. **And the promotion had left one thread loose:** `basis.mjs`'s `ROOT` was still `../../`, correct under `diagrams/` and one directory short under `www/atlas.lit-ui-router.dev/`, so the first probe archived only the atlas's own tree and died on a missing `pnpm-workspace.yaml`. A sweep that renames a tree has to re-derive the URL-relative constants too, not only the literal paths.

- **2026-09-12 — the cards reveal their plate.** A cover card is its TEXT at rest — number line, title, scale, caption, meta, key block, in that order and at that type — and the plate answers the hand: on `:hover` and `:focus-within` the picture fills the whole card behind the type, and the text gathers onto a translucent paper panel floated 12 px in from the card's rule on three sides and stopped a line above its foot, hairline `--line` border, 38% paper over a 3 px backdrop blur (50% where the blur is unsupported). Both grounds are MIXED FROM `--paper`, so one rule reads cyanotype and vellum alike, and the dark thumbnail is the one the dark theme shows. Revealed, the caption reads two lines instead of three so the panel is shorter and more plate stands below it — and the line is not lost from the card: the body takes it back as padding and the panel's foot is pulled up by the same `--cap-line`, so the box the grid measures never changes. The two faintest lines, `.alt` and `.meta`, are mixed a step towards the ink while the plate is showing, which buys the legibility a denser panel would have cost. The picture COVERS rather than stacks — `.card-pic` is `inset: 0` and `object-fit: cover`, the city's hero SVG sized off the card's height and let run past its sides — so a card measures the same resting and revealed and the grid never moves under the pointer. The text lives in a new `.card-body` (`app/src/views.ts` and `app/prerender.ts` in step), which is what the panel is drawn against; because the body is the stretched link's containing block now, `.card-go::after` carries the card's own padding, negated, and the key block keeps its `z-index: 1` and stays clickable over the picture. Where there is no pointer — `@media (hover: none)` — there is nothing to answer, so the picture keeps its old place above the text, the panel never draws and the stretched link goes back to `inset: 0`. The 160 ms opacity transition is declared only under `prefers-reduced-motion: no-preference`.

- **2026-09-12 — the key block is an icon row, the index its legend.** A card's keys read as one line of small drawings: the subject's icon, the basis beside it as detail text where the plate is a city (`MEASURED`, `DELIVERED`, `REAL 3D ISOMETRIC`), the projection's glyph, and the lamp a plate that answers a pointer carries. The cells are hairline-separated in the title block's own idiom, they carry no field names and no words but the basis, and a key the plate does not hold draws nothing — absence is the value, so the row is as long as the plate is. Each cell is the filter link it was, `uiSref` and `uiSrefActive` intact, with the key and its value in `aria-label` and in `title` so a pointer names what it is over. **The legend is the index.** Every value chip in the cover's KEY INDEX draws the same symbol ahead of its word, which is what makes an unlabelled icon on a card readable: the block a reader filters with is the block that names the drawings. Only the values drawn nowhere stay words — the ALL chips, `static`, and the basis phrases inside the city group. **One sprite, no dependency.** `app/src/icons.ts` holds nineteen symbols and builds the inline `<symbol>` sprite that the app shell and the prerendered twin each emit once a page; a cell is `<svg class="gl"><use href="#ic-…">`, so nothing is fetched at runtime and no icon package is installed. Ten subjects and the mode lamp are Lucide line drawings (ISC), restroked onto the house's 16 viewBox through a `scale(2/3)` group at a stroke that lands on 1.3 beside the house's own; the six projection glyphs are unchanged; `register` and `spine` are drawn here — a punched card with a cut corner and two rows of holes, and a bar with three ribs each side — because no stock set has either. The register's holes are two rows rather than three: at 14 px a third row closes the grid into a solid block. Icons draw at 14 px on a card, 12 px in a chip, the basis detail at 10 px tracked 0.11em in the data face, everything on the theme tokens. The row takes a 70% paper ground so it still reads when the card's plate is revealed behind it, and the same component draws the plate pages' `.plate-data` keys, where it sits inline with the altitude and the plates read. The colophon credits Lucide.

- **2026-09-12 — the index filters in place.** A KEY INDEX chip re-enters `atlas.gallery` — the state is deliberately not `dynamic`, so a filter change is a re-render of the page the reader is already on — and the app now treats it as one: no `scrollTo({ top: 0 })` and no view transition. One predicate says so, `isIndexFilterChange(transition)` in `app/src/router.ts` (from and to both `atlas.gallery`), exported because ui-router's hook criteria can match a pair but cannot exclude one, so the slideshow's `onBefore` snapshot and its no-API fallback `onSuccess` test the same function's inverse rather than carrying a second copy of the rule. The scroll is held rather than merely left alone: a shorter filtered index can collapse the document and let the browser clamp `scrollTop`, so `holdScroll()` records `scrollY` and puts it back once lit has finished the `ui-view` swap — awaited on the hosts' own `updateComplete`, not on a timeout, and inlined in `router.ts` rather than reaching into `experimental/view-rendered.ts`, because nothing in `src/*.ts` may import from the experimental layer. `document.title` still updates on every transition. Measured at 1400 against the built `dist`: three chip clicks from `scrollY` 900 hold 900 with `startViewTransition` uncalled, while a card into `/sheet/1`, a rail link sheet to sheet and the rail's INDEX all land at 0 with the transition called once; with the API deleted the same chip click leaves `.content` without `atlas-enter`, which a gallery-to-sheet click still adds.

- **2026-09-12 — the cards are windows.** The cover's cards are a fixed stack again: the picture box across the head of the card at 259 × 150, then the number line, title, scale, a three-line caption, meta and the key row, in that order and at that size whether or not a pointer is on them. Hover and focus change exactly one thing — an opacity. Measured on the built `dist` at 1400: every descendant of all twenty-five cards, walked and compared rect by rect against itself hovered, moves by nothing. **The floating panel of the same day is retired.** It kept the box the GRID measured constant — the caption gave up its third line and the body took the line back as padding — but the type inside that box still reflowed and a panel still arrived under it, which is layout shift where a reader looks, and the user read it as exactly that. **The box is a window now.** It draws no ground of its own but a translucent tint, `color-mix(in oklab, var(--paper) 28%, transparent)`, and a 1 px `--line` rule at its foot; the card carries NO background at all, the paper having moved to `.card-body`, which is what makes the window a hole rather than a panel. The plate — both `<img>`s of the theme pair, and the city's inline hero SVG — sits in the window at `opacity: 0` and goes to 1 on `:hover` and `:focus-within`, 160 ms under `prefers-reduced-motion: no-preference`, so the tint sits under the drawing. Where there is no pointer to answer (`hover: none`), the plate stands in its window at rest. `.card-body` is no longer a containing block, so `.card-go::after` is back to `inset: 0`, and the key row keeps its `z-index: 1` and its clicks. **Behind the grid, one geometry.** `app/src/lattice.ts` defines `<atlas-lattice>`, which fills a `.cards-field` wrapper behind each card grid and draws a wireframe cube lattice on a canvas: orthographic, a yaw turning once about the vertical axis every 90 s under a 21° pitch — deliberately not the plates' 30° isometric, so the cover's space is not the drawings' space — 124 px footprint, 96 px rise, two levels of cubes, `--ink` at 22% alpha, 1 px, round joins, no fills. Hand-written projection, ~1,300 segments in one path per frame; no three.js and no new dependency, three still being loaded on demand for the city and nowhere else. **Seen only through the windows.** The clip is the trick: every frame clips to the union of the cards' `.card-pic` rects, so the lattice paints inside the windows and nowhere else — not in the 14 px gaps, not in the empty tracks of a short last row — and because it is ONE field in one set of coordinates, a line leaving one window enters the next on its true path, which is what makes the cards read as holes in a wall. **The canvas is one viewport tall**, sticky inside the field, so a grid four screens long costs a screen of pixels; the canvas's offset down the field is turned into a translation along the ground and taken modulo the cell, which lands on the same infinite lattice, so the picture is the field's and the cost is the viewport's. The loop stops when the tab is hidden and when the field leaves the viewport (`IntersectionObserver`); under `prefers-reduced-motion: reduce` it holds one angle, 37°, and redraws only when the scroll or the layout moves under it. The ink is read from the element's computed `color` and re-read on `data-theme` and on `prefers-color-scheme`, so both themes draw in their own line; the backing store is DPR-aware to 2×, and a `ResizeObserver` on the field plus a `MutationObserver` on the grid re-measure the windows when a filter or a reflow moves them. Prerendered, `<atlas-lattice>` is an inert unknown element and the window is its tint; the client defines the tag in `main.ts` and upgrades it, artifact build included.

- **2026-09-12 — the catchword is dropped.** The user's word, and the whole reason: "the catchword just isn't dialed in yet -- drop it everywhere". The CONDENSED wordmark is one mark on every host now — the `sup.art` superior article, the same 0.6em lowercase DIN the sheet titles have carried since T9, then ALTITUDE ATLAS in the display face at the measured 1.06em — and it needs no kit face, so the site, the flat set and the artifact draw it identically and the mark can no longer be one thing on the site and another in the artifact. Everything that made it two is gone: the HWT Catchwords key `e`, the `html[data-catchwords="on"] .cw::before` rule and the `.cw sup.art` rule that hid the superior under it, the `.cw` wrapper in all three `PROJECT_MARK` twins (`generator/chrome.mjs`, `app/src/views.ts`, `app/prerender.ts`), and the FontFaceSet guard in both its copies — `CATCHWORD_SCRIPT` and its emission from `page()`, and the inline twin in `app/index.html`. The 20 px flat on `vertical-align: sub`, tuned in the user's own devtools on 2026-09-11, was the last try; the 24 px floor before it and the 15 px floor before that were the earlier ones. **The study stays.** The type specimen's CATCHWORD rows are the lab record of a kit-only face with no GSUB and no Google stand-in, and they are left exactly as they are — the specimen is where a face is examined, not where it ships. The Adobe kit is untouched too: `stage-site.mjs` still injects `nzw4jnc` on every staged page, and `hwt-catchwords` is simply no longer asked for outside the specimen.

- **2026-09-12 — the city in the round is drawn on paper.** The user, plainly: "also i think it's time to make the isometric 3d city look more like the others with the walls and patterns and shading". The three.js plate had been the one drawing in the set that answered a gate tier with a TINT — semi-opaque walls lerped up to 62% toward the red — while every flat plate answers it with a hatch on a paper wall. It answers with the hatch now. `helpers.mjs`'s `isoBlock` is the rule, face for face: the cap takes the tier's own `capCls` fill (`--paper`, `--paper-2` for `report` and `off`, the red fill for `halt`), the left wall is flat `--paper-2`, and the right wall is a `--paper-2` stone under the tier's side hatch — `hx` for `line` and `report`, `ha` for `late`, `hr` for `pr` and `halt`, `hd` for the annexes — with `pr` and `late` taking sheet 7's roof wash onto the cap as well. The hue survives at 22% of its old pull, enough that the tiers still part across a plan of 35 masses and not enough to be read as the answer. **The hatch is screen-space, because the plate's is.** `patternUnits="userSpaceOnUse"` is not a detail of SVG: it is the reason a hatch on the flat set has one rake and one spacing everywhere, belonging to the sheet rather than to the face it fills. The honest translation is `gl_FragCoord`, so `chrome.mjs`'s four pattern defs are a stripe mixed into the fragment colour through an `onBeforeCompile` hook on the stock `MeshBasicMaterial` — stroke colour, alpha, rake and spacing as uniforms, one compiled program for the whole hooked family behind a `customProgramCacheKey`, the colours re-read from the tokens on every theme turn like every other colour on the plate. No texture is allocated, no UV is unwrapped and no dependency is added; measured on the shot it lays 5.98 device px across the rake where the defs ask for 6. **Severity is the rake, not the tint:** `hr` runs against the other three, so a gated mass is legible at a glance from any of the four diagonals and stays legible in the cyanotype theme, where a red tint on a dark ground never quite was. Faces are opaque now, so the model removes what stands behind a wall exactly as `iso-hidden.mjs` removes it flat, and the frames carry sheet 7's edge ladder by colour — red, accent, `--line`, soft, ink. The weight half of that ladder does not travel: a WebGL line is one pixel wide, and `Line2` would cost a fat-line dependency and a second geometry per frame to buy 0.3 px. It is filed as a gap, not paid for. The shadow lane takes 7A's own recipe in the same pass — the black wash at .38 with a `--ink` stripe at .30 over it, the stripe being what makes a flat shadow read as shadow rather than as grey.

- **2026-09-12 — the lattice sparser and slower, the text on a panel.** The user, on the day's own cards: "the index card animation is cool but too much. thinking sparser slower -- make the text always on translucent panel so it shows behind", and then "maybe dotted lines for the lattice too". **The field is halved and stilled.** `app/src/lattice.ts` keeps its two levels of cubes but draws them at a 220 px footprint and a 160 px rise, where it drew 124 and 96, so a card's window holds roughly a quarter of the lines it held; the ink drops from 22% to 16% alpha, and one turn about the vertical axis takes 240 s where it took 90 — slow enough that a reader who looks up from a caption finds the geometry moved without ever having seen it move. The pitch is unchanged at 21°, still deliberately off the plates' 30° isometric. **The line is dotted**, `setLineDash([1, 3])` at 1 px under a round cap, so each dash draws as a round point on a 4 px pitch; `lineDashOffset` is pinned at 0, so the phase belongs to the path and the dots never crawl frame to frame — they slide along a segment only as the turn lengthens or shortens it, which is the honest behaviour of a dotted line in a rotating projection. **The panel is the whole card, and it is translucent.** `.card-body` still carries the paper, but mixed: `color-mix(in oklab, var(--paper) 76%, transparent)`, and `--paper-2` at the same 76% when the card is hovered or is the current sheet's. The clip follows: every frame now clips to the union of the whole `.card` rects rather than the `.card-pic` rects, so one lattice runs under the window AND under the writing, unbroken across the rule between them. The gaps stay ground — nothing is painted in the 14 px between cards or in an empty track of a short last row — and the window keeps its lighter 28% tint, so it still reads as the thinner pane within the panel: the geometry is plain in the window and quiet behind the type, which is the difference the user asked for. **The writing keeps its contrast either theme.** Compositing the 76% panel over `--ground`, the caption at `--ink-soft` measures 5.36:1 in vellum and 6.24:1 in cyanotype (5.07 and 6.91 on the hovered `--paper-2` ground), and 5.03 / 5.64 where a lattice line at 16% ink runs under the letters — every case above the 4.5 the small type asks for. The key row's 70% paper ground is unchanged and its icons still read over the panel. **Nothing else moves.** Hover and focus remain one property, an opacity: every descendant of all twenty-five cards, walked and compared rect by rect on the built `dist` at 1400, measures identically hovered — no exceptions. The plate is `opacity: 0` at rest, 1 on hover and on focus-within, 1 at rest under `hover: none`; a key chip inside a hovered card still navigates to `/?subject=…`; `elementFromPoint` over a gap finds the grid, never the canvas; the loop still flattens when the field leaves the viewport, and under `prefers-reduced-motion: reduce` two frames six seconds apart are byte-identical while the moving pair differ.
