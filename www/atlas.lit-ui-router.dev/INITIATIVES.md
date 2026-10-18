# Census pipeline rework — design record

**COMPLETE.** Initiatives I1–I8 all landed 2026-09-02/03; the cabinet has since been
refreshed nine times and stands at `origin/main` @ **fe44598e** (commit
2026-09-25T21:07:00-07:00), 17 plates all pinned to the same ref.

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
| I8 | 3D | CSS tilt (retired) → three.js isometric city (retired) → the city and its working twin as glTF in model-viewer |
| I9 | The canvas: every plate on one surface in the routed app, horizontal and vertical scroll, zoom and pan, sheets animating into view (user, 2026-10-12: the flat set's gallery and megacanvas were "nice to see it all in one layout"; deferred, not started) | a routed state over the fragments; stands where `/set/` and `megacanvas.html` stood |
| I10 | The bare plate: a `plate` route in `app/src/routes.ts` that the prerender answers with one fragment in a bare page, no shell and no client bundle, the client knowing it only as a link target (user, 2026-10-12: "opting out of the ui router client but still using source data of state definitions to define rendering behavior"). Once it serves, the `/set/sheet-*` redirects land there, the audit and the thumbs photograph it, and `chrome.mjs`'s page wrapper and `tmp/flat/` go | follows the flat-set retirement; next in order |
| I11 | The ecosystem plate: a second brick assembly at sheet 2's scale whose bricks are the third-party runtimes the family seats on — hono, effect, signal-polyfill, mobx, lit, @uirouter/core itself — each massed from its published tarball and jointed to the family brick that peers it (user, 2026-10-13: "new sheet with expanded ecosystem scope, including hono effect signals-polyfill mobx etc as bricks, similar to ui router core plate", then "ecosystem bricks plate / sheet(s) with alternate build instructions for census recipes" and "i think we want views both with and without the atlas as a consumer, like the other atlas measurements"; landed 2026-10-13 as sheet 2C, THE ALTERNATE BUILDS) | two probes, `census-peers.mjs` (each runtime's one shipped build, tarball and closure) and `census-builds.mjs` (the consumers' distinct part sets, in both readings: the cabinet's tree and `withAtlas`); sheet 2's brickKit reused; stands after the nineteenth cabinet |
| I12 | The clickable legend: on the bricks in the round (`atlas.bricks`) a parts panel inside the viewer, in the stage's top-left corner, one chip per brick in badge order, each an anchor on `?focus=` with that brick's number — the pin `generator/brick-scene.mjs` opens on through `pin(member(atlasFocusRead(focus)))` — and the same on the city in the round (`atlas.city`, and the working city with it) under a header bar in the top-right under ENLARGE — MEMBERS · 46, a fold at every width, a corner step and a drag that snap the panel to the top-right, bottom-right or bottom-left corner, and a resize grip — the members grouped by district in folding `<details name>` groups in the plate's district order, each heading with its count and one open at a time, every chip keyed by the member's number on sheet 7's schedule, the plot the city pins (user, 2026-10-13: "bricks and probably the cities in the round but trickier -- benefit from clickable legend to navigate to the focus states", then "go ahead, card then I12", then on the first cut above the plate "ok nice the legends are working. expected them to be inset inside the diagram as part of it" and "i think even inside the viewer not in the sticky bar next to the prose, as part of the interactive diagram themselves", then on the city's panel "the legends on the cities need some work layout or scroll or something. bricks works great", "maybe the legend panel is collapsible / minimizable / repositionable / resizable", "the city legends weren't so bad on widescreen but mbp 14" or below eh" and "cut b go"; landed 2026-10-13; sheet 2C is a static plate and carries no panel) | `partsCss`, `partsMarkup` and `partsPanel` in `generator/mv-kit.mjs`, emitted by the scene modules from the data they render, the city's through `partsCss`'s `fit` option and `mvJs(fit)`; a chip click takes the hotspot's own `tap` and `atlasFocusPush`, so the url's `focus` moves through `main.ts`'s `atlas-focus` handler, and the scene's `pin()` lights the chip, opens its group and scrolls the list to it; the href is the no-script path; on the bricks under 720px the panel folds to a PARTS toggle; the city's stage is a size container: two columns on a stage at least 1400×700, one capped scrolling column below it, folded to the bar under 760×480; stands after I11 |
| I13 | The docs site's companion pages: `www/lit-ui-router.dev` (the production site, branch `main`) features sheet 2 where it introduces the companions — the overview `packages/index.md` keeps its own table of mobx / effect / signals / ssr / server / navigation-plugin / eslint-plugin and sets sheet 2's thumb pair, light and dark, beside it as a reference linking to the bricks in the round at atlas.lit-ui-router.dev, and each companion page carries a reference link to its own brick's focus state through `?focus=` on `atlas.bricks`, the ssr page to the bridge brick, the mobx page to its brick, and so on; the homepage `index.md` and the READMEs stay on sheet 7, the atlas's face (user, 2026-10-13: "sheet 7 is already the face on the atlas landing page; divergence would be its own branding story"). At `origin/main` the atlas is cited three times on `packages/ssr.md` (an inline example at `/sheet/7B`, a pointer at the atlas's `app/prerender.ts`, a closing "dogfood consumer" link) and once in `guides/server-route-matching.md`, and nowhere on `packages/index.md`, `introduction.md`'s summary table, `index.md` or the READMEs (user, 2026-10-13: "sheet 2 can be used in the companion packages of the docs site overview etc -- thinking of ways to include there more" and "quite exciting to be able to extend our documentation to this custom visualization surface"). The docs and the atlas stay parallel and independent: every docs page reads whole with the thumb and the focus links removed, and nothing on the docs site depends on the atlas (user, 2026-10-13: "prefer to keep the docs and atlas parallel but independent -- we can reference or even feature the atlas in the docs but it should stand alone and speak for itself, atlas supplements not supplants"); in flight as draft PR #1442 (branch `docs/atlas-links`, commits 628732ea and 0a1aabe1), which carries the Atlas nav item, the overview thumb beside the table and the per-package `?focus=<name>` links, the atlas side landed on `www/atlas` in 2011c945, where the bricks take a package name as their focus; the docs side merges on the user's call | the thumb pair is the atlas's own, `app/public/thumbs/2.webp` and `2-dark.webp` as `generator/thumbs.mjs` writes them; the focus links need I12's legend anchors on `atlas.bricks`; the change lands as a PR on `main` against `www/lit-ui-router.dev/packages/index.md` and the companion pages beside it, not a `www/atlas` commit; stands after I12 |
| I14 | The atlas build as a repo check: the generator's census guards — sheet 2's "seat the newcomer" throw against `census-bricks.json`, sheet 4's `BRIDGES` against `census-couplings.json`, sheet 11's `RC_LED` against `census-npm.json`, 2C's family and range checks, `labels.mjs` and `chrome.mjs`'s `TOTAL` — are feedback the repo receives only when `ship.mjs build` runs by hand on `www/atlas` at ship time; a job in the PR lane on `main` runs `generator/build.mjs <scratch out>` (the generator alone, no app build, no deploy) so the drift a PR causes — a published package not seated, a peer range the drawings no longer match, an rc leading latest — surfaces on the PR that causes it. Nothing on `origin/main` builds the generator or runs its guards: `main` carries no atlas tree (`git ls-tree origin/main www/` lists `lit-ui-router.dev` only); what merged 2026-10-13 is the deploy observer `pages-deploy (altitude-atlas)` (`108456af`, `.github/workflows/release-signals.yml`, `tools/workers-builds/pages-deploy.ts`, `tools/release/mise.toml`), which asks whether atlas.lit-ui-router.dev serves the `www/atlas` head and builds nothing; the branch lane (`build-test-branch.yml` on `www/atlas`, `www/DEPLOY.md`) lints the atlas tree and runs no generator. The constraint: `build.mjs` reads the committed plates under `data/` (`census-query.mjs::loadCensus`, each sheet's `readFileSync` of `data/*.json`) and no ref, so on a PR the guards see the cabinet's sha (`108456af` today), not the PR's — on committed plates alone the build proves the drawings still match the plates they were filed from, plus one live read, sheet 2's `SRV_NODE` from `packages/ui-router-server/package.json`; drift from the PR needs a refile at the PR's sha, `census-scc.mjs` (git archive + scc) then `census-bricks.mjs` and `census-couplings.mjs` for the newcomer and bridge guards and `census-npm.mjs` (live registry) for `RC_LED`, with the T3 install probes left alone — which `census-atlas.mjs` refuses as a cabinet split across two shas unless the scratch run refiles the whole set or relaxes that one guard. Advisory, not a gate: the atlas and the docs stay parallel and independent (user, 2026-10-13: "atlas supplements not supplants"), so the job reports and never blocks a merge (considered, not started; the user's call whether it is a required check) | the job checks out `www/atlas`'s `www/atlas.lit-ui-router.dev/` beside the PR's tree (sparse checkout or `git archive origin/www/atlas`), since `main` carries no atlas; the generator needs no install beyond mise's node (`basis.mjs` imports `tools/bootstrap/src/root.ts` by relative path) and `scc` for a refile; stands apart from I11–I13 |
| I15 | The builds in the round: each of sheet 2C's eight builds as its own explodable glTF model in Google's model-viewer on one routed page, `/builds?build&focus&enlarge` (`atlas.builds`), picked by name in the bar — VANILLA, SIGNALS, EFFECT, MOBX, NAV, SERVER, ESLINTED VANILLA and THE ATLAS — the bricks in their hues on the runtime plates they peer, each runtime a stack of plates scored per plate with studs on its top plate, the straddles and the dashed ties drawn, and each build's explosion as its clip, the stacked bricks first, half again as high, the plates staying put; the parts panel pins bricks by number and plates by letter, and the plate reading gives the runtime's version, range, one-build measure, plates and studs and its peers (user, 2026-10-14: "can we get 3d explodeable models for each build now", and on the atlas app's build "build viii should be named the atlas and described as the eslinted effect nav ssr server"; landed 2026-10-14) | `BUILD_MODELS` and `BUILD_BOX` exported from `generator/sheet2c.mjs`, seated in sheet 2's plan units with each brick's drawn lift; `generator/builds-glb.mjs` on `brick-glb.mjs`'s materials, stud, edges and `assembleMotion`, one binary per build under 100 KiB at `app/public/models/builds/<slug>.glb`; `generator/builds-scene.mjs` for the fragment, the island and `builds-init.js`; the `build` param rides `focus.mjs`'s `atlasBuildPush` on the `atlas-focus` seam into `main.ts`; `AtlasScene` in `app/src/views.ts` under `atlas-city`, `atlas-bricks` and `atlas-builds`; `check-scenes.mjs` drives it; stands after I12 |
| I16 | The consumers as bricks: the other way from sheet 2 to 2C — the repository's own consumers, the sample apps under `apps/`, the docs site `www/lit-ui-router.dev`, the embedded examples under `examples/<key>` and the atlas's own app on `www/atlas`, as bricks at sheet 2's mould, each massed from its own authored files and sloc and seated on the family parts it pins, a ringed stud per pin, in both readings and grouped by sheet 2C's named builds (user, 2026-10-14: "then the other way from 2 to 2c would be the app consumers as bricks, mark as new initiative, spawn subagent(s) to start sketch"); landed 2026-10-14 as sheet 2E, THE CONSUMER BUILDS, cut B (the user: "from the first contact sheet 2e b looks great. cut a looks wild unintelligible to me i like it but not as a viz tool", then "hmm what about cords on 2e b"); the sketch's findings: nineteen consumers, 15,156 sloc, 111 studs with the atlas app (eighteen, 10,591 sloc, 80 studs at the cabinet's tree); sixteen pin `lit-ui-router`, `sample-app-lit-e2e` pins none, the atlas app is the heaviest at 31 studs and `sample-app-shared` the tallest at 14 courses. The sketch (f102f4e3) drew two cuts behind a switch: a, one assembly, sheet 2's seated model with the lint plugin on a ground of its own and the consumers on one deck above it in clusters lettered by build, every pin a tie to a ringed stud, since brick 1 keeps two free studs under the bricks seated on it; b, the booklet, sheet 2C's builds on ground slabs without their runtime plates, each consumer on a level of its own over the heaviest part it pins, a drop onto it and a dashed tie to each other pin, where the sheet draws cords | `generator/census-consumers.mjs` (`data/census-consumers.json`, `rows` and `withAtlas.rows`: authored files by the city ruler over `CITY_DIRS`, else `src/`, specs and the atlas app's `src/generated/` aside; sloc from `census-files.json`'s rows at the cabinet's sha and an `scc --by-file` pass over the atlas archive; pins and build from `census-builds.json`, whose two shas it measures at; mould from sheet 2's `STUDS`, `SHAPE` and `COURSES`); `generator/sheet2e.mjs`, sheet 2E, `companions-consumers`, THE CONSUMER BUILDS, rev A, reading `BRICK_MODEL`, `BRICK_ROWS` and sheet 2C's `BUILD_MODELS`; registered in `build.mjs`, `emit-app.mjs` and `labels.mjs` after 2C; every pin past the heaviest a cord from `connector-iso.mjs`, 15 drawn and three scheduled undrawn; cut A parked outside the tree; stands after I15 |
| I17 | The consumers' pins, layer by layer: sheet 2C's alternate builds opened at the pin — each consumer sheet 2E masses, its family pins as declared, as resolved and against npm's latest, and the runtime dependencies under them, read where its installer reads them: the tree for a pnpm workspace member, the pnpm altitude, its own `package-lock.json` for an embedded example and the atlas app, the npm layer (user, 2026-10-18: "How well are the examples censuses + visualizations represented? Do we need more granular views? Handy for the pnpm altitude but insightful to see the npm layers. Corresponds to the alternate builds", then "Nice add the probe and plate, noting it in initiatives."); landed 2026-10-18 as sheet 2F, THE PINNED BUILDS; the first filing's findings: twenty consumers, eight pnpm and twelve npm; 39 family pins, 11 from the tree and 28 from a lockfile, none trailing latest; 87 runtime dependencies; the npm lockfiles at version 3 in six and 4 in six; `effect` 4.0.5 from the tree against 3.22.1 and 3.22.2 in the npm layer | `generator/census-pins.mjs` (`data/census-pins.json`, `consumers` and `withAtlas.consumers`, plus the workspace's lockfile, catalogs, overrides and patches: a T1 read of each consumer's manifest, `pnpm-workspace.yaml`'s catalogs, `pnpm-lock.yaml`'s importers and each npm consumer's own lockfile at `census-builds.json`'s two shas, `latest` joined from `census-npm.json`, no install and no network; it throws on a consumer either side lists that the other does not, a pin set off `census-builds.json`, a family pin `census-npm.json` lacks and an npm consumer with no lockfile); `generator/sheet2f.mjs`, sheet 2F, `companions-pins`, THE PINNED BUILDS, rev A, reading sheet 2C's `BUILD_MODELS` and sheet 2E's `SHEET2E_TAGS`; registered in `build.mjs`, `emit-app.mjs` and `labels.mjs` after 2E; stands after I16 |

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
- `census-upstream.mjs` is a live-registry station: it reads the repo's PRs/issues/comments/reviews
  (GraphQL, bot text excluded) and `git log <ref>` for citations of other projects' issues/PRs and
  the Firefox/WebKit bugzillas, then resolves each upstream; pass the cabinet's ref string. Expect
  states, stars and downloads to move between refreshes at a fixed sha, and Discussions
  (turborepo) to file as `missing`.
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
- 2026-09-26 — THE NINTH REFRESH, at `origin/main` @ fe44598e (commit 2026-09-25T21:07:00-07:00),
  all 17 plates re-run at the one ref: `ui-router-navigation-location-plugin` 1.0.0, on npm
  2026-09-26 under `latest` with no `rc` tag (was 0.3.2 of 2026-09-13), released through
  1.0.0-rc.0 (#973) and 1.0.0 (#976). The six commits since 38c9fa1c are all the plugin's: the
  service intercepts the navigations it starts (#946), the public surface settled (#965, which moved
  `composeNavigateUrl` out of `index.ts` into `src/compose-navigate-url.ts` and out of the barrel),
  two README passes (#968, #967). NO member born or renamed, no core file changed — the new-member
  checklist was a no-op a third time, every counting label read true, and the cover's version guard
  (the `lit-ui-router` version under some dist-tag) passed untouched. The general survey reads 819
  tracked paths, 784 classified, 66,533 sloc (was 818 / 783 / 66,257).
  THE LOOP RELOCATED NOTHING: no file under `packages/lit-ui-router/src` changed, so all 30
  evidence lines held. `census-mass3b.mjs` carries the same three DRIFT lines.
  ONE FILE BROKE FOUR SENTENCES AND NO GATE. The plugin went from one src file to two, and every
  claim that had leaned on "one" went false silently: sheet 7's PLACED note for №4 was the hand
  string "one 105-line file, seven spec files"; sheet 7's annex paragraph interpolated the sloc but
  typed "is one … -line file"; sheet 13's callout interpolated the BLOCK's touch total into "one
  January wall, chiselled N times" (it would have printed 14 for a wall touched 13); and sheet 13's
  "the highest churn intensity on the map" / "the highest per-file churn anywhere" were typed
  superlatives — at this ref the block averages ×7.0/f, sixth on the map behind `docs`' ×10.1.
  Sheet 7's note is now the plugin's role plus its derived annex ratio, like its neighbours', and
  the paragraph derives count and plural; sheet 13 names the plugin's walls off the weather rows
  (month, touches, the younger wall beside it), derives the block's rank, and asserts the "smallest
  package" claim the notes keep, throwing if the plate says otherwise. The audit read 0 escapes and
  0 hits above 1 px before and after; 7B's 0.6 px piece is unchanged.
  THE NUMBERS: city 279 src files / 22,360 sloc and 145 spec / 23,874 (was 278 / 22,321 and
  145 / 23,672), the plugin 2 / 141 under 7 / 612, annex 3.9× → 4.3× — which also widens 7A's
  derived annex range to 1.5–4.3×; doors 166,649 min / 59,435 gz (was 166,259 / 59,307), only the
  plugin's `.` door moving, 1,309 / 670 → 1,699 / 798; bricks — the plugin 2 files / 141 sloc,
  still a 1×1 of one course; couplings unmoved at 9 nodes / 22 contracts; the bundle 122,101 gz in
  17 chunks, `router plugins` 4 → 5 modules; the deploy 860 files / 4,839,949 gz; nm 179,288 lines /
  41,637 d.ts; mass3b 11,718 task-file hashes over the same 225 real tasks; turbo, mise and the ci
  graph unmoved (716 / 1,897 / 225); steam 552 commits; weather 424 dated files; 7A 10,363 of 17,496
  metered sloc lit, the plugin 2 of 2 files at 100% on all three meters; 7B's plugin rust R2 → 0.
- 2026-09-28 — THE TENTH REFRESH, at `origin/main` @ 9b1b1bf3 (commit 2026-09-28), all 17 plates
  re-run at the one ref: `lit-ui-router` 1.16.0, on npm 2026-09-28 under `latest` (#1005) with
  `rc` left at 1.16.0-rc.3 behind it, and the ref two commits past the release (#974 bumps the
  examples, #1006 peers ssr on `^1.16.0`). Since fe44598e main also cut 1.16.0-rc.2 and rc.3,
  ssr 0.1.0-rc.3, effect 0.1.2 and 0.1.3 and the plugin 1.0.1; `<ui-view>` adopts a late
  provider's router in `willUpdate` (#990); effect reads the scoped router and the peer catalogs
  split per package (#994); the release tool packs in place with a `beforePacking` hook (#995);
  the eslint plugin proves its 9.0.0 floor in its own lane (#1002). NO member born or renamed —
  38 members, seven published. The general survey reads 820 tracked paths, 785 classified,
  67,260 sloc (was 819 / 784 / 66,533). The cover's version guard passes on `latest`, so LATEST
  SHIPPED reads `1.16.0 · 2026-09-28` and prints no `main at` clause.
  THE LOOP THREW AND RELOCATED SIX LINES. #990 put twelve lines into `ui-view.ts` above
  `render()`; the six of its 52 cited lines below them moved by that uniform +12 (670 → 682,
  678 → 690, 682 → 694, 684 → 696, 689 → 701 twice), the other 46 held. `census-mass3b.mjs` printed a
  fourth DRIFT line for the new `eslint-plugin-lit-ui-router#test:peer-floor`, and CITES now
  files `peer-floor-guard.ts` for it; the three `check:dev-split` lines remain. `census-yard.mjs`
  follows #995's rename: the pack rule names `pack-publish` and `strip-manifest` where it named
  `pack-staged`.
  FIVE SENTENCES WENT FALSE, ONE OF THEM BEFORE THIS REFRESH. Sheet 4's rc paragraph and sheet
  11's ssr paragraph both typed "and so does the flagship" — false once 1.16.0 took `latest`;
  both now read the registry plate (sheet 4 collects the rows it quotes under `rc`, sheet 11
  reads `census-npm.json` and throws if ssr stops leading with one). Sheet 3B's "the
  eslint-plugin quarter is flat throughout … all but its two `oxc-emit` build lanes" went false
  with the new cite; it now names the quarter's lanes above one line off the plate. Sheet 7B's
  "Six plants steam at three puffs" was a hand list that carried `docs` at 10 commits (two puffs)
  at the ninth refresh too; it now lists the top band off the plate — five plants — and its
  caption's "1 plants stand clean … carry the deepest rust" picks its verbs. The audit read 0
  escapes and 0 hits above 1 px before and after; on 7B the lint plugin's piece is 0.89 px and
  the typedoc-plugin callout touches a grown block by 0.73 px.
  THE NUMBERS: city 280 src files / 22,476 sloc and 145 spec / 24,213 (was 279 / 22,360 and
  145 / 23,874); yard 248 / 18,126 massed; doors 167,944 min / 59,915 gz (was 166,649 / 59,435),
  the flagship's `.` 8,719 → 8,837 gz; the bundle 122,215 gz in 17 chunks; the deploy 860 files /
  4,853,751 gz; nm 179,302 lines / 41,652 d.ts; mass3b 11,770 task-file hashes over 226 real
  tasks and 2,718 command sloc; the ci graph 717 / 226 / 1,920 edges; steam 580 commits; weather
  425 dated files; 7A 10,382 of 17,529 metered sloc lit.
- 2026-09-29 — THE ELEVENTH REFRESH, at `origin/main` @ 63c0b823 (commit 2026-09-28 PDT), all 17
  plates re-run at the one ref: `lit-ui-router-ssr` 0.1.0, on npm 2026-09-29 under `latest`
  (#1026) with its `rc` tag gone, and the flagship's `rc` tag gone too, so every published package
  is served under `latest` alone. Since 9b1b1bf3 main cut ssr 0.1.0-rc.4 and 0.1.0, added
  `settle()` (#1010) and a hydration outcome value (#1020) to ssr, declared ssr's
  `@oxc-project/runtime` dependency (#1024), added the weekly `dependency-audit` workflow (#1015)
  and a `check:dedupe` lint lane (#1016). NO member born or renamed — 38 members, seven published.
  The general survey reads 823 tracked paths, 788 classified, 68,351 sloc (was 820 / 785 /
  67,260). basis.mjs installed with the worktree's pnpm 12.3.4, which warns that it ignores the
  ref's new `autoDedupe` and `trustPolicyExcludePrune`; the frozen install succeeded.
  THE LOOP HELD: no commit touched `packages/lit-ui-router/src`, and all 52 cites read true.
  `census-mass3b.mjs` printed a DRIFT line for `check:dedupe` (`pnpm` unrecognised); `pnpm`
  joins EXTERNAL, and the three `check:dev-split` lines remain.
  THREE GUARDS THREW, AS DESIGNED. Sheet 11's rc guard (ssr no longer leads with an `rc`): the
  paragraph now says npm serves ssr under `latest` at the version the ref carries, and throws if
  either half stops holding. Sheet 2's massing guard (ssr quantized to a 2×4): the note names three
  2×4s. Sheet 13's `assertPlots` (ssr's annex grew into the plugin's lot): the plugin moves east.
  SIX SENTENCES WENT FALSE OR HAD BEEN FALSE. Sheet 2B's "neither of the two shipped dependencies"
  (three now); sheet 3B's "four of its 8 tasks" in `lint`'s `with` list (five now, a guarded hand
  list); sheet 11's "not much dearer" for ssr's index door at 3,084 gz; sheet 9's "a race close
  enough that … one more demo decide it" with the runner-up 711,550 bytes behind; and sheet 3A's
  and 3's aria-labels, which typed "eleven workflows" (twelve before, thirteen now) and "thirty-seven
  … eight". Each now derives from its plate or throws. Sheet 3A's typed `file:line` cites and its
  `turbo_link_worktree` had drifted before this refresh; they are relocated by content at the ref.
  The audit read 0 escapes and 0 hits above 1 px before; after the plates moved it read one hit
  (sheet 9's SCALE line under the grown html-pages cap, 12.7 px), recomposed to 0; sheet 2's ssr
  brick touched its label stack by 0.67 px and the stack rises 3 px.
  THE NUMBERS: city 281 src files / 22,725 sloc and 146 spec / 24,662; yard 249 / 18,375 massed;
  doors 169,798 min / 60,661 gz, ssr's `.` 2,273 → 3,084 gz; the bundle 122,732 gz in 17 chunks;
  the deploy 884 files / 4,952,920 gz; nm 179,513 lines / 41,639 d.ts; mass3b 11,899 task-file
  hashes over 227 real tasks and 2,828 command sloc; the ci graph 718 / 227 / 1,932 edges; steam
  597 commits; weather 427 dated files; 7A 10,591 of 17,778 metered sloc lit.
- 2026-10-03 — THE TWELFTH REFRESH, at `origin/main` @ 6d41d21e (commit 2026-10-03), all 17
  plates re-run at the one ref: `lit-ui-router-ssr` 0.1.1 (#1037) and 31 commits behind it — turbo's
  `with` sidecars replaced by umbrella tasks (#1038), `check:single-version` (#1036), a root
  `//#lint:complexity` ceiling (#1058), the report-only `@tools/crap` (#1056), the ssr hydration
  signature (#1070). ONE member was born, №39 `@tools/crap` (tools/, private): sheet 7's `PLACED`
  (560,430, report), sheet 13's (the same), 3B's `TERRACE`, 7A's `NOTE` (which now throws on a
  missing row) and `INSTRUMENTS`' `lint & probe fleet` rule — the yard printed `orphans 2` until it
  did. `APPS`, `APP_ORDER`, sheet 9's PLAN and `labels.mjs` took nothing. The general survey reads
  845 tracked paths, 810 classified, 71,286 sloc (was 823 / 788 / 68,351). The T3 chain ran 3 min 54 s
  warm; the loop's 52 cites held.
  A RENAMED TASK IS A REKEY OF EVERY PLATE THAT NAMES IT. #1038 turned `lint`, `typecheck` and
  `format:check` into script-less umbrellas over `lint:oxlint`, `typecheck:tsc` and
  `format:check:oxfmt` in every package, and the eslint plugin's `test` became `test:unit`. Sheet 3B
  threw on `examples#format:check`, sheet 12 on an unplaced fanned name, and 3B again on the new
  `//#lint:complexity` (structure 28). The quiet one was `census-shadow.mjs`: it picks a member's
  suite by script name, so the plugin fell to `n` (no test script) while crap's new meter held the
  metered count at 24, and nothing printed — it now falls back to `test:unit`. `census-mass3b.mjs` printed no DRIFT
  for `check:single-version` because `node` is EXTERNAL; its CITES row was added by hand.
  THE HONESTY SWEEP FOUND CLAIMS THAT HAD BEEN FALSE FOR WEEKS. Sheet 12 and 12i said the longest
  all-real chain was "6 test tasks … serialized by ^test" and listed `test` and `test:coverage` as
  ^self chains — false since #780 put `test` on `^build`; the run is now read off the edge list and
  asserted to be build steps. 7A's examples "never lit" (35 sloc are), 7B's "0 lamps" and docs'
  "second-hottest steam / dimmest metered light", 7B's "cracked flanks stand unworn" once R4 opened,
  7A's "palest light" (oxc-emit is paler), and the "291-line run.ts" (293) on sheets 7 and 3B each now
  derive or throw. Sheet 3A's typed cites relocated by content.
  THE NUMBERS: city 291 src files / 23,832 sloc and 151 spec / 25,850; yard 253 / 19,006 massed;
  doors 174,062 min / 62,120 gz, ssr's `.` 3,084 → 3,384; the bundle 122,792 gz in 17 chunks; the
  deploy 890 files / 4,980,372 gz; nm 173,596 lines / 41,079 d.ts; mass3b 13,064 hashes over 234 real
  tasks and 2,921 command sloc; the ci graph 863 / 234 / 2,985 edges (umbrellas are phantoms: 629 of
  863 run nothing); couplings 23 contracts, 3 optional; steam 619 commits; weather 442 dated files;
  7A 11,343 of 18,590 metered sloc lit over 25 members.
- 2026-10-04 — THE THIRTEENTH REFRESH, at `origin/main` @ 4dc0cbb7 (commit 2026-10-04), all 17
  plates re-run at the one ref: `lit-ui-router` 1.16.1 and 1.16.2, `lit-ui-router-ssr` and
  `lit-ui-router-effect` 0.2.0, `lit-ui-router-mobx` 1.1.0 and `eslint-plugin-lit-ui-router` 1.2.0
  (#1103, #1116–#1120), the placeholder router's upgrade delivered to subscribers (#1082, #1099,
  #1100, #1113) and `check:package-coverage` (#1090). NO member was born, so the hand tables took no
  row. The registry served all five releases under `latest` by the time `census-npm.mjs` was re-run.
  THREE PROBES NEEDED A HAND. `census-loop.mjs` stopped on `ui-view.ts:503`: 31 cites relocated and
  one re-texted. `census-mass3b.mjs` printed DRIFT for `//#lint:actionlint`, whose run became a
  `'''` block that `miseRunLine` could not read, and nothing for `check:package-coverage` (`node` is
  EXTERNAL): the reader takes the block form and the guard its CITES row. `census-shadow.mjs` filed
  the logs tmpdir inside repo-checks' error note; it is stripped to `<logs>`.
  THE FRAME AUDIT FOUND EIGHT HITS AT THE OLD REF and 37 hits and 4 escapes after the re-run: the
  guard house's roof in 3B's title block, sheet 11's flagship door over the viewBox top, brick 1's
  parts icon in sheet 2's heading, and lettering on 3, 7, 7A, 7B and 13. Lots and lettering moved
  with air; the audit reads 0 and 0. A SUPERLATIVE ABOUT A TASK IS NOT ONE ABOUT A BUILDING: 3B's
  spire caption said "the city's tallest" while the guard house, eleven tasks drawn whole, rose past
  it; the caption names the tallest command and the build asserts it.
  THE NUMBERS: city 294 src files / 24,550 sloc and 154 spec / 27,313; yard 254 / 19,521 massed;
  doors 182,451 min / 64,574 gz; the bundle 123,271 gz in 17 chunks; the deploy 890 files / 4,987,887
  gz; nm 173,820 lines / 41,155 d.ts; mass3b 13,307 hashes over 235 real tasks and 3,029 command
  sloc; the ci graph 864 / 235 / 3,024 edges; steam 643 commits; weather 448 dated files; 7A 11,937
  of 19,307 metered sloc lit over 25 members.
- 2026-10-15 — THE TWENTIETH REFRESH, at `origin/main` @ 83225a58 (commit 2026-10-15), all 21
  census plates re-run at the one ref, 76 commits past the nineteenth (108456af) and one
  examples-only commit (#1380) past the 58a36cb6 the brief named: the 2026-10-15 release train,
  `lit-ui-router` 1.16.5, `lit-ui-router-ssr` 0.3.0, `ui-router-server` 0.3.1, `lit-ui-router-mobx`
  1.2.0, `lit-ui-router-effect` 0.4.1, `ui-router-effect` 0.1.2, both signals packages 0.1.1 and the
  plugin 1.1.2, every one under `latest`. The user: "lets get started on that birth". ONE MEMBER
  WAS BORN AND ONE DIED: `ui-router-mobx` 0.1.1, the framework-agnostic MobX store
  `lit-ui-router-mobx` peers, and `tools/warn-lanes` (#1297), so the members hold at 46 and eleven
  are published. The birth took a seat on every plate that draws the family — sheet 2's brick 10 and
  ringed stud K, 2A's block 10, the bench's core-only column, sheet 4's first bay column, sheet
  11's door 26, 2C's `BUILD_WORDS`, №47 on 7, 7A and 13, the twelfth quarter on 3B — and the death
  took №29 off 7, 7A and 13, `@tools/warn-lanes` off 3B's `TERRACE`, its rung off sheet 12's
  `CHAIN` and its rule off the yard.
  NINE GUARDS THREW across 30 modules; HISTORY's cover line names them. Two plates were wrong with
  exit 0: census-doors filed ten `ERROR … run build:js first` rows, because #1276 made
  `tools/bundle-probe` read `dist/`, and census-shipped filed /app-signals (#1267) as
  `unclassified`. Six hand claims had gone false with no guard to say so: sheet 7's "the docs site
  does not serve it" for the signals demo, 7A's "in shadow: the index barrel", 3B's "heaviest
  commands" and its `//#lint:elements` spire, sheet 4's "declares on the flagship alone" and sheet
  2's `memoryLocationPlugin`; each derives or throws.
  MAIN MOVED TWICE around the chain, because another session fetched: to 83225a58 before step 1,
  and to f4701684 (#1381, docs only) between the T3 probes and the peers plate. Every plate files
  83225a58; census-builds caught f4701684 and re-ran pinned to census-files' sha, byte-identical.
  THE NUMBERS: scc 1,095 tracked / 1,050 classified; city 391 src files / 34,231 sloc and 191 spec
  / 32,904; yard 354 / 28,105, 336 / 26,519 massed; doors 26 · 183,301 min / 64,694 gz; the bundle
  125,164 gz in 17 chunks; the deploy 1,018 files / 5,931,315 gz in 13 districts; mass3b 17,022
  hashes over 297 real tasks and 5,561 command sloc; the ci graph 1,108 / 297 / 4,561 edges
  (deepest chain 14); couplings 35 contracts, 23 drawn on 13 nodes, 32 peers; steam 705 commits;
  weather 582 dated files, 2,711 touches; 7A 14,423 of 24,826 metered sloc lit over 31 members; the
  loop 30 evidence lines over 52 cites; consumers 18 in 7 builds (19 in 8 with the atlas app);
  survey-shipped 282 files / 8,870,093 gz at www/atlas @ 506653d9. The app prerenders
  66 pages + 404.html with 60 redirects, the scoped router 67/67 at construction; the frame audit reads escapes 0 · hits>1px 0 · text-on-text 127 over 26 plates (127 at the last full audit too); every card picture re-shot, 33 plates × 2 themes · 4,098,084 bytes; check-scenes 107 checks hold on the regenerated city, plant, bricks and build models.
- 2026-10-13 — THE EIGHTEENTH REFRESH, at `origin/main` @ c1b759a4 (commit 2026-10-13), all 18 plates
  re-run at the one ref: 22 commits past the seventeenth. SIX MEMBERS WERE BORN: `lit-ui-router-signals` and `ui-router-signals` (#1159, #1214, #1215), `ui-router-effect`
  (#1189, #1216), the private `@repo/route-snapshot` (#1185), `sample-app-lit-signals` (#1159,
  #1219) and `@tools/a11y` (#1172). 46 members (was 40), ten published (was seven); npm serves the
  three new packages as 0.1.0-rc.0 under `rc`. `lit-ui-router-effect` 0.3.0 (#1238) and the plugin
  1.1.1 (#1241) rode with them. The loop's 52 cites hold.
  EIGHT MODULES THREW at the first build: sheet 2's family guard, the coupling bench, sheet 11's
  door count, sheet 12's column table, sheet 3B's undrawn tasks, and `assertPlots` on 7, 13 and 9.
  The last three were growth, not births: `@tools/bundle-probe`'s annex met `@tools/lint-elements`
  on 7 and 13, and sheet 9's page chunks met site css. Every birth took a seat but one:
  `ui-router-signals` is scheduled on sheet 2, A BRICK, NOT DRAWN IN THIS REV, and drawn on 2A.
  Typed claims about one member went false at once: "ssr is the one node with a tie to two siblings"
  (2B, sheet 4), "the only companion-to-companion joint" (2A), the plugin as "the smallest quarter"
  (3B) and among the three smallest packages (13); each derives and throws.
  `census-mass3b.mjs` printed 17 DRIFT lines; the cite rows moved and it prints 0. The yard read
  `orphans 4` until `@tools/a11y` joined the lint & probe fleet. The city and plant models outgrew
  their budgets: `city.glb` 233,000 bytes against 200 KiB, raised to 256 KiB; `plant.glb` 427,988
  against 384 KiB, raised to 448 KiB (at the seventeenth they were 201,416 and 376,036).
  THE FRAME AUDIT read 0 escapes, 0 hits over 1 px and text-on-text
  134 across 24 plates; the audit stopped twice on the way: sheet 9's html-pages tower poked 2.2 px above the viewBox (html pages 430,20 → 432,26, page chunks y 178 → 184), and sheet 13's "both winter-built" ran 1.9 px over the examples block (the callout x 1262 → 1266); sheet 3A's ninth mise-calling workflow pushed the `lint-workflows` row through the no-mise list, so `wfRowY` steps by a derived `WF_STEP` (34 at this ref, throws under 30) and door 1 finds `deflake-e2e`'s row by name. Text-on-text rose from 99, 17 of the rise sheet 12's rotated column headers from the two effect3 columns and the rest stacked lines 1.1–2 px apart, and the count was accepted. Thumbs: 30 plates in
  both themes, 3,613,520 bytes. The app prerenders 61 pages plus the 404 with
  52 redirects, 62/62 renders scoped. The T3 chain took 5 min 01 s.
  LESSONS. `assertPlots` REPORTS THE FIRST PAIR ONLY: sheet 7 threw on 18/28, and a plan check over
  every pair found 20/21 and 35/39 overlapping too; after a throw, check every pair before re-running
  the build. A PRIVATE `packages/` MEMBER IS A QUARTER, NOT A PUBLISHED COUNT: `@repo/route-snapshot`
  takes a lot on 7 and 13, a quarter on 3B and a place in sheet 12's block, but every "N published"
  counts `census-files.json`'s `private` flag; the yard's "src (7 published packages)" was a count
  in a key, and the key reads `src — packages/*/src`. A SEATED MODEL DRAWS ONLY JOINTS A BRICK CAN
  MAKE: a 1×2 cannot bridge two caps eight courses apart, so `ui-router-signals` is scheduled on 2
  rather than drawn with one of its joints missing, and 2A, which seats nothing, draws the joint. A
  CITE ROW KEYED TO ONE PACKAGE ROTS WHEN THE TASK SPREADS: the three `check:dev-split` DRIFT lines
  every cabinet since the thirteenth carried were the flagship-only CITES row for a task that runs in
  four packages; in `BY_TASK` they read 0, and so did the lines `check:bundle`'s peer-floor guard and the
  effect3 lanes raised.
  A NUMBER-WORD TABLE IS A HAND COUNT: sheet 7's `WORDN` stopped at 'eight' and would have printed
  `undefined` at ten; word tables throw past their end. THE HARNESS REFUSES SUBAGENT REPORT FILES:
  a placement agent's hand-back arrives as its final message, so the orchestrator files it.
  THE NUMBERS: city 370 src files / 31,823 sloc and 178 spec / 30,843; yard 341 / 27,536, 323 /
  25,950 massed; doors 25 · 191,116 min / 67,963 gz; the bundle 125,137 gz in 17 chunks; the deploy
  910 files / 5,086,283 gz; nm 174,690 lines / 41,419 d.ts; mass3b 15,806 hashes over 285 real tasks
  and 5,333 command sloc; the ci graph 1,103 / 285 / 4,313 edges (deepest chain 15); couplings 31
  contracts, 20 drawn on 12 nodes; steam 615 commits; weather 548 dated files, 2,575 touches; 7A
  13,679 of 22,325 metered sloc lit over 31 members; upstream 85 consignments to 34 works, 14 sent,
  71 watched, 80 tracked; survey-self 107 files / 21,449 sloc and survey-shipped 257 files / 7.1 MB,
  both at www/atlas @ 7abec3a5.
- 2026-10-12 — THE SEVENTEENTH REFRESH, at `origin/main` @ eb72c568 (commit 2026-10-12), all 18 plates
  re-run at the one ref: ten commits past the sixteenth, among them `lit-ui-router` 1.16.4 (#1200)
  with the router directives following the placeholder router's upgrade (#1190), and the
  navigation plugin 1.1.0 (#1201) with `focusReset` defaulting to `'manual'` (#1162) and
  `interceptTraverse` (#1181). NO member was born, no checklist table took a row, and the yard reads
  `orphans 0`; the registry serves both releases under `latest` and no other tag.
  THE LOOP RELOCATED 11 CITES AND RE-TEXTED ONE: #1190 put `subscribeRouter()` and an
  `onRouterReplaced` path into `ui-sref.ts` (+3, +22) and `ui-sref-active.ts` (+11, +35), and the
  perch's onStart tap moved into `watch(router)`, so `this.uiRouter.transitionService.onStart(` reads
  `router.transitionService.onStart(` at 577. THREE GUARDS THREW AND THE AUDIT STOPPED TWICE, all on
  one cause: the plugin grew from 147 to 208 sloc and its annex from 616 to 1,039. Sheet 2's tile
  guard held sloc order and mobx's 205 now sorts under the plugin; sheet 13's "smallest package"
  guard went false the same way; sheet 7's `assertPlots` met the flagship's annex at y 136.6 and
  dropped №3 to y 150. The audit found the plugin's label under its new 1×2 brick on sheet 2, and
  sheet 13's CHURN key over the plugin's annex. That annex had slid under the reading box, beside
  №37's and №2's: A PANEL THAT HIDES A BLOCK IS AN OVERLAP NO GUARD SEES, because `assertPlots`
  holds blocks against blocks, never against the box. The box moves to 722,262, clear of every annex.
  THREE TYPED SENTENCES WENT FALSE AND NOW DERIVE: 2A's "(1×1 and 1×2)" smallest companions (SCALE
  line and notes), sheet 2's aria "one-by-one one course", and 7A's "all three meters read 100" (the
  plugin's branches read 98.1%). STEAM WENT DOWN WHILE THE CITY GREW: the window ends at the ref's
  commit date, so it slid to 2026-07-14..2026-10-12 and reads 594 commits (was 597).
  THE FRAME AUDIT read 0 escapes, 0 hits over 1 px and text-on-text 99 across 24 plates, the record.
  Thumbs: all 30 plates in both themes, 3,519,934 bytes. The app prerenders 61 pages plus the 404
  with 52 redirects, 62/62 renders scoped; the 84 scene checks hold. The T3 chain took 4 min 11 s.
  THE NUMBERS: city 338 src files / 29,173 sloc and 162 spec / 29,019; yard 298 / 24,160 massed;
  doors 186,158 min / 65,724 gz; the bundle 125,137 gz in 17 chunks; the deploy 898 files /
  5,028,259 gz; nm 174,690 lines / 41,419 d.ts; mass3b 14,023 hashes over 237 real tasks and 3,033
  command sloc; the ci graph 885 / 237 / 3,208 edges (deepest chain 15); couplings 23 contracts, 3
  optional; steam 594 commits; weather 500 dated files, 2,451 touches; 7A 12,648 of 20,178 metered
  sloc lit over 26 members; upstream 81 consignments to 33 works, 14 sent, 67 watched, 76 tracked;
  survey-self 107 files / 21,444 sloc at www/atlas @ d0252420; survey-shipped 257 files / 7.3 MB.
- 2026-10-11 — THE SIXTEENTH REFRESH, at `origin/main` @ bd10638a (commit 2026-10-10), all 18 plates
  re-run at the one ref: one commit past the fifteenth, #1196, which blends the docs site's hero
  logo in every browser — 2 files, `www/lit-ui-router.dev/.vitepress/theme/custom.css` and
  `index.ts`. NO member was born, no checklist table took a row, and the yard reads `orphans 0`. The
  registry is unmoved under `latest` and no other tag; `census-npm.mjs` filed 0 leaf changes. NO
  PROBE NEEDED A HAND, and no guard threw: the loop's 52 cites hold, 0 moved; `census-mass3b.mjs`
  printed its same three `check:dev-split` DRIFT lines, `census-shipped.mjs` no unclassified file,
  and `census-shadow.mjs` its same two FAIL lines. TEN PLATES RE-FILED WITHOUT A FIGURE MOVING —
  bricks, bundle, couplings, doors, handoff, loop, mass3b, nm, plate and yard. WHAT MOVED: the docs
  member, city 29,023 sloc (was 29,029) and docs 751 (was 757), 7A's extent 12,509 of 20,039; steam
  597 (was 596), the first count on the midnight-anchored window, and `git rev-list` from
  2026-07-12T00:00Z agrees at both refs; weather 2,434 touches; shipped 32,024,161 raw / 5,019,989
  gz; survey-self at www/atlas @ ea081707, 268 tracked, 100 files / 20,405 sloc, so A3 reads 70%
  (was 69%). THE UPSTREAM PLATE TOOK THE BROWSER BUGS: 81 consignments to 33 works (was 59 to 30),
  21 of them Bugzilla reports, 14 sent, 67 watched, 76 tracked; the north bank fills its fourth and
  last row. WEBKIT HIDES ITS REPORTERS' ADDRESSES: its REST answers an anonymous read with the
  address's local part, so `census-upstream.mjs` matches a bare login against the committers' local
  parts, and WebKit #327109, filed by the home repo's owner, reads sent beside the two Firefox
  reports filed the same day. THE FRAME AUDIT read 0 escapes and 0 hits over 1 px, text-on-text 82
  across 23 plates, sheet 14 included at 0 / 0 / 0, per plate identical to the fifteenth. Thumbs:
  all 29 plates in both themes, 3,694,918 bytes. The app prerenders 33 pages plus the 404 with 26
  redirects, 34/34 renders scoped; the 84 scene checks hold. The T3 chain took 4 min 03 s. THE
  NUMBERS: city 338 src files / 29,023 sloc and 162 spec / 28,535; yard 298 / 24,010 massed; doors
  182,512 min / 65,108 gz; the bundle 124,625 gz in 17 chunks; the deploy 898 files / 5,019,989 gz;
  nm 174,501 lines / 41,359 d.ts; mass3b 14,023 hashes over 237 real tasks and 3,033 command sloc;
  the ci graph 885 / 237 / 3,208 edges (deepest chain 15); couplings 23 contracts, 3 optional; steam
  597 commits; weather 500 dated files; 7A 12,509 of 20,039 metered sloc lit over 26 members;
  upstream 81 consignments to 33 works, 14 sent, 67 watched, 76 tracked.
- 2026-10-10 — THE FIFTEENTH REFRESH, at `origin/main` @ 76ccefc0 (commit 2026-10-10), all 18 plates
  re-run at the one ref: one commit past the fourteenth, #1184, which bumped the examples to
  `lit-ui-router` ^1.16.3 and the adapter and plugin patches — 14 files, all
  `examples/*/package{,-lock}.json`. SHEET 14'S PLATE JOINED THE CABINET: `census-upstream.json` is
  filed at the same ref as the other seventeen, and the survey office reads 18 probes, 18 plates, 22
  drawings (A2i 75 nodes, 108 edges). NO member was born, no checklist table took a row, and the
  yard reads `orphans 0`. The registry is unmoved under `latest` and no other tag; `census-npm.mjs`
  filed 0 leaf changes.
  NO PROBE NEEDED A HAND, and no guard threw on the cabinet's data: the loop's 52 cites hold, 0
  moved; `census-mass3b.mjs` printed its same three `check:dev-split` DRIFT lines,
  `census-shipped.mjs` no unclassified file, and `census-shadow.mjs` its same two FAIL lines.
  FOURTEEN PLATES RE-FILED WITHOUT A FIGURE MOVING — bricks, bundle, city, couplings, doors, files,
  handoff, loop, mass3b, nm, plate, shadow, steam and yard — only `generatedAtTime`, `used` and
  `commitDate` changed on them. WHAT MOVED: shipped, on the examples' manifests, 32,024,314 raw /
  5,019,761 gz (was 32,023,943 / 5,019,566), the examples district 1,073,849 gz (was 1,073,654) and
  its lead chunk `model-viewer-COI-aTNF.js` at 281,842 gz (was `model-viewer-C8EVMy8l.js`, 281,843),
  so sheet 9 reads 1049 KB and 744,065 bytes behind the html pages (was 1048, 744,260); weather's
  `today` 12:45:38 (was 12:32:14) with no dated file moved; and survey-self, outside the cabinet at
  www/atlas @ 7d98dbdc (was ce84fc22), 267 tracked (was 255), the survey office 24 / 2,447, the
  drawing office 53 / 13,063, the routed site 4,277 sloc and two off-ruler brand SVGs, so A3 reads
  2.8× (was 2.7×) and 69% (was 67%). STEAM'S 586 HOLDS BY THE WINDOW'S EDGE: a3fc4919 (2026-07-12
  13:08 PDT) left the window as 76ccefc0 entered it, while `git rev-list` from midnight reads 585 →
  586; the trap is filed with the fourteenth's.
  THE FRAME AUDIT read 0 escapes and 0 hits over 1 px, text-on-text 82 across 22 plates, and 0 / 0 /
  0 on sheet 14. Thumbs: all 28 plates in both themes, 3,571,494 bytes. The app prerenders 33 pages
  plus the 404 with 26 redirects, 34/34 renders scoped; the 84 scene checks hold. The chain took 4
  min 05 s with the pnpm store warm.
  THE NUMBERS: city 338 src files / 29,029 sloc and 162 spec / 28,535; yard 298 / 24,010 massed;
  doors 182,512 min / 65,108 gz; the bundle 124,625 gz in 17 chunks; the deploy 898 files /
  5,019,761 gz; nm 174,501 lines / 41,359 d.ts; mass3b 14,023 hashes over 237 real tasks and 3,033
  command sloc; the ci graph 885 / 237 / 3,208 edges (deepest chain 15); couplings 23 contracts, 3
  optional; steam 586 commits; weather 500 dated files; 7A 12,509 of 20,045 metered sloc lit over 26
  members; upstream 59 consignments to 30 works, 11 sent, 48 watched, 55 tracked.
- 2026-10-10 — THE FOURTEENTH REFRESH, at `origin/main` @ 9e656ab3 (commit 2026-10-10), all 17
  plates re-run at the one ref: the 2026-10-10 release train — `lit-ui-router` 1.16.3,
  `lit-ui-router-ssr` and `lit-ui-router-effect` 0.2.1, `lit-ui-router-mobx` 1.1.1,
  `ui-router-navigation-location-plugin` 1.0.2, `eslint-plugin-lit-ui-router` 1.2.1 and
  `ui-router-server` 0.2.2 (#1183) — and the anti-slop sweep (#1143 vendored the rules, #1144
  touched 370 files). The chain ran first at 9fc06ab9 and again whole at 9e656ab3; between the
  passes only `ui-router-server` 0.2.1 → 0.2.2, one steam window commit and weather's `today` moved.
  The registry serves all seven releases under `latest` and no other tag.
  ONE MEMBER WAS BORN, №40 `@tools/oxlint-anti-slop` (tools/, private, only `typecheck:tsc`, tier
  `report` like `@tools/eslint`): sheet 7's `PLACED` (0, 540, the yard's south-west corner in front
  of the release tower's lower flank), sheet 13's (520, 575, with `TLY` 1148 → 1262), 3B's
  `TERRACE`, 7A's `NOTE`, its own `INSTRUMENTS` row and sheet 3's structure 20. `APPS`, `APP_ORDER`,
  sheet 9's `PLAN`, `labels.mjs` and sheet 11 took nothing; 7B's rust derives. Filed first under the
  `lint & probe fleet`, it doubled the fleet to 136 units and hid sheet 3's PR gates 9 and 10.
  THREE PROBES NEEDED A HAND. `census-loop.mjs` stopped on `core.ts:268`: the sweep rewrote
  `ui-view.ts`, 47 cite occurrences relocated by content, two ambiguous ones were chosen by meaning,
  three re-texted where the resolvables chain in `render()` was rewritten, and two legs widened to
  span 3. `census-shadow.mjs` passed each `node --test` script's own
  `--test-reporter=@tools/shared/test-reporter.ts` through to node, which threw on the unmatched
  destinations, and about 16 members fell from `m` to `u`; the probe drops the script's reporter
  tokens, since it supplies its own. `census-yard.mjs` printed `orphans 35` for the new member; it
  is its own instrument, `anti-slop — vendored oxlint rules`, and the yard reads `orphans 0`.
  `census-mass3b.mjs` printed the same three `check:dev-split` DRIFT lines as before, and
  `census-shipped.mjs` no unclassified file.
  GUARDS THREW ON SHEETS 3, 7, 7B, 12, 13 AND A3, IN `city-glb` AND IN `check-scenes`. `assertPlots`
  on 3, 7 and 13: the yards recomposed around the new member and the grown annexes. 7B's ladder
  found four distinct idle readings where it asked for six; it pads the steps it cannot cut and
  prints "R3 —". Sheet 12's hand-traced chain read 14 against the plate's 15 and was retraced from
  the plate's graph. A3's main row reached 1,576 against 1,520; the gap between districts derives to
  fit. `plant.glb` measured 374,700 bytes against its 350 KiB budget, raised to 384 KiB; the
  `/plant` probe's pixel landed on an antialiased crown edge, and `probePixel` reads mid-run of the
  material's rows within ±8 px.
  THE HONESTY SWEEP DERIVED WHAT WAS TYPED: sheet 3's heaviest-mass ranking and its sample-apps
  label ("the heaviest", false at the thirteenth); sheet 7's broadest-block runner-up,
  sample-app-shared's "outbuilt" label and road G's "one faint road stands for eight" (20
  dependents, 14 instruments); 7B's typedoc split and its "3, 9 and 16 are all occupied"; sheet 13's
  "clean gap 4.65–6.0" and "per-file median is 2" (the median is 4), its "three example slabs" (one
  slab, two files), the sealed `helloworld/main.ts` label and "idle 1 days"; and 7A's NOTEs 18, 23,
  33 and 34. Sheet 3A's root `turbo.json` cites shifted +5 across six ranges.
  THE FRAME AUDIT read 0 escapes and 0 hits at the old ref, 2 and 29 after the first build at the
  new data, and 0 and 0 after the moves; text-on-text holds at 82. Thumbs: all 28 plates in both
  themes, 3,560,010 bytes.
  THE NUMBERS: city 338 src files / 29,029 sloc and 162 spec / 28,535; yard 298 / 24,010 massed;
  doors 182,512 min / 65,108 gz; the bundle 124,625 gz in 17 chunks; the deploy 898 files /
  5,019,566 gz; nm 174,501 lines / 41,359 d.ts; mass3b 14,023 hashes over 237 real tasks and 3,033
  command sloc; the ci graph 885 / 237 / 3,208 edges (deepest chain 15); couplings 23 contracts, 3
  optional; steam 586 commits; weather 500 dated files; 7A 12,509 of 20,045 metered sloc lit over 26
  members.
- 2026-10-10 — SHEET 14, THE UPSTREAM WORKS, at origin/main @ 76ccefc0: the city among the commons
  it builds on, a plan map, `S('map', 'plan', 'static')`, band CITY × COMMONS. Re-scoped before it
  shipped from one author's filings to what the city's own record cites (the user: "i'd rather follow
  our repo's issues etc than me"). THE PROBE is `census-upstream.mjs`, filing `census-upstream.json`:
  `window` (`since` the first commit on `main`, `until` the ref's commit date), `yards[]` (`id`,
  `host` github or bugzilla, `name`, `stars`, `package`, `weeklyDownloads`, `engine`),
  `consignments[]` (`yard`, `kind` pr/issue/bug, `number`, `title`, `state`
  merged/fixed/closed/open/missing, `createdAt`, `author.login`, `sent`, `inWindow`, `tracked`,
  `returns[]` of `kind`, `ref`, `title`, `date`, `state` and, on pr/issue, `external`). THE
  DRAWING: a river of time west to east; yards on the north bank in order of first consignment,
  footprint on log₁₀ stars, rows added until the bank holds them, no pier through a nearer row's
  footprint, lettering on paper placards; the Bugzillas as dashed berths in the nearest row,
  lettered `N reports filed`; a crate per consignment at its filing day, kind as glyph, state as
  fill, an accent pennant when sent, a red tag when tracked (a home item labelled `external` cites
  it); off-window items in the river's west mouth; missing items drawn nowhere and scheduled under
  their own heading; a road to each wharf block, release PRs as narrow posts, squash commits folded
  into their PR. THE GUARDS: unknown kind, state or host throws; `sent`/`inWindow`/`tracked` must
  be booleans and `tracked` must agree with its returns' `external`; window membership is checked
  both ways; yards (and their lettering), crates and wharf blocks go through `assertPlots`; the
  berths' engine note throws when no package's `ci:main` runs a real `test:engines`. Every count,
  plural and "most" derives. THE WIRING: `build.mjs`, `emit-app.mjs` `MODULE`, `labels.mjs`,
  `thumbs.mjs` `TUNING`, `manifest.ts` `BANDS`, `chrome.mjs` `TOTAL` 14 (asserted against the
  highest sheet; "thirteen altitudes" now derives), `routes.ts` `SHEET_ALIASES` loses `'14'` → A2,
  so HISTORY.md's survey-office heading reads `Sheet A2`. A NEW PLATE'S FIRST CARD PICTURE IS A
  BOOTSTRAP: `thumbs.mjs --only` reads the manifest, which `build.mjs` refuses to write without the
  picture; seed `<id>.webp` from a sibling, build, then shoot. THE NUMBERS: 59 consignments to 30
  works, 11 sent and 48 watched, 55 tracked, 59 returned home, 18 off the river (3 missing); 87
  wharf blocks for 83 home items; the app prerenders 33 pages, 34/34 renders scoped; 84 scene
  checks; frame audit 0 / 0 / 0 on the plate; 29 plates carry card pictures.
- A SUITE PICKED BY SCRIPT NAME IS A HAND TABLE. A probe that keys on `test`, `lint` or `build` reads
  the repo's naming, not its behaviour; when a name becomes an umbrella the probe goes quiet rather than
  wrong-loud. Diff each T3 plate's categories (`m`/`n`/`u`), not only its totals.
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
- "ONE" AND "THE HIGHEST" ARE HAND COUNTS TOO. A typed "one" beside an interpolated number, or a
  block total interpolated into a one-file sentence, reads true only while the member has one file;
  a typed superlative reads true only while nothing overtakes it. Derive the count and its plural,
  name the file by path, compute the rank — or assert the superlative and let the build throw.
- `orphans 0` PROVES COVERAGE, NOT PLACEMENT. The yard's rules are first-match-wins, so a renamed
  file that a named rule no longer matches falls through to the next, broader rule and stays
  counted: #995's `pack-publish.ts` — `packPublishTarball` itself — landed in `publish —
  release-it` while `pack — packPublishTarball` shrank, and the orphan line read 0. After a
  rename in a probe's pool, diff the per-instrument rows, not just the orphan count. A cite is
  the same kind of judgement: filing the one a DRIFT line asks for can make a sentence about its
  quarter false, so re-read the prose after every judgement-table change.
- A CITE NO PROBE CHECKS IS A GUESS. `census-loop.mjs` throws when a cited line moves, so its 52
  cites stay true; sheet 3A's `config.toml:139-143`-style cites are typed into the generator and
  nothing reads them back, so they had drifted by several lines — one pointed at `lint_markdown`
  while claiming `lint_workflows` — without any refresh noticing. After a refresh, diff every
  typed `file:line` against the ref's file (`git show <ref>:<path>`), not just the ones a probe
  owns; the same goes for hand lists a plate cannot see, like `lint`'s `with` list on sheet 3B.
- A PROBE THAT RE-RUNS A SCRIPT INHERITS ITS FLAGS. `census-shadow.mjs` splices its own coverage
  reporters into each member's `node --test` command, and the day every script on main named its own
  `--test-reporter`, node refused the unmatched destinations and about 16 members fell to `u` with
  no error on the sheet. A probe that wraps a repo command owns the flags it adds: drop the script's
  copies of them, then diff the categories.
- A BUDGET RAISED IS A DESIGN CONSTANT CHANGED. `city-glb.mjs`'s 350 KiB plant budget threw at
  374,700 bytes; lifting it to 384 KiB is a decision about what the model may weigh, not a fix, so
  it lands in the record with the measured size beside it.
- A PIXEL PROBE READS MID-RUN, NEVER AT A POINT. A sampled pixel on an antialiased edge blends two
  materials and fails a colour check that is right; `check-scenes.mjs`'s `probePixel` walks the
  material's rows within ±8 px and reads the middle.
- A LADDER THAT CANNOT CUT PADS ITS STEPS. A guard that demands six distinct readings before it cuts
  five steps is a hand constant on the distribution's shape; when a sweep flattens the readings,
  keep the steps, stand the uncut ones empty and print them empty ("R3 —").
- A THRESHOLD PRINTED AS A MEASUREMENT IS A HAND COUNT. Sheet 13 interpolated its COLD constant
  where the notes claimed "the per-file median is 2" and typed "a clean gap between 4.65 and 6.0";
  at 9e656ab3 the median is 4 and the gap is gone. Call an editorial cut a cut, and print the
  statistic beside it from the plate.
- A NEW MEMBER WITH ITS OWN MASS IS ITS OWN INSTRUMENT. Filing `@tools/oxlint-anti-slop` under the
  `lint & probe fleet` doubled the fleet to 136 units and hid sheet 3's PR gates 9 and 10, while
  `orphans 0` read true throughout. Before widening a broad rule, ask whether the member is a new
  structure, and look at the plate it stands on.
- A DATE-ONLY SINCE IS A WALL-CLOCK WINDOW. git reads a bare date ("2026-07-12") at the current
  time of day, so a probe that passes one to `git log` has a lower edge that moves with the hour it
  runs and the host's zone. Between the fourteenth and the fifteenth a3fc4919 (2026-07-12 13:08 PDT)
  dropped out of `census-steam.mjs`'s window as 76ccefc0 came in, and the count read 586 both times.
  The probe passes the edge as an instant, `<date>T00:00:00Z`, UTC midnight of the date 90 days
  before the ref's commit, and the same ref counts the same on any machine at any hour: 596.
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
- A PROBE FILED UNDER `--ref origin/main` SPLITS THE CABINET WHEN ANOTHER SESSION FETCHES. The
  no-re-fetch rule above binds only the session running the chain; at the twentieth a peer
  session's fetch moved `origin/main` to f4701684 mid-chain and census-builds measured it. Pin every
  probe after census-scc to the cabinet's own sha: run without `--ref`, the probe materializes
  `CABINET.sha` from `loadCensus()` and files `CABINET.ref`, the census-shadow pattern that
  census-doors, census-shipped, census-builds and census-consumers follow.
- AN EXIT 0 IS NOT A PLATE. `tools/bundle-probe` reads each package's `dist/` exports (#1276), and
  an archive holds no `dist/`, so census-doors filed ten `ERROR … run build:js first` rows and
  exited 0. It runs `turbo run build:js --filter <each public member>` in the archive before
  bundling, the edge the repo's own `check:bundle` has. Read a T3 plate's rows for ERROR before
  reading its exit code.
- `npm install a b -D c` MOVES EVERY NAMED PACKAGE TO devDependencies. The flag applies to the
  whole command, not to the name after it; install runtime and dev packages in two commands.
- THE SHELL'S CWD DRIFTS BETWEEN CALLS. An agent's working directory is the one the last call
  left, so a relative `--prefix` (or any relative path) lands somewhere else; pass absolute paths.
- A BORN MEMBER TAKES A ROW IN THE SHADOW AND NOTE TABLES TOO. 7A's `NOTE` table keys by member
  number, and the born member's shadow row can move a sibling's light: №47 took
  `barrelOnly(47, 'the store')`, and `lit-ui-router-mobx`'s `router-store.ts` re-export of the
  born store stood in shadow beside its barrel, which made NOTE 3's typed "in shadow: the index
  barrel" false. NOTE 3 is guarded against the plate's shadow list; add 7A's `NOTE` to the
  checklist above.
- A4'S ROLE ROW HAS 7 PX OF SLACK AT SIX BLOCKS. The row closes to 1520 with the lettering floor
  `SLOT_MIN` at 140; at 150 six blocks needed 1,527 px. A seventh role block, or a longer role
  name, overflows it and the row guard throws; recompose the row rather than lowering the floor.
- A SHEET'S READS ARE FOUND BY THEIR LITERAL URL. `census-atlas.mjs` lists a drawing's plates from
  each `new URL('../data/census-….json'` written out in its module; a `read(f)` helper that builds
  the path from a template hides the read, and appendix A2 files the plate as awaiting a drawing.
  Sheet 2E reads `census-consumers.json` that way and A2 says so; sheet 2F writes each URL whole.

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
  (`altitude-atlas`, production branch `www/atlas`, direct upload). Refresh
  cycle from `www/atlas.lit-ui-router.dev/`: `node generator/build.mjs .` → `npm --prefix app run build` →
  `node generator/stage-site.mjs` → `wrangler pages deploy dist --project-name
  altitude-atlas`. The atlas is promoted into `www/` as an example that became a site, and it
  merges to main as one squash PR. After that it is ordinary PR work like every other tree here.
- The routed app owns `/`; the flat set is staged under `/set/`. ONE base constant,
  `app/src/routes.ts` (MOUNT/BASE/SET + the `href` table), is imported by vite's `base`,
  `<base href>`, `emit-app.mjs` and `stage-site.mjs`.
- Pages 308s `/sheet/2A` onto `/sheet/2A/`, which core's default strictMode rejects —
  `strictMode(false)` in `router.ts` and `config: { strict: false }` on the server mount are
  load-bearing, or every deep link boots into notFound. The Navigation API plugin intercepts
  its own navigations; the app's `intercept` option keeps the reader's scroll across an index
  filter change (ask 9).
- No router hook says "the view re-rendered": release view transitions and any post-nav DOM
  read off lit's `updateComplete` (`app/src/experimental/view-rendered.ts`), never off rAF
  counting.
- `manifest.sheets` is what walks the set in ascent order; `extras` (the city, the specimen)
  and `appendix` (A1) exist so a page can join the rail, the cover and the server mount
  without entering the ←/→ walk or the sheet numbering.
- The artifact build (`npm run build:artifact` in `app/`) is the condensed atlas as ONE file:
  the gallery and the colophon, every plate a link out to the live site. Vite mode `artifact` +
  vite-plugin-singlefile; `app/artifact.ts` strips the host-supplied doctype/html/head/body,
  hoists `<title>` to byte 0 (only the first 8KB is scanned) and bakes the manifest and the
  card pictures into a JSON island. Nothing is fetched at runtime, the router takes
  `hashLocationPlugin`, and `app/src/mode.ts` is the one flag.
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
