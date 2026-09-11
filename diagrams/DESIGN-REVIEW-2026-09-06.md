# The Altitude Atlas — design review, 2026-09-06

Reviewed: the staged build at `diagrams/dist` (served with the Pages-mimicking server on :4330) and the live site at https://atlas.lit-ui-router.dev/. Light theme at 1440×1000 unless stated; 1024 and 390 for the cover and sheet 7; CYANO for the cover, sheet 7 and the city. Screenshots and probe scripts: `/Users/simloovoo/.claude/jobs/a9024f9c/tmp/design-review/` (`prod/` for the live site). Every number below is a computed value read from the DOM, not an estimate.

Fonts: all six kit faces resolved on every staged page — `p22-fllw-eaglefeather` 700, `p22-flw-exhibition` 400 + 700, `din-2014` 400 + 700, `source-serif-pro` 400 / 700 / 400i, `source-code-pro` 400, `p22-fllw-eaglefeather-inf` 400. Nothing the set asks for failed to load. (An earlier `fonts.check` at weight 400 reported Eaglefeather "missing" only because the set never requests its 400 face.)

Production is one deploy behind the staged build: it still carries the three Google Fonts links beside the kit link, the prose there is Source Serif 4, `--code` and every plate label resolve to `ui-monospace`, there is no DRAWN BY hand, and the rail still lists `S0·T THE TYPE SPECIMEN`. Everything in this memo is judged against the staged build; the prod screenshots are in `prod/` for the record.

---

## 1. Guiding star

At its best this site reads like a bound set of construction documents for a piece of software: a title sheet, a numbered ascent of plates, and on every plate one drawing that carries the argument, with the writing subordinate to it and the ledger (title block, key, revisions) squared away in the corner where a drafter would put it. The pleasure of a drawing set is discipline — one measure, one lettering system, one line weight family, a lot of paper left blank — and the pleasure of *this* set is that every number on it was counted, so the chrome should feel metered rather than decorated. Right now the type system is settled and genuinely good; the weakness is that the chrome has not yet caught up to it. The plates are drawn at a size the page then shrinks; the prose runs as a single 2,300-pixel wall beside an empty column; the cover is a statistics table rather than a title sheet; the one thing on the site that moves, the city, is filed last.

Five principles to steer by:

1. **The plate is the page.** On a sheet the drawing sets the width; everything else fits around it. Nothing on the plate should render below ~8 px on a 1440 screen, and the chrome must never make the plate smaller than the drafter drew it without a reason.
2. **One measure, insets to the right.** Running text sits in a fixed column of 62–68ch. Everything that is not running text — key, title block, schedules, small figures, revisions — is an *inset* set against that column, not a second column that happens to be there.
3. **Air is composed, not left over.** Empty space is fine when it is a margin; it is a fault when it is a hole (the 1,660 px under the title block on every sheet). Recompose, never just de-collide — the user's own rule.
4. **Hierarchy through weight and size, not through more caps.** Six faces are already doing the work. Where things blur (rail, crumb, cover), the fix is a size step or a weight, not another tracked-caps line.
5. **Chrome in DIN, voice in Exhibition, one signature in the hand.** The roles are decided; hold them. The only role still leaking is DIN as *prose* (basis lines, sources, the city's info panel) — anything longer than a line belongs to Source Serif.

---

## 2. Type, role by role

Measured on `/sheet/7/` at 1440. `cap` = cap height in px (canvas `actualBoundingBoxAscent` of "H"), `x` = x-height.

| role | face (weight) | where | size | lh | tracking | cap / x | verdict |
|---|---|---|---|---|---|---|---|
| display | Eaglefeather 700 | rail h1 | 17 | 25.5 | 0.14em | 10.9 / 7.5 | right |
| display | Eaglefeather 700 | title block PROJECT | 13.5 | 20.25 | 0.10em | 8.6 / 5.9 | right |
| title | Exhibition 700 | `.sheet-title` | 24 | 36 | 0.12em | 16.8 / 16.1 | right size, too much tracking |
| title | Exhibition **400** | rail `.t` | 11.5 | 17.25 | 0.05em | 8.05 | hairline; the only 400 use — see below |
| title | Exhibition 700 | card h3 | 15 | 22.5 | 0.10em | 10.5 | right |
| title | Exhibition 700 | about h2 | 19 | 28.5 | 0.12em | 13.3 | right |
| title | Exhibition 700 | title block SHEET TITLE | 13.5 | — | 0.10em | 9.45 | right |
| data | DIN 400 | `.sheet-head` proj/shno | 11.5 | 17.25 | 0.14em | 7.9 | right |
| data | DIN 400 | `.sheet-sub` | 12 | 18 | 0.08em | 8.3 | right |
| data | DIN 400 | crumb | 10 | 15 | 0.14em | 6.9 | too small for a 228ch line |
| data | DIN 400 | rail links / numbers | 11 | 16.5 | 0.06em | 7.6 | right |
| data | DIN 400 | rail kicker, `.rail-sec`, themer, `.fld`, card `.alt`/`.meta`, `.revs th`, stat `.k` | **9** | 13.5 | 0.12–0.18em | 6.2 | at the floor; nine 9-px styles is too many |
| data | DIN 400 | title block values, `.keyblock td`, `.revs td` | 11.5 | 17.25 | 0.03–0.06em | 7.9 | right |
| data | DIN 400 | cover stat `.v` / survey `.v` | 14.5 / 17.5 | — | 0.04 / 0.03em | 10.0 / 12.1 | right |
| data | DIN 400 | city `.cs-basis`, About SOURCES, `.provenance` | 9.5–10.5 | 14–16 | 0.06em | 6.6–7.2 | prose set as data, at 228ch |
| data (plates) | DIN 400/700 | `text.lbl` / `lblb` / `lbls` / `lblf` | 11 / 11.5 / 9.5 / 9 **× 0.696** | — | 0.05–0.07em | eff. 7.7 / 8.0 / 6.6 / 6.3 | **rendered below 8 px** |
| prose | Source Serif 400 | `.notes p` | 15.5 | 23.25 | — | 10.4 / 7.4 | right; measure 62ch = 481px |
| prose | Source Serif 400 | `.gal-body p`, About p | 16 / 15.5 | 24 / 23.25 | — | 10.7 | right |
| prose | Source Serif 400i | figcaption | 14.5 | 21.75 | — | 9.7 | right |
| prose | Source Serif 400 | card p / verdict | 14 / 13i | 21 / 19.5 | — | 9.4 / 8.7 | verdict in `--ink-faint` is too faint at 13 |
| code | Source Code Pro 400 | `.notes p code` | 13.18 (0.85em) | — | — | 8.6 / 6.4 | x-height 13 % under the prose's; chips break mid-word |
| hand | Eaglefeather Inf. 400 | DRAWN BY | 16 | 24 | 0.02em | 10.2 / 7.0 | right, exactly as decided |

### Display (Eaglefeather)
Correct everywhere it is used, and used in exactly three places. The slashed terminal S is an accepted quirk. Nothing to change. One note for the future: the kit carries `p22-fllw-eaglefeather-sc` (400/700, currently unloaded); it is the one legitimate way to set a *smaller* "THE" inside the atlas name if that ever wants downplaying — not for Exhibition.

### Title (Exhibition)
The sheet title at 24/700 is the best-set thing on the site. Two faults:

- **Tracking is heavy for a face that is already wide-set.** `.sheet-title` at 0.12em on 24 px (2.88 px between every glyph) plus Exhibition's own generous sidebearings gives "THE MEASURED CITY" 75ch of width for 17 characters. Drop to **0.06em** at 24 px and **0.04em** at 13.5–15 px (cards, title block). Exhibition is a display face; it does not need the DIN-style tracking that gives DIN its ledger look.
- **The rail uses the 400 weight and it is a hairline.** Exhibition 400 at 11.5 px in `--ink-soft` (`app/index.html:129–135`) draws strokes under a pixel; the 21 entries read as a grey stripe with the blue numbers doing all the work. The kit has only 400 and 700; use **700 at 11.5–12 px in `--ink`**, and let the active state be the accent bar + `--paper-2`, not a weight flip (there is no heavier weight to flip to). See `mock-rail-article-treatments.png`, columns C and E.

### The THE article — what the kit actually supports
Probed in the browser on the loaded `p22-flw-exhibition` 700 at 40 px (`measure.log`, "exhibition feature probe"). `font-feature-settings` for `dlig`, `liga`, `salt`, `swsh`, `ss01`, `ss02`, `smcp`, `c2sc`, `onum`, `hist`, `titl` and `calt 0` all produce the identical 55.61 px advance for "THE" — no alternate, ligature, swash or small-cap exists in the served font. `kern 0` changes the width (57 px), so kerning is the only feature the subset carries. Lowercase "the" measures the same 55.61 px: **the face is unicase; it has no lowercase to fall back to**, and `font-variant-caps: small-caps` only produces the browser's synthetic scaled caps (38.9 px), which would be a fake. The typekit URL carries no `features=` parameter and Adobe's dynamic subsetting has nothing to add here — the P22 cut simply ships no alternates.

So the article can only be downplayed by *typography*, not by a glyph:

- **Rail and cards: drop it.** "MEASURED CITY", "HANDOFF WORKS", "RENDER LOOP" read cleanly as entry names; the sheet title on the plate and in the title block keeps "THE" (there it appears once and it is the formal title). This is column C in the mock. Implementation is one `replace(/^THE\s+/, '')` at render in `app/src/views.ts` rail/card templates — the manifest titles stay frozen.
- If the article must stay on the rail, **mute it as a data-face catchword** (column D): `THE` in DIN 9 px 0.16em `--ink-faint` before the Exhibition name. This is the drawing-set idiom (the small qualifier before the big name) and it stops 21 identical Exhibition THEs stacking into a column. Column B (same face, muted colour) is weaker — the muted THE is still the widest word on every line.
- Do not letterspace the article differently or shrink it in the same face; at 11.5 px there is no room for a second size.

### Data (DIN 2014)
The face is doing exactly what it should. Two systemic problems:

- **Nine distinct 9-px styles.** Rail kicker, `.rail-sec`, themer buttons, `.titleblock .fld`, `.revs th`, `.stat-bar .k`, `.survey-tot .k`, `.lang th`, card `.alt` and `.meta` are all DIN 9 px with tracking between 0.12 and 0.18em. 9 px DIN has a 6.2 px cap — the legal floor. Consolidate to **two steps: 9.5 px 0.16em for field labels (`.fld`, table `th`, stat `.k`), 10 px 0.14em for section kickers (`.rail-sec`, kicker, `.meta`)**. Nothing under 9.5.
- **DIN is carrying paragraphs.** The city's `.cs-basis` (9.5 px, `--ink-faint`, 228ch, 189 px tall), About's SOURCES line (10.5 px, 1,086 px wide) and `.provenance` are 150–400-word passages set as tracked data in the faintest ink. That is the one place the role system is misapplied. Either set them in Source Serif at 13.5 px in a 68ch column, or cut them to two lines and link out. `din-2014-narrow` (in the kit, unused) is the right face for the *schedule bodies* on the plates if you ever need to buy back width there — not for prose.

### Prose (Source Serif Pro)
Good. 15.5/23.25 at 62ch is a correct book measure; 16/24 at 72ch on the cover is at the upper limit. Keep the sizes; change the *column* (section 3). The figcaption at 14.5 italic centred under the plate at 68ch reads well, but it is the only centred text on the site — set it flush-left on the prose column when the column model lands.

### Code (Source Code Pro)
- `0.85em` puts the chip at 13.18 px with a 6.4 px x-height against the prose's 7.36 — the chips read one size smaller than the text they sit in. **`0.88em`** (13.6 px, x 6.6) is the closest match without the chip growing wider than the line; pair it with `padding: 0 3px` so the boxes do not widen.
- `overflow-wrap: anywhere` (`generator/chrome.mjs:225`) now breaks identifiers mid-token: `census-`/`city.json`, `lit-`/`ui-router`, `@tools/lit-`/`test-env` are all visible in `crop-notes.png`. Use `overflow-wrap: break-word` plus `hyphens: none` and let the one 90-character chip on sheet 11 break at its slashes with `<wbr>`s emitted by the generator instead.
- Chip density: sheet 7's first paragraph carries 14 chips in 15 lines. Each has a 1 px border and a `--paper-2` fill; at that density the paragraph reads as a form. Consider dropping the border (keep the fill) so a run of chips is a tint, not a row of boxes.

### Hand (Eaglefeather Informal)
Exactly as decided and it works in situ. 16 px against 11.5 px neighbours is the right optical match (cap 10.2 vs 7.9 — the hand needs the extra size). Nothing to change; do not let it spread.

---

## 3. Layout and negative space

### The frame, measured (1440, `/sheet/7/`)

| element | value | source |
|---|---|---|
| rail | 240 px, sticky, `padding: 14px 0 30px` | `app/index.html:42–60` |
| content padding | `clamp(12px, 2.4vw, 30px)` → 30 px | `index.html:178` |
| sheet | 1140 wide (max 1180), `padding: 26px`, 1.5 px border | `chrome.mjs:118–126` |
| inner border | `inset: 8px`, 1 px `--edge` | `chrome.mjs:127` |
| text block | 1086 px | derived |
| sheet-head → title | 18 px margin; title → sub 4; sub → figure 16 + 6 | `chrome.mjs:136–178` |
| plate | 1086 × 838 (viewBox 1560 × 1204 → **scale 0.696**) | `chrome.mjs:180` |
| figure → caption → notes-grid | 10 / 18 / `padding-top: 16` | |
| notes-grid | `3fr 2fr` = 638 + 426, gap 22 | `chrome.mjs:191–198` |
| `.notes p` | `max-width: 62ch` = 481 px inside a 638 px column → **157 px dead gutter** | `chrome.mjs:208–213` |
| notes column height | 2,273 px | |
| key + title block height | 610 px → **1,663 px of empty right column** | |
| title block | 426 wide (min(460, 100%)) | `chrome.mjs:239` |
| revisions | 1086 wide, description at **159ch** | `chrome.mjs:303–340` |
| document | 3,815 px tall; the plate is 22 % of it | |

Sheets 3A, 12 and 14 are worse: 4,806 / 4,820 / 3,963 px tall, with the notes column 3.5× the height of the plate on 3A.

### What is wrong

1. **The plate is rendered at 70 % of its drawn size** (72 % on the flat set, 44 % at 1024, 41 % at 390). The generator letters at 9–11.5 px and the page shows 6.3–8.0 px. Every "the plate lettering is too small" reaction is this, not the label sizes. At 1024 (`w1024-sheet-7.png`) the schedule is 3.9 px type.
2. **The two-column split is a hole, not a composition.** The right column holds ~600 px of key and title block, then nothing for 1,600 px while the prose runs down the left at a width narrower than its own column. On a full-page screenshot the sheet is two-thirds white on the right.
3. **The revisions table is full-bleed and reads as another paragraph** rather than the ledger block a drawing puts against the title block.
4. **Sheet padding is uniform (26 px) while the inner border sits at 8 px** — the double border is a good drafting cue, but with 18 px between the two lines and the text sitting 26 px in, the frame reads as thick. Either bring the inner border to 12 px and the padding to 32, or keep 8 and pull padding to 22: the ratio matters more than either number.
5. **Vertical rhythm around the figure is tight** (6 px above, 10 px to the caption, 18 to the rule) relative to the 36-px title line; the plate is the hero and gets the least air.

### The column model to move to

Take the 1086 px text block as a **12-column grid: 76 px columns, 16 px gutters** (12 × 76 + 11 × 16 = 1,088). Then:

| region | columns | width | contents |
|---|---|---|---|
| plate | 1–12 | 1,086 | the drawing, at ≥ 0.85 scale (see §5) |
| running text | 1–7 | 628 px → set `.notes p { max-width: 66ch }` at 15.5 px = 512 px, flush left; or 16 px at 64ch = 512 | GENERAL NOTES, figcaption (flush-left, not centred) |
| inset strip | 9–12 | 352 px (col 8 = the 76 px gutter) | KEY, TITLE BLOCK, REVISIONS, "PLATES READ", small figures |
| full-width insets | 1–12 | 1,086 | schedules that need it (sheet 7's structure schedule already does) |

Behaviour of the inset strip: `position: sticky; top: 30px` on the strip so key + title block ride alongside whatever paragraph is on screen (this alone removes the hole *as experienced*), and the REVISIONS table moves into the strip under the title block at 352 px with the description at ~40ch wrapping — which is how a drawing files it. When a sheet's notes are short (sheet 1, 6), the strip and the text end together and nothing changes.

Feature insetting: where a paragraph cites a specific figure or table (sheet 7's road register; 3A's deepest chain; 12's phantom share), the generator can emit that fragment as a `<figure class="inset">` that the CSS floats into cols 9–12 beside the citing paragraph — `float: right; width: 352px; margin: 4px 0 16px 24px` is enough, no grid machinery. The type specimen's mock sheet (`specimen-top.png`, lower half) already draws exactly this: figure with a schedule inset beside it, FIG caption flush-left, notes below. It is the model; the real sheets should look like it.

Numbers to change immediately, before any of that: `.notes-grid { grid-template-columns: minmax(0, 7fr) 352px; gap: 24px }`, `.notes p { max-width: 66ch }`, `.keyblock { position: sticky; top: 30px }`, `.revs` moved into `.keyblock` in `sheetSection()` (`chrome.mjs:437–460`).

### Cover density
The cover's `.sheet` is 2,048 px of stat bar (264), survey (651) and three prose paragraphs (886) before a single card; the card grid is 3,175 px (24 cards, three across at 371, rows equalised to the tallest card — 509 px in the sheet-5/6/7 row). The city card is the last of 24, at y ≈ 5,000. `.gal-body p` sits flush left at 576 px inside a 1,086 px box with nothing to its right. See §4 for the recomposition.

### Rail
240 px is right for the content; the 34 px number column plus 16 px padding leaves the titles starting at x = 63, which is a comfortable ledger indent. Two things eat prime space: the themer (three filled buttons at y = 190) and the three top links at 29 px each with the same size as the sheet entries, so INDEX/ABOUT/THE FLAT SET compete with the plates. `14i` wraps to two lines (47 px); dropping the article fixes it.

### About
`.prose` at 72ch = 576 px centred in a 1,086 px box; 255 px of margin each side is a fine reading page. The SOURCES line under it is the problem (see §2, data). Nothing else.

---

## 4. The cover and the nav

### The cover today
"THE INDEX" at 24 px over a 181ch tracked subtitle, then a statistics table. It is a survey report, not a title sheet: no drawing, no set name at display size (the flat set's cover *has* the Eaglefeather title at ~46 px and reads as a cover; the app's does not), and the one interactive object filed last. The rail head is the only place the atlas name appears at all on `/`.

### The issue-log proposal — recommendation: yes, with one payload rule
A drawing set's title sheet carries the project name, a key image, the sheet index, and the issue/revision log. Map it directly:

```
┌────────────────────────────────────────────────────────────────────┐
│ THE ALTITUDE ATLAS — DRAWING SET                     23 PLATES / 14 │
├────────────────────────────────────────────────────────────────────┤
│  THE ALTITUDE ATLAS                       (Eaglefeather, 40–44 px)  │
│  SAME SUBJECT AT EVERY SCALE — …          (DIN 12, one line)        │
│                                                                    │
│  ┌──────────────────────────────────────┐  ┌────────────────────┐  │
│  │                                      │  │ ISSUE LOG          │  │
│  │   the city — hero, 1086 × 460        │  │ 2026-09-06  S7·3D  │  │
│  │   (still image; "RAISE THE CITY ↗"   │  │   rev D …          │  │
│  │    button → /city/ where three.js    │  │ 2026-09-05  S14i   │  │
│  │    is actually fetched)              │  │ 2026-09-04  S7 E … │  │
│  │                                      │  │ … (10 rows, then   │  │
│  └──────────────────────────────────────┘  │  "FULL LOG ↓")     │  │
│                                            └────────────────────┘  │
│  GENERAL SURVEY (stat bar only, one row: sloc · files · packages · │
│  latest shipped) — the language table moves to About               │
├────────────────────────────────────────────────────────────────────┤
│  SHEET INDEX — ASCENT ORDER                                        │
│  [ 1 ][ 1i ][ 2 ][ 2A ] …  cards, 4 across at ≤ 260 px, 2 lines    │
│  of caption, thumbnail of the plate (a 260 × 160 SVG crop)          │
└────────────────────────────────────────────────────────────────────┘
```

- **Hero = the city, but as a still on the cover.** The user's payload rule stands: three.js is 600 KB and today it is fetched only by `atlas.city`, which is the right dogfooding story. Put a pre-rendered still (the current canvas at 1086 × 460, exported once at build as a ~120 KB WebP, or the sheet-7 SVG cropped to the city, which costs nothing) with one button that routes to `/city/`. If you want the live scene on the cover, gate it: load three only when the hero is in view *and* `prefers-reduced-data` is not set *and* the viewport is ≥ 1024. Do not autoplay orbit.
- **The issue log is real data you already have.** Every sheet's `revs` (rev, date, description) plus the extras — flatten, sort by date desc, show the latest 10 with sheet number + rev + first clause, "FULL LOG" expands. Reverse-chronological is correct here (it is the *set's* issue log); the per-sheet REVISIONS tables can stay ascending, which is how a drawing's rev block reads.
- **Sequential card index below**, denser: 4-up at 1086 (cols of 259 px, gap 16), the caption cut to two lines with the verdict dropped from the card (it lives on the sheet), a plate thumbnail added — a set index without a picture of each sheet is a table of contents, and the plates *are* the point. Thumbnails: the generator already has every SVG; a `<svg viewBox>` crop at 259 × 150 inline costs ~10–40 KB per card as markup, or emit PNGs at build. Equalise rows by fixing the card to 3 lines of caption, not by letting the tallest one stretch the row.
- The survey's language table and the three paragraphs of thesis move to About (which is already the colophon), leaving one stat row on the cover.

### The corner nav proposal — recommendation: yes, but as a bar, not a floating corner
A fixed top-right cluster over a page whose whole idiom is ruled borders will float on top of the sheet's frame at some scroll position and collide with `.sheet-head`'s right-hand SHEET 7 / 14. Instead make the **crumb row a top bar**: the crumb already occupies y = 30–45 at the top of the content column. Turn it into a 34-px sticky strip spanning the content column — crumb on the left, utilities on the right — and take the themer out of the rail:

```
← INDEX   SHEET 7 OF 14   PREV · 6   NEXT · 7A        DOCS ↗  GITHUB ↗  THE FLAT SET ↗  [AUTO|VELLUM|CYANO]
```

Utilities in DIN 10 px 0.14em `--ink-soft`; the themer becomes three text buttons with an underline for the pressed state instead of a filled block (the filled accent block at 9 px is the loudest thing in the rail today). The "ALTITUDE · … · PLATES READ · … · SEE ALSO" half of the crumb is plate metadata, not navigation — move it into the sheet-sub line or the inset strip (PLATES READ belongs under KEY). At ≤ 900 the bar stays sticky with the crumb only; the utilities fold into the rail's collapsed header (§6).

The rail then holds: kicker (now a link to lit-ui-router.dev), the name, INDEX / ABOUT as a smaller pair (10 px DIN, one line, `INDEX · ABOUT`), the sheets. Two links fewer, no themer, no external arrow: the rail is the sheet list, which is what a set's rail should be.

### The rail
Keep 240. Titles to Exhibition 700 / 11.5–12 px / `--ink`; article dropped or set as a DIN catchword; `.rail-sec` up to 10 px; row height 28 with 6 px padding is fine. The city entry should move up to sit directly under 7B as `7·3D` (it is sheet 7's third plate), not ride at the end as `S7·3D`: that is the cheapest promotion of all and it is also just correct filing.

---

## 5. The plates (SVG)

Short, because the per-sheet backlog is known (3A 33 labels, 2A 6, 1 5, 14 3, 4 3, 5 3, 10 2).

- **Scale is the first problem, not lettering.** `.figure-wrap svg { max-width: 100%; min-width: 640px }` (`chrome.mjs:180`) lets the plate shrink to 0.696 at 1440 and 0.436 at 1024. Two levers, use both: (a) widen the sheet — `.sheet { max-width: 1320px }` with the rail at 240 gives a 1,226 px text block and scale 0.79 on sheet 7; (b) raise the plate floor — `min-width: min(100%, 1180px)` so at narrow widths the plate scrolls in its own `overflow-x: auto` wrap like a drawing on a light table instead of collapsing. Then lettering can be judged at its drawn size.
- **Lettering sizes, once scale is fixed:** `lblf` 9 → 10, `lbls` 9.5 → 10.5, `lbl` 11 → 11.5. DIN measured 26 % narrower than the mono it replaced, so a 10 % size step still leaves every box roomier than it was — the same probe that found the 3A backlog will confirm no new overlaps. Effective sizes at 0.79 become 7.9 / 8.3 / 9.1 px.
- **Line weights are right** — `.sk` 1.3, `.sk2` 2, `.skf` 1, `.ska` 1.6 form a readable family and survive the 0.7 scale better than the type does. The hatch patterns at 5–6 px pitch moiré at 0.44 scale (1024) — another reason to hold the plate's scale up rather than let it float.
- **Plate-to-caption:** the figcaption is centred at 68ch under a left-aligned drawing whose callout boxes hug the left edge. Flush-left on the prose column, with a "FIG. 7·1 —" DIN lead-in as the specimen mock does, ties the caption to the plate.
- **The register-plate (12) and survey-office (14) lettering is the smallest in the set** at their native sizes and will still be under 8 px after the fix; those two should be re-lettered a step larger in their own generators when their box backlog is done.

---

## 6. Dark theme and responsive

### CYANO
Holds up. Ink/paper contrast is fine on the sheets, the plates keep their line hierarchy, the accent reads. Three weaknesses:
- `--red` becomes `#E38C6F` (salmon); the "halts a publish" mass on sheet 7 and the city reads as orange, and the chop loses its Cherokee identity. Try `#D96C55` for the fill roles and keep the salmon for hatch/strokes only.
- `--paper-2` (`#0D2344`) is nearly `--paper` (`#102A50`); the rail's active row, the stat-bar and table heads lose their tint. Push `--paper-2` to `#0B1F3E` or use a 1-px rule in dark as well.
- `--ink-faint` (`#5F7899`) on `--paper-2` for the 9.5-px basis lines is under 3:1. Same fix as light: those lines should not be faint 9.5-px text in either theme.

### 1024
No horizontal overflow anywhere (probe: `scrollW == clientWidth` on every page at every width). But: the rail stays at 240 and the content drops to 784, so the sheet is 735 wide, the plate scales to **0.436** (schedule lettering 3.9 px), the crumb wraps to 3 lines (44 px), the notes-grid becomes 395 + 264 and the title block cells are 131 px wide (`crop` visible in `w1024-sheet-7.png`). Between 900 and 1180 the right answer is a narrower rail (numbers only, 56 px, titles on hover/expand) or the plate scrolling at its own width; the current behaviour gives the plate the least room exactly where it needs the most.

### 390
- **The rail is not collapsed.** At ≤ 900 `.rail` goes `position: static` (`index.html:62–69`) and the entire 979-px list precedes every page. `/` is 12,699 px tall; sheet 7 is 7,004; the first plate appears 1,270 px down. This is the one P1 in the responsive set: at ≤ 900 the rail should be a 48-px header (name + "SHEETS ▾" + theme) with the list in a disclosure.
- The plate holds its 640 px minimum inside a 312 px column and scrolls sideways (scale 0.41) — acceptable for a drawing, but the figure needs a visible affordance (a right-edge fade or "SCROLL →" in DIN 9.5) since nothing signals it.
- The title block goes to 2 × 155 px cells; DRAWN BY at 16 px still fits. Cards go single column at 366 px and the cover's card grid is 8,439 px tall — the 4-up/2-line card recomposition in §4 fixes this for free.
- Crumb wraps to 5 lines (73 px). The bar split in §4 (nav left, metadata elsewhere) fixes it.

---

## 7. Triage table

Severity: **P1** fix now · **P2** next pass · **P3** guiding star. Effort: S < 1 h, M half a day, L a day or more.

| id | area | sev | issue | file / selector — current → proposed | effort |
|---|---|---|---|---|---|
| T1 | plate | P1 | plates render at 0.696 scale (0.436 at 1024); 9-px labels show at 6.3 px | full width, no cap: `.sheet { max-width: none; margin: 0 0 40px }` and `.figure-wrap svg { width: 100%; min-width: 1000px }` — the sheet fills the content column at every viewport (the user reads on a 3008-px display), the plate scrolls in its own wrap below 1000; only running text keeps a ch measure | S |
| T2 | layout | P1 | 1,663 px empty right column under title block on every sheet | `chrome.mjs:191` `.keyblock { position: sticky; top: 30px }`; move `.revs` into `.keyblock` in `sheetSection()` `:437–460` | S |
| T3 | layout | P1 | prose narrower than its column: 62ch = 481 px in a 638 px cell | `chrome.mjs:191–213` `.notes-grid 3fr 2fr → minmax(0,7fr) 352px`, `.notes p max-width 62ch → 66ch` | S |
| T4 | responsive | P1 | ≤ 900 the full 979-px rail precedes every page; `/` is 12,699 px tall at 390 | `index.html:62–69` collapse `.rail` to a 48-px header + disclosure | M |
| T5 | bug | P1 | card 1i shows literal `&lt;a uiSref&gt;` — caption is entity-escaped in the manifest then rendered as text | `views.ts:272` `<p>${sheet.caption}</p>` → `unsafeHTML`, or unescape in `emit-app.mjs` | S |
| T6 | type | P1 | rail entry titles in Exhibition 400 at 11.5 px, `--ink-soft`: hairline | `index.html:129–135` `.rail-links .t` weight 400 → 700, color → `--ink`, size 11.5 → 12 | S |
| T7 | type | P1 | code chips break mid-identifier (`census-`/`city.json`) | `chrome.mjs:225` `overflow-wrap: anywhere → break-word`; emit `<wbr>` after `/` in the generator for the sheet-11 chip | S |
| T8 | nav | P1 | city filed last on the rail as `S7·3D` and last of 24 cards | `views.ts:218–223` insert after 7B as `7·3D`; `views.ts:280–292` card order | S |
| T9 | type | P2 | THE article repeats 21× in the rail / 24× on cards; kit Exhibition has no dlig/salt/swsh/smcp (probed: identical 55.61 px advance for every feature) and no lowercase | `views.ts` rail + card templates: strip `/^THE\s+/` at render (col C of the mock), or DIN 9-px catchword (col D). Keep THE on `.sheet-title` and the title block | S — **DONE 2026-09-06**: neither column C nor column D, but the user's own third answer — "i kinda like the hwt catchwords sparingly but found myself converting `the` to a `<sup>` with .6em din-2014 font, lowercase". Every FULL title now keeps its article and draws it as `<sup class="art">the</sup>` — the data face at 0.6em of the title, lowercase, no tracking, `--ink-soft`, `line-height: 0`, and a no-break space of its own so the heading still reads "the MEASURED CITY". Styled once in `chrome.mjs` (hence in `sheets/atlas.css`, hence on all three hosts); applied at RENDER by `articleTitle()` in `chrome.mjs` and its twins in `views.ts`/`prerender.ts` — the manifest titles stay frozen — on the `.sheet-title` and title-block SHEET TITLE of every sheet in both sets, the cover cards, the hero caption and the app's `/log` and `/specimen` heads. The RAIL keeps column C's strip (T27 stands resolved). Sizes: 14.4 px at the title's 24-px clamp end, 10.8 px at 18; 8.1 px in the title block; 9 px on a card. HWT Catchwords ships in exactly ONE place — the cover's `THE ALTITUDE ATLAS`, key `e` at the bench's cap-matched 1.08em, gated on a `document.fonts` check for a DECLARED `hwt-catchwords`; off the kit (the artifact) the same sup draws instead. The specimen's TITLE ARTICLE knob gains `SUP · din 0.6em lowercase` as row 0 and its default. |
| T10 | nav | P2 | themer is three filled accent buttons at the top of the rail | `index.html:153–176` move to the top bar (T11); pressed state = underline, not fill | M |
| T11 | nav | P2 | crumb is a 228ch 10-px line mixing nav and plate metadata; wraps to 44 px at 1024, 73 px at 390 | `index.html:189–208` + `views.ts:315–357`: make `.crumb` a sticky 34-px bar, nav left, DOCS / GITHUB / FLAT SET / theme right; move ALTITUDE / PLATES READ / SEE ALSO to the inset strip | M |
| T12 | cover | P2 | cover has no display-size title; "THE INDEX" 24 px | `views.ts:248–258` add `<h1>` Eaglefeather 40–44 px above the sub | S |
| T13 | cover | P2 | hero: nothing visual above the fold; stat bar + survey + prose = 2,048 px before cards | move `.survey` language table + `cover.prose` to About; keep one stat row | M |
| T14 | cover | P2 | city hero + issue log (reverse-chrono from all sheets' `revs`) | new `cover.issueLog` in `emit-app.mjs`; still image of the city (build-time export), CTA → `/city/`; no three.js on `/` | L |
| T15 | cover | P2 | cards: 3-up at 371 px, rows stretch to 509 px, 24 cards = 3,175 px | `index.html:224–230` `.cards minmax(300px,1fr) → minmax(250px,1fr)`; clamp caption to 3 lines; drop `.verdict` from the card | S |
| T16 | cover | P3 | cards have no picture of the plate | emit a 259 × 150 SVG crop or PNG per sheet at build | L |
| T17 | type | P2 | `.sheet-title` tracking 0.12em on Exhibition (already wide-set) | `chrome.mjs:163` `letter-spacing 0.12em → 0.06em`; cards/title block 0.10em → 0.04em | S |
| T18 | type | P2 | nine distinct 9-px DIN styles | consolidate: field labels 9.5 px 0.16em; kickers 10 px 0.14em (`.fld`, `.revs th`, `.rail-sec`, `.kicker`, `.themer`, `.card .alt/.meta`, `.stat-bar .k`, `.lang th`) | S |
| T19 | type | P2 | code chip 0.85em → x-height 13 % under the prose | `chrome.mjs:219` `font-size 0.85em → 0.88em`, `padding 0 4px → 0 3px` | S |
| T20 | type | P2 | chip density: 14 bordered boxes in 15 lines | `chrome.mjs:217–226` drop the 1-px border, keep the `--paper-2` fill | S — **DONE 2026-09-06**: border dropped in `chrome.mjs` `.notes p code, .gal-body code` and in `app/index.html` `.prose code`; fill and `0 3px` padding kept. Sheet 7's first paragraph now reads as a tint, not a row of boxes. |
| T21 | type | P2 | DIN set as prose: city `.cs-basis` 9.5 px / 228ch / `--ink-faint`, About SOURCES 10.5 px, `.provenance` | `city.html:30`, `build.mjs:163`, About: Source Serif 13.5 px at 68ch, or cut to 2 lines | M — **DONE** 2026-09-06: both in Source Serif 13.5/1.5 `--ink-soft`. `.cs-basis` keeps its full-width frame (it closes the stage's box); the measure is held by `padding-right: max(14px, 100% - 68ch - 14px)` in `city-scene.mjs`. `.provenance` = `max-width: 68ch` in `build.mjs`. Wording untouched: the basis is now RE-FILED rather than cut — `fileBasisRevs()` splits the frozen string on the same ` REV <letter> ` seam `sheetSection()` uses and files the REV C/D sentences into the `.revs` block under the stage, each under its own rev headline (`.rev-note` sets them as prose, not 11.5-px DIN). Basis strip 756 → **432 px** at 1440. Dark: `--ink-soft` on `--paper-2` clears 3:1, which closes T32 too. |
| T22 | layout | P2 | REVISIONS description at 159ch, full-bleed | into the inset strip (T2) at 352 px; or `.revs .t max-width: 72ch` meanwhile | S |
| T23 | layout | P2 | figcaption centred at 68ch under a left-anchored drawing | `chrome.mjs:182` `margin: 10px auto 0 → 10px 0 0`; add a DIN "FIG. n —" lead | S |
| T24 | layout | P2 | frame ratio: inner border at 8 px, text at 26 px | `chrome.mjs:118–133` inset 8 → 12, padding 26 → 32 (or 8 / 22) | S |
| T25 | layout | P2 | air around the plate: 6 px above, 10 to caption | `chrome.mjs:179` `.figure-wrap margin 6px 0 18px → 20px 0 14px` | S |
| T26 | rail | P2 | INDEX / ABOUT / THE FLAT SET at sheet-entry size compete with the sheets | `index.html:97–118` `.rail-top a` → one 10-px line `INDEX · ABOUT`; flat set to the top bar | S |
| T27 | rail | P2 | 14i wraps to two lines (47 px) | resolved by T9; else `.rail-links .t` 11.5 → 11 for entries > 24 chars | S |
| T28 | responsive | P2 | 900–1180: rail 240 fixed, sheet 735, plate 0.436 | `index.html:47` add a 1180-px step: rail 56 px numbers-only, titles on expand | M |
| T29 | responsive | P2 | 390: plate scrolls sideways with no affordance | `.figure-wrap` right-edge fade + DIN "SCROLL →" at ≤ 720 | S |
| T30 | dark | P2 | `--red` → salmon `#E38C6F`; halts read orange, chop loses identity | `chrome.mjs:33–66` fill red `#D96C55`, keep salmon for hatch | S |
| T31 | dark | P2 | `--paper-2` ≈ `--paper` (`#0D2344` vs `#102A50`); tints vanish | `--paper-2: #0B1F3E` | S |
| T32 | dark | P2 | `--ink-faint` 9.5 px on `--paper-2` under 3:1 | resolved by T21; else `--ink-faint: #6E88A8` in dark | S |
| T33 | city | P2 | canvas 540 tall with the model in the middle 60 %; ground empty | `city.html:18` `height: 540 → 620` and camera zoom +15 %, or crop | S — **DONE** 2026-09-06: `city-scene.mjs` canvas 540 → 620 (860-px step 460 → 520). The zoom came from the FIT, not a crop: the vertical fit took `max |y|` about the ground centre, so a city that stands above that centre paid for its own height twice — it now takes the SPAN (`baseH = (hiY − loY)/2`) with the frustum recentred on `midY`. Scale 0.718 → 0.910 at 1440 (**+27 %**), nothing clipped at any of the four diagonals; the empty ground under the model is gone. Width is still the fit's slack side (the model is height-fit at every desktop width), so side air remains by construction. |
| T34 | city | P2 | legend at 9.5 px / controls at 9.5 px on the busiest bar in the set | `city.html:6,10` 9.5 → 10.5; split legend and controls onto two rows at < 1100 | S — **DONE** 2026-09-06: `.cs-legend .lg` and `.cs-ctl` 9.5 → 10.5 px; below 1100 the bar goes `flex-direction: column` (legend row, controls row) and the hint takes `flex: 1 1 240px` so RESET never falls to a row of its own. Bar at 1024: 83.75 → 92 px for a bar that is one step bigger and no longer interleaved. |
| T35 | city | P3 | `.cs-info h4` in code face at 11.5 px is the smallest heading on the site | 11.5 → 13 | S — **DONE** 2026-09-06: 11.5 → 13 px. Face KEPT as `--code`: the panel's heading is not a title but the member's verbatim package name (`@tools/lit-template-lint`), the same token the plates set as code; in `--data` it would read as a caption and lose the identity the panel is quoting. At 13 px it now stands a clear step over the 10.5-px DIN body under it. |
| T36 | about | P2 | SOURCES paragraph as 10.5-px DIN at 1,086 px | see T21 | S — **DONE** 2026-09-06: with T21 — Source Serif 13.5 px, 68ch = 459 px (was DIN 10.5 px at 1,108 px). It also MOVED into the reading column: it is a footnote to the colophon, so it now sits inside `.prose` in `views.ts` and in a `.prose` wrapper in `prerender.ts`, left edge flush with the body it follows; `.prose p.provenance` outranks `.prose p`'s 15.5 px so it stays a step under. |
| T37 | cover | P2 | `.gal-body p` 576 px flush-left in a 1,086 px box | into the 12-col model: text cols 1–7, stat insets 9–12; or centre until then | S |
| T38 | cover | P2 | `.stat-bar` flex `1 1 auto` wraps PUBLISHABLE PACKAGES to a full row and leaves INSTRUMENTS / LATEST SHIPPED half-empty | `build.mjs:134` explicit grid `2fr 1fr 1fr` | S — **DONE 2026-09-06**: `repeat(6, 1fr)` with a 1-px gap on an ink ground, not `2fr 1fr 1fr` — with five cells three columns still left one half-empty. The three one-line facts (REPOSITORY · INSTRUMENTS · LATEST SHIPPED) take the top row at a third each, the two roster paragraphs (PUBLISHABLE PACKAGES · SHEETS) a half each below; `statBar` reordered to match. 4 ragged rows / 252 px → 2 ruled rows / 173 px at 1440. |
| T39 | plate | P2 | label sizes once scale is fixed | `chrome.mjs:364–370` `lblf 9 → 10`, `lbls 9.5 → 10.5`, `lbl 11 → 11.5`; rerun the overlap probe | S — **DONE 2026-09-06**: all three steps applied. Overlap probe (flat set at 1440, this build against the pre-step build): **7 new overlaps on 5 sheets** — 12 (36 → 39), 10 (0 → 1), 3 (0 → 1), 3B (0 → 1), 7B (0 → 1); 1, 2, 2A, 4, 5, 6, 7, 7A, 8, 9, 11, 13, 14, A1 unchanged. Recomposition left to the plate lane. |
| T40 | plate | P3 | per-sheet box recomposition backlog (3A 33, 2A 6, 1 5, 14 3, 4 3, 5 3, 10 2) | each sheet's generator | L |
| T41 | plate | P3 | 12 and 14 lettered a step smaller than the rest | `sheet12.mjs`, `sheet14.mjs` after T40 | M |
| T42 | plate | P3 | hatch patterns moiré at ≤ 0.5 scale | held off by T1; else pitch 6 → 8 in `defs()` | S |
| T43 | type | P3 | Exhibition 400 face loaded but unused after T6 | none; it is 1 file — leave in the kit | — |
| T44 | type | P3 | `din-2014-narrow` in the kit, unused | reserve for plate schedule bodies if width is ever short; not for prose | — |
| T45 | type | P3 | `p22-fllw-eaglefeather-sc` in the kit, unused | the only legitimate small "THE" in the atlas *name*; not needed now | — |
| T46 | layout | P3 | 12-column model with feature insets (figures/tables floated into cols 9–12 beside the citing paragraph) | `chrome.mjs` `.notes-grid` → grid + `figure.inset { float: right; width: 352px }`; generators emit citing fragments as `<figure class="inset">` | L |
| T47 | nav | P3 | rail kicker "A DRAWING SET · lit-ui-router" is not a link | `views.ts:196` link to lit-ui-router.dev | S — **DONE 2026-09-06**: `<span class="kicker">` → `<a class="kicker" href="https://lit-ui-router.dev">` in `views.ts` **and** `prerender.ts`, byte-identical; `.rail-head .kicker` gains `text-decoration: none` and an accent underline on hover. The flat set's cover kicker is a different element and was left alone. |
| T48 | chrome | P3 | `.sheet` box-shadow (0 8px 28px) under a ruled frame — paper on a light table does not cast a soft shadow | `chrome.mjs:125` drop the blur, keep the 1-px edge | S — **DONE 2026-09-06**: `box-shadow: 0 1px 0 var(--edge)` only; the `0 8px 28px` blur is gone from `chrome.mjs` and therefore from the staged `atlas.css`. |
| T49 | cover | P3 | `.sheet-sub` on the cover at 181ch | resolved by T12/T13; else break into two lines | S — **DONE 2026-09-06**: it still ran 139 characters on one 1,108-px line after the title-sheet rework, so it is broken in two — the motto on `.sheet-sub`, the stamp (CLIENT · PLATES COUNTED) on a `display: block` `.cover-sub .stamp` in `--ink-faint`. 18 px → 39 px; holds at 390 and 3008. |
| T50 | prod | P1 | production is one deploy behind (Google links present, mono plates, no hand, specimen on the rail) | deploy the staged build | S |
| T51 | bug | P1 | `helpers.mjs::isoBlock` writes `class="sk" fill="var(--paper-2)"` and `fill="url(#hx)"`; every house stroke class sets `fill: none`, and CSS beats a presentation attribute, so the left face tint and the right-face hatch have never drawn (found while drawing A1, whose first cut lost all fills the same way) | `helpers.mjs:55–56` two-element idiom as sheetA1 does: a fill polygon with no stroke class, then the `.sk` outline over it; audit every `class="sk…" fill=` in generator/ | S |

---

## 8. Screenshot index

All under `/Users/simloovoo/.claude/jobs/a9024f9c/tmp/design-review/`. Staged unless noted.

| file | look at |
|---|---|
| `cover-top.png` | the cover at 1440: no title, stat table as hero, the rail's grey Exhibition stripe |
| `cover-full.png` | 5,323 px: 2,048 px of survey before cards; the city card last |
| `crop-cover-head.png` (2×) | "THE INDEX" at 24 px vs the 181ch sub; stat bar wrapping |
| `crop-cards.png` (2×) | card density, 509-px rows, `&lt;a uiSref&gt;` literal on card 1i |
| `sheet-7-top.png` | the plate at 0.696: schedule lettering at 6.3 px |
| `sheet-7.png` | the two-column hole: 2,273 px of notes beside 610 px of key + title block |
| `crop-sheet7-schedule.png` (2×) | the plate as drawn — this is how it should look at 1× |
| `crop-titleblock.png` (2×) | the title block: right; the hand in situ; the chop |
| `crop-drawn-by.png` (2×) | the hand value alone |
| `crop-rail-top.png` (2×) | rail head, three top links, themer, Exhibition 400 hairlines, the THE column |
| `mock-rail-article-treatments.png` (2×) | A as shipped · B article muted · C article dropped/700 · D DIN catchword · E 12.5/700 — the recommendation is C (or D) |
| `crop-revs.png` (2×) | REVISIONS at 159ch, full-bleed |
| `crop-notes.png` (2×) | prose at 62ch; chip density; mid-identifier chip breaks |
| `crop-notes-12.png` (2×) | the same on a chip-heavy sheet |
| `crop-sheet-head.png` (2×) | proj / shno line |
| `sheet-1.png` | the best-proportioned sheet — short notes, no hole; the model for the others |
| `sheet-3a.png` | worst ratio: notes 3.5× the plate; plate at ~40 % |
| `sheet-12.png`, `sheet-14.png` | smallest native lettering in the set |
| `city-top.png`, `city.png` | the city: the site's only motion; 540-px canvas with the model in the middle; basis wall below |
| `about.png` | the reading page at 72ch — right; the SOURCES line — wrong |
| `specimen-top.png` | lower half: the mock sheet already draws the inset column model |
| `flat-set-top.png` | the flat cover *has* a display-size title; the app cover should |
| `flat-sheet-7.png` | flat sheet 7 at 0.722 — same layout faults without the rail |
| `dark-cover-top.png`, `dark-sheet-7.png`, `dark-city-top.png` | CYANO: holds; salmon red, vanished `--paper-2` tint |
| `w1024-cover.png`, `w1024-sheet-7.png` | rail fixed at 240, plate at 0.436, crumb 3 lines |
| `w390-cover.png` (12,699 px), `w390-sheet-7.png`, `w390-sheet-7-top.png` | the uncollapsed rail above every page; plate scrolling at 0.41 |
| `prod/*.png` | the live site, same set — one deploy behind (mono plates, Google prose, no hand, `S0·T` on the rail) |
| `measure.log`, `overflow.log`, `kit.css` | computed styles, cap heights, feature probe; layout at 1440/1024/900/899/390; the served kit CSS (8 families, 24 faces, no feature params) |

---

## 8. Status, 2026-09-07

Audited against the source at 6e92017 after the P1 pass (b1c0942), the P2 pass (cf45bb0) and the copy re-draft (6e92017). The triage table above is left as written; this section is the record.

Closed in source: T1 T2 T3 T4 T5 T6 T8 T10 T11 T12 T13 T14 T15 T17 T18 T19 T23 T24 T25 T26 T27 T29 T30 T31 T32 T50 T51.

Moot: T22 (`.revs` retired with the copy re-draft; history is `HISTORY.md` → `/log`), T42 (trigger removed by T1), T43 T44 T45 (kit faces reserved by design; the cover's article is HWT + `sup.art`).

| id | sev | state | what is left |
|---|---|---|---|
| T7 | P1 | partial | `overflow-wrap: break-word` landed; no `<wbr>` after `/` in the sheet-11 chip |
| T28 | P2 | partial | notes-grid has its 1180 step; the rail has no 900–1180 narrow step (plate half moot after T1) |
| T37 | P2 | partial | `.gal-body p` measure fixed at 72ch; still flush-left, no col 9–12 insets |
| T16 | P3 | open | cards carry no picture of the plate |
| T40 | P3 | open | per-sheet box recomposition backlog; not re-measured since the T39 probe |
| T41 | P3 | open | 12 and 14 relettered a step larger — after T40 |
| T46 | P3 | open | 12-column model with feature insets; subsumes T37 |

---

## 9. Status, 2026-09-10

T7 and T28 close in source this pass. T40 was re-measured for the first time since the T39
probe; the remainder is far smaller than section 8 assumed, and section 8's T40 line was
stale in both directions — the named backlog (3A 33, 2A 6, 1 5, 14 3, 4 3, 5 3, 10 2) is
clean at HEAD, and so are the seven overlaps the T39 lettering step was blamed for on 12,
10, 3, 3B and 7B.

Closed in source: T7 (`chipBreaks()` in `chrome.mjs`, wired into `page()` and into
`emit-app.mjs`'s `linkRefs` + cover fields — 377 slash-bearing chips, all three hosts),
T28 (the 901–1180 band in `diagrams/app/index.html`: 56 px clipped rail, 240 px inner
width retained so every title keeps its accessible name, `:hover`/`:focus-within` expansion
painting over the sheet without reflow).

### T40 — the measured remainder

Playwright `getBBox` census over the 21 static plates, 1440×1000. Overlap = a text pair
sharing more than 3 px on both axes.

| sheet | overlaps | out of viewBox | what it actually is |
|---|---|---|---|
| 12 | 37 | 0 | one band, not 37 — 23 CI task names on a 23 px column pitch at y≈279 |
| 14 | 2 | 1 | one banner — `ONE BASIS — EVERY STATION RE-MATERIALIZE` originates at x = −124 |
| 5 | 1 | 1 | `WHO OWNS NAVIGATION ↑` outgrew its gutter, crosses `FRAMEWORK` |
| A1 | 0 | 1 | a single `!` a hair over an edge |
| the other 17 | 0 | 0 | |

Sheet 12's band is the whole of its count: names up to 17 characters (`test:mobx6-compat`)
laid horizontally into a 23 px pitch. A punchcard letters its column heads on the slant;
rotating that band is both the idiomatic fix and the only one that fits. It is also what
makes T41 possible on 12 — the plate is lettered small *because* the band is cramped, so
the recomposition and the relettering are one job per sheet.

The four interactive twins (1i, 2B, 12i, 14i) build their SVG at runtime and were not
measured — the `file://` probe reports no plate for them. Measure those against the served
app before calling T40 done.

Probe: `collide-flat.mjs` (job tmp), reads the flat set over `file://`, writes per-pair
detail to `collide-flat.json`.

### T52 — the notes column, next to the sticky rail (P2, new)

Sheet notes beside the sticky right rail want to stop being one narrow measure and become a
real multi-column block:

- drop the `max-width`; set `column-count: calc(100cqw / 800px)` (or thereabouts) so the
  count follows the container rather than a breakpoint
- widen the grid gap
- paragraph `line-height` to ~1.8, bottom margin to ~2em
- size up: 15.5 → 18 px, and either letter-space out ~1px or let the size carry it alone
- `h3` takes `column-span: all`; consider a larger size and more space around it

Cross-check against T37 and T46 before building — all three are the same prose column.

### T53 — buildings 15 and 32 overlap (P2, new)

Buildings 15 (`@tools/build_and_test`, x = 330) and 32 (`@tools/embed-heights`, x = 430)
overlap on the city sheets. Diagnosed: there is no plot allocator. `sheet7.mjs`'s `PLACED`
array carries a hand-written x/y per member, but the footprint drawn at that point is
data-driven — side ∝ √sloc, with a hatched annex ∝ √specSloc set `AG = 10` beyond it, and
the isometric projection widens each square's silhouette by about √3. Member 15 now
measures 1128 src sloc against 1163 spec sloc, so its block *and* an annex slightly larger
than the block have to fit inside the 100 units to its neighbour, and they no longer do.
Member 32 is small (336 / 33) and did not move; 15 grew into it.

So it is not a sprite bug and nothing is resolving to the same slot — a census refresh
walked a fixed coordinate into its neighbour. That makes it the same class of problem as
T40: hand-placed lettering and hand-placed geometry both silently rot as the data behind
them grows. Two ways out, and the choice is a design call, not a repair:

- give the district a real allocator that packs from the measured silhouettes, so no
  coordinate is ever hand-held against live data again; or
- keep the hand placement (it is deliberate — the districts read as a site plan) and add a
  build-time assertion that fails when two silhouettes intersect, so the drawing cannot
  ship overlapped and the coordinate gets re-composed by hand when the census moves it.

The second is cheaper and fits the set's existing "one basis, computed, never guessed"
posture — the atlas already throws on a missing member. Worth pairing with the T40 probe:
that census measures `<text>` only, which is exactly why this went unseen.
