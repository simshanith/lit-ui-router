# Writing for the atlas

The rules the atlas's words follow: sheet subs, captions, notes, callouts, keys, HISTORY.md and
commit messages. Each rule names the mechanism that holds it where one exists.

## Sheet copy

- **Present state only.** A sub, caption, note or callout describes what the plate shows now.
  No "since rev", "once", "used to", "formerly", "previously", "will", "planned", "until". The
  record of every revision is [HISTORY.md](../HISTORY.md), which quotes each rev's clause
  verbatim with its numbers, because a number only means something with the sentence that
  qualifies it.
- **A hand-written count is a claim the build does not check.** "one", "the tallest", "the
  smallest", "N published" are derived from the plate or guarded by a throw
  ([INITIATIVES.md](../INITIATIVES.md): a label that counts is asserted against the data).
- **Captions stay plain.** No anchors and no markup: the flat page's `<meta name="description">`
  takes the caption verbatim. SVG lettering carries no anchors either.
- **Notes link what they name.** Packages go to npmx.dev through `npmUrl()` in
  [helpers.mjs](../generator/helpers.mjs), and through a plate-checked `npmLink()` on a sheet that
  reads a plate, so a name off the plate throws. Repo files link to `main`; the atlas's own plates
  and generators link to the `www/atlas` branch, where they live. The first mention in a paragraph
  links and repeats stay bare. Prose never links another sheet: cross-sheet references ride the
  manifest and the rail.
- **Structures are cited by name.** On an isometric sheet the badge numbers count in schedule
  order, and prose, callouts and lookups reach a structure through its schedule name (`NO(name)`
  in [sheet3b.mjs](../generator/sheet3b.mjs)), never a literal number
  ([ISOMETRIC.md](ISOMETRIC.md)).
- **Keys read mark first.** The primary mark and its size encoding, then the other kinds, then
  the edges, then the district.
- **Negative space over de-collision.** A crowded label cluster is recomposed with empty ground
  around it; paper-coloured mask rects are not used.
- **Never rename or renumber** a sheet, plate, probe or shared term; the vocabulary is shared
  language in briefs to other agents. A change of meaning is a rev bump.
- **The atlas follows the repository's record, not a person.** A plate holds what the repo's
  pull requests, issues, comments and commits cite, bots excluded; never an author search.
- **The wordmark has two fixed forms.** THE ALTITUDE ATLAS in uppercase on the rail and the cover;
  the condensed project mark on sheet headers and title blocks.
- **Discreet, not promoted.** The atlas is named and linked where relevant and nowhere else.

## Code and commits

- **Code comments: one line stating the constraint, or none.** The story is the commit. A comment
  explaining an absence or an upgrade is history.
- **Commit subjects are lowercase conventional, scoped `(atlas)`**, with a plain verb and no
  slogan. The body is the narrative: what moved and why, the user's words quoted where they
  decided it.
- **Docs point at the file that owns a mechanism** rather than restating it; a command is printed
  only where the exact string matters.
