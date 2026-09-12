# Census pipeline rework — design record

**COMPLETE.** Initiatives I1–I8 all landed 2026-09-02/03; the cabinet has since been
refreshed five times and stands at `origin/main` @ **2ac53a0** (commit
2026-09-11T19:11:23-07:00), 17 plates all pinned to the same ref.

The architecture that came out of it: `generator/basis.mjs` materializes any ref once (`git
archive` → tmpdir), one `scc --by-file` pass over that archive is the master per-file
census, and every other tree probe is a group-by query over those same rows — so cross-sheet
totals reconcile by construction, not by discipline. Probes write
`www/atlas.lit-ui-router.dev/data/<probe>.json`; sheets import the plate and render figures and provenance
lines from its fields through lookups that THROW on a missing row. History probes derive
"today" and their windows from the measured commit's date. `generator/census-atlas.mjs`
introspects the pipeline at build time, draws it as sheet 14 plus the interactive lane, and
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
| I7 | Cytoscape pipeline graph + sprite nodes | NODES/EDGES model, sprite skins; now sheet 14i |
| I8 | 3D | CSS tilt (retired) → three.js isometric city |

## Operating notes and traps

**Refreshing the cabinet after a release**

- Probes default to `--ref origin/main` (`basis.mjs::refFromArgv`), but a plate filed
  mid-refresh must measure the tree its siblings measured — pass the CABINET's sha
  explicitly, or `census-atlas.mjs` throws on the mismatch.
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
  orphans loudly, which is a guard that should probably throw too. A new PLATE (not member)
  needs a key set in `generator/labels.mjs` as well, or `assertLabels()` stops the manifest.
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
  first `census-scc` died on a missing `pnpm-workspace.yaml` in the tmpdir. It is `../../../`
  now, the same depth `thumbs.mjs` already used to reach `tools/embed-heights`. A path sweep
  that renames a tree has to re-derive every URL-relative constant, not just the literal strings.
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
  `basis.mjs` primitive each one calls, so a new station joins sheet 14 and 14i with no edit
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

- `generator/sheet14.mjs`'s `WORD` lookup is a FINITE array (`no` … `fifteen`). It indexes
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
- ui-router-server is a verdict engine, not a renderer: one route table drove dev, preview
  and the build-time prerender identically. @lit-labs/ssr draws the bytes but needs a SECOND
  template set with plain hrefs, because `uiSref` is an element-part directive that SSRs to
  a dead link (#564) and `<ui-view>` throws on construction under the DOM shim (#803). The
  consumer findings and package-level asks are in `app/SSR-VERDICT.md`.

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
  yet" — so: CONDENSED = the superior `the` (0.6em DIN, lowercase) + ALTITUDE ATLAS in the
  DISPLAY face ("i do want eaglefeather for altitude atlas everywhere in block and project
  title etc" — `.project-mark`, 1.06em so its cap
  matches the ledger's) on the sheet header line and the title block's PROJECT field; FULL UPPERCASE = THE ALTITUDE
  ATLAS in the display face on the rail head and the cover title; the superior stays on sheet
  titles and cards; the title block's SHEET TITLE sets `the` inline, lowercase DIN, same size
  and baseline. Never re-propose the rail article.
- The sprite study "remains relevant and should be included as a meta appendix in some form
  — roll it in" (Appendix A1). Its pinned note governs every sprite lane, 2D and 3D: walls
  are TRANSLUCENT semi-opaque, never fully opaque, so the girding frame reads through.
