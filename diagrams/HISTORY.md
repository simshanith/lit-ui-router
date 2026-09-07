# The Altitude Atlas — revision history (frozen record)

This file is the **frozen revision record** of the drawing set: every `REV` clause, historical prose paragraph and rev-bearing plate callout the generators have carried, quoted verbatim from `diagrams/generator/*.mjs` at the ref this file was cut. The live sheet copy is free to be re-drafted to describe the **present state** only — the history lives here, and a history sheet or appendix may later be drawn from it.

Quoted text is the **source** text: template expressions (`${...}`) appear as written, with the value the build resolves them to given after `→` where it is not obvious. Line numbers are into the generator file named under each sheet.

---

## Cover — THE ALTITUDE ATLAS (build.mjs)

- **file** `diagrams/generator/build.mjs`

The cover carries no `sub` line and no REV of its own. Its history lives in two places: the roster rows in `SHEET_ROWS`, whose one-line verdicts pin *another sheet's* rev letter, and the "the set has grown since its first printing" paragraph, which is the set-level narrative of what changed and why.

### Roster verdicts that pin a sheet revision (verbatim source)

`build.mjs:114`

> ```
> ['3', 'MONOREPO', 'ISOMETRIC CITY', 'the yard re-massed from sloc × files — gate severity in colour: the smallest blocks stop the line (REV D: the task-manager inset reads the plates too, so it can no longer disagree with 3A)'],
> ```

`build.mjs:115`

> ```
> ['3A', 'TWO TASK MANAGERS', 'COUPLING SCHEMATIC', 'turbo caches mise — and the loop is a DAG in a loop costume: the 7 callers and the 7 called never touch (REV D: counts imported; mise unmoved a third time, turbo at 98 definitions in 17 files)'],
> ```

`build.mjs:116`

> ```
> ['3B', 'CI TASK GRAPH', 'ISOMETRIC GRAPH CITY', 'footprint = watched files, height = command sloc — most blocks are one-line pads (REV E: #693 re-platted the root yard); the tallest is the 401-sloc //#lint:elements spire'],
> ```

`build.mjs:120`

> ```
> ['7', 'MONOREPO, MEASURED', 'MEASURED CITY', 'the census with districts and roads — tests as annexes, every edge cited: the 8-line harness stops every PR (REV E: 32 members recounted on the scc ruler)'],
> ```

`build.mjs:121`

> ```
> ['7A', 'MONOREPO, TESTED', 'SHADOW PLAN', `the shadow survey — the tests are the light: where a suite reaches it burns near-full (REV E: RE-METERED, ${SURVEY_META.metered} members under their own suites' meters at ${SURVEY_META.sha}, so the light and the census are one measurement and the daggers retire)`],
> ```

`build.mjs:122`

> ```
> ['7B', 'MONOREPO, RUNNING', 'WORKING CITY', 'the synthesis plate — rust, steam, lamps and pipes on one city: every pipe connects, the flagship runs old AND hot, and rev B’s one alarm — which rang over the drawings themselves — is drawn struck through, answered by ffd4ef7'],
> ```

`build.mjs:124`

> ```
> ['9', 'ONE DEPLOY', 'SHIPPED CITY', 'the wire survey — Dickens outweighs the code, and at REV F the prose pages overtook the fonts'],
> ```

`build.mjs:126`

> ```
> ['11', 'FIVE PACKAGES', 'ENTRY QUARTERS', 'the split view — sixteen doors priced alone; fifteen of them reprobe byte-identical at REV D'],
> ```

`build.mjs:127`

> ```
> ['12', 'PR CI GRAPH', 'REGISTER PLATE', 'the punched inventory — 70% of the graph runs nothing, and at REV D real→real edges fell a quarter while the node count barely moved'],
> ```

### The set-level history paragraph (verbatim source)

`build.mjs:268`

> <p>The set has grown since its first printing. Sheet 1 is now REV C — first staged isometric at the client's ask, then given one deliberate metaphor break: the document is drawn the way Firefox's old Tilt inspector drew it, a browser window whose DOM rises as stacked plates. Sheets 7–10 are a survey quartet: what we wrote (the monorepo by mass), what npm delivered (the sample app's <code>node_modules</code>, 297× the app it serves), what the browser downloads (the docs deploy on the wire — where the prose and the fonts outweigh every line of code — the demo corpora that once towered over both left the deploy at rev G), and who actually occupies the bytes after tree-shaking (one bundle opened up — the machine the router wraps is 22.5% of the wire; the router itself, 3.9%). The set has already changed its own subject twice: sheet 8's rev A drew lodash as the tallest building in the delivered city, and that drawing became a merged <code>lodash-es</code> swap — the building halved, the wire chunk cut 84%; then sheet 10's first printing drew two complete lit majors riding in every app, and that drawing became the merged single-lit + lazy api-viewer dedupe (#618). Sheets 8, 9 and 10 have each been remeasured after the merge they argued for; sheet 11 cuts the same wire the other way — five package quarters, sixteen doors, each priced alone. Sheet 12 leaves the wire entirely and draws the monorepo as its own CI reads it: the pull-request task graph punched onto a register plate, where two thirds of the holes turn out to be scaffolding. Sheet 14 turns the instrument on itself: the census pipeline that produced almost every number in this set, drawn as a flow of archive → probe stations → filed plates → drawings, and introspected from the generator at build time rather than described by hand.</p>



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV — (no lettered revision history; the cover narrates change in running prose only)

**Basis (stated): origin/main @ 185d414, counted 2026-09-07 (`COUNTED_AT`/`COUNTED_ON`, from `diagrams/data/census-files.json`; city + shadow plates at the same sha)**

**Present-state sentences that carry history** (re-draft candidates):

**`diagrams/generator/build.mjs` — `galBody` ¶3, the "has grown" paragraph (first written 987f909 2026-08-17; last touched cf45bb0 2026-09-07)**
- prose ¶: "The set has grown since its first printing. Sheet 1 is now REV C — first staged isometric at the client's ask, then given one deliberate metaphor break: the document is drawn the way Firefox's old Tilt inspector drew it, a browser window whose DOM rises as stacked plates."
- prose ¶ (corpora clause): "…what the browser downloads (the docs deploy on the wire — where the prose and the fonts outweigh every line of code — the demo corpora that once towered over both left the deploy at rev G)…"
- prose ¶ (subject-change clause): "The set has already changed its own subject twice: sheet 8's rev A drew lodash as the tallest building in the delivered city, and that drawing became a merged `lodash-es` swap — the building halved, the wire chunk cut 84%; then sheet 10's first printing drew two complete lit majors riding in every app, and that drawing became the merged single-lit + lazy api-viewer dedupe (#618). Sheets 8, 9 and 10 have each been remeasured after the merge they argued for"
- pinned numbers: 297× (node_modules over the app), 22.5% / 3.9% (sheet 10 wire shares), 84% (chunk cut), #618
**`build.mjs` — `statBar`**
- PUBLISHABLE PACKAGES: "…— the eslint plugin joined 2026-09-02, after sheets 1–13 were first drawn"
- SHEETS: "14 altitudes · ${PLATES} plates · drawn 2026-08-16–17 · the survey office added 2026-09-03 · whole plate cabinet re-counted at ${COUNTED_AT} [origin/main @ 185d414]"
**`build.mjs` — `provenance`** (also rendered by the app's About via `manifest.cover.provenance`)
- "eslint-plugin-lit-ui-router graduated to packages/ on 2026-09-02, after sheets 1–13 were first drawn; the plates count it and sheets 2, 4, 7, 7A, 7B, 11, 12 and 13 draw or schedule it"
- "every plate in diagrams/data/ re-counted at ${COUNTED_AT} [origin/main @ 185d414] in one pass — plate 7A's test light included, re-metered at that ref"
**`build.mjs` — `GEN_NOTES`** (README + app About via `manifest.cover.notes`)
- "Since 2026-09-06 every label on the plates draws in the data face (DIN 2014, Barlow Semi Condensed off the kit) rather than the system monospace; mono is reserved for code."
- "Generated 2026-08-16 by Fable (Claude, AI)."
- "Every plate in `data/` — versions, dates and all — was re-counted at ${COUNTED_AT} [origin/main @ 185d414] in one pass, plate 7A's test light included"
**`build.mjs` — index `sub` lines whose frozen REV clauses narrate change on the cover's index table**
- 3: "(REV D: the task-manager inset reads the plates too, so it can no longer disagree with 3A)"
- 3A: "(REV D: counts imported; mise unmoved a third time, turbo at 98 definitions in 17 files)"
- 3B: "(REV E: #693 re-platted the root yard); the tallest is the 401-sloc //#lint:elements spire"
- 7: "(REV E: 32 members recounted on the scc ruler)"
- 7A: "(REV E: RE-METERED, ${SURVEY_META.metered} [17] members under their own suites' meters at ${SURVEY_META.sha} [185d414], so the light and the census are one measurement and the daggers retire)"
- 7B: "rev B's one alarm — which rang over the drawings themselves — is drawn struck through, answered by ffd4ef7"
- 9: "the wire survey — Dickens outweighs the code, and at REV F the prose pages overtook the fonts"
- 11: "sixteen doors priced alone; fifteen of them reprobe byte-identical at REV D"
- 12: "at REV D real→real edges fell a quarter while the node count barely moved"
**`diagrams/generator/chrome.mjs`** — no page-facing history copy; two dated source comments and the freeze rule
- "--code … Source Code Pro on BOTH hosts (2026-09-06) … Since 2026-09-06 the PLATES draw in --data too (see text.lbl* below): mono is reserved for code, and --mono survives only as the tail of this stack."
- ":root { /* the system stack; since 2026-09-06 nothing reads it but --code's tail */"
- `splitRevs` doc: "The strings themselves are FROZEN — each sheet's `sub` is written once, at the revision it records, and never edited."
**`diagrams/generator/emit-app.mjs`** — no narrative copy; derives the issue log from frozen subs
- "Every REV a sheet's frozen sub line records is one issue of the set. The cover lists them latest first; an entry carries the rev's first clause and links to the sheet, where the full revision block is filed."
**`diagrams/app/src/views.ts` — About (`AboutView`), "THE ISSUE LOG"**
- "Every REV across every plate — the set's own revision record, latest first — is at /log. It rode the cover's right-hand column until 2026-09-06, where it pushed the sheet index off the first screen; a drawing set's issue record earns a sheet of its own once it outgrows the title sheet. Each sheet's own REVISIONS table still reads ascending, as a drawing's rev block does."
**`views.ts` — About, "THE FLAT SET"**
- "The same drawings as the standalone pages they were first published as — the gallery, the megacanvas and one page per sheet — are kept beside this app at /set/ as the version to compare against."
**`views.ts` — LogView `sheet-sub`**
- "EVERY REV ACROSS EVERY PLATE, LATEST FIRST — THE SET'S OWN REVISION RECORD · EACH SHEET'S REVISIONS TABLE READS THE OTHER WAY, ASCENDING, AS A DRAWING'S REV BLOCK DOES"
**`views.ts` — cover `cover-latest` band** — renders `manifest.issueLog[0]` inline: LATEST · date · head · REV letter · first clause → ISSUE LOG ↗ (no literal copy of its own)
**`views.ts` — dated source comments** (not page copy)
- l.24: "THE ARTICLE (T9, shipped 2026-09-06): a title keeps its THE, drawn as a…"
- l.211: "The set's issue record: its own state since 2026-09-06, not a cover column."
**`diagrams/app/index.html`** — no history-bearing page copy; its dated text is all HTML comments about the Adobe-kit / Google-stand-in font split.

## Sheet 1 — THE RENDER LOOP

- **file** `diagrams/generator/sheet1.mjs` · **id** `package` · **current rev** G
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 1 — lit-ui-router 1.11.2 · the client circuit

### REV D — undated in the copy; first in git 2026-08-16

**`sub` clause** (verbatim source):

> REV D: the loop routed on the iso grid

**other rev-bearing copy** (`sheet1.mjs:191`):

> ```
> caption: 'Rev D puts the loop on the ground: every leg is a road that turns along the iso axes and stops short of the wall it points at. The city still breaks its metaphor once, on purpose: the document is not a building — it is a browser window whose DOM rises in plates. The core matches, the hall runs its hook bays, Lit commits onto a layer, and a click on the topmost plate flies back to location.',
> ```

### REV E — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV E: the version reads census-files.json — 1.9.0 was a hand-typed relic

### REV F — 2026-09-06

**`sub` clause** (verbatim source):

> REV F 2026-09-06: fills — every block’s left face and the Tilt plates’ flanks now carry their paper-2 tint, and the right faces their hatch (a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); no geometry moved

### REV G — 2026-09-06

**`sub` clause** (verbatim source):

> REV G 2026-09-06: the five doors re-cut — each frame tightened to the DIN line it now carries (144 → 116 wide) and the strip hung on the right end of the footer rule, so the band reads title left, doors right instead of trailing 200px of empty paper



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV D — 2026-08-16 (b2f972f "docs: route sheet 1 arrows as iso roads and re-mass sheet 4 from sloc x files")
- REV E — 2026-09-03 (1ff332a "feat: census pipeline — sheets 1, 2A and 3 cite plates, last relic numbers retired")
- REV F — 2026-09-06 (stated)
- REV G — 2026-09-06 (stated)

**Pinned literal numbers, by revision:**

- REV E — 1.9.0 (the retired hand-typed version); the line now prints `${LIT_V}` [1.11.2]
- REV G — 144 → 116 (door frame width), 200px (the old trailing paper)

**Revisions with no prose paragraph of their own:**

- REV D — none (no REV D prose paragraph)
- REV E — none
- REV F — none
- REV G — none

**Revisions not carried on this sheet:**

- REV A / REV B / REV C — not carried
- The sub jumps from the altitude line straight to REV D; no A/B/C clause survives on this sheet.

**Basis (stated): not stated (no census basis line; the altitude line reads `diagrams/data/census-files.json` for the version — currently lit-ui-router 1.11.2)**

**Present-state sentences that carry history** (re-draft candidates):

- caption: "Rev D puts the loop on the ground: every leg is a road that turns along the iso axes and stops short of the wall it points at."
- notes ¶2 ("The document breaks the metaphor on purpose."): "the document is drawn the way Firefox's old Tilt inspector drew it — a browser window whose DOM rises as stacked plates by depth" (historical referent, not a rev reference).
- source comment on `road()` (carries rev D's routing rule as present tense): "End trims are measured against the SILHOUETTE (roofs overhang their walls in projection, and roads draw under the scene), not the plan face they aim at."

## Sheet 1i — THE RENDER LOOP, WALKED

- **file** `diagrams/generator/sheet1i.mjs` · **id** `loop-walked` · **current rev** A
- **basis** (source): `const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 1 — sheet 1's circuit, stepped · one navigation walked leg by leg · 10 STATIONS · 12 LEGS · 12 STEPS · surveyed at origin/main @ 185d414 (commit 2026-09-06)

_No REV clauses, historical paragraphs or rev-bearing callouts: this plate has only ever been issued at its current revision._


### Dates, pinned numbers and present-state history

**Basis (stated): `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0,10)})` from `diagrams/data/census-loop.json` [origin/main @ 185d414, commit 2026-09-06]**

**Present-state sentences that carry history** (re-draft candidates):

- notes ¶1 (Method): "a refactor that moves a hook breaks this plate rather than letting it narrate stale code" — forward-looking, not a past rev.
- notes ¶5 (What this shows that sheet 1 cannot): "Sheet 1 proves the loop is a circuit; here it has an order." — cross-sheet, not a revision reference.
- No sentence on this sheet references a past revision or a change to its own drawing.

## Sheet 2 — THE BRICK ASSEMBLY

- **file** `diagrams/generator/sheet2.mjs` · **id** `companions` · **current rev** C
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2 — one baseplate, four bricks, 27 authored files

### REV A — undated in the copy

**prose paragraph** (`sheet2.mjs:393`, verbatim source):

> <p><strong>Why bricks.</strong> Rev A drew these packages as sockets and panels and conceded the form broke. The mechanism they actually share is a <em>standardised coupling</em>: each companion attaches to <code>@uirouter/core</code> through a published extension point, none of them attaches to another, and any one can be left in the box without disturbing the rest. That is a stud, and a stud is worth drawing. So this is an exploded isometric — the LEGO instruction manual's own idiom — with a numbered part per package, a drop line onto the exact stud it takes, and a parts callout. Nothing is drawn seated, because a seated assembly hides the undersides, and the undersides are the argument.</p>

### REV B — undated in the copy; first in git 2026-08-16

**`sub` clause** (verbatim source):

> REV B: the companions redrawn as an exploded LEGO assembly, every coupling named to its API call, source ${COUNTED}

resolved →

> REV B: the companions redrawn as an exploded LEGO assembly, every coupling named to its API call, source counted at origin/main @ 185d414 (2026-09-07)

### REV C — 2026-09-05

**`sub` clause** (verbatim source):

> REV C 2026-09-05: hidden line — every brick, plate and stud face is drawn OPAQUE now (a stroke class’s fill:none was outranking the fill attribute, so the flanks were see-through: brick 1’s top edge and studs read straight through brick 3, and the second plate’s studs through brick 4), and the two masses that fault had hidden are recomposed for air — brick 3 lifts clear of the seat ring it drops onto, and brick 4 moves onto its own plate’s iso axis, its left face standing over the plate’s left edge



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — before 2026-08-16 (referenced only, never a clause)
- REV B — 2026-08-16 (628d82d "docs: redraw sheet 2 as an exploded LEGO brick assembly")
- REV C — 2026-09-05 (stated in the clause)

**Pinned literal numbers, by revision:**

- REV C — brick 1, brick 3, brick 4 (part numbers only); no counts

**Revisions with no prose paragraph of their own:**

- REV A — none of its own; rev A survives only inside the rev-B prose — see the present-state list.
- REV C — none

**Basis (stated): `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0,10)})` from `diagrams/data/census-bricks.json` [origin/main @ 185d414, generated 2026-09-07]**

**Present-state sentences that carry history** (re-draft candidates):

- notes ¶1 (Why bricks): "Rev A drew these packages as sockets and panels and conceded the form broke."
- notes ¶4 (Brick 3): "${fmt(B(3).sloc)} lines, one stud on the brick above and two on the plate below." [lit-ui-router-mobx = 176 sloc] — current figure, cited as the finding rev B introduced.
- notes ¶6 (Massing, quantized): "A companion that needed to be a 2×4 would be <code>lit-ui-router</code>'s problem to absorb, not a package." — conditional, no history.
- notes ¶7 (The fifth published package is not a brick): "ships from this repo alongside the four drawn here, but it takes no stud on any router plate… so it is scheduled as row 5 and left off the drawing. Every number on this sheet is read from <code>diagrams/data/census-bricks.json</code> — ${COUNTED}."
- caption: no history reference.

## Sheet 2A — THE COUPLING PLAN

- **file** `diagrams/generator/sheet2a.mjs` · **id** `companions-couplings` · **current rev** D
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2 — ALTERNATE PLATE: the same four companions as sheet 2, rev A’s arrangement, every coupling drawn to read

### REV A — undated in the copy

**prose paragraph** (`sheet2a.mjs:209`, verbatim source):

> <p><strong>This plate is the legibility companion to sheet 2.</strong> The exploded assembly (sheet 2, THE BRICK ASSEMBLY) shows the whole stack and where every brick falls; this plate isolates the couplings and draws each one at reading size. It deliberately returns to rev A’s spatial arrangement — core central, companions at its right, the server in a request lane below the no-DOM line — but renders the packages as shallow solids and spends the recovered space entirely on the joints.</p>

**generator comment** (`sheet2a.mjs:24`):

> ```
> // Rev A of sheet 2 was a flat elevation; rev B a full exploded LEGO stack.  This
> ```

**generator comment** (`sheet2a.mjs:25`):

> ```
> // plate splits the difference: rev A's arrangement, blocks given just enough depth
> ```

**generator comment** (`sheet2a.mjs:150`):

> ```
> // ---- context: the stack rev A drew, held faint -------------------------------------
> ```

**other rev-bearing copy** (`sheet2a.mjs:207`):

> ```
> caption: 'The brick assembly, uncoupled and brought back to rev A’s elevation: core as a socket wall, companions as shallow blocks drawn just short of seated, and each of the six connection points — five published studs and one keyed red seat — large enough to letter its API call on the joint itself.',
> ```

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



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — before 2026-08-16 (referenced only; this plate *returns* to rev A's arrangement)
- REV B — 2026-09-03 (1ff332a "feat: census pipeline — sheets 1, 2A and 3 cite plates, last relic numbers retired")
- REV C — 2026-09-06 (stated)
- REV D — 2026-09-06 (stated)

**Pinned literal numbers, by revision:**

- REV B — 1.9.0, 12 files, 1,325 sloc, 2026-08-17 (the retired hand count) [rows now read 1.11.2 · 13f · 1,383]
- REV D — 180 → 156 (location plugin slab width), 160 → 136 (mobx brick slab width)

**Revisions with no prose paragraph of their own:**

- REV A — none of its own
- REV B — none dedicated; the recount appears in the "missing coupling" note — see present-state list
- REV C — none
- REV D — none

**Basis (stated): `census-bricks.json @ ${B.sha}` / `counted at ${B.ref} @ ${B.sha}` [origin/main @ 185d414]**

**Present-state sentences that carry history** (re-draft candidates):

- notes ¶1: "It deliberately returns to rev A’s spatial arrangement — core central, companions at its right, the server in a request lane below the no-DOM line — but renders the packages as shallow solids and spends the recovered space entirely on the joints."
- notes ¶5 (The missing coupling): "front-face area ≈ 35 px² per sloc, from <code>census-bricks.json</code> counted at ${B.ref} @ ${B.sha} (the 2026-08-17 recount moved <code>lit-ui-router</code> to 1,325 sloc; it stands at ${fmt(LIT[3])} now)" [1,383]
- notes ¶5 (same sentence, continued): "with the two smallest companions (1×1 and 1×2) clamped up to a legible minimum, because at true scale they would be postage stamps, and their smallness is already sheet 2’s finding."
- caption: "the brick assembly, uncoupled and brought back to rev A’s elevation: core as a socket wall, companions as shallow blocks drawn just short of seated…"

## Sheet 2B — THE COUPLING BENCH

- **file** `diagrams/generator/sheet2b.mjs` · **id** `coupling-bench` · **current rev** C
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2 — INTERACTIVE PLATE: sheet 2A’s joints made live · 7 nodes · every one of the 7 drawn edges is a published contract, with its declared range under the pointer

### REV B — undated in the copy; first in git 2026-09-06

**`sub` clause** (verbatim source):

> REV B: the intra-column lit-ui-router-mobx → lit-ui-router tie bowed out of the column, because it ran straight through the navigation plugin standing between them

**prose paragraph** (`sheet2b.mjs:52`, verbatim source):

> <p><strong>The middle column is an argument, not a spacer.</strong> Four of the five published packages need <code>lit</code> or need something that does; <code>ui-router-navigation-location-plugin</code> needs neither, and the bench says so by standing it in a column of its own between the wall and the lit column, on the wall’s own baseline. Every other building on this bench reaches left across two column gaps; this one reaches across one, along a straight horizontal run, and that run is the whole of its coupling. Rev B drew it inside the lit column and had to bow the <code>lit-ui-router-mobx</code> tie around it — a single curve on a plate of straight lines, which is the shape a layout takes when it is hiding a fault rather than fixing one. With the plugin moved out, nothing stands between <code>lit-ui-router-mobx</code> and <code>lit-ui-router</code>: the tie is a plain vertical, and the generator now <em>throws</em> if any same-column tie is laid through a third building.</p>

### REV C — 2026-09-06

**`sub` clause** (verbatim source):

> REV C 2026-09-06: the bow deleted and the bench recomposed in four columns — ui-router-navigation-location-plugin declares core and nothing else, so it leaves the lit column for a middle column of its own on the wall’s baseline, its one tie a straight horizontal run; with nothing left standing between them the mobx tie is a plain vertical, a same-column tie laid through a third building is now a build error rather than a curve drawn around it, and the two longest bands letter over their node so the fit is priced on the buildings rather than on the captions



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-09-03 (0746423 "feat: sheet 2B THE COUPLING BENCH — package contracts interactive")
- REV B — 2026-09-03 → 2026-09-05 (introduced with the sheet at 0746423; the clause text is superseded at fd54400 2026-09-06)
- REV C — 2026-09-06 (stated; fd54400 "feat: coupling bench rev c — the navigation plugin gets a column of its own; design review memo")

**Pinned literal numbers, by revision:**

- REV C — four columns; "four of the five published packages" [T.nodes = 7 nodes, T.drawnContracts = 12 drawn contracts]

**Callout continuation lettering** — lines of a revision's callout block that carry no `REV` token of their own, so the REV-keyed pass above did not catch them:

- REV B — none (the drawing is generated by `coupling-bench.mjs`; no `txt()` calls in this file)

**Revisions with no prose paragraph of their own:**

- REV A — none

**Basis (stated): not stated as a basis line in the sub; every figure is looked up in `diagrams/data/census-couplings.json` through a throwing lookup [origin/main @ 185d414, generated 2026-09-07]**

**Present-state sentences that carry history** (re-draft candidates):

- notes ¶5 (deps-to-peers): "all ${MBX.length} of its contracts are peers, including the one brick-to-brick joint on the bench — <code>lit-ui-router ${MBX_LIT.range}</code>, a floor the flagship has since left behind at ${version('lit-ui-router')} without breaking it." [range ^1.7.0; flagship 1.11.2]
- notes ¶6 (The lit range is a lane): "the lockfile resolves <em>two</em> lit majors (${version('lit')}), because the compat lane is tested, not merely permitted."
- notes ¶7 (Two contracts drawn in red): "sheet 2A draws that same tie crossed out, because the default matcher tier never loads the wall."
- notes ¶3: "Of ${T.contracts} contracts the five published packages declare, ${T.drawnContracts} land on a node that is on this bench; the other ${T.contracts - T.drawnContracts} are filed on the plate and read out in the panel under OFF THE BENCH."
- notes ¶8 (Counting rules): "Massing and storeys are the brick schedule’s: … a building’s storeys are its <code>courses</code> band from <code>census-bricks.json</code>, never a pipeline tier."
- SHEET2B_VERDICT (cover index): "2A’s joints made live — every one of the ${T.drawnContracts} drawn edges is a published contract with its declared range under the pointer: ${T.peers} peers to ${T.deps} dependencies across the five packages, and neither dependency is a router"

## Sheet 3 — THE INSTRUMENT YARD

- **file** `diagrams/generator/sheet3.mjs` · **id** `monorepo` · **current rev** H
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3 — 5 publishable packages · 20 tools · 70 turbo task names · one packer, many readers

### REV A — undated in the copy

**prose paragraph** (`sheet3.mjs:314`, verbatim source):

> <p><strong>Mass is volume; volume does not predict authority.</strong> Footprint side is <code>1.6 · √sloc</code>, so plan area tracks lines; height is <code>1.5 px</code> per authored file, so a block's volume is its <code>sloc × files</code>. The two heaviest masses on the sheet are <em>material</em>: the sample apps (${nfl(18)}) and <code>packages/*/src</code> (${nfl(1)}). The ${PR_GATES.length} structures that can stop a pull request total ${PR_GATES.reduce((a, n) => a + nf(n), 0)} files between them, and one of them — <code>dts-backtest</code> — is a single ${nl(9)}-line <code>run.ts</code>. Rev A encoded severity as height and so implied the opposite; the census says a gate's authority has nothing to do with how much code it is.</p>

**plate lettering** (`sheet3.mjs:197`, verbatim source):

> ```
> ${txt(58, SY + 58 + half * 17, `TOTAL — ${massed.length} massed structures · ${TOT_F} authored files · ${fmt(TOT_L)} sloc · ${COUNTED} · gate tiers unchanged from rev A`, 'lbls')}`;
> ```

### REV B — undated in the copy

**other rev-bearing copy** (`sheet3.mjs:311`):

> ```
> caption: 'The monorepo drawn as what it functionally is: a short conveyor that turns source into one tarball, inside a yard of instruments built to measure that tarball. Rev B gives every structure its measured mass — footprint ∝ √sloc, height ∝ authored files — and moves gate severity out of height and into colour, because the two never correlated: the blocks that stop the line are among the smallest on the sheet.',
> ```

### REV C — undated in the copy; first in git 2026-09-02

**`sub` clause** (verbatim source):

> REV C: census refresh — every mass ${COUNTED} from diagrams/data/census-yard.json (scc Code lines), ${TOT_F} authored files and ${fmt(TOT_L)} sloc across ${massed.length} massed structures

resolved →

> REV C: census refresh — every mass counted at origin/main @ 185d414 (2026-09-07) from diagrams/data/census-yard.json (scc Code lines), 203 authored files and 13,998 sloc across 17 massed structures

**prose paragraph** (`sheet3.mjs:318`, verbatim source):

> <p><strong>Rev C — census refresh (${COUNTED}) and a change of ruler.</strong> Nothing about the argument changed; the numbers under it did, for two separate reasons that are worth keeping apart. <em>The ruler changed:</em> sloc is now <code>scc</code>'s string-aware <code>Code</code> count instead of a homegrown blank-and-comment filter, which adds roughly 0.9% across the yard because a template literal's interior now counts line by line. Measured both ways over one identical file set — rev B's twenty-five source directories — the old ruler reads 11,560 lines and <code>scc</code> reads 11,658, so of everything below, about a hundred lines are the tape measure and the rest is code. <em>The code changed:</em> re-measured on the plate, <code>packages/*/src</code> went 2,568 → ${fmt(nl(1))}, the sample apps 2,995 → ${fmt(nl(18))}, Cypress <code>e2e</code> 5 files/405 → ${nf(17)} files/${fmt(nl(17))}. And the yard gained three instruments — <code>@tools/lint-elements</code>, <code>@tools/warn-lanes</code> (#639) and <code>@tools/eslint-ts-parser</code> — which is why <code>tools/</code> now reads nineteen packages and the lint &amp; probe fleet is the one block that visibly grew, 13 files/732 lines to ${nf(14)}/${fmt(nl(14))}. Structure 15 shifted 13 plan units right to keep air around it. Totals: ${TOT_F} authored files, ${fmt(TOT_L)} lines, up from 171/10,652. A note on the count: <code>@tools/wintercg-globals</code> is a member of the workspace but massed nowhere, because its entire source is one <code>globals.d.ts</code> and declaration files are outside this basis — it has always been invisible to this sheet. In the inset, only turbo moved: the <code>ci</code> graph went 501 → 535 nodes (<code>turbo run ci --dry=json</code>, turbo 2.10.11), while mise held at 48 tasks and Actions at 37 call sites across eight workflows. The tarball's readers, the gate tiers and the loop are unchanged.</p>

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: the task-manager inset reads census-handoff.json + census-plate.json — ci ${CI_NODES} nodes, no longer a hand-pasted 535

resolved →

> REV D: the task-manager inset reads census-handoff.json + census-plate.json — ci 605 nodes, no longer a hand-pasted 535

**prose paragraph** (`sheet3.mjs:319`, verbatim source):

> <p><strong>Rev D — the inset is off the clipboard too.</strong> The whole plate cabinet was re-counted at ${PLATE.ref} @ ${PLATE.sha} in one pass, and the yard moved with it: ${TOT_F} authored files and ${fmt(TOT_L)} sloc across ${massed.length} massed structures, up from rev C's 187 / 12,798. The correction rev D exists for is the inset. Its four task-manager figures were the last hand-pasted constants on this sheet, and by rev C's own printing one of them was wrong in the same build that printed it: the inset said the <code>ci</code> graph was 535 nodes while plates 3A and 12, reading <code>census-plate.json</code>, said 590. All four now read from the same two plates 3A draws — <code>census-handoff.json</code> for the workflow, mise and call-site counts, <code>census-plate.json</code> for the graph — so the three sheets cannot disagree about the machine again. At this ref that is ${HW.calling} workflows, ${HW.callSites} call sites over ${HW.targets} distinct tasks, ${HM.tasks} mise tasks with ${HM.withDepends} declaring <code>depends</code>, and <code>ci</code> at ${CI_NODES} nodes. The gate tiers, the loop and the argument are unchanged.</p>`,

**generator comment** (`sheet3.mjs:24`):

> ```
> // hand-pasted here until rev D, where they disagreed with 3A in the same build
> ```

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



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-16 or earlier (c73b65b "docs: add the six-altitudes diagram set")
- REV B — 2026-08-16 (237edc7 "docs: re-mass sheet 3 from sloc x files and move gate severity into colour")
- REV C — 2026-09-02 (be01a38 "feat: census pipeline I4 wave 1 — sheets 2/3/7 import their snapshot plates")
- REV D — 2026-09-03 (96f89fe "feat: census pipeline — full cabinet refresh at origin/main eb32b4e")
- REV E — 2026-09-03 (1ff332a "feat: census pipeline — sheets 1, 2A and 3 cite plates, last relic numbers retired")
- REV F — 2026-09-06 (stated)
- REV G — 2026-09-06 (stated)
- REV H — 2026-09-07 (stated)

**Pinned literal numbers, by revision:**

- REV B — footprint ∝ √sloc, height ∝ authored files (the rev-B scale rule; `KS = 1.6`, `KH = 1.5`)
- REV C — 0.9%; 25 source dirs; 11,560 (old ruler) / 11,658 (scc); 2,568 → [3,576] packages/*/src; 2,995 → sample apps; 5 files/405 → Cypress e2e; nineteen tools packages; 13 files/732 lines → lint & probe fleet; structure 15 shifted 13 plan units; totals up from 171/10,652 [now 203 files / 13,998 sloc across the yard rows]; ci 501 → 535 nodes; turbo 2.10.11; mise 48 tasks; 37 call sites across eight workflows
- REV D — rev C's 187 / 12,798; hand-pasted 535 vs plates' 590 [CI_NODES now 605]; live values HW.calling [8] workflows, HW.callSites [37], HW.targets [28], HM.tasks [49], HM.withDepends [2]
- REV E — 44 (retired hand-typed turbo task-name count) [now `${HANDOFF.turbo.distinctNames}` = 70]
- REV G — mass 1 (structure number only)
- REV H — #717

**Revisions with no prose paragraph of their own:**

- REV B — none dedicated; its rule is stated in the "Mass is volume" note
- REV E — none
- REV F — none
- REV G — none
- REV H — none

**Basis (stated): `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0,10)})` from `diagrams/data/census-yard.json` [origin/main @ 185d414, generated 2026-09-07]; the inset reads `census-handoff.json` + `census-plate.json`**

**Present-state sentences that carry history** (re-draft candidates):

- caption: "Rev B gives every structure its measured mass — footprint ∝ √sloc, height ∝ authored files — and moves gate severity out of height and into colour, because the two never correlated: the blocks that stop the line are among the smallest on the sheet."
- notes ¶2 (Mass is volume): "Rev A encoded severity as height and so implied the opposite; the census says a gate's authority has nothing to do with how much code it is."
- notes ¶2: "one of them — <code>dts-backtest</code> — is a single ${nl(9)}-line <code>run.ts</code>."
- notes ¶1 (Method): "<code>@tools/release</code> hosts several instruments at once, so it is attributed by module prefix — <code>check-published-diff*</code> to structure 11, <code>check-exports*</code> to 10, the pack modules to 3, the release steps to 5 — with every file landing in exactly one structure and none counted twice."
- notes ¶5 (Two task managers): "Then the loop closes back on itself: seven root <code>package.json</code> scripts shell <code>mise run</code> again, so turbo's <code>//#lint:markdown</code> node literally runs <code>mise run lint_markdown</code>."
- plate lettering (schedule total row): "TOTAL — … · gate tiers unchanged from rev A"
- source comment: "the inset's task-manager figures are the SAME plates sheet 3A draws from — hand-pasted here until rev D, where they disagreed with 3A in the same build"

## Sheet 3A — THE HANDOFF WORKS

- **file** `diagrams/generator/sheet3a.mjs` · **id** `handoff` · **current rev** E
- **basis** (source): `const BASIS = `counted at ${HANDOFF.ref} @ ${HANDOFF.sha} (${HANDOFF.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3 · ALTERNATE PLATE — the sheet-3 task-manager inset at full size: 8 of 11 workflows · 49 mise tasks in 4 homes · turbo ci 605 nodes, 183 real · 4 seam types · 3 service doors

### REV A — undated in the copy

**prose paragraph** (`sheet3a.mjs:332`, verbatim source):

> <p><strong>Method — one census, cited throughout.</strong> Every count on this plate comes from a fresh 2026-08-17 census of the repo at HEAD: the 11 workflow files, all 17 <code>turbo.json</code> files, <code>.config/mise/**</code> and both member <code>mise.toml</code> files read directly, cross-checked against <code>mise tasks ls --all</code> and bare <code>turbo run ci --dry=json</code>. Three figures on the sheet-3 inset had drifted and were corrected at rev A: 36→37 workflow call sites, 51→48 repo-defined mise tasks (the 51 had mixed in four user-global <code>rtk:*</code> tasks), and 483→501 ci graph nodes after the lit dedupe — the phantom share held at 68.5%.</p>

### REV B — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV B: census refresh 2026-08-31

**prose paragraph** (`sheet3a.mjs:333`, verbatim source):

> <p><strong>Rev B — census refresh, 2026-08-31.</strong> The plate was re-measured from the same sources at HEAD, and the finding it exists to make survived intact: <em>the mise machine did not move a single task.</em> 48 tasks in the same four homes, 2 <code>depends</code> declarations, 21 <code>$usage_*</code> specs, 37 workflow call sites across the same 8 of 11 workflows, the same 7 ★ / 7 ↩ disjoint sets, the same 6 re-entrant ports, the same one dead task. Only turbo's graph grew, and only because the workspace did: three new members — <code>@tools/lint-elements</code>, <code>@tools/warn-lanes</code> (#639) and <code>@tools/eslint-ts-parser</code> — take the <code>ci</code> graph from 501 nodes / 158 real to 535 / 165, edges 1,294 → 1,375, real→real 116 → 117, and the phantom share from 68.5% to 69.2%. <code>ci:main</code> now stands at 567 nodes / 170 real. The turbo <em>definitions</em> are unchanged at 91 across the same 17 files: every new node is fan-out, not authorship. Two other figures were corrected in passing — the repo holds 12 <code>cache:false</code> definitions, not 11 (7 at root, 5 in member files; still zero reachable from <code>ci</code>) — and four <code>turbo.json</code> line citations moved as <code>//#lint:elements</code> landed above them. A new root lint lane, <code>//#lint:elements</code>, joins the <code>lint</code> fan but is <em>not</em> a re-entrant port: it runs a node bin, not <code>mise run</code>.</p>

### REV C — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV C: the vanished tmp/ census is a scripted probe — every count imported from diagrams/data/census-handoff.json + census-plate.json

**prose paragraph** (`sheet3a.mjs:334`, verbatim source):

> <p><strong>Rev C — the census is a script now, and the mise machine still has not moved.</strong> The 2026-08-17 generator this plate was measured with lived in <code>tmp/</code> and is gone; it is reconstructed as <code>diagrams/generator/census-handoff.mjs</code>, a T1 tree probe that counts workflow <code>mise run</code> call sites, mise task tables and turbo task definitions from a materialized archive of the ref — no mise, no turbo, nothing executed. Run against rev B's own ref (0e4ab36) it reproduces every printed figure exactly: ${W.files} workflows, ${W.calling} calling mise, the same per-file counts, ${W.callSites} call sites, ${W.targets} targets, ${M.tasks} tasks in ${M.homes} homes, ${M.withUsage} arg specs, 17 <code>turbo.json</code> files, 91 definitions (45 + 46) and 12 <code>cache:false</code>. Two <code>depends</code> figures that read as a contradiction turn out to be two different counts, and the plate now carries both: ${M.withDepends} tasks <em>declare</em> a <code>depends</code>, and between them they declare ${M.dependsEdges} dependency edges (setup 1 + lint_workflows 4) — the mise header counts tasks, seam row D2 counts edges. Re-measured at origin/main @ 35c6766, the finding this plate exists to make held a second time: <em>the mise machine still had not moved a task</em> — 48 tasks, 21 arg specs, 37 call sites, 28 targets, all identical, and <code>playwright_deps</code> still dead. turbo moved again, and again only because the workspace did: <code>packages/eslint-plugin-lit-ui-router</code> brought an 18th <code>turbo.json</code> with five definitions and the root file gained <code>check:dev-split</code>, so definitions went 91 → 97 (46 root + 51 member) and <code>ci:pull_request</code> listed eleven <code>dependsOn</code> lanes, not ten. <code>cache:false</code> held at 12, none of it reachable from <code>ci</code>. The graph figures came from <code>diagrams/data/census-plate.json</code> — 590 nodes / 176 real / 1,504 edges / 126 real→real, phantom share 70.2% — with <code>ci:main</code> at 623 / 181. One editorial claim did not survive the recount: the production docs deploy no longer bootstraps with <code>npx pnpm@11.21.0</code>. <code>tools/workers-builds/cloudflare-build.sh</code> now clears corepack's shims and installs <code>pnpm@12.2.1</code> globally through npm before <code>npx turbo docs#build</code> (:26-38) — a different way through the same door, and still the one production path that never sees mise.</p>

**generator comment** (`sheet3a.mjs:7`):

> ```
> // ---- census: IMPORTED, rev C (INITIATIVES.md I5) ---------------------------------
> ```

**other rev-bearing copy** (`sheet3a.mjs:274`):

> ```
> ['  PRODUCTION docs deploy, rev C:', 'lblf'],
> ```

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: whole-cabinet refresh — mise unmoved a third time, turbo down to 17 files / 96 definitions

**prose paragraph** (`sheet3a.mjs:335`, verbatim source):

> <p><strong>Rev D — the first full-cabinet refresh, and the mise machine has still not moved.</strong> Every plate in <code>diagrams/data/</code> was re-counted at ${HANDOFF.ref} @ ${HANDOFF.sha} in one pass, the first time the whole cabinet has been turned over at a single ref rather than sheet by sheet. This plate's own finding survives a third measurement without a single figure moving: 48 mise tasks in ${M.homes} homes, ${M.withUsage} arg specs, ${M.withDepends} declaring tasks and ${M.dependsEdges} edges, ${W.callSites} call sites across ${W.calling} of ${W.files} workflows, ${W.targets} targets, and <code>playwright_deps</code> still dead. turbo moved, and this time it moved <em>down</em>: <code>apps/sample-app-shared/turbo.json</code> is gone (#696 restored <code>turbo run e2e</code> and its two definitions went with it) and the root file swapped <code>//#check:docs-api-deps</code> for <code>//#check:graph-edges</code> and <code>//#check:task-inputs</code> (#693), so files go 18 → 17 and definitions 97 → 96 (47 root + 49 member) — the first recount in this sheet's history where the schedule shrank. <code>cache:false</code> holds at 12 (7 root + 5 member), still with none reachable from <code>ci</code>. The <code>ci</code> graph followed: 586 nodes / 177 real / 1,382 edges / 96 real→real against rev C's 590 / 176 / 1,504 / 126, phantom share 70.2% → 69.8%, <code>ci:main</code> 623 / 181 → 619 / 182. The sharp one is real→real, down a quarter, and it has a single cause: #693 replaced the three <code>^docs:api</code> fan-outs with four package-qualified <code>&lt;pkg&gt;#docs:api</code> edges, because <code>^</code> walks direct deps only and <code>docs</code> was carrying devDependencies it never imports just to let it reach. The <code>docs:api</code> column collapses from 9 nodes to 4, all of them real, and the fan's edges went with it — the same work, wired by name instead of by a fiction. Six line citations moved with the two <code>turbo.json</code> edits and were re-verified against the archive: <code>ci:pull_request</code> 316-330 → 351-365 (still eleven lanes), the <code>//#lint:workflows</code> virtual node 215-225 → 250-260, the three cache-gasket input blocks 228-232 · 245-251 · 256-262 → 263-267 · 280-286 · 291-297, and <code>package.json</code>'s <code>lint:toml</code> script :31 → :32. Everything else this plate cites — <code>config.toml</code>:71, :88, :116, :131-135, :185-212, :196, <code>tools/release/mise.toml</code>:97 and :104-107, <code>tools/build_and_test/mise.toml</code>:72-76, <code>deflake-e2e.yml</code>:73 and :87, <code>cloudflare-build.sh</code>:26-38 — reads at the same lines it did. Basis: ${BASIS}; graph ${GRAPH_BASIS}.</p>

**plate lettering** (`sheet3a.mjs:307`, verbatim source):

> ```
> ${txt(1360, 62, 'REV D whole-cabinet refresh — mise STILL unmoved at 48 tasks / 37 call sites · turbo 96 definitions in 17 files (97 in 18 at rev C) · ci 590→586 nodes, 176→177 real', 'lblf', 'end')}
> ```

### REV E — 2026-09-06

**`sub` clause** (verbatim source):

> REV E 2026-09-06: recomposed to the data face — every frame on this plate was drawn to the old mono advance and is now sized to the widest DIN line it holds, so the spine is computed rather than hand-set: the Actions panel, the mise compartments and the service-door catalogue tighten to their own measure, the freed width goes to the two seam corridors and to the turbo core, which finally fits its re-entrant-ports line, one leading runs through all four mise compartments and each is as tall as its task list, and the bottom band files as three columns on even gutters · ${BASIS}

resolved →

> REV E 2026-09-06: recomposed to the data face — every frame on this plate was drawn to the old mono advance and is now sized to the widest DIN line it holds, so the spine is computed rather than hand-set: the Actions panel, the mise compartments and the service-door catalogue tighten to their own measure, the freed width goes to the two seam corridors and to the turbo core, which finally fits its re-entrant-ports line, one leading runs through all four mise compartments and each is as tall as its task list, and the bottom band files as three columns on even gutters · counted at origin/main @ 185d414 (2026-09-07)

**generator comment** (`sheet3a.mjs:54`):

> ```
> // ---- the spine, rev E: derived from the DIN measure, not hand-set ---------------
> ```



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-17 (8882ef1 "docs: add plate 3A, the handoff works — the two task managers at full size")
- REV B — 2026-08-31 (stated in the clause)
- REV C — 2026-09-03 (c34644f "feat: census pipeline — sheet 3A handoff census reconstructed as a T1 probe")
- REV D — 2026-09-03 (96f89fe "feat: census pipeline — full cabinet refresh at origin/main eb32b4e")
- REV E — 2026-09-06 (stated)

**Pinned literal numbers, by revision:**

- REV A — 2026-08-17; 11 workflow files; 17 turbo.json files; 36→37 call sites; 51→48 mise tasks (4 user-global `rtk:*`); 483→501 ci nodes; phantom share 68.5%
- REV B — 48 tasks / 4 homes; 2 depends; 21 `$usage_*`; 37 call sites; 8 of 11 workflows; 7 ★ / 7 ↩; 6 re-entrant ports; 1 dead task; ci 501/158 → 535/165; edges 1,294 → 1,375; real→real 116 → 117; phantom 68.5% → 69.2%; ci:main 567/170; 91 definitions across 17 files; cache:false 12 (7 root + 5 member), not 11
- REV C — rev B ref 0e4ab36; 17 turbo.json files; 91 definitions (45 + 46); 12 cache:false; setup 1 + lint_workflows 4 edges; ref origin/main @ 35c6766; 48 tasks / 21 arg specs / 37 call sites / 28 targets; 18th turbo.json with five definitions; 91 → 97 (46 root + 51 member); eleven dependsOn lanes, not ten; graph 590/176/1,504/126, phantom 70.2%; ci:main 623/181; npx pnpm@11.21.0 → pnpm@12.2.1; cloudflare-build.sh :26-38 [live template values: W.files 11, W.calling 8, W.callSites 37, W.targets 28, M.tasks 49, M.homes 4, M.withUsage 21, M.withDepends 2, M.dependsEdges 5]
- REV D — 48 mise tasks; #696, #693; files 18 → 17; definitions 97 → 96 (47 root + 49 member); cache:false 12 (7+5); ci 586/177/1,382/96 vs rev C's 590/176/1,504/126; phantom 70.2% → 69.8%; ci:main 623/181 → 619/182; docs:api column 9 nodes → 4; ci:pull_request 316-330 → 351-365; //#lint:workflows 215-225 → 250-260; cache gaskets 228-232·245-251·256-262 → 263-267·280-286·291-297; package.json lint:toml :31 → :32
- REV E — four mise compartments; three columns

**Revisions with no prose paragraph of their own:**

- REV E — none

**Basis (stated): `${BASIS}` from `diagrams/data/census-handoff.json`, graph from `census-plate.json` [both origin/main @ 185d414, generated 2026-09-07]**

**Present-state sentences that carry history** (re-draft candidates):

- notes ¶5 (The star fitting): "Six root <code>//#</code> scripts in the ci graph have <code>mise run …</code> as their literal command, and their turbo <code>inputs</code> explicitly hash <code>.config/mise/tasks/*</code> and <code>.config/mise/mise.lock</code> (turbo.json:264-268, 281-287, 292-298)" — the rev-D-moved citations, carried as present.
- notes ¶7 (Three service doors): "the production docs deploy never sees mise at all — Cloudflare Workers Builds clears corepack’s shims and installs <code>pnpm@12.2.1</code> globally through npm before <code>npx turbo docs#build</code> … because the hosted image’s corepack shim cannot materialize pnpm 12."
- notes ¶8 (Two curiosities): "One task in the whole machine is dead: <code>//tools/build_and_test:playwright_deps</code> (mise.toml:72-76) has no caller anywhere, superseded by <code>playwright_deps_engines</code>."
- notes ¶8: "the phantom shroud around turbo’s core — ${PHANTOM} of ${CI.nodes} nodes that exist only to carry hashes — is drawn as wall thickness here; sheet 12 punches it hole by hole."
- source comment: "census: IMPORTED, rev C (INITIATIVES.md I5) … This plate promotes the sheet-3 'two task managers' inset to a full sheet; the inset stays."

## Sheet 3B — THE WATCHED CITY

- **file** `diagrams/generator/sheet3b.mjs` · **id** `graphcity` · **current rev** H
- **basis** (source): `const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3 · ALTERNATE PLATE B — the PR ci graph as a city: 183 real tasks in 28 massed structures · footprint = watched files (46,781 task-file hashes) · height = command sloc (2,118) · 422 phantom plots

### REV B — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV B: hidden-line pass — opaque walls painted back to front, and the main-line annex reseated clear of the plain’s lettering

**prose paragraph** (`sheet3b.mjs:326`, verbatim source):

> <p><strong>The city is flat, and that is still the finding.</strong> ${FLAT} of ${CI.real} real tasks have command mass 1 — one script line handing the work to a pinned binary; the ratio barely moved as the graph grew a fifth package. The whole city executes ${fmt(TOT_M)} sloc of repo-written command while watching ${fmt(TOT_I)} task-file hashes. The skyline is inverted from intuition: <code>@tools/dts-backtest#test</code> is a ${slocOf('@tools/dts-backtest#test')}-line <code>run.ts</code> on a ${TOWER}-file lot — sheet 3 calls it "one 291-line run.ts holds the TS 5.0 floor", and the graph survey agrees to the line — while the largest footprint, the examples plain, watches ${fmt(CELL.get(25).inputs)} files (format:check ${fmt(row('examples#format:check').inputs)} + lint ${fmt(row('examples#lint').inputs)} alone) under ${CELL.get(25).mass} lines of command. The tallest command is still the root yard's <code>//#lint:elements</code>, which rev B drew as "one eslint line" on the shared root surface and which now runs the repo's own <code>lint-elements</code> bin — ${slocOf('//#lint:elements')} sloc over <code>warn-lanes.core.ts</code>'s ${slocOf('//#lint:elements', 1)} — a ${row('//#lint:elements').mass}-sloc spire on an unchanged footprint. The new quarter arrives flat: <code>eslint-plugin-lit-ui-router</code> brings ${CELL.get(27).tasks} tasks and ${CELL.get(27).mass} sloc, and all but its two <code>oxc-emit</code> build lanes are one line apiece.</p>

### REV C — 2026-08-31

**`sub` clause** (verbatim source):

> REV C 2026-08-31: re-surveyed at ${TURBO} — the graph grew, the plain widened by a third, and //#lint:elements stopped being a one-line lane

resolved →

> REV C 2026-08-31: re-surveyed at turbo 2.10.11 — the graph grew, the plain widened by a third, and //#lint:elements stopped being a one-line lane

**prose paragraph** (`sheet3b.mjs:325`, verbatim source):

> <p><strong>Method — the graph, imported.</strong> Every mass and footprint on this plate is read from <code>diagrams/data/census-mass3b.json</code>, the checked-in snapshot <code>census-mass3b.mjs</code> writes from a bare <code>turbo run ci --dry=json</code> on an installed archive of the ref — ${BASIS}, ${TURBO}: ${CI.nodes} nodes, ${CI.real} real, ${fmt(CI.edges)} edges, ${CI.realEdges} real→real, against rev C's 535/165/1,375/117. Nothing below is hand-pasted; a structure whose tasks have left the plate throws at build time rather than drawing a stale number, and the schedule totals are the plate's own sums. <em>Footprint</em> is the per-task <code>inputs</code> map — the files whose hashes decide that task's cache key — at 1.2·√files per side. <em>Height</em> is command mass: the package.json script line plus the repo script or bin file it executes, sloc-counted by <code>census-mass3b.mjs</code> on <code>scc</code> 4.0.0's <code>Code</code> basis (guards, emitters and mise task files each cited in the schedule; external binaries like <code>tsc</code> and <code>oxlint</code> contribute only their one line, because that is all this repo wrote). Wall-clock and cache-hit rates are excluded as geometry by design: they are properties of runs, not of the graph.</p>

**plate lettering** (`sheet3b.mjs:279`, verbatim source):

> ```
> ${txt(1100, 344, 'THE SPIRE — //#lint:elements (6), since rev C:', 'lblr')}
> ```

**other rev-bearing copy** (`sheet3b.mjs:96`):

> ```
> [27, 'eslint-plugin',         388,   30, 'eslint-plugin-lit-ui-router', 'the fifth quarter, new since rev C — rules, docs and oxlint lanes'],
> ```

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

**prose paragraph** (`sheet3b.mjs:328`, verbatim source):

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



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — before 2026-08-31 (referenced only)
- REV B — 2026-08-31 (053cc87 "docs: hidden-line pass — opaque iso walls, true depth sort on the city plates")
- REV C — 2026-08-31 (stated), corrected 2026-09-01 (stated)
- REV D — 2026-09-02 (stated)
- REV E — 2026-09-03 (96f89fe "feat: census pipeline — full cabinet refresh at origin/main eb32b4e")
- REV F — 2026-09-04 (stated)
- REV G — 2026-09-06 (stated)
- REV H — 2026-09-07 (stated)

**Pinned literal numbers, by revision:**

- REV C — command sloc 1,737 → 1,774; flat blocks 134 → 130; plain 17,692 files; scc 4.0.0
- REV D — 165 → 176 real tasks; 1,774 → 2,022 command sloc; `CELL.get(27).tasks` [9 tasks, 85 sloc]
- REV E — #693; 27 structures → [M.length = 28]; 176 real tasks → [CI.real = 183]; //#check:patches footprint 24 files → [646]; rev D's 27,953 task-file hashes → [TOT_I = 46,781]; [//#check:graph-edges inputs = 2,298; FLAT = 143]
- REV F — lit-ui-router 1.11.2; lit-ui-router-mobx 1.0.0; #703; four rows; examples plain 17,821 → [CELL.get(25).inputs = 31,866]
- REV G — half a pixel; 40px gutter; 40px right margin; 57px overrun
- REV H — origin/main @ 185d414; #716, #717; art region 70px deeper

**Revisions with no prose paragraph of their own:**

- REV A — none of its own
- REV B — none dedicated; rev B survives inside the flatness note — see present-state list
- REV C — none dedicated
- REV D — none dedicated
- REV F — none
- REV G — none
- REV H — none

**Basis (stated): `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0,10)})` from `diagrams/data/census-mass3b.json`, graph counts from `census-plate.json`; toolchain `turbo 2.10.11` [origin/main @ 185d414, generated 2026-09-07]**

**Present-state sentences that carry history** (re-draft candidates):

- notes ¶1 (Method): "…${CI.nodes} nodes, ${CI.real} real, ${fmt(CI.edges)} edges, ${CI.realEdges} real→real, against rev C's 535/165/1,375/117." [now 605/183/1,424/99]
- notes ¶2 (The city is flat): "the ratio barely moved as the graph grew a fifth package."
- notes ¶2: "The tallest command is still the root yard's <code>//#lint:elements</code>, which rev B drew as \"one eslint line\" on the shared root surface and which now runs the repo's own <code>lint-elements</code> bin — ${slocOf('//#lint:elements')} sloc over <code>warn-lanes.core.ts</code>'s ${slocOf('//#lint:elements', 1)} — a ${row('//#lint:elements').mass}-sloc spire on an unchanged footprint." [186 over 214; mass 401]
- notes ¶2: "sheet 3 calls it \"one 291-line run.ts holds the TS 5.0 floor\", and the graph survey agrees to the line"
- notes ¶3 (The root yard repays the walk): "The five-equal-slabs finding is the plate's cleanest, and it survived the refresh exactly — the same five tasks, one surface, one number."
- notes ¶3: "And one lot in the yard is vacant on purpose — <code>//#lint:workflows</code>, the virtual <code>with</code> twin, has no command even here."
- notes ¶4 (One tier, uniformly red): "Sheet 3's severity vocabulary survives, but at this altitude it degenerates truthfully…"
- caption: "a root lint lane that grew a ${row('//#lint:elements').mass}-sloc spire when it stopped being one eslint line." [401]
- plate lettering: "THE SPIRE — //#lint:elements (6), since rev C:"
- schedule note (structure 27): "the fifth quarter, new since rev C — rules, docs and oxlint lanes"
- schedule note (structure 2): "the yard’s tallest one-file guard"

## Sheet 4 — THE FAMILY SPINE

- **file** `diagrams/generator/sheet4.mjs` · **id** `family` · **current rev** E
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 4 — one core, four living adapters, four dormant instruments

### REV B — undated in the copy

**other rev-bearing copy** (`sheet4.mjs:250`):

> ```
> caption: `Not a loop and not a city: a spine. Every limb shares @uirouter/core and none of the limbs talk to each other — so the honest drawing is radial. Rev B gave every limb its measured mass and a gate on every stem; rev C stops typing the registry by hand — versions and publish dates now come from the checked-in npm plate, which is how @uirouter/angular ${npmRow('@uirouter/angular').version} (${npmRow('@uirouter/angular').published}) arrived on the sheet: upstream is consolidating ui-router into a monorepo, and the family is waking up.`,
> ```

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

**generator comment** (`sheet4.mjs:30`):

> ```
> // until rev E.
> ```



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-16 (c73b65b `docs: add the six-altitudes diagram set`)
- REV B — 2026-08-16 (b2f972f `docs: route sheet 1 arrows as iso roads and re-mass sheet 4 from sloc x files`)
- REV C — 2026-09-02 (b346a9a `feat: census pipeline I5 — sheet 4 registry facts from the npm plate`)
- REV D — 2026-09-03 (96f89fe `feat: census pipeline — full cabinet refresh at origin/main eb32b4e`)
- REV E — 2026-09-04 (395d092 `feat: sheet 4 rev E — this repo's gates read census-couplings.json`; date stated in `sub`)

**Pinned literal numbers, by revision:**

- REV B — `KW = 2.7`, `KH = 2.2`

**Revisions with no prose paragraph of their own:**

- REV A — none.
- REV B — no `<p><strong>REV B…` paragraph; the mass argument lives in `<p><strong>An isometric city would still lie here.</strong> …`
- REV C — no `<p><strong>REV C…` paragraph; the method ¶ carries it — `<p><strong>Method — four provenances, kept apart.</strong> …Versions and last-publish dates are not typed on this sheet: every one is read by name from <code>diagrams/data/census-npm.json</code> (<code>npm view</code>, ${REGISTRY}), and a drawn package missing from that plate throws the build.…</p>`
- REV D — none dedicated.
- REV E — none dedicated; the method ¶ opens `<p><strong>Method — four provenances, kept apart.</strong> This repo's own gates — the core range its four packages share and mobx's range on <code>lit-ui-router</code> — are read from <code>diagrams/data/census-couplings.json</code> (${COUPLINGS.ref} @ ${COUPLINGS.sha}); the upstream limbs' gates are read from their manifests by hand.`

**Basis (stated): three plates plus one hand-carried set, all template-resolved at build:**

**Present-state sentences that carry history** (re-draft candidates):

- source comment: "The upstream adapters' and instruments' files/sloc have NO plate: they are clone counts taken from the ui-router org repos on 2026-08-16, kept verbatim."
- source comment: "clone(): files/sloc hand-carried from the 2026-08-16 clones; brick(): from the plate."
- source comment: "— the gates were hand-typed until rev E."
- source comment: "// the fifth published package: a lint plugin, not a router limb — scheduled, not massed"
- caption: "Rev B gave every limb its measured mass and a gate on every stem; rev C stops typing the registry by hand — versions and publish dates now come from the checked-in npm plate, which is how @uirouter/angular … arrived on the sheet: upstream is consolidating ui-router into a monorepo, and the family is waking up."
- plate lettering (`THE WAVE, AND WHAT FOLLOWED`): `'2025-12-31: core, angularjs and react'`, `'patched within 26 h — then angular'`, `` `shipped ${npmRow('@uirouter/angular').version} on ${npmRow('@uirouter/angular').published}:` ``, `'upstream is consolidating ui-router'`, `'into one monorepo'`
- plate lettering (instruments, per block): `` `quiet since ${date}` ``
- plate lettering (provenance): `upstream adapters and instruments — files and sloc: no plate · ${CLONED} of the ui-router org repositories`
- plate lettering: `'no @uirouter/vue was ever published:'` / `'the vue seat has zero mass —'` / `'the one name absent from the registry plate'`
- key: "dormant — no publish since 2021 or earlier"
- notes ¶ "Mass does not track liveness.": "The largest limb on the sheet is the dormant <code>@uirouter/visualizer</code> (34 files, 2,018 lines, last published ${npmRow('@uirouter/visualizer').published}) — it carries a preact/d3 rendering stack, so it out-masses every living adapter."
- notes ¶ "The family is waking up.": "<code>@uirouter/angular</code> went ${…version} on ${…published} — a major, eight months after the ${npmRow('@uirouter/core').published} wave that patched core, angularjs and react inside a day. Read together, the republish wave and the major say the same thing: upstream is consolidating ui-router into a monorepo. That is why <code>@uirouter/angular</code> is drawn <em>active</em> and the other two upstream adapters only <em>wave</em> — they moved because core moved, not on their own. Nothing below the rail has moved: the newest instrument publish is rx at ${npmRow('@uirouter/rx').published}, and the rest are 2019–2020. And <code>@uirouter/vue</code> stays the one name on the constellation with no registry row at all — an absence, not a package."
- aria-label: "Core is by far the largest mass at ${CORE[3]} files and ${fmt(CORE[4])} lines, ${CORE_SHARE} percent of the family; the visualizer is the next largest at 2,018 lines; sticky-states is a two-file sliver."
- pinned numbers in prose/aria: `2,018` (visualizer sloc, in both notes and aria), `34 files`, `233` / "two-file sliver" (sticky-states), and the gate ranges `>=5.0.0`, `>=5.0.1`, `>=6.0.1`, `^6.1.2`, `^6.0.8`, `6.1.2` (the red dependency pin) — the last of which prose still states as `^6.0.8` for this repo, a value now templated as `CORE_GATE`.

## Sheet 5 — THE DESIGN SPACE

- **file** `diagrams/generator/sheet5.mjs` · **id** `runtime` · **current rev** B
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 5 — routers in the JS runtime · positions are editorial, argued in the notes

### REV B — 2026-09-06

**`sub` clause** (verbatim source):

> REV B 2026-09-06: the empty-quarter callout re-cut to the line it frames (330 → 236 wide) — the dashed box had been drawn to the mono lettering and, at the data face, crossed the first column boundary into the server column it says nothing about; no point moved



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-16 (c73b65b `docs: add the six-altitudes diagram set`; label-collision pass 693e6d8 same day)
- REV B — 2026-09-06 (stated in `sub`; committed 2026-09-07, cf45bb0 `feat: cabinet refresh at 185d414, the article as a sup, and plates that contain`)

**Pinned literal numbers, by revision:**

- REV A — the callout box was 330 wide at rev A (stated only in rev B's clause).
- REV B — `330` (the old width, cited in the clause only), `236` (the new width, live in the SVG), `86` (box height).

**Revisions with no prose paragraph of their own:**

- REV A — none.
- REV B — none — no `<p><strong>REV B…` paragraph exists on this sheet.

**Basis (stated): not stated — positions are editorial, argued in the notes; no plate, no ref/sha, no census import.**

**Present-state sentences that carry history** (re-draft candidates):

- notes ¶ "Reading the columns:": "the field has been sliding left for a decade — filesystem routes and typegen move matching toward build time; server components move it toward the server. The client-runtime column is where the platform itself now competes, via the Navigation API."
- notes ¶ "The square is the argument.": "That inversion is why sheet 1's loop runs through a state registry rather than a path matcher, and why the same tree can answer HTTP requests in sheet 2's server lane."
- plate lettering: `'React Router v7', 'framework mode — Remix folded in'` — the one data point whose note records a past merge.
- caption: no history clause ("No mechanism connects these projects, so any drawn edge would be fiction. …").

## Sheet 6 — THE ROUTING STRATA

- **file** `diagrams/generator/sheet6.mjs` · **id** `planet`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 6 — routing in general · the altitude where prose outranks pictures

_No REV clauses, historical paragraphs or rev-bearing callouts: this plate has only ever been issued at its current revision._


### Dates, pinned numbers and present-state history

**Revisions not carried on this sheet:**

- **No REV material.** `sheet6` has no `rev` key at all (unlike every other sheet in this set), its `sub` is `'ALTITUDE 6 — routing in general · the altitude where prose outranks pictures'` with no REV clause, and no `txt()` call, prose paragraph, caption, aria-label or key row on the sheet references a revision letter or a change. Untouched since its two 2026-08-16 commits (c73b65b `docs: add the six-altitudes diagram set`, 693e6d8 label-collision pass).

**Basis (stated): not stated — no plate, no ref/sha, no census import; the sheet is a definition, not a measurement.**

**Present-state sentences that carry history** (re-draft candidates):

- notes ¶ "What changes with ascent is the transition.": "By the surface a transition is a first-class object with a lifecycle — which is precisely the layer sheet 1 drew." (cross-sheet reference, not a revision reference)
- plate lettering: `'surface — sheets 1–3 of this set live here'` (cross-sheet reference)
Nothing else in this sheet carries history of any kind.

## Sheet 7 — THE MEASURED CITY

- **file** `diagrams/generator/sheet7.mjs` · **id** `census` · **current rev** F
- **basis** (source): `const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3½ — the same city as sheet 3, surveyed by mass · 32 members · 4 districts

### REV B — undated in the copy; first in git 2026-08-16

**`sub` clause** (verbatim source):

> REV B: districts, gate severity in colour, and the roads between them — counted 2026-08-16

**other rev-bearing copy** (`sheet7.mjs:361`):

> ```
> caption: 'Sheet 3 drew the monorepo as a process; this sheet counts who lives in it. Rev B keeps the census — footprint ∝ √sloc, height ∝ authored files, tests drawn as annexes rather than deleted — and adds the two things a census alone cannot say: which districts these members belong to, and which roads actually run between them. Every road is a workspace dependency or a turbo task edge, never an impression.',
> ```

### REV C — 2026-08-31

**`sub` clause** (verbatim source):

> REV C 2026-08-31: hidden-line pass — the masses now carry opaque faces and are painted back to front, so no rear iso edge reads through a front wall

### REV D — 2026-08-31

**`sub` clause** (verbatim source):

> REV D 2026-08-31: recount — three new instruments massed (28 lint-elements, 29 warn-lanes, 30 eslint-ts-parser), and every sloc rebased on scc 4.0.0’s Code count; on one identical file set the new ruler reads about +0.9% over the old “neither blank nor comment-only” filter, and the rest of the movement is code · every number now imported from diagrams/data/census-city.json

**prose paragraph** (`sheet7.mjs:368`, verbatim source):

> <p><strong>REV D — two things moved at once, and the plate keeps them apart.</strong> First the <em>ruler</em>: sloc is now <code>scc</code> 4.0.0's <code>Code</code> count rather than the old "neither blank nor comment-only" filter. Measured both ways over one identical file set — sheet 3 rev B's twenty-five source directories at today's HEAD — the old counter reads 11,560 and <code>scc</code> reads 11,658, about +0.9%. So roughly a hundred lines of the growth below is the tape measure, not the building. Second the <em>city</em>: fourteen days, one release (<code>lit-ui-router@1.10.0</code>, tagged 2026-08-17) and three new instruments. №28 <code>@tools/lint-elements</code> and №29 <code>@tools/warn-lanes</code> were both born 2026-08-31 (#639); №30 <code>@tools/eslint-ts-parser</code> was born 2026-08-16 (#557) and is the "28th member, not yet on any map" that plate 7B recorded — it can be placed now, and at 1 authored line it lands on the drawing's minimum footprint, the smallest thing in the yard. The yard is where the growth is: 16 members and 4,684 sloc become ${DT.n} and ${fmt(DT.sl)}, and it stays the city's largest district by a wide margin.</p>

**generator comment** (`sheet7.mjs:85`):

> ```
> // --- born 2026-08-31 (#639) and 2026-08-16 (#557) — first drawn at rev D ------
> ```

### REV E — 2026-09-04

**`sub` clause** (verbatim source):

> REV E 2026-09-04: cabinet refresh after the 1.11.2 + mobx 1.0.0 releases — №32 @tools/embed-heights (#703) massed on the yard's middle row, and two schedule notes shortened to fit the frame

**generator comment** (`sheet7.mjs:91`):

> ```
> // --- born 2026-09-04 (#703) — first drawn at rev E ------------------------------
> ```

### REV F — 2026-09-07

**`sub` clause** (verbatim source):

> REV F 2026-09-07: re-surveyed after #717 moved the documentation site from docs/ to www/lit-ui-router.dev/ and #716 dropped the sample app's markov seed pipeline — member №10 is massed at its new path and the shopfront's district lettering follows it; the member keeps the name docs, which is still what its package.json and every turbo task id say — ${BASIS}

resolved →

> REV F 2026-09-07: re-surveyed after #717 moved the documentation site from docs/ to www/lit-ui-router.dev/ and #716 dropped the sample app's markov seed pipeline — member №10 is massed at its new path and the shopfront's district lettering follows it; the member keeps the name docs, which is still what its package.json and every turbo task id say — counted at origin/main @ 185d414 (2026-09-07)



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-16 (fed935c `docs: add sheet 1 rev b iso circuit and sheet 7 census (wip)`; schedule fixed 652def4 same day)
- REV B — 2026-08-16 (8428701 `docs: rework sheet 7 as the measured city with districts and cited roads`; heights doubled b504dbe same day)
- REV C — 2026-08-31 (stated in `sub`; 053cc87 `docs: hidden-line pass — opaque iso walls, true depth sort on the city plates`)
- REV D — 2026-08-31 (stated in `sub`; committed 2026-09-01, 8033db3 `docs: data refresh on the iso plates — 30 members, scc basis, rust ladder re-cut`; plate import landed be01a38 2026-09-02 `census pipeline I4 wave 1`)
- REV E — 2026-09-04 (stated in `sub`; 4332b21 `feat: cabinet refresh at b2338d0 — 1.11.2 + mobx 1.0.0, embed-heights placed`)
- REV F — 2026-09-07 (stated in `sub`; cf45bb0 `feat: cabinet refresh at 185d414, the article as a sup, and plates that contain`)

**Pinned literal numbers, by revision:**

- REV B — `KS = 1.6` (footprint side = 1.6·√sloc), `KH = 3.0` (block height, 3 px per authored file — doubled from rev A's 1.5 by b504dbe); `counted 2026-08-16`. The method ¶ cites rev B's twenty-five source directories: "sheet 3 rev B's twenty-five source directories at today's HEAD".
- REV D — `11,560` (old counter), `11,658` (scc), `+0.9%`, `twenty-five source directories`, `fourteen days`, `lit-ui-router@1.10.0` tagged `2026-08-17`, `#639`, `#557`, `1 authored line` (eslint-ts-parser), `16 members and 4,684 sloc` (the yard before), `27 members → 30`, `#676`, `3 files and 100 lines` (oxc-emit's old hand-kept figure). `${DT.n}`, `${fmt(DT.sl)}`, `${g(31).sf}`, `${g(31).sl}`, `${g(31).pf}`, `${g(20).sf}`, `${g(20).sl}` resolve from the plate.
- REV E — `1.11.2`, `mobx 1.0.0`, `№32`, `#703`.
- REV F — `#717`, `#716`, `№10`; `${BASIS}` resolves from census-city.json.

**Revisions with no prose paragraph of their own:**

- REV A — none.
- REV B — no `<p><strong>REV B…` paragraph; the roads ¶ carries it — `<p><strong>The roads are the new content, and every one is citable.</strong> …`
- REV C — none dedicated.
- REV E — none dedicated.
- REV F — none dedicated.

**Basis (stated): `BASIS = \`counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})\`` — diagrams/data/census-city.json. Printed in `sub` (tail of the rev F clause), on the plate, and in the method ¶.**

**Present-state sentences that carry history** (re-draft candidates):

- sub (rev F tail): "the member keeps the name docs, which is still what its package.json and every turbo task id say"
- caption: "Sheet 3 drew the monorepo as a process; this sheet counts who lives in it. Rev B keeps the census … and adds the two things a census alone cannot say"
- source comment: `// --- born 2026-08-31 (#639) and 2026-08-16 (#557) — first drawn at rev D ------`
- source comment: `// --- the fifth published package (#676) — first drawn here --------------------`
- source comment: `// --- born 2026-09-04 (#703) — first drawn at rev E ------------------------------`
- notes ¶ "Method — one basis, two series.": "The packages district is five buildings now, and it still reconciles exactly with sheet 3's source slab — ${DP.f} files, ${fmt(DP.sl)} lines — because both are queries over the same census rather than two hand counts."
- notes ¶ "The roads are the new content…": "One faint road remains: eight instruments now import <code>@tools/shared</code> — <code>src/globs.ts</code> (#655) added the custom-element glob three lanes share; only the road to the largest is drawn, because drawing all eight would turn the yard into hatching."
- notes ¶ "Severity in colour, mass in geometry — and they disagree.": "red hatch marks the six members that can stop a pull request — Cypress <code>e2e</code>, <code>dts-backtest</code>, <code>compat-guards</code>, <code>lit-test-env</code>, <code>happy-dom</code>, and now <code>lint-elements</code>, whose ratchet exits non-zero on a new warning"
- notes ¶ "Numbers by import, not by paste.": "this file now holds placement, tiers and prose only"; "several members moved because the basis did, most visibly <code>@tools/oxc-emit</code>, hand-kept at 3 files and 100 lines and actually ${g(20).sf} files and ${g(20).sl}."
- notes ¶ "REV D — …": "it is the \"28th member, not yet on any map\" that plate 7B recorded — it can be placed now"
- plate lettering: `every number on this sheet is read from diagrams/data/census-city.json — ${BASIS}`
- plate lettering (schedule total): `TOTAL — ${M.length} members, ${MASSED} massed · ${TOT_SF} authored files · ${fmt(TOT_SL)} sloc · plus ${TOT_PF} spec files · ${fmt(TOT_PL)} sloc of annex · ${BASIS} (sloc = scc Code)`
- placement note (member 28): `'the shared custom-element lint lane (#655)'`
- placement note (member 30): `'a one-line parser shim — the smallest thing in the yard'`

## Sheet 7A — THE SHADOW SURVEY

- **file** `diagrams/generator/sheet7a.mjs` · **id** `shadow` · **current rev** E
- **basis** (source): `const BASIS = `metered at ${SHADOW.ref} @ ${SHADOW.sha} (${SHADOW.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3½ — ALTERNATE PLATE TO SHEET 7: the measured city under its own test light · same city as sheet 7, 32 members

### REV B — undated in the copy; first in git 2026-08-17

**`sub` clause** (verbatim source):

> REV B: polarity corrected — the tests are the light, shadow is the untested

**prose paragraph** (`sheet7a.mjs:383`, verbatim source):

> <p><strong>REV B — the polarity is corrected, not the data.</strong> This plate's first printing drew coverage as cast shadow, so the best-tested district read gloomiest — the metaphor upside down, as the client noted: the tests are the light, and shadow should mean what shadow means. Every number below is rev A's, unchanged; only the optics flipped. The spec annex is now the lamp, covered source glows, and the members with no suite at all are finally the dark buildings they always were.</p>

**plate lettering** (`sheet7a.mjs:288`, verbatim source):

> ```
> ${txt(1520, 62, 'e2e light (cypress) is drawn, not metered — no lcov leaves the rig · REV B flips rev A’s polarity: tests are the light', 'lblf', 'end')}
> ```

**generator comment** (`sheet7a.mjs:9`):

> ```
> // REV B: polarity corrected — rev A drew coverage as cast shadow, so the best-
> ```

### REV C — 2026-08-31

**`sub` clause** (verbatim source):

> REV C 2026-08-31: lettering pass — no district boundary is drawn through a caption

### REV D — 2026-08-31

**`sub` clause** (verbatim source):

> REV D 2026-08-31: footprints refreshed to sheet 7 rev D’s census; the light was NOT re-metered and the plate said so

**prose paragraph** (`sheet7a.mjs:380`, verbatim source):

> <p><strong>The gate first: the reconstruction had to reproduce the sheet before it was allowed to replace it.</strong> Run against the old metering's own ref, <code>3557c29</code>, the probe returns rev D's printed figures exactly — the same thirteen metered members with the same category letters, and line, branch and function coverage identical to the last decimal on every one of them; the schedule's grand total comes back as 5,427 of 5,539 lines, 1,283 of 1,351 branches, 419 of 437 functions, which is what rev D printed. It also reproduces the meter footprints the old header narrated: <code>lit-ui-router</code> at 1,325 sloc and <code>@tools/shared</code> at 9 files / 300. <strong>One figure did not reproduce, and it is worth the space:</strong> <code>@tools/build_and_test</code> was recorded at 7 files / 756 sloc with 464 lit, and the probe reads 7 files / 779 with 487. The file sets are identical; the 23 lines are all in <code>error-summary.core.ts</code>, which the old "neither blank nor comment-only" counter reads at 233 and <code>scc</code> 4.0.0 reads at 256 — the string-aware ruler sheet 7 changed to at its own rev D, counting template-literal interiors as code. So the meter reproduces perfectly and the tape measure moved, which is exactly the distinction this plate exists to keep.</p>

**prose paragraph** (`sheet7a.mjs:382`, verbatim source):

> <p><strong>REV D — the footprints moved, the light did not.</strong> Sheet 7's census was re-taken on 2026-08-31 on a new sloc ruler (<code>scc</code> 4.0.0's <code>Code</code> count) and grew from 27 members to 30, so this plate's footprints, annexes and districts were refreshed to match — the two plates still overlay building for building. The <em>light</em> was <strong>not</strong> re-metered. This plate's 13-member, 5,539-line universe came from bespoke <code>census-shadow.mjs</code> runs (nine of the thirteen members were metered by nothing the repo itself schedules), and re-running <code>turbo run test:coverage</code> reproduced only the four packages — 2,380 of 2,397 lines, 99.29%. So the verdict box and the schedule total were printed as what they were: the 2026-08-17 metering, unmoved, and labelled as not re-run. The census had by then overtaken the meter in three places, daggered in the schedule; the sharpest looked like <code>@tools/build_and_test</code>, which grew 756 → 1,128 sloc when the error summary landed and lost a lamp on plate 7B — a reading rev E has since shown to be an artefact of the dagger, not a suite that stopped covering. The three new members were drawn dark or untethered on their first appearance: <code>lint-elements</code> and <code>eslint-ts-parser</code> had no suite at all, and <code>warn-lanes</code> had a real <code>.core.test.ts</code> that was believed to leave no lcov.</p>

### REV E — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV E: RE-METERED — census-shadow.mjs is a scripted probe now, so the light is measured at the same ref as the census (${BASIS}); the daggers retire, №31 is metered for the first time, and nothing on this plate is hand-pasted

resolved →

> REV E: RE-METERED — census-shadow.mjs is a scripted probe now, so the light is measured at the same ref as the census (metered at origin/main @ 185d414 (2026-09-07)); the daggers retire, №31 is metered for the first time, and nothing on this plate is hand-pasted

**prose paragraph** (`sheet7a.mjs:379`, verbatim source):

> <p><strong>REV E — the light is a plate, and the daggers are gone.</strong> Every earlier printing of this sheet carried a caveat the rest of the atlas had grown out of: the footprints were a filed census and the <em>light</em> was a hand-pasted transcription of a 2026-08-17 run of a generator that lived in <code>tmp/</code> and no longer exists. That generator is reconstructed as <code>diagrams/generator/census-shadow.mjs</code>, a T3 probe on the same harness every other execution probe uses — materialize the ref, <code>corepack pnpm install --frozen-lockfile</code>, then meter each member under <em>its own</em> suite's meter and parse the lcov, never a stdout table. The consequence worth saying plainly: <strong>the meter and the census are now the same measurement of the same tree</strong> (${BASIS}), so the three daggers rev D printed — members whose census had overtaken their metering — are retired rather than explained.</p>

**prose paragraph** (`sheet7a.mjs:381`, verbatim source):

> <p><strong>What re-metering moved, and the dagger mechanism's own bill.</strong> Sixteen members metered at rev E instead of thirteen — ${T.metered} now, №32 <code>@tools/embed-heights</code> having joined under its own <code>node:test</code> meter. Three were new light at rev E: №31 <code>eslint-plugin-lit-ui-router</code> is metered for the first time and comes in lit wall to wall (${g(31).r[10]}/${g(31).r[6]} files, ${pctS(g(31).r[12])}, line ${pctS(g(31).r[13])}); №29 <code>@tools/warn-lanes</code>, drawn at rev D as an outline of light on the guess that no lcov left it, in fact meters clean at ${pctS(g(29).r[12])} of its source; and №20 <code>@tools/oxc-emit</code>, drawn dark, has grown a suite and lights ${pctS(g(20).r[12])}. The daggered pair moves the most, and in the direction that indicts the dagger rather than the members: rev D drew <code>build_and_test</code> at 41.1% reach and <code>shared</code> at 82.4%, both computed by dividing an August lit figure by an end-of-August census — measured properly at one ref they are ${pctS(g(15).r[12])} and ${pctS(g(16).r[12])}. <em>The dagger systematically understated the members it marked</em>, which is why retiring it matters more than relabelling it. Nothing brightened everywhere: №12 <code>@tools/release</code> reaches further than it did (54.1% → ${pctS(g(12).r[12])}) and burns dimmer inside that reach (line 98.4% → ${pctS(g(12).r[13])}, function 96.8% → ${pctS(g(12).r[15])}), which is what a growing instrument with a lagging suite looks like from the air.</p>

**plate lettering** (`sheet7a.mjs:255`, verbatim source):

> ```
> ${txt(58, SY + 72 + half * 17, `REV E — the daggers are retired: light and footprint are now measured at the SAME ref, so no member's meter and census can disagree · every figure above is read from diagrams/data/census-shadow.json and diagrams/data/census-city.json`, 'lblf')}`;
> ```

**plate lettering** (`sheet7a.mjs:284`, verbatim source):

> ```
> ${txt(52, 58, 'sheet 7’s city from straight above · every lamp is a spec annex · REV E: the light is a plate, measured at the census’s own ref', 'lblf')}
> ```

**generator comment** (`sheet7a.mjs:12`):

> ```
> // REV E: the light is a PLATE.  Both series now come from filed snapshots measured
> ```

**other rev-bearing copy** (`sheet7a.mjs:221`):

> ```
> 20: 'REV E: first metered — the check lane',
> ```

**other rev-bearing copy** (`sheet7a.mjs:230`):

> ```
> 29: 'REV E: first metered — the ratchet core',
> ```

**other rev-bearing copy** (`sheet7a.mjs:232`):

> ```
> 31: 'REV E: first metered — vendored rules',
> ```

**other rev-bearing copy** (`sheet7a.mjs:233`):

> ```
> 32: 'REV E: reserve lit — driver + CLI in shadow',
> ```



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-17 (2d96885 `docs: add plate 7A, the shadow survey — the measured city under its own test light`)
- REV B — 2026-08-17 (2de9b65 `docs: flip plate 7A to rev B — the tests are the light, shadow is the untested`)
- REV C — 2026-08-31 (stated in `sub`; 053cc87 `docs: hidden-line pass — opaque iso walls, true depth sort on the city plates`)
- REV D — 2026-08-31 (stated in `sub`; committed 2026-09-01, 8033db3 `docs: data refresh on the iso plates — 30 members, scc basis, rust ladder re-cut`)
- REV E — 2026-09-03 (not dated in `sub`; 2e72a39 `feat: census pipeline — 7A lamps reconstructed as census-shadow probe`, on 8a4bdc3 same day `feat: city scene cycle 3 — the shadow survey as a TEST LIGHT lane`)

**Pinned literal numbers, by revision:**

- REV A — rev A's data is stated as unchanged by rev B — "Every number below is rev A's, unchanged; only the optics flipped."
- REV D — `27 members to 30`, `13-member`, `5,539` lines, `2,380 of 2,397 lines, 99.29%`, `2026-08-17` metering date, `756 → 1,128 sloc`, `scc 4.0.0`, `nine of the thirteen`. Rev D's printed reach figures are cited in the rev E ¶: `41.1%` (build_and_test), `82.4%` (shared), `54.1%` reach / `98.4%` line / `96.8%` function (@tools/release). Rev D's schedule grand total, cited in rev E's gate ¶: `5,427 of 5,539 lines, 1,283 of 1,351 branches, 419 of 437 functions`.
- REV E — `3557c29` (the old metering's ref), `5,427 of 5,539 lines`, `1,283 of 1,351 branches`, `419 of 437 functions`, `1,325 sloc` (lit-ui-router meter footprint), `9 files / 300` (@tools/shared), `7 files / 756 sloc with 464 lit` → `7 files / 779 with 487`, `23 lines`, `233` → `256` (error-summary.core.ts), `Sixteen members … instead of thirteen`, `41.1%`, `82.4%`, `54.1%`, `98.4%`, `96.8%`. Live values `${T.metered}`, `${g(31).r[10]}`, `${g(31).r[6]}`, `${g(29).r[12]}`, `${g(20).r[12]}`, `${g(15).r[12]}`, `${g(16).r[12]}`, `${g(12).r[12]}`, `${g(12).r[13]}`, `${g(12).r[15]}` resolve from census-shadow.json.

**Revisions with no prose paragraph of their own:**

- REV A — no rev-A paragraph; rev A is described only inside rev B's — see below.
- REV C — none dedicated.

**Basis (stated): `BASIS = \`metered at ${SHADOW.ref} @ ${SHADOW.sha} (${SHADOW.generatedAtTime.slice(0, 10)})\`` — diagrams/data/census-shadow.json. Footprints/annexes/districts come from sheet 7's own plate, diagrams/data/census-city.json. Printed in the rev E `sub` clause and twice in the rev E ¶.**

**Present-state sentences that carry history** (re-draft candidates):

- source comment: "REV B: polarity corrected — rev A drew coverage as cast shadow, so the best-tested district read gloomiest. Same data, metaphor flipped the right way up: the spec annex is the LAMP, covered source is LIT, shadow means UNTESTED."
- source comment: "REV E: the light is a PLATE. Both series now come from filed snapshots measured at the same ref, so the meter and the census can no longer disagree"
- source comment: "Placement, numbering, district and prose are all that is left in this file."
- plate lettering (district, packages/): `` `branches ${pct1(DP.branchesHit, DP.branches)}% · the annexes sheet 7 drew at 1.5–3.9× bought this glow` ``
- plate lettering (callout №5): `'its unit tests pass, but browser-mode vitest cannot'` / `'load a meter the repo never installed'`
- plate lettering (callout №26): `'№26 happy-dom — a lamp, and NO light on itself:'` / `'its canary spec lights happy-dom’s ordering'` / `` `bug, never its own append.ts — 0 of ${g(26).r[7]} sloc;` `` / `'those lines are lit from №1’s lamp instead'`
- plate lettering (callout №12): `'the publish halt is lit at its core'` / `'and dark at its process edge'`
- plate lettering (e2e note): `'e2e light (cypress) is drawn, not metered — no lcov leaves the rig · REV B flips rev A’s polarity: tests are the light'`
- schedule note (member 28): `'the element lane — no suite of its own'`; (30): `'a one-line parser shim — nothing to light'`; (14): `'no self-suite — it IS the d.ts test'`; (23): `'harness for the vitest suites — borrowed light'`
- notes ¶ "Method — one meter per member…": "One honest wobble found by re-running the probe four times over: <code>node --test</code>'s branch <em>denominator</em> for №31 came back 213 on two runs and 215 on two more, with 191 hit either way — a 0.9-point swing on one member's branch figure and nothing else in the plate moved. Branch discovery under V8 is not perfectly repeatable, and this plate says so rather than pretending the last run is the only one."
- notes ¶ "The product glows wall to wall…": "This is the priority made visible: library coverage outranks docs coverage, and the annexes sheet 7 drew at 1.5–3.9× their buildings turn out to buy near-total light."
- notes ¶ "The yard's habit: bright cores, dark wrappers.": "<code>@tools/happy-dom</code> remains the survey's one genuine surprise: it owns a lit lamp and still stands dark, because its spec is a conformance canary pointed at happy-dom upstream — its own <code>append.ts</code> is lit only from <code>lit-ui-router</code>'s lamp, as borrowed light."
- notes ¶ "What the meter cannot say…": "<code>sample-app-shared</code> runs its unit tests green, yet browser-mode vitest cannot fetch a coverage provider the repo never installed"
- caption: no revision reference (opens "Sheet 7 counted who lives in the city; this plate asks which of them ever stand in test light.")

## Sheet 7B — THE WORKING CITY

- **file** `diagrams/generator/sheet7b.mjs` · **id** `working` · **current rev** G
- **basis** (source): `const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3½ — SYNTHESIS PLATE TO SHEET 7: the census city as a working plant · weathering (13) × test light (7A) × gates (7) × live build, one sprite per member · re-surveyed 2026-08-31

### REV B — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV B: hidden-line pass — opaque plant walls painted back to front, and the pipes now stop inside the annex gap

**prose paragraph** (`sheet7b.mjs:349`, verbatim source):

> <p><strong>The one alarm rev B drew has been answered — and the register keeps the record.</strong> Rev B's alert channel found exactly one red gate at HEAD: <code>//#lint:root</code>, oxlint failing with 16 errors, every one of them inside <code>diagrams/generator/</code>. The atlas had broken its own lint line drawing itself, and the triangle hung over the drafting office rather than over any plant. Commit <code>ffd4ef7</code> — "answer plate 7B's alarm: oxlint-clean the atlas generator" — fixed exactly that, and oxlint over <code>diagrams/generator</code> exits 0 at HEAD. So rev C strikes the triangle through instead of deleting it: an answered alarm is a record, and this is the third time the set has moved its own subject, after the lodash swap on sheet 8 and the lit dedupe on sheet 10.</p>

**plate lettering** (`sheet7b.mjs:244`, verbatim source):

> ```
> ${txt(108, 714, 'rev B rang one alarm: //#lint:root, oxlint, 16 errors, every one inside', 'lblf')}
> ```

**generator comment** (`sheet7b.mjs:20`):

> ```
> //         rev B's R2 (30–34d) is not rev C's R2 (31–37d).
> ```

**generator comment** (`sheet7b.mjs:32`):

> ```
> //         diagrams/data/census-plate.json (rev B: 22 real of 103), last run green 2026-08-17 (all
> ```

**other rev-bearing copy** (`sheet7b.mjs:34`):

> ```
> //   ALERT (floating triangle) — a gate red at HEAD.  Rev B carried one: //#lint:root
> ```

**other rev-bearing copy** (`sheet7b.mjs:272`):

> ```
> const svg = `<svg viewBox="0 0 1560 ${SY + 104 + half * 17}" role="img" aria-label="Sheet 7's isometric census city redrawn as a working industrial plant, every workspace member a machine on the line. Massing is unchanged — footprint proportional to the square root of source lines, height three pixels per authored file, the same four dashed districts. Each machine now broadcasts its state the way a Factorio building does: red rust speckle on the flanks where a member has gone untouched, growing from clean through four re-cut steps to the typedoc plugin, whose flanks are almost fully rusted and cracked; steam puffs rising from roof vents where commits touched the member in the last ninety days, six accent puffs over lit-ui-router, sample-app-shared, the Cypress host, docs, examples and the release tool; up to three green module lamps low on each front face showing how much of the member its own test suite lights, read straight from plate 7A's own filed snapshot, with accent lamps on the sample apps whose only light is the unmetered end-to-end rig; and outlet pipes that all connect, because the build graph's ${BUILD.real} real tasks last ran green. No alert triangle stands over the city at all: the alert register records that rev B's one red gate — the root lint task, failing over the atlas's own generator directory — was answered by a commit that cleaned the drawings, and the triangle is drawn struck through rather than deleted. A plant schedule lists every member's channel values.">
> ```

**other rev-bearing copy** (`sheet7b.mjs:342`):

> ```
> caption: 'Sheet 7 counted the city, sheet 13 dated its stone, plate 7A metered its test light. This plate turns the same city on: every member becomes a Working Plant sprite in the Factorio sense — a machine whose state is broadcast, not implied. Rust speckle for idleness, steam for the last ninety days of commits, module lamps for test light, pipes for the build. The channels are independent on purpose, and the city proves they must be: the flagship runs at full steam under every lamp while wearing rust, and the most-rusted machine in the yard is still quietly steaming. Rev B’s one alarm rang over no plant at all — it rang over the drawings; rev C draws it struck through, because it was answered.',
> ```

**other rev-bearing copy** (`sheet7b.mjs:361`):

> ```
> keyRow('<polygon points="24,2 17,15 31,15" class="sks fnone"/><line x1="14" y1="17" x2="34" y2="1" class="sks"/>', 'alert, struck — rev B’s one red gate, answered by ffd4ef7'),
> ```

### REV C — 2026-08-31

**`sub` clause** (verbatim source):

> REV C 2026-08-31: 30 plants (three new machines), rust ladder RE-CUT on the fresh idle distribution — an R2 here is not rev B’s R2 — and rev B’s one alarm struck through: //#lint:root is answered · steam now IMPORTED from diagrams/data/census-steam.json (window ${WINDOW} · ${BASIS}) and the massing from sheet 7’s own plate, so the fifth package joins the city as №31

resolved →

> REV C 2026-08-31: 30 plants (three new machines), rust ladder RE-CUT on the fresh idle distribution — an R2 here is not rev B’s R2 — and rev B’s one alarm struck through: //#lint:root is answered · steam now IMPORTED from diagrams/data/census-steam.json (window 2026-06-09..2026-09-06 · counted at origin/main @ 185d414 (2026-09-07)) and the massing from sheet 7’s own plate, so the fifth package joins the city as №31

**prose paragraph** (`sheet7b.mjs:345`, verbatim source):

> <p><strong>Every channel is measured, and every threshold comes from a distribution.</strong> RUST is the weathering census (sheet 13): median days since last touch per member, five steps cut where the idle histogram actually cuts — re-cut at rev C, see below. The top step is still the empty gap nothing occupies (now 61–180 days), so R4 means genuinely sealed, and only the typedoc plugin wears it. STEAM is distinct commits touching the member in a trailing 90-day window, now read from the checked-in plate <code>diagrams/data/census-steam.json</code> — window ${WINDOW}, ${BASIS}. The band edges are rev C's and are kept: 0 puffs ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16. What no longer holds is the claim that those edges sit in empty air — 3, 9 and 16 are all occupied on this window, so the bands are stated here as editorial, not as gaps. Six plants steam at three puffs where rev B drew three: <code>lit-ui-router</code> (${g(1).steam}), <code>sample-app-shared</code> (${g(5).steam}), <code>docs</code> (${g(10).steam}), <code>@tools/release</code> (${g(12).steam}), <code>sample-app-lit-e2e</code> (${g(9).steam}) and, since rev F's window, <code>examples</code> (${g(11).steam}). LAMPS compress plate 7A's meter to one number, lit share = extent × line coverage — and at rev E that number is <em>read</em> from plate 7A's own snapshot, <code>diagrams/data/census-shadow.json</code>, metered at ${SHADOW.ref} @ ${SHADOW.sha}, rather than transcribed off a printed sheet: three lamps at ${'≥'}90, two at ${'≥'}50, one above zero, and the accent lamp is 7A's honest category for light no meter reads. PIPES are the <code>turbo run build</code> graph, read at rev D from <code>diagrams/data/census-plate.json</code>: ${BUILD.real} real tasks in ${BUILD.nodes} nodes, last run green on 2026-08-17 (all cache hits — a replay of green, stated as such), so every pipe on the sheet connects and the key says so rather than inventing a broken one.</p>

**prose paragraph** (`sheet7b.mjs:350`, verbatim source):

> <p><strong>REV C — the ladder was re-cut, so read the labels afresh.</strong> Two more weeks of clock pushed nine members' median idle into a 42–58-day band that rev B's ladder had no step for: its steps were cut at the 2026-08-17 histogram's gaps (R3 ≤41, R4 &gt;180 because nothing sat between 60 and 180). The plate's stated method is "thresholds cut at the distributions' own gaps", so honouring the method meant new numbers rather than forcing old ones: rev C cuts at 0 ≤14 · R1 ≤30 · R2 ≤37 · R3 ≤58 · R4 &gt;180, where 14 and 30 are histogram walls, 37 is the median idle and 58 is the top of the occupied band. <strong>A step label therefore does not mean the same thing across revs — rev B's R2 is not rev C's R2</strong>, and the ladder shape is preserved (№13 remains the sole cracked R4) rather than the ladder's numbers. Three members are drawn here for the first time: <code>@tools/lint-elements</code> and <code>@tools/warn-lanes</code> (born 2026-08-31, #639) and <code>@tools/eslint-ts-parser</code> (born 2026-08-16, #557) — the "28th member on no map" rev B recorded in its own total, now placed. All three are still the cleanest machines in the yard for rust — none above R1 — though <code>lint-elements</code> has since lit its first puff (${g(28).steam} commits). The steam total (${TOT_STEAM} member-touches from ${PLATE.windowCommits} window commits) double-counts commits that touch several members, as any per-member count must; the window commit count is given so the two are never confused.</p>

**plate lettering** (`sheet7b.mjs:232`, verbatim source):

> ```
> ${txt(1180, 156, 'R3 ≤58 · R4 >180 (RE-CUT AT REV C)', 'lbls')}
> ```

**generator comment** (`sheet7b.mjs:15`):

> ```
> //         steps RE-CUT at rev C on the 2026-08-31 idle distribution (sheet 13):
> ```

**generator comment** (`sheet7b.mjs:23`):

> ```
> //         rendered from the plate).  Band edges are rev C's and stay: 0 puffs ≤2 ·
> ```

**generator comment** (`sheet7b.mjs:36`):

> ```
> //         the atlas's own drawings.  Commit ffd4ef7 answered it.  At rev C the
> ```

**generator comment** (`sheet7b.mjs:84`):

> ```
> // weathering census, ladder re-cut at rev C).  null = no machine on the pad.
> ```

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: whole-cabinet refresh — the PIPES channel now reads the build graph off census-plate.json (${BUILD.real} real of ${BUILD.nodes} nodes) instead of a hand-pasted 22 of 113

resolved →

> REV D: whole-cabinet refresh — the PIPES channel now reads the build graph off census-plate.json (24 real of 114 nodes) instead of a hand-pasted 22 of 113

**prose paragraph** (`sheet7b.mjs:344`, verbatim source):

> <p><strong>The sprite decorates; the census still governs.</strong> Every block is sheet 7 rev D's, unchanged: footprint 1.6·√sloc, height 3 px per authored file, spec annexes beside their buildings, gate severity in the same colours with the same uniform hatch including the cap. The Working Plant sprite (concept 3 of the sprite studies) adds four state channels as overlays. The design guard from the study is enforced: rust is a dotted <em>speckle</em> at partial opacity on the flanks only — never the cap, never a 45° line hatch — so a red-gated pristine plant (uniform hatch, cap included) and a rusting never-gating plant cannot be confused, in either theme.</p>

**prose paragraph** (`sheet7b.mjs:347`, verbatim source):

> <p><strong>REV D — the last hand-pasted channel, and one contradiction closed.</strong> The whole plate cabinet was re-counted at ${PLATE.ref} @ ${PLATE.sha} in one pass, which caught the PIPES channel disagreeing with the atlas about its own subject: this plate said the <code>turbo run build</code> graph was 22 real tasks in 113 nodes while <code>census-plate.json</code>, drawn by sheets 3, 3A and 12, said ${BUILD.real} in ${BUILD.nodes}. PIPES now reads that plate, so the four sheets share one graph. STEAM moved with the window — ${PLATE.windowCommits} window commits against rev C's 358 — and the band edges hold: the same five plants steam at three puffs, and nothing crossed a band. RUST and LAMPS are unchanged and stay what they have always been on this plate: editorial constants keyed by badge, rust from sheet 13's weathering census and lamps from plate 7A's 2026-08-17 metering, neither re-run here.</p>

**prose paragraph** (`sheet7b.mjs:348`, verbatim source):

> <p><strong>The channels disagree, which is the point.</strong> A single wreck-to-splendor axis would have to average these stories away: <code>lit-ui-router</code> is the oldest masonry in the city <em>and</em> its hottest steam <em>and</em> fully lamped — old and running. The typedoc plugin is the only R4 rust on the sheet, cracked flanks and all, yet still emits a puff, because <code>index.ts</code> takes commits while <code>symbols/</code> sleeps its 234 days. <code>examples</code> steams at ${PUFFS(g(11).steam)} puffs with zero lamps and only R1 rust — worked on, untested, and no longer aging — and <code>docs</code> pairs the city's second-hottest steam with its dimmest metered light (${g(10).eff}% lit). The disagreement rev D drew sharpest here — <code>@tools/build_and_test</code> steaming while its lamp went <em>out</em> — turned out not to be one, and rev E says so: that reading divided a 2026-08-17 lit figure by a 2026-08-31 denominator, and re-metering finds the error summary lit like the rest of the cores, ${g(15).eff}% and two lamps. Work and light do move independently — <code>examples</code> and <code>docs</code> still prove it — but this particular plant was never dark. <code>@tools/happy-dom</code> keeps plate 7A's strangest fact: a plant with its own spec annex and no lamp lit, because the spec is a canary pointed upstream.</p>

**generator comment** (`sheet7b.mjs:12`):

> ```
> // file, placements and gate tiers exactly as sheet 7 rev D.  The sprite adds four
> ```

### REV E — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV E: the LAMPS channel is imported too — plate 7A's light is a filed snapshot now (census-shadow.json, ${SHADOW.ref} @ ${SHADOW.sha}), so rust is the last editorial channel on this sheet and №31 finally reads a lamp

resolved →

> REV E: the LAMPS channel is imported too — plate 7A's light is a filed snapshot now (census-shadow.json, origin/main @ 185d414), so rust is the last editorial channel on this sheet and №31 finally reads a lamp

**prose paragraph** (`sheet7b.mjs:346`, verbatim source):

> <p><strong>REV E — the lamps stop being a transcription, and one of them was never out.</strong> Plate 7A's light was the last figure on this sheet that still travelled by clipboard: a column of lit-share percentages typed off a printed plate whose own metering dated from 2026-08-17, while every channel around it had moved to a filed snapshot. 7A's metering is a scripted probe now, so the lamps are <em>read</em> from its plate — <code>diagrams/data/census-shadow.json</code>, ${SHADOW.ref} @ ${SHADOW.sha} — and a plant this sheet draws that the light plate does not carry is a build error rather than an empty slot. Seven plants change: №31 <code>eslint-plugin-lit-ui-router</code> reads ${g(31).lamps} lamps at ${g(31).eff}% where rev D had no slots to read at all, №29 <code>@tools/warn-lanes</code> turns out to have a meter after all and lights ${g(29).lamps} at ${g(29).eff}% rather than the accent lamp rev D gave it, №20 <code>@tools/oxc-emit</code> lights its first (${g(20).eff}%), and №1, №12, №15 and №16 all move a little now that light and mass are counted at one ref. The largest of those is the one worth naming: <code>@tools/build_and_test</code> goes from one lamp to ${g(15).lamps} at ${g(15).eff}%, because rev D's "lamp that went out" was an artefact of dividing an August meter by an end-of-month census, not a suite that stopped covering. RUST is now the only editorial constant on this sheet.</p>

**generator comment** (`sheet7b.mjs:26`):

> ```
> //         diagrams/data/census-shadow.json (rev E — the last hand-pasted channel
> ```

### REV F — 2026-09-04

**`sub` clause** (verbatim source):

> REV F 2026-09-04: cabinet refresh after the 1.11.2 + mobx 1.0.0 releases — №32 @tools/embed-heights joins the plant at rust 0, its lamp metered by its own node:test suite

### REV G — 2026-09-06

**`sub` clause** (verbatim source):

> REV G 2026-09-06: the telemetry box re-cut — the rust ladder had outgrown the wall it was drawn to and ran off the plate, so the reading takes a continuation line and the box is sized to the widest line that remains and hung on the plate’s right margin, clear of the packages lettering



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-17 (8160cf3 `docs: add plate 7B, the working city — the first sprite plate, the census running`)
- REV B — 2026-08-31 (053cc87 `docs: hidden-line pass — opaque iso walls, true depth sort on the city plates`)
- REV C — 2026-08-31 (stated in `sub`; committed 2026-09-01, 8033db3 `docs: data refresh on the iso plates — 30 members, scc basis, rust ladder re-cut`; steam import landed 5eaabba 2026-09-02 `census pipeline I4 wave 2`)
- REV D — 2026-09-03 (96f89fe `feat: census pipeline — full cabinet refresh at origin/main eb32b4e`)
- REV E — 2026-09-03 (2e72a39 `feat: census pipeline — 7A lamps reconstructed as census-shadow probe`)
- REV F — 2026-09-04 (stated in `sub`; 4332b21 `feat: cabinet refresh at b2338d0 — 1.11.2 + mobx 1.0.0, embed-heights placed`)
- REV G — 2026-09-06 (stated in `sub`; 2795066 `feat: the plates draw in DIN — monospace reserved for code`)

**Pinned literal numbers, by revision:**

- REV B — rev B's R2 band `30–34d`; rev B's rust steps `R3 ≤41`, `R4 >180`; rev B's pipes `22 real of 103` (later `22 of 113` in the rev D ¶ — the two figures disagree in the source); `16` oxlint errors; `ffd4ef7`; rev B's steam: "three plants steam at three puffs where rev B drew three"; "rev B's own total" recorded a "28th member on no map".
- REV C — rust ladder `0 ≤14 · R1 ≤30 · R2 ≤37 · R3 ≤58 · R4 >180`; the empty gap `61–180`; steam bands `0 ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16`; `nine members`, `42–58-day band`, rev B's `R3 ≤41`, `nothing sat between 60 and 180`, `2026-08-17 histogram`, `#639`, `#557`, `№13` (sole cracked R4), `30 plants`, `№31` born `2026-09-01`, rev C's window commits `358` (cited in rev D), `16` oxlint errors, `ffd4ef7`.
- REV D — `22 of 113` / `22 real tasks in 113 nodes` (the retired hand-pasted figure — note the source comment at the head of the file still says `rev B: 22 real of 103`), rev C's `358` window commits, `2026-08-17` (lamp metering date), `08-17` on the telemetry line. `${BUILD.real}`, `${BUILD.nodes}`, `${PLATE.windowCommits}` resolve from census-plate.json / census-steam.json.
- REV E — `Seven plants change`; lamp bands `≥90 / ≥50 / >0`; `2026-08-17`; `№31`, `№29`, `№20`, `№1`, `№12`, `№15`, `№16`; "goes from one lamp to ${g(15).lamps}". Live values resolve from census-shadow.json.
- REV F — `1.11.2`, `mobx 1.0.0`, `№32`, rust step `0`.
- REV G — box `388 × 148` at `x=1152, y=96`.

**Callout continuation lettering** — lines of a revision's callout block that carry no `REV` token of their own, so the REV-keyed pass above did not catch them:

- REV D — `` txt(1168, 210, `PIPES — turbo run build graph: ${BUILD.real} real of ${BUILD.nodes} nodes, last green 08-17`, 'lbls') ``
- REV E — `txt(1168, 192, 'LAMPS — 7A lit share: 3 ≥90 · 2 ≥50 · 1 >0 · accent = unmetered e2e', 'lbls')`

**Revisions with no prose paragraph of their own:**

- REV A — none — rev A is never named; the sheet's first printing is only referenced through rev B.
- REV B — none dedicated; rev B's alarm has its own ¶, quoted under rev C below.
- REV F — none dedicated; referenced inside the channels ¶ — "and, since rev F's window, <code>examples</code> (${g(11).steam})".
- REV G — none dedicated.

**Basis (stated): `BASIS = \`counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})\`` — diagrams/data/census-steam.json (STEAM), with `WINDOW = \`${PLATE.window.since}..${PLATE.window.until}\``. Channels carry separate bases: massing/tiers from census-city.json via sheet 7's `PLACED`; lamps from census-shadow.json (`${SHADOW.ref} @ ${SHADOW.sha}`); pipes from census-plate.json; rust from sheet 13's weathering census (the one editorial channel left).**

**Present-state sentences that carry history** (re-draft candidates):

- source comment (head): "Massing follows sheet 7, never the sprite: side = 1.6·√sloc, height = 3 px per file, placements and gate tiers exactly as sheet 7 rev D."
- source comment: "A step label does NOT mean across revs what it meant before: rev B's R2 (30–34d) is not rev C's R2 (31–37d)."
- source comment: "Commit ffd4ef7 answered it. At rev C the register is CLEAR, and the triangle is struck rather than deleted: an answered alarm is a record, not an erasure."
- source comment: "// RUST step per member — the one editorial channel left on this sheet (sheet 13's weathering census, ladder re-cut at rev C). null = no machine on the pad."
- caption: "Rev B’s one alarm rang over no plant at all — it rang over the drawings; rev C draws it struck through, because it was answered."
- sub: "re-surveyed 2026-08-31"
- notes ¶ "The sprite decorates; the census still governs.": "Every block is sheet 7 rev D's, unchanged: footprint 1.6·√sloc, height 3 px per authored file, spec annexes beside their buildings, gate severity in the same colours with the same uniform hatch including the cap."
- notes ¶ "Every channel is measured…": "five steps cut where the idle histogram actually cuts — re-cut at rev C, see below. The top step is still the empty gap nothing occupies (now 61–180 days), so R4 means genuinely sealed, and only the typedoc plugin wears it."
- notes ¶ same: "The band edges are rev C's and are kept: 0 puffs ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16. What no longer holds is the claim that those edges sit in empty air — 3, 9 and 16 are all occupied on this window, so the bands are stated here as editorial, not as gaps."
- notes ¶ same: "Six plants steam at three puffs where rev B drew three: … and, since rev F's window, <code>examples</code> (${g(11).steam})."
- notes ¶ same: "and at rev E that number is <em>read</em> from plate 7A's own snapshot … rather than transcribed off a printed sheet"
- notes ¶ "The channels disagree, which is the point.": "The disagreement rev D drew sharpest here — <code>@tools/build_and_test</code> steaming while its lamp went <em>out</em> — turned out not to be one, and rev E says so: that reading divided a 2026-08-17 lit figure by a 2026-08-31 denominator, and re-metering finds the error summary lit like the rest of the cores, ${g(15).eff}% and two lamps. Work and light do move independently — <code>examples</code> and <code>docs</code> still prove it — but this particular plant was never dark."
- notes ¶ same: "The typedoc plugin is the only R4 rust on the sheet, cracked flanks and all, yet still emits a puff, because <code>index.ts</code> takes commits while <code>symbols/</code> sleeps its 234 days."
- notes ¶ same: "<code>examples</code> steams at ${PUFFS(g(11).steam)} puffs with zero lamps and only R1 rust — worked on, untested, and no longer aging"
- notes ¶ "The one alarm rev B drew has been answered…": "this is the third time the set has moved its own subject, after the lodash swap on sheet 8 and the lit dedupe on sheet 10."
- notes ¶ "Steam by import…": "The other two channels still carry their older bases: rust is sheet 13's weathering census and lamps are plate 7A's 2026-08-17 metering, both labelled as such wherever they are printed." (stale at rev E)
- plate lettering (schedule total): `` `TOTAL — ${RUNNING} plants running, 0 seized · steam ${TOT_STEAM} member-touches from ${PLATE.windowCommits} window commits (${WINDOW}) · ${METERED} metered-lamp plants + ${ACCENT} accent · steam ${BASIS}; rust and lamps carry their own older bases` `` (the tail is stale at rev E)
- key row: `pipe, connected — the build graph’s ${BUILD.real} real tasks, last green`
- key row: `'alert, struck — rev B’s one red gate, answered by ffd4ef7'`
- key row: `'gate severity — sheet 7’s, uniform hatch incl. cap'`

## Sheet 8 — THE DELIVERED CITY

- **file** `diagrams/generator/sheet8.mjs` · **id** `delivered` · **current rev** D
- **basis** (source): `const BASIS = `measured at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)}), closure of ${PLATE.app}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 1½ — what npm actually installs for one consumer · sample-app-lit-vanilla

### REV A — undated in the copy

**prose paragraph** (`sheet8.mjs:191`, verbatim source):

> <p><strong>The drawing changed the city — twice.</strong> Rev A drew lodash 4.18.1 as the tallest building on the skyline — 45,205 lines, 1,048 files, delivered for four imports (<code>isEqual</code>, <code>cloneDeep</code>, <code>get</code>, <code>set</code>). That finding became PR #604: the swap to <code>lodash-es</code> halved the building to ${fmt(pkg('lodash-es').l)} lines and ${pkg('lodash-es').f} files, dropping it to fourth place behind dompurify, hono, and @uirouter/core. The bundler always tree-shook the wire cost — sheet 9 charts that collapse, 25 KB → 4 KB — but the delivered city is what installs, audits, and updates, and it is 23,000 lines lighter.</p>

**plate lettering** (`sheet8.mjs:166`, verbatim source):

> ```
> ${txt(40, 226, `rev A: 45,205 lines · now ${fmt(pkg('lodash-es').l)}`, 'lbls')}
> ```

### REV B — undated in the copy

**plate lettering** (`sheet8.mjs:169`, verbatim source):

> ```
> ${txt(1120, 48, 'rev B drew the lit stack twice (2.8.0 · 3.3.3);', 'lbla', 'end')}
> ```

**other rev-bearing copy** (`sheet8.mjs:153`):

> ```
> const svg = `<svg viewBox="0 0 1160 ${SY + 90 + half * 17}" role="img" aria-label="The production node_modules of one sample app drawn as an isometric city: ${DELIVERED} delivered packages plus the app's own building, footprint area from delivered file counts, height from lines of code on disk, hatched annexes for type declarations. The app's own ${APP_L}-line building is dwarfed by ${fmt(TOT_L)} delivered lines — lodash-es, halved by the swap this sheet argued for, still delivers ${fmt(pkg('lodash-es').l)} lines for four imports. Rev B drew two complete copies of the lit stack; the lit 2.8.0 twins were removed by scoped overrides, and this revision recounts the smaller city. Every count is imported from the checked-in census plate. A structure schedule lists every package with exact counts.">
> ```

### REV C — undated in the copy; first in git 2026-08-17

**`sub` clause** (verbatim source):

> REV C: recounted after the lit de-duplication · 2026-08-17

**prose paragraph** (`sheet8.mjs:192`, verbatim source):

> <p><strong>Rev C: the lit twins are gone.</strong> Rev B found the demo chrome shipping a second, complete lit — <code>lit-dialog</code> and the api-viewer panels hard-depend on lit ^2, so lit, lit-html, lit-element, and @lit/reactive-element were each delivered twice, twin pairs on the skyline. That finding became PR #618: scoped pnpm overrides (<code>@api-viewer/docs&gt;lit</code>, <code>@api-viewer/common&gt;lit</code>, <code>lit-dialog&gt;lit</code> → ^3.3.3) retire the 2.8.0-era tree. Four buildings vanished — lit 2.8.0, lit-html 2.8.0, lit-element 3.3.3, @lit/reactive-element 1.6.3: 287 files and 14,114 lines of code, plus 7,781 d.ts lines — and the city shrank from 36 delivered packages to 32, 190,122 lines to 176,022. The same PR made the api-docs panel lazy-load, which is why <code>sample-app-shared</code>'s dist grew 14 lines (3,776 → 3,790); every other surviving building measures exactly what it did in rev B. And <code>hono</code> (30,489 lines) still stands here because <code>ui-router-server</code> names it a peer: a server framework delivered into a client demo by peer auto-install.</p>

**prose paragraph** (`sheet8.mjs:194`, verbatim source):

> <p><strong>Numbers by import, not by paste.</strong> Every count on the drawing and in this note is now read from <code>diagrams/data/census-nm.json</code>, the snapshot <code>census-nm.mjs</code> writes after installing and building the ref itself; this file holds the drawing order, the hand-placed districts and the prose only, and a package it draws that the plate does not carry — or a package the plate carries that no district draws — is a build error rather than a stale constant. The same ${DELIVERED} buildings stand: the set has not changed since the hand count, only the counts. <code>lit-ui-router</code>'s own delivered shape moved most — ${fmt(pkg('lit-ui-router').l)} lines over ${pkg('lit-ui-router').f} files against the 798 over 12 pasted here in rev C, several releases of dist ago (the plate reads ${pkg('lit-ui-router').label}) — and the rest is drift in the registry: <code>hono</code> ${pkg('hono').label} delivers ${fmt(pkg('hono').l)} where 4.13.1 delivered 30,489, <code>sample-app-shared</code>'s dist is ${fmt(pkg('sample-app-shared').l)} where it was 3,790, and <code>@oxc-project/runtime</code> advanced three minors to ${pkg('@oxc-project/runtime').label} without changing a single line it delivers. The city totals ${fmt(TOT_L)} lines against rev C's hand-counted 176,022.</p>`,

### REV D — 2026-08-31

**`sub` clause** (verbatim source):

> REV D 2026-08-31: hidden-line pass — opaque faces, masses painted back to front, no rear wall through a front one · every number now imported from diagrams/data/census-nm.json — ${BASIS}

resolved →

> REV D 2026-08-31: hidden-line pass — opaque faces, masses painted back to front, no rear wall through a front one · every number now imported from diagrams/data/census-nm.json — measured at origin/main @ 185d414 (2026-09-07), closure of apps/sample-app-lit-vanilla



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-16 (652def4 "docs: fix sheet 7 schedule render and add sheet 8 node_modules census")
- REV B — 2026-08-16 (c517fbc "docs: remeasure sheets 8-9 to rev b after the lodash-es swap")
- REV C — 2026-08-17 (51e0bd4 "docs: recount sheet 8 after the lit de-duplication (rev C)"; date also stated in `sub`)
- REV D — 2026-08-31 (053cc87 "docs: hidden-line pass — opaque iso walls, true depth sort on the city plates"; the "every number imported" half landed 2026-09-02, af7af45 "census pipeline I5 wave 2")

**Pinned literal numbers, by revision:**

- REV A — lodash 4.18.1 · 45,205 lines · 1,048 files · four imports · PR #604 · 25 KB → 4 KB · "23,000 lines lighter" · [`fmt(pkg('lodash-es').l)` = 22,193; `pkg('lodash-es').f` = 644]
- REV B — lit 2.8.0 · 3.3.3 · PR #618 · −4 buildings · −14,114 lines · 36 delivered packages · 190,122 lines · sample-app-shared dist 3,776
- REV C — lit ^2 · ^3.3.3 · lit 2.8.0 · lit-html 2.8.0 · lit-element 3.3.3 · @lit/reactive-element 1.6.3 · 287 files · 14,114 lines · 7,781 d.ts lines · 36 → 32 packages · 190,122 → 176,022 lines · 14 lines (3,776 → 3,790) · hono 30,489 lines · PR #618
- REV D — 798 lines over 12 files (the rev C paste) · hono 4.13.1 delivered 30,489 · sample-app-shared 3,790 · "three minors" · rev C hand count 176,022 · [`DELIVERED` = 32; lit-ui-router 1,525 lines / 26 files, label "lit-ui-router 1.11.2"; hono label "hono 4.13.5", 30,731 lines; sample-app-shared 3,890; @oxc-project/runtime label "@oxc-project/runtime 0.147.0"; `TOT_L` = 177,091]

**Callout continuation lettering** — lines of a revision's callout block that carry no `REV` token of their own, so the REV-keyed pass above did not catch them:

- REV B — `txt(1120, 60, 'PR #618 scoped the overrides — the 2.8.0 twins', 'lbla', 'end')`
- REV B — `txt(1120, 72, 'are gone: −4 buildings, −14,114 lines', 'lbla', 'end')`
- REV D — `txt(1120, 90, `every number on this sheet is read from diagrams/data/census-nm.json — ${BASIS}`, 'lblf', 'end')`

**Revisions with no prose paragraph of their own:**

- REV B — no standalone REV B paragraph — rev B's finding is narrated inside the rev C paragraph ("Rev B found the demo chrome shipping a second, complete lit …")

**Basis (stated): `measured at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0,10)}), closure of ${PLATE.app}` → resolves to "measured at origin/main @ 185d414 (2026-09-07), closure of apps/sample-app-lit-vanilla" (from diagrams/data/census-nm.json)**

**Present-state sentences that carry history** (re-draft candidates):

- sub: "REV C: recounted after the lit de-duplication" — the recount stated as the sheet's present condition.
- aria-label: "The app's own ${APP_L}-line building is dwarfed by ${fmt(TOT_L)} delivered lines — lodash-es, halved by the swap this sheet argued for, still delivers ${fmt(pkg('lodash-es').l)} lines for four imports."
- aria-label: "Rev B drew two complete copies of the lit stack; the lit 2.8.0 twins were removed by scoped overrides, and this revision recounts the smaller city. Every count is imported from the checked-in census plate."
- notes ¶ Method: "The closure is resolved and measured inside an installed and built archive of a named ref, not in a working tree, and written to the plate <code>diagrams/data/census-nm.json</code>" — states the rule that replaced the earlier working-tree measurement.
- notes ¶ "The drawing changed the city — twice." — the heading clause itself is a history claim (two past revisions moved the city).
- notes ¶ rev C: "every other surviving building measures exactly what it did in rev B."
- notes ¶ rev C: "And <code>hono</code> (30,489 lines) still stands here because <code>ui-router-server</code> names it a peer" — "still stands" carries the prior survey.
- notes ¶ "Note the vertical scale:": "Drawn at the workspace's own scale, even the halved lodash-es would stand 653 px tall — the compression *is* the finding." (pinned: 653 px; 1 px ≈ 250 lines against sheet 7's ≈ 34)
- notes ¶ rev D: "The same ${DELIVERED} buildings stand: the set has not changed since the hand count, only the counts."
- notes ¶ rev D: "<code>lit-ui-router</code>'s own delivered shape moved most … several releases of dist ago".
- plate lettering: `txt(40, 226, 'rev A: 45,205 lines · now …')` — a present-state "now" against a rev A figure.

## Sheet 9 — THE SHIPPED CITY

- **file** `diagrams/generator/sheet9.mjs` · **id** `shipped` · **current rev** G
- **basis** (source): `const BASIS = `measured at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)}) · ${PLATE.wasGeneratedBy}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2¾ — what the browser downloads · lit-ui-router.dev, one deploy · 575 files, 3.1 MB on the wire

### REV A — undated in the copy

**prose paragraph** (`sheet9.mjs:162`, verbatim source):

> <p><strong>The ghost district was the instrument, twice.</strong> Rev A reported twelve orphan files, 138 KB of dead weight in every deploy — but that survey read an accumulated local <code>dist/</code>, where parallel app builds pile up stale hashes. Rev C rebuilt from a clean checkout and reported exactly one unreachable file, a 1.7 KB custom-elements manifest, and the drawing made a rule of it: a clean tree ships exactly one. That rule was also an artifact. The scripted probe's reachability walk follows the backtick-quoted asset URLs the app chunks build by hand, and the manifest is reachable after all: the orphan list on this plate is <em>empty</em>. The hatched ghost block is struck from the drawing, and the caution survives it in stronger form — twice now, the orphans were a property of the instrument, not of the deploy.</p>

### REV B — undated in the copy

**prose paragraph** (`sheet9.mjs:161`, verbatim source):

> <p><strong>The panel that waited its turn.</strong> The api-viewer docs panel — marked, dompurify, three <code>@api-viewer</code> packages — only renders behind a feature flag, but rev B's apps carried it in the eager main chunk anyway. It now arrives as a lazy <code>api-docs</code> chunk, and every app's main chunk drops 34 → 7 KB gz: the hash app's whole district is ${HASH.files} files and ${KB(HASH.gz)}. Same bytes on the CDN, different bytes on the critical path.</p>

### REV C — undated in the copy

**prose paragraph** (`sheet9.mjs:160`, verbatim source):

> <p><strong>The product is a guest in its own city.</strong> The three routed sample apps — the thing the site exists to demonstrate — total ${KB(APPS)} gzipped, ${APP_PCT}% of the deploy. The rise from rev C's 173 KB / 4.5% is mostly bookkeeping: that survey counted the visualizer chunk with the page chunks, and on the scripted census, first claim seats <code>visualizer.esm</code> (and the custom-elements manifest) in <code>app: vanilla</code>, which is why that district reads ${VANILLA.files} files and ${KB(VANILLA.gz)}. The bytes on the CDN did not move. What did move at rev C stands: PR #618 scoped an override so the <code>@api-viewer</code>/<code>lit-dialog</code> stack shares one lit 3.3.3, and identical lit chunks now hash identically <em>across</em> apps, so part of mobx's download is chunks vanilla already shipped.</p>

**prose paragraph** (`sheet9.mjs:165`, verbatim source):

> <p><strong>One example outweighs the router.</strong> The examples district (${EXAMPLES.files} files, ${KB(EXAMPLES.gz)}, and two examples wider than rev C — the design-system-links tutorial and the lint-eslint example) is led by the hellogalaxy demo's <code>model-viewer</code> chunk at ${KB(EXAMPLES.top.gz)} on its own — heavier than all three sample apps combined, delivered so one tutorial page can spin a galaxy.</p>`,

**plate lettering** (`sheet9.mjs:130`, verbatim source):

> ```
> ${txt(1120, 727, `${APP_PCT}% of the deploy (rev C read 4.5%, pre-attribution)`, 'lbla', 'end')}
> ```

**plate lettering** (`sheet9.mjs:135`, verbatim source):

> ```
> ${txt(110, 614, 'REV C (#618): one lit major, and api-viewer waits', 'lbla')}
> ```

### REV D — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV D: hidden-line pass — opaque tenant walls painted back to front

### REV E — 2026-09-03

**`sub` clause** (verbatim source):

> REV E 2026-09-03: every count now imported from diagrams/data/census-shipped.json — the ghost district is struck from the drawing

**plate lettering** (`sheet9.mjs:139`, verbatim source):

> ```
> ${txt(110, 674, 'REV E: every district read from the census plate —', 'lbla')}
> ```

### REV F — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV F: whole-cabinet refresh — the HTML pages overtook Inter, measured at origin/main @ b2338d0 (2026-09-04)

**prose paragraph** (`sheet9.mjs:163`, verbatim source):

> <p><strong>REV F — the whole cabinet, one ref, and a district changed places.</strong> Every plate in <code>diagrams/data/</code> was re-counted at origin/main @ b2338d0 in one pass, and this deploy moved where the shopfront grew: 593 files against rev E's 586, the same 12 districts, still no orphans, 4.0 MB on the wire — 126,991 gzipped bytes more than rev E, on a four-megabyte deploy. The examples district took most of it (four more files, the lint-eslint example landing); the three documentation districts — html pages, page chunks and the VitePress framework — each gained a percent or two as the guides grew, and that was enough to settle the closest race on the sheet. The HTML pages have overtaken Inter: 883,505 gz against 866,700, a 16,805-byte lead where rev E had the fonts ahead by 504. The reading stands as it did, only sharper — the two tallest things this documentation site ships are prose and typography, and the corpora still tower over both.</p>

**generator comment** (`sheet9.mjs:45`):

> ```
> // plan as a vacant footprint at rev F's side, so the skyline change is drawn.
> ```

**generator comment** (`sheet9.mjs:99`):

> ```
> // at rev F the HTML district passed the fonts — the label has to know which way
> ```

**other rev-bearing copy** (`sheet9.mjs:114`):

> ```
> const svg = `<svg viewBox="0 0 1160 ${SY + 108 + half * 17}" role="img" aria-label="The production docs-site deploy drawn as an isometric city of ${all.length} districts: footprint area from file counts, height from gzipped bytes on the wire. The tallest towers are the prerendered HTML pages and the Inter font files, not code; the demo text corpora that stood tallest until rev F left the deploy, and their lot is drawn vacant. The three routed sample apps are small accent buildings totalling ${APP_PCT} percent of the deploy. There is no ghost block: the scripted census walks backtick-quoted asset URLs too, and a clean deploy ships no unreachable files at all. A structure schedule lists every district with exact counts and its largest tenant.">
> ```

### REV G — 2026-09-07

**`sub` clause** (verbatim source):

> REV G 2026-09-07: re-surveyed after #716 dropped the sample app's markov seed pipeline — the corpora district (15 files, 899 KB, the tallest tower since rev A) left the deploy with three static data files, so ${all.length} districts stand and the HTML pages are the skyline; the corpora's lot is drawn vacant — ${BASIS}

resolved →

> REV G 2026-09-07: re-surveyed after #716 dropped the sample app's markov seed pipeline — the corpora district (15 files, 899 KB, the tallest tower since rev A) left the deploy with three static data files, so 11 districts stand and the HTML pages are the skyline; the corpora's lot is drawn vacant — measured at origin/main @ 185d414 (2026-09-06) · diagrams/generator/census-shipped.mjs

**prose paragraph** (`sheet9.mjs:159`, verbatim source):

> <p><strong>The tallest building is the prose.</strong> For five revisions the skyline belonged to the demo corpora — novels, Beowulf, an RFC, pre-gzipped <code>.txt.gz</code> so compression couldn't help further. They are gone (see REV G), and the city's tallest district is now the site's ${PAGES.files} prerendered HTML pages at ${KB(PAGES.gz)}, with Inter's ${INTER.files} <code>woff2</code> faces ${PAGES_LEAD ? `${fmt(LETTER_GAP)} bytes behind` : `${fmt(LETTER_GAP)} bytes ahead`} at ${KB(INTER.gz)}. Code still doesn't crack the top two: on the wire, this documentation site is mostly prose and typography, and the first script district — the examples, led by one galaxy — stands third at ${KB(EXAMPLES.gz)}.</p>

**prose paragraph** (`sheet9.mjs:164`, verbatim source):

> <p><strong>REV G — the tallest tower left town.</strong> PR #716 dropped the sample app's markov seed pipeline, and with it the fifteen pre-gzipped corpora that had been this city's tallest district since rev A: 899 KB of Dickens, Beowulf, Flatland and an RFC, plus three of the static data files that fed them. Re-surveyed at ${PLATE.ref} @ ${PLATE.sha}, the deploy is ${fmt(PLATE.totals.files)} files against rev F's 593 and ${MB(PLATE.totals.gzBytes)} on the wire against 4.0 — ${fmt(4164505 - PLATE.totals.gzBytes)} gzipped bytes lighter, ${((1 - PLATE.totals.gzBytes / 4164505) * 100).toFixed(0)}% of the deploy, on a change that touched no page and no script. Nothing else moved: Inter is identical to the byte, the HTML pages gained ${fmt(PAGES.gz - 883505)}. The corpora's lot stays on the plan, drawn vacant beside the images, because a skyline that loses its landmark should show where it stood. The routed apps' share rises to ${APP_PCT}% without a byte of theirs changing — the same arithmetic that made rev C's 4.5% a bookkeeping number cuts the other way when the city shrinks around them.</p>

**plate lettering** (`sheet9.mjs:141`, verbatim source):

> ```
> ${txt(110, 710, `REV G: the tallest tower left town — ${KB(LOT.gz)} of corpora`, 'lbla')}
> ```

**generator comment** (`sheet9.mjs:44`):

> ```
> // REV G: the corpora district left the deploy with #716. Its lot stays on the
> ```

**other rev-bearing copy** (`sheet9.mjs:156`):

> ```
> caption: `The production docs deploy surveyed on the wire: ${fmt(PLATE.totals.files)} files, ${MB(PLATE.totals.gzBytes)} gzipped, drawn as ${all.length} districts — the tallest towers are now prerendered prose and font files — the sample novels left the deploy at rev G, and their lot is drawn vacant — the routed apps are ${KB(APPS)} of accent buildings in their own city, and the ghost block is gone: a clean deploy ships no unreachable files at all.`,
> ```



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-16 (b227928 "docs: add sheet 9 shipped city closing the survey trilogy")
- REV B — 2026-08-16 (c517fbc "docs: remeasure sheets 8-9 to rev b after the lodash-es swap")
- REV C — 2026-08-17 (987f909 "docs: remeasure sheets 9 and 10 after the lit dedupe merge")
- REV D — 2026-08-31 (053cc87 "docs: hidden-line pass — opaque iso walls, true depth sort on the city plates")
- REV E — 2026-09-03 (3cb58f3 "census pipeline I5 — sheet 9 reads the shipped-city plate (rev E, ghost district struck)"; date stated in `sub`)
- REV F — 2026-09-05 (999e663 "docs(atlas): stale-claims pass at b2338d0"; the sheet states its measured ref as origin/main @ b2338d0, 2026-09-04)
- REV G — 2026-09-07 (cf45bb0 "feat: cabinet refresh at 185d414…"; date stated in `sub`)

**Pinned literal numbers, by revision:**

- REV A — twelve orphan files · 138 KB · "five revisions" (the corpora's tenure, rev A–F) · [PAGES.files = 135, KB(PAGES.gz) = 863 KB; INTER.files = 16, KB(INTER.gz) = 846 KB; LETTER_GAP = 16,918 bytes, PAGES_LEAD = true → "16,918 bytes behind"; KB(EXAMPLES.gz) = 619 KB]
- REV B — 34 → 7 KB gz · [HASH.files = 4, KB(HASH.gz) = 14.3 KB]
- REV C — 173 KB · 4.5% · 1.7 KB manifest · 34 → 7 KB · lit 3.3.3 · PR #618 · [KB(APPS) = 199 KB, APP_PCT = 6.2; VANILLA.files = 18, KB(VANILLA.gz) = 119 KB]
- REV E — rev E's own totals appear only in the REV F paragraph — 586 files, 12 districts, fonts ahead by 504 bytes
- REV F — b2338d0 · 2026-09-04 · 593 files · rev E 586 files · 12 districts · 4.0 MB · 126,991 gz bytes · four more files · 883,505 gz vs 866,700 · 16,805-byte lead · rev E fonts ahead by 504
- REV G — PR #716 · fifteen corpora · 899 KB (LOT.gz = 899000, KB → "878 KB") · three static data files · rev F 593 files · rev F 4.0 MB · rev F baseline gz 4,164,505 · 883,505 (rev F HTML) · rev C 4.5% · [PLATE.totals.files = 575; MB(gzBytes) = 3.1 MB; 4164505 − 3264461 = 900,044 bytes lighter; pct = 22%; PAGES.gz − 883505 = 113; APP_PCT = 6.2; all.length = 11]

**Callout continuation lettering** — lines of a revision's callout block that carry no `REV` token of their own, so the REV-keyed pass above did not catch them:

- REV C — `txt(110, 626, 'in a lazy api-docs chunk — every main shrinks', 'lbla')`
- REV C — `txt(110, 638, '34 → 7 KB, and mobx now rides chunks vanilla', 'lbla')`
- REV C — `txt(110, 650, 'already ships', 'lbla')`
- REV E — `txt(110, 686, 'first claim now seats the visualizer in app: vanilla', 'lbla')`
- REV G — `txt(110, 722, 'gone with #716, and the skyline is prose, then type', 'lbla')`

**Revisions with no prose paragraph of their own:**

- REV B — no standalone REV B paragraph; rev B is the "before" in the panel paragraph — `<p><strong>The panel that waited its turn.</strong> The api-viewer docs panel — marked, dompurify, three <code>@api-viewer</code> packages — only renders behind a feature flag, but rev B's apps carried it in the eager main chunk anyway. It now arrives as a lazy <code>api-docs</code> chunk, and every app's main chunk drops 34 → 7 KB gz: the hash app's whole district is ${HASH.files} files and ${KB(HASH.gz)}. Same bytes on the CDN, different bytes on the critical path.</p>`
- REV D — none (drawing-technique revision, no prose paragraph)

**Basis (stated): `measured at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0,10)}) · ${PLATE.wasGeneratedBy}` → resolves to "measured at origin/main @ 185d414 (2026-09-06)" (from diagrams/data/census-shipped.json; totals 575 files, 15,115,644 raw, 3,264,461 gz)**

**Present-state sentences that carry history** (re-draft candidates):

- sub: "${fmt(PLATE.totals.files)} files, ${MB(PLATE.totals.gzBytes)} on the wire" — the present total the rev F/G clauses are measured against.
- caption: "the tallest towers are now prerendered prose and font files — the sample novels left the deploy at rev G, and their lot is drawn vacant"
- caption: "and the ghost block is gone: a clean deploy ships no unreachable files at all."
- aria-label: "the demo text corpora that stood tallest until rev F left the deploy, and their lot is drawn vacant."
- aria-label: "There is no ghost block: the scripted census walks backtick-quoted asset URLs too, and a clean deploy ships no unreachable files at all."
- notes ¶ Method: "The probe builds <code>www/lit-ui-router.dev/dist</code> inside a materialized, installed archive of the ref, never the working tree" — the rule the rev A orphan miscount forced.
- notes ¶ "The tallest building is the prose.": "For five revisions the skyline belonged to the demo corpora … They are gone (see REV G)".
- notes ¶ "The tallest building is the prose.": "Code still doesn't crack the top two".
- notes ¶ "The product is a guest…": "The rise from rev C's 173 KB / 4.5% is mostly bookkeeping"; "The bytes on the CDN did not move."; "What did move at rev C stands".
- notes ¶ "The panel that waited its turn.": "rev B's apps carried it in the eager main chunk anyway. It now arrives as a lazy <code>api-docs</code> chunk"; "Same bytes on the CDN, different bytes on the critical path."
- notes ¶ "The ghost district was the instrument, twice." — the whole paragraph is retrospective; note especially "That rule was also an artifact." and "twice now, the orphans were a property of the instrument, not of the deploy."
- notes ¶ REV F: "The reading stands as it did, only sharper"; "and the corpora still tower over both" (a claim rev G overturned).
- notes ¶ REV G: "Nothing else moved: Inter is identical to the byte"; "the same arithmetic that made rev C's 4.5% a bookkeeping number cuts the other way when the city shrinks around them."
- notes ¶ "One example outweighs the router.": "two examples wider than rev C — the design-system-links tutorial and the lint-eslint example" [EXAMPLES.files = 18, KB = 619 KB, top chunk model-viewer at 275 KB].
- plate lettering: `txt(110, 558, 'no ghost district stands here any more:')` — "any more" carries revs A and C.
- key row: `'a vacant lot — a district that left the deploy'`.

## Sheet 10 — THE BUNDLED CITY

- **file** `diagrams/generator/sheet10.mjs` · **id** `bundled` · **current rev** E
- **basis** (source): `const BASIS = `${PLATE.app} · counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2⅞ — inside the wire: what the bundler kept · apps/sample-app-lit-vanilla, one bundle

### REV A — undated in the copy

**prose paragraph** (`sheet10.mjs:206`, verbatim source):

> <p><strong>The déjà vu is gone.</strong> Rev A's one redundancy tree-shaking could not reach — a second, complete lit 2.8.0 riding in with the docs-viewer stack, 5.2 KB of wire déjà vu — was a version split, so it took a dependency edit, not a bundler: PR #618 scopes a pnpm override (<code>^3.3.3</code>, a floor, not a pin) to <code>@api-viewer/*</code> and <code>lit-dialog</code>, and the census now counts one lit: ${KB(G('lit').gz)} gz across ${G('lit').mods} modules where two majors cost 12.5 KB. The intentional <code>lit-2</code> compat alias in <code>packages/*</code> is untouched — it is a test lane, and it never shipped.</p>

**other rev-bearing copy** (`sheet10.mjs:122`):

> ```
> 'lit': 'one lit major — rev A shipped two',
> ```

### REV C — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV C: every byte now read from the census-bundle plate — ${BASIS}

resolved →

> REV C: every byte now read from the census-bundle plate — apps/sample-app-lit-vanilla · counted at origin/main @ 185d414 (2026-09-06)

**prose paragraph** (`sheet10.mjs:203`, verbatim source):

> <p><strong>REV C — the numbers by import.</strong> The sheet no longer carries a hand-pasted census: every footprint, height, schedule row and door price is read at build time from the checked-in plates, and a group the drawing places but the plate does not carry is a build error rather than a stale constant. Two things the constants had smoothed over show up immediately. The plate names <code>lit</code> and <code>@api-viewer</code> as groups, so the old display labels that baked in a version number and a package count are gone — the module count each group actually contributes (×${G('lit').mods} and ×${G('@api-viewer').mods}) is printed instead, because that is a measured fact and the label was not. And <code>sample-app-routes</code>, which the previous print folded into the app's own source as a parenthesis, is a group of its own: ${fmt(G('sample-app-routes').r)} bytes kept, ${fmt(G('sample-app-routes').gz)} on the wire, one module — the smallest building on the map, and the shared route table three apps import.</p>

**plate lettering** (`sheet10.mjs:176`, verbatim source):

> ```
> ${txt(1150, 240, `REV C: one lit major, ${KB(G('lit').gz)} — rev A shipped two,`, 'lbla', 'end')}
> ```

### REV D — 2026-09-06

**`sub` clause** (verbatim source):

> REV D 2026-09-06: fills — every mass’s left-face tint and right-face hatch draw for the first time (a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); no mass moved

### REV E — 2026-09-06

**`sub` clause** (verbatim source):

> REV E 2026-09-06: the paper re-ruled — the five door frames tightened to the DIN line (144 → 116), the structure schedule opened to the plate’s full measure so its two columns get a real gutter instead of the left column running into the right, and every flush-right note now hangs on one margin at 1150



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-16 (693e6d8 "docs: add sheet 10 bundled city and clear every label collision")
- REV B — 2026-08-17 (987f909 "docs: remeasure sheets 9 and 10 after the lit dedupe merge")
- REV C — 2026-09-03 (91c6843 "census pipeline I5 — sheet 10 reads the bundle plate (rev C, named residual)")
- REV D — 2026-09-06 (b1c0942 "design pass p1 — full width, sticky key, util bar, title cover, t51 fills"; date stated in `sub`)
- REV E — 2026-09-06 (b1c0942, same design pass; date stated in `sub`)

**Pinned literal numbers, by revision:**

- REV A — lit 2.8.0 · 5.2 KB déjà vu · ^3.3.3 · PR #618 · 12.5 KB (two majors) · [KB(G('lit').gz) = 8.8 KB; G('lit').mods = 19]
- REV C — [G('lit').mods = 19; G('@api-viewer').mods = 12; sample-app-routes r = 292 bytes, gz = 59; VAN.gz = 122,127 over 18 files; T.gz = 120,098 over 17 chunks; RESID = 2,029 gz over 1 file]
- REV E — 144 → 116 (door frame width) · 1150 (right margin)

**Callout continuation lettering** — lines of a revision's callout block that carry no `REV` token of their own, so the REV-keyed pass above did not catch them:

- REV A — `txt(1150, 252, '12.5 KB; the déjà vu is gone (#618)', 'lbla', 'end')`

**Revisions with no prose paragraph of their own:**

- REV B — no standalone REV B paragraph; rev B is the unnamed "before" of the lazy-chunk paragraph — `<p><strong>Occupancy barely moved; arrival did.</strong> The same PR defers the api-viewer panel behind its feature flag, so marked, dompurify and <code>@api-viewer</code> — ${KB(CHROME_GZ + G('@api-viewer').gz)} gz of demo chrome — now ride a lazy <code>api-docs</code> chunk and the eager main chunk drops. This sheet's census is deliberately blind to that: it counts who occupies the bundle, and the occupants are the same tenants in new rooms. The lazy split's win is drawn on sheet 9, where the critical path lives.</p>`
- REV D — none (drawing-technique revision, no prose paragraph)
- REV E — none (typographic/ruling revision, no prose paragraph)

**Basis (stated): `${PLATE.app} · counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0,10)})` → resolves to "apps/sample-app-lit-vanilla · counted at origin/main @ 185d414 (2026-09-06)" (from diagrams/data/census-bundle.json; totals 17 chunks, 663,008 kept → 371,713 emitted → 120,098 gz)**

**Present-state sentences that carry history** (re-draft candidates):

- caption: "…and the app that uses it stand as three districts summing to ${KB(T.gz)}, with a single lit where the first printing drew two." [KB(T.gz) = 117.3 KB]
- aria-label: "a single lit stands where an earlier revision drew two lit majors"
- aria-label: "the demo-chrome district — visualizer, marked, dompurify, api-viewer, now largely deferred to a lazy chunk — outweighs the machine"
- aria-label: "the app district holds the shared demo code, the ${KB(G('lodash-es').gz)} lodash-es remainder, the app's own source and, new in this revision, a tiny building for the shared route table." [7.5 KB]
- notes ¶ Method: "run inside a materialized, installed archive of the measured ref rather than the working tree"; "whose misses land in a loud <code>other</code> row (this print: none)".
- notes ¶ Reconciliation: "The two sheets no longer meet at an identity, and the old header's byte-exact subtraction was a casualty of a rules change"; "<code>ui-router-visualizer.esm</code> is now first claimed by <code>app: vanilla</code>, so it sits inside that district rather than beside it."
- notes ¶ "The library is a skin over the machine.": "The two independent measurements still reconcile: the codecov door prices the bare <code>.</code> entry at ${fmt(door('.').gz)} gz with deps external, and this app's census pulls ${fmt(G('lit-ui-router').gz)} of it — the ${Math.round((1 - G('lit-ui-router').gz / door('.').gz) * 100)}% difference is what the app's own imports leave on the shelf." [5,607 gz; 4,655; 17%]
- notes ¶ "The déjà vu is gone.": "the census now counts one lit"; "The intentional <code>lit-2</code> compat alias in <code>packages/*</code> is untouched — it is a test lane, and it never shipped."
- notes ¶ "Occupancy barely moved; arrival did.": "now ride a lazy <code>api-docs</code> chunk and the eager main chunk drops"; "the occupants are the same tenants in new rooms."
- notes ¶ "The lodash-es aftermath did not move." — the whole heading; "still the largest module count in the bundle and still its own chunk." [7.5 KB gz, 135 modules, 65.0 KB kept]
- plate lettering: `txt(1150, 360, 'document, now parked in a', 'lbla', 'end')` / `txt(1150, 372, 'lazy api-docs chunk', 'lbla', 'end')` — the "now parked" carries the rev C deferral.
- plate lettering: `txt(60, 585, `what the swap left: lodash-es ${KB(G('lodash-es').gz)} —`, 'lbla')` / `txt(60, 597, `the true cost of four imports, ${G('lodash-es').mods} modules unmoved`, 'lbla')` — "what the swap left" and "unmoved" carry sheet 8's rev A/B lodash-es swap.
- `TOPS` note table: `'lit-dialog': 'freed of its lit 2 pin'`; `'sample-app-routes': 'the shared route table, its own group now'`.

## Sheet 11 — THE ENTRY QUARTERS

- **file** `diagrams/generator/sheet11.mjs` · **id** `entries` · **current rev** E
- **basis** (source): `const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2⅞ — the same wire, cut by published package · every exported entry priced alone · 16 doors, 5 packages

### REV A — undated in the copy

**prose paragraph** (`sheet11.mjs:197`, verbatim source):

> <p><strong>The server is a storefront, not a tower.</strong> Eight doors: an index at ${fmt(SRV.gz)} gz — rev A caught it within 12 bytes of lit-ui-router's flagship, a coincidence #590 promptly broke and the summer has widened to ${fmt(SRV_GAP)} — redirect and matcher wings, and four framework adapters — hono, fetch, vite, connect — packed within ${ADAPTER_SPREAD} bytes of one another: thin skins over one core. <code>./simulate</code>, the test double, is ${SIM.gz} bytes. All eight of these doors reprobe byte-identical against rev B.</p>

### REV B — undated in the copy

**generator comment** (`sheet11.mjs:35`):

> ```
> // graduated after rev B, so it takes 16 and leaves rev B's numbering intact.
> ```

### REV C — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV C: every byte now read from diagrams/data/census-doors.json

**prose paragraph** (`sheet11.mjs:201`, verbatim source):

> <p><strong>Rev C — the numbers by import, and a fifth quarter.</strong> The sheet no longer carries a hand-pasted probe: it reads the plate, keyed by package and door, and throws on a miss. Reprobing at ${PLATE.ref} @ ${PLATE.sha} moves two things. The <em>city</em>: sixteen doors rather than fifteen, with the lint plugin taking a new one-door quarter in the lower middle — the navigation-location quarter slid down and right to give it air, so the three one-door quarters now read as a row along the bottom. The <em>client</em>: only <code>lit-ui-router</code> moved. Four of its doors — the flagship, <code>./pure</code>, <code>./register</code> and <code>./ui-view.register</code> — each grew about 5% as main advanced past rev B's ref, while the other eleven doors, <code>./ui-router.register</code> plus both runtime plugins plus all eight server doors, reprobe byte-identical. The registration premium held its shape through that growth: ${REG_COST} gz, against rev B's 85. Rev B's own findings stand — #590's two flagship jumps, and the door name corrected from <code>./url-matcher</code> to <code>./matcher</code>.</p>

### REV D — undated in the copy; first in git 2026-09-05

**`sub` clause** (verbatim source):

> REV D: whole-cabinet re-probe — 14 of ${DOOR_N} doors byte-identical, the lint plugin's up 1,917 → ${fmt(LINT.gz)} gz on #689's three new rules and the mobx door 650 → ${fmt(MOBX.gz)} gz at mobx 1.0.0 — ${BASIS}

resolved →

> REV D: whole-cabinet re-probe — 14 of 16 doors byte-identical, the lint plugin's up 1,917 → 3,510 gz on #689's three new rules and the mobx door 650 → 908 gz at mobx 1.0.0 — counted at origin/main @ 185d414 (2026-09-06)

**prose paragraph** (`sheet11.mjs:202`, verbatim source):

> <p><strong>Rev D — two doors moved, and one of them is the one no browser opens.</strong> The whole plate cabinet was re-probed at ${PLATE.ref} @ ${PLATE.sha} in one pass. Fourteen of the ${DOOR_N} doors come back byte-identical — every <code>lit-ui-router</code> door, the navigation-location plugin and all eight server doors price exactly as they did at rev C, so the registration premium, the umbrella economics and the adapter spread are unchanged figures, not re-rounded ones. The mover that matters is <code>eslint-plugin-lit-ui-router</code>, which #689 gave three more rules — <code>sref-assign-href</code>, <code>sref-active-aria-current</code> and <code>directive-position</code> — taking its one door from 4,559 / 1,917 to ${fmt(LINT.m)} / ${fmt(LINT.gz)} gz, three quarters heavier across two release candidates. That moves the comparison rev C drew with it: the plugin was about a third of the flagship's weight and is now ${LINT_SHARE}% of it. Its quarter is drawn to the same scale as the rest, so the sixteenth tower simply grew. The other mover is the mobx door, 650 → ${fmt(MOBX.gz)} gz at <code>lit-ui-router-mobx@1.0.0</code> — still a footnote against the flagship.</p>`,

### REV E — 2026-09-06

**`sub` clause** (verbatim source):

> REV E 2026-09-06: fills — every quarter’s left-face tint and right-face hatch draw for the first time (a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); no door moved



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-16 (aa35ad9 "docs: add sheet 11 entry quarters splitting the bundle survey by package")
- REV B — 2026-08-17 (3557c29 "docs: reprobe sheet 11 rev B after #590 and correct the matcher door name")
- REV C — 2026-09-03 (2aaca5e "census pipeline I5 — sheet 11 reads the doors plate (rev C, 16th door)")
- REV D — 2026-09-03 (96f89fe "census pipeline — full cabinet refresh at origin/main eb32b4e")
- REV E — 2026-09-06 (b1c0942 "design pass p1 — full width, sticky key, util bar, title cover, t51 fills"; date stated in `sub`)

**Pinned literal numbers, by revision:**

- REV A — "within 12 bytes" · PR #590 · [SRV.gz = 4,965; SRV_GAP = 642; ADAPTER_SPREAD = 72; SIM.gz = 283]
- REV B — #590 · "two flagship jumps" · `./url-matcher` → `./matcher` · rev B registration premium 85 gz · door 16 (numbering preserved from rev B)
- REV C — sixteen doors vs fifteen · "about 5%" · eleven doors byte-identical · rev B premium 85 gz · #590 · [REG_COST = 90 gz]
- REV D — 14 of 16 byte-identical · lint 4,559 min / 1,917 gz → [9,703 / 3,510] · #689 · three rules (sref-assign-href, sref-active-aria-current, directive-position) · "about a third" → [LINT_SHARE = 63%] · mobx 650 → [908] · lit-ui-router-mobx@1.0.0 · eb32b4e

**Revisions with no prose paragraph of their own:**

- REV B — no standalone REV B paragraph; rev B's findings are carried forward inside the REV C paragraph — "Rev B's own findings stand — #590's two flagship jumps, and the door name corrected from <code>./url-matcher</code> to <code>./matcher</code>."
- REV E — none (drawing-technique revision, no prose paragraph)

**Basis (stated): `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0,10)})` → resolves to "counted at origin/main @ 185d414 (2026-09-06)" (from diagrams/data/census-doors.json; 16 doors, 5 packages; `PLATE.used` = "git archive origin/main @ 185d414 + corepack pnpm install --frozen-lockfile + tools/bundle-probe (rolldown, minify, declared deps+peers external, annotations off)")**

**Present-state sentences that carry history** (re-draft candidates):

- sub: "REV D: whole-cabinet re-probe — 14 of ${DOOR_N} doors byte-identical, the lint plugin's up 1,917 → … and the mobx door 650 → … at mobx 1.0.0" — the sub itself carries both rev D deltas.
- aria-label: "and a new one-door quarter in the lower middle holds eslint-plugin-lit-ui-router, the fifth published package, whose single door is the only one on the sheet no browser ever loads."
- aria-label: "the ui-router-server quarter is an eight-door storefront whose index tower prices ${SRV_GAP} gzipped bytes under lit-ui-router's" [642].
- notes ¶ Method: "and a door the plate carries that the drawing does not place is a build error, not a stale constant" — the rule rev C installed.
- notes ¶ "The server is a storefront…": "rev A caught it within 12 bytes of lit-ui-router's flagship, a coincidence #590 promptly broke and the summer has widened to ${fmt(SRV_GAP)}"; "All eight of these doors reprobe byte-identical against rev B."
- notes ¶ "The sixteenth door is not a door a browser opens.": "<code>eslint-plugin-lit-ui-router</code> (#676) is the family's fifth published package and the first non-runtime one" — the arrival that made the sheet sixteen doors.
- notes ¶ "The sixteenth door…": "it peers ESLint alone — oxlint loads it as a JS plugin, unpeered — never <code>@uirouter/core</code> (sheet 2 leaves it off the plate for the same reason)."
- notes ¶ "Why both views exist.": "it paid ${fmt(RECEIPT)} of the flagship's ${fmt(FLAG.gz)}" [4,655 of 5,607].
- notes ¶ REV C: "The registration premium held its shape through that growth"; "only <code>lit-ui-router</code> moved."
- notes ¶ REV D: "so the registration premium, the umbrella economics and the adapter spread are unchanged figures, not re-rounded ones"; "Its quarter is drawn to the same scale as the rest, so the sixteenth tower simply grew."
- source comment: "the lint plugin graduated after rev B, so it takes 16 and leaves rev B's numbering intact."
- `NOTE` table row: `'eslint-plugin-lit-ui-router|.': 'the lint plugin — editor-side, never shipped'`.

## Sheet 12 — THE REGISTER PLATE

- **file** `diagrams/generator/sheet12.mjs` · **id** `graph` · **current rev** F
- **basis** (source): `const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)}) · ${TURBO}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3¼ — the monorepo as its CI reads it · every task node punched · turbo 2.10.11

### REV B — undated in the copy; first in git 2026-08-31

**`sub` clause** (verbatim source):

> REV B: census refresh 2026-08-31 — three new members, three new rows, the phantom share held

**prose paragraph** (`sheet12.mjs:366`, verbatim source):

> <p><strong>Rev B — census refresh, 2026-08-31.</strong> Two weeks and one release (<code>lit-ui-router@1.10.0</code>) after the first printing, the plate was re-punched from a fresh <code>--dry=json</code>. Three rows joined the tools block — <code>@tools/eslint-ts-parser</code>, <code>@tools/lint-elements</code> and <code>@tools/warn-lanes</code> (#639) — taking the register from 27 packages to 30 and the graph from 483 nodes / 154 real to 535 / 165; edges 1,280 → 1,375, real edges 116 → 117. The <em>shape</em> is what held: the phantom share moved only 68% → 69%, the eighteen fanned names are the same eighteen, and all three new rows punch the same sparse pattern every small instrument does: <code>typecheck</code>, <code>lint</code>, <code>format:check</code> — three holes of eighteen — plus <code>test</code> for <code>@tools/warn-lanes</code>, which is the only one of the three with a suite. That is the plate's own thesis holding under a new measurement: a new member adds eighteen stations to the register and punches three or four of them. Elsewhere: the ragged tail gained <code>//#lint:elements</code> (25 → 26 singletons, fifteen of them root); the deepest chain grew a rung to thirteen — still five real — because <code>@tools/warn-lanes#build:types</code> now sits above <code>build_and_test</code>; the longest all-real chain shortened from seven <code>test</code> tasks to six; and the uncacheable tier was recounted across all seventeen <code>turbo.json</code> files rather than the root alone, which is twelve definitions, not seven. Still none of them reachable from <code>ci</code>.</p>

### REV C — undated in the copy; first in git 2026-09-02

**`sub` clause** (verbatim source):

> REV C: every number now imported from diagrams/data/census-plate.json — the fifth publishable package joined the register and the graph grew to 590 nodes / 176 real

**prose paragraph** (`sheet12.mjs:367`, verbatim source):

> <p><strong>Rev C — off the plate.</strong> The hand-pasted constants are gone: rows, columns, cells, tallies, the overlay and the schedule are all read from <code>diagrams/data/census-plate.json</code> at draw time, and the sheet throws rather than draws if a pipeline or a fanned name it needs is missing. Re-surveyed at origin/main @ 35c6766, the graph had grown again: <code>packages/eslint-plugin-lit-ui-router</code> is the fifth publishable package, taking the register from 30 fanned rows to 31 and the graph from 535 nodes / 165 real to 590 / 176; edges 1,375 → 1,504, real edges 117 → 126, phantom share 69% → 70%. There was also a 19th fanned column — <code>check:dev-split</code>, the dev-warning split guard, command-bearing in 1 package and a placeholder in the other 30 — which is the same story the eighteen told, one column wider. The ragged tail took the new package's three singletons (<code>lint:docs</code>, <code>lint:rules</code>, <code>test:oxlint</code>) and stood at 29; the deepest chain was 13 rungs with 5 real, and the longest all-real chain went back up to 7 <code>test</code> tasks — a new publishable package with a suite is exactly the sort of member that lengthens it.</p>

### REV D — undated in the copy; first in git 2026-09-05

**`sub` clause** (verbatim source):

> REV D: whole-cabinet refresh at eb32b4e — 586 nodes / 177 real, and real→real edges down a quarter to 96 · ${BASIS}

resolved →

> REV D: whole-cabinet refresh at eb32b4e — 586 nodes / 177 real, and real→real edges down a quarter to 96 · surveyed at origin/main @ 185d414 (2026-09-07) · turbo 2.10.11

**prose paragraph** (`sheet12.mjs:368`, verbatim source):

> <p><strong>Rev D — the whole cabinet, one ref, and the first recount that shrank.</strong> Every plate in <code>diagrams/data/</code> was re-counted at origin/main @ eb32b4e in one pass. The register keeps its shape — 31 fanned rows, 19 fanned columns, 13 rungs at the deepest and 7 at the longest all-real — but the punched inventory did not simply grow: nodes 586 against rev C's 590 and edges 1,382 against 1,504, real tasks up one to 177, the ragged tail up one to 30 as the root swapped one guard for two, and the phantom share easing from 70.2% to 69.8%. Two root singletons changed hands — <code>//#check:docs-api-deps</code> left, <code>//#check:graph-edges</code> and <code>//#check:task-inputs</code> arrived with #693 — and <code>apps/sample-app-shared</code> gave up its own <code>turbo.json</code> when #696 restored <code>turbo run e2e</code>. The figure that actually moved is real→real: 96 against rev C's 126, down a quarter on a graph the same size. That is #693's doing, and it is this plate's own thesis arriving from the other side. The <code>docs:api</code> column stood in nine packages and was command-bearing in four; the other five holes existed because <code>docs#build</code> reached its producers through <code>^docs:api</code>, and <code>^</code> walks direct dependencies, so <code>docs</code> carried devDependencies it never imports to make the walk land. #693 names the four producers instead — <code>lit-ui-router#docs:api</code> and its three siblings — and the column collapses to 4 holes, every one of them punched. Scaffolding came out of the graph and the real work stayed. Two thirds of the holes still run nothing.</p>`,

### REV E — 2026-09-06

**`sub` clause** (verbatim source):

> REV E 2026-09-06: the ci:main overlay holes and their key swatch now carry the accent hatch (a stroke class’s fill:none was outranking the fill attribute, fixed at the source in helpers.mjs); the register is otherwise untouched

### REV F — 2026-09-06

**`sub` clause** (verbatim source):

> REV F 2026-09-06: the uncacheable tier’s reason column hangs on the plate’s right margin — at the data face the longest reason no longer fitted a left-set column and ran off the sheet; the register, the overlay and the tail are untouched



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-16 (first printing, d974286 "docs: add sheet 12, the CI task graph as a punched register plate")
- REV B — 2026-08-31 (73bc1cd "docs: census refresh — sheets 3, 3A, 12 re-measured on the grown workspace"; date also stated in the sub)
- REV C — 2026-09-02 (af7af45 "feat: census pipeline I5 wave 2 — sheets 12/3B/8 import their execution plates")
- REV D — 2026-09-05 (999e663 "docs(atlas): stale-claims pass at b2338d0")
- REV E — 2026-09-06 (date stated in the sub)
- REV F — 2026-09-06 (date stated in the sub; current rev)

**Pinned literal numbers, by revision:**

- REV F — 1130 (the plate's right margin, hard-coded in that txt call).

**Callout continuation lettering** — lines of a revision's callout block that carry no `REV` token of their own, so the REV-keyed pass above did not catch them:

- REV B — none — no `txt()` call on this plate references a revision.

**Revisions with no prose paragraph of their own:**

- REV A — none authored as a REV A paragraph (the Method / Why an inventory / The finding / Depth / What the plate is not evidence for / The overlay notes are the rev A body, since rewritten in place).
- REV E — none — REV E has no prose paragraph in `notes`; it lives only in the sub.
- REV F — none in `notes`; the change is recorded as a source comment above the reason column: "The reason column hangs on the plate's right margin: at the data face the longest reason no longer fits a left-set column between the names and 1130."

**Basis (stated): `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0,10)}) · ${TURBO}` → resolved at HEAD: surveyed at origin/main @ 185d414 (2026-09-07) · turbo 2.10.11 (diagrams/data/census-plate.json)**

**Present-state sentences that carry history** (re-draft candidates):

- notes / Rev D paragraph title: "**Rev D — the whole cabinet, one ref, and the first recount that shrank.**" (references the earlier, larger count)
- notes / "The finding" is fully templated and carries no past-tense claim; the only surviving past-referencing present-state line outside the REV paragraphs is in "What the drawing does not show" — n/a for this sheet.
- notes / Rev C paragraph, present-tense framing of the change: "The hand-pasted constants are gone" (field: notes)
- notes / "What the plate is not evidence for": "Note also the one tier that never appears here at all: the repo's ${UNCACHED.length} `cache:false` definitions … are all outside every `ci:*` graph by design." (field: notes — states the tier count as 13 in the plate lettering "THE UNCACHEABLE THIRTEEN", a hard-coded word that must track UNCACHED.length)
- plate lettering: `txt(RX, UY, 'THE UNCACHEABLE THIRTEEN', 'lbls')` and `txt(RX, UY + 14, 'every cache:false definition in the repo — 7 at', 'lblf')` / `txt(RX, UY + 25, 'root, 6 in member files (@tools/ scope elided)', 'lblf')` — hand-pinned counts that rev B's prose says were once "seven", then "twelve".

## Sheet 12i — THE REGISTER, WALKED

- **file** `diagrams/generator/sheet12i.mjs` · **id** `register-interactive` · **current rev** A
- **basis** (source): `const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0, 10)}) · ${R.turbo}`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 3¼ — sheet 12's plate, live under the pointer · the whole ci graph carried node by node · 605 NODES · 183 RUN A COMMAND · 1,424 EDGES · 99 JOIN TWO REAL TASKS · surveyed at origin/main @ 185d414 (commit 2026-09-06) · turbo 2.10.11

_No REV clauses, historical paragraphs or rev-bearing callouts: this plate has only ever been issued at its current revision._


### Dates, pinned numbers and present-state history

**Basis (stated): `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0,10)}) · ${R.turbo}` → resolved at HEAD: surveyed at origin/main @ 185d414 (commit 2026-09-06) · turbo 2.10.11**

**Present-state sentences that carry history** (re-draft candidates):

- notes / "The shroud, defined.": "Untick it and the real subgraph comes back unchanged — the shroud is a visibility swap over one fixed layout, never a re-layout." (field: notes — read "comes back exactly as it was" at HEAD; the "was" was edited out of the working tree during this archive pass. Page state, not a past revision; listed for completeness)
- notes / Method: read at HEAD "this sheet reads the two fields the plate gained for it, `graphNodes` and `graphEdges`" ("gained" = a past change to census-plate.json); rewritten in the working tree during this pass to "this sheet reads the plate's two full-graph fields". (field: notes)
- notes / "What this shows that the plate cannot.": "Sheet 12 proves the phantom share as a ratio; here it is a shape." (field: notes — cross-sheet reference, no revision claim)
- notes / "Layout": "Columns are the ${R.cols} task names, and their order is not editorial" (field: notes — contrasts with sheet 12's hand-written COLS list, an implicit reference to that sheet's rev C change)

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

**prose paragraph** (`sheet13.mjs:415`, verbatim source):

> <p><strong>REV C — the numbers by import, and a fifth package on the map.</strong> The sheet no longer carries a hand-pasted census: every per-file date, touch count, member roll-up and monthly bar is read from <code>census-weather.json</code>, and a member the drawing places but the plate does not carry is a build error rather than a stale constant. Re-dating at the plate's ref moves two things at once. The <em>clock</em>: <code>TODAY</code> is ${TODAY} rather than the working-tree date the old constants were counted at, so every idle figure is larger for reasons that are calendar, not neglect. The <em>city</em>: 286 dated files rather than 272, with <code>packages/eslint-plugin-lit-ui-router</code> (#676) drawn for the first time — ${filesOf(row(31))} files, none older than ${Math.max(...(byMember.get('packages/eslint-plugin-lit-ui-router') ?? []).map((r) => days(r.first)))} days, the youngest stone on the map. Sheet 7 gives it the plan slot 350,170; in this flat projection that lands underneath the reading box, so it takes the free third row of the packages district instead, beside №3 and №4. The <em>bands</em> survived the recount intact.</p>

**generator comment** (`sheet13.mjs:94`):

> ```
> // --- laid at rev C: the newest stone was cut the day it was surveyed ----------
> ```

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: whole-cabinet refresh — ${TOT_F} dated files, every band re-tested and held

resolved →

> REV D: whole-cabinet refresh — 319 dated files, every band re-tested and held

**prose paragraph** (`sheet13.mjs:416`, verbatim source):

> <p><strong>REV D — the whole cabinet at one ref, and the bands hold a third time.</strong> Every plate in <code>diagrams/data/</code> was re-counted at origin/main @ eb32b4e in one pass. <code>TODAY</code> advanced under a day, so nothing on this map aged by more than one, and the city gained 11 walls net — 6 new in <code>@tools/shared</code> and 8 in the lint plugin, where #693 and #689 built, against three <code>@tools/release</code> walls that came down. All the new stone is summer stone. Season III was 253 files, 85% of the city. Every editorial cut this plate makes was re-tested against the new distribution rather than assumed: the per-block touches-per-file gap is still clean between 4.65 and 6.0, so HOT stays ≥${HOT}; the per-file median is still ${COLD}, so COLD stays below it; 6 source blocks run hot and the same 6 files sit beyond the ${SEAL}-day seal. One number in the prose did move with the clock and is now derived rather than typed — the empty stretch the seal sits in read 62 to 228 at that ref, where rev C printed 61 to 227.</p>

**generator comment** (`sheet13.mjs:57`):

> ```
> // ---- geometry: sheet 7 rev D's plan footprints, flattened -----------------------
> ```

### REV E — 2026-09-04

**`sub` clause** (verbatim source):

> REV E 2026-09-04: refreshed again after the 1.11.2 + mobx 1.0.0 releases — №32 @tools/embed-heights laid the day it was cut

**prose paragraph** (`sheet13.mjs:417`, verbatim source):

> <p><strong>REV E — refreshed at ${PLATE.ref} @ ${PLATE.sha}.</strong> ${TOT_F} dated files, ${SEASON_N[2]} of them Season III (${Math.round((SEASON_N[2] / TOT_F) * 100)}% of the city); №32 <code>@tools/embed-heights</code> (#703) is the newest stone, laid on <code>TODAY</code> itself. The bands held a fourth time: ${HOT_BLOCKS} source blocks run hot, the same ${SEALED_F} files sit beyond the ${SEAL}-day seal, and the empty stretch the seal sits in reads ${IDLE_GAP[0]} to ${IDLE_GAP[1]}.</p>

**generator comment** (`sheet13.mjs:101`):

> ```
> // --- laid at rev E: the embed-heights check (#703), cut the day of the survey ---
> ```

### REV F — 2026-09-07

**`sub` clause** (verbatim source):

> REV F 2026-09-07: re-dated after #717 moved the documentation site to www/lit-ui-router.dev/ — the most-weathered wall in the city is the same file under a new address, and its callout and the verdict now name it there; the rename chain is followed backwards, so its first date and touch count carry across the move — ${BASIS}

resolved →

> REV F 2026-09-07: re-dated after #717 moved the documentation site to www/lit-ui-router.dev/ — the most-weathered wall in the city is the same file under a new address, and its callout and the verdict now name it there; the rename chain is followed backwards, so its first date and touch count carry across the move — counted at origin/main @ 185d414



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-08-17 (first printing, bf7593d "docs: add sheet 13, the weathering map — the measured city surveyed in time")
- REV B — 2026-09-01 (8033db3 "docs: data refresh on the iso plates — 30 members, scc basis, rust ladder re-cut")
- REV C — 2026-09-02 (5eaabba "feat: census pipeline I4 wave 2 — sheets 7B/13 and the cover survey import their plates")
- REV D — 2026-09-03 (96f89fe "feat: census pipeline — full cabinet refresh at origin/main eb32b4e")
- REV E — 2026-09-04 (date stated in the sub)
- REV F — 2026-09-07 (date stated in the sub; current rev)

**Pinned literal numbers, by revision:**

- REV E — literals — №32, #703, 1.11.2, mobx 1.0.0, "a fourth time"; templated, resolved in brackets — ${TOT_F} [319], ${SEASON_N[2]} [275], the percentage [86%], ${HOT_BLOCKS} [6], ${SEALED_F} [6], ${SEAL} [180], ${IDLE_GAP[0]}–${IDLE_GAP[1]} [65 to 231], ${PLATE.ref} @ ${PLATE.sha} [origin/main @ 185d414].

**Revisions with no prose paragraph of their own:**

- REV A — none authored as REV A (Method / bands / verdict / district notes are the rev A body, since re-templated in place).
- REV B — none in `notes` — REV B lives only in the sub.
- REV F — none in `notes` — REV F lives only in the sub; its effect shows in the callout and the verdict text below.

**Basis (stated): `counted at ${PLATE.ref} @ ${PLATE.sha}` → resolved: counted at origin/main @ 185d414 (diagrams/data/census-weather.json; TODAY is the ref's own commit date, 2026-09-06)**

**Present-state sentences that carry history** (re-draft candidates):

- sub: "three construction seasons, ${MONTHS.length - ALIVE} silent months" [10] (field: sub)
- caption: "Every sheet so far has drawn the city as it stands; this one dates the stone." (field: caption)
- caption: "the port’s original masonry — 26 files from July 2025 — carries the hottest edges on the map" (field: caption)
- notes / Method: "spot-verified against it, including `tools/shared/workspace.ts`, which the plain path log mis-dates by a week" (field: notes)
- notes / Method: "`TODAY` is not a wall-clock date: it is the measured ref's own commit date, 2026-09-06" (field: notes)
- notes / bands: "touches-per-file still has a clean gap between 4.65 and 6.0, so HOT is ≥6; the per-file median is still 2, so COLD is below it" and "exactly the same 6 files sit beyond the gap" (field: notes — "still"/"same" are rev-to-rev continuity claims)
- notes / verdict: "the two most-weathered walls in the city are the port-era `www/lit-ui-router.dev/.vitepress` pair — `config.ts` at ×28 and `vite.config.ts` at ×23" (field: notes — the address REV F moved)
- notes / verdict: "The port's masonry is not museum stone: ui-sref.ts is at ×18 with the last chisel-mark dated 2026-09-02" (field: notes)
- notes / districts: "logged <em>zero</em> touches before 2026 and is almost entirely summer stone: infrastructure arrived late, fast, and mostly settled on the first cut" (field: notes)
- notes / districts: "`examples` holds the oldest untouched stone — two vite configs idle 249 days" (field: notes)
- notes / districts: "matching its history as the extracted plugin that every routing change touches" (field: notes)
- notes / Approximations: "the July 2026 `scripts/ → tools/` graduations are dated to that graduation where git saw no rename, which the yard's notes above already state as its story" (field: notes)
- notes / See also: "its recommendation is what sheet 7B draws" (field: notes)
- key: `SEASON III stone — born since ${SEASON_FIRST[2]}` (field: key)
- plate lettering: `txt(560, 1092, `symbols/ untouched ${days(SYM.last)} days, since ${SYM.last}`, 'lblf')`
- plate lettering: `txt(60, 1092, 'the yard’s largest building did not exist two months ago', 'lblf')`
- plate lettering: `txt(196, 279, 'one January wall, chiselled ten times:', 'lblf')`
- plate lettering: `txt(1250, 794, `two vite configs sealed ${days(SOLAR.last)} days,`, 'lblf')` and `txt(1250, 806, `helloworld/main.ts sealed ${days(HELLO.last)} — all winter-built`, 'lblf')`
- source comment (geometry): `// ---- geometry: sheet 7's plan footprints, flattened ----` — read `sheet 7 rev D's plan footprints` at HEAD; the rev letter was stripped from the working tree during this pass.

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



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-09-06 (stated in the sub as a template, `REV A ${A.commitDate}`; the module first printed 9c5ef4b 2026-09-03 "feat: census pipeline I6 — sheet 14, the survey office (pipeline self-portrait)")
- REV B — undated (no date in the sub; introduced with the sheet's drafting pass, after 9c5ef4b 2026-09-03)
- REV C — 2026-09-06 (date stated in the sub)
- REV D — 2026-09-06 (date stated in the sub; current rev)

**Pinned literal numbers, by revision:**

- REV D — 140px (the half-column that was cut); ten of eleven instruments; the tarball URL as the one survivor of the clip.

**Revisions with no prose paragraph of their own:**

- REV A — none in `notes` — REV A lives only in the sub. The rev A body is the six unlabelled notes paragraphs (Method / The hero is the fan-out / Three tiers / Five faults of the old regime / What the drawing does not show / Why a flow graph and not a city).
- REV B — none in `notes`.
- REV C — none in `notes`.
- REV D — none in `notes`.

**Basis (stated): `${A.ref} @ ${A.sha} · commit ${A.commitDate}` → resolved: origin/main @ 185d414 · commit 2026-09-06 (introspected by census-atlas.mjs; all 17 filed plates pinned to that one ref)**

**Present-state sentences that carry history** (re-draft candidates):

- sub: "all plates pinned to ${BASIS}" [origin/main @ 185d414 · commit 2026-09-06] (field: sub)
- caption: "the one that matters most is read thirteen times over" (field: caption)
- caption: "Nothing here is hand-listed: the stations are the generator files that write a plate…" (field: caption — contrast with the hand-listed regime the notes describe)
- notes / Method: "The introspection <em>throws</em> rather than draws if … the 17 filed plates disagree about the ref they were measured at. They do not: all 17 are pinned to origin/main @ 185d414 · commit 2026-09-06." (field: notes)
- notes / Five faults of the old regime: the whole paragraph is history in the present tense — "Before this pipeline: (1) the basis was whatever was checked out, with hand-rolled skip lists per probe — answered by one `git archive` per ref…; (2) member lists were frozen 30-entry arrays that predated a package's graduation, with `existsSync` guards that let a missing directory count as zero…; (3) numbers travelled by clipboard, printed by a probe and pasted into a sheet…; (4) time was hard-coded, so re-running today still aged files against last August…; (5) inputs came from out of band — a dead scratch clone, vanished `tmp/` generators, npm dates typed by hand…" (field: notes)
- notes / Five faults: "The one relic still in the drawer is drawn struck through: `census.mjs`, a working-tree walker imported by nothing and writing no plate." (field: notes)
- notes / What the drawing does not show: "Zero plates are unread: every filed measurement is on a drawing somewhere, which was not true of this pipeline a week ago." (field: notes)
- notes / What the drawing does not show: "four of the atlas's 23 sheets still have no plate behind them — sheet 5, sheet 6, sheet 14, sheet A1" (field: notes — "still")
- notes / Why a flow graph: "The node and edge arrays behind this drawing (69 nodes over four kinds, 95 edges over writes, reads and imports) are also the data model the interactive lane will mount" (field: notes — forward reference to 14i, which has since shipped)
- plate lettering / aria-label: "At far left one basis station: git archive ${A.ref} at ${A.sha} extracted to a temporary directory, ${fmt(A.tracked)} tracked paths" (field: aria-label)
- source comment: `// the two stations that file nothing at all` and the RELICY constant's comment `// the old regime's last instrument` (field: source, geometry block)
---
## Sheet 14i — THE SURVEY OFFICE — INTERACTIVE   (current rev: A)   [diagrams/generator/pipeline-graph.mjs]
Basis: not stated as a BASIS string on the sheet; the sub carries only the graph size. First printing 151f13f 2026-09-03 "feat: census pipeline I7 — interactive cytoscape survey office in the gallery".
No REV material. `export const REV = 'A'` and the sheet object's `rev: REV`; the sub, caption and section markup carry no REV clause. The only revision lettering on the page is the head plate: `<span class="shno">SHEET 14 · REV ${REV}</span>`.
- sub: "THE CENSUS PIPELINE AS A LIVE GRAPH · 69 NODES · 95 EDGES · 17 WRITES / 48 READS / 30 IMPORTS" (field: sub — no history)
- caption: "sheet 14's cytoscape sibling — the same introspected nodes and edges, hoverable; the master plate's fan-out is the hero" (field: caption — cross-sheet reference only)

## Sheet 14i — THE SURVEY OFFICE — INTERACTIVE

- **file** `diagrams/generator/pipeline-graph.mjs` · **id** `pipeline-interactive` · **current rev** A
- **subject line / lead** (resolved, present-state — not history):

> THE CENSUS PIPELINE AS A LIVE GRAPH · 69 NODES · 95 EDGES · 17 WRITES / 48 READS / 30 IMPORTS

_No REV clauses, historical paragraphs or rev-bearing callouts: this plate has only ever been issued at its current revision._

## Sheet A1 — THE SPRITE STUDY

- **file** `diagrams/generator/sheetA1.mjs` · **id** `sprites` · **current rev** A
- **subject line / lead** (resolved, present-state — not history):

> APPENDIX · META — the research behind the building sprites, drawn in the set it argues about · three concepts on one demo member, five states each

### REV A — 2026-09-06

**`sub` clause** (verbatim source):

> REV A 2026-09-06: rolled into the set from the standalone sprite-studies exploration; the reference strip of game screenshots is cited in the notes rather than re-drawn, because the atlas draws no images



### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A — 2026-09-06 (date stated in the sub; first printing ce41fdd 2026-09-06 "feat: appendix a1 — the sprite study rolled in; specimen off the prerendered rail")

**Callout continuation lettering** — lines of a revision's callout block that carry no `REV` token of their own, so the REV-keyed pass above did not catch them:

- REV A — no `txt()` call on this plate references a revision.

**Revisions with no prose paragraph of their own:**

- REV A — none in `notes` labelled REV A. The nearest thing to a revision paragraph is the last note, which records what the roll-in dropped: `<p><strong>What is not re-drawn here.</strong> The original studies carried a reference strip — six annotated screenshots from Horizon Zero Dawn, Angkor's Ta Prohm, SimCity 2000, SCURK and two Factorio Friday Facts posts — and this plate carries none of them. …</p>`

**Basis (stated): not stated. This plate is META — by design it carries no census plate and no measured number; the module header says so: "it therefore carries NO census plate and NO measured number: the only figures on it are the demo member's massing (16 files · 1,900 sloc)".**

**Present-state sentences that carry history** (re-draft candidates):

- sub: "rolled into the set from the standalone sprite-studies exploration" (field: sub — the only past-referencing clause on the sheet)
- caption: "The verdict has already shipped: sheet 7B is the working plant, and sheet 13 is the weathering gauge those studies were commissioned for." (field: caption)
- notes / Why an appendix: "Filing it as A1 rather than as sheet 15 keeps the ascent honest: fourteen altitudes, and behind them a folder of the research the drawings were made from." (field: notes)
- notes / The brief the studies answered: "The question was whether a general building-sprite treatment could carry the second reading…" and "which is exactly the pair of measurements sheet 13 had already made." (field: notes)
- notes / The three rules: "Severity stays where sheet 7 put it — gate tier already owns hue on cap and flank" (field: notes)
- notes / The three rules: "The demo member is massed under those rules rather than invented" (field: notes)
- notes / What the studies each teach: "Study 3 is the one that survives contact with the repository" (field: notes)
- notes / The verdict: "The recommendation was to build the working plant first, layer the vines second, and park the ledger for a close-up. That is what happened: <strong>sheet 7B, THE WORKING CITY</strong>, is the working plant… and <strong>sheet 13, THE WEATHERING MAP</strong>, is the age-and-churn gauge those studies were commissioned to render, drawn flat rather than sprited" (field: notes)
- notes / The verdict: "The ledger roof is still parked and still wants the one probe the cabinet does not have: a per-<em>file</em> age census rather than a per-member one." (field: notes — "still")
- notes / What is not re-drawn here: "The original studies carried a reference strip … and this plate carries none of them." and "The teaching survives as citations" (field: notes)
- source header comment: "The three ladders and their channel tables are re-drawn from the sprite studies artifact; the artifact's reference strip (six fair-use game screenshots) is NOT re-drawn … and survives here as the citation list in the notes." (field: source header)

## City — SHEET 7’S CENSUS CITY IN THE ROUND (city-scene.mjs)

- **file** `diagrams/generator/city-scene.mjs` · **id** `city` · **current rev** D
- **basis** (source): `const BASIS = `${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> SHEET 7'S CENSUS CITY IN THE ROUND · 32 MEMBERS · 31 MASSED · 19 SPEC ANNEXES · 4 DISTRICTS · ORBIT SNAPS TO THE FOUR TRUE DIAGONALS

### REV C — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV C: A SECOND LANE RELIGHTS THE CITY FROM SHEET 7A'S SHADOW SURVEY

**other rev-bearing copy** (`city-scene.mjs:789`):

> ```
> const BASIS_TEXT = `BASIS — the same geometry sheet 7 draws: every footprint, height and position here is <code>generator/sheet7.mjs</code>'s computed <code>CITY</code> export, embedded verbatim as JSON, massed from <code>diagrams/data/census-city.json</code> — ${BASIS}. Nothing is re-derived, so a mass in the model cannot drift from the mass on the plate. Walls are semi-opaque over a girding frame per the pinned sprite note; gate severity is colour, never height; the <code>off</code> tier is drawn frame-only because there is nothing to mass. Camera is orthographic at the true isometric elevation, atan(1/√2) ≈ 35.264°; the azimuth is free under the pointer and eased onto the nearest diagonal on release — instantly under <code>prefers-reduced-motion</code>. Each src mass carries a billboarded number chip — sheet 7's own numbering, drawn at runtime into a canvas in the page's own mono stack and redrawn when the theme turns, dropped below zoom ${DATA.chip.min} so a pulled-back plan stays a plan. District names are lettered FLAT on their ground plates, turned onto the opening diagonal so they read level at rest and foreshorten with the ground as a site plan's lettering does. Hovering or tapping a mass lights that member and fills the reading panel from the same row the schedule prints.  three.js ${THREE_URL.match(/three\.js\/([\d.]+)\//)[1]} is imported only once the plate scrolls into view, and the scene renders on demand — nothing runs while you read.  REV C adds a SECOND MATERIAL LANE over the same geometry: <code>TEST LIGHT</code> relights the city from <code>generator/sheet7a.mjs</code>'s exported <code>SURVEY</code>, so the model and the flat shadow plate cannot drift either. Its polarity is sheet 7A's — covered source is LIT, source no suite loads is SHADOW, and the spec annex is the LAMP that throws the light; a metered member's mass splits along its footprint, the lit slab being side × the extent the meter recorded, taken from the annex (east) side, its tint stepping down through the line-coverage bands. Shadow lerps toward BLACK rather than the ink, because <code>--ink</code> is light in the cyanotype theme and a shadow that brightens in the dark is not a shadow.  REV D re-lights the lane from a PLATE: sheet 7A's light is no longer a transcribed one-off but <code>diagrams/data/census-shadow.json</code>, ${SURVEY_META.basis} — the same ref the geometry is massed at, with ${SURVEY_META.metered} members metered under their own suites' meters. Every mass in this model therefore has a survey row (a mass without one is a build error), so the blank-paper case for a member the old metering predated is gone along with the metering that needed it.`;
> ```

### REV D — undated in the copy; first in git 2026-09-03

**`sub` clause** (verbatim source):

> REV D: THAT SURVEY IS NOW A FILED PLATE, METERED AT THE CITY'S OWN REF

### REV E — 2026-09-07

**`sub` clause** (verbatim source):

> REV E 2026-09-07: THE STAGE IS VIEWPORT-RELATIVE — 80VH, CAPPED AT 1400PX AND FLOORED AT 520 — SO THE MODEL STANDS AS TALL AS A CONTAINED PLATE INSTEAD OF A FIXED 620PX BAND

### REV (unattributed) — undated in the copy

**other rev-bearing copy** (`city-scene.mjs:143`):

> ```
> /* a rev's basis note is running text under its ledger headline */
> ```

**other rev-bearing copy** (`city-scene.mjs:803`):

> ```
> /** revBlock's table, with the basis note filed under each rev's headline. */
> ```


---


### Dates, pinned numbers and present-state history

**Revision dates and the commits that carried them** (from the parallel read):

- REV A/B — not filed (original issue; the plate first landed 115e82e 2026-09-03 "city scene — I8 redirected to a three.js isometric city". No REV A or REV B clause exists in `sub` or `BASIS_TEXT`.)
- REV C — 2026-09-03 (8a4bdc3 "city scene cycle 3 — the shadow survey as a TEST LIGHT lane"; undated in the string)
- REV D — 2026-09-03 (2e72a39 "census pipeline — 7A lamps reconstructed as census-shadow probe"; undated in the string)
- REV E — 2026-09-07 (dated in the string; headline only — no `BASIS_TEXT` ¶, so its revision-block cell files empty)

**Pinned literal numbers, by revision:**

- REV D — `SURVEY_META.basis` = [metered at origin/main @ 185d414 (2026-09-07)]; `SURVEY_META.metered` = [17]
- REV E — 80vh, 1400px cap, 520px floor, the retired 620px band (CSS: `.cs-canvas { height: clamp(520px, 80vh, 1400px); }`)

**Basis (stated): origin/main @ 185d414 (2026-09-07) — `BASIS` = `${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0,10)})` from `diagrams/data/census-city.json`; the TEST LIGHT lane cites `SURVEY_META.basis` = "metered at origin/main @ 185d414 (2026-09-07)" from `diagrams/data/census-shadow.json`.**

**Present-state sentences that carry history** (re-draft candidates):

- `BASIS_TEXT` lead: "BASIS — the same geometry sheet 7 draws: every footprint, height and position here is `generator/sheet7.mjs`'s computed `CITY` export, embedded verbatim as JSON, massed from `diagrams/data/census-city.json` — ${BASIS} [origin/main @ 185d414 (2026-09-07)]. Nothing is re-derived, so a mass in the model cannot drift from the mass on the plate."
- `CITY_META.sub` lead: "SHEET 7'S CENSUS CITY IN THE ROUND · ${CITY.length} MEMBERS · ${MASSED} MASSED · ${ANNEXES} SPEC ANNEXES · 4 DISTRICTS · ORBIT SNAPS TO THE FOUR TRUE DIAGONALS"
- REV D ¶ (also a present-state sentence about a past state): "sheet 7A's light is no longer a transcribed one-off"; "the blank-paper case for a member the old metering predated is gone along with the metering that needed it."
- REV E headline (present-state about a past state): "…INSTEAD OF A FIXED 620PX BAND"
- three.js pin, lead ¶: "three.js ${THREE_URL.match(...)[1]} [0.169.0] is imported only once the plate scrolls into view, and the scene renders on demand — nothing runs while you read."
- source comment l.63: "Every mass must have a survey row — sheet 7A now numbers from sheet 7's own…"
- source comment l.786-788 (the freeze rule): "THE BASIS, FROZEN. The strip is running prose; its REV ¶s are filed the way a sheet files its own — split on the same \" REV <letter> \" seam sheetSection() uses, so the revision block below the stage is the very text that was in the strip."

## Notes on this record

- **Pinned literals are preserved inside the quotes.** Every superseded figure the copy names — `1.9.0 · 12f · 1,325` (2A rev B), `535` then `590` then `586` ci nodes (3 / 3A / 12), `176,022` lines (8 rev C), `504` bytes of font lead (9 rev F), rust ladder `R3 ≤41 · R4 >180` (7B rev B) — is quoted where it stands rather than lifted into a table, because the number only means anything with the sentence that qualifies it.
- **Dates.** A rev is dated here only when its own clause carries a date. Where it does not, "first in git" is the oldest commit under `diagrams/generator/` in which the clause text appears (`git log -S`), which is an upper bound on when the rev was drawn, not the rev date itself.
- **`REV X corrected`.** Sheet 3B carries one, `REV C corrected 2026-09-01`. `splitRevs()` in `chrome.mjs` parses it (its head regex allows a trailing ` corrected`), so it files as its own row in the revision table.
- **Sheet 5 rev A / sheet 3B rev A etc. are not recorded anywhere.** A sheet's `sub` only gains a clause when it is revised, so REV A is implicit — the first printing — for every plate whose clause list starts at B or later.
- **`city-scene.mjs` disagrees with itself.** Its exported `REV` const is `D` while `CITY_META.sub` carries a `REV E 2026-09-07` clause, so the rendered title block and the revision table under it print different letters.
- **Sheets with no history at all:** 1i, 6, 12i, 14i (and A1, issued once at REV A).
- **Provenance of the "Dates, pinned numbers and present-state history" blocks.** Each sheet's block was contributed by a second, independent read of the same generator module and appended without altering the verbatim record above it. Commit attributions there were spot-checked against `git log`. Sheet 14i (`pipeline-graph.mjs`) has no such block — it was the one module the parallel read did not cover — so its section carries the first-pass extraction only.
