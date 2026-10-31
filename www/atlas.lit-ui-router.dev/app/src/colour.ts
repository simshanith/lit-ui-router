/**
 * <atlas-colour> — THE COLOUR STANDARDS.
 *
 * A bench, not a plate: every `light-dark()` token of generator/chrome.mjs's
 * `:root`, with its role (generator/colour-roles.mjs) and the contrast ratios
 * generator/check-colour.mjs gates the build on. All of it is read from
 * src/generated/tokens.js; the page computes no ratio of its own.
 */
import { LitElement, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { BACKGROUNDS, NASA_MANUAL, REPORTED, SOURCES, TOKENS } from './generated/tokens.js';
import type { Theme, Token } from './generated/tokens.js';

const THEMES: Theme[] = ['light', 'dark'];
const BY_NAME = new Map(TOKENS.map((t) => [t.name, t]));

function token(name: string): Token {
  const t = BY_NAME.get(name);
  if (!t) throw new Error(`colour: no --${name} in the generated table`);
  return t;
}

/** A token's value as written, `var()` read in the same theme, so either theme can be forced. */
const literal = (t: Token, theme: Theme): string =>
  t[theme].replace(/var\(--([a-z0-9-]+)\)/g, (_, name: string) => token(name)[theme]);
const lit = (name: string, theme: Theme): string => literal(token(name), theme);

const reportedKey = (name: string, bg: string, theme: Theme): string => `${name} on ${bg} · ${theme}`;
const isReported = (name: string, bg: string, theme: Theme): boolean =>
  reportedKey(name, bg, theme) in REPORTED;

/** WCAG contrast of two relative luminances, for the value scale's type colour only. */
const contrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const STYLE_ID = 'atlas-colour-css';
const CSS = `
atlas-colour { display: block; }
atlas-colour .cs-prose p { font-family: var(--prose); font-size: 17px; line-height: 1.75; max-width: 74ch; margin-block: 0 1.2em; }
atlas-colour .cs-prose p strong { font-weight: 600; }
atlas-colour .cs-prose code { font-family: var(--code); font-size: 0.86em; }
atlas-colour .cs-prose a, atlas-colour .cs-rules a { color: var(--accent); text-decoration-color: var(--accent-soft); }
atlas-colour h3 { font-family: var(--data); font-size: 12.5px; font-weight: 600; letter-spacing: 0.18em; color: var(--ink-soft); margin-block: 26px 10px; }
atlas-colour .cs-wrap { overflow-x: auto; border: 1.5px solid var(--ink); background: var(--paper); margin-block-end: 8px; }
atlas-colour .cs-wrap:focus-visible { outline: max(2px, 0.08em) solid var(--accent); outline-offset: 2px; }
atlas-colour .cs-table { min-width: 1040px; }
atlas-colour .cs-values code { display: block; }
atlas-colour .cs-values code + code { margin-block-start: 3px; color: var(--ink-soft); }
atlas-colour .cs-table td { vertical-align: middle; }
atlas-colour .cs-table td.role { font-family: var(--prose); font-size: 14px; line-height: 1.45; letter-spacing: 0; min-width: 280px; }
atlas-colour .cs-table td.cs-values { min-width: 230px; }
atlas-colour .cs-table code { font-family: var(--code); font-size: 11px; }
atlas-colour .cs-name { font-weight: 600; white-space: nowrap; }
atlas-colour .cs-kind { white-space: nowrap; color: var(--ink-soft); }
atlas-colour .cs-sw { display: flex; gap: 6px; align-items: center; }
atlas-colour .cs-live { inline-size: 30px; block-size: 30px; border: 1px solid var(--edge); flex: none; }
atlas-colour .cs-forced { display: flex; align-items: center; gap: 4px; inline-size: 52px; block-size: 30px; padding-inline: 5px; border: 1px solid; flex: none; font-family: var(--data); font-size: 13px; font-weight: 600; }
atlas-colour .cs-chip { inline-size: 14px; block-size: 14px; border: 1px solid; flex: none; }
atlas-colour .cs-ratios { white-space: nowrap; }
atlas-colour .cs-ratios div { display: grid; grid-template-columns: 5.5em 3.2em 3.2em; gap: 6px; }
atlas-colour .cs-ratios .bg { color: var(--ink-soft); letter-spacing: 0.1em; font-size: 10.5px; }
atlas-colour .cs-under { color: var(--red); font-weight: 600; }
atlas-colour .cs-matrices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr)); gap: 18px; }
atlas-colour .cs-matrix { border-collapse: collapse; inline-size: 100%; min-width: 540px; font-family: var(--data); font-variant-numeric: tabular-nums; }
atlas-colour .cs-matrix caption { text-align: start; font-size: 10.5px; font-weight: 600; letter-spacing: 0.16em; color: var(--ink-soft); padding: 8px 12px 7px; background: var(--paper-2); border-block-end: 1.5px solid var(--ink); }
atlas-colour .cs-matrix th { font-size: 9.5px; font-weight: 600; letter-spacing: 0.16em; color: var(--ink-soft); text-align: start; padding: 6px 10px; border-block-end: 1px solid var(--line); }
atlas-colour .cs-matrix th[scope="row"] { letter-spacing: 0.06em; font-size: 11px; white-space: nowrap; }
atlas-colour .cs-matrix td { padding: 6px 10px; border: 1px solid var(--line); }
atlas-colour .cs-cell { display: flex; align-items: baseline; gap: 8px; white-space: nowrap; }
atlas-colour .cs-cell .aa { font-size: 17px; font-weight: 600; }
atlas-colour .cs-cell .r { font-size: 12px; }
atlas-colour .cs-cell .st { font-size: 9.5px; letter-spacing: 0.12em; }
atlas-colour .cs-scale { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); border: 1.5px solid var(--ink); }
atlas-colour .cs-step { min-block-size: 64px; padding: 6px 8px; font-family: var(--data); font-size: 10.5px; letter-spacing: 0.06em; display: flex; flex-direction: column; justify-content: space-between; font-variant-numeric: tabular-nums; }
atlas-colour .cs-step b { font-weight: 600; }
atlas-colour .cs-rules { font-family: var(--prose); font-size: 17px; line-height: 1.7; max-width: 74ch; padding-inline-start: 1.6em; margin-block: 0 1em; }
atlas-colour .cs-rules li { margin-block-end: 0.7em; }
atlas-colour .cs-rules li::marker { font-family: var(--data); font-weight: 600; color: var(--ink-soft); }
atlas-colour .cs-rules strong { font-weight: 600; }
atlas-colour .cs-rules code { font-family: var(--code); font-size: 0.86em; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

/** One theme forced: that theme's paper, the token as a chip, and lettering in it where it letters. */
function forced(t: Token, theme: Theme): TemplateResult {
  const value = literal(t, theme);
  return html`<span
    class="cs-forced"
    title=${`${theme}: ${t[theme]}`}
    style=${styleMap({ background: lit('paper', theme), borderColor: lit('edge', theme), color: value })}
    ><span class="cs-chip" style=${styleMap({ background: value, borderColor: lit('line', theme) })}></span
    >${t.kind === 'TEXT' ? 'Aa' : ''}</span
  >`;
}

function ratios(t: Token): TemplateResult {
  if (t.kind === 'SURFACE') return html`<span class="cs-kind">no floor</span>`;
  return html`${t.on.map(
    (bg) => html`<div>
      <span class="bg">${bg.toUpperCase()}</span>
      ${THEMES.map((theme) => {
        const r = t.themes[theme].ratios[bg] ?? 0;
        const under = t.floor > 0 && r < t.floor;
        return html`<span class=${under ? 'cs-under' : ''} title=${under && isReported(t.name, bg, theme) ? 'reported, not gated' : nothing}
          >${r.toFixed(2)}${under ? ' ✗' : ''}</span
        >`;
      })}
    </div>`,
  )}`;
}

function row(t: Token): TemplateResult {
  return html`<tr>
    <td>
      <div class="cs-sw">
        <span class="cs-live" title="this page's theme" style=${styleMap({ background: `var(--${t.name})` })}></span>
        ${THEMES.map((theme) => forced(t, theme))}
      </div>
    </td>
    <td class="cs-name">--${t.name}</td>
    <td class="cs-values"><code>${t.light}</code><code>${t.dark}</code></td>
    <td class="cs-kind">${t.kind}${t.floor > 0 ? html` · ${t.floor}:1` : ''}</td>
    <td class="role">${t.role}</td>
    <td class="cs-ratios">${ratios(t)}</td>
  </tr>`;
}

function cell(t: Token, bg: string, theme: Theme): TemplateResult {
  const r = t.themes[theme].ratios[bg] ?? 0;
  const allowed = t.on.includes(bg);
  const under = allowed && t.floor > 0 && r < t.floor;
  const status = !allowed ? 'OFF ITS LIST' : t.floor === 0 ? 'NO FLOOR' : under ? 'UNDER · REPORTED' : 'CLEARS';
  return html`<td style=${styleMap({ background: lit(bg, theme) })}>
    <span class="cs-cell">
      <span class="aa" style=${styleMap({ color: literal(t, theme) })}>Aa</span>
      <span class="r" style=${styleMap({ color: lit('ink', theme) })}>${r.toFixed(2)}</span>
      <span class="st" style=${styleMap({ color: under ? lit('red', theme) : lit('ink-soft', theme) })}>${status}</span>
    </span>
  </td>`;
}

function matrix(theme: Theme): TemplateResult {
  const rows = TOKENS.filter((t) => t.kind !== 'SURFACE');
  return html`<div
    class="cs-wrap"
    tabindex="0"
    role="region"
    aria-label=${`The matrix, ${theme} theme`}
    style=${styleMap({ colorScheme: theme, background: lit('paper', theme), color: lit('ink', theme) })}
  >
    <table class="cs-matrix">
      <caption style=${styleMap({ background: lit('paper-2', theme), color: lit('ink-soft', theme) })}>
        ${theme.toUpperCase()} THEME · TOKEN ON GROUND
      </caption>
      <thead>
        <tr>
          <th scope="col" style=${styleMap({ color: lit('ink-soft', theme) })}>TOKEN</th>
          ${BACKGROUNDS.map((bg) => html`<th scope="col" style=${styleMap({ color: lit('ink-soft', theme) })}>${bg.toUpperCase()}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${rows.map(
          (t) => html`<tr>
            <th scope="row" style=${styleMap({ color: lit('ink', theme) })}>--${t.name}</th>
            ${BACKGROUNDS.map((bg) => cell(t, bg, theme))}
          </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}

/** Page 7.1's idea in the set's own inks: every opaque token by value, lettered in whichever of ink or paper reads. */
function scale(theme: Theme): TemplateResult {
  const ink = token('ink').themes[theme].y;
  const paper = token('paper').themes[theme].y;
  const steps = TOKENS.filter((t) => t.themes[theme].alpha === 1).sort((a, b) => b.themes[theme].y - a.themes[theme].y);
  return html`<div class="cs-scale" style=${styleMap({ colorScheme: theme })} role="list" aria-label=${`Value scale, ${theme} theme`}>
    ${steps.map((t) => {
      const y = t.themes[theme].y;
      const type = contrast(y, ink) >= contrast(y, paper) ? 'ink' : 'paper';
      return html`<div role="listitem" class="cs-step" style=${styleMap({ background: literal(t, theme), color: lit(type, theme) })}>
        <b>--${t.name}</b><span>Y ${y.toFixed(3)} · ${type.toUpperCase()}</span>
      </div>`;
    })}
  </div>`;
}

export class AtlasColour extends LitElement {
  // Light DOM: atlas.css's tokens and classes reach the bench as they reach a plate.
  override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    ensureStyle();
  }

  override render(): TemplateResult {
    const reported = Object.keys(REPORTED).length;
    const gated = TOKENS.filter((t) => t.floor > 0).reduce((n, t) => n + t.on.length * THEMES.length, 0);
    return html`
      <div class="cs-prose">
        <p>
          <strong>What the bench is.</strong> Every colour the plates are inked in is a
          <code>light-dark()</code> token in the <code>:root</code> block of
          <a href=${SOURCES.chrome}><code>chrome.mjs</code></a>. The table below is parsed out of
          that block at build time, so it cannot disagree with the sheets. Each token carries one
          role from <a href=${SOURCES.roles}><code>colour-roles.mjs</code></a>, the grounds it may
          stand on, and a kind that sets its floor: TEXT 4.5:1, MARK 3:1, RULE and SURFACE none. A
          RULE is a stroke that carries no reading alone, a hairline or a frame, which WCAG's
          non-text contrast leaves out.
        </p>
        <p>
          <strong>Where the numbers come from.</strong>
          <a href=${SOURCES.guard}><code>check-colour.mjs</code></a> resolves each value, oklch to
          linear sRGB to relative luminance, and reads the contrast of every TEXT and MARK token
          against each ground it is allowed on, in both themes: ${gated} pairs. The build stops on a
          pair under its floor, on a token with no role and on a role with no token. The ratios on
          this page are the guard's own, carried in the generated module. ${reported} of the pairs
          sit under their floor and are reported, not gated, each held at the ratio it reads; the
          token or the floor is the maintainer's call.
        </p>
        <p>
          <strong>Reading a row.</strong> The first swatch is drawn in this page's theme; the two
          beside it force light and dark on that theme's paper from the values as written, so both
          sides read at once. <code>--halo</code> is the accent at a tenth of its strength over
          whatever lies under it: a SURFACE overlay with no floor, its swatch read over paper.
        </p>
      </div>

      <h3>THE TOKENS</h3>
      <div class="cs-wrap" tabindex="0" role="region" aria-label="The token table">
        <table class="schedule cs-table">
          <thead>
            <tr>
              <th scope="col">LIVE · LIGHT · DARK</th>
              <th scope="col">TOKEN</th>
              <th scope="col">AS WRITTEN · LIGHT / DARK</th>
              <th scope="col">KIND · FLOOR</th>
              <th scope="col">ROLE</th>
              <th scope="col">ON · LIGHT · DARK</th>
            </tr>
          </thead>
          <tbody>
            ${TOKENS.map(row)}
          </tbody>
        </table>
      </div>

      <h3>THE MATRIX</h3>
      <div class="cs-prose">
        <p>
          Every TEXT, MARK and RULE token lettered on each ground, in each theme, with its ratio. A
          token off its list is drawn there anyway, so the grid shows why it is kept off.
        </p>
      </div>
      <div class="cs-matrices">${THEMES.map(matrix)}</div>

      <h3>THE VALUE SCALE</h3>
      <div class="cs-prose">
        <p>
          The opaque tokens, lightest first, each lettered in whichever of ink or paper reads
          against it.
        </p>
      </div>
      ${THEMES.map((theme) => html`<h3>${theme.toUpperCase()}</h3>${scale(theme)}`)}

      <h3>INCORRECT USES OF COLOUR</h3>
      <ol class="cs-rules">
        <li>
          <strong>Accent on more than two elements of a plate, or with a second meaning.</strong>
          <a href=${SOURCES.isometric}><code>ISOMETRIC.md</code></a> gives accent one meaning per
          sheet, named in the key. No guard: the frame audit counts escapes, hits and text on text,
          and does not read colour.
        </li>
        <li>
          <strong>A literal colour outside the tokens.</strong> A token declared in
          <code>chrome.mjs</code> without a role row stops the build
          (<code>check-colour.mjs</code>). A hex or <code>oklch()</code> written straight into a
          sheet module or a style has no guard.
        </li>
        <li>
          <strong>Red for anything but gate severity.</strong> Red marks the roof that halts a
          publish, its badge lettering and the crossed-out tie. No guard.
        </li>
      </ol>

      <div class="cs-prose">
        <p>
          <strong>Method.</strong> The bench follows the colour pages of the
          <a href=${NASA_MANUAL.page}>NASA Graphics Standards Manual</a> (NHB 1430.2, January 1976,
          Danne &amp; Blackburn), in NASA's later reprint (<a href=${NASA_MANUAL.pdf}>PDF</a>): page
          1.4 sets the mark by the value of its background, which the matrix echoes ground by
          ground; pages 1.5 and 2.14 give each colour as a swatch with one sentence of its use,
          which the rows follow; page 7.1's ten-step gray scale turns its type from black to white
          past a 40% value, which the value scale does with the set's own ink and paper.
        </p>
      </div>
    `;
  }
}
customElements.define('atlas-colour', AtlasColour);

declare global {
  interface HTMLElementTagNameMap {
    'atlas-colour': AtlasColour;
  }
}
