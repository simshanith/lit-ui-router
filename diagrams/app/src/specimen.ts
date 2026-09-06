/**
 * <atlas-specimen> — THE TYPE SPECIMEN.
 *
 * A bench, not a plate: one mock sheet drawn in the atlas's own chrome, with
 * every type role swapped on the mock's root by inline style — `--display`,
 * `--title`, `--rail-title`, `--data`, `--prose`, `--hand`, `--code` — so six
 * candidate pairings and seven INDEPENDENT knobs (sheet title, rail titles,
 * data face, data size, prose, code, hand) can be compared on the same copy, in
 * both themes, on both hosts. A pairing is a starting point, not a cage:
 * picking one resets the knobs it owns, and every knob then overrides it.
 *
 * PAIRING 5 · THE ATLAS SET IS THE DECISION, taken 2026-09-05, and the bench
 * opens on it: the same set `generator/chrome.mjs` now declares as `--display`
 * / `--title` / `--data` / `--prose` / `--code` for the whole atlas chrome. The
 * other five rows are the record of what it was chosen against.
 *
 * TWO HOSTS, ONE STACK. Every stack below names the ADOBE family first and the
 * Google Fonts stand-in second. On the live site `generator/stage-site.mjs`
 * injects the Adobe Fonts kit into EVERY STAGED PAGE (when `VITE_ADOBE_FONTS_KIT`
 * is set at stage time), so the first name wins; in the single-file artifact —
 * and on the site with no kit — only the Google stand-ins load and the second
 * name wins. The LOADED FACES readout reports which one actually rendered
 * rather than which one was asked for.
 *
 * PAYLOAD. The Google Fonts <link> is injected by `connectedCallback`, so the
 * faces are fetched by the one state that needs them and by no other page in
 * the app — the same rule `atlas.city` follows for three.js.
 */
import { LitElement, html } from 'lit';
import type { TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { SPECIMEN_CSS, SPECIMEN_MOCK } from './specimen-mock.ts';

// --- the faces -------------------------------------------------------------

/**
 * ADOBE FONTS — the CSS family names, in ONE table.
 *
 * `IN THE KIT` rows were read off the live kit's own stylesheet
 * (`https://use.typekit.net/<id>.css`, re-read 2026-09-05: 17 families). Two
 * traps in the names: THREE l's in `p22-fllw-…`, and `-pro` on every Univers
 * Next, Myriad and Tekton family. Do not derive these from the marketing names.
 *
 * WEIGHTS. The kit serves 400 and 700 (one 500). Everywhere the plan said
 * Demi/600 the CSS asks for 600 and gets 700 from Adobe, 600 from Google: CSS
 * font matching resolves a 600 request upward to 700 when only 400/700 exist,
 * so ONE weight number serves both hosts and nothing is synthesised.
 *
 * `woff2` is the measured latin subset the kit actually serves, Regular/Bold in
 * KB, blank where it has not been measured. It is the site's cost, not the
 * artifact's — the artifact loads the Google stand-ins and never a kit file.
 *
 * The `kit: false` rows are families the design memo found inside the Creative
 * Cloud subscription that are NOT in this web project. Nothing breaks while
 * they are absent: every stack names a Google stand-in behind the Adobe
 * family, and the LOADED FACES readout simply says STAND-IN. Flipping `kit` is
 * the whole edit when one is added.
 */
export const ADOBE_FAMILIES = [
  {
    css: 'p22-fllw-eaglefeather',
    name: 'P22 FLLW Eaglefeather (400/700 + italic)',
    role: 'display · Prairie, The Kit',
    woff2: '32 / 29',
    kit: true,
  },
  {
    css: 'p22-fllw-eaglefeather-sc',
    name: 'P22 FLLW Eaglefeather Small Caps',
    role: 'sheet title · the EAGLEFEATHER SC knob',
    woff2: '',
    kit: true,
  },
  {
    css: 'p22-fllw-eaglefeather-inf',
    name: 'P22 FLLW Eaglefeather Informal',
    role: 'unused — display alternate',
    woff2: '',
    kit: true,
  },
  {
    // FLW here, not FLLW: Exhibition and Eaglefeather spell the Wright
    // abbreviation differently in the same kit. Verified against the kit's own
    // stylesheet, not guessed.
    css: 'p22-flw-exhibition',
    name: 'P22 FLW Exhibition',
    role: 'sheet title · the EXHIBITION knob',
    woff2: '',
    kit: true,
  },
  {
    css: 'din-2014',
    name: 'DIN 2014 (400/700)',
    role: 'data · Prairie / Drafting; sheet title · the DIN knob',
    woff2: '15 / 16',
    kit: true,
  },
  {
    css: 'din-2014-narrow',
    name: 'DIN 2014 Narrow',
    role: 'unused — schedules, if the ledger has to tighten',
    woff2: '',
    kit: true,
  },
  {
    css: 'tekton-pro',
    name: 'Tekton Pro',
    role: 'hand · the TEKTON PRO knob',
    woff2: '46 / 45',
    kit: true,
  },
  {
    css: 'tekton-pro-condensed',
    name: 'Tekton Pro Condensed',
    role: 'unused — hand alternate',
    woff2: '',
    kit: true,
  },
  {
    css: 'tekton-pro-extended',
    name: 'Tekton Pro Extended',
    role: 'unused — hand alternate',
    woff2: '',
    kit: true,
  },
  {
    css: 'univers-next-pro',
    name: 'Univers Next Pro (400/700 + italic)',
    role: 'data · Signage',
    woff2: '27 / 28',
    kit: true,
  },
  {
    css: 'univers-next-pro-condensed',
    name: 'Univers Next Pro Condensed (400/700 + italic)',
    role: 'display · Signage; data · The Kit',
    woff2: '',
    kit: true,
  },
  {
    css: 'univers-next-pro-compressed',
    name: 'Univers Next Pro Compressed',
    role: 'unused — dimension strings',
    woff2: '',
    kit: true,
  },
  {
    css: 'univers-next-pro-extended',
    name: 'Univers Next Pro Extended',
    role: 'unused — cover / title strip',
    woff2: '',
    kit: true,
  },
  {
    css: 'myriad-pro',
    name: 'Myriad Pro',
    role: 'unused — humanist data alternate',
    woff2: '27 / 27',
    kit: true,
  },
  {
    css: 'myriad-pro-semi-condensed',
    name: 'Myriad Pro Semi Condensed',
    role: 'unused — humanist data alternate',
    woff2: '',
    kit: true,
  },
  {
    css: 'myriad-pro-cond',
    name: 'Myriad Pro Condensed',
    role: 'unused — humanist data alternate',
    woff2: '',
    kit: true,
  },
  {
    css: 'myriad-pro-light-semiext',
    name: 'Myriad Pro Light SemiExtended',
    role: 'unused — cover / title strip',
    woff2: '',
    kit: true,
  },
  {
    css: 'minion-pro',
    name: 'Minion Pro',
    role: 'prose · the MINION PRO knob — NOT in the kit yet (falls to Source Serif 4)',
    woff2: '',
    kit: false,
  },
  {
    css: 'source-serif-4',
    name: 'Source Serif 4',
    role: 'prose · SHIPPED — the Google family answers on both hosts, so the prose needs no kit',
    woff2: '',
    kit: false,
  },
  {
    css: 'source-code-pro',
    name: 'Source Code Pro',
    role: 'code · the SOURCE CODE PRO knob — the Google family answers on both hosts',
    woff2: '',
    kit: false,
  },
  {
    css: 'graphite-std',
    name: 'Graphite Std',
    role: 'NOT in the kit — pencil register',
    woff2: '',
    kit: false,
  },
  {
    css: 'p22-flw-terracotta',
    name: 'P22 FLW Terracotta',
    role: 'NOT in the kit — display alternate',
    woff2: '',
    kit: false,
  },
  {
    css: 'p22-flw-midway',
    name: 'P22 FLW Midway',
    role: 'NOT in the kit — display alternate',
    woff2: '',
    kit: false,
  },
  {
    css: 'isonorm',
    name: 'Isonorm',
    role: 'NOT in the kit — ISO 3098 lettering',
    woff2: '',
    kit: false,
  },
  {
    css: 'din-condensed',
    name: 'DIN Condensed',
    role: 'NOT in the kit — use din-2014-narrow',
    woff2: '',
    kit: false,
  },
] as const;

/**
 * The system monospace — chrome.mjs's `--mono`, written out rather than read
 * through the custom property because it is also handed to `ctx.font` and to a
 * hidden span's `font` shorthand, neither of which resolves `var()`.
 */
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

interface Face {
  /** The Adobe Fonts family, first in the stack. Null when there is none. */
  adobe: string | null;
  /** The Google Fonts stand-in, second in the stack. Null = the system face. */
  standin: string | null;
  /** The whole `font-family` value. */
  stack: string;
}

/** chrome.mjs's `--serif`, written out for the same reason as MONO. */
const SERIF = '"Charter", "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif';

const systemMono: Face = { adobe: null, standin: null, stack: MONO };
const systemSerif: Face = { adobe: null, standin: null, stack: SERIF };

const face = (adobe: string | null, standin: string, generic: string): Face => ({
  adobe,
  standin,
  stack: [adobe ? `"${adobe}"` : '', `"${standin}"`, generic].filter(Boolean).join(', '),
});

/**
 * THE HAND, as its own knob — INDEPENDENT of the pairing.
 *
 * User constraint: "i swear i'm just allergic to these hand types. maybe in
 * situ i'll appreciate". So NONE is the DEFAULT and it is a real option, not a
 * placeholder: the two hand slots simply render in the data face, which is what
 * the set would ship if the hand never earns its place. The two hand faces stay
 * one click away for the in-situ judgement.
 *
 * `tekton-pro` is the kit's CSS name (verified 2026-09-05); off the site the
 * stack falls to Architects Daughter and LOADED FACES reports STAND-IN.
 */
export const HANDS = [
  {
    id: 'none',
    label: 'NONE',
    face: null,
    note: 'the DRAWN BY value and the one callout line render in the data face',
  },
  {
    id: 'daughter',
    label: 'ARCH. DAUGHTER',
    face: face(null, 'Architects Daughter', 'cursive'),
    note: 'the open stand-in — both hosts',
  },
  {
    id: 'tekton',
    label: 'TEKTON PRO',
    face: face('tekton-pro', 'Architects Daughter', 'cursive'),
    note: 'the Adobe original; falls to Architects Daughter where the kit is absent',
  },
] as const;

/**
 * THE SHEET TITLE, as its own knob — INDEPENDENT of the pairing's display face.
 *
 * User feedback on the live bench: Eaglefeather on THE ALTITUDE ATLAS "looks
 * great", but "not huge-ist fan of measured city with the s" — its S is the
 * problem on a sheet title, not on the atlas name. So the rail head keeps
 * `--display` and the SHEET title (plus the title block's PROJECT / SHEET
 * TITLE values) gets `--title`, which this table drives. "liked josephine
 * [Josefin] quite a bit actually but for the title... maybe worth rendering"
 * is row 1; "really liking din" is row 2.
 *
 * `size` is picked so the cap-height stays near the baseline mono's sheet
 * title (23px × 0.729 = 16.8 ink): Josefin and Eaglefeather SC run about 0.70
 * cap/em so they take 24px, DIN 2014 about 0.72 so it takes 23px. SAME AS
 * DISPLAY inherits the pairing's own display size and weight, which is exactly
 * what the bench drew before this knob existed.
 */
export const SHEET_TITLES = [
  {
    id: 'same',
    label: 'SAME AS DISPLAY',
    face: null,
    weight: 0,
    track: '',
    size: '',
    note: "the pairing's own display face — how the bench drew before this knob",
  },
  {
    id: 'josefin',
    label: 'JOSEFIN SANS 600',
    face: face(null, 'Josefin Sans', 'sans-serif'),
    weight: 600,
    track: '0.14em',
    size: '24px',
    note: 'the geometric caps on the sheet title, with the display left alone',
  },
  {
    id: 'din',
    label: 'DIN 2014 700',
    face: face('din-2014', 'Barlow Semi Condensed', 'sans-serif'),
    weight: 700,
    track: '0.10em',
    size: '23px',
    note: 'the ledger face promoted to the title — one voice from the schedule up',
  },
  {
    id: 'eaglefeather-sc',
    label: 'EAGLEFEATHER SC',
    face: face('p22-fllw-eaglefeather-sc', 'Josefin Sans', 'sans-serif'),
    weight: 400,
    track: '0.12em',
    size: '24px',
    note: 'the small-caps cut, whose S is the one the full caps got wrong',
  },
  {
    id: 'exhibition',
    label: 'FLW EXHIBITION',
    // FLW, not FLLW — Exhibition and Eaglefeather spell the Wright
    // abbreviation differently in the same kit. Read off the kit, not guessed.
    face: face('p22-flw-exhibition', 'Josefin Sans', 'sans-serif'),
    weight: 400,
    track: '0.14em',
    size: '24px',
    note: "Wright's exhibition lettering — the other P22 FLW display cut",
  },
] as const;

/**
 * THE DATA FACE, as its own chooser — INDEPENDENT of the pairing.
 *
 * The ledger face is the one the atlas spends most of its ink on, and the user
 * asked to see the two the pairings never surfaced: "i want to see univers and
 * myriad still don't think i've seen the option yet". So the six candidates are
 * a knob rather than a consequence of the pairing. Picking a pairing sets this
 * knob to that pairing's own default; every click after that overrides it.
 *
 * `tnum` matters here: schedules, sheet numbers and dates all need TABULAR
 * figures. Barlow (all widths), Fira Sans, DIN 2014 and Univers Next have them;
 * Source Sans 3 does NOT, which is the one real cost of the Myriad stand-in and
 * is called out in its note.
 */
export const DATA_FACES = [
  {
    id: 'din',
    label: 'DIN 2014',
    face: face('din-2014', 'Barlow Semi Condensed', 'sans-serif'),
    note: 'the blueprint ledger — the face a real drawing letters its numbers in; tnum on both sides',
  },
  {
    id: 'barlow',
    label: 'BARLOW',
    face: face(null, 'Barlow', 'sans-serif'),
    note: 'the plain (un-condensed) width, Google on BOTH hosts — "i like the barlow"; tnum',
  },
  {
    id: 'univers',
    label: 'UNIVERS NEXT PRO',
    face: face('univers-next-pro', 'Fira Sans', 'sans-serif'),
    note: 'the neo-grotesque at full width — the widest ledger here, and the most neutral; tnum',
  },
  {
    id: 'univers-cond',
    label: 'UNIVERS NEXT COND.',
    face: face('univers-next-pro-condensed', 'Fira Sans Condensed', 'sans-serif'),
    note: 'Univers with the width axis pulled in — buys the most line length of the six; tnum',
  },
  {
    id: 'myriad',
    label: 'MYRIAD PRO',
    face: face('myriad-pro', 'Source Sans 3', 'sans-serif'),
    note: 'the humanist option. WARNING: the stand-in (Source Sans 3) has NO tnum, so off the site the schedule figures stop aligning — the one candidate that cannot carry a ledger on both hosts',
  },
  {
    id: 'myriad-sc',
    label: 'MYRIAD SEMI-COND.',
    face: face('myriad-pro-semi-condensed', 'Fira Sans Condensed', 'sans-serif'),
    note: 'humanist, narrowed — Fira Sans Condensed stands in for it and DOES have tnum',
  },
  {
    id: 'mono',
    label: 'SYSTEM MONO',
    face: systemMono,
    note: "today's ledger face, and the baseline every measurement below is taken against",
  },
] as const;

const dataFaceIndex = (id: string): number => {
  const at = DATA_FACES.findIndex((row) => row.id === id);
  return at === -1 ? 0 : at;
};

/**
 * THE PROSE FACE — the General Notes paragraph and the figcaption body, the
 * only running text a sheet carries.
 *
 * The default is the Charter stack the set already uses: a SYSTEM face, zero
 * bytes, and the reason none of the pairings ever costed it. The three
 * alternatives each pull their own Google family, so `google` is loaded ON
 * DEMAND — a second <link>, appended the first time an option that needs it is
 * chosen — and the page's default payload does not grow by a byte.
 */
export const PROSE_FACES = [
  {
    id: 'charter',
    label: 'CHARTER STACK',
    face: systemSerif,
    google: '',
    note: "today's --serif: Charter, Bitstream Charter, Sitka Text, Cambria, Georgia — 0 bytes",
  },
  {
    id: 'source-serif',
    label: 'SOURCE SERIF 4',
    face: face('source-serif-4', 'Source Serif 4', 'serif'),
    // already in GOOGLE_FONTS_HREF — the shipped face costs no second request
    google: '',
    note: 'SHIPPED — Slimbach’s open text serif, the same family on BOTH hosts, so the site and the artifact agree',
  },
  {
    id: 'minion',
    label: 'MINION PRO',
    face: face('minion-pro', 'Source Serif 4', 'serif'),
    // its stand-in is the shipped face, which the default link already carries
    google: '',
    note: 'the Adobe original, with Source Serif 4 standing in wherever the kit is absent',
  },
  {
    id: 'charis',
    label: 'CHARIS SIL',
    face: face(null, 'Charis SIL', 'serif'),
    google: 'Charis+SIL',
    note: 'the Charter descendant — closest of the three to what the set draws today',
  },
] as const;

/**
 * THE CODE FACE, as its own knob — the identifiers in the notes and the
 * schedule's id column.
 *
 * SYSTEM MONO is the SHIPPED default and the reason the plates are safe: the
 * SVG `<text>` positions are hand-tuned to its advance, so this knob exists to
 * show that the one alternative on the table costs nothing in metrics —
 * Menlo ≈ 0.602em, Source Code Pro ≈ 0.600em, a 0.3% difference. The user:
 * "i think i'm looking at menlo and liking it fwiw. wouldn't mind looking at
 * source mono option but nice to stick with system".
 *
 * Source Code Pro's Google family loads ON DEMAND, like the PROSE extras, so
 * the default page pulls nothing for this role.
 */
export const CODE_FACES = [
  {
    id: 'mono',
    label: 'SYSTEM MONO',
    face: systemMono,
    google: '',
    note: "today's --code, and the SHIPPED choice: ui-monospace / SF Mono / Menlo / Consolas — 0 bytes, and the advance every plate's lettering is placed against",
  },
  {
    id: 'source-code',
    label: 'SOURCE CODE PRO',
    face: face('source-code-pro', 'Source Code Pro', 'monospace'),
    google: 'Source+Code+Pro:wght@400',
    note: "Slimbach's open mono — Adobe on the site, the same family from Google elsewhere; its 0.600em advance is within 0.3% of Menlo's, so the plate lettering would not move",
  },
] as const;

export interface Pairing {
  id: string;
  label: string;
  note: string;
  display: Face;
  /** An id in DATA_FACES: what picking this pairing sets the DATA FACE knob to. */
  dataDefault: string;
  /** An id in SHEET_TITLES / PROSE_FACES: what picking this pairing resets them
   *  to. Omitted means the bench's own default — SAME AS DISPLAY, the Charter
   *  stack, rail titles in the data face. */
  titleDefault?: string;
  proseDefault?: string;
  railDefault?: boolean;
  code: Face;
  dispWeight: number;
  dispTrack: string;
  dispSize: string;
  /**
   * Base data size in px, picked so the face's CAP-HEIGHT lands on the
   * baseline mono's at 10.5px (ink cap 7.65 in Chromium): the mono runs
   * 0.729 cap/em and the condensed grotesques about 0.70, so 11px is the
   * conservative match, not the 12px that merely looks bigger.
   */
  dataSize: number;
}

/**
 * THE PAIRINGS — the display voice, and a starting point for the ledger.
 *
 * `dataSize` is conservative on purpose. The point of the size readout below
 * the mock is to check that the data face's CAP-HEIGHT lands on the mono's at
 * these sizes, not that the type got bigger.
 */
export const PAIRINGS: Pairing[] = [
  {
    id: 'base',
    label: '0 · BASELINE',
    note: "today's stack — every role is the system monospace, prose is the Charter stack, and the hierarchy problem stays",
    display: systemMono,
    dataDefault: 'mono',
    code: systemMono,
    dispWeight: 600,
    dispTrack: '0.10em',
    dispSize: '23px',
    dataSize: 10.5,
  },
  {
    id: 'prairie',
    label: '1 · PRAIRIE',
    note: 'display Josefin Sans 600 (site: P22 FLLW Eaglefeather) · data DIN 2014 / Barlow Semi Condensed, tnum (700 answers the 600 on the Adobe side) · code system mono · ≈73 KB',
    display: face('p22-fllw-eaglefeather', 'Josefin Sans', 'sans-serif'),
    dataDefault: 'din',
    code: systemMono,
    dispWeight: 600,
    dispTrack: '0.16em',
    dispSize: '26px',
    dataSize: 11,
  },
  {
    id: 'drafting',
    label: '2 · DRAFTING',
    note: 'display Zilla Slab 700 — the open face IS the choice, there is no Adobe upgrade for it · data as Prairie · ≈61 KB, the lightest set',
    display: face(null, 'Zilla Slab', 'serif'),
    dataDefault: 'din',
    code: systemMono,
    dispWeight: 700,
    dispTrack: '0.08em',
    dispSize: '26px',
    dataSize: 11,
  },
  {
    id: 'signage',
    label: '3 · SIGNAGE',
    note: 'display Univers Next Pro Condensed 700 (stand-in Fira Sans Condensed) · data Univers Next Pro (stand-in Fira Sans), tnum · ≈66 KB · both Adobe faces are in the kit',
    display: face('univers-next-pro-condensed', 'Fira Sans Condensed', 'sans-serif'),
    dataDefault: 'univers',
    code: systemMono,
    dispWeight: 700,
    dispTrack: '0.06em',
    dispSize: '26px',
    dataSize: 11,
  },
  {
    id: 'kit',
    label: '4 · THE KIT',
    note: 'the cross pairing — P22 FLLW Eaglefeather over the Univers Next Pro Condensed ledger: the Wright display on the signage numbers',
    display: face('p22-fllw-eaglefeather', 'Josefin Sans', 'sans-serif'),
    dataDefault: 'univers-cond',
    code: systemMono,
    dispWeight: 600,
    dispTrack: '0.16em',
    dispSize: '26px',
    dataSize: 11,
  },
  {
    // THE DECISION, 2026-09-05. Adopted across the atlas chrome by
    // generator/chrome.mjs and app/index.html; this row is the bench copy of
    // it, and the DEFAULT pairing, so the specimen opens on what the set ships.
    id: 'atlas',
    label: '5 · THE ATLAS SET',
    note: 'THE SHIPPED SET — display P22 FLLW Eaglefeather (stand-in Josefin Sans 600) on the atlas name alone · title P22 FLW Exhibition (stand-in Josefin Sans 600) on sheet AND rail titles · data DIN 2014 / Barlow Semi Condensed, tnum · prose Source Serif 4, the same family on both hosts · code system mono · NO hand',
    display: face('p22-fllw-eaglefeather', 'Josefin Sans', 'sans-serif'),
    dataDefault: 'din',
    titleDefault: 'exhibition',
    proseDefault: 'source-serif',
    railDefault: true,
    code: systemMono,
    dispWeight: 600,
    dispTrack: '0.16em',
    dispSize: '26px',
    dataSize: 11,
  },
];

const indexIn = <T extends { id: string }>(rows: readonly T[], id: string): number => {
  const at = rows.findIndex((row) => row.id === id);
  return at === -1 ? 0 : at;
};

/** The pairing the bench opens on: the set the atlas actually ships. */
const DEFAULT_PAIRING = indexIn(PAIRINGS, 'atlas');

// --- font loading, this state only ----------------------------------------

/**
 * The stand-ins the bench needs to draw ANY pairing, in ONE request. The PROSE
 * knob's serifs are deliberately NOT here — they load on demand (below), so
 * this is the whole of the page's default font payload.
 *
 * Fira Sans Condensed carries 400 and 600 as well as 700 because it stands in
 * for BOTH a display face (Univers Next Pro Condensed, 700) and two ledger
 * faces (Univers Next Pro Condensed and Myriad Pro Semi Condensed, 400/600).
 */
export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@600' +
  // Source Serif 4 is the SHIPPED prose face (pairing 5), so it is part of the
  // bench's default payload rather than one of the on-demand extras.
  '&family=Source+Serif+4:ital,wght@0,400;1,400' +
  '&family=Zilla+Slab:wght@700' +
  '&family=Barlow+Semi+Condensed:wght@400;600' +
  '&family=Barlow:wght@400;600' +
  '&family=Source+Sans+3:wght@400;600' +
  '&family=Fira+Sans+Condensed:wght@400;600;700' +
  '&family=Fira+Sans:wght@400;600' +
  '&family=Architects+Daughter' +
  '&display=swap';

const LINK_ID = 'atlas-specimen-fonts';
const STYLE_ID = 'atlas-specimen-css';

/**
 * Injects the stand-ins' stylesheet, once per document. Resolves when it has
 * loaded OR failed — offline is a legitimate outcome and the readout says so.
 */
function ensureGoogleFonts(): Promise<void> {
  if (document.getElementById(LINK_ID)) return Promise.resolve();
  for (const [href, cors] of [
    ['https://fonts.googleapis.com', false],
    ['https://fonts.gstatic.com', true],
  ] as const) {
    const pre = document.createElement('link');
    pre.rel = 'preconnect';
    pre.href = href;
    if (cors) pre.crossOrigin = '';
    document.head.append(pre);
  }
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_HREF;
  const settled = new Promise<void>((resolve) => {
    link.addEventListener('load', () => { resolve(); }, { once: true });
    link.addEventListener('error', () => { resolve(); }, { once: true });
  });
  document.head.append(link);
  return settled;
}

const PROSE_LINK_ID = 'atlas-specimen-prose-fonts';
const proseWanted = new Set<string>();

/**
 * The PROSE knob's serifs, loaded ON DEMAND.
 *
 * The default prose face is a system stack, so none of these ship with the
 * page: the first time an option that needs a Google family is chosen, this
 * appends (or widens) a SECOND stylesheet link. Choosing two of them widens the
 * one link rather than adding another request.
 */
function ensureProseFont(query: string): Promise<void> {
  if (!query || proseWanted.has(query)) return Promise.resolve();
  proseWanted.add(query);
  const href = `https://fonts.googleapis.com/css2?family=${[...proseWanted].join('&family=')}&display=swap`;
  let link = document.getElementById(PROSE_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = PROSE_LINK_ID;
    link.rel = 'stylesheet';
    document.head.append(link);
  }
  const settled = new Promise<void>((resolve) => {
    link.addEventListener('load', () => { resolve(); }, { once: true });
    link.addEventListener('error', () => { resolve(); }, { once: true });
  });
  link.href = href;
  return settled;
}

/** The mock's stylesheet, injected once so a re-render never re-parses it. */
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SPECIMEN_CSS;
  document.head.append(style);
}

// --- measurement -----------------------------------------------------------

interface Metric {
  cap: number;
  xh: number;
  adv: number;
}

/** The kind of string the data face actually has to set on a sheet. */
const SAMPLE =
  'SHEET 7 OF 14 · 1,383 SLOC · 32 MEMBERS · REV E · 2026-09-04 · WHOLE WORKSPACE · b2338d0';

let scratch: HTMLCanvasElement | null = null;

/**
 * Cap-height, x-height and average advance at a given size.
 *
 * The advance is measured the honest way — a hidden span carrying the sample,
 * `getBoundingClientRect().width / length` — because that is the width the
 * layout will really give it. The two heights come from the canvas's
 * `actualBoundingBox*`, the only API that reports INK rather than the em box a
 * span's rect always returns.
 */
function measure(host: HTMLElement, stack: string, size: number, weight: number): Metric {
  const span = document.createElement('span');
  span.style.cssText =
    'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;letter-spacing:0;' +
    `font:${String(weight)} ${String(size)}px ${stack};`;
  span.textContent = SAMPLE;
  host.append(span);
  const adv = span.getBoundingClientRect().width / SAMPLE.length;
  span.remove();

  scratch ??= document.createElement('canvas');
  const ctx = scratch.getContext('2d');
  let cap = 0;
  let xh = 0;
  if (ctx) {
    ctx.font = `${String(weight)} ${String(size)}px ${stack}`;
    cap = ctx.measureText('H').actualBoundingBoxAscent;
    xh = ctx.measureText('x').actualBoundingBoxAscent;
  }
  return { cap, xh, adv };
}

const px = (n: number): string => n.toFixed(2);
const delta = (a: number, b: number): string => {
  if (!b) return '—';
  const pct = ((a - b) / b) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
};

// --- the element -----------------------------------------------------------

type Rendered = 'ADOBE' | 'STAND-IN' | 'SYSTEM';

interface FaceReport {
  role: string;
  asked: string;
  got: Rendered;
  detail: string;
}

export class AtlasSpecimen extends LitElement {
  static override properties = {
    pairing: { state: true },
    sheetTitle: { state: true },
    railMatch: { state: true },
    hand: { state: true },
    dataFace: { state: true },
    prose: { state: true },
    code: { state: true },
    size: { state: true },
    faces: { state: true },
    metrics: { state: true },
  };

  declare pairing: number;
  /** Index into SHEET_TITLES. 0 = SAME AS DISPLAY, which is the default. */
  /** `title` is taken by HTMLElement, hence the longer name. */
  declare sheetTitle: number;
  /** RAIL TITLES: false = the data face (today's spec), true = match the title. */
  declare railMatch: boolean;
  /** Index into HANDS. 0 = NONE, which is the default. */
  declare hand: number;
  /** Index into DATA_FACES. Reset by the pairing, then overridden by the knob. */
  declare dataFace: number;
  /** Index into PROSE_FACES. 0 = the Charter stack, which costs nothing. */
  declare prose: number;
  /** Index into CODE_FACES. 0 = the system mono, which is what ships. */
  declare code: number;
  declare size: number;
  declare faces: FaceReport[];
  declare metrics: { base: Metric; data: Metric; code: Metric } | null;

  constructor() {
    super();
    const start = PAIRINGS[DEFAULT_PAIRING];
    this.pairing = DEFAULT_PAIRING;
    this.sheetTitle = indexIn(SHEET_TITLES, start?.titleDefault ?? 'same');
    // The shipped set puts the TITLE face on the rail entries.
    this.railMatch = start?.railDefault ?? false;
    this.hand = 0;
    this.dataFace = dataFaceIndex(start?.dataDefault ?? 'din');
    this.prose = indexIn(PROSE_FACES, start?.proseDefault ?? 'charter');
    this.code = 0;
    this.size = start?.dataSize ?? 12;
    this.faces = [];
    this.metrics = null;
  }

  // Light DOM: atlas.css's tokens and the injected stylesheet both apply, and
  // the mock is meant to be inspectable in the same tree as a real plate.
  override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    ensureStyle();
    // Both readouts run twice on purpose: once when whatever is already loaded
    // settles, once after the <link> lands (which is when a cold visit's
    // stand-ins actually arrive).
    void document.fonts.ready.then(() => { this.#report(); });
    void ensureGoogleFonts().then(() =>
      document.fonts.ready.then(() => { this.#report(); }),
    );
    // The DEFAULT pairing's prose face is one of the on-demand families, so
    // the bench pulls it the same way a click would.
    const prose = PROSE_FACES[this.prose]?.google ?? '';
    if (prose) {
      void ensureProseFont(prose).then(() =>
        document.fonts.ready.then(() => { this.#report(); }),
      );
    }
  }

  override firstUpdated(): void {
    this.#report();
  }

  get #current(): Pairing {
    return PAIRINGS[this.pairing] ?? PAIRINGS[0]!;
  }

  /** SAME AS DISPLAY falls through to the pairing's own display face. */
  get #titleFace(): Face {
    return SHEET_TITLES[this.sheetTitle]?.face ?? this.#current.display;
  }

  /** The rail entries' TITLES — never their numbers, which stay tabular data. */
  get #railTitleFace(): Face {
    return this.railMatch ? this.#titleFace : this.#dataFace;
  }

  /** NONE means the hand slots simply take the data face. */
  get #handFace(): Face {
    return HANDS[this.hand]?.face ?? this.#dataFace;
  }

  get #dataFace(): Face {
    return DATA_FACES[this.dataFace]?.face ?? systemMono;
  }

  get #proseFace(): Face {
    return PROSE_FACES[this.prose]?.face ?? systemSerif;
  }

  get #codeFace(): Face {
    return CODE_FACES[this.code]?.face ?? systemMono;
  }

  /** Same shape as #pickProse: pull the family first, then redraw. */
  #pickCode(index: number): void {
    this.code = index;
    const query = CODE_FACES[index]?.google ?? '';
    this.#report();
    if (query) {
      void ensureProseFont(query).then(() =>
        document.fonts.ready.then(() => { this.#report(); }),
      );
    }
  }

  /** The knob's own handler: pull the family first, then redraw the readouts. */
  #pickProse(index: number): void {
    this.prose = index;
    const query = PROSE_FACES[index]?.google ?? '';
    this.#report();
    if (query) {
      void ensureProseFont(query).then(() =>
        document.fonts.ready.then(() => { this.#report(); }),
      );
    }
  }

  /** Picking a pairing RESETS the data face to that pairing's default; the
   *  DATA FACE knob then overrides it until the next pairing click. */
  #pick(index: number): void {
    const picked = PAIRINGS[index];
    this.pairing = index;
    this.dataFace = dataFaceIndex(picked?.dataDefault ?? 'din');
    this.size = picked?.dataSize ?? 12;
    // A pairing that names a title or a prose face resets those knobs too;
    // one that does not leaves them where the user put them.
    this.sheetTitle = indexIn(SHEET_TITLES, picked?.titleDefault ?? 'same');
    this.railMatch = picked?.railDefault ?? false;
    this.#pickProse(indexIn(PROSE_FACES, picked?.proseDefault ?? 'charter'));
  }

  #nudge(step: number): void {
    this.size = Math.min(15, Math.max(9, Math.round((this.size + step) * 2) / 2));
    this.#report();
  }

  /**
   * Re-run both readouts.
   *
   * TRAP, and the reason for `deferred`: a webfont is only DOWNLOADED once
   * something on the page actually uses it, so the first report after a knob
   * click reads SYSTEM for a face the browser has not fetched yet and would
   * stay wrong for ever. Chaining `updateComplete` (the mock is now painted in
   * the new stacks, which starts the fetch) and then `document.fonts.ready`
   * (the fetch has settled) gives the readout a second, truthful pass. One
   * level only — the deferred pass never re-arms.
   */
  #report(deferred = false): void {
    if (!this.isConnected) return;
    if (!deferred) {
      void this.updateComplete
        .then(() => document.fonts.ready)
        .then(() => { this.#report(true); });
    }
    const pairing = this.#current;
    const roles: [string, Face][] = [
      ['display', pairing.display],
      [this.sheetTitle === 0 ? 'title (= display)' : 'title', this.#titleFace],
      [this.railMatch ? 'rail-title (= title)' : 'rail-title (= data)', this.#railTitleFace],
      [this.hand === 0 ? 'hand (= data)' : 'hand', this.#handFace],
      ['data', this.#dataFace],
      ['prose', this.#proseFace],
      [this.code === 0 ? 'code (system)' : 'code', this.#codeFace],
    ];
    // TRAP: `document.fonts.check('12px "no-such-face"')` returns TRUE — the
    // spec asks "can this be rendered", and a family nothing declares renders
    // fine via fallback. So ask the FontFaceSet whether the family was DECLARED
    // at all (only @font-face rules land there, which is exactly what a Typekit
    // or Google stylesheet adds) before trusting check(). Without this the
    // readout calls every pending Adobe family ADOBE.
    const declared = (name: string): boolean => {
      const wanted = name.toLowerCase();
      for (const font of document.fonts) {
        if (font.family.replace(/^["']|["']$/g, '').toLowerCase() === wanted) return true;
      }
      return false;
    };
    const loaded = (name: string): boolean =>
      declared(name) &&
      (document.fonts.check(`12px "${name}"`) || document.fonts.check(`600 12px "${name}"`));

    this.faces = roles.map(([role, f]): FaceReport => {
      if (!f.standin) {
        return {
          role,
          asked: f.stack === SERIF ? 'the Charter stack' : 'system monospace',
          got: 'SYSTEM',
          detail: 'by design — a system face, 0 bytes on either host',
        };
      }
      if (f.adobe && loaded(f.adobe)) {
        return { role, asked: f.adobe, got: 'ADOBE', detail: `the kit served ${f.adobe}` };
      }
      if (loaded(f.standin)) {
        return {
          role,
          asked: f.adobe ?? f.standin,
          got: 'STAND-IN',
          detail: `${f.standin} — Google Fonts${f.adobe ? `; no ${f.adobe} on this host` : ''}`,
        };
      }
      return {
        role,
        asked: f.adobe ?? f.standin,
        got: 'SYSTEM',
        detail: 'neither face loaded — the generic fallback is drawing',
      };
    });

    this.metrics = {
      base: measure(this, MONO, PAIRINGS[0]?.dataSize ?? 10.5, 400),
      data: measure(this, this.#dataFace.stack, this.size, 400),
      // the code face is measured at the SAME size as the baseline mono: the
      // question it answers is "would the plate lettering move", not "is it big"
      code: measure(this, this.#codeFace.stack, PAIRINGS[0]?.dataSize ?? 10.5, 400),
    };
  }

  // --- the switcher --------------------------------------------------------

  #switcher(): TemplateResult {
    return html`
      <div class="sp-controls">
        <div class="sp-group" role="radiogroup" aria-label="pairing">
          <span class="sp-lbl">PAIRING</span>
          ${PAIRINGS.map(
            (pairing, index) => html`
              <button
                type="button"
                role="radio"
                data-pairing=${pairing.id}
                aria-checked=${this.pairing === index ? 'true' : 'false'}
                class=${this.pairing === index ? 'on' : ''}
                @click=${() => { this.#pick(index); }}
              >
                ${pairing.label}
              </button>
            `,
          )}
        </div>
        <div class="sp-group" role="radiogroup" aria-label="data face">
          <span class="sp-lbl">DATA FACE</span>
          ${DATA_FACES.map(
            (option, index) => html`
              <button
                type="button"
                role="radio"
                data-face=${option.id}
                aria-checked=${this.dataFace === index ? 'true' : 'false'}
                class=${this.dataFace === index ? 'on' : ''}
                title=${option.note}
                @click=${() => {
                  this.dataFace = index;
                  this.#report();
                }}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
        <div class="sp-group" role="radiogroup" aria-label="sheet title face">
          <span class="sp-lbl">SHEET TITLE</span>
          ${SHEET_TITLES.map(
            (option, index) => html`
              <button
                type="button"
                role="radio"
                data-title=${option.id}
                aria-checked=${this.sheetTitle === index ? 'true' : 'false'}
                class=${this.sheetTitle === index ? 'on' : ''}
                title=${option.note}
                @click=${() => {
                  this.sheetTitle = index;
                  this.#report();
                }}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
        <div class="sp-group" role="radiogroup" aria-label="rail entry titles">
          <span class="sp-lbl">RAIL TITLES</span>
          ${[
            { value: false, label: 'DATA FACE' },
            { value: true, label: 'MATCH SHEET TITLE' },
          ].map(
            (option) => html`
              <button
                type="button"
                role="radio"
                data-rail=${option.value ? 'match' : 'data'}
                aria-checked=${this.railMatch === option.value ? 'true' : 'false'}
                class=${this.railMatch === option.value ? 'on' : ''}
                @click=${() => {
                  this.railMatch = option.value;
                  this.#report();
                }}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
        <div class="sp-group" role="radiogroup" aria-label="prose face">
          <span class="sp-lbl">PROSE</span>
          ${PROSE_FACES.map(
            (option, index) => html`
              <button
                type="button"
                role="radio"
                data-prose=${option.id}
                aria-checked=${this.prose === index ? 'true' : 'false'}
                class=${this.prose === index ? 'on' : ''}
                title=${option.note}
                @click=${() => {
                  this.#pickProse(index);
                }}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
        <div class="sp-group" role="radiogroup" aria-label="code face">
          <span class="sp-lbl">CODE</span>
          ${CODE_FACES.map(
            (option, index) => html`
              <button
                type="button"
                role="radio"
                data-code=${option.id}
                aria-checked=${this.code === index ? 'true' : 'false'}
                class=${this.code === index ? 'on' : ''}
                title=${option.note}
                @click=${() => {
                  this.#pickCode(index);
                }}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
        <div class="sp-group" role="radiogroup" aria-label="hand face">
          <span class="sp-lbl">HAND</span>
          ${HANDS.map(
            (option, index) => html`
              <button
                type="button"
                role="radio"
                data-hand=${option.id}
                aria-checked=${this.hand === index ? 'true' : 'false'}
                class=${this.hand === index ? 'on' : ''}
                title=${option.note}
                @click=${() => {
                  this.hand = index;
                  this.#report();
                }}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
        <div class="sp-group" aria-label="data size">
          <span class="sp-lbl">DATA SIZE</span>
          <button type="button" aria-label="smaller" @click=${() => { this.#nudge(-0.5); }}>
            −
          </button>
          <span class="sp-num">${this.size.toFixed(1)}px</span>
          <button type="button" aria-label="larger" @click=${() => { this.#nudge(0.5); }}>
            +
          </button>
        </div>
      </div>
    `;
  }

  // --- the readouts --------------------------------------------------------

  #sizeReadout(): TemplateResult {
    const metrics = this.metrics;
    if (!metrics) return html`<p class="loading">MEASURING…</p>`;
    const base = PAIRINGS[0]?.dataSize ?? 10.5;
    return html`
      <section class="sp-read" id="sp-size">
        <h3>GLYPH SIZE — THE DATA FACE AGAINST THE MONO IT REPLACES</h3>
        <table class="sp-tbl num">
          <thead>
            <tr>
              <th>FACE</th>
              <th class="n">SIZE</th>
              <th class="n">CAP</th>
              <th class="n">X-HT</th>
              <th class="n">AVG ADV</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="k">baseline mono</td>
              <td class="n">${base.toFixed(1)}px</td>
              <td class="n">${px(metrics.base.cap)}</td>
              <td class="n">${px(metrics.base.xh)}</td>
              <td class="n">${px(metrics.base.adv)}</td>
            </tr>
            <tr>
              <!-- name the face that ACTUALLY drew, not the one first in the stack -->
              <td class="k">
                ${this.faces.find((f) => f.role.startsWith('data'))?.got === 'ADOBE'
                  ? (this.#dataFace.adobe ?? '')
                  : (this.#dataFace.standin ?? 'system monospace')}
              </td>
              <td class="n">${this.size.toFixed(1)}px</td>
              <td class="n">${px(metrics.data.cap)}</td>
              <td class="n">${px(metrics.data.xh)}</td>
              <td class="n">${px(metrics.data.adv)}</td>
            </tr>
            <tr class="d">
              <td class="k">Δ --data</td>
              <td class="n">—</td>
              <td class="n">${delta(metrics.data.cap, metrics.base.cap)}</td>
              <td class="n">${delta(metrics.data.xh, metrics.base.xh)}</td>
              <td class="n">${delta(metrics.data.adv, metrics.base.adv)}</td>
            </tr>
            <tr>
              <!-- --code is measured at the BASELINE size: the question is
                   whether the plates' hand-placed lettering would move. -->
              <td class="k">
                --code ·
                ${this.faces.find((f) => f.role.startsWith('code'))?.got === 'ADOBE'
                  ? (this.#codeFace.adobe ?? '')
                  : (this.#codeFace.standin ?? 'system monospace')}
              </td>
              <td class="n">${base.toFixed(1)}px</td>
              <td class="n">${px(metrics.code.cap)}</td>
              <td class="n">${px(metrics.code.xh)}</td>
              <td class="n">${px(metrics.code.adv)}</td>
            </tr>
            <tr class="d">
              <td class="k">Δ --code</td>
              <td class="n">—</td>
              <td class="n">${delta(metrics.code.cap, metrics.base.cap)}</td>
              <td class="n">${delta(metrics.code.xh, metrics.base.xh)}</td>
              <td class="n">${delta(metrics.code.adv, metrics.base.adv)}</td>
            </tr>
          </tbody>
        </table>
        <p class="sp-foot">
          Cap and x-height are INK heights
          (<code>measureText().actualBoundingBoxAscent</code>); the advance is a hidden
          span's measured width over ${SAMPLE.length} characters, divided by the count.
          Equivalent glyph size means the CAP Δ sits near zero — a negative advance Δ is
          the condensed face buying line length back, which is the whole point of it.
          Nudge DATA SIZE until the CAP Δ reads about 0%. The <code>--code</code> pair is
          measured at the BASELINE size on purpose: it prices the one risk a code-face
          swap carries, which is that the SVG plates place every
          <code>&lt;text&gt;</code> against the system mono's advance
          (Menlo ≈ 0.602em, Source Code Pro ≈ 0.600em — the Δ ADV row is the whole
          answer).
        </p>
      </section>
    `;
  }

  #loadedFaces(): TemplateResult {
    return html`
      <section class="sp-read" id="sp-faces">
        <h3>LOADED FACES — WHAT ACTUALLY RENDERED</h3>
        <table class="sp-tbl">
          <thead>
            <tr><th>ROLE</th><th>ASKED FOR</th><th>GOT</th><th>DETAIL</th></tr>
          </thead>
          <tbody>
            ${this.faces.map(
              (report) => html`
                <tr>
                  <td class="k">--${report.role}</td>
                  <td>${report.asked}</td>
                  <td class="got ${report.got.toLowerCase().replace('-', '')}">${report.got}</td>
                  <td class="dim">${report.detail}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
        <p class="sp-foot">
          ADOBE means the site's Typekit kit answered; STAND-IN means the Google Fonts
          face did; SYSTEM means neither loaded, or the role is the system monospace on
          purpose. The artifact build can never read ADOBE — its host allows
          <code>fonts.googleapis.com</code> and nothing else.
        </p>
      </section>
    `;
  }

  #adobeTable(): TemplateResult {
    return html`
      <section class="sp-read" id="sp-adobe">
        <h3>ADOBE FONTS — THE CSS FAMILY NAMES, AND WHAT THE KIT SERVES</h3>
        <table class="sp-tbl">
          <thead>
            <tr>
              <th>CSS FAMILY</th>
              <th>IN THE KIT</th>
              <th class="n">WOFF2 KB</th>
              <th>FACE</th>
              <th>ROLE</th>
            </tr>
          </thead>
          <tbody>
            ${ADOBE_FAMILIES.map(
              (row) => html`
                <tr>
                  <td class="k">${row.css}</td>
                  <td class="got ${row.kit ? 'adobe' : 'system'}">${row.kit ? 'YES' : 'NO'}</td>
                  <td class="n dim">${row.woff2}</td>
                  <td>${row.name}</td>
                  <td class="dim">${row.role}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
        <p class="sp-foot">
          Put the kit id in <code>VITE_ADOBE_FONTS_KIT</code> before
          <code>node generator/stage-site.mjs</code> and every staged page — routed and
          flat, since the whole chrome now draws on the set — gets
          <code>&lt;link rel="stylesheet" href="https://use.typekit.net/&lt;kit&gt;.css"&gt;</code>.
          Unset, the stage logs <code>Adobe Fonts kit: none</code> and the Google
          stand-ins draw everywhere. A
          family that is not in the kit costs nothing: its stack falls to the Google
          stand-in and the readout above says STAND-IN until it is added to the web
          project. WOFF2 KB is the measured latin subset the kit serves,
          Regular&nbsp;/&nbsp;Bold — the SITE's cost only, since the artifact loads the
          Google stand-ins and never a kit file.
        </p>
      </section>
    `;
  }

  // --- the mock ------------------------------------------------------------

  #mockStyle(): string {
    const pairing = this.#current;
    const title = SHEET_TITLES[this.sheetTitle];
    // SAME AS DISPLAY inherits the pairing's display weight, track and size.
    const titleWeight = title?.weight || pairing.dispWeight;
    const titleTrack = title?.track || pairing.dispTrack;
    const titleSize = title?.size || pairing.dispSize;
    return [
      `--display:${pairing.display.stack}`,
      `--title:${this.#titleFace.stack}`,
      `--rail-title:${this.#railTitleFace.stack}`,
      // matched rail titles want the title's tracking; data titles keep the
      // rail's own, which the entry rule already sets
      `--rail-title-ls:${this.railMatch ? '0.08em' : '0.04em'}`,
      `--hand:${this.#handFace.stack}`,
      `--data:${this.#dataFace.stack}`,
      `--prose:${this.#proseFace.stack}`,
      `--code:${this.#codeFace.stack}`,
      `--disp-wt:${String(pairing.dispWeight)}`,
      `--disp-ls:${pairing.dispTrack}`,
      `--disp-sz:${pairing.dispSize}`,
      `--title-wt:${String(titleWeight)}`,
      `--title-ls:${titleTrack}`,
      `--title-sz:${titleSize}`,
      `--data-sz:${String(this.size)}px`,
    ].join(';');
  }

  override render(): TemplateResult {
    const pairing = this.#current;
    return html`
      <div class="specimen">
        ${this.#switcher()}
        <p class="sp-note">
          <b>${pairing.label}</b> — ${pairing.note}<br />
          <b>SHEET TITLE · ${SHEET_TITLES[this.sheetTitle]?.label ?? ''}</b> —
          ${SHEET_TITLES[this.sheetTitle]?.note ?? ''}; the rail head keeps the pairing's
          display face either way. Rail titles:
          ${this.railMatch ? 'MATCHED to the sheet title' : 'the data face'}.<br />
          <b>PROSE · ${PROSE_FACES[this.prose]?.label ?? ''}</b> —
          ${PROSE_FACES[this.prose]?.note ?? ''}. The three webfont options load their
          family only when picked, so the default page pulls none of them.<br />
          <b>CODE · ${CODE_FACES[this.code]?.label ?? ''}</b> —
          ${CODE_FACES[this.code]?.note ?? ''}. The system mono is what the set ships;
          the alternative is here to show the plate-metrics risk, which the GLYPH SIZE
          table below prices at a fraction of a percent.<br />
          <b>HAND · ${HANDS[this.hand]?.label ?? 'NONE'}</b> — ${HANDS[this.hand]?.note ?? ''}.
          The hand is limited to the DRAWN BY value and one callout second line, never
          the REV descriptions, the figcaption or the rest of the callouts.
        </p>
        <div
          class="mock"
          data-pairing=${pairing.id}
          data-title=${SHEET_TITLES[this.sheetTitle]?.id ?? 'same'}
          data-rail-match=${this.railMatch ? 'on' : 'off'}
          style=${this.#mockStyle()}
        >
          ${unsafeHTML(SPECIMEN_MOCK)}
        </div>
        ${this.#sizeReadout()} ${this.#loadedFaces()} ${this.#adobeTable()}
      </div>
    `;
  }
}
customElements.define('atlas-specimen', AtlasSpecimen);

declare global {
  interface HTMLElementTagNameMap {
    'atlas-specimen': AtlasSpecimen;
  }
}
