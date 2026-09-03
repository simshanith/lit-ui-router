# Census pipeline rework — notes & initiatives

Status: DESIGNED 2026-09-02; I1 LANDED 2026-09-02 (basis.mjs + census-scc.mjs
master snapshot + overview as query, behavior-identical at main @ 35c6766).
I2 LANDED 2026-09-02: members discovered from the archive's workspace files
(31 found — the frozen lists' 30 + eslint-plugin-lit-ui-router);
city/yard/bricks are queries over the master snapshot writing their own
diagrams/data/*.json plates; bricks fetches @uirouter/core's version-pinned
SOURCE tarball from codeload (the npm tarball ships only lib/) — measured
identical to the old scratch clone (80f/5,272 sloc @ 6.1.2).
I3 LANDED 2026-09-02: shared historyLog() + shared CITY UNIVERSE
(census-query.mjs — sheets 7/7B/13 reconcile by construction);
steam's 90-day window and weather's TODAY derive from the ref's commit
date — the hard-coded dates are gone.
I4 wave 1 LANDED 2026-09-02 (opus fan-out): sheets 2/3/7 import their
plates — numbers by lookup (missing rows THROW), provenance lines rendered
from plate fields, fifth package drawn as city №31 / yard's renamed
"5 published packages" slab / brick schedule row 5 (NOT DRAWN — no stud).
I4 wave 2 LANDED 2026-09-02 (opus fan-out): sheet 7B derives layout from
sheet 7's exported PLACED × city+steam plates (geometry can't drift);
sheet 13 reads weather+city plates (footprints reconcile with sheet 7 by
construction; timeline "ALL COMMITS" honestly became "ALL DISTRICTS" —
the plate carries touches, not commits); the cover survey (in build.mjs,
not sheet1.mjs) rolls up census-files.json — identical numbers, live
citation. I4 COMPLETE for every sheet with a plate behind it.
I5 wave 1 LANDED 2026-09-02: installDeps() T3 harness (archive → corepack
pnpm --frozen-lockfile → the tree's own .bin/turbo, direct); census-plate
and census-mass3b run ref-pinned and write plates (ci now 590 nodes/176
real at 35c6766; drift check caught + resolved 3 uncited tasks incl. the
fifth package's lint:docs); generator/mass-3b.json + real-tasks-3b.json
retired in favor of data/census-mass3b.json.
I5 wave 3 LANDED 2026-09-02: sheet 4 on the npm plate (angular 22.0.0,
rx's "~2020" corrected to 2021-11-30); bundle probes RECONSTRUCTED —
census-doors (9/15 doors byte-identical to the 2026-08-17 constants),
census-bundle (wire bytes within 0.3%, visualizer estGz exact),
census-shipped (3 districts byte-exact; the old single ORPHAN was a probe
artifact — backtick asset URLs are reachable). EVERY probe is now
scripted and ref-pinned.
I5 wave 4 LANDED 2026-09-03 — I5 COMPLETE (opus fan-out): sheets 9 (rev E),
10 (rev C) and 11 (rev C) import census-{shipped,bundle,doors}.json.
Sheet 9's orphan ghost is struck (0 orphans; the district schedule, top
tenants and basis line all render from the plate; vanilla carries
visualizer.esm by first-claim at 18f/122,127 gz). Sheet 10's byte-exact
reconciliation was replaced by an honest one: vanilla 122,127 = bundle
120,098 + 2,029 residual, the api-viewer custom-elements manifest — the
one emitted asset a generateBundle census cannot see; labels are the
plate's own group names and ×N is a real module count. Sheet 11 gained
the 16th door (eslint-plugin, 1,917 gz — the only door no browser opens)
with the bottom row recomposed for air. CORRECTION: 11 of 15 old doors
were byte-identical to the plate, not the 9 claimed in 9e25592's commit
message. EVERY sheet with a plate behind it now reads it; nothing
numeric is hand-pasted except declared editorial (plans, scales, prose
history). Remaining lane: I6–I8 self-portrait.
I6 LANDED 2026-09-03: sheet 14 THE SURVEY OFFICE — the pipeline's
self-portrait as a flow graph (archive → probe stations by tier → plate
cabinet → sheet rack). Every station, drawer, tab and edge is introspected
at build time by generator/census-atlas.mjs: probes = the census-*.mjs that
WRITE a plate (13), tiers = which basis primitive they call (T1 5 / T2 2 /
T3 6), readers = the data-plate URLs each drawing constructs (19 sheet
imports + the cover). Guards THROW on a plate with ≠1 writer, a probe
naming an unfiled plate, a drawing reading one, or the cabinet disagreeing
about the ref — all four verified against a scratch copy. 0 plates unread;
census-files.json is read by 8 stations + the cover. The module also
exports the I7 NODES/EDGES arrays (52 nodes over probe/plate/sheet/tool,
63 edges over writes/reads/imports). TOTAL is now 14 (19 sheet files).
I7 LANDED 2026-09-03: THE SURVEY OFFICE — INTERACTIVE, sheet 14's cytoscape
sibling, embedded in the gallery (S14i in the cover index) rather than linked,
so the Artifact stays one self-contained page. census-atlas.mjs's NODES/EDGES
arrays ship VERBATIM as a JSON island (52/63, asserted against the module at
verify time); every label, tier, basis and edge on screen is that data. Layout
is computed at build time and drawn with cytoscape `preset` — no physics, so
the picture is identical on every load: basis → master station → master plate →
stations banded T1/T2/T3 → cabinet → rack, with each plate pinned to its
writer's row (every «writes» edge is horizontal) and the rack ordered by the
barycentre of the plates each drawing reads, cover leading. cytoscape-dagre is
NOT on cdnjs (404 at every version), so the rank-from-edges preset is the house
pattern here; the only script is cytoscape 3.31.0 from cdnjs, pinned, UMD,
loaded before the inline init. Two judgment calls: the archive basis is drawn
as a node although the census does not contain one — it is derived from the
plates' own shared pin, kept OUT of the embedded arrays, and tied by dotted
edges to the probes whose basis says «archive»; and the two stations that file
no plate stand in an annex off the master station, which halves the picture's
height and lets the whole graph read at fit. The tools ledger (2 instruments +
9 external, with the 22 `imports` edges) is folded away behind a checkbox.
sprites.mjs authors 11 buildings as data: URIs in two palettes, swapped with
the theme along with every colour, which is read from the page's own custom
properties (matchMedia + a data-theme MutationObserver); walls are semi-opaque
over a girding frame per the pinned sprite note, so the themed node body tints
each building and the frame reads through. Hover/tap lights a node's closed
neighbourhood and fills an info panel (kind, tier, basis, writer, readers,
imports) from the edges. Verified in headless Chromium light AND dark: no
console errors, no label collisions, fit zoom 0.68.
I8 base LANDED 2026-09-03: the CSS-perspective tilt — a TILT checkbox beside
TOOLS LEDGER in the I7 control bar lays the interactive plate down on the
drafting table (`perspective: 1600px` on a new `.pg-desk` wrapper,
`rotateX(23deg)` on the stage with `transform-origin: 50% 100%`, so the near
edge is the desk lip and nothing ever grows past the section's width — measured
27px inside it on both sides, at 1440px and at 760px). The known trap is real
and was not designed around: a 3D transform breaks cytoscape's hit test, which
maps clientX/Y through the container's FLAT bounding rect, so tilt is declared a
VIEWING POSE — `pointer-events: none` on the whole desk (not just the canvas, or
the negative-margin overlap swallows the bar's own checkboxes — caught in the
browser, not by reasoning), `userPanningEnabled`/`userZoomingEnabled` off, the
highlight cleared, the hint swapped to «TILT — VIEWING POSE · INPUT PAUSED» and
the info panel saying so. A misaligned hover is therefore impossible rather than
merely unlikely: a 20×20 sweep over the tilted plate lights nothing, and the
same node lights again the moment it is laid flat. Foreshortening would have
opened a ~91px hole between the control bar and the plate's far edge; instead
the pull is MEASURED at init (transition suppressed, class applied, layout
height minus visual bounding height) and published as `--pg-pull`, which a
negative `margin-top` spends — so the far edge meets the bar and the near edge
meets the basis line (gaps 0.2px / 0.0px), and a resize re-measures (91px wide,
109px at 760px where the stage stacks). The transform and the margin transition
together over 420ms only inside `prefers-reduced-motion: no-preference`; under
`reduce` it snaps (verified: duration 0s, transform already applied). Nothing is
persisted — every load is flat. The three.js scene with billboarded sprites and
a camera orbit remains the I8 stretch, unstarted.
I8 REDIRECTED 2026-09-03: the tilt works on the survey-office graph and the user's
verdict was that it "does nothing for me" THERE — what they want is the 3D feel
with isometric snap on the ISOMETRIC CITIES, and that "may need the full 3d
rendering engine". So the full step now targets the city of sheet 7, not the
pipeline graph. The CSS tilt STAYS (harmless, reversible, and the cheap lane is
still the honest first step). Cycle 1 LANDED the same day: sheet7.mjs now exports
its COMPUTED geometry as `CITY` (the geom Map's values — footprint, height, annex
side/height and position per member), so the scene can never re-derive a mass and
drift from the plate; generator/city-scene.mjs emits a new gallery section, THE
CITY — ISOMETRIC, placed after the survey office and indexed on the cover as
S7·3D; three.js 0.169.0 is the only external module, dynamically imported from
cdnjs inside an IntersectionObserver so the gallery pays nothing (~700KB) until
the plate scrolls into view; the camera is orthographic at the true isometric
elevation atan(1/√2) ≈ 35.264°, fitted at init over ALL FOUR diagonals so a snap
can never clip the city. Treatment is the pinned sprite note in three dimensions —
each mass is a semi-opaque tinted box (cap 0.88 / flanks 0.80, depthWrite off)
under a THREE.EdgesGeometry frame in the sheet's ink, so the girding frame of what
stands behind reads through; annexes are dashed frames in a cooler tint (the test
mass stays distinct), tier is COLOUR only, and the `off` tier is drawn frame-only
because there is nothing to mass. The ground is four dashed district plates plus a
faint grid. THE FEATURE is the isometric snap: pointer-drag orbits the azimuth
freely (elevation fixed), and on release it eases 380ms onto the nearest of
45/135/225/315° — instantly under prefers-reduced-motion. Verified headless at
1440×1000 in both themes (swiftshader): 346.13° → 315°, 66.73° → 45°, reduced
motion 6.33° → 45° with no tween; wheel zoom 1 → 1.433 and clamped at 4 / 0.45;
double-click restores 45° / zoom 1; console clean in both themes. The wheel is
deliberately NOT a page-scroll hijack: a plain scroll over the plate scrolls the
page, and the wheel only zooms once the plate has been touched (or on a trackpad
pinch, which arrives as ctrlKey), with `touch-action: pan-y` so a touch drag
orbits horizontally while the page still scrolls vertically. Rendering is on
demand — a frame is drawn per interaction or tween step, never a free-running
loop. Nothing is persisted: every load is the initial pose. Sheets 7/7B/13 and the
megacanvas are byte-identical to before the CITY export. Cycle 2 candidates, all
unstarted: labels and a hover info panel (which member, files, sloc, tier),
district lettering in the scene, and the coverage-shadow treatment from sheet 13
(covered = lit, uncovered = shadow) as a second material lane.
I8 city cycle 2 LANDED 2026-09-03 (city-scene rev B): three things, all inside
generator/city-scene.mjs — the flat sheets and the megacanvas are byte-identical.
(1) NUMBER CHIPS: each of the 31 src masses now carries a billboarded THREE.Sprite
whose texture is drawn at runtime into a canvas-2D in the page's OWN `--mono`
stack — no network, no font file — showing sheet 7's number `n`, so the flat plate
and the model cross-reference by the same numbering. Ink on paper with a soft
rule, 21 world units tall, lifted 9 above the cap; drawn with `depthTest: false`
at renderOrder 5 so it can never z-fight the frame it belongs to, and redrawn from
scratch when the theme turns. CHOICE — chips DO fade by zoom: below zoom 0.62 all
31 are dropped, because a pulled-back plan silts up otherwise; at the opening zoom
(1) all 31 are up and legible, with only mild crowding in the dense tools cluster
(20/23/26/27/30), which the flat sheet has too. (2) HOVER PANEL: a raycaster picks
on pointermove against a set of invisible box proxies kept OUT of the scene graph
(their matrixWorld is updated by hand), one per src mass and per annex, both
tagged with the member — so hovering an annex reads the member it belongs to, and
the `off` tier, which has no wall mesh at all, is still pickable. The hit member's
walls swap to a hover twin of their own tier material (same tint pulled a shade
further, +0.1 opacity) and its frames to the accent, and a reading panel below the
stage fills from the schedule's own row — e.g. `12 · @tools/release` /
`tools/ · HALTS A PUBLISH — 2,067 src sloc in 46 files · spec annex 2,206 sloc in
20 files` / `hosts published-diff — the one publish halt`. The note line comes
from sheet7's exported `PLACED`, so the prose is the plate's, not new prose.
Cleared on pointerleave, suppressed while dragging or mid-snap, cursor turns to a
pointer over a mass, touch taps to select and taps bare ground to clear, and a
hover change asks for exactly one frame — render-on-demand is intact.
(3) DISTRICT LETTERING: PACKAGES/ · APPS/ · DOCS + EXAMPLES/ · TOOLS/ are laid
FLAT on their ground plates as canvas-textured ground planes (rotateX(-90°)), NOT
billboarded, so they foreshorten with the ground like lettering on a site plan;
each is set toward its plate's near corner where the ground is clear of massing,
sized to its plate and clamped to fit. CHOICE on orientation: each label is turned
onto the OPENING diagonal (rotation.y = 45°, the camera's own right vector at
az0), so it reads dead level at rest and shows turned — and at 225° mirrored — at
the other three snaps, exactly as a real site plan behaves when you walk round the
table. Verified headless at 1440×1000 in both themes (swiftshader), screenshots
inspected: chips legible and non-colliding at the init pose, lettering reading as
ground-plan text, hover highlight plainly visible. Programmatic: hovering member
12's projected point → panel `12 · @tools/release … HALTS A PUBLISH …`; member 1 →
`1 · lit-ui-router … the material …`; empty ground → hovered null and the panel
back to its idle text; hover during a snap tween → suppressed (null); 31 chips
shown at zoom 1, 0 at the 0.45 zoom floor; console clean in both themes. Orbit
snap unchanged: 182.51° → 225°, 2.51° → 45°, 182.51° → 225°. Cycle 3 — the
sheet-13 coverage-shadow drape (covered = lit, uncovered = shadow) over this same
city — remains UNSTARTED.
I8 city cycle 3 LANDED 2026-09-03 (city-scene rev C): THE SHADOW SURVEY as a
second material lane, and one correction to the record first — the
coverage-shadow treatment lives on SHEET 7A, the shadow survey, not sheet 13;
sheet 13 is the weathering map, and cycle 2's note pointed at the wrong plate.
sheet7a.mjs now exports `SURVEY` (n, cat, ext, line, branch, func per member)
the same way sheet7.mjs exports `CITY`, and generator/city-scene.mjs imports it
and ships it in the JSON island, so the model and the flat shadow plate cannot
drift any more than the model and the census can. A `TEST LIGHT` checkbox beside
RESET — the survey office's TILT idiom — swaps the lane; default OFF is the gate
tiers, unchanged. The lane is BUILT ONCE at init as a second set of meshes and
frames and toggled by visibility, never rebuilt: the picking proxies belong to
the tier pass alone, because both lanes stand on the same footprints, so hover,
chips, snap, zoom and reset behave identically in either. Polarity is sheet 7A's:
a metered member's src mass SPLITS along x into a lit slab of side × extent taken
from the annex (east) side and a shadow slab beyond it, the two frames giving the
terminator for free; the lit tint steps through the line-coverage bands (≥95 the
full halo, 85–95 a shade back, below 85 into red); ext=100 is lit wall to wall,
№26 happy-dom at ext=0 is all shadow under a burning lamp; the eleven `n` members
are washed whole; `e` members take an accent wash with an accent frame; `u`
members drop to bare paper walls — an outline of light; №27, with no mass, stays
frame-only in both lanes. Every annex becomes the LAMP, tinted stronger than any
wall it throws light onto. Shadow lerps toward BLACK, never `--ink`, which is
light in the cyanotype theme — the flat plate's own rule, and it is why the wash
darkens in both. Tints settled after screenshots: lit .46/.34, red .38/.58,
shadow .74 black, e2e .24, lamp .60, bare .05. №31 eslint-plugin-lit-ui-router is
in CITY and absent from SURVEY — the 2026-08-17 metering predates it — so it is
drawn in bare paper with a faint frame and says so in the panel rather than being
counted dark. The legend swaps with the lane (LIT ≥95 · lit 85–95 · lit <85 ·
SHADOW — never loaded · e2e light · lamp = spec annex) and the hover panel gains
the survey sentence, verbatim from the row: №12 `suite lights 54.1% of the source
· line 98.4 · branch 96.3 · func 96.8`, №11 `FULL SHADOW — no suite`, №5 `tests
run — no meter attaches`, №6 `e2e light only — no meter reads it`, №31 `not in
the 2026-08-17 survey`. `paint()` recolours both lanes, so a theme turn under
either is correct. Verified headless at 1440×1000 (swiftshader), console clean in
both themes — the `--halo` token is an rgba and three warns on the dropped alpha,
so the hue is stripped to `rgb()` before it reaches a wall. dpr=2: canvas rect
1244×540 = the stage rect, no overflow past the sheet (the retina hotfix
survives). Snap in the lane: released at 126.65° → 135°. 31 chips at zoom 1.
Screenshots read the story from the air: in dark the packages district glows pale
blue wall to wall while examples and the typedoc plugin sit near-black, and
№12 release stands half dark, half lit — the yard's habit, in three dimensions.
Sheets, megacanvas and README are byte-identical; only gallery.html moves.
I5 wave 2 LANDED 2026-09-02: census-npm probe (registry dates — caught
@uirouter/angular 22.0.0 and the eslint-plugin `latest` dist-tag still at
0.0.1-alpha.0); census-nm ref-pinned on the BUILT archive (install +
turbo run build); sheets 12 (rev C), 3B (rev D) and 8 import their plates
(opus fan-out; fifth package = new publishable row / structure 27 / no
new delivered pkg). Remaining I5: bundle probes 9/10/11 reconstruction;
sheet 4 onto census-npm.json (upstream monorepo is waking the family —
angular 22.0.0 published 2026-08-18).
I5 wave 5 LANDED 2026-09-03: the last big hand-pasted sheet is off the
clipboard. census-handoff.mjs is a T1 tree probe — workflow `mise run`
call sites, mise task tables (no TOML parser: `[tasks.x]` headers minus
sub-tables, plus the file-task directory) and turbo task definitions
(turbo.json is JSONC, so comments and trailing commas are stripped before
parse), all read from the materialized archive, nothing executed. FIDELITY:
run against rev B's own ref 0e4ab36 it reproduces every printed figure
exactly — 11 workflows / 8 calling / 37 call sites / 28 targets, the eight
per-file counts, 48 tasks split 9·9·15·15, 21 arg specs, 17 turbo.json /
91 definitions (45+46) / 12 cache:false (7+5). The one apparent
contradiction on the sheet was not one: the mise header's "2 use depends"
counts TASKS and seam row D2's "5 depends" counts EDGES (setup 1 +
lint_workflows 4), and the plate now carries both numbers under their own
names. Nothing had to be fudged and nothing is left hand-written. At the
cabinet's pin (35c6766) the story repeats: the mise machine has STILL not
moved a task, and turbo grew only with the workspace — an 18th turbo.json
(the fifth package) and root `check:dev-split` take definitions 91 → 97
(46+51) and `ci:pull_request` to 11 lanes. Sheet 3A is rev C: every count
imported from census-handoff.json + census-plate.json (ci graph, ci:main
overlay, phantom shroud 414/590 = 70.2%), rows and the no-mise list
data-driven, and the load-bearing citations re-verified against the new
ref — turbo.json's twin 211-221 → 215-225, the cache-gasket inputs
224-228/241-247/252-258 → 228-232/245-251/256-262, ci:pull_request
312-324 → 316-330, package.json:30 → :31, release mise.toml:104-108 →
104-107. One editorial claim did NOT survive and the sheet says so: door 3
no longer bootstraps with `npx pnpm@11.21.0` — cloudflare-build.sh:26-38
now clears corepack's shims and installs pnpm@12.2.1 globally before
`npx turbo docs#build`, still the one production path that never sees
mise. NOTE for the next refresh: origin/main has already moved past the
cabinet's 35c6766, so this probe's default ref is the MASTER PLATE's sha,
not the branch tip — a plate filed later must measure the tree its
siblings measured, or census-atlas throws on the mismatch. The survey
office picked the new station up on its own: 52 → 55 nodes, 63 → 69 edges,
14 probes / 14 plates / 14 drawings, T1 5 → 6.
Known follow-ups: chrome.mjs shared title-block DATE — CLOSED 2026-09-03,
now derived from census-files.json's commitDate (the ref's commit date,
per the census-steam rule), so a recensus re-dates every title block
automatically; commitsByMonth could join the weather
plate if the commits row is wanted back; 3A — CLOSED 2026-09-03, the
handoff census is census-handoff.mjs and sheet 3A imports it; 7A lamps
stay hand-pasted (no plate of their own yet). Basis for the design: full survey of
`diagrams/generator/` (session altitude-atlas). Budget frame: current plan is
$100/mo with a 5h rolling window, and this work also draws on the Fable weekly
allowance — so the work is cut into initiatives sized to land one at a time,
each its own graft → build → lint → commit → push → republish cycle.

## Why rework

Ten census scripts, five distinct bases, and every number on every sheet is a
hand-pasted constant. The concrete faults:

1. **Basis = whatever's checked out.** Most probes walk the working tree with
   hand-rolled skip lists; steam/weather mix HEAD history with a working-tree
   file universe. Only `census-overview.mjs` is ref-clean (git archive).
2. **Frozen member lists.** The 30-entry MEMBERS/POOL arrays predate
   eslint-plugin-lit-ui-router's graduation; `existsSync` guards make a missing
   dir silently count as zero.
3. **Numbers travel by clipboard.** Probes print JSON; a human pastes constants
   into `sheet*.mjs`. Cross-sheet totals reconcile only by discipline.
4. **Time is hard-coded.** weather `TODAY = 2026-08-17`, steam
   `--since=2026-05-19` — re-running today still ages files against August.
5. **Out-of-band inputs.** @uirouter/core measured from a dead scratch path;
   sheets 9/10/11 bundle probes and the npm dates have no script; 3A/7A cite
   vanished tmp/ generators.

## Target architecture

- **Layer 0 — `basis.mjs`.** `materialize(ref)` → rev-parse sha, `git archive
  <ref> | tar -x` to tmpdir, relative file walk → `{ ref, sha, dir, files,
  commitDate, cleanup }`. Extracted ONCE per run, shared by all probes.
  `--ref` on the CLI, default origin/main. (Pattern: census-overview.mjs;
  scc needs RELATIVE paths + cwd at the tree root.)
- **Layer 1 — one measurement, many views.** One `scc --by-file --format json`
  over the archive is the master per-file census; overview/city/yard/bricks
  become group-by queries over the same rows, so totals reconcile by
  construction. Same move for history: one `git log <ref> -M --name-status`
  feeds steam + weather.
- **Members discovered, not listed.** Derive the member set from the archive's
  own `pnpm-workspace.yaml` + member package.json. Editorial groupings
  (districts, instruments) stay as name-keyed pattern rules with a loud
  "unmatched members" line.
- **Time pinned to the ref.** History probes derive TODAY / windows from the
  measured sha's commit date — reproducible on re-run, honest on any branch.
- **Layer 2 — snapshots are the build input.** Each probe writes
  `diagrams/data/<probe>.json` `{ ref, sha, countedAt, tools, rows }`; sheets
  import the JSON and render basis/provenance lines FROM the snapshot fields.
  Rev letters + rev notes stay manual (editorial). A refresh is still a
  reviewed, committed event — every printed number stays citable to a
  checked-in file.
- **Probe tiers.** T1 pure-tree (overview, city, yard, bricks, 3A) = archive +
  scc, any ref. T2 history (steam, weather) = `git log <ref>` + the same ref's
  archive for the file universe. T3 execution (plate/turbo, mass-3b, nm,
  bundle probes) need an INSTALLED tree: archive → `pnpm install
  --frozen-lockfile` in the tmpdir (+ build for nm); until scripted they run
  on a real checkout of the ref and the snapshot says so.
- **Loose ends.** bricks fetches @uirouter/core itself (npm pack/pacote at the
  cited version); 3A/7A generators reconstructed as T1 queries; npm dates
  become a tiny scripted probe.

## Pipeline self-portrait (the viz of the pipeline itself)

Decision: **flow graph, not lego.** The pipeline's truth is dataflow —
ref → archive → measurements → snapshots → sheets — and a connector/brick
metaphor encodes containment, which is the wrong claim. The atlas already has
the right vocabulary: probes as survey instruments/stations, snapshots as
filed plates, sheets as finished drawings; tier = station type, and the
"one measurement, many views" fan-out is the hero of the picture.

Three escalating lanes (separate initiatives, each independently shippable):

1. **Static atlas sheet** (in-set, numbered, dated like every other plate):
   the survey office. SVG flow in house style; T1/T2/T3 stations, the single
   scc master table as the central instrument, snapshot files as the plate
   cabinet, sheets as the output rack.
2. **Interactive cytoscape graph** in the gallery: data model first — NODES
   (probes, snapshots, sheets, external tools) / EDGES (reads, writes,
   imports) arrays, exactly the pattern used elsewhere. Building sprites as
   node skins via cytoscape node `background-image` (the pinned
   HZD×SC2K×Factorio sprite direction generalizes: sprites are the general
   building representation, so pipeline stations get sprites too).
   Sprite treatment note (2026-09-02): walls are TRANSLUCENT semi-opaque,
   never fully opaque — the girding frame peeks through. Applies to every
   sprite lane (I7 skins, I8 3D, and the weathering-map sprites alike).
3. **3D tilt.** Cheap first step: CSS `perspective` + `rotateX` on the
   rendered graph container (a real tilt, minutes of work, reversible).
   Full step: a three.js isometric scene with billboarded sprites and a
   camera tilt/orbit — its own initiative, only after the cytoscape lane
   proves the data model.

## RDF crossover (silicon-grove, explored 2026-09-02)

Survey of `~/Developer/simshanith/silicon-grove/rdf-playground/` (user's
suggestion). The defensible reuse is narrow:

- **Lift the I7 data model from `rdf-graph-core`.** Its `types.ts`
  `GraphNode`/`GraphEdge` (integer-indexed, namespace-tagged, degree) plus
  `getGraphStats`, `namespace-colors.ts` color map, and the legend generator
  transfer with "namespace" → "node kind" (probe / snapshot / sheet / tool).
  ~200 lines, tested over there; drop the Float32Array physics fields —
  cytoscape owns layout (a probes→snapshots→sheets DAG wants dagre/elk
  layering, not d3-force).
- **Name snapshot provenance fields after PROV-O.** `generatedAtTime`,
  `wasGeneratedBy`, `used`, `wasAssociatedWith` instead of ad-hoc
  `countedAt`/`tools` — near-zero cost now, and it makes a future
  named-graph-per-ref triple view (`<urn:atlas:census/{sha}>`, cross-ref
  diffing via SPARQL `GRAPH ?a … MINUS GRAPH ?b`) mechanical. Oxigraph's
  query path is proven in the playground; the JSON snapshots stay the
  source of truth, RDF a derived view — only worth building if multi-ref
  queries become a real want.
- **Skip:** its Canvas renderer (no sprite/image nodes — cytoscape
  `background-image` is the feature I7 depends on), the Mermaid emitter
  (fine prototype, can't survive into I7), Barnes-Hut/WASM (tens of nodes),
  and the shared 3D ambition (roadmap prose on both sides, zero code).

## Initiatives

Sized in granular cycles (one cycle ≈ one commit+republish sitting). Order is
dependency order; each lands alone.

| # | Initiative | Scope | Cost | Depends |
|---|---|---|---|---|
| I1 | Basis layer + master scc census; port `overview` onto it (behavior-identical) | basis.mjs, census-files snapshot, overview as query | 1 cycle | — |
| I2 | city/yard/bricks as queries + workspace-derived members | kills frozen lists; five-package tree sheets on any ref; bricks fetches core itself | 1–2 cycles | I1 |
| I3 | steam/weather ref-pinned | shared `git log` probe, dates from ref commit date | 1 cycle | I1 |
| I4 | Snapshot-import sheet refactor | sheets read `diagrams/data/*.json`; generated basis lines; big but mechanical → opus subagents | 2–3 cycles | I1–I3 |
| I5 | T3 recipes (turbo, nm, bundle 9/10/11, npm dates) | archive+install harness; costliest, least churn | 2–3 cycles | I1 |
| I6 | Pipeline self-portrait: static sheet | new numbered sheet, house SVG style | 1–2 cycles | design frozen (I1 helps accuracy) |
| I7 | Cytoscape pipeline graph + sprite nodes | NODES/EDGES data model, sprite skins, gallery page | 2 cycles (+sprite authoring) | I6 data model |
| I8 | 3D tilt | CSS-perspective tilt = free rider on I7; three.js scene = stretch | 1 cycle / 2–3 stretch | I7 |

Suggested pacing against the 5h-window + Fable-weekly budget: one initiative
per sitting, mechanical fan-out (I4 especially) delegated to opus subagents,
Fable kept for the design/verify loop. I1+I2 are the highest-value pair (they
unlock counting the fifth package on tree sheets); I6–I8 are the reward lane
and can interleave whenever a sitting has budget left over.
