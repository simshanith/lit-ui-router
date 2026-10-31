// THE COLOUR GUARD — every TEXT and MARK token against every background it is
// allowed on, in both themes, held to its floor (colour-roles.mjs).
//
// The tokens are parsed out of chrome.mjs's `:root` block, never retyped:
// oklch → oklab → linear sRGB → WCAG relative luminance, contrast
// (L1 + 0.05) / (L2 + 0.05). emit-app.mjs calls `assertColour()` beside
// `assertLabels()` and writes the same table into app/src/generated/tokens.js,
// so the bench at /colour prints the guard's numbers, not a second sum.
import { CSS } from './chrome.mjs';
import { BACKGROUNDS, FLOORS, ROLES } from './colour-roles.mjs';
import { NASA_MANUAL } from './helpers.mjs';

export const THEMES = ['light', 'dark'];

/**
 * Pairs under their floor that the guard reports and does not stop on, each
 * with the ratio it was read at. The token or the floor is the maintainer's
 * call; a listed pair that clears its floor, or reads another ratio, stops the build.
 */
export const REPORTED = {
  'accent-soft on ground · light': 2.91,
  'red on paper · dark': 4.24,
  'pencil on paper · light': 3.53,
};

// Split `a, b` at the top-level comma: light-dark() and color-mix() nest.
function splitTop(s) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') depth -= 1;
    else if (s[i] === ',' && depth === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(s.slice(start).trim());
  return out;
}

/** chrome.mjs's first `:root` block → [{ name, light, dark }], in declared order. */
export function parseTokens(css = CSS) {
  const open = css.indexOf(':root {');
  if (open === -1) throw new Error('check-colour: chrome.mjs carries no :root block');
  const block = css.slice(open, css.indexOf('\n}', open)).replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = [];
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*light-dark\((.*)\);/g)) {
    const parts = splitTop(m[2]);
    if (parts.length !== 2) throw new Error(`check-colour: --${m[1]} is not light-dark(<light>, <dark>)`);
    tokens.push({ name: m[1], light: parts[0], dark: parts[1] });
  }
  if (tokens.length === 0) throw new Error('check-colour: no light-dark() tokens in :root');
  return tokens;
}

// --- the colour math ----------------------------------------------------------

function oklchToLinear(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const clip = (v) => Math.min(1, Math.max(0, v));
const encode = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const hex = (rgb) => `#${rgb.map((v) => Math.round(clip(v) * 255).toString(16).padStart(2, '0')).join('')}`;

/** Relative luminance of gamma-encoded sRGB. */
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => decode(clip(v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast of two luminances, rounded to two places. */
export const ratio = (y1, y2) => Math.round(((Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05)) * 100) / 100;

const OKLCH_RE = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/;
const MIX_RE = /^color-mix\(in oklch, var\(--([a-z0-9-]+)\) ([\d.]+)%, transparent\)$/;

/** One theme's expression → gamma-encoded sRGB and alpha; `var()` reads the same theme. */
function resolve(expr, theme, byName, seen = new Set()) {
  const ok = OKLCH_RE.exec(expr);
  if (ok) {
    const lin = oklchToLinear(Number(ok[1]) / 100, Number(ok[2]), Number(ok[3]));
    const gamut = lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
    return { rgb: lin.map((v) => encode(clip(v))), alpha: 1, gamut };
  }
  // A mix with transparent in oklch is the named colour at that alpha.
  const mix = MIX_RE.exec(expr);
  if (mix) {
    const ref = byName.get(mix[1]);
    if (!ref || seen.has(mix[1])) throw new Error(`check-colour: ${expr} names no resolvable token`);
    const base = resolve(ref[theme], theme, byName, new Set([...seen, mix[1]]));
    return { ...base, alpha: base.alpha * (Number(mix[2]) / 100) };
  }
  throw new Error(`check-colour: cannot read "${expr}" — oklch() or color-mix(in oklch, var(), N%, transparent) only`);
}

/** Source-over in gamma-encoded sRGB, the way the browser composites. */
const over = (fg, bg) => fg.rgb.map((v, i) => fg.alpha * v + (1 - fg.alpha) * bg.rgb[i]);

/**
 * The whole table: per token its expressions as written, its role row, its
 * resolved hex per theme, and its ratio against every background per theme.
 */
export function colourTable(css = CSS) {
  const tokens = parseTokens(css);
  const byName = new Map(tokens.map((t) => [t.name, t]));
  for (const t of tokens) if (!ROLES[t.name]) throw new Error(`check-colour: --${t.name} has no row in generator/colour-roles.mjs`);
  for (const name of Object.keys(ROLES)) if (!byName.has(name)) throw new Error(`check-colour: colour-roles.mjs has a row for --${name}, which chrome.mjs does not declare`);
  for (const bg of BACKGROUNDS) if (ROLES[bg]?.kind !== 'SURFACE') throw new Error(`check-colour: background ${bg} is not a SURFACE token`);
  const resolved = Object.fromEntries(THEMES.map((theme) => [theme, new Map(tokens.map((t) => [t.name, resolve(t[theme], theme, byName)]))]));
  return tokens.map((t) => {
    const { kind, on, role } = ROLES[t.name];
    if (!(kind in FLOORS)) throw new Error(`check-colour: --${t.name} has kind ${kind}, not ${Object.keys(FLOORS).join(' / ')}`);
    for (const bg of on) if (!BACKGROUNDS.includes(bg)) throw new Error(`check-colour: --${t.name} is allowed on ${bg}, which is not a background`);
    const theme = (th) => {
      const c = resolved[th].get(t.name);
      // an overlay's hex is read over paper; its ratios over each background
      const flat = c.alpha < 1 ? over(c, resolved[th].get('paper')) : c.rgb;
      const ratios = Object.fromEntries(BACKGROUNDS.map((bg) => {
        const ground = resolved[th].get(bg);
        const fg = c.alpha < 1 ? over(c, ground) : c.rgb;
        return [bg, ratio(luminance(fg), luminance(ground.rgb))];
      }));
      return { hex: hex(flat), alpha: c.alpha, gamut: c.gamut, y: Math.round(luminance(flat) * 1000) / 1000, ratios };
    };
    return { name: t.name, light: t.light, dark: t.dark, kind, floor: FLOORS[kind], on, role, themes: { light: theme('light'), dark: theme('dark') } };
  });
}

const pairKey = (name, bg, theme) => `${name} on ${bg} · ${theme}`;

/** The matrix, printed once to the build log: token × background × theme → ratio. */
export function matrixLines(table) {
  const w = Math.max(...table.map((t) => t.name.length)) + 2;
  const head = `  ${'token'.padEnd(w)}${'kind'.padEnd(9)}${THEMES.flatMap((th) => BACKGROUNDS.map((bg) => `${th[0]}:${bg}`.padEnd(11))).join('')}`;
  const rows = table.map((t) => {
    const cells = THEMES.flatMap((th) => BACKGROUNDS.map((bg) => {
      const r = t.themes[th].ratios[bg];
      const mark = t.floor === 0 || !t.on.includes(bg) ? ' ' : r < t.floor ? '✗' : '·';
      return `${r.toFixed(2)}${mark}`.padEnd(11);
    }));
    return `  ${t.name.padEnd(w)}${t.kind.padEnd(9)}${cells.join('')}`;
  });
  return [head, ...rows, '  (· clears its floor on an allowed background, ✗ under it, blank = no floor or not allowed there)'];
}

/**
 * The gate. Throws on an allowed pair under its floor that REPORTED does not
 * hold, and on a REPORTED pair that clears its floor or names no allowed pair.
 * @returns {{ checked: number, reported: string[] }}
 */
export function assertColour(table = colourTable(), log = console.log) {
  const fails = [];
  const reported = [];
  const allowed = new Set();
  let checked = 0;
  for (const t of table) {
    if (t.floor === 0) continue;
    for (const theme of THEMES) {
      if (!t.themes[theme].gamut) fails.push(`--${t.name} (${theme}) is outside sRGB; the ratio would be a clipped guess`);
      for (const bg of t.on) {
        const key = pairKey(t.name, bg, theme);
        allowed.add(key);
        checked += 1;
        const r = t.themes[theme].ratios[bg];
        if (r >= t.floor) {
          if (key in REPORTED) fails.push(`${key} clears ${t.floor}:1 at ${r}:1 — take it off REPORTED in check-colour.mjs`);
          continue;
        }
        if (key in REPORTED && REPORTED[key] !== r) fails.push(`${key} reads ${r}:1, REPORTED holds ${REPORTED[key]}:1 — the token moved; update the record`);
        else if (key in REPORTED) reported.push(`${key}: ${r}:1 under the ${t.kind} floor ${t.floor}:1 (reported, not gated)`);
        else fails.push(`${key}: ${r}:1 is under the ${t.kind} floor ${t.floor}:1`);
      }
    }
  }
  for (const key of Object.keys(REPORTED)) if (!allowed.has(key)) fails.push(`REPORTED names ${key}, which no role allows`);
  log('colour: token × background × theme → contrast');
  for (const line of matrixLines(table)) log(line);
  for (const line of reported) log(`colour: ${line}`);
  if (fails.length > 0) throw new Error(`check-colour:\n  ${fails.join('\n  ')}`);
  log(`colour: ${checked} pairs checked, ${checked - reported.length} at or over their floor, ${reported.length} reported`);
  return { checked, reported };
}

const BRANCH = 'https://github.com/simshanith/lit-ui-router/blob/www/atlas/www/atlas.lit-ui-router.dev/';
const SOURCES = {
  chrome: `${BRANCH}generator/chrome.mjs`,
  roles: `${BRANCH}generator/colour-roles.mjs`,
  guard: `${BRANCH}generator/check-colour.mjs`,
  isometric: `${BRANCH}docs/ISOMETRIC.md`,
};

const GENERATED =
  '// GENERATED by www/atlas.lit-ui-router.dev/generator/emit-app.mjs from generator/chrome.mjs, colour-roles.mjs and check-colour.mjs — do not edit.\n';

/** app/src/generated/tokens.js: the table, the floors and the reported pairs, as data. */
export const tokensModule = (table = colourTable()) =>
  GENERATED +
  `export const TOKENS = ${JSON.stringify(table, null, 2)};\n` +
  `export const BACKGROUNDS = ${JSON.stringify(BACKGROUNDS)};\n` +
  `export const FLOORS = ${JSON.stringify(FLOORS)};\n` +
  `export const REPORTED = ${JSON.stringify(REPORTED)};\n` +
  `export const NASA_MANUAL = ${JSON.stringify(NASA_MANUAL)};\n` +
  `export const SOURCES = ${JSON.stringify(SOURCES)};\n`;

/** app/src/generated/tokens.d.ts */
export const TOKENS_DTS =
  GENERATED +
  "export type Kind = 'TEXT' | 'MARK' | 'RULE' | 'SURFACE';\n" +
  "export type Theme = 'light' | 'dark';\n" +
  '/** One theme of a token: its hex (an overlay read over paper), alpha, whether it sits in sRGB, its relative luminance and its ratio per background. */\n' +
  'export interface TokenTheme {\n  hex: string;\n  alpha: number;\n  gamut: boolean;\n  y: number;\n  ratios: Record<string, number>;\n}\n' +
  '/** A `light-dark()` token of chrome.mjs\'s `:root`, with its role row and the guard\'s numbers. */\n' +
  'export interface Token {\n  name: string;\n  light: string;\n  dark: string;\n  kind: Kind;\n  floor: number;\n  on: string[];\n  role: string;\n  themes: Record<Theme, TokenTheme>;\n}\n' +
  'export declare const TOKENS: Token[];\n' +
  '/** The surfaces a TEXT, MARK or RULE token is measured against. */\n' +
  'export declare const BACKGROUNDS: string[];\n' +
  '/** The contrast floor per kind. */\n' +
  'export declare const FLOORS: Record<Kind, number>;\n' +
  '/** Pairs under their floor the guard reports and does not gate, with the ratio read. */\n' +
  'export declare const REPORTED: Record<string, number>;\n' +
  '/** The NASA Graphics Standards Manual\'s two homes. */\n' +
  'export declare const NASA_MANUAL: { page: string; pdf: string };\n' +
  '/** The files the bench names, on the atlas branch. */\n' +
  'export declare const SOURCES: { chrome: string; roles: string; guard: string; isometric: string };\n';

if (import.meta.main) assertColour();
