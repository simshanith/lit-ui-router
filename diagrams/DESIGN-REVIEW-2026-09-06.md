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

- **Full width, no cap.** `.sheet { max-width: none }`; the sheet fills the content column at every viewport (the user reads on a 3008-px display). The plate takes `width: 100%; min-width: 1000px` and scrolls in its own wrap below that. Only running text keeps a ch measure.
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
- **Cards** are `minmax(250px, 1fr)`, caption clamped to 3 lines, the verdict dropped (it lives on the sheet). Still no picture of the plate — T16.
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

**Closed:** T1–T15, T17–T21, T23–T36, T38–T41, T47–T54.

**Moot:** T22 (`.revs` retired with the copy re-draft; history is `HISTORY.md` → `/log`), T42 (trigger removed by T1), T43 T44 T45 (kit faces reserved by design; the cover's article is HWT + `sup.art`).

**Open:**

| id | sev | issue | effort |
|---|---|---|---|
| T16 | P3 | cards carry no picture of the plate — emit a 259 × 150 SVG crop or PNG per sheet at build | L |
| T37 | P2 | `.gal-body p` measure is fixed at 72ch but still flush-left, with no col 9–12 insets; subsumed by T46 | S |
| T46 | P3 | 12-column model with feature insets — figures/tables floated into cols 9–12 beside the citing paragraph | L |
| T55 | P3 | the city orbits on one axis; no elevation, no pan, no momentum — the snow-globe camera | L |
| T56 | P2 | the atlas as the dogfooding surface: version floor, SSR findings, the Effect companion's first draft | M |

---

## Status

- **2026-09-06** — P1 pass (b1c0942) and P2 pass (cf45bb0) closed T1 T2 T3 T4 T5 T6 T8 T9 T10 T11 T12 T13 T14 T15 T17 T18 T19 T20 T21 T23 T24 T25 T26 T27 T29 T30 T31 T32 T33 T34 T35 T36 T38 T39 T47 T48 T49 T50 T51.
- **2026-09-07** — copy re-draft (6e92017); T22 retired as moot.
- **2026-09-10** — T7 (`chipBreaks()` in `chrome.mjs`, wired into `page()` and into `emit-app.mjs`'s `linkRefs` + cover fields — 377 slash-bearing chips, all three hosts) and T28 (the 901–1180 band in `diagrams/app/index.html`). **T52 landed**: the notes column became a container-query multi-column block — see §3 for the model and the container-type trap. Sheet 7 at 3008 went from one 569-px column 1,491 px tall to four filled columns 656 px tall, and 21 of 23 sheets roughly halve at 2560. Sticky keyblock verified unaffected at 1440, 2560 and 3008.
- **2026-09-11** — **T40 and T41 landed.** The per-sheet box backlog (3A 33, 2A 6, 1 5, 14 3, 4 3, 5 3, 10 2) and the seven overlaps blamed on T39's lettering step were a **`getBBox` rotation artifact**: the probe was transform-blind, so every rotated label reported its unrotated box. A CTM-aware probe read **0 overlaps and 0 out-of-viewBox on all 21 static plates at HEAD, before any edit**; sheets 5 and A1 needed nothing and were not touched. The lesson: a rotated label is a normal thing on these plates, and any future census measured with the old probe will chase ghosts again — retire it or port it onto the CTM (later the same day: neither probe was ever checked in — both were one-shot scripts, so there was nothing to retire; the build-path guard is T53's silhouette assertion). What remained was the design half of T40 — sheet 12's head band recomposed on the slant (§5), with the stage brackets, plate top, band caption and right annotation column moved to suit — and the whole of T41's one-class-step relettering on 12 and 14. The four cytoscape twins were measured through `renderedBoundingBox` and turned up one real defect: 14i's tier band heads sat 28 px above the first station in their band, so `BANDGAP` is now 44. Final: 1i 0/22 labels, 2B 0/19, 12i 0/89, 14i 0/75.
- **2026-09-11, later** — **ranks 1–3 of the backlog landed in one pass.** T56's floor: `diagrams/app` on `lit-ui-router@^1.12.0` (the app carried no #723-era workaround to strip). T53: `assertPlots()` in `iso-hidden.mjs`, wired into every plate that hand-places a census-sized footprint (3, 3B, 7, 7A, 7B, 9, 10, 11, 13); 15 → x 300 and 32 → x 440 on sheets 7 and 13 — sheet 13 keeps its own `PLACED` and carried the same overlap unnoticed. T54: `generator/labels.mjs` is the one vocabulary, `assertLabels()` gates the manifest, and the app's cover gained the key index with filter state in the route. Also: `build.mjs` writes `diagrams/README.md`, and had been silently reverting the hand-written runbook since the 2026-09-11 compaction; the emitter now carries that text.

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
inside the city group — and a `key=value` box as the fallback. Every chip is `uiSref` +
`uiSrefActive`; the filter is five nullable params on `atlas.gallery`
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
hands the search through. Recorded in `router.ts` beside the navigation-plugin finding; it belongs in
the location-plugins guide.

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
  it. Filed 2026-09-11 as #803; the rest of `SSR-VERDICT.md`'s asks are #804–#808, #812 and #813 (with #564 and
  #750 before).

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
inside `diagrams/app`, and its spring integrator is the fifth row of the table below — a long-lived
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

**Version floor — done 2026-09-11.** `diagrams/app` pins `lit-ui-router: ^1.12.0`, so the atlas
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
| 2 | T16 | a picture of the plate on every card | L | cover scannability; no dependency, no urgency — and the cards now carry a key line, so the picture is the last thing they lack |
| 3 | T46 / T37 | 12-column model with feature insets | L | P3; T52 took the pressure off the prose column |
| — | T56 · later | `srefHref` consumer; hydration over #803 | — | blocked on #689 and a release |
