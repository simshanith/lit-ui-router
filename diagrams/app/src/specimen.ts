/**
 * <atlas-specimen> — THE TYPE SPECIMEN.
 *
 * A bench, not a plate: one mock sheet drawn in the atlas's own chrome, with
 * the four type roles (`--display`, `--hand`, `--data`, `--code`) swapped on
 * the mock's root by inline style, so five candidate pairings — plus a data
 * width, a data size and a hand of its own — can be compared on the same copy,
 * in both themes, on both hosts.
 *
 * TWO HOSTS, ONE STACK. Every stack below names the ADOBE family first and the
 * Google Fonts stand-in second. On the live site `generator/stage-site.mjs`
 * injects the Adobe Fonts kit into THIS PAGE ONLY (when `VITE_ADOBE_FONTS_KIT`
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
 * (`https://use.typekit.net/<id>.css`, verified 2026-09-05 against the
 * completed 58-face kit). Two traps in the names: THREE l's in `p22-fllw-…`,
 * and `-pro` on every Univers Next, Myriad and Tekton family. Do not derive
 * these from the marketing names.
 *
 * WEIGHTS. The kit serves 400 and 700 (one 500). Everywhere the plan said
 * Demi/600 the CSS asks for 600 and gets 700 from Adobe, 600 from Google: CSS
 * font matching resolves a 600 request upward to 700 when only 400/700 exist,
 * so ONE weight number serves both hosts and nothing is synthesised.
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
    kit: true,
  },
  {
    css: 'p22-fllw-eaglefeather-sc',
    name: 'P22 FLLW Eaglefeather Small Caps',
    role: 'unused — kickers, if full caps prove too loud',
    kit: true,
  },
  {
    css: 'p22-fllw-eaglefeather-inf',
    name: 'P22 FLLW Eaglefeather Informal',
    role: 'unused — display alternate',
    kit: true,
  },
  { css: 'din-2014', name: 'DIN 2014 (400/700)', role: 'data · Prairie / Drafting', kit: true },
  {
    css: 'din-2014-narrow',
    name: 'DIN 2014 Narrow',
    role: 'unused — schedules, if the ledger has to tighten',
    kit: true,
  },
  { css: 'tekton-pro', name: 'Tekton Pro', role: 'hand · the TEKTON PRO knob', kit: true },
  {
    css: 'tekton-pro-condensed',
    name: 'Tekton Pro Condensed',
    role: 'unused — hand alternate',
    kit: true,
  },
  {
    css: 'tekton-pro-extended',
    name: 'Tekton Pro Extended',
    role: 'unused — hand alternate',
    kit: true,
  },
  {
    css: 'univers-next-pro',
    name: 'Univers Next Pro (400/700 + italic)',
    role: 'data · Signage',
    kit: true,
  },
  {
    css: 'univers-next-pro-condensed',
    name: 'Univers Next Pro Condensed (400/700 + italic)',
    role: 'display · Signage; data · The Kit',
    kit: true,
  },
  {
    css: 'univers-next-pro-compressed',
    name: 'Univers Next Pro Compressed',
    role: 'unused — dimension strings',
    kit: true,
  },
  {
    css: 'univers-next-pro-extended',
    name: 'Univers Next Pro Extended',
    role: 'unused — cover / title strip',
    kit: true,
  },
  { css: 'myriad-pro', name: 'Myriad Pro', role: 'unused — humanist data alternate', kit: true },
  {
    css: 'myriad-pro-semi-condensed',
    name: 'Myriad Pro Semi Condensed',
    role: 'unused — humanist data alternate',
    kit: true,
  },
  {
    css: 'myriad-pro-cond',
    name: 'Myriad Pro Condensed',
    role: 'unused — humanist data alternate',
    kit: true,
  },
  { css: 'graphite-std', name: 'Graphite Std', role: 'NOT in the kit — pencil register', kit: false },
  {
    css: 'p22-flw-terracotta',
    name: 'P22 FLW Terracotta',
    role: 'NOT in the kit — display alternate',
    kit: false,
  },
  {
    css: 'p22-flw-exhibition',
    name: 'P22 FLW Exhibition',
    role: 'NOT in the kit — display alternate',
    kit: false,
  },
  {
    css: 'p22-flw-midway',
    name: 'P22 FLW Midway',
    role: 'NOT in the kit — display alternate',
    kit: false,
  },
  { css: 'isonorm', name: 'Isonorm', role: 'NOT in the kit — ISO 3098 lettering', kit: false },
  {
    css: 'din-condensed',
    name: 'DIN Condensed',
    role: 'NOT in the kit — use din-2014-narrow',
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

const systemMono: Face = { adobe: null, standin: null, stack: MONO };

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

const DIN = face('din-2014', 'Barlow Semi Condensed', 'sans-serif');
const DIN_PLAIN = face('din-2014', 'Barlow', 'sans-serif');

export interface Pairing {
  id: string;
  label: string;
  note: string;
  display: Face;
  data: Face;
  /** The face the DATA FACE toggle swaps in. Identical object = no toggle. */
  dataWide: Face;
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
 * THE PAIRINGS — the one table this state is about.
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
    data: systemMono,
    dataWide: systemMono,
    code: systemMono,
    dispWeight: 600,
    dispTrack: '0.10em',
    dispSize: '23px',
    dataSize: 10.5,
  },
  {
    id: 'prairie',
    label: '1 · PRAIRIE',
    note: 'display Josefin Sans 600 (site: P22 FLLW Eaglefeather) · data Barlow Semi Condensed 400/600 tnum (site: DIN 2014, 700 for the 600) · code system mono · ≈73 KB',
    display: face('p22-fllw-eaglefeather', 'Josefin Sans', 'sans-serif'),
    data: DIN,
    dataWide: DIN_PLAIN,
    code: systemMono,
    dispWeight: 600,
    dispTrack: '0.16em',
    dispSize: '26px',
    dataSize: 11,
  },
  {
    id: 'drafting',
    label: '2 · DRAFTING',
    note: 'display Zilla Slab 700 — the open face IS the choice, there is no Adobe upgrade for it · data exactly as Prairie · ≈61 KB, the lightest set',
    display: face(null, 'Zilla Slab', 'serif'),
    data: DIN,
    dataWide: DIN_PLAIN,
    code: systemMono,
    dispWeight: 700,
    dispTrack: '0.08em',
    dispSize: '26px',
    dataSize: 11,
  },
  {
    id: 'signage',
    label: '3 · SIGNAGE',
    note: 'display Fira Sans Condensed 700 (site: Univers Next Pro Condensed) · data Fira Sans 400/600 tnum (site: Univers Next Pro) · ≈66 KB · both Adobe faces are in the kit today',
    display: face('univers-next-pro-condensed', 'Fira Sans Condensed', 'sans-serif'),
    data: face('univers-next-pro', 'Fira Sans', 'sans-serif'),
    // Assigned below so the identity the DATA FACE toggle tests holds.
    dataWide: systemMono,
    code: systemMono,
    dispWeight: 700,
    dispTrack: '0.06em',
    dispSize: '26px',
    dataSize: 11,
  },
  {
    id: 'kit',
    label: '4 · THE KIT',
    note: "the cross pairing — display P22 FLLW Eaglefeather (stand-in Josefin Sans 600) over data Univers Next Pro Condensed 400/700 (stand-in Barlow Semi Condensed), plain width swapping to Univers Next Pro: the Wright display on the signage ledger",
    display: face('p22-fllw-eaglefeather', 'Josefin Sans', 'sans-serif'),
    data: face('univers-next-pro-condensed', 'Barlow Semi Condensed', 'sans-serif'),
    dataWide: face('univers-next-pro', 'Barlow', 'sans-serif'),
    code: systemMono,
    dispWeight: 600,
    dispTrack: '0.16em',
    dispSize: '26px',
    dataSize: 11,
  },
];

// Signage has ONE data width: make the two faces the same object, which is the
// identity the DATA FACE toggle tests to disable itself.
const signage = PAIRINGS[3];
if (signage) signage.dataWide = signage.data;

// --- font loading, this state only ----------------------------------------

/** The stand-ins. Kept as ONE string so stage-site.mjs's Adobe link is the
 *  only other font request this page can make. */
export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@600' +
  '&family=Zilla+Slab:wght@700' +
  '&family=Barlow+Semi+Condensed:wght@400;600' +
  '&family=Barlow:wght@400;600' +
  '&family=Fira+Sans+Condensed:wght@700' +
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
    hand: { state: true },
    wide: { state: true },
    size: { state: true },
    faces: { state: true },
    metrics: { state: true },
  };

  declare pairing: number;
  /** Index into HANDS. 0 = NONE, which is the default. */
  declare hand: number;
  declare wide: boolean;
  declare size: number;
  declare faces: FaceReport[];
  declare metrics: { base: Metric; data: Metric } | null;

  constructor() {
    super();
    this.pairing = 1;
    this.hand = 0;
    this.wide = false;
    this.size = PAIRINGS[1]?.dataSize ?? 12;
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
  }

  override firstUpdated(): void {
    this.#report();
  }

  get #current(): Pairing {
    return PAIRINGS[this.pairing] ?? PAIRINGS[0]!;
  }

  /** NONE means the hand slots simply take the data face. */
  get #handFace(): Face {
    return HANDS[this.hand]?.face ?? this.#dataFace;
  }

  get #dataFace(): Face {
    const pairing = this.#current;
    return this.wide ? pairing.dataWide : pairing.data;
  }

  get #oneWidth(): boolean {
    return this.#current.data === this.#current.dataWide;
  }

  #pick(index: number): void {
    this.pairing = index;
    this.size = PAIRINGS[index]?.dataSize ?? 12;
    this.#report();
  }

  #nudge(step: number): void {
    this.size = Math.min(15, Math.max(9, Math.round((this.size + step) * 2) / 2));
    this.#report();
  }

  /** Re-run both readouts. Cheap, and truthful only once the faces are in. */
  #report(): void {
    if (!this.isConnected) return;
    const pairing = this.#current;
    const roles: [string, Face][] = [
      ['display', pairing.display],
      [this.hand === 0 ? 'hand (= data)' : 'hand', this.#handFace],
      ['data', this.#dataFace],
      ['code', pairing.code],
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
          asked: 'system monospace',
          got: 'SYSTEM',
          detail: 'by design — code and plate lettering cost 0 bytes',
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
    };
  }

  // --- the switcher --------------------------------------------------------

  #switcher(): TemplateResult {
    const widths = [
      { value: false, label: 'AS SPEC’D' },
      { value: true, label: 'PLAIN BARLOW' },
    ];
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
        <div class="sp-group" role="radiogroup" aria-label="data face width">
          <span class="sp-lbl">DATA FACE</span>
          ${widths.map(
            (width) => html`
              <button
                type="button"
                role="radio"
                aria-checked=${this.wide === width.value ? 'true' : 'false'}
                class=${this.wide === width.value ? 'on' : ''}
                ?disabled=${this.#oneWidth}
                title=${this.#oneWidth
                  ? 'this pairing has one data width'
                  : 'swap the data face for its plain (un-condensed) width'}
                @click=${() => {
                  this.wide = width.value;
                  this.#report();
                }}
              >
                ${width.label}
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
              <td class="k">Δ</td>
              <td class="n">—</td>
              <td class="n">${delta(metrics.data.cap, metrics.base.cap)}</td>
              <td class="n">${delta(metrics.data.xh, metrics.base.xh)}</td>
              <td class="n">${delta(metrics.data.adv, metrics.base.adv)}</td>
            </tr>
          </tbody>
        </table>
        <p class="sp-foot">
          Cap and x-height are INK heights
          (<code>measureText().actualBoundingBoxAscent</code>); the advance is a hidden
          span's measured width over ${SAMPLE.length} characters, divided by the count.
          Equivalent glyph size means the CAP Δ sits near zero — a negative advance Δ is
          the condensed face buying line length back, which is the whole point of it.
          Nudge DATA SIZE until the CAP Δ reads about 0%.
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
            <tr><th>CSS FAMILY</th><th>IN THE KIT</th><th>FACE</th><th>ROLE</th></tr>
          </thead>
          <tbody>
            ${ADOBE_FAMILIES.map(
              (row) => html`
                <tr>
                  <td class="k">${row.css}</td>
                  <td class="got ${row.kit ? 'adobe' : 'system'}">${row.kit ? 'YES' : 'NO'}</td>
                  <td>${row.name}</td>
                  <td class="dim">${row.role}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
        <p class="sp-foot">
          Put the kit id in <code>VITE_ADOBE_FONTS_KIT</code> before
          <code>node generator/stage-site.mjs</code> and this page — and only this page —
          gets
          <code>&lt;link rel="stylesheet" href="https://use.typekit.net/&lt;kit&gt;.css"&gt;</code>.
          Unset, the stage logs <code>Adobe Fonts kit: none</code> and emits nothing. A
          family that is not in the kit costs nothing: its stack falls to the Google
          stand-in and the readout above says STAND-IN until it is added to the web
          project.
        </p>
      </section>
    `;
  }

  // --- the mock ------------------------------------------------------------

  #mockStyle(): string {
    const pairing = this.#current;
    return [
      `--display:${pairing.display.stack}`,
      `--hand:${this.#handFace.stack}`,
      `--data:${this.#dataFace.stack}`,
      `--code:${pairing.code.stack}`,
      `--disp-wt:${String(pairing.dispWeight)}`,
      `--disp-ls:${pairing.dispTrack}`,
      `--disp-sz:${pairing.dispSize}`,
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
          <b>HAND · ${HANDS[this.hand]?.label ?? 'NONE'}</b> — ${HANDS[this.hand]?.note ?? ''}
          The hand is limited to the DRAWN BY value and one callout second line, never
          the REV descriptions, the figcaption or the rest of the callouts.
        </p>
        <div class="mock" data-pairing=${pairing.id} style=${this.#mockStyle()}>
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
