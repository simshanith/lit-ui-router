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
I7·1i LANDED 2026-09-05 — SHEET 1i, THE RENDER LOOP, WALKED: sheet 1's circuit
stood up and STEPPED, the third cytoscape lane and the first on a plate read off
the package's SOURCE. census-loop.mjs is a T1 tree probe over six files under
packages/lit-ui-router/src/: 10 stations (sheet 1's buildings, each anchored to
an implementing line), 12 legs (loop / click / event / tap, each with the call or
event that carries it), and the WALK — one click on `<a uiSref>` from /people to
/people/32 in 12 steps, 30 evidence entries of {file, line, verbatim text}. The
evidence table is authored as (file, line, expect) and the probe THROWS when the
line no longer reads what it expected — line numbers cannot rot silently; core's
sequence is stated only through the hooks lit-ui-router registers, no core line
is cited. `--tree <dir>` hands the probe an already-materialized archive of the
cabinet sha (this plate was first filed from a sandbox with no VCS access);
provenance still comes from the cabinet. generator/loop-walk.mjs is the lane
(register-graph.mjs's pattern: JSON islands, preset layout on sheet 1's ring
with the two overlays INSIDE the ring, ten sprite skins to the house recipe,
palettes swapped with the theme) and adds the walk controls — ◀ PREV · NEXT ▶ ·
STEP n / N, ← → only while the lane has focus (the routed app owns the page's
arrow keys), reduced-motion honoured. sheet1i.mjs is the frame, every number
templated from the plate. Standalone page + gallery lane right behind sheet 1
(S1i in the index), emitted into the app as the 22nd fragment; chrome TOTAL
stays 14.
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
R4 — THIRD FULL-CABINET REFRESH 2026-09-07: main had moved past b2338d0 taking
two structural PRs, so all 17 plates were re-counted at origin/main @ 185d414
(commit 2026-09-06T20:42-07:00) in R1's order. Both PRs changed the SUBJECT, not
just the numbers. #717 moved the documentation site out of docs/ into
www/lit-ui-router.dev/, and #716 dropped the sample app's markov seed pipeline —
with it the fifteen pre-gzipped demo corpora that had been sheet 9's tallest
district since rev A. The build threw for the right reason twice: sheet 9 on
"census-shipped.json: no district named demo corpora", sheet 13 on a file() miss
for docs/.vitepress/vite.config.ts. THE RENAME IS A HALF-RENAME, and that is the
trap to remember: the DIRECTORY is www/lit-ui-router.dev/, but at 185d414 the
package is still NAMED docs, so every turbo task id (docs#build and its twelve
siblings) and the census-city member name stay "docs" — only PATHS move. Sheet 7
massed member №10 at the new path and its shopfront lettering follows it, sheet
13 re-addressed the city's most-weathered wall (the rename chain is followed
backwards, so its first date and touch count carry across the move), sheet 3's
district lettering reads apps/ + www/, and sheet 9's probe note names
www/lit-ui-router.dev/dist. Sheet 9 keeps the lost district as a VACANT LOT on
the plan, drawn in plate 3B's phantom-plot idiom (faint hatch under a dashed
outline, its own key row) with a leader from the callout — a skyline that loses
its landmark should show where it stood. Two compositions moved on their own
again, both on 3B: the examples plain grew 31,477 → 31,866 watched files and its
south vertex finally crossed the art edge into the schedule band, so the art
region is 70px deeper and the plain's own lettering sits beneath the vertex; and
the Inter callout on sheet 9 was found running 5px off the frame and is now
right-aligned to it. Revs: 9→G, 3B→H, 7→F, 13→F, 3→H, city-scene→E.
Screenshot-verified on 9, 7, 3B and the city at 3008, 1440 and 390.
WIDESCREEN — CONTAIN, AND THE MODEL AS A PEER 2026-09-07: user-asked, on a
3008px display ("with the full size drawings on the plates now it looks awesome
on widescreen. if anything too big — maybe contain instead of cover ... the
isometric city interactive by comparison is tiny"). The flat set's plates
already CONTAIN — .plate's --plate-cap spends min(84vh, 1400px) through
max-width × the plate's own --plate-ar, because an inline SVG letterboxes under
max-height instead of shrinking. Two things had not been brought over. The
cover's key image was still capped by max-height: min(72vh, 820px) inside a
full-width frame, so it letterboxed; it now takes the same formula against the
--plate-ar emit-app already stamps on it (heroPlate), and the prerender and the
client shell both read that one manifest.cover.hero, so they move together. And
the three.js stage was a fixed 620px band next to 1400px plates; .cs-canvas is
now clamp(520px, 80vh, 1400px), with the mobile rule clamp(420px, 62vh, 620px) —
the renderer already reads stage.clientHeight and has a ResizeObserver, so
nothing else changed.
DOGFOOD — THE ATLAS AS A lit-ui-router APP, 2026-09-04: user-asked ("ready for
some dogfooding, it's past time"). diagrams/app/ is the whole set as one
routed SPA, shaped like examples/helloworld — plain npm, its own lockfile,
every dependency from the published registry (lit-ui-router 1.11.2,
ui-router-server 0.1.1, the nav plugin 0.3.0), no workspace links. Nothing is
transcribed: emit-app.mjs is one new generator seam (one hook line in
build.mjs) that cuts each built sheet into a chrome-less fragment, writes the
sheets' own CSS and a manifest (title, rev, plates read, cross-sheet refs
found in the prose, rewritten to real hrefs), and stage-site.mjs lifts the
app's dist to /app/ on the site. Two layers, kept apart on purpose: BASE
(src/*.ts) is exemplary, boring lit-ui-router — a route table as data shared
with the server, an abstract shell with the rail and a nested ui-view,
uiSref/uiSrefActive, resolves, redirectTo for /office, a url-less notFound as
the otherwise projection — liftable into examples/ as-is; EXPERIMENTAL
(src/experimental/) is one import in main.ts — slideshow view transitions
between sheets (onBefore snapshot, released on transition.promise + two
frames because no hook says "the view re-rendered"), arrow keys, and a
megacanvas reel that pans to ?at=. Server side: ui-router-server is a verdict
engine, not a renderer, and used as the decider it was excellent — one route
table drove dev, preview and a build-time prerender (24 pages, _redirects,
404.html) identically; @lit-labs/ssr drew the bytes, but only for a SECOND
template set with plain hrefs, because uiSref is an element-part directive
that SSRs to a dead link (#564, symptom named) and <ui-view> throws on
construction under the DOM shim (ui-view.ts:89 field initialiser). Four
consumer findings and eight package-level asks are in app/SSR-VERDICT.md; the
top two are an SSR-safe <ui-view> and the planned srefHref attribute
directive (#689), which would collapse the two template sets into one.
Verified on the atlas branch itself: build, tsc, oxlint, an 11-check
playwright pass (rail, arrows, xrefs, both cytoscape plates booting inside a
view, /office 302, /sheet/99 an honest 404, megacanvas pan, theme). Known
nit: the rail's background stops at content height on the tall megacanvas.
ROOT MOVE + LIVE-SITE QA 2026-09-05: user-asked — the app "takes over the
homepage" and the flat set is "preserved as an alternative version to compare
against". The app now owns the site root (/, /sheet/7, /megacanvas?at=7,
/about, /office); the flat set is staged under /set/ (gallery doubled as
/set/index.html, vendor/ beside it); app and set link to each other (rail THE
FLAT SET, each crumb's STANDALONE PLATE via a new `standalone` manifest field
threaded from build.mjs's fname(); the gallery cover's THE ROUTED SET). ONE
base constant: app/src/routes.ts MOUNT/BASE/SET + an `href` table both
template sets read; vite `base`, `<base href>` (%BASE_URL%), emit-app.mjs and
stage-site.mjs import it (node strips the types). stage-site.mjs rewritten:
dist/ = app/dist, dist/set/ = the flat pages, one merged _redirects (the
prerender's 7 lines + 24 old filenames → /set/ + /app, /app/* → /:splat),
GA tagging = routed for everything outside /set/. A Playwright pass against
the LIVE site had found the app broken in two critical ways and four lesser,
all fixed in the layer that owned each: (1) CRITICAL — Pages 308s /sheet/2A
onto /sheet/2A/ and core's default strictMode rejected the slash, so EVERY
deep link booted into notFound; strictMode(false) in router.ts and `config:
{ strict: false }` on the server mount, preview now agrees with live (and
serves the prerendered file). (2) CRITICAL — no client-side navigation: the
nav plugin calls navigation.navigate() but registers no `navigate`
interceptor, so every click was a document load; the sample app wires one,
so the interceptor now lives in router.ts (base layer) and SSR-VERDICT ask 9
says the plugin should do it by default. (3) HIGH — view transitions froze
the page ~4 s: the release waited two rAFs, which never fire under a held
snapshot; released on lit's updateComplete instead (new
experimental/view-rendered.ts) — `ready` resolves in ~15 ms, animations run.
(4) MEDIUM — document.title never changed on client navigation; new
src/titles.ts is shared by prerender.ts and an onSuccess hook. (5) LOW —
/sheet/2a rendered 2A with no rail item active; the cased id is canonical:
onBefore redirect in the browser, a redirect rule on the mount, a _redirects
line from the prerender. (6) LOW — html[data-atlas-dir] lingered; cleared on
`finished` and on the fallback's animationend. (7) ←/→ now move focus to the
arriving sheet's title. Plus one found while fixing: megacanvas-pan polled
the DOM by frame and panned the OUTGOING sheet's plate; it uses viewRendered()
too. Verified against a Pages-mimicking static server (308 to the slash,
404.html at 404, _redirects honoured): 20 cold loads clean; nav pass 28/28 in
light, 28/28 in dark, 25/25 under the pushState fallback; tsc + oxlint clean.
Not touched, on purpose: the prerender-flash takeover, Cloudflare's
email-decode console error (a zone setting), sheet 14's 640 px SVG on mobile.
ARTIFACT BUILD 2026-09-05: `npm run build:artifact` in diagrams/app emits
dist-artifact/index.html — the whole routed atlas as ONE 1,805,904-byte file
publishable as a claude.ai Artifact. vite mode `artifact` +
vite-plugin-singlefile 2.3.3 (useRecommendedBuildConfig, which on vite 8 sets
output.codeSplitting=false and so folds the cytoscape dynamic import into the
one chunk), then artifact.ts strips the doctype/html/head/body the host
supplies, hoists <title> to byte 0 (only the first 8KB is scanned), inlines
sheets/atlas.css, and bakes the manifest + all 22 fragments into a
`<script type="application/json" id="atlas-data">` island (every `<` →
`\u003c`). Nothing is fetched at runtime; the router takes hashLocationPlugin
(#/sheet/7), analytics is off, and the two links out to the flat set point at
the live site in a new tab. src/mode.ts is the one flag; the site build is
byte-for-byte unchanged (still 25 pages + 404.html + 7 redirects). Verified
in headless Chromium against a harness that mimics the host — the file
wrapped in a doctype skeleton at a nested path with EVERY other request
aborted — 17/17: cover, #/sheet/2A deep link with the rail active, rail walk
7→8→7A with no reload, back/forward, cytoscape on 1i/2B/12i, #/megacanvas?at=7
panning, #/office → 14, #/sheet/99 notFound with the url kept, both themes
from data-theme on the root, zero page errors, zero aborted requests.
THE CITY AS A STATE; THE REEL RETIRED FROM THE APP, 2026-09-05: user-asked
("did we lose the isometric city? ... i am excited to see it as a state with
deps loaded on demand"). The I8 three.js scene was gallery-only — a section in
generator/city-scene.mjs, never a sheet — so the routed app never had it. It is
now `atlas.city` at `/city`, the app's ONE dependency-on-demand state:
`resolve: [{ token: 'three', resolveFn: () => import('three') }]` gives the
library its own vite chunk (three.module-*.js, 675 kB / 172 kB gz) and the
router is the loader — a Playwright request log confirms /sheet/7/ never
fetches it and /city/ does. NOT a new sheet number and not renumbering
anything: the manifest grew an `extras` array beside `sheets`, so the ascent
order, the ←/→ walk and the server's narrowed /sheet/{num:…} cannot see it;
it gets a rail entry (S7·3D THE CITY — IN THE ROUND), a cover card and a
STANDALONE PLATE crumb to the flat gallery's own anchor
(/set/gallery.html#city-scene). city-scene.mjs was refactored into ONE hostless
scene body with named `$$SLOT`s: the gallery fills every slot with the empty
string (its inline module is byte-for-byte identical, diffed before/after) and
emit-app.mjs fills them to write app/src/generated/city-init.js — an ES module
`initCity(root, THREE)` returning a dispose, because the app's runScripts()
cannot run an inserted <script type="module"> and the import had to be bundled
rather than cdnjs. TEARDOWN LIVES IN THE ELEMENT, not a router hook: the scene
holds a WebGL context, a ResizeObserver, a MutationObserver on <html>, a
colour-scheme listener and pending frames; the experimental layer is deletable
by design and this is not optional, so <atlas-city> disposes in
disconnectedCallback and raises in updated() off the plate's own
updateComplete (the same promise view-rendered.ts chains, owned locally so
src/*.ts still imports nothing from src/experimental/). MEGACANVAS REMOVED FROM
THE APP in the same sitting (user: "let's remove the megacanvas from the app for
now"): state, view, rail entry, prerender job, title, experimental/
megacanvas-pan.ts, the NO_SLIDESHOW special-case and the .mega-* CSS are gone;
the flat page stays and /megacanvas + /megacanvas/ 301 to /set/megacanvas.html.
ANALYTICS RE-CUT the same day, because the flagship stream keeps enhanced
measurement's history-event page_view ON: stage-site.mjs now writes one plain
gtag('config', id) on every staged page (the send_page_view:false special case
is gone — gtag owns the initial view and every pushState/popstate), and
analytics.ts sends ONLY what gtag cannot see, the Navigation API plugin's own
navigate() pushes: it reads a NAVIGATION_API flag exported from router.ts,
listens on `navigation` a second time purely to record navigationType, and
fires for push/replace alone — traverse is popstate and gtag's, the fallback
sends nothing. Verified: build 22 sheets / 23 fragments, tsc clean, oxlint
clean (sheet3a's known finding aside), prerender 25 pages + 404 · 9 redirects,
artifact 2,526,903 bytes with 23 fragments and three inlined (17/17 offline
checks); against the Pages-mimicking server 16/16 city checks (cold WebGL
canvas, drag-orbit, diagonal snap, TEST LIGHT, theme re-render, dispose on
leave with rAF scheduling → 0, re-init on return with no re-fetch, both
megacanvas 301s), 27/27 nav in light and dark, 24/24 under the pushState
fallback, 21 cold loads with zero page errors, and 6/6 analytics counts
(1 router page_view per click, 0 on back, 0/0 under the fallback).
PARITY WITH THE FLAT SET, 2026-09-05: user-asked — "really want to make sure
all the content from the flat set makes it into the lit ui router app" and "the
interactive survey office is missing too — you only grabbed sheets". An audit
found the 22 plates byte-for-byte but the whole COVER missing and one lane
absent. (1) S14i — THE SURVEY OFFICE — INTERACTIVE is now a sheet like any
other: pipeline-graph.mjs exports a `sheet14i` meta (num 14i, scale THE CENSUS
PIPELINE, form INTERACTIVE GRAPH, rev A) whose `sub` and `caption` ARE the
section's own strings, so the flat gallery bytes are unchanged; build.mjs
writes it a standalone page (sheet-14i-the-survey-office-interactive.html) the
way 1i/2B/12i have one, emit-app.mjs maps it to pipeline-graph.mjs in MODULE
and passes it in the fourth `interactive` lane. It needed NO app change beyond
the manifest row: bySheet puts it after 14 exactly as 12i sits after 12, and
the rail, the cover card, /sheet/14i, the narrowed server mount, the ←/→ walk,
the prerendered page and the STANDALONE PLATE crumb all fell out of the
existing sheet machinery. The flat index row still links #pipeline-graph.
(2) THE COVER IS NOW ONE SOURCE, not two. build.mjs's gallery cover was
extracted into named constants — statBar, survey, galBody, provenance — and
galCss split into a `surveyCss`/`provenanceCss` half the app reuses and a
`.cover`/`.idx` half the gallery keeps; all of it rides manifest.json as a
`cover` object of RENDERED HTML strings that GalleryView/AboutView insert with
unsafeHTML. So the routed index draws the flat cover's own bytes: the 5-cell
stat bar, the GENERAL SURVEY block (totals, the per-language table, the basis
paragraph), the three-paragraph prose column, and — in AboutView — the
colophon line including DRAWN BY FABLE (CLAUDE, AI) FOR SHANE DANIEL, plus the
README's thesis sentence and generator notes, shared with the README template
through THESIS/GEN_NOTES and an mdLine() markdown-to-HTML one-liner. TRAP: lit
cannot bind inside <style>, so the cover CSS goes in as
unsafeHTML(`<style>…</style>`) — a plain `<style>${...}</style>` template
throws "Unexpected final partIndex" in @lit-labs/ssr and is an invalid
location in the browser too. (3) THE INDEX TABLE IS CANONICAL. The gallery's
24 FIT VERDICT rows (including the four that were inline markup) are one
ordered `verdicts` array with optional anchor/label columns; emitApp() maps it
onto every manifest row as `verdict` + `scale`, so the ALTITUDE wording the
index prints is what the app's cards and each sheet's crumb now show, and the
altitude that was emitted-but-never-rendered finally draws. Plate counts derive
from a `lanes` array rather than a typed +3. FLAT-SET REGRESSION CHECK: after
build.mjs the only diffs are S14i's own — README (22→23 plates, "four
interactive lanes", the 14i table row), megacanvas (the lane list), gallery
(the stat bar's plate count) — and no sheet-*.html moved at all. Verified:
build 23 sheets / 24 fragments, tsc clean, oxlint clean (sheet3a's known
finding aside), prerender 26 pages + 404 · 9 redirects, stage-site 26 routed +
26 flat, artifact 2,638,142 bytes / 24 fragments with 21/21 offline checks
(cover survey + verdicts, #/sheet/14i cytoscape, #/about colophon); against the
Pages-mimicking server 39/39 nav in light and dark and 36/36 under the
pushState fallback (rail 14 → 14i → 13, TOOLS LEDGER + FIT, cover stat bar /
survey / 3 prose paragraphs / 24 verdicts / 24 altitudes, About colophon), and
23 cold loads with zero page errors — /sheet/14i and /sheet/14i/ both boot
cytoscape from cold.

THE TYPE SPECIMEN, 2026-09-05: user-asked — a bench to compare candidate
typefaces on the live site (where Adobe Fonts load) and in the artifact (where
only Google Fonts do). New state `atlas.specimen` at `/specimen`, rail entry
`S0·T THE TYPE SPECIMEN — FIVE PAIRINGS` at the bottom of the same section as
THE CITY; no sheet number, not in the manifest, so the ascent order, the ←/→
walk and the narrowed `/sheet/{num:…}` mount are all untouched. `<atlas-specimen>`
(`app/src/specimen.ts` + `specimen-mock.ts`) draws ONE mock sheet ported from
the design researcher's specimen — rail as index tabs, crumb strip, a callout
with a leader, a schedule with tabular figures, a title block with a square red
chop, and a REV TABLE — and swaps the four role tokens (`--display`, `--hand`,
`--data`, `--code`) on the mock's root by INLINE STYLE. Pairings: 0 baseline
(today's mono), 1 Prairie, 2 Drafting (Zilla Slab), 3 Signage, 4 THE KIT (the
two families the Adobe kit actually serves today). Three extra knobs: a data
WIDTH toggle (Barlow Semi Condensed ↔ plain Barlow — "i like the barlow"), a
data SIZE stepper, and the HAND as its own control with **NONE as the default**
("i swear i'm just allergic to these hand types. maybe in situ i'll
appreciate") — NONE puts the two hand slots in the data face. The hand is
limited to the DRAWN BY value and ONE callout second line, never the REV
descriptions or the figcaption; the COUNTED stamp is square and UNROTATED.

FONT LOADING, PER HOST. `connectedCallback` injects the Google Fonts `<link>`
(+ two preconnects) once, so the faces are fetched by THIS STATE and by no
other page — verified: `/sheet/7/` and `/` make zero font requests. The element
module is itself a `resolve` (`import('./specimen.ts')`), so it is its own
35.8 KB chunk. On the site `stage-site.mjs` injects
`https://use.typekit.net/$VITE_ADOBE_FONTS_KIT.css` into
`dist/specimen/index.html` ALONE when the variable is set (it lives beside the
GA id in the gitignored `.config/mise/cloudflare.local.env`); unset it logs
`Adobe Fonts kit: none` and emits nothing. Every stack names the Adobe family
first and the Google stand-in second, so one `<link>` is the whole difference
between the two hosts.

TWO READOUTS, both live. LOADED FACES says ADOBE / STAND-IN / SYSTEM per role.
**TRAP: `document.fonts.check('12px "no-such-face"')` returns TRUE** — the spec
asks "can this be rendered", and an undeclared family renders fine by fallback,
so every PENDING Adobe family reported ADOBE until the readout was made to ask
the FontFaceSet whether the family was DECLARED at all before trusting
`check()`. GLYPH SIZE measures cap-height and x-height as INK
(`measureText().actualBoundingBoxAscent` — a span's rect only ever returns the
em box) and the average advance from a hidden span's
`getBoundingClientRect().width` over an 87-char sample, against the mono the
face would replace. That measurement moved the default data size from 12px to
**11px**: at 12px Barlow Semi Condensed ran cap +9.7% over the mono; at 11px it
is +0.6%, with advance −28.3% (the condensed face buying line length back,
which is the point). Two tokens added to `chrome.mjs` for it — `--pencil`
(#7B8078 / #7E97B8) and `--cherokee` (#9E3A2B / #E0705A) — used ONLY by the
specimen; no existing chrome or plate was restyled.

SIX KNOBS, NOT FIVE PRESETS (user feedback on the live bench, same day):
"really liking din"; Eaglefeather on THE ALTITUDE ATLAS "looks great" but "not
huge-ist fan of measured city with the s" — "maybe if the sidebar nav matched";
"liked josephine [Josefin] quite a bit actually but for the title"; and "i want
to see univers and myriad still don't think i've seen the option yet". So a
pairing became a STARTING POINT rather than a cage: picking one resets the knobs
it owns, and each knob then overrides it. (1) `--title` split off `--display`:
the rail head keeps the pairing's display face, the SHEET title and the title
block's PROJECT / SHEET TITLE values get their own knob — SAME AS DISPLAY /
JOSEFIN SANS 600 / DIN 2014 700 / EAGLEFEATHER SC / FLW EXHIBITION, sized 23–24px
so the cap-height stays near the mono's 16.8 ink at 23px. (2) `--rail-title`: the
rail's entry TITLES (never its numbers, which stay tabular data) take the data
face by default or match the sheet title on request. (3) the DATA FACE toggle
became a seven-way chooser — DIN 2014 / BARLOW / UNIVERS NEXT PRO / UNIVERS NEXT
COND. / MYRIAD PRO / MYRIAD SEMI-COND. / SYSTEM MONO — because Myriad was wired
to nothing and Univers only appeared under Signage. (4) `--prose`: the General
Notes paragraph and the figcaption body, CHARTER STACK (default, 0 bytes) /
SOURCE SERIF 4 / MINION PRO / CHARIS SIL, whose Google families are appended as a
SECOND `<link>` only when chosen, so the default payload does not grow. All four
get a LOADED FACES row, and the readout is now seven roles.

TRAP, and a real bug the knobs exposed: a webfont is only DOWNLOADED when
something uses it, so the first LOADED FACES pass after a knob click reads
SYSTEM for a face the browser has not fetched yet — and stayed wrong for ever.
`#report()` now chains `updateComplete` (the mock is painted in the new stacks,
which starts the fetch) then `document.fonts.ready` (it has settled) for one
deferred second pass. Also: `title` is taken by `HTMLElement`, so the reactive
property is `sheetTitle`; and `getComputedStyle` drops the quotes on
single-word families, which a QA regex has to allow for.

ADOBE KIT NAMES ARE NOT THE MARKETING NAMES. Read off the completed kit
(`use.typekit.net/nzw4jnc.css`, 17 families): `p22-fllw-eaglefeather` — THREE
l's, plus `-sc` and `-inf` — but `p22-flw-exhibition` with TWO, the same kit
spelling the Wright abbreviation both ways; `din-2014` + `din-2014-narrow`;
`tekton-pro` + `-condensed` / `-extended`; `univers-next-pro` + `-condensed` /
`-compressed` / `-extended`; `myriad-pro` + `-semi-condensed` / `-cond` /
`-light-semiext`. Every Univers, Myriad and Tekton family carries `-pro`.
Measured latin-subset woff2 (Regular/Bold KB) now rides the table as its own
column: din-2014 15/16, p22-fllw-eaglefeather 32/29, tekton-pro 46/45,
univers-next-pro 27/28, myriad-pro 27/27. `minion-pro` is NOT in the kit and
falls to Source Serif 4. The kit serves 400 and 700 (one 500), so
where the plan said Demi/600 the CSS asks for **600 and gets 700 from Adobe,
600 from Google** — CSS font matching resolves a 600 request upward when only
400/700 exist, so ONE weight number serves both hosts with nothing synthesised.
Six memo families (`graphite-std`, the three other P22 FLW faces, `isonorm`,
`din-condensed`) are NOT in the kit; the table marks them so, and they cost
nothing — the stack falls to the stand-in and the readout says STAND-IN.

Verified: build 23 sheets / 24 fragments, tsc clean, prerender **27 pages** +
404 · 9 redirects, stage 27 routed + 26 flat with the kit link on
`/specimen/index.html` and nowhere else (unset → `Adobe Fonts kit: none`, zero
pages carry it), artifact 2,685,109 bytes / 24 fragments. Playwright against
the Pages-mimicking server: **65/65** — cold `/specimen/` with 0 page errors,
all five pairings change the mock title's computed `font-family`, all five
sheet-title options drive the title AND the title block while leaving the rail
head alone, MATCH SHEET TITLE moves the rail's entry titles but not its numbers,
all seven data faces drive the schedule and a pairing click resets the chooser
to its own default, all four prose faces drive the notes and the figcaption with
the extra stylesheet appended only on demand, all three hand options change only
the hand slot, both readouts render, the rail entry is active, the rail click
reaches `/specimen` with no document reload, `/sheet/7/` and `/` fetch no
webfont at all, and both themes resolve `--pencil` / `--cherokee` with no
errors. With the kit staged, EVERY Adobe-backed role
reports ADOBE in Prairie, Drafting, Signage and The Kit — the two expected
non-ADOBE cells are `--code` (the system monospace, by design) and Drafting's
`--display` (Zilla Slab, an open face with no Adobe counterpart). Measured at
11px against the mono's 7.65 ink cap: `din-2014` −0.8%, `univers-next-pro`
+3.9%, `univers-next-pro-condensed` +3.9%, Barlow Semi Condensed +0.6%.
Offline artifact check at `#/specimen`: **9/9** — the Google link is the only
origin asked for, no typekit link exists in the file, and every role falls back
to SYSTEM with the readouts still drawing. Regressions clean: `artifact-qa`
zero blocked requests, `r-qa-city` 16/16. The 24 flat-set HTML diffs are the
two new token declarations and nothing else. Left undone: the specimen
restyles nothing outside itself — adopting a pairing across the chrome and the
plates is the next, separate decision.

THE TYPE ADOPTED, 2026-09-06: the decision, taken on the specimen the evening
before, applied to the whole chrome — "title + sidebar as exhibition my
favorite. eaglefeather still top for the altitude atlas title; maybe can reuse
elsewhere for some contrast. eg project === eaglefeather always; maybe drawn by
== eaglefeather? … definitely think we should go with source serif for prose.
think din takes it." `generator/chrome.mjs` now declares FIVE role tokens, each
naming the Adobe family first and the Google stand-in second: `--display`
(P22 FLLW Eaglefeather / Josefin Sans 600 — the atlas name only: rail head,
cover title, the title block's PROJECT and DRAWN BY values), `--title` (P22 FLW
Exhibition / Josefin Sans — sheet titles, rail entry titles, card and prose
headings, the title block's SHEET TITLE), `--data` (DIN 2014 / Barlow Semi
Condensed, tabular figures — kickers, sheet heads, crumbs, rail numbers,
schedules, title block, stat bars, index and language tables), `--prose`
(Source Serif 4, the SAME family on both hosts, so the prose needs no kit) and
`--code` (the system mono, unchanged — and every SVG label on every plate,
whose positions are hand-tuned to its advance; the plates are NOT part of this
change). `--serif` survives as an alias of `--prose`. Sizes step up by half a
pixel where the data face replaces the mono, because 11px of DIN carries the
same cap-height as the 10.5px mono it replaces (the specimen's GLYPH SIZE
readout, within 1%) — "conservative choices with roughly equivalent glyph
sizes". The hand face is NOT adopted anywhere ("i swear i'm just allergic to
these hand types"), and the title block's chop is a plain unrotated square in
the Cherokee red ("the jaunty stamp angle is meh … for now rather have order").

Two structural changes rode along. The REV history — up to six revisions
run together in `.sheet-sub` under every title — is split out: `splitRevs()`
cuts each sheet's FROZEN `sub` string on the ` · REV ` seam it already uses,
so not a character is retyped, and `revBlock()` files the tail under the title
block as a drawing's REVISIONS table (REV / DATE / DESCRIPTION), on the flat
pages, the routed sheets and the city plate alike. And the routed sheet's crumb
strip now states its one fact in bold — SHEET N OF 23 — between INDEX and the
PREV/NEXT links, with the rail narrowed from 268px to 220px, which the
condensed data face affords.

The webfonts: `app/index.html` carries ONE Google Fonts link (Josefin Sans 600,
Barlow Semi Condensed 400/600, Source Serif 4 400 + italic) — the stand-in half,
and the only half the artifact can have. `generator/stage-site.mjs` now writes
the same link into every head-less flat page and the Adobe kit link into EVERY
staged page, routed and flat (before: the specimen page alone), so on the site
the first names win everywhere and in the artifact the second names do. The
specimen gained pairing `5 · THE ATLAS SET` as its DEFAULT — the bench opens on
what ships, the other five rows are the record of what it was chosen against —
and a CODE knob (SYSTEM MONO shipped / SOURCE CODE PRO on demand) with a
`--code` row in GLYPH SIZE measured at the baseline size, answering "would the
plate lettering move": Source Code Pro's 0.600em advance is within 0.3% of
Menlo's, so it would not — and the system mono still ships, at zero bytes.

Verified: build 23 sheets / 24 fragments, tsc clean, prerender **27 pages** + 404 ·
9 redirects, stage 28 routed + 26 flat with the Google link and the kit link on
every one, artifact 2,709,834 bytes / 24 fragments. Playwright against the
Pages-mimicking server, light and dark: a new `r-qa-type` suite **124/124** —
every role element on the cover, three routed sheets, the city, the specimen,
About, the flat cover, flat sheet 7 and the megacanvas resolves to its decided
family (`p22-fllw-eaglefeather` on the rail head and the title block's PROJECT
/ DRAWN BY, `p22-flw-exhibition` on sheet, rail and card titles, `din-2014` on
every kicker, crumb, schedule and table cell, Source Serif 4 on the running
text), every sampled plate label still resolves to the system mono, the
REVISIONS table stands on every sheet that has a history with no
`.sheet-sub` still carrying ` · REV `, the chop is unrotated, the crumb states
SHEET N OF 14, no page scrolls sideways, and every rail entry fits the 240px
rail (one, `14i THE SURVEY OFFICE — INTERACTIVE`, wraps to two lines as it did
at 268px). Regressions clean: cold 23 loads with 0 page errors, nav **39/39**,
city **16/16**, GA **6/6**, specimen **65/65** (two assertions retired: the
GLYPH SIZE table has five rows now, and `/sheet/7/` and `/` DO fetch webfonts —
the shipped set and never a candidate), offline artifact **21/21** with the
Google origin the one thing asked for, specimen-in-artifact **9/9**. With the
kit staged, `document.fonts` on `/sheet/7/` loads `p22-fllw-eaglefeather`,
`p22-flw-exhibition`, `din-2014` and Source Serif 4; the specimen's own readout
says ADOBE / ADOBE / ADOBE / STAND-IN (the prose, by design) / SYSTEM (the
code). Font bytes on `/sheet/7/`: **185 KB** in 10 responses — 135 KB from the
kit (50 KB of which is `nzw4jnc.css` itself, declaring all 22 kit families for
the three the set uses: trimming the web project is the cheapest win left) and
54 KB of Source Serif 4 from Google; the flat sheet 7 costs 174 KB. Two fixes
the QA earned: sheet 11's 90-character recipe chip ran 12px off the flat cover
and the megacanvas once the prose stepped up, so note chips now
`overflow-wrap: anywhere` instead of `nowrap`; and the rail widened from the
first cut's 220px to 240px, which clears `1i` and `S7·3D`. Known and accepted:
Eaglefeather's terminal S reads as a slash at rail size ("not huge-ist fan of
measured city with the s" — the title kept it anyway); sheet 14i has never had
a title block, so it has no chop and no revisions table; REV B on sheets whose
frozen sub carried no date shows an em-dash in the DATE column. Left undone:
the kit still declares every candidate family — the user trims it to
Eaglefeather, Exhibition and DIN 2014, and the specimen's ADOBE FONTS table
then wants its `kit` flags re-read; the plates' own lettering is untouched by
decision.

SINGLE HOST ON THE SITE, 2026-09-06: the production site must load web fonts
from ONE origin. The kit is that origin, so the prose moved onto it — the kit
already declares `source-serif-pro` in all four faces the prose needs (400,
700, 400 italic, 700 italic), so nothing was worked around.
`generator/chrome.mjs` `--prose` now reads `"source-serif-pro", "Source Serif
4", "Charter", …`; `generator/stage-site.mjs`, when `VITE_ADOBE_FONTS_KIT` is
set, STRIPS the three Google Fonts links `app/index.html` carries from every
staged page as it injects the kit link (unset, it behaves exactly as before and
the Google half draws everywhere). `app/index.html`'s own links are unchanged —
the claude.ai ARTIFACT keeps Google Fonts, because that host allows
`fonts.googleapis.com` and nothing else, and there the prose is Source Serif 4.
One Slimbach design, two releases, one host per page. `app/src/specimen.ts`
followed: the `source-serif` knob and the ADOBE FONTS table name
`source-serif-pro` (`kit: true`, as does `source-code-pro` — both were flagged
`kit: false` and both are in fact declared in the kit CSS), and the bench no
longer injects its candidate stand-ins on `connectedCallback` — it waits for
the FIRST KNOB TOUCH, so a staged `/specimen/` visit that touches nothing asks
nothing of Google either. LOADED FACES on the site therefore reads ADOBE ×4
(eaglefeather, exhibition, din-2014, source-serif-pro) with `--code` SYSTEM by
design.

Verify: `curl -L https://atlas.lit-ui-router.dev/sheet/7/ | grep -c googleapis`
→ 0 (same for `/`, `/specimen/` and any `/set/*.html`), and the same page shows
one `use.typekit.net` link; the artifact still carries the Google links and no
kit link (`grep -c fonts.googleapis app/dist-artifact/index.html` ≥ 1).

THE CODE AND THE HAND, 2026-09-06: the two roles the type pass left on the
bench are adopted, and the kit is trimmed to what the set actually uses.
**`--code` is Source Code Pro on BOTH hosts** — `"source-code-pro", "Source
Code Pro", var(--mono)` in `generator/chrome.mjs`, so the kit serves it on the
site and the same Slimbach design comes from Google in the artifact, at the
kit's own 400/700 so bold resolves identically either side. `--mono` is
UNCHANGED and the plates are untouched: every SVG label is still hand-placed
against the system mono's advance, which the specimen had already priced at a
0.3% difference. One rule rode along — `code, kbd, samp { font-family:
var(--code) }` — because the cover's and the city's chips sat outside `.notes p
code` and were drawing in the browser's own default monospace. **`--hand` is
P22 FLLW Eaglefeather Informal, MIXED CASE, on the title block's DRAWN BY value
and nothing else** ("maybe in situ i'll appreciate" — it does): `titleBlock()`
now writes `<span class="hand">Fable (Claude, AI)</span>` in place of the
tracked-caps `.dsp`, at 16px, where the neighbouring values sit. The hand names
NO Google stand-in by decision — `--hand: "p22-fllw-eaglefeather-inf",
var(--data)` — so off the kit the slot is simply the data face and the artifact
loads nothing new for it. The Google link in all three places it is declared
(`app/index.html`, `generator/stage-site.mjs`, `specimen.ts`'s
`GOOGLE_FONTS_HREF` — via index.html, since the code face ships) gained
`Source+Code+Pro:wght@400;700`.

The kit was TRIMMED in Adobe the same day: `use.typekit.net/nzw4jnc.css` is
**18 KB declaring 8 families** where it was 50 KB declaring 19 — din-2014 (4
faces), din-2014-narrow (2), p22-fllw-eaglefeather (4),
p22-fllw-eaglefeather-inf (2), p22-fllw-eaglefeather-sc (2), p22-flw-exhibition
(2), source-code-pro (4), source-serif-pro (4). `specimen.ts`'s ADOBE FONTS
table was re-read against it: eleven rows flipped to `kit: false` (every Univers
Next, Tekton and Myriad), and the eight that remain `true` are exactly the
declared list. The specimen followed the decision too: `EAGLEFEATHER INF.` is a
new HAND row and pairing 5's `handDefault`, `SOURCE CODE PRO` is its
`codeDefault` and no longer fetches anything, and LOADED FACES now reads ADOBE
on ALL SEVEN role rows — six distinct families — where it read four.

Verified: build 23 sheets / 24 fragments, tsc clean, prerender 27 pages + 404,
stage 28 routed + 26 flat, artifact 2,713,442 bytes. Playwright against the
Pages-mimicking server, light and dark: `r-qa-type` **226/226** (up from 124 —
the DRAWN BY value's family, text and lack of a transform are checked on every
page that has a title block, and the code role now expects source-code-pro
first), `r-qa-specimen` **69/69**, `artifact-qa` **22/22**,
`r-qa-specimen-artifact` **10/10**. No page scrolls sideways — `/set/`, the
megacanvas, `/sheet/11/` and flat sheet 11 with its 90-character chip all
measure 1440/1440. Font bytes on `/sheet/7/`: **309 KB** in 12 responses, up
from 281 KB — the trimmed kit CSS gave back 32 KB and the two new faces
(eaglefeather-inf 400 at 37 KB, source-code-pro 400 at 24 KB) spent 61 KB. Flat
sheet 7 costs 298 KB.

Verify: `grep -c source-code-pro dist/set/sheet-7-the-measured-city.html` → 2
(the token and the `--code` declaration in `atlas.css`'s inlined head), and the
DRAWN BY value reads `Fable (Claude, AI)` — mixed case, `text-transform: none`,
computed family leading `p22-fllw-eaglefeather-inf` on the site.

THE PLATES IN DIN, 2026-09-06: "still seems like there's a lot of monospace —
make sure we're choosing appropriate choices from data or title font; reserve
monospace." The HTML chrome was already on the roles; the mono the user was
seeing was the SVG plate lettering. **The seven `text.lbl*` rules in
`generator/chrome.mjs` now draw in `var(--data)`** with `font-variant-numeric:
tabular-nums`, sizes, weights, fills and tracking untouched — 1,983 labels
across the set, 128 of them on sheet 7. Measured against DIN before the swap:
a strict contraction, median −26%, nothing growing beyond +0.6% on a
single-letter road tag, and since every label is start- or end-anchored the
lettering only opens air. The interactive lanes followed the same rule —
legends, controls, notes and basis lines in `city-scene`, `coupling-bench`,
`register-graph`, `pipeline-graph` and `loop-walk` (and the cytoscape node and
edge label faces, now read from the `--data` token through each `pal()`, and
the city's canvas ground lettering and number chips) are the data face; the
four `*-info h4` panels, where the whole label is one bare identifier, and
`.lw-info .ev pre` are the code face. `specimen-mock.ts`'s `.sp-note`,
`.sp-read h3`, `.sp-tbl` and `.sp-foot` moved to `--data` as well; the knob
machinery was left alone. `--mono` is still declared and is now read by
nothing but the tail of `--code`.

**The schedule gutter.** Row numbers were padded with `padStart(2, ' ')`
against the mono advance, which DIN does not have. A new
`helpers.mjs::schedTxt` emits the number as its own end-anchored `<text>` in a
14px gutter and the row body as a second `<text>` 25px in, and the eight
`schedRow` helpers (sheets 3, 3B, 4, 7, 7A, 7B ×2, 13) return `[n, body]`
instead of a padded string. Measured on sheet 7: the body's left edge moved
+0.26px, and rows 1–9 line up with 10–32 for the first time.

Verified: build 23 sheets / 24 fragments, tsc clean, prerender 27 pages + 404,
stage 28 routed + 26 flat, artifact 2,729,333 bytes. `r-qa-type` **246/246**
(the plates' expectation flipped from mono to the data face, and a new
page-wide check walks every element and SVG text and fails on any whose FIRST
family is mono outside `code, kbd, samp, pre` and the specimen knobs),
`r-qa-specimen` **69/69**, `artifact-qa` **22/22**,
`r-qa-specimen-artifact` **10/10**, no page scrolls sideways. A bbox overlap
probe over all 23 flat sheets, run against HEAD as well: **zero new
overlaps**, and 25 of the 64 pre-existing ones repaired outright (sheet 12
49→36, sheet 10 4→0, 3A 2→0, 3B 2→0, 7B 2→0, 3 1→0, 8 1→0; 14 and 5 unchanged).

What remains is per-sheet recomposition: boxes drawn to a mono line now frame a
shorter one. A probe of every label inside a box that used to sit within 30px
of the box's right edge and now sits more than 30px short names **3A (33
labels), 2A (6), 1 (5), 14 (3), 4 (3), 5 (3), 10 (2), 2 · 7 · 7B · 13 (1
each)** — 3A first, then 2A and 1. Sheets 12, 13 and 14 carry the most
lettering but their boxes already fit.

Verify: `node generator/build.mjs .`, serve `dist/`, and
`node r-qa-type.mjs http://localhost:4319` → 246/246; on any plate,
`getComputedStyle(document.querySelector('svg text.lbls')).fontFamily` leads
with `din-2014` on the site and `Barlow Semi Condensed` in the artifact.

THE NAVIGATION PLUGIN GETS ITS OWN COLUMN, 2026-09-06: "the bowing logic works
but looks a bit off / out of place — cleaner would be to move navigation plugin
to its own column; it doesn't depend on lit anything, legitimately sits closer
to core." Sheet 2B rev B had put all four companions in one column at x=560,
which left `lit-ui-router-mobx → lit-ui-router` running vertically straight
through `ui-router-navigation-location-plugin` standing between them; the fix
was a 120-unit `unbundled-bezier` bow — one curve on a plate of otherwise
straight ties, arcing across the plugin's own name label. **Rev C deletes the
bow and recomposes the bench in four columns**: the two externals stacked at
x=120 (lit at y=−350 over the wall at y=0), the navigation plugin ALONE at
x=400 on the wall's own baseline, the lit companions at x=680 (lit-ui-router
−300, mobx −160, server 200), and the eslint bay at x=900. The middle column is
the argument, not a spacer — the plugin's `package.json` declares
`@uirouter/core ^6.0.8` and nothing else, so it reaches across one column gap
along a straight horizontal run while everything else reaches across two, and
it is banded `A COLUMN OF ITS OWN — CORE ONLY, NO LIT`. With it out of the lit
column nothing stands between mobx and the flagship, so that tie is a plain
vertical. The bow is not kept for anything: `coupling-bench.mjs` now THROWS at
build time if any same-column tie is laid through a third building, so the next
such fault is a build error rather than a curve drawn around it (verified by
temporarily moving the plugin back to x=680 — the build fails).

Two composition repairs rode along. Node labels gained a paper `text-background`
knockout, the way a plan label breaks the line it crosses — rev B's bow struck
through `navigation-location-plugin`, and the new vertical tie would otherwise
have struck through `lit-ui-router`. And the two longest bands (`THE SOCKET
WALL`, `A BAY OF ITS OWN`) moved to a new `halign: 'center'`, lettered squarely
over their node instead of off one shoulder: side-lettered they threw the
drawing's bounding box 390 units wider than the buildings, and cytoscape's
`fit` prices the whole box. Bench bbox 1367×635 → 980×635, ratio 2.15 → 1.54
against a 976×620 stage, so the fitted zoom goes **0.655 → 0.851** and the
whole plate draws 30% larger in the same panel.

Verified: build clean; a cytoscape-geometry probe of the rendered bench reports
**0 tie-through-node hits and 0 edge-label clashes** (the only two box overlaps
are each band's 3px shoulder against its own node's box — text-free in both
cases). The set-wide `text.lbl*` bbox probe re-run over all flat sheets against
the last recorded run: **zero sheets gained overlaps**; sheet 2B itself carries
no SVG labels, so that probe is structurally inert for it and the cytoscape
probe is the evidence. Light and dark both read.

Verify: `node generator/build.mjs .`, open
`sheet-2B-the-coupling-bench.html`, and in the console
`document.getElementById('cb-cy')._cyreg.cy.edges().every((e) =>
e.style('curve-style') === 'bezier')` → `true`, with
`…cy.zoom()` ≈ 0.85.

THE SPRITE STUDY, ROLLED IN AS AN APPENDIX, 2026-09-06: "the sprite study
artifact remains relevant and should be included as a meta appendix in some
form — roll it in." The standalone sprite-studies exploration (the HZD × SC2K ×
Factorio research pinned in the sprite note above, and the thing sheet 7B and
sheet 13 were drawn from) is now **APPENDIX A1 — THE SPRITE STUDY**, a real
plate in the set: `generator/sheetA1.mjs`, a flat page
`sheet-A1-the-sprite-study.html`, an app fragment `app/public/sheets/a1.html`
and the route `/sheet/A1`.

**Filed as an APPENDIX, not as sheet 15.** The numbered sheets are ordered by
altitude and every one cites a census plate; this plate's subject is the atlas's
own drawing convention and it reads no plate at all (`plates: []` in the
manifest — the card says NO CENSUS PLATE — META). So it gets a **letter-first
id**, which is the marker, and its own manifest array. `manifest.appendix` is
the third list beside `sheets` and `extras`, for exactly the reason `extras`
exists: everything that walks the set in ascent order reads `sheets`. The
appendix rides after the city in the rail under `APPENDIX — ABOUT THE ATLAS`,
after the extras on the index under its own `.set-sec` heading, and after the
whole set in the flat gallery and its cover table (a spanning `.idx-sec` row).

**Numeric-id assumptions relaxed, four of them, all minimal.** (1)
`emit-app.mjs::bySheet` parsed every id with `parseInt` and compared the NaNs;
it now sorts a NaN id *after* every numbered one, so a cross-reference list ends
with the appendix instead of landing wherever NaN happened to sort. (2) the
cross-reference scanner's `REF_RE`/`TOKEN_RE` matched `sheets? \d+[A-Za-z]?`
only; the token now allows a LEADING letter and the phrase allows the word
"appendix", so sheet 13's new *see also — appendix A1* paragraph links, and A1's
prose links back to 7, 7B, 8, 10 and 13. `expand()` still filters every token
against the known ids, so a stray "sheet 99" links nothing. (3) `findSheet()`
searches both arrays (new `allSheets()`), and `prerender.ts` feeds BOTH to
`mountsFor()`, so `/sheet/A1` narrows into the server's alternation and
`/sheet/a1` 302s to the cased id like `/sheet/2a`. (4) the ← / → walk (both
`views.ts` and `prerender.ts`) now walks the row's OWN list, so A1 is never
sheet 14's "next"; `sheetTitle()` says *Appendix A1*, and the crumb and the
title block say APPENDIX rather than SHEET A1 OF 14 — `chrome.mjs` reads one new
optional flag, `sheet.appendix`.

**What the plate draws.** One demo member — 16 files · 1,900 sloc, massed under
the house rules (side = 1.6·√1900 ≈ 70, height 3 px/file = 48, the atlas's own
0.866/0.5 projection), so the fifteen blocks could each stand in sheet 7's city
— drawn five times along the wreck-to-splendor gauge under each of the three
concepts: THE RECLAIMED MACHINE (vines, breached parapet, moss, live trace,
survey flag), THE LEDGER ROOF (a 4×4 roof grid, one tile per authored file, the
SC2K abandonment wash, boarded door, crane, AC cubes, water tower, antenna) and
THE WORKING PLANT (rust hatch, cracks, steam plume, module lamps, connected vs
dripping pipes, the alert triangle). Beside each ladder its DATA → VISUAL
CHANNEL table and a cost note; at the foot the ranked recommendation and the
DESIGN GUARD on rust red vs gate red. The verdict is recorded as *already
shipped*: study 3 is sheet 7B, and study 1's gauge is sheet 13.

**A drafting trap worth writing down.** Every house drawing class (`.sk`,
`.skf`, `.sks`, `.skr` …) declares `fill: none`, and **a CSS declaration always
beats a presentation attribute** — so `class="sk" fill="url(#…)"` draws NOTHING.
The first cut of this plate lost every wall fill, every roof tile and the whole
rust and abandonment wash to that, silently. The house idiom (sheet 13 stacks it
this way) is two elements: the fill polygon with no class, then the stroke
polygon with `class="sk fnone"`. `sheetA1.mjs`'s `poly()` helper now emits that
pair, and the same trap is latent in `helpers.mjs::isoBlock`, which writes
`class="${edge}" fill="var(--paper-2)"` — worth a look next time a sheet's left
faces read as bare paper.

**Left out on purpose.** The artifact's reference strip — six fair-use game
screenshots (HZD, Ta Prohm, SC2K, SCURK, two Factorio FFF posts) as base64
JPEGs, about 380 KB of the 393 KB file — is NOT re-drawn. The atlas is
hand-authored SVG on the house palette; a raster would be the only image in the
set and the only thing on a plate a strict CSP could drop. The teaching survives
as the citation paragraph in the notes, with the four FFF posts as real links.
The plate's own SVG is ~55 KB and its only stochastic marks, study 1's vines,
are seeded (a fixed LCG per state), so it is byte-identical on every build.

Verified: build 23 sheets + 1 appendix / 25 fragments, prerender 28 pages + 404
(was 27) and 10 redirects (was 9 — `/sheet/a1` → `/sheet/A1`), `tsc` clean for
everything this change touches. Playwright, light and dark: the flat plate, the
routed `/sheet/A1/`, the rail's APPENDIX section, the index's appendix card and
the flat gallery's appendix heading all render; **zero SVG text-bbox overlaps**
on the new plate and no page scrolls sideways (1440/1440 on all six shots).

Verify: `node generator/build.mjs .` then `npm --prefix app run build`; the
manifest carries `appendix: [{ id: 'a1', num: 'A1', plates: [], refs: ['7',
'7B', '8', '10', '13'] }]`, sheet 13's row carries `'A1'` in its refs, and
`app/dist/sheet/A1/index.html` exists.

THE TITLE ARTICLE, 2026-09-06: every sheet title starts with THE, and in
Exhibition's caps the rail says it 21 times and the cover 24 — the user finds
the repeat tiring and added **HWT Catchwords** (Hamilton Wood Type via P22, the
Wright faces' foundry; kit name `hwt-catchwords`, one face) to the kit for it.
A KNOB ON THE SPECIMEN ONLY — nothing shipped changes: `generator/chrome.mjs`,
`views.ts`, `index.html` and the rail are untouched.

**The face, probed.** The kit's OTF (60 KB, CFF) was read with a 150-line
table parser (`cmap` + CFF charset + GSUB) and rendered key by key in Chromium:
87 glyphs, every one ENCODED, and **no GSUB table at all** — `liga`, `dlig`,
`salt`, `swsh`, `calt` and `ss01`…`ss20` change nothing (every string's
advance is identical under all 26 feature settings), and typing "the" draws
THREE catchwords in a row. Each catchword is KEYED to one character. Ten keys
are a stand-alone THE — upright: `e` (narrow block caps, two leaves), `E`
(narrow block caps, flourish), `w` (the wide arched banner with a swash), `Q`
(block caps on an arc with a swash), `q` (between two rules), `r` (script
"the" reversed out of a black square); tilted IN THE GLYPH: `R` (script),
`W`, `T`, `t` — and four more are OF THE (`I`, `P`, `U`, `Y`, unused). Also in
the face: AND ×14, FOR ×12, OF ×5, PER/EACH/ONLY/BEST/CHOICE… and seven PUA
duplicates (U+E000–E006 = B E S b s w y). Metrics at 64 px: Exhibition's cap
is 44.8 px (0.700 em); every catchword's ink ascent is 40.6–42.0 px
(0.634–0.656 em, swashes included), so the cap-matched scale is 1.07–1.10 em
per key, stored per row.

**The knob.** `specimen.ts` gains `ARTICLES` (13 rows) and a TITLE ARTICLE
group with three sub-controls, all in `KNOBS`: AS IS · MUTED (soft ink at 55%)
· SMALL (0.7 em, cap-aligned by a 0.3 em raise, soft ink) · CATCHWORD 1…10 (one
per THE key, `--article-key` written into `.art::before { content }`,
`--article-scale` = the row's cap-matched scale × the CATCHWORD SIZE stepper,
×0.5…×3 in quarters); HEAD INLINE / STACKED (the catchword centred over the
first word of the sheet head only, at 0.65 of the inline size — rail, title
block and card stay inline); RAIL SAME / OFF (the rail drops the article
outright, the memo's strip-`/^THE /`). `specimen-mock.ts` wraps the article in
`.art > .w` on the eight rail entries, the sheet head (`.w1` around the first
word for the stack), the title block's SHEET TITLE value, and a NEW mock cover
card drawn with `index.html`'s `.card` rules, so all four homes of THE are
judged at once. `hwt-catchwords` is a `kit: true` row in `ADOBE_FAMILIES` and a
Face with NO stand-in: the CATCHWORD rows are disabled and labelled SITE ONLY
wherever `document.fonts` has not declared the family (the artifact, and the
vite dev server, which carries no kit), and LOADED FACES adds an `--article`
row that reads ADOBE on the site.

**What the bench shows.** At the cap-matched ×1 the whole word lives inside
one em, so its LETTERS are a third of Exhibition's cap — a mark, not a word,
and a smudge at the rail's 12 px. Inline reads from ×2 (`w`, `Q`, `q` best);
STACKED at ×2 over MEASURED is the one that looks like a drawing-set title,
and RAIL OFF is what makes the rail quiet. The rotated four (`R`, `W`, `T`,
`t`) are drawn tilted in the glyph — nothing here rotates, the square rule
holds. Ranking, for what it is worth: RAIL OFF + head STACKED `w` ×2; then
MUTED (no new glyph, both hosts); SMALL; then inline `Q`/`q` ×2; the tilted
ones last.

Verified on the dev server with the kit CSS injected (Typekit served the font
to localhost): 13 rows × inline/stacked × rail on/off clicked through, zero
page errors, `document.fonts.check('16px "hwt-catchwords"')` true, and on the
live site the kit already declares `hwt-catchwords` (checked from
`atlas.lit-ui-router.dev/specimen/`). `tsc --noEmit` clean. Crops under
`~/.claude/jobs/a9024f9c/tmp/catchwords/` (`keys-part0/1.png` = the whole
face keyed; `shots/<row>[-stacked|-x2|-x3|-rail-off]-{title,rail,card,tb}.png`).

**SHIPPED 2026-09-06 — the article is a SUP, and the catchword is the cover's
alone.** The user's call off the bench: "i kinda like the hwt catchwords
sparingly but found myself converting `the` to a `<sup>` with .6em din-2014
font, lowercase". So the default treatment is a NEW `ARTICLES` row, `sup` — the
word kept, drawn as `<sup class="art">the&nbsp;</sup>`: the data face at 0.6 em
of the title, lowercase, `--ink-soft`, `letter-spacing: 0`, `line-height: 0` so
it never opens the title's line box, and its own no-break space so the heading
still reads "the MEASURED CITY" and never breaks after the article. It needs no
kit glyph, so the site, the flat set and the artifact draw it identically. It is
the knob's default, so `/specimen` opens on the shipped state (with RAIL OFF
beside it, which is what the rail actually does).

WHERE: `sup.art` is styled once in `generator/chrome.mjs` (so `sheets/atlas.css`
carries it to the app and the artifact too). `articleTitle()` in chrome.mjs
rewrites `/^THE\s+/` at RENDER — the manifest titles stay frozen — for the
`.sheet-title` and the title block's SHEET TITLE on every sheet of both sets;
its twins in `app/src/views.ts` and `app/prerender.ts` do the cover cards' `h3`,
the hero caption's title, and the app's own `/log` and `/specimen` headlines.
The five hand-written sheet heads (city, 1i, 12i, 2B, 14i) call it or carry the
sup literally. The rail keeps T9's stripped form — one treatment per home.

THE ONE CATCHWORD: the cover's `THE ALTITUDE ATLAS` `h2`, and nowhere else. A
`.cw` span wraps the sup; `html[data-catchwords="on"] .cover-title .cw::before`
draws catchword key `e` (the plainest of the ten) at the bench's cap-matched
1.08 em, and hides the sup behind it. The `data-catchwords` flag is set by a
12-line guard in `app/index.html` that walks `document.fonts` for a DECLARED
`hwt-catchwords` — the same trap the specimen documents (`fonts.check()` says
yes to families nothing declares). Off the kit — the artifact, any host without
it — nothing fires and the sup is what draws; a bare key `e` in the display face
is the failure that guard exists to prevent.

MEASURED (Chromium, staged dist): `.sheet-title` clamp(18, 2.7vw, 24) → the sup
is **14.4 px at 1440** and **10.8 px at the 18-px end**; the title block's
13.5-px SHEET TITLE → 8.1 px; the cover card's 15-px `h3` → 9 px; the cover's
44-px `h2` → a 26.4-px sup off the kit, or the catchword at 47.52 px (33.9 ×
51 px of ink) on it.

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
