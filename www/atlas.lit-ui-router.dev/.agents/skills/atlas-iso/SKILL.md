---
name: atlas-iso
description: Draw or revise an isometric sheet of the Altitude Atlas, or any isometric SVG drawn from census plates. Use when adding a structure, re-massing a city after a census refresh, moving a block, badge, road or leader, or changing a sheet's key or schedule under www/atlas.lit-ui-router.dev.
---

# Draw an atlas isometric sheet

The recipe lives in [docs/ISOMETRIC.md](../../../docs/ISOMETRIC.md). This skill adds only what an
unattended run needs. Run every command from the worktree root, in the foreground, and save its
output to a file under `$CLAUDE_JOB_DIR/tmp`. Search that file; do not `head` or `tail` it.

1. Build the sheets with
   `mise exec -- node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev`.
   A throw names a plate row, an overlapped plot or a label. Fix the drawing or the plate.
   Never catch or soften the throw. A number missing from its plate stops the build by design.
2. Build the app with `mise exec -- npm --prefix <abs path to www/atlas.lit-ui-router.dev/app> run build`.
   When a 3D lane changed, also run `run build:artifact` and then
   `generator/check-scenes.mjs` (ISOMETRIC.md, Verification).
3. Run the frame audit:
   `mise exec -- node www/atlas.lit-ui-router.dev/generator/audit-frames.mjs <tag> --only <ids>`.
   It exits 1 unless every changed sheet reports zero escapes, zero hits and zero text-on-text.
4. Photograph every changed sheet before and after:
   `mise exec -- node www/atlas.lit-ui-router.dev/generator/shoot.mjs <tag> --only <ids>` (ids as the
   sheet page filenames under `tmp/flat/` spell them: `3B`, `7A`, `A2`). Open each PNG and read it, with 4× crops at the junctions
   and a 390 px load.
5. Cite a structure by name through the sheet's lookup (`NO()` in `sheet3b.mjs`), never by a
   literal number.
6. Record the change in [HISTORY.md](../../../HISTORY.md), under the sheet's `## Sheet …` heading,
   in **Record notes**. Write one dated line (`- YYYY-MM-DD: …`), newest first. When the change moves
   the sheet's rev letter, add a `### REV X — date` subhead with the verbatim `sub` clause as a `>`
   quote. The `/log` page parses those headings, subheads and first quotes. The sheet's own copy
   stays present-state.
7. Commit on the atlas branch. Use a lowercase subject (`style(atlas): sheet 3b …`), body lines of
   100 characters or fewer, and no body line that starts with `word:`. End with the attribution
   lines the session gives. A subagent never commits; the session that validates the build does.
   Shipping is [atlas-ship](../atlas-ship/SKILL.md); everything else follows
   [AGENTS.md](../../../../../AGENTS.md).

Report the sheets you touched, the three audit counts before and after, the photographs' paths and
any plate number that moved.
