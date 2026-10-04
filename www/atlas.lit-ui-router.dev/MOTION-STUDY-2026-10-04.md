# The Altitude Atlas — motion study, 2026-10-04: the brick assembly's clip

A study record for one plate: the brick assembly in the round (`/bricks`), sheet 2's finished
model as a glTF binary in `<model-viewer>`, with one clip, `assemble`. The maintainer's brief:
"brick 5 doesn't explode out from 1 fast enough; the animation could use some snappier easing
and higher explosion multiplier i think. lots of fun animations imaginable to accompany."
Three explorations ran in parallel on sandbox copies of the generator, each judged by filmstrip.
Section 5 is the decision; what ships is described in `app/README.md` and `HISTORY.md`.

---

## 1. The clip as found

`generator/brick-glb.mjs` wrote one two-key LINEAR translation sampler per lifted brick, from
seat + lift at t = 0 (exploded) to seat at t = 1.5 s (seated). `generator/brick-scene.mjs`
played it: EXPLODE ran clip time 1.5 → 0 at one second per second, ASSEMBLE 0 → 1.5, the slider
scrubbed it, and the badges rode by `lift × (1 − t / END)`. The lifts were sheet 2's own
exploded-view hovers, each measured from the brick's plate: 1: 132, 2: 116, 3: 228, 4: 88,
5: 126, 6: 136 plan units (40 per stud pitch).

**The finding every explorer made independently:** brick 5's lift (126) is smaller than brick
1's (132), and both are measured from the plate, so for the whole clip brick 5's foot sits six
units inside brick 1's cap; brick 6 clears it by four. A multiplier scales the overlap with it
(×1.5 gives −9, ×2 gives −12) and easing cannot separate two bricks on one curve. The
complaint was a geometry fault, not a timing one. A second limit shaped every candidate:
model-viewer frames the seated pose and does not refit while the clip plays, so compounding each
rider's lift onto brick 1's at ×1.5 lifts brick 3's top out of the frame at both drawn corners.

## 2. Method

A shared harness under the job's tmp directory: `mkglb.mjs` builds `bricks.glb` from any copy of
the generator; `film.mjs` loads it in model-viewer under Playwright, sets `currentTime` at
frames evenly spaced in real time over the clip, and composites a captioned filmstrip at a
chosen orbit. Every candidate was filmed at the sheet's first corner (45°) and the finalists
at 135° as well; every GLB had to load with no page errors, with strictly increasing key times
and min/max on the time accessor; the finalists ran an interpenetration check over 601 sample
times. The baseline filmstrip reproduces the complaint exactly: bricks 3, 5 and 6 ride up with
brick 1 and separate only in the last frames.

## 3. Candidates

### A — easing baked into the clip (17 variants)

| Variant | Shape | Verdict |
|---|---|---|
| v0, v2 | compound lifts, cubic ease | fixes brick 5; brick 3 grazes the top of the frame |
| v1, v10 | multiplier alone, ×1.5 / ×2 | brick 5 still sunk |
| v3, v5, v6, v8, v9, v11 | compounded with expo, back, seat hop | off frame; expo too abrupt; the seat hop stalls the launch |
| v4, v7, v17 | CUBICSPLINE with tangents | any cubic ease is exact with two keys for +320 B |
| v16 | 1.0 s clip | the stagger blurs; 1.2 s is the sweet spot |
| **v13** | stagger + cubic ease-in + a stud of clearance + ×1.5 + 1.2 s | **recommended**: riders well clear of brick 1 by 0.17 s, in frame at both corners |
| v14 | v13 with a back ease at ×1.25 | playful; a wobble, and a cramped exploded pose |

The clearance rule replaces compounding: a brick on a lifted brick hovers at least its parent's
lift plus 40 units, which keeps the top of the model inside the seated framing.

### B — timing structure across bricks (10 variants)

| Variant | Shape | Verdict |
|---|---|---|
| c1 | compound lifts | separation reads; brick 3's top cut off |
| c2, c3 | compound ×1.5, ×2 | off frame |
| c4, c5 | tight hovers (3: 96, 5: 72, 6: 72), ×1 and ×1.25 | fits; one simultaneous pop |
| s1 | riders first, then brick 1 | good; a visible pause at the handoff |
| s1b | s1 with overlapping windows | no pause; brick 5 off brick 1 in 0.3 s; the runner-up overall |
| s2 | bottom-up | brick 5 separates late, the direction of the complaint |
| s3 | sheet 2's STEPS order | the best ASSEMBLE story; brick 1 still at 0.9 s on EXPLODE |
| s4, s5 | plan-wise wave; a server beat | neither reads |

B also contributed a build-time clearance check: the build fails when two parts intersect at any
sampled time. The clip as found would have failed it.

### C — secondary motion over a compound base (8 variants)

| Variant | Bytes | Verdict |
|---|---|---|
| c1 yaw 12° | +2,848 | gimmicky; the held pose sits off the drawing's axes |
| c2 fan | 0 | legible, not drafted; the bricks leave plumb no longer |
| c3 stud snap | −76 | a 2–4 px hold that stalls the launch |
| c4 back-out overshoot 3.7% | +380 | harmless decoration |
| c5 the server plate lifts | +416 | semantic and cheap; not taken, to keep the sheet's parts list |
| c6 STEPS stagger | +1,144 | drafted, slow to explode |
| **c7 leader lines** | +8,368 | **the exploded-view convention itself**: each hovering brick plumb to the stud it left |
| c8 = c6 + c7 | +11,828 | the full combination |

## 4. What the three agreed on

- The lifts had to change before any easing could: a rider must clear the brick it stands on.
- Riders leave first on EXPLODE and land last on ASSEMBLE; played forward, that is brick 1
  seating, then the stack dropping onto it, which is sheet 2's STEPS order in two beats.
- Cubic ease-in in clip time: the drop lands hard, the launch is fast.
- Any change to the keys breaks the scene's linear badge formula; the scene must read the clip's
  own keys.
- The slider must stay scrub-safe: every key a sane pose, no part inside another.

## 5. Decision

**A's v13 timing with C's leader lines.** Sheet 2's hovers scaled ×1.5, a brick stacked on a
lifted brick a stud clear of it, plate-seated bricks moving in the clip's first three quarters
and stacked bricks in its last seven tenths, cubic ease-in sampled at 24 linear keys, a 1.2 s
clip; and from each hovering brick a dashed leader down to the stud it left, riding the
supporting part, scaled with the gap so it vanishes at the seat, drawn in the retinted edge
material so it holds in both themes. The scene ships the key times and each brick's rise per key
in its JSON island and interpolates them, so badges and the pinned camera target ride exactly.
Rejected: yaw, fan, stud snap, overshoot, the plate lift and the step-by-step order.

The study's artefacts (sandboxes, filmstrips, checkers, diffs) live outside the repository; the
harness that filmed them is the job's `easing/film.mjs` and `easing/mkglb.mjs`.
