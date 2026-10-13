// THE EQUATION CARD — the rail head's lit-ui-router.dev = lit + ui-router over sheet 7's city, as one page.
// usage: node build-card.mjs <outdir>   writes <outdir>/card.html; render-card.mjs photographs it.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheet7 } from '../../sheet7.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const BRAND = join(HERE, '..');
// the kit is env-gated as generator/stage-site.mjs gates it; the Google stand-ins draw where the kit does not reach
const KIT = process.env.VITE_ADOBE_FONTS_KIT;

const dataUri = (file) =>
  `data:image/svg+xml,${encodeURIComponent(readFileSync(join(BRAND, file), 'utf8').trim())}`;

/** Sheet 7's drawing cropped to the city: the schedule and the severity ladder dropped, sliced to fill its box. */
function city() {
  const svg = sheet7.svg
    .replace(
      /viewBox="0 0 1560 \d+" role="img" aria-label="[^"]*"/,
      'viewBox="40 0 1480 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"',
    )
    .replace(/<!-- severity ladder -->[\s\S]*?(?=\n<polygon)/, '');
  if (!svg.includes('preserveAspectRatio') || svg.includes('severity ladder'))
    throw new Error('build-card: sheet 7 does not match the crop');
  return svg;
}

const page = ({ LOGO, FLAME, UIROUTER, GLOW, GLOW_DARK, CITY }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The Altitude Atlas</title>
${KIT ? `<link rel="preconnect" href="https://use.typekit.net" crossorigin />\n<link rel="stylesheet" href="https://use.typekit.net/${KIT}.css" />\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@600&family=Barlow+Semi+Condensed:wght@400;600&display=swap" />
<script>
  const t = new URLSearchParams(location.search).get('theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  else if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = 'dark';
</script>
<style>
/* tokens: generator/chrome.mjs */
:root {
  color-scheme: light dark;
  --ground: light-dark(oklch(92.2% 0.016 106.7), oklch(22.3% 0.054 258.1));
  --paper: light-dark(oklch(95.3% 0.012 101.5), oklch(28.8% 0.077 258.1));
  --paper-2: light-dark(oklch(92.9% 0.015 102.5), oklch(24.2% 0.065 259.0));
  --ink: light-dark(oklch(30.3% 0.010 151.5), oklch(91.9% 0.023 248.1));
  --ink-soft: light-dark(oklch(48.8% 0.016 135.0), oklch(72.8% 0.049 255.4));
  --ink-faint: light-dark(oklch(50.7% 0.012 136.6), oklch(67.6% 0.057 255.5));
  --line: light-dark(oklch(82.6% 0.025 112.1), oklch(37.2% 0.082 258.1));
  --accent: light-dark(oklch(42.4% 0.077 253.0), oklch(77.9% 0.081 248.9));
  --accent-soft: light-dark(oklch(61.8% 0.055 252.3), oklch(60.3% 0.087 253.0));
  --red: light-dark(oklch(50.5% 0.141 30.3), oklch(65.5% 0.142 33.2));
  --green: light-dark(oklch(49.6% 0.055 149.0), oklch(73.8% 0.069 152.0));
  --halo: light-dark(color-mix(in oklch, var(--accent) 10%, transparent), color-mix(in oklch, var(--accent) 12%, transparent));
  --display: "p22-fllw-eaglefeather", "Josefin Sans", sans-serif;
  --data: "din-2014", "Barlow Semi Condensed", sans-serif;
  /* the ground, lifted a step at the top-left and sunk a step at the bottom-right */
  --g-hi: light-dark(oklch(96.5% 0.012 101.5), oklch(27% 0.072 262));
  --g-mid: var(--ground);
  --g-lo: light-dark(oklch(89% 0.022 108), oklch(16.5% 0.045 254));
  --wash: light-dark(color-mix(in oklch, var(--accent) 9%, transparent), color-mix(in oklch, var(--accent-soft) 22%, transparent));
  --wash-2: light-dark(color-mix(in oklch, var(--accent) 5%, transparent), color-mix(in oklch, oklch(80% 0.12 200) 7%, transparent));
  --city-opacity: light-dark(0.30, 0.26);
  --glow-light: block; --glow-dark: none; --logo-blend: multiply; --flame-filter: none;
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; --glow-light: none; --glow-dark: block; --logo-blend: plus-lighter; --flame-filter: brightness(1.6); }

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; block-size: 100%; }
body { background: var(--ground); color: var(--ink); font-family: var(--data); }

.card {
  position: relative;
  inline-size: 100vw;
  block-size: 100vh;
  overflow: hidden;
  container-type: size;
  isolation: isolate;
  background:
    radial-gradient(ellipse 58% 62% at 50% 44%, var(--wash) 0%, transparent 72%),
    radial-gradient(ellipse 40% 45% at 88% 8%, var(--wash-2) 0%, transparent 70%),
    linear-gradient(160deg in oklch, var(--g-hi) 0%, var(--g-mid) 48%, var(--g-lo) 100%);
}
/* sheet 7's city, drawn in the theme's own ink, faded out under the equation */
.city {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: var(--city-opacity);
  filter: saturate(0.55);
  mask-image:
    radial-gradient(ellipse 50% 72% at 50% 46%, transparent 42%, #000 100%),
    linear-gradient(to bottom, #000 0%, #000 78%, transparent 100%);
  mask-composite: intersect;
  -webkit-mask-composite: source-in;
}
.city svg { inline-size: 100%; block-size: 100%; display: block; }
.sk  { stroke: var(--ink); fill: none; stroke-width: 1.3; }
.sk2 { stroke: var(--ink); fill: none; stroke-width: 2; }
.skf { stroke: var(--line); fill: none; stroke-width: 1; }
.sks { stroke: var(--ink-soft); fill: none; stroke-width: 1.1; }
.ska { stroke: var(--accent); fill: none; stroke-width: 1.6; }
.skr { stroke: var(--red); fill: none; stroke-width: 1.4; }
.fp  { fill: var(--paper); }
.fp2 { fill: var(--paper-2); }
.fi  { fill: var(--ink); }
.fis { fill: var(--ink-soft); }
.fa  { fill: var(--accent); }
.fr  { fill: var(--red); }
.fnone { fill: none; }
.city circle[r="9"] { display: none; }
.city text { display: none; }

/* the rail head, app/index.html .rail-name / .client-eq, scaled by the card: 1rem there is --r here */
.name {
  --r: min(5.3cqw, 8.6cqh);
  position: relative;
  z-index: 1;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--r) * 1.05);
  padding-block: 0 calc(60px + 1cqh);
}
.client-eq {
  display: flex;
  align-items: center;
  gap: calc(var(--r) * 0.5);
  font-family: var(--data);
  font-size: var(--r);
  font-weight: 600;
  color: var(--ink);
  line-height: 1;
}
.client-term { display: block; flex: none; }
.client-term img { block-size: calc(var(--r) * 1.5); inline-size: auto; display: block; }
.client-term .flame { filter: var(--flame-filter); }
.client-mark {
  --mark: calc(var(--r) * 2);
  --client-glow: 1;
  display: grid;
  grid-template-columns: var(--mark);
  grid-template-rows: var(--mark);
  flex: none;
}
.client-glow, .client-logo { grid-area: 1 / 1; display: block; aspect-ratio: 1; place-self: center; }
.client-glow { inline-size: calc(var(--mark) * 1.95); max-inline-size: none; object-fit: contain; opacity: var(--client-glow); }
.client-glow-light { display: var(--glow-light); }
.client-glow-dark { display: var(--glow-dark); }
.client-logo { inline-size: var(--mark); opacity: calc(1 - min(var(--client-glow), 1)); }
.client-logo-lit { opacity: var(--client-glow); mix-blend-mode: var(--logo-blend); }

h1 {
  font-family: var(--display);
  font-size: calc(var(--r) * 1.0625);
  line-height: 1.3;
  letter-spacing: 0.14em;
  font-weight: 600;
  text-align: center;
  margin: 0;
  padding-inline-start: 0.14em;
  text-wrap: balance;
}
.tag {
  margin: 0;
  font-family: var(--data);
  font-size: calc(var(--r) * 0.36);
  font-weight: 400;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-soft);
  padding-inline-start: 0.22em;
}
</style>
</head>
<body>
<main class="card">
  <div class="city">${CITY}</div>
  <div class="name">
    <div class="client-eq" role="group" aria-label="lit-ui-router.dev equals lit plus ui-router">
      <span class="client-mark">
        <img class="client-glow client-glow-light" src="${GLOW}" alt="" aria-hidden="true" />
        <img class="client-glow client-glow-dark" src="${GLOW_DARK}" alt="" aria-hidden="true" />
        <img class="client-logo" src="${LOGO}" alt="lit-ui-router.dev" />
        <img class="client-logo client-logo-lit" src="${LOGO}" alt="" aria-hidden="true" />
      </span>
      <span class="op">=</span>
      <span class="client-term"><img class="flame" src="${FLAME}" alt="Lit" /></span>
      <span class="op">+</span>
      <span class="client-term"><img src="${UIROUTER}" alt="UI-Router" /></span>
    </div>
    <h1>THE ALTITUDE ATLAS</h1>
    <p class="tag">atlas.lit-ui-router.dev</p>
  </div>
</main>
</body>
</html>
`;

function main() {
  const out = process.argv[2];
  if (!out) {
    console.error('usage: node build-card.mjs <outdir>');
    process.exitCode = 1;
    return;
  }
  mkdirSync(out, { recursive: true });
  const html = page({
    LOGO: dataUri('lit-ui-router.svg'),
    FLAME: dataUri('lit-flame.svg'),
    UIROUTER: dataUri('ui-router.svg'),
    GLOW: dataUri('hero-glow.svg'),
    GLOW_DARK: dataUri('hero-glow-dark.svg'),
    CITY: city(),
  });
  const file = join(out, 'card.html');
  writeFileSync(file, html);
  console.log(`build-card: ${file} · ${String(html.length)} bytes · kit ${KIT ? 'linked' : 'none'}`);
}

if (import.meta.main) main();
