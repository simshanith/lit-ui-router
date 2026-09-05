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
R1 — FIRST FULL-CABINET REFRESH LANDED 2026-09-03: every one of the 14 plates
re-counted at origin/main @ eb32b4e (commit 2026-09-03T23:27Z), up from the
cabinet's 35c6766, in one pass in dependency order — census-scc first, then the
T1/T2 queries, then the six T3 install probes. This is what the pipeline was
built for and it did the job: no sheet needed a number typed into it, the
census-atlas guards caught the half-refreshed cabinet on every intermediate
build, and the two sheets that DID throw (3B on a task that left the graph, and
census-mass3b on a citation whose file left the tree) threw for the right reason
instead of drawing a stale figure. What moved: workspace still 31 members / 19
tools / 5 published, but the eslint plugin went rc.1 → rc.2 and grew 2f/299 →
6f/667 with #689's three new rules, so it moves on sheets 2, 4, 7, 7B, 11, 12 and
13 at once; tools/shared gained the #693 guard cores; @tools/release shed 2 files.
turbo SHRANK for the first time in this atlas's history — #696 deleted
apps/sample-app-shared/turbo.json and #693 swapped //#check:docs-api-deps for
//#check:graph-edges + //#check:task-inputs, so 18 files / 97 definitions became
17 / 96, and #693's replacement of the three `^docs:api` fan-outs with four
package-qualified `<pkg>#docs:api` edges collapsed the docs:api column 9 → 4
nodes and took real→real edges 126 → 96 on a graph of the same size. The mise
machine STILL has not moved a task (48/4/21/2/5, 37 call sites, 28 targets — a
third measurement, unchanged), and 15 of the 16 doors reprobe byte-identical.
census-nm is byte-identical but for provenance. The honesty sweep found five
live contradictions the new numbers exposed and one that predated them: sheet 9's
"leads the HTML by" went NEGATIVE (the prose pages overtook Inter by 258 bytes —
rev F); sheet 11's "about a third of the flagship" became 57%; sheet 3B's
"thinnest tower" note and root-yard plat were both invalidated by #693 (rev E);
and sheet 3's task-manager inset was found hand-pasting `ci = 535 nodes` while
3A and 12 printed 590 in the SAME build — it now reads census-handoff.json +
census-plate.json, as does sheet 7B's PIPES channel, which had been hand-pasting
22 real of 113 against the plate's 24 of 111. Revs bumped: 3→D, 3A→D, 3B→E,
4→D, 7B→D, 9→F, 11→D, 12→D, 13→D. Sheet 7A and the 3D city's TEST LIGHT lane
keep the 2026-08-17 metering untouched and still say so. Probe fixes, both
general: basis.mjs gained positionalsFromArgv() because `--ref origin/main` was
being eaten as a positional by census-plate (as a pipeline name) and by
census-nm/census-bundle (as an app dir) — the first run of this refresh filed an
EMPTY census-plate.json because of it, so pass --ref through the helper, never
raw argv; and census-mass3b now throws a named error when a CITES row points at
a file absent at the ref, instead of surfacing scc's "could not be read". NOTES
FOR THE NEXT REFRESH: (1) budget ~35 min of wall clock for the T3 chain — each
of the six probes pays a full `corepack pnpm install --frozen-lockfile`, and the
examples' npm installs are the long pole; (2) run census-scc FIRST and never
re-fetch origin mid-run, or the plates split across two shas; (3) a T3 probe that
takes positional args must be given its ref through --ref and nothing else; (4)
the generatedAtTime of a late T3 probe can land on the next UTC day while the
commitDate stays put — that is honest, and only the commitDate drives the title
blocks; (5) sheet 1's sub still prints `lit-ui-router 1.9.0` (repo is 1.11.1) and
sheet 3's still prints `44 turbo task names` (17 turbo.json files hold 67 distinct
names) — both are hand-written on sheets with no plate behind them, both are the
last un-cited numbers in the set, and putting either on a plate would add sheet 1
to the survey office's rack; (6) sheet 7A's lamps and sheet 7B's rust remain
declared editorial constants — they are the only channels a refresh does not move.
R2 — THE LAMPS LANDED 2026-09-04: the atlas's last hand-pasted probe is
reconstructed and the 7A follow-up is CLOSED. census-shadow.mjs is a T3 probe on
the standard harness — materialize, `corepack pnpm install --frozen-lockfile`,
then meter every member under ITS OWN suite's meter and parse the lcov, never a
stdout table: the tree's own unmodified `turbo run test:coverage` where a member
declares one, its own `test` script re-run with `--experimental-test-coverage`
for the node:test members, and `--coverage.enabled --coverage.provider=v8` for
the vitest ones. Two judgements only, both verified rather than assumed: the
cypress-lit members (the run throws if the rig has stopped being a cypress
suite), and what counts as a self-suite (dts-backtest's `node run.ts` backtests
the PACKAGES, so it reads `n`). Everything else is derived — a meter that
attaches and finds nothing of the member's own is `m` at extent 0 (happy-dom's
canary), and `u` is only awarded after re-running the suite WITHOUT the meter to
prove it passes (sample-app-shared). FIDELITY GATE at the old metering's own ref
3557c29: EXACT. Same 13 metered members, same cat letters, and line/branch/func
identical to the decimal on every one — the schedule's grand total comes back
5,427/5,539 lines, 1,283/1,351 branches, 419/437 functions, which is what rev D
printed; the narrated meter footprints reproduce too (№1 1,325 sloc, №16 shared
9f/300). ONE named exception, and it is the tape measure, not the meter: №15
build_and_test was recorded 7f/756 with 464 lit and the probe reads 7f/779 with
487 — identical file sets, the whole 23 lines inside error-summary.core.ts,
which the old "neither blank nor comment-only" counter reads at 233 and scc
4.0.0 at 256 (template-literal interiors are code — sheet 7 rev D's own ruler
change), confirmed by counting that one file both ways. Nothing had to be
fudged. RE-METERED at the cabinet's eb32b4e: 16 members metered, not 13.
№31 eslint-plugin gets its first metering and comes in lit wall to wall
(6/6f, 100% extent, line 99.2); №29 warn-lanes, drawn at rev D as an outline of
light on the guess that no lcov leaves it, meters clean at 100%; №20 oxc-emit,
drawn dark, has grown a suite (25.2%). THE DAGGERED PAIR IS THE FINDING: rev D
drew build_and_test at 41.1% and shared at 82.4%, both computed by dividing an
August lit figure by an end-of-August census — measured at one ref they are
73.0% and 88.4%, so the dagger mechanism SYSTEMATICALLY UNDERSTATED the members
it marked, and 7B's "lamp that went out" was an artefact of it rather than a
suite that stopped covering (that plant is back to two lamps). The one dimming
is №12 release: further reach (54.1 → 57.9%) at lower brightness (line 98.4 →
96.6, function 96.8 → 93.6). Sheet 7A is rev E — placement and numbering now
come from sheet 7's own PLACED table so the two plates overlay by construction,
every figure is imported, and the daggers are retired rather than explained; the
3D city's TEST LIGHT lane is rev D and relights itself (the "not in the
2026-08-17 survey" special case is gone, and a mass with no survey row is now a
build error). SCOPE CALL: sheet 7B's LAMPS channel was hand-pasted FROM 7A, so
leaving it would have printed two different meterings of one city — it now reads
census-shadow.json too (rev E), and rust is the only editorial channel left on
that plate. IDEMPOTENCE, with one honest wobble: four runs at the cabinet ref differ only in
generatedAtTime EXCEPT №31's branch DENOMINATOR, which came back 213 twice and
215 twice (191 hit either way — 89.7% vs 88.8%). node --test's V8 branch
discovery is not perfectly repeatable; nothing else in the plate moves, and both
7A's method paragraph and this log say so rather than pretending otherwise. Two
probe bugs were caught by the gate and are general: an lcov SF path may be
REPO-relative (that is what tools/lcov-rebase exists to do), so every SF is now
resolved against both the run's cwd and the tree root and the candidate that
names a real file wins — without it ui-router-server read 0 of 8 files lit; and
a meter that ATTACHES and finds nothing of the member's own is `m` at extent 0,
not `u` (happy-dom), so `u` is decided by whether the coverage run itself
survived, proved by a second meter-less run. Error strings in the plate have the
tmpdir stripped to `<archive>` or the plate never diffs clean.
Survey office picked it up on its own: 14 → 15 probes/plates, T3
6 → 7, 55 → 60 nodes, 69 → 79 edges, and 7A joins the rack (14 → 15 drawings).
Nothing numeric on 7A or 7B is hand-typed any more.
R3 — THE LAST RELICS CITED 2026-09-04: the two un-cited numbers R1 reported (and
one more it missed) go onto plates. Sheet 1's altitude line reads the flagship's
version from census-files.json (1.9.0 was two releases stale — it prints 1.11.1
and re-dates itself at the next recensus); sheet 2A, which hand-typed all five
brick rows from the 2026-08-17 count, now derives them from census-bricks.json
via a throwing lookup (lit-ui-router 1.9.0 · 12f · 1,325 → 1.11.1 · 13f · 1,383;
the other four rows were coincidentally still true); sheet 3's altitude line
derives its package/tool counts from census-files.json and its task-name count
from a new `turbo.distinctNames` field on census-handoff.json — the probe now
collects the distinct key set while it parses, and the honest figure is 68, not
the 67 R1's ledger estimated (verified by an independent recount at eb32b4e; the
`//#` keys are turbo's root-task syntax, all real names). Revs: 1 → E, 2A → B,
3 → E. Survey office grew to 17 reading drawings on its own, and the sheet-14
WORD trap R2 fixed held (master plate still "read eleven times over" — its
queriedBy counts stations, not drawings). With this, EVERY number printed by the
atlas is plate-derived or a declared editorial constant (7B rust; placement).
QA 2026-09-04: full in-browser pass of both interactive lanes after
R1–R3 (headless Chromium, both themes + both stamp states, dpr 2,
reduced motion, theme turn under TEST LIGHT) — CLEAN, no defects, no
changes. №31 draws lit wall-to-wall, №15 at exactly 73.0%, every hover
sentence matches the plate to the decimal, tilt pauses input with the
bar still live, wheel never hijacks an unengaged scroll. Two benign
notes for the record: hover keeps the prior selection during a snap
tween (no misaligned pick is possible — the contract's intent holds);
the swapped legend labels b3 and b4 together as "lit <85" (no member
falls in either band at this metering).
PUBLISHED 2026-09-04: the atlas is live at https://atlas.lit-ui-router.dev/
— a standalone Cloudflare Pages project (altitude-atlas, production branch
worktree-altitude-atlas, direct upload; the user attached the domain in the
dash). generator/stage-site.mjs builds the deployable: the rendered set with
the gallery doubled as index.html and the two CDN scripts vendored under
./vendor/ (sha256 pin-verified at stage time; the committed pages keep cdnjs
for the artifact host's CSP). Refresh cycle: build.mjs → stage-site.mjs →
`wrangler pages deploy dist --project-name altitude-atlas` from diagrams/.
This branch never merges to main — it is the atlas's permanent home.
I7·12i LANDED 2026-09-04 — SHEET 12i, THE REGISTER, WALKED: sheet 12's punchcard
with a pointer in it, the second cytoscape lane and the first one built on a
census plate rather than on the generator's own introspection. census-plate.mjs
gained the WIRING it had never carried: `graphNodes` (one `(package, task)` pair
per line, `real` flag and `cacheFalse` where true, sorted by task id) and
`graphEdges` (one `[dependency, dependent]` index pair per line, sorted), for the
`ci` pipeline. NO AGGREGATION WAS NEEDED and none was done — the complete graph,
586 nodes and 1,382 edges, takes the plate from 66,271 to 126,739 bytes, inside
the 150KB budget, and the probe stays byte-stable: two runs at the cabinet's
origin/main @ eb32b4e differ in generatedAtTime alone, and every pre-existing
field is byte-identical to the R1 plate (the sort is what guarantees it — turbo's
own task order is never trusted). generator/register-graph.mjs is the lane,
modelled line for line on pipeline-graph.mjs: the same single cytoscape pin
(CYTOSCAPE_URL is imported from it, never re-typed), the plate's arrays shipped
VERBATIM as a JSON island, the layout computed at build time and drawn with
`preset`, and the init wrapped so boot() runs on DOMContentLoaded — the defer/parse
race that once silently killed the survey office is designed around here rather
than rediscovered. Layout is the register: rows are the 32 packages in sheet 12's
own block order, columns are the 49 task names ranked by the longest dependency
depth any of their nodes reaches — the pipeline's real stages fall out of the edge
list, so no hand-written column order can go stale. Sheet 12's COLS could not be
imported (it is not exported and sheet12.mjs was out of scope), so the block rule
is re-derived and throws if a package finds no block. THE HERO IS THE PHANTOM
SHROUD: the default view is the REAL subgraph alone — 177 command-bearing tasks
and the 96 edges joining two of them — and one checkbox in the TILT / TEST LIGHT
idiom floods in the other 409 nodes and 1,286 edges faint, so the 69.8% figure
sheet 12 prints stops being a ratio and becomes a picture. It is a visibility swap
over one fixed layout, never a re-layout, and it restores exactly (verified
177/96 → 586/1,382 → 177/96 in four browser passes). Four column heads are drawn
in red and are absent from the default view because nothing in them runs at all —
`lint:workflows`, `transit`, `ci:pull_request`, `ci`. Two sprite skins are
authored in the lane to the house recipe (frame first, semi-opaque wall over it):
a real task is a works shed with a lit door, a phantom is the plot without the
building — dashed frame, no wall, no roof, unmistakable at any zoom; sprites.mjs
was out of scope, so the palettes are mirrored there rather than shared, and that
duplication is the one debt this initiative leaves. One thing was learned in the
browser and not by reasoning: at 586 cells the survey office's dim-everything
hover blanks the whole register, so the lettering — column heads, row labels, band
labels — is now exempt from `.dim` and the ghost grid stays readable behind the
lit neighbourhood. Sheet 12i is a standalone page (`sheet-12i-the-register-walked.html`)
AND a gallery lane indexed as S12i, the arrangement 2B uses one altitude down;
chrome TOTAL stays 14. Verified headless in light and dark, on the standalone page
and in the gallery, consoles clean in all four, and sheet 14 / the survey office
still boots after the shared build edits. The office picked the new drawing up on
its own, as designed: sheet12i.mjs reads census-plate.json, so it joins the rack
rather than the unplated list.
TILT RETIRED 2026-09-04 by user request: the survey office's CSS-perspective
viewing pose (I8 base, above) is removed from pipeline-graph.mjs — checkbox,
desk wrapper, --pg-pull measurement, pose copy and the reduced-motion
transition all gone; TOOLS LEDGER and FIT stay. The pose was input-paused by
design, and once the isometric city carried the real 3D payoff it was an
ornament. The I8 narration above stands as history.
Known follow-ups: chrome.mjs shared title-block DATE — CLOSED 2026-09-03,
now derived from census-files.json's commitDate (the ref's commit date,
per the census-steam rule), so a recensus re-dates every title block
automatically; commitsByMonth could join the weather
plate if the commits row is wanted back; 3A — CLOSED 2026-09-03, the
handoff census is census-handoff.mjs and sheet 3A imports it; 7A lamps —
CLOSED 2026-09-04 (see R2 below). Basis for the design: full survey of
`diagrams/generator/` (session altitude-atlas). Budget frame: current plan is
$100/mo with a 5h rolling window, and this work also draws on the Fable weekly
allowance — so the work is cut into initiatives sized to land one at a time,
each its own graft → build → lint → commit → push → republish cycle.
SHEET 2B — THE COUPLING BENCH LANDED 2026-09-04: altitude 2 gets its interactive
sibling, and a sixteenth plate lands with it. census-couplings.mjs is a T1 tree
probe on the standard basis — it reads the five published package.json files out
of the archive and files every entry in `dependencies`, `peerDependencies` and
`optionalDependencies` (devDependencies are NOT contracts: they bind the
workspace and never reach a consumer's install). THE TRAP THIS PROBE EXISTS TO
SOLVE: every spec in this repo is a `catalog:` reference, so the file does not
contain a range at all — `catalog:publishedPeer` is what is written and
`^6.0.8` is what ships. The probe resolves each spec against the archive's own
pnpm-workspace.yaml (the catalog blocks are a flat two-level mapping; no YAML
library for eight lines of work) and the plate carries BOTH, so the panel can
show what is written and what a consumer would see. @uirouter/core and lit carry
no range of their own — their versions come from the archive's pnpm-lock.yaml
`packages:` section, which is the only honest source for a resolution, and lit
resolves TWICE (2.8.0 and 3.3.3) because the compat lane is tested, not merely
permitted. THE ARCHIVE CONFIRMS THE RECORD on every shipped decision this atlas
remembers: lit's peer really is `^2.0.0 || ^3.0.0` on both packages that touch
it; core and lit really are peers, not deps; and the oxc runtime really is the
one thing lit-ui-router still ships in `dependencies`, at `>=0.50.0` — nothing
had to be corrected. 12 contracts, 7 of them between nodes on the bench: 10
peers to 2 dependencies, and neither dependency is a router. Two are red —
ui-router-server's core and hono are OPTIONAL peers, which is sheet 2A's
crossed-out tie in another notation — and the fifth package stands in a bay of
its own, because eslint-plugin-lit-ui-router couples to eslint and to nothing
else in the family. generator/coupling-bench.mjs is the lane, built on
pipeline-graph.mjs's discipline: the same pinned cytoscape URL imported from it
so there is ONE pin, a JSON island, a preset layout computed at build (7 nodes
in sheet 2A's own arrangement — wall left, lit above it, companions in 2A's
order at the right, the server below with its crossed-out tie), and the init
wrapped so boot() runs on DOMContentLoaded. Node skins are sprites.mjs's
existing vocabulary re-read for what each sprite DRAWS rather than what the
pipeline calls it: core takes the strongroom, lit the external crate, and a
published package takes a 1/2/3-storey hut whose storeys are the brick
schedule's `courses` band — stated on the sheet, because it is a reuse and not a
tier. sprites.mjs was not touched. Massing is census-bricks.json's (area ≈ sloc,
1×1 companions clamped up). Hover or tap an EDGE for its range, section, written
spec and direction; a NODE for its version, mass, what it declares, what
declares it, and the contracts that leave the bench. sheet2b.mjs is the
standalone page — the lane plus method prose whose every figure is a throwing
lookup into the plate — and the gallery mounts the lane beside sheet 2A rather
than at the end, indexed as S2B. The survey office picked the station up on its
own with no edit to census-atlas.mjs: 15 → 16 probes/plates, T1 6 → 7, 60 → 66
nodes, 79 → 88 edges, and sheet 2B joins the rack. Verified headless in both
themes: consoles clean, sprites render, hover fills the panel with the plate's
real ranges. Probe is idempotent (four runs differ only in generatedAtTime).
2B REV B 2026-09-04, user-caught: the three companions share one column, so the
mobx -> lit-ui-router peer edge drew as a vertical line STRAIGHT THROUGH the
navigation-location-plugin node between them — it read as mobx coupling through
the nav plugin, an overlap the plate never claimed. The data was right; the
drawing lied. Fix in coupling-bench.mjs: any drawn edge whose endpoints share a
column x is flagged `bow` at build and styled as an unbundled bezier arcing 120
out of the column, so the contract and its `^1.7.0` label clear the bystander
entirely. Verified by screenshot (playwright, file://): arc clears the node,
label in its own air, console clean.
DEBTS RETIRED 2026-09-04, sheet 14 REV B: (1) register-graph.mjs no longer
restates the sprite palettes — sprites.mjs exports PALETTES and the register
imports it (its SKINS stay local; they are the register's own vocabulary);
the emitted register page is byte-identical, proving the copies had not yet
drifted. (2) The survey office's static plate had the EXTERNAL INSTRUMENTS
ledger colliding with the plate schedule's READ BY column — the rack grew to
19 drawings and pushed the ledger down into a table anchored only to the LEFT
column's depth. The schedule's SY is now max(left column, rack + ledger), and
long READ BY lists (the master plate is read by everything) wrap at ~80 chars
with per-row height, so neither defect can recur as the office grows.
Screenshot-verified.
R3 — SECOND FULL-CABINET REFRESH 2026-09-04: main had moved 14 commits past
eb32b4e, taking the lit-ui-router 1.11.2 and lit-ui-router-mobx 1.0.0 releases
with it, so every one of the 16 plates was re-counted at origin/main @ b2338d0
(commit 2026-09-04T17:11-07:00) in R1's order — scc, the nine T1/T2 queries, the
seven T3 install probes. The whole chain ran in 3½ minutes against R1's 35-minute
budget: the pnpm store was warm from the day's earlier probes, so each T3
install was seconds, not minutes — budget the long figure only after a cold
start. What moved: mobx 0.5.0 → 1.0.0 (bricks re-shape it 1x1 → 1x2, five files
/ 176 sloc), the eslint plugin's rc.2 grew to 9f/715, and one workspace member
was born — @tools/embed-heights (#703, docs#check:embeds: Chromium measures the
built examples against the heights the docs reserve). The build threw for the
right reason, in order: sheet 3B found four real tasks no structure drew, plate
7B found №32 with no rust step. The new-member checklist, now written down
because it is the one manual step a refresh has: 3B's TERRACE list, sheet 7's
PLACED table (which 7B imports), sheet 13's PLACED table, 7B's RUST map, and
census-yard's INSTRUMENTS rules — the first four throw when missed; the yard
only prints its orphans LOUDLY (3 → 0 here), which is a guard that should
probably throw too. №32 sits at plan (430, 430) on the yard's middle row; its
check:embeds lane was verified against the plate to be reachable from neither
ci nor ci:main before the note said so. Two compositions moved on their own:
the examples plain on 3B grew 17,821 → 31,477 watched files (side ∝ √files, so
a third wider) and its corner reached the harbour note, which moved to clear
air; and sheet 7's schedule was found truncating row 31's note at the frame
since rev D — both new notes are cut to fit. census-shadow re-confirmed the
`u` verdict for sample-app-shared (vitest browser mode cannot attach the v8
meter; the suite re-ran clean without it) and metered the newcomer on its own
node:test suite: 17 metered members, 7,980 lines. Revs: 3B→F, 7→E, 7B→F, 13→E;
every other sheet re-read its plates without a line changing. Screenshot-
verified on 3B, 7, 7B and 13.

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
