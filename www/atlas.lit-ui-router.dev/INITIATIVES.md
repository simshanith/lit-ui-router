# Census pipeline rework — design record

**COMPLETE.** Initiatives I1–I8 all landed 2026-09-02/03; the cabinet has since been
refreshed eight times and stands at `origin/main` @ **38c9fa1c** (commit
2026-09-22T22:32:03-07:00), 17 plates all pinned to the same ref.

The architecture that came out of it: `generator/basis.mjs` materializes any ref once (`git
archive` → tmpdir), one `scc --by-file` pass over that archive is the master per-file
census, and every other tree probe is a group-by query over those same rows — so cross-sheet
totals reconcile by construction, not by discipline. Probes write
`www/atlas.lit-ui-router.dev/data/<probe>.json`; sheets import the plate and render figures and provenance
lines from its fields through lookups that THROW on a missing row. History probes derive
"today" and their windows from the measured commit's date. `generator/census-atlas.mjs`
introspects the pipeline at build time, draws it as appendix A2 plus its interactive lane A2i, and
throws if the cabinet disagrees with itself. Every number the atlas prints is now
plate-derived or a declared editorial constant (sheet 7B's rust; placement).

The landing-by-landing narrative is NOT kept here. `www/atlas.lit-ui-router.dev/HISTORY.md` is the verbatim
revision record of the drawing set; `git log` on this branch carries the rest, one commit
per landing.

## Why rework

Ten census scripts, five distinct bases, and every number on every sheet a hand-pasted
constant. The concrete faults:

1. **Basis = whatever's checked out.** Most probes walked the working tree with hand-rolled
   skip lists; steam/weather mixed HEAD history with a working-tree file universe. Only
   `census-overview.mjs` was ref-clean.
2. **Frozen member lists.** The 30-entry MEMBERS/POOL arrays predated
   eslint-plugin-lit-ui-router's graduation, and `existsSync` guards made a missing dir
   silently count as zero.
3. **Numbers travel by clipboard.** Probes printed JSON; a human pasted constants into
   `sheet*.mjs`. Totals reconciled only by discipline.
4. **Time is hard-coded.** weather `TODAY = 2026-08-17`, steam `--since=2026-05-19` —
   re-running today still aged files against August.
5. **Out-of-band inputs.** @uirouter/core measured from a dead scratch path; the 9/10/11
   bundle probes and npm dates had no script; 3A/7A cited vanished tmp/ generators.

## Target architecture

- **Layer 0 — `basis.mjs`.** `materialize(ref)` → rev-parse sha, `git archive <ref> | tar
  -x` to tmpdir, relative file walk → `{ ref, sha, dir, files, commitDate, cleanup }`.
  Extracted ONCE per run, shared by all probes. `--ref` on the CLI, default `origin/main`.
  (scc needs RELATIVE paths + cwd at the tree root — it silently returns nothing for
  absolute paths.)
- **Layer 1 — one measurement, many views.** One `scc --by-file --format json` over the
  archive is the master per-file census; overview/city/yard/bricks are group-by queries over
  the same rows. Same move for history: one `basis.mjs::historyLog(ref)` feeds steam +
  weather.
- **Members discovered, not listed.** The member set derives from the archive's own
  `pnpm-workspace.yaml` + member package.json. Editorial groupings (districts, instruments)
  stay as name-keyed pattern rules with a loud "unmatched members" line.
- **Time pinned to the ref.** History probes derive TODAY / windows from the measured sha's
  commit date; `chrome.mjs` dates every title block from `census-files.json`'s `commitDate`.
- **Layer 2 — snapshots are the build input.** Sheets render basis/provenance lines FROM the
  snapshot fields. Rev letters and rev notes stay manual (editorial). A refresh is still a
  reviewed, committed event — every printed number stays citable to a checked-in file.
- **Probe tiers.** T1 pure-tree = archive + scc, any ref. T2 history = `historyLog(ref)` +
  the same ref's archive for the file universe. T3 execution (plate/turbo, mass-3b, nm,
  bundle probes, shadow) needs an INSTALLED tree: `basis.mjs::installDeps` runs the mise-provisioned
  `pnpm install --frozen-lockfile` in the tmpdir and returns the tree's OWN
  `node_modules/.bin/turbo`, invoked directly.

## Pipeline self-portrait

Decided: **flow graph, not lego.** A pipeline's truth is dataflow (ref → archive →
measurement → plate → drawing); a connector/brick metaphor would encode containment, the
wrong claim. The vocabulary the atlas already owns fits: probes as survey stations, plates
as filed drawers, sheets as the output rack; tier = station type. Shipped as three lanes —
the static sheet 14, the cytoscape sheet 14i (`generator/pipeline-graph.mjs`), and the 3D
lane, which after the CSS-tilt experiment was REDIRECTED by the user onto the isometric city
and shipped as `generator/city-scene.mjs`. The tilt itself was retired 2026-09-04 at user
request once the three.js city carried the real payoff.

## RDF crossover (silicon-grove, explored 2026-09-02)

Two things were taken and the rest skipped. The I7 NODES/EDGES data model was lifted in
shape from `rdf-graph-core` (namespace → node kind), minus its Float32Array physics —
cytoscape owns layout. Plate provenance is named after PROV-O: `generatedAtTime`,
`wasGeneratedBy`, `used`, `wasAssociatedWith` (`generator/census-query.mjs::provenance`),
which cost nothing and leaves a named-graph-per-ref triple view mechanical if multi-ref
queries ever become a want. PARKED: that triple view, the playground's Canvas renderer, its
Mermaid emitter and Barnes-Hut/WASM.

## Initiatives

**All landed 2026-09-02/03.** Sized in granular cycles (one cycle ≈ one commit+republish
sitting); order is dependency order.

| # | Initiative | Scope |
|---|---|---|
| I1 | Basis layer + master scc census; `overview` ported onto it | basis.mjs, census-files plate, overview as query |
| I2 | city/yard/bricks as queries + workspace-derived members | kills the frozen lists; bricks fetches core itself |
| I3 | steam/weather ref-pinned | shared `historyLog`, dates from the ref's commit date |
| I4 | Snapshot-import sheet refactor | sheets read `www/atlas.lit-ui-router.dev/data/*.json`; generated basis lines |
| I5 | T3 recipes (turbo, nm, bundle 9/10/11, npm dates) | archive+install harness; costliest, least churn |
| I6 | Pipeline self-portrait: static sheet 14 | house SVG style, introspected at build |
| I7 | Cytoscape pipeline graph + sprite nodes | NODES/EDGES model, sprite skins; now appendix A2i |
| I8 | 3D | CSS tilt (retired) → three.js isometric city |

## Operating notes and traps

**Refreshing the cabinet after a release**

- Probes default to `--ref origin/main` (`basis.mjs::refFromArgv`), but a plate filed
  mid-refresh must measure the tree its siblings measured — pass the CABINET's ref by the same
  STRING its siblings carry (`origin/main` with no fetch in between, or the sha they were
  filed under), or `census-atlas.mjs` throws on the mismatch.
- Run `census-scc.mjs` FIRST, then the T1/T2 queries, then the T3 install probes, and never
  re-fetch origin mid-run or the plates split across two shas.
- A T3 probe taking positional args must be given its ref through `--ref` and nothing else:
  `census-plate`/`census-nm`/`census-bundle` would otherwise eat `origin/main` as a pipeline
  name or an app dir. Use `basis.mjs::positionalsFromArgv`, never raw argv (an early run
  filed an EMPTY `census-plate.json` this way).
- Budget the T3 chain by store warmth, not by a fixed figure: ~35 min cold (each probe pays
  a full `pnpm install --frozen-lockfile`, the examples' npm installs the long
  pole), ~3½ min with the pnpm store warm.
- A late T3 probe's `generatedAtTime` can land on the next UTC day while `commitDate` stays
  put. That is honest — only `commitDate` drives the title blocks
  (`generator/chrome.mjs::DATE`).
- THE NEW-MEMBER CHECKLIST — the one manual step a refresh has. A workspace member born
  since the last cabinet needs a row in: sheet 3B's `TERRACE` (`generator/sheet3b.mjs`),
  sheet 7's `PLACED` (`generator/sheet7.mjs`, which 7B imports), sheet 13's `PLACED`
  (`generator/sheet13.mjs`), 7B's `RUST` map (`generator/sheet7b.mjs`) and `INSTRUMENTS` in
  `generator/census-yard.mjs`. The first four THROW when missed; the yard only prints its
  orphans loudly, which is a guard that should probably throw too. THREE more tables are hand
  tables in fact if not in the list, and the sixth refresh found each of them the hard way:
  3B's `APPS` and its package quarters (`generator/sheet3b.mjs`, which throws on unclaimed real
  tasks), `APP_ORDER` in `generator/register-graph.mjs`, and sheet 9's district `PLAN` — whose
  miss is SILENT, because `census-shipped.mjs` files an unmatched file under `unclassified` and
  only prints it. A new PLATE (not member)
  needs a key set in `generator/labels.mjs` as well, or `assertLabels()` stops the manifest.
- A LABEL THAT COUNTS MUST BE ASSERTED AGAINST THE DATA. The yard's `orphans` line cannot catch a
  new `packages/` member at all: `INSTRUMENTS`'s last rule is a `/^packages\//` catch-all, so the
  member is claimed, no orphan prints, and the only thing that goes wrong is the words — the
  seventh refresh drew `src (5 published packages)` over a slab holding seven. A carve-out placed
  BEFORE the catch-all rots the same way: `src — lit-ui-router-effect (private)` went on reading
  true for a day after the package was published, because nothing compares the parenthesis to the
  plate. Any hand-written count inside a label is a claim the build does not check; derive it, or
  assert it against `census-files.json`'s own member list.
- npm's `version` is the `latest` TAG, not the newest version. `census-npm.mjs` records a `tags`
  map per row for exactly this: a package publishing a release candidate under `rc` leaves `latest`
  standing at whatever shipped before it, so `lit-ui-router-effect` and `lit-ui-router-ssr` both
  file latest 0.0.1-alpha.0 against rc 0.1.0-rc.0. A sheet quoting a version has to say which clock
  it read — sheet 4 prints `0.1.0-rc.0 · rc` when the rc leads latest, and the bare number
  otherwise.
- 2026-09-11 — THE FOURTH REFRESH, at `origin/main` @ 65e2843 (commit 2026-09-11T18:51:12Z), all
  17 plates re-run at the one ref. Three members were born since 185d414 — `@tools/bootstrap`
  (`tools/bootstrap`), `@tools/eslint` (`tools/eslint`) and `@tools/repo-checks`
  (`tools/repo-checks`) — and each took all five hand tables: sheet 3B's `TERRACE` (with
  repo-checks additionally drawn whole as its own structure, "the guard house", off the root
  yard's west edge, absorbing the two former standalone check plots), sheet 7's `PLACED` (33 at
  490,350 · 34 at 514,530 · 35 at 449,385, pr tier), sheet 13's `PLACED` (the same three), 7B's
  `RUST` (all three at step 0) and `INSTRUMENTS` in `census-yard.mjs` (repo checks; bootstrap;
  `tools/eslint/` into the lint & probe fleet). The `docs` member is now
  `@www/lit-ui-router.dev`, which rekeys every task id cited on 3A, 3B and 12. Harness change:
  `basis.mjs` installs the materialized checkout with mise-provisioned pnpm — corepack has left
  the repo, so no probe shells `corepack pnpm install` any more. And the set's no-images rule
  now has ONE exception: Appendix A1's reference strip, six fair-use thumbnails inlined as data
  URIs at build, on the one plate whose subject is other people's drawings.
- 2026-09-12 — THE FIFTH REFRESH, at `origin/main` @ 2ac53a0 (commit 2026-09-11T19:11:23-07:00),
  all 17 plates re-run at the one ref: the 1.13.0 release (#820, f37cd04),
  then #821's late-upgrade fix and #823's examples pin bump. The release itself halted once: the
  main-graph run on f37cd04 failed in `lit-ui-router#test:engines` on the firefox lane
  (`src/specs/ui-view-ssr.spec.ts`), a spec the chrome-only PR lane had never exercised; the tag
  was cut at f0f64c1 after #821 and Publish to NPM succeeded on the second attempt
  (2026-09-12T01:46Z). NO member was born since 65e2843 —
  checked by diffing `pnpm-workspace.yaml` and every `package.json` between the two shas before
  the run, and confirmed after it by `census-yard.mjs` printing `orphans 0` — so the five hand
  tables took no row and the new-member checklist was, for the first time, a no-op. Three things
  the refresh taught, in the order they bit. (1) THE MOVE BROKE THE BASIS. `basis.mjs`'s `ROOT`
  was `../../`, which resolved to the repo root while the atlas lived in `diagrams/` and to
  `www/` after the promotion; `git archive` run from there archives only that subtree, so the
  first `census-scc` died on a missing `pnpm-workspace.yaml` in the tmpdir. The fix was first a
  recount to `../../../`, then the repo's own helper: `ROOT` is `@tools/bootstrap`'s
  `workspaceRoot`, imported by relative path the way `tools/workers-builds` does, and
  `thumbs.mjs` reaches `tools/embed-heights` through the same root, so the generator no longer
  carries a depth to re-derive. A path sweep that renames a tree has to re-derive every
  URL-relative constant, not just the literal strings — or, better, have none.
  (2) THE REFRESH CHAIN IS SIXTEEN PROBES, NOT FIFTEEN. `census-loop.mjs` takes `--ref` like a
  T3 probe but is a pure tree read, and it sits in neither list above; run the T1/T2 queries and
  the T3 installs and the cabinet still straddles two shas, which is precisely what
  `census-atlas.mjs` throws on. Run it with the T3 group. (3) THE EVIDENCE GUARDS EARNED THEIR
  KEEP. #821 rewrote `ui-view.ts` and `census-loop.mjs` stopped on
  `ui-view.ts:236 does not read «router.transitionService.onBefore({}, (trans) => {»`; the fix is
  always to RELOCATE the citation, never to widen the expectation — 41 (file, line) pairs
  re-pinned and one expectation re-texted, `this.uiRouter = this.uiRouter ||
  UIRouterLitElement.seekRouter(this);` at 197 becoming `this.uiRouter =
  UIRouterLitElement.seekRouter(this)!;` at 207, because the seek moved inside `seekRouter()`
  behind the late-upgrade guard. `census-mass3b.mjs`'s CITES and `census-shadow.mjs`'s e2e guard
  both passed untouched. The honesty sweep found two hand-stated figures the new plates
  contradicted, both made plate-derived: sheet 10's chrome caption ("5× the router they
  document", 4.81× at 65e2843 and 4.47× here) and the cover gallery's `297×` / `22.5%` / `3.9%`,
  which now import `SHEET8_TIMES`, `SHEET10_CORE_SHARE` and `SHEET10_ROUTER_SHARE`. The frozen
  "has grown" paragraph keeps its own copies of those three, as a rev-history paragraph must.
- 2026-09-13 — THE SIXTH REFRESH, at `origin/main` @ 9896b3c1 (commit 2026-09-12T22:38:38-07:00),
  all 17 plates re-run at the one ref: the 1.14.0 release (#853), then 1.14.1, mobx 1.0.1,
  nav-location 0.3.2, ui-router-server 0.1.2 and eslint-plugin 1.1.0 (#860–#864, every published
  member of the family on npm on 2026-09-13), the `srefHref`/`srefActive` attribute directives
  (#827), the `SrefStatusController` (#830), the plugin's new rules (#828), the typedoc-plugin
  trims (#831/#832) and its notDocumented work (#850–#852), and the Effect pair — the sample app
  (#721) and the bindings package (#833/#855). TWO members were born, the first since the fourth
  refresh, so the new-member checklist ran for real — and it cost more than five rows.
  №36 `sample-app-lit-effect` (apps/, born 2026-09-11) and №37 `lit-ui-router-effect` (packages/,
  born 2026-09-12) took: sheet 7's `PLACED` (36 at 660,100 · 37 at 30,210, both `line`), sheet 13's
  `PLACED` (the same, except 37 at 200,172 — sheet 7's south lot lands under 13's ORIGINAL MASONRY
  callout, so 13 differs deliberately, as it already does for №31), 7B's `RUST` (both step 0),
  sheet 3B's `TERRACE` — which took nothing, but its `APPS` list took the app and a SIXTH package
  quarter had to be cut, 27 `lit-ui-router-effect` at 418,30, after 17 unclaimed real tasks threw —
  and `INSTRUMENTS` in `census-yard.mjs`, a new rule `src — lit-ui-router-effect (private)`
  (5f/211 sloc) placed BEFORE the five-published rule so the published slab stays exactly five, plus
  its row 20 on sheet 3 at -10,140. Two more tables nobody had listed as hand tables also took a row:
  sheet 12's `register-graph.mjs` `APP_ORDER`, and sheet 9's district PLAN. `lit-ui-router-effect` is
  `"private": true` at this ref, so bricks, doors, couplings and npm all omit it by the `!m.private`
  filter and FIVE PUBLISHED PACKAGES stays the true sentence everywhere it is printed.
  ONE NEIGHBOUR MOVED: №2 `ui-router-server` off 200 to 222 on sheets 7 and 13, because
  lit-ui-router's annex grew to 126.7 units and `assertPlots` threw on a 12.0 × 54.4 overlap with the
  server's west wall — the guard doing exactly its job, and the fix a recomposed coordinate, never a
  shrunk rule. THE LESSON OF THE FOURTH APP SHELL: a new DISTRICT can hide without a throw.
  `census-shipped.mjs` sorted `app-effect.html` and its chunks into the loud `unclassified`
  catch-all, which is a PRINT, not a throw — the same shape as the yard's `orphans` line — so sheet 9
  drew an 11-district deploy with 111,363 gz of app sitting in a bucket nobody read. Every catch-all
  that only prints is a place a refresh can go quietly wrong; read the run's output, or make it throw.
  Teaching it the district (`app: effect`, 6f, placed at 660,295, first claim now vanilla → mobx →
  effect → hash) turned "three routed sample apps" into four and forced the model-viewer comparison
  to be re-based to vanilla, mobx and hash (207,346 gz), because all four (318,709) would have made
  it false. THE SEALED WING RELOCATED: `symbols/` left the tree with #831/#832 (the typedoc plugin is
  2 files / 343 sloc, from 5 / 759), so sheet 13's citation moves to `src/index.ts` and its SEALED
  WING callout is re-texted as THE YARD'S ONE WINTER WALL; 7B's `RUST[13]` steps 4 → 3 with it,
  because the ladder cuts R3 at ≤58 and the two surviving files read a median idle of 43 days — so
  no plant on 7B wears R4 at this ref and the cracked flanks stand unworn. THE LOOP RELOCATED, ONCE BY
  HAND: `census-loop.mjs` re-pinned 44 of 52 citations, 0 re-texted and 0 loosened, and one pin was
  chosen against the nearest match — `isNativeLink(element) &&` went 390 → 230, not to 379, because
  379 is #827's new DEV `assignHref` warning and not the guard the step is about. Nearest-match is a
  suggestion; the step's meaning decides. `census-mass3b.mjs`'s CITES and `census-shadow.mjs`'s e2e
  guard both passed untouched; mass3b gained a second DRIFT line, `lit-ui-router-effect#check:dev-split
  … no cite`, and `@tools/lit-template-lint#test` flipped placeholder → real. Provenance wording:
  every T3 plate now records mise-provisioned pnpm rather than `corepack pnpm` in `used` and
  `wasAssociatedWith`, and sheet 14's harness bar, aria and notes say the same. The T3 chain ran
  3 min 06 s with the pnpm store warm.
  AND THE RUST CHANNEL NOW DERIVES (7B rev H): the hand `RUST` map is gone, the five steps being
  re-cut each cabinet from `census-weather.json`'s own idle distribution — 0 ≤13d · R1 ≤35 ·
  R2 ≤46 · R3 ≤65 · R4 >65 reserved and unoccupied here — so a step label is only good for the
  plate it is printed on, which the sheet now says.
- 2026-09-14 — THE SEVENTH REFRESH, at `origin/main` @ 4223ffc7 (commit 2026-09-14T13:24:02-07:00),
  all 17 plates re-run at the one ref: the `lit-ui-router` 1.15.0 and `ui-router-server` 0.2.0
  releases (both on npm 2026-09-14), the six-PR prerender stack behind them (#806), and two release
  candidates riding npm's `rc` tag — `lit-ui-router-effect` and the new `lit-ui-router-ssr`, both
  0.1.0-rc.0. ONE member was born: №38 `packages/lit-ui-router-ssr`, the prerender bridge —
  `ui-router-server` verdicts in, `@lit-labs/ssr` pages out — peering `@uirouter/core`, `lit`,
  `lit-ui-router` ^1.15.0, `ui-router-server` ^0.2.0 and `@lit-labs/ssr`. It is PUBLIC at this ref,
  and №37 `lit-ui-router-effect` flipped `"private": true` → public with it, so the district ships
  SEVEN PUBLISHED PACKAGES where the sixth refresh's true sentence was five — and every sentence
  that counted five had to be re-derived or re-lettered: sheet 11's altitude reads SEVEN PACKAGES,
  sheet 2A's SIX PACKAGES, sheet 4's bay gate `all five`, sheet 2 schedules six moulded bricks and
  draws four, and the cover's own paragraph now derives its quarters and doors from
  `census-doors.json` (7 quarters, 20 doors). The general survey reads 789 tracked paths, 754 of
  them classified, 62,036 sloc (was 757 / 723 / 58,995).
  THE CHECKLIST RAN, AND THE YARD SWALLOWED THE MEMBER WITHOUT A SOUND. №38 took sheet 7's `PLACED`
  (160,210), sheet 13's (285,175), 7B's `RUST` (step 0) and a seventh package quarter on 3B
  (445,30); 3B's `TERRACE` and `APPS`, sheet 9's district PLAN and `register-graph.mjs`'s
  `APP_ORDER` took nothing, no app and no district being born. But `census-yard.mjs` printed
  `orphans 0` and was telling the truth: `INSTRUMENTS`'s `/^packages\//` catch-all had already
  eaten the new member, under a label that still read `src (5 published packages)`, while the sixth
  refresh's `src — lit-ui-router-effect (private)` carve-out went on looking true because it was
  matched first. LABEL ROT WITH NO GUARD — the count lived in a string, and no assertion held the
  string to the data. The fix: the carve-out deleted, the label re-lettered `src (7 published
  packages)` (54 f / 5,657 sloc), sheet 3's row 20 (effect, private) deleted and row 1 re-keyed.
  THE ANNEXES MOVED THREE NEIGHBOURS AND THE LETTERING. `assertPlots` threw again, and for the same
  reason it threw at the sixth: `lit-ui-router`'s spec annex reaches 223.3 units, so №2
  `ui-router-server` goes 222 → 226; №3 `lit-ui-router-mobx` drops y 130 → 136; №28
  `@tools/lint-elements` goes 380 → 388; `packages/ — THE PRODUCT` moves 772 → 815 to clear the
  district it letters; sheet 13 follows on all three and drops №31 to y 136. Two lots were tried
  for №38 and rejected before (160,210) took it — (330,130) and (360,125) both stand inside №31's
  block. And sheet 3 took a maintainer's bug report the same day: the tool-belt caption ran under
  mass 1's cap (SAT depth 22.1) and the grown 54-file cap struck `cache key over tools…` as well
  (depth 9.6), so the caption is shortened, the pair moves x 430 → 520, the
  `PACKAGES/* — THE MATERIAL` column 55 → 50, and the `twenty packages` district lettering derives
  from the plate's own tools count (23). A refresh that grows a member moves its neighbours AND the
  words drawn over them.
  THE PROBES: `census-npm.mjs` now records a `tags` map per row beside `version`, which stays
  `latest` — so `lit-ui-router-effect` and `lit-ui-router-ssr` file latest 0.0.1-alpha.0 with
  rc 0.1.0-rc.0, and sheet 4 quotes `0.1.0-rc.0 · rc` where the rc leads latest. `census-loop.mjs`
  relocated 16 citations (`ui-sref.ts` −129, `ui-sref-active.ts` −104) and took its first FILE move:
  `clickBelongsToBrowser`'s `isNativeLink` guard left `ui-sref.ts` for `sref-internals.ts:194`, so
  the walk reads seven source files where it read six. The nearest-match trap bit once more —
  `ui-sref-active.ts:437` had two candidates, 333 and 341, and 333 is the one the uniform shift
  gives. `census-mass3b.mjs` filed no absent-CITES error and carries a THIRD DRIFT line,
  `lit-ui-router-ssr#check:dev-split`, beside the effect and mobx ones.
  THE NUMBERS THE NEW MEMBER MOVED: doors 16 → 20 (`lit-ui-router` ./context 1,140/633,
  `ui-router-server` ./location 614/329, `lit-ui-router-effect` . 2,307/1,135,
  `lit-ui-router-ssr` . 2,745/1,431; 145,882 min / 52,328 gz across the set); couplings 7 nodes /
  12 edges → 9 / 21, of which the bench draws 14 (effect's `effect`, ssr's `@lit-labs/ssr` and the
  plugin's `eslint` stay off-bench), with a FIFTH bench column cut at x 900 because a tie down the
  680 column would run straight through mobx and `coupling-bench.mjs` throws on exactly that;
  bricks 6 → 8 rows; the bundle 121,650 gz with the flagship's chunk at 30,786; the deploy 788
  files / 4,542,847 gz over the same 12 districts; turbo 22 files / 112 definitions; the ci graph
  716 nodes / 1,897 edges / 225 real tasks; 24 members metered, the new one at 96% lit.
- 2026-09-23 — THE EIGHTH REFRESH, at `origin/main` @ 38c9fa1c (commit 2026-09-22T22:32:03-07:00),
  all 17 plates re-run at the one ref: `lit-ui-router-mobx` 1.0.2 and `lit-ui-router-effect` 0.1.1
  (both `latest` on 2026-09-21, effect's `rc` tag gone), and two release candidates under `rc` —
  `lit-ui-router` 1.16.0-rc.1 (latest stays 1.15.0 of 2026-09-14) and `lit-ui-router-ssr`
  0.1.0-rc.2 (latest still 0.0.1-alpha.0). Behind them on main: the hydration seam lifted out of
  `ui-view` into the ssr served view (#941) and the ssr register entry (#940), the
  workspace-catalog experiment merged and reverted (#950, #961), eslint 10, ubuntu-26.04 runners,
  turbo 2.11.2, pnpm 12.5.1, node 24.21. NO member was born — 38 members, seven published — so the
  new-member checklist was a no-op again, and every label that counts was asserted and read true:
  the yard's `src (7 published packages)` (62 f / 6,412 sloc), sheet 11's 22 doors in 7 quarters,
  sheet 3's seven published, sheet 7's `7 members, 7 published`. The general survey reads 818
  tracked paths, 783 classified, 66,257 sloc (was 789 / 754 / 62,036).
  NO MEMBER BORN, AND SIX THINGS STILL BROKE. (1) THE COVER'S VERSION GUARD held the repo's
  `lit-ui-router` version against npm's `version` — the `latest` tag — and main carries
  1.16.0-rc.1 against a latest of 1.15.0; the guard now asks that the repo version be served under
  SOME tag in `census-npm.json`'s `tags` map, still a hard throw, and LATEST SHIPPED reads
  `1.15.0 · 2026-09-14 · main at 1.16.0-rc.1 · rc`. (2) THE LOOP threw on `ui-view.ts:311`, and the
  file had not shifted — #941 REWROTE it, and it came back longer, 698 lines. 39 citations
  relocated by content and 4 re-texted (`seekParentView`'s signature at 266, `render()` at 670,
  `seekRouter`'s span of 2 at 294, the `parentView` assignment at 273, which lost its `!`);
  `ui-sref.ts` and `ui-sref-active.ts` moved a uniform +1, and 333 offered two candidates, 334 and
  342, where the shift gives 334. The walk's narration was re-read against the new file and holds.
  (3) `assertPlots` ON SHEET 7, a third refresh running on the same cause: the flagship's annex
  stands 233.9 × 132.0, so №2 `ui-router-server` goes 226 → 240 and №3 `lit-ui-router-mobx`
  y 136 → 146 — and a SECOND annex grew, №38 `lit-ui-router-ssr` 2 → 9 src files and 1 → 9 spec
  files, spanning x 215–288 across the oxc-emit road's old x 238 lane, so road 3 now ends at №38.
  (4) SHEET 13 could no longer copy sheet 7 and is RECOMPOSED: row one №2 240,20 · №3 240,104 ·
  №37 316,104; row two №31 16,149 · №38 165,156 · №4 303,150; the reading box's west wall
  620 → 668 because the server's annex reaches x 655. (5) SHEET 11's door-count guard threw at 22:
  ssr's `./client` (5,341 / 2,196 gz) and `./register` (3,109 / 1,408) seated, the quarter
  lettered "three doors", and the flagship's `.` door set back 30,15 → 26,46 because its 218 px
  tower put its badge outside the viewBox. (6) SHEET 13's FOUR SEASONS bars: 2026-09 took 245
  package touches and the bar ran out of its row, because each row's scale was a hand constant;
  both scales are capped from the plate's busiest month now.
  AND ONE SENTENCE WENT FALSE WITH NOTHING TO CATCH IT. The seventh cabinet's hand claim that №26
  `@tools/happy-dom` "owns a lit lamp and still stands dark — its canary lights happy-dom upstream,
  never its own source" stopped being true at this ref: the tool gained `src/inner-html.ts`
  (`setInnerHTMLDetached`) and its canary spec imports it, so 7A meters 1 of 2 files, 6 of 14 sloc
  lit (42.9% extent, lines 100%), `append.ts` still borrowed light from the flagship's lamp. 7B's
  lamp drawing derived correctly off the plate — one lamp — while its hand caption said "0 lamps".
  Both sheets' callouts derive from the row now, and their aria, schedule note and notes are
  re-written.
  THE WORDS FOLLOWED. Sheet 9's `page chunks` y 166 → 178 and its Inter caption re-hung as four
  lines beside the html-pages tower (170.7 units, cap at y 38), №1 inter fonts left nearly occluded
  on purpose; sheet 3's `PACKAGES/* — THE MATERIAL` x 50 → 40 off the 62-file slab; 7A's packages
  lettering rewrapped clear of №3's halo, its "1.5–3.9×" annex range DERIVED from the plate (still
  1.5–3.9×); sheet 2's `course` plural derived, since ssr's 3-course brick would have printed
  "3 course"; 3B and sheet 4 re-texted present-state for effect's `latest` and ssr's rc. The frame
  audit ran before and after: 0 viewBox escapes, 0 lettering hits above 1 px, one 7B piece 0.6 px
  into a mass, inside tolerance.
  THE NUMBERS: city 278 src files / 22,321 sloc and 145 spec / 23,672 (was 267 / 21,404 and
  132 / 20,900); doors 20 → 22, 166,259 min / 59,307 gz (was 145,882 / 52,328), the flagship `.`
  8,206 → 8,719 gz and ssr `.` 1,431 → 2,273; couplings 9 nodes / 22 contracts, the new one ssr →
  `@lit-labs/ssr-client` ^1.1.0, off-bench; bricks — the flagship 18 studs, ssr 2×3 over 3
  courses; the bundle 122,052 gz in 17 chunks, the flagship's group 34,211 rendered over 14
  modules; the deploy 857 files / 4,823,157 gz over the same 12 districts; mise 54 tasks · 15
  `depends` edges (was 52 · 6), turbo and the ci graph unmoved (716 / 1,897 / 225); steam 546
  commits; weather 423 dated files; 24 members metered, ssr at 98.6% over 8 of 9 files.
  `@tools/repo-checks`' new `runner-label.test.ts` shells git and fails "not a git repository"
  inside the `git archive` tmpdir; the member still meters from the turbo run.
- A PLATE'S `ref` IS THE ARGV STRING. `basis.mjs` resolves the sha to archive the tree, but the
  plate files the ref as it was typed, and every title block prints that field — pass the full
  sha and 20 title blocks print forty characters. Run the chain with `--ref origin/main` and keep
  the no-re-fetch rule above; that, not a pasted sha, is what holds the cabinet on one commit.
- A VERSION GUARD READS THE TAGS MAP, NEVER `latest`. npm's `version` is the `latest` tag, so a
  guard that holds the repo's version against it throws the moment main carries a release
  candidate. Ask whether the repo version is served under SOME tag (`census-npm.json` `tags`),
  and print which one.
- A REWRITTEN FILE RELOCATES BY CONTENT, NOT BY SHIFT. When a cited file is rewritten rather than
  edited around, no uniform offset exists; find each expectation's new line by its text, and
  expect re-texts to follow — the eighth refresh took 39 relocations and 4 re-texts off one
  `ui-view.ts`. A uniform shift is only a tie-breaker for files that did merely shift.
- A HAND-TYPED PLURAL OR RATIO IS A HAND COUNT. `3 course` and `1.5–3.9×` rot exactly like
  `5 published`: the number moves under the word. Derive the inflection and the range from the
  plate the same way the count is derived.
- A CHART'S SCALE IS A HAND CONSTANT TOO. A bar scale fixed at the busiest month the author saw
  overflows its row the first month that outgrows it; cap the scale from the plate's own maximum.
- A SENTENCE ABOUT ONE MEMBER'S SHAPE IS A HAND COUNT IN DISGUISE. "stands dark" and "0 lamps"
  are figures written as prose, and they rot the moment the member gains a file; derive the
  figure from the plate row and let the sentence read it.
- A plate's two dates are read from two clocks and can disagree by a day. `commitDate` is
  `git show -s --format=%cI`, the committer's LOCAL time, and `chrome.mjs::DATE` takes its first
  ten characters; `generatedAtTime` is a UTC ISO string, and sheet 7's `BASIS` line takes ITS
  first ten. At 2ac53a0 — committed 19:11 −07:00 — the title blocks date 2026-09-11 and sheet 7's
  lead reads "counted at origin/main @ 2ac53a0 (2026-09-12)". Both are honest and both are
  derived; neither is a figure to hand-correct.
- Hand placement is asserted, not trusted. Every plate that hand-places a footprint whose SIZE
  comes from the census (3, 3B, 7, 7A, 7B, 9, 10, 11, 13) calls `assertPlots` from
  `generator/iso-hidden.mjs`, which throws when two drawn ground rects intersect, naming the
  sheet, both members and both parts. A refresh that grows a member into its neighbour stops
  the build; the fix is to recompose the coordinate by hand, with air, never to shrink the rule.
- AND IT FIRES EVERY REFRESH NOW, because the flagship's spec annex grows every refresh. №2
  `ui-router-server` has moved twice for it (200 → 222 → 226), №3 and №28 once each, and the moves
  carry sheet 13 with them. The lettering moves too, and nothing asserts THAT: a district label or
  a callout is a hand coordinate over a measured footprint, so `packages/ — THE PRODUCT` went
  772 → 815 and sheet 3's tool-belt caption had to be shortened and moved when the yard's own cap
  grew across it. After a refresh, read the plates for type standing on masonry, not just for the
  overlaps `assertPlots` names — the guard covers ground rects, not words. The seventh refresh
  measured how much that costs: a SAT lettering check over all 20 SVG plates, written as tmp
  tooling and NOT wired into the generator, found hits on NINE of them (2, 3A, 7, 7A, 7B, 9, 11,
  13, 14) at depths from 6 to 92.9 — label blocks across a brick's studs, a list through a panel
  wall, a schedule row 74 units past its frame, a group label inside a tower. None of it is
  something `assertPlots` can see. The same audit found the other shape of the same fault: 7A's
  hand `NOTE` table was keyed 1–32, so members 33–38 printed `undefined` in the schedule and no
  guard said a word — a hand table that indexes by member number needs a gate as much as a label
  that counts needs an assertion. Budget a frame audit into every refresh until one of the two
  lives in the build.
- Sheet 13 keeps its OWN copy of the city placements (`sheet13.mjs` `PLACED`; member 31
  deliberately differs). A coordinate moved on sheet 7 must move there too, or the two plates
  stop reconciling — the assertion catches an overlap, not the drift.
- `build.mjs` writes `www/atlas.lit-ui-router.dev/README.md`. Its head, runbook and cabinet paragraphs live in
  the emitter; edit them there, since any build reverts a hand edit to the output.
- Expect the build to throw during a refresh — that is the pipeline working. A sheet whose
  subject moved (a task that left the graph, a cited file that left the tree, a district
  that stopped shipping) throws instead of drawing a stale figure, and the fix is a sheet
  edit, not a probe edit.

**How the guards are shaped**

- `census-atlas.mjs` throws on: a plate with ≠1 writer, a probe naming an unfiled plate, a
  drawing reading an unwritten plate, and any plate disagreeing with the cabinet about the
  ref. It discovers probes as `census-*.mjs` files that write a plate and tiers from which
  `basis.mjs` primitive each one calls, so a new station joins appendix A2 and A2i with no edit
  — and an unimported `census*.mjs` shows in the drawer struck through as UNWIRED.
- Sheet numbers come from plate lookups that THROW on a missing row. Nothing numeric is
  hand-pasted except declared editorial (plans, scales, prose history, 7B's rust,
  placement).
- `census-query.mjs::cityUniverse` is the ONE city universe shared by sheets 7 / 7B / 13, so
  their footprints reconcile by construction.
- `census-mass3b.mjs` throws a NAMED error when a CITES row points at a file absent at the
  ref (not scc's "could not be read"); `census-loop.mjs`'s evidence table is authored as
  (file, line, expect) and throws when the line stops reading what it expected, so cited
  line numbers cannot rot silently.
- `coupling-bench.mjs` throws at build time if any same-column tie is laid through a third
  building, so the next such fault is a build error rather than a curve drawn around it.
- `census-shadow.mjs` resolves every lcov `SF` path against BOTH the run's cwd and the tree
  root and takes the candidate that names a real file — without it ui-router-server read 0
  of 8 files lit. A meter that attaches and finds nothing of the member's own is `m` at
  extent 0, not `u`; `u` is awarded only after a second, meter-less run proves the suite
  passes. Error strings have the tmpdir stripped to `<archive>` or the plate never diffs
  clean.

**FORM is a phrase; the keys are the index**

- Every plate's FORM stays on its title block as written; the four keys behind it —
  `subject`, `projection`, `mode`, `basis` — live in `generator/labels.mjs` and nowhere
  else. `assertLabels()` runs inside `emitApp()` and throws on a plate with no key set, a
  value outside `VOCAB`, a vocabulary value no plate uses, a non-city carrying `basis` or a
  city without one, and a `mode` that disagrees with whether the plate is drawn interactive.
  The keys ride the manifest to the routed app, where the cover's KEY INDEX is one control
  per key shaped to its type and the filter is route state (`/?subject=city&basis=measured`
  is a link); the `key=value` box is the fallback for combinations the chips cannot say.

**Drawing traps**

- `generator/sheetA2.mjs`'s `WORD` lookup is a FINITE array (`no` … `fifteen`). It indexes
  off the master plate's consumer count; past fifteen it reads `undefined` rather than
  failing loudly.
- Every house drawing class (`.sk`, `.skf`, `.sks`, `.skr`) declares `fill: none`, and a CSS
  declaration always beats a presentation attribute — so `class="sk" fill="url(#…)"` draws
  NOTHING. The house idiom is two elements: the fill polygon with no class, then the stroke
  polygon with `class="sk fnone"` (`sheetA1.mjs::poly`). The same trap is latent in
  `helpers.mjs::isoBlock`.
- Plate lettering is `var(--data)` (DIN), not the mono it was drawn against; row numbers go
  through `helpers.mjs::schedTxt`, which emits the number as its own end-anchored `<text>`
  in a 14px gutter instead of `padStart`-ing it against a mono advance.
- `document.fonts.check('12px "no-such-face"')` returns TRUE — the spec asks "can this be
  rendered", and an undeclared family renders fine by fallback. Ask the FontFaceSet whether
  the family is DECLARED before trusting `check()`. The atlas has no kit-gated type left to
  guard (the catchword was dropped 2026-09-12), but the trap holds for any future kit face.
- A webfont is only DOWNLOADED when something uses it, so a face readout taken immediately
  after a change reads SYSTEM for ever. Chain `updateComplete` then `document.fonts.ready`
  for a deferred second pass (`app/src/specimen.ts`).
- lit cannot bind inside `<style>`: a plain `<style>${…}</style>` template throws
  "Unexpected final partIndex" in @lit-labs/ssr and is an invalid location in the browser
  too. Cover CSS goes in as `unsafeHTML('<style>…</style>')`.
- cytoscape-dagre is NOT on cdnjs at any version. The house pattern is a rank-from-edges
  `preset` layout computed at build time, so a picture is identical on every load; the
  single pinned cytoscape URL lives in `pipeline-graph.mjs` and every other lane imports it.

**The site, the app and the artifact**

- The atlas is LIVE at <https://atlas.lit-ui-router.dev/> — a Cloudflare Pages project
  (`altitude-atlas`, production branch `worktree-altitude-atlas`, direct upload). Refresh
  cycle from `www/atlas.lit-ui-router.dev/`: `node generator/build.mjs .` → `npm --prefix app run build` →
  `node generator/stage-site.mjs` → `wrangler pages deploy dist --project-name
  altitude-atlas`. The atlas is promoted into `www/` as an example that became a site, and it
  merges to main as one squash PR. After that it is ordinary PR work like every other tree here.
- The routed app owns `/`; the flat set is staged under `/set/`. ONE base constant,
  `app/src/routes.ts` (MOUNT/BASE/SET + the `href` table), is imported by vite's `base`,
  `<base href>`, `emit-app.mjs` and `stage-site.mjs`.
- Pages 308s `/sheet/2A` onto `/sheet/2A/`, which core's default strictMode rejects —
  `strictMode(false)` in `router.ts` and `config: { strict: false }` on the server mount are
  load-bearing, or every deep link boots into notFound. The Navigation API plugin also
  registers no `navigate` interceptor of its own, so the app wires one there or every click
  is a document load (ask 9).
- No router hook says "the view re-rendered": release view transitions and any post-nav DOM
  read off lit's `updateComplete` (`app/src/experimental/view-rendered.ts`), never off rAF
  counting.
- `manifest.sheets` is what walks the set in ascent order; `extras` (the city, the specimen)
  and `appendix` (A1) exist so a page can join the rail, the cover and the server mount
  without entering the ←/→ walk or the sheet numbering.
- The artifact build (`npm run build:artifact` in `app/`) is the same app as ONE file: vite
  mode `artifact` + vite-plugin-singlefile; `app/artifact.ts` strips the host-supplied
  doctype/html/head/body, hoists `<title>` to byte 0 (only the first 8KB is scanned) and
  bakes the manifest and every fragment into a JSON island. Nothing is fetched at runtime,
  the router takes `hashLocationPlugin`, and `app/src/mode.ts` is the one flag.
- FONTS, ONE HOST PER PAGE: with `VITE_ADOBE_FONTS_KIT` set, `stage-site.mjs` injects the
  Typekit link into every staged page AND strips the Google Fonts links `app/index.html`
  carries; unset, it emits `Adobe Fonts kit: none` and the Google half draws everywhere —
  which is what the claude.ai artifact gets, since that host allows `fonts.googleapis.com`
  and nothing else. Every stack names the Adobe family first and the Google stand-in second.
  Kit names are not the marketing names (`p22-fllw-eaglefeather` with three l's, but
  `p22-flw-exhibition` with two), and the kit serves 400/700 only — a CSS request for 600
  resolves UP to 700 on Adobe and takes 600 from Google, so one weight number serves both
  hosts with nothing synthesised.
- ui-router-server is a verdict engine, not a renderer: one route table drives dev, preview
  and the build-time prerender identically. `lit-ui-router-ssr` owns the render call, the emit
  loop and `_redirects`, and it draws the client's OWN views — ONE template set, because
  `prerender()` scopes the router around each render and the attribute directives (#827) emit
  real hrefs, `is-active` and `aria-current` for the state the page is. The consumer findings
  and the package-level asks behind that are in `app/SSR-VERDICT.md`.

**Direction, in the user's own words**

- 3D: the CSS tilt "does nothing for me" on the pipeline graph — what was wanted was the
  isometric CITIES, which "may need the full 3d rendering engine."
- Widescreen (a 3008px display): "if anything too big — maybe contain instead of cover."
  Plates CONTAIN; no centred max-width cap.
- The app: "ready for some dogfooding, it's past time"; it "takes over the homepage" and the
  flat set is "preserved as an alternative version to compare against."
- Type: "title + sidebar as exhibition my favorite. eaglefeather still top for the altitude
  atlas title … definitely think we should go with source serif for prose. think din takes
  it." The hand faces — "i swear i'm just allergic to these hand types. maybe in situ i'll
  appreciate" — are the title block's DRAWN BY value and nothing else; the chop is unrotated
  ("the jaunty stamp angle is meh … for now rather have order"); and "reserve monospace" is
  why plate lettering is DIN.
- The article: "i kinda like the hwt catchwords sparingly but found myself converting `the`
  to a `<sup>` with .6em din-2014 font, lowercase" — so `the` was a superior everywhere
  and the catchword the cover title's alone. A 2026-09-11 attempt at one shared baseline
  rule (rail article head with ditto marks, catchword on the cover) was rejected the same day:
  "i miss uppercase THE in THE ALTITUDE ATLAS i prefer that consistency … right so we have two
  variants -- condensed with wordmark, used in block and sheet header, full uppercase, used in
  sidebar and homepage". The catchword itself was dropped 2026-09-12 — "just isn't dialed in
  yet", and the superior `the` followed it out of the wordmark on 2026-09-12 ("seems the
  altitude atlas is back to superior the -- want no special treatment just uppercase everywhere
  now"). So: ONE wordmark, THE ALTITUDE ATLAS uppercase in the DISPLAY face ("i do want
  eaglefeather for altitude atlas everywhere in block and project title etc" — `.project-mark`,
  1.06em so its cap matches the ledger's) at the rail head, the cover title, every sheet header
  line and the title block's PROJECT field; only the size differs by site. The superior stays on
  sheet titles and cards; the title block's SHEET TITLE sets `the` inline, lowercase DIN, same
  size and baseline. Never re-propose the rail article.
- The sprite study "remains relevant and should be included as a meta appendix in some form
  — roll it in" (Appendix A1). Its pinned note governs every sprite lane, 2D and 3D: walls
  are TRANSLUCENT semi-opaque, never fully opaque, so the girding frame reads through.
