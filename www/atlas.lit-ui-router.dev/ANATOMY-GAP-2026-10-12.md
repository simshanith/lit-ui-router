# anatomy vs the Altitude Atlas — gap study, 2026-10-12

anatomy (Ryan, MIT, <https://github.com/wheresryan22/anatomy>) draws invented machines driven by one
model. The atlas draws a census: every number comes from a plate in `data/`. What carries over is
the discipline: provable painter's order, lines that end on something, numbers from one source, and
reviewing like a critic. Paths are relative to `www/atlas.lit-ui-router.dev/`.

Verdicts: **ALREADY**, **DIFFERENTLY** (with a judgement on which way is better here), **ADOPT**, **SKIP**.

## Projection

- **Camera.** DIFFERENTLY, and the atlas way is right for it. `generator/helpers.mjs` `iso()` is
  `[(x-y)·0.866, (x+y)·0.5 - z]`. Unit x, y and z all project to length 1, 120° apart, so this is
  a true **isometric drawing**: no foreshortening, plan axes at 30°. It is not a dimetric, which is
  what the brief called it. anatomy's default camera (azimuth 45°, elevation 30°, `kit/iso-kit.mjs`
  `cameraOf`) is the dimetric one: plan axes at 26.6°, x and y scaled equally and z by a different
  factor. anatomy's docs give it only as azimuth and elevation and never call it dimetric. For a
  census, equal scale on all three axes matters: "3 px per file" (sheet 7) reads as 3 px on the page.
  The cost is that the atlas has no azimuth to turn. The 3D lanes (`city-scene.mjs`) give the turn.

## Faces and tone

- **Four-tone shading, light locked to the camera.** DIFFERENTLY; keep the atlas way. Under one
  fixed azimuth an axis-aligned block shows exactly three faces, and `isoBlock` paints them as top
  `fp`/capCls, left `--paper-2`, right hatch over stone. The fourth tone and the per-facet buckets
  exist for curved bodies and turning parts, and the atlas draws neither. The right-face hatch carries
  data (gate tier: `hx`/`hr`/`ha`/`hd`), which anatomy's tone ladder has no slot for.
- **Paper fill hides what is behind.** ALREADY: `face()` writes the fill as its own element, because
  every stroke class sets `fill:none` and CSS beats a presentation attribute (the header of
  `iso-hidden.mjs`). A hatch has no ground, so stone goes under it. anatomy's "Paper equals the card
  colour" is the same rule, and every colour is a `light-dark()` token on `chrome.mjs` `:root`.
- **Exactly one lit accent.** DIFFERENTLY, and partly ADOPT. On the atlas, colour _is_ the subject
  (severity tiers: red solid, red hatch, accent hatch, faint), which is anatomy's own exception.
  Accent is overloaded, though. On sheet 7 it is a tier (`late`), the "typecheck reads" road, and the
  `lbla` callout for the package the set is about. Adopt this: **accent carries one meaning per sheet,
  and the key names it.** Do not take "exactly one part" literally.

## Painter's order

- **Ray-cast settle over overlapping pairs (`kit/audit.mjs` `overlapsOf` → `orderKeys`) vs
  `iso-hidden.mjs` `depthSort`.** DIFFERENTLY; the atlas way is exact for its domain. For disjoint
  axis-aligned plan rects under this projection, a plan-axis plane separates any two blocks. The block
  on the low-x (or low-y) side is behind along every view ray that meets both. When the two rects are
  separated on both axes in opposite senses, their screen x-ranges do not overlap, so no order is
  needed. A topological sort of that relation is exact and needs no sampling. anatomy's 3D mode
  reaches the same conclusion ("order comes from separating planes", `references/3d.md` §9). The
  precondition is disjoint footprints, and `assertPlots` throws when two of them overlap.
  **ADOPT one piece:** `depthSort` silently falls back to the near-corner key on a cycle. anatomy
  treats an unorderable pair as a geometry bug that fails the build. Make the fallback throw, in the
  same posture as `assertPlots`.
- **Split wrapping parts.** ALREADY in practice (nothing wraps; annexes stand beside their block).
  Write it down as the rule for any non-axis-aligned or wrapping mass: split it, never bias a key.
- **Ground features drawn first.** ALREADY: sheet 7 paints districts → roads → `depthSort`ed masses
  → badges → lettering. That is anatomy's "draw it before the part, full length, and let the part hide it".

## Lines

- **"Every line ends on a face, a line or a dot" (`scripts/line-ends.mjs`).** DIFFERENTLY, and ADOPT
  in adapted form. anatomy bans leader lines; the atlas uses them on purpose, as callouts. Translated,
  the rule is that **every open line ends on purpose, and the end is computed**:
  - a leader ends on the face of the structure it names, from `isoPt` of that structure's geometry;
  - a road's arrowhead stops at a clearance derived from the silhouette (sheet 7's `clr()` = h + 1.15·gap, ALREADY);
  - a district, vacant plot or phantom field is a closed outline and has no ends.
    The gap is that sheet 7's leaders end at literal screen points (`<line x1="818" y1="126" x2="780" y2="158">`).
    A census refresh that resizes a mass leaves such a leader pointing at air. A fourth frame-audit
    count would catch it: the far end of each leader (marked `data-leader`) must lie in a mass's fill
    (`isPointInFill`, which is anatomy's own test) or within 1 user unit of its outline.

## Numbers

- **True numbers in one pure module, read by every label.** ALREADY, and stricter than anatomy. Each
  sheet reads its plate at build time and throws when a drawn name is missing from the plate
  (`row()` in sheets 7 and 8, `rowsOf()` in 3B). 3B and 8 also throw the other way, on a plate row no
  structure draws, so the schedule totals reconcile the plate.
- **Cite numbers by name, never by literal.** PARTLY. `sheet3b.mjs` `NO(name)` resolves a structure's
  badge by its schedule name and throws on an unknown name, so renumbering cannot move a citation onto
  another building (commit 426fb58e). Other sheets still cite by literal: `g(5)`, `g(11)`, `g(12)`
  appear 65× in sheet 7, 33× in 7B, 20× each in 3 and 7A, and 8× in 13. ADOPT `NO()` on those sheets.
- **Badge numbering.** On HEAD, 3B's badges count 1 to n in schedule order. The commit replaced
  birth-identity numbers, and the brief's "badge = birth identity" describes that older state. Sheet 7
  also counts 1–40 in list order. The doc records schedule order.

## Words

- **No text in the drawing; corners plus caption.** SKIP. A survey sheet carries a title block, a
  structure schedule, a key and callouts. The frame audit's HIT and TEXT counts keep that lettering
  honest instead: text over a filled mass, text over text, and anything outside the viewBox.
- **Things on faces fit them.** ALREADY for badges, which `BADGE_LIFT`/`BADGE_ON_ROOF` place in
  clear air. The frame audit exempts one- and two-digit badges.

## Verification

- **Verify like a critic: render, then read every PNG.** ALREADY in part. `shoot.mjs` photographs
  every sheet in light and dark under a before/after tag, and the frame audit gives three counts.
  Both live in a job scratch dir, not in the repo. ADOPT: check them in under `generator/`, so the
  doc and the skill can point at a file.
- **4× crops at junctions.** ADOPT: badge on roof, road arrowhead at silhouette, annex beside block,
  mast foot, every leader end, schedule gutter. Shoot both themes and compare against the previous
  round's crop of the same region.
- **Phone-width capture (390).** ADOPT for the static sheets. `check-scenes.mjs` already does it for
  the city lane (no sideways scroll, pins fold).
- **Audit to zero, never excuse by eye.** ALREADY as posture (build throws). Extend it to leaders and
  depth cycles, as above.

## Motion (interactive lanes 1i, 2B, 12i, A2i, city, plant)

- **Reduced motion: one still frame, still responds.** ALREADY in `brick-scene.mjs`, `city-scene.mjs`,
  `loop-walk.mjs`, `register-graph.mjs`, `pipeline-graph.mjs` and `lane-chrome.mjs`. `check-scenes.mjs`
  asserts it for the city only. ADOPT one assertion per interactive lane.
- **dpr cap 1.5.** SKIP. It is a rule for anatomy's own WebGL canvases. The atlas's 3D lanes render
  through model-viewer, which manages its own scale. Measure before adding one.

## Does not apply

Inventing a machine; parts-count tiers (Figure 40–80, Hero, Epic); the parts vocabulary
(knurls, screws, ruler strips); "every face rewarding at 4×" as an addition of detail (on a census,
detail no plate carries is invented data); live readouts; idle tours and slowed contact sheets;
a halo under lifted parts; dashed hidden edges (the atlas has none: dash marks a kind of line);
lathe/tube/pipe routing and its clearance audit; exploded views; WebGL shaders and the light-theme
ink rules; the 3D turn mode (the city lane uses glTF in model-viewer instead).
