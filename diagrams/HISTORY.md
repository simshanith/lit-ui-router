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

- No lettered revisions: the cover narrates change in running prose only.
- Basis: origin/main @ 185d414, counted 2026-09-07 (`COUNTED_AT` / `COUNTED_ON`, from `diagrams/data/census-files.json`; city and shadow plates at the same sha).
- The "has grown" paragraph was first written 987f909 2026-08-17 and last touched cf45bb0 2026-09-07. Its pinned figures: 297× (`node_modules` over the app it serves), 22.5% / 3.9% (sheet 10's wire shares), 84% (the lodash chunk cut), #618.
- Dated claims elsewhere on the cover: `eslint-plugin-lit-ui-router` graduated to `packages/` 2026-09-02, after sheets 1–13 were first drawn; the sheets were drawn 2026-08-16–17 and the survey office added 2026-09-03; since 2026-09-06 every label on the plates draws in the data face (DIN 2014 / Barlow Semi Condensed) and mono is reserved for code; "Generated 2026-08-16 by Fable (Claude, AI)".
- The issue log rode the cover's right-hand column until 2026-09-06, where it pushed the sheet index off the first screen; it has had a page of its own at `/log` since. The cover keeps a `LATEST` band rendering `manifest.issueLog[0]`.
- `splitRevs()` in `chrome.mjs` states the freeze rule the whole record depends on: "each sheet's `sub` is written once, at the revision it records, and never edited."

## Sheet 1 — THE RENDER LOOP

- **file** `diagrams/generator/sheet1.mjs` · **id** `package` · **current rev** G
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

- REV D — 2026-08-16 (b2f972f "docs: route sheet 1 arrows as iso roads and re-mass sheet 4 from sloc x files") · REV E — 2026-09-03 (1ff332a "feat: census pipeline — sheets 1, 2A and 3 cite plates, last relic numbers retired") · REV F and REV G — 2026-09-06, dated in their clauses.
- Superseded figures: rev E retired the hand-typed `1.9.0`, and the altitude line prints `${LIT_V}` [1.11.2]; rev G recut the door frames 144 → 116 wide and reclaimed 200px of trailing paper.
- No REV A / B / C clause survives: the sub jumps from the altitude line straight to REV D.
- Basis: none stated; the altitude line reads `diagrams/data/census-files.json` for the version.

## Sheet 1i — THE RENDER LOOP, WALKED

- **file** `diagrams/generator/sheet1i.mjs` · **id** `loop-walked` · **current rev** A
- **basis** (source): `const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 1 — sheet 1's circuit, stepped · one navigation walked leg by leg · 10 STATIONS · 12 LEGS · 12 STEPS · surveyed at origin/main @ 185d414 (commit 2026-09-06)

_No REV clauses, historical paragraphs or rev-bearing callouts: this plate has only ever been issued at its current revision._

**Record notes**

- Issued once, at REV A. Basis `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0,10)})` from `diagrams/data/census-loop.json` [origin/main @ 185d414, commit 2026-09-06].

## Sheet 2 — THE BRICK ASSEMBLY

- **file** `diagrams/generator/sheet2.mjs` · **id** `companions` · **current rev** C
- **subject line / lead** (resolved, present-state — not history):

> ALTITUDE 2 — one baseplate, four bricks, 27 authored files

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

**Record notes**

- REV A — before 2026-08-16; referenced only, never a clause, and surviving solely inside the rev B prose above · REV B — 2026-08-16 (628d82d "docs: redraw sheet 2 as an exploded LEGO brick assembly") · REV C — 2026-09-05, dated in the clause.
- Basis: `counted at ${PLATE.ref} @ ${PLATE.sha}` from `diagrams/data/census-bricks.json` [origin/main @ 185d414, generated 2026-09-07].

## Sheet 2A — THE COUPLING PLAN

- **file** `diagrams/generator/sheet2a.mjs` · **id** `companions-couplings` · **current rev** D
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

- REV A — before 2026-08-16; referenced only, and this plate deliberately *returns* to its arrangement · REV B — 2026-09-03 (1ff332a) · REV C and REV D — 2026-09-06, dated in their clauses.
- Superseded figures: rev B retired the 2026-08-17 hand count `lit-ui-router 1.9.0 · 12f · 1,325` (rows read 1.11.2 · 13f · 1,383 now); rev D recut the location-plugin slab 180 → 156 wide and the mobx brick 160 → 136, both having been sized to the mono lettering the data face replaced.
- The front-face scale is ≈ 35 px² per sloc, with the two smallest companions (1×1 and 1×2) clamped up to a legible minimum — their smallness is already sheet 2's finding.
- Basis: `census-bricks.json @ ${B.sha}` [origin/main @ 185d414].

## Sheet 2B — THE COUPLING BENCH

- **file** `diagrams/generator/sheet2b.mjs` · **id** `coupling-bench` · **current rev** C
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

- REV A — before 2026-08-31, referenced only · REV B — 2026-08-31 (053cc87 "hidden-line pass") · REV C — 2026-08-31, corrected 2026-09-01 · REV D — 2026-09-02 · REV E — 2026-09-03 (96f89fe) · REV F — 2026-09-04 · REV G — 2026-09-06 · REV H — 2026-09-07; every rev from C on is dated in its own clause.
- Superseded figures: rev C command sloc 1,737 → 1,774, flat blocks 134 → 130, the plain at 17,692 files on a clean tree; rev D 165 → 176 real tasks and 1,774 → 2,022 command sloc; rev E 27 structures → 28, 176 → 183 real, `//#check:patches` 24 files → 646, and rev D's 27,953 task-file hashes → 46,781; rev F the examples plain 17,821 → 31,866; rev G split the band's spare measure into a 40px gutter and a 40px right margin, ending a 57px overrun; rev H deepened the art region 70px.
- The graph stands at 605 nodes / 183 real / 1,424 edges / 99 real→real against rev C's 535/165/1,375/117.
- Basis: `surveyed at ${PLATE.ref} @ ${PLATE.sha}` from `census-mass3b.json`, graph counts from `census-plate.json`, toolchain turbo 2.10.11 [origin/main @ 185d414, generated 2026-09-07].

## Sheet 4 — THE FAMILY SPINE

- **file** `diagrams/generator/sheet4.mjs` · **id** `family` · **current rev** E
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

- 2026-09-11, no rev clause (the copy is present-state): №15 `@tools/build_and_test` moved x 330 → 300 and №32 `@tools/embed-heights` x 430 → 440 on the works row, after 15's spec annex grew across 32's plot; `iso-hidden.mjs::assertPlots` now stops the build on any such overlap (DESIGN-REVIEW §T53).
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

- REV A — 2026-08-17 (2d96885) · REV B — 2026-08-17 (2de9b65 "flip plate 7A to rev B — the tests are the light") · REV C and REV D — 2026-08-31, dated (053cc87; 8033db3) · REV E — 2026-09-03 (2e72a39 "7A lamps reconstructed as census-shadow probe").
- Rev B flipped the optics only: "Every number below is rev A's, unchanged."
- Superseded figures: rev D printed a 13-member, 5,539-line universe metered 2026-08-17 at 3557c29 and explicitly not re-run — grand total 5,427 of 5,539 lines, 1,283 of 1,351 branches, 419 of 437 functions — with three daggered members whose census had overtaken their meter. Rev E meters 16 members at one ref [17 now] and retires the daggers, moving `build_and_test` from a dagger-computed 41.1% reach and `shared` from 82.4%, and `@tools/release` from 54.1% reach / 98.4% line / 96.8% function.
- The one figure the reconstruction did not reproduce, and the reason it is worth the space: `@tools/build_and_test` was recorded at 7 files / 756 sloc with 464 lit, and the probe reads 7 / 779 with 487 — the 23 lines are all in `error-summary.core.ts`, which the old counter reads at 233 and scc 4.0.0 at 256. The meter reproduced perfectly; the tape measure moved.
- Basis: `metered at ${SHADOW.ref} @ ${SHADOW.sha}` from `census-shadow.json`; footprints, annexes and districts from sheet 7's own `census-city.json` [both origin/main @ 185d414, 2026-09-07].

## Sheet 7B — THE WORKING CITY

- **file** `diagrams/generator/sheet7b.mjs` · **id** `working` · **current rev** G
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

### REV G — 2026-09-06

**`sub` clause** (verbatim source):

> REV G 2026-09-06: the telemetry box re-cut — the rust ladder had outgrown the wall it was drawn to and ran off the plate, so the reading takes a continuation line and the box is sized to the widest line that remains and hung on the plate’s right margin, clear of the packages lettering

**Record notes**

- REV A — 2026-08-17 (8160cf3 "the first sprite plate, the census running") · REV B — 2026-08-31 (053cc87) · REV C — 2026-08-31, dated (8033db3; steam import 5eaabba 2026-09-02) · REV D — 2026-09-03 (96f89fe) · REV E — 2026-09-03 (2e72a39) · REV F — 2026-09-04 (4332b21) · REV G — 2026-09-06 (2795066 "the plates draw in DIN").
- The rust ladder is the one channel whose labels do not mean the same thing across revs. Rev B cut it R3 ≤41 · R4 >180, with an R2 of 30–34 days; rev C re-cut it on the 2026-08-31 distribution at 0 ≤14 · R1 ≤30 · R2 ≤37 · R3 ≤58 · R4 >180, the top step being the empty 61–180 gap nothing occupies. The steam bands are rev C's and are kept: 0 puffs ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16 — stated as editorial, because 3, 9 and 16 are all occupied now.
- Superseded figures: rev B's one alarm was `//#lint:root`, oxlint failing with 16 errors, every one inside `diagrams/generator/` — the atlas breaking its own lint line drawing itself — answered by ffd4ef7 and drawn struck through since rev C. Rev D retired a hand-pasted PIPES figure of 22 real tasks in 113 nodes (the file's own head comment said 22 of 103) for the plate's 24 of 114, and rev C's window held 358 commits. Rev E replaced the lamps' transcription of the 2026-08-17 metering, moving seven plants. Rev G sized the telemetry box 388 × 148 at x=1152, y=96.
- Basis: STEAM from `census-steam.json` with `WINDOW`; massing and gate tiers from `census-city.json` via sheet 7's `PLACED`; lamps from `census-shadow.json`; pipes from `census-plate.json`; RUST from sheet 13's weathering census — the one editorial channel left on the sheet.

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

- REV A — 2026-08-16 (693e6d8) · REV B — 2026-08-17 (987f909 "remeasure sheets 9 and 10 after the lit dedupe merge"), with no clause of its own — it is the unnamed "before" of the lazy-chunk note · REV C — 2026-09-03 (91c6843) · REV D and REV E — 2026-09-06 (b1c0942 "design pass p1"), dated.
- Superseded figures: rev A shipped two lit majors at 12.5 KB gz, 5.2 KB of it déjà vu, retired by #618's scoped `^3.3.3` floor on `@api-viewer/*` and `lit-dialog` [one lit now, 8.8 KB over 19 modules]; rev C dropped the display labels that baked in a version number and a package count, and split `sample-app-routes` out of the app's own source; rev E recut the five door frames 144 → 116 and hung every flush-right note on 1150.
- The intentional `lit-2` compat alias in `packages/*` is untouched by any of it — it is a test lane, and it never shipped.
- Basis: `${PLATE.app} · counted at ${PLATE.ref} @ ${PLATE.sha}` from `census-bundle.json` [origin/main @ 185d414, 2026-09-06; 17 chunks, 663,008 kept → 371,713 emitted → 120,098 gz].

## Sheet 11 — THE ENTRY QUARTERS

- **file** `diagrams/generator/sheet11.mjs` · **id** `entries` · **current rev** E
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

- REV A — 2026-09-06, dated (ce41fdd "feat: appendix a1 — the sprite study rolled in; specimen off the prerendered rail").
- What the roll-in dropped: the original studies' reference strip of six annotated screenshots — Horizon Zero Dawn, Angkor's Ta Prohm, SimCity 2000, SCURK and two Factorio Friday Facts posts — because the atlas draws no images. The teaching survives as citations in the notes.
- Basis: none, by design. The plate is META and carries no census plate and no measured number; the only figures on it are the demo member's massing (16 files · 1,900 sloc).

## City — SHEET 7’S CENSUS CITY IN THE ROUND (city-scene.mjs)

- **file** `diagrams/generator/city-scene.mjs` · **id** `city` · **current rev** E
- **basis** (source): `const BASIS = `${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;`
- **subject line / lead** (resolved, present-state — not history):

> SHEET 7'S CENSUS CITY IN THE ROUND · 32 MEMBERS · 31 MASSED · 19 SPEC ANNEXES · 4 DISTRICTS · ORBIT SNAPS TO THE FOUR TRUE DIAGONALS

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

### REV (unattributed) — undated in the copy

Two source comments in `city-scene.mjs` describe how `revBlock` files a rev's basis note under its headline. No drawing revision; carried here because the subhead is part of the record.

**Record notes**

- REV A / REV B — not filed. The plate first landed 115e82e 2026-09-03 "city scene — I8 redirected to a three.js isometric city", and no REV A or REV B clause was ever written · REV C — 2026-09-03 (8a4bdc3 "the shadow survey as a TEST LIGHT lane"), undated in the string · REV D — 2026-09-03 (2e72a39), undated in the string · REV E — 2026-09-07, dated.
- Rev E made the stage viewport-relative — `clamp(520px, 80vh, 1400px)` — retiring a fixed 620px band. Rev D's light is `SURVEY_META.basis` [metered at origin/main @ 185d414 (2026-09-07)] over `SURVEY_META.metered` [17] members, and a mass without a survey row is a build error.
- The REV C and REV D prose above survives only here: `city-scene.mjs` exports `REV = 'E'` and its `sub` carries no REV clause at all since the 2026-09-07 present-state copy pass, so the exported letter and the sub no longer disagree.
- Basis: `${PLATE.ref} @ ${PLATE.sha}` from `census-city.json` [origin/main @ 185d414, 2026-09-07]; the TEST LIGHT lane cites `census-shadow.json` at the same ref.

## Notes on this record

- **What the build reads.** Only the `## ` sheet headings, the `### REV` subheads under them, and each rev's first `> ` quote block — or the one after a `resolved →` line. Everything else here is for readers; changing any of those three changes the published `/log`.
- **Verbatim, with its numbers.** A superseded figure stays inside the quote that names it — `1.9.0 · 12f · 1,325` (2A rev B), 535 then 590 then 586 `ci` nodes (3 / 3A / 12), 176,022 lines (8 rev C), 504 bytes of font lead (9 rev F), the rust ladder `R3 ≤41 · R4 >180` (7B rev B) — because a number only means something with the sentence that qualifies it.
- **Dates.** A rev is dated here when its own clause carries a date. Where it does not, "first in git" is the oldest commit under `diagrams/generator/` in which the clause text appears (`git log -S`), which is an upper bound on when the rev was drawn, not the rev date itself.
- **`REV X corrected`.** Sheet 3B carries one, `REV C corrected 2026-09-01`. `splitRevs()` in `chrome.mjs` allows the trailing ` corrected`, so it files as its own row in the revision table.
- **REV A is usually implicit.** A sheet's `sub` gains a clause only when it is revised, so the first printing goes unlettered on every plate whose clause list starts at B or later.
- **Sheets with no history at all:** 1i, 6, 12i, 14i — and A1, issued once at REV A.
- **What this record no longer carries.** Captions, plate lettering and source comments that only restated a rev clause have been dropped: git has the text, and the sheets are re-drafted freely. The ones kept name a figure or a decision that survives nowhere else — most of the REV prose paragraphs are in that class, having been cut from the generators by the 2026-09-07 present-state copy pass. Each sheet's **Record notes** fold in a second, independent read of the generator module; the commit attributions there were spot-checked against `git log`.
