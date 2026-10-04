// Outside the cabinet: main holds no atlas, so this archives an atlas ref and files survey-, not census-.
import { execFileSync } from 'node:child_process';
import { materialize } from './basis.mjs';
import { onCityRuler, writeData } from './census-query.mjs';

const SCC = 'aqua:boyter/scc@4.0.0';
const AT = 'www/atlas.lit-ui-router.dev/';
const argv = process.argv.slice(2);
const REF = argv.includes('--ref') ? argv[argv.indexOf('--ref') + 1] : 'www/atlas';
if (!REF || REF.startsWith('--')) throw new Error('usage: node survey-self.mjs [--ref <atlas ref>]');

// [id, what it is, the ground it stands on (as printed), path test relative to AT]
const MEMBERS = [
  ['survey', 'the survey office', 'generator/census*.mjs · basis.mjs · survey-*.mjs', (p) => /^generator\/(census[\w-]*|basis|survey-[\w-]+)\.mjs$/.test(p)],
  ['drawing', 'the drawing office', 'generator/ — every other module', (p) => p.startsWith('generator/')],
  ['site', 'the routed site', 'app/src/ — not app/src/generated/', (p) => p.startsWith('app/src/')],
  ['build', 'the site build', 'app/* — prerender, vite, artifact, lint config', (p) => /^app\/[^/]+$/.test(p)],
];
// checked before MEMBERS: what the atlas draws, generates or writes as prose
const EXCLUDED = [
  ['data/ — the filed plates', (p) => p.startsWith('data/')],
  ['app/src/generated/ — written by build.mjs', (p) => p.startsWith('app/src/generated/')],
  ['app/public/ — fragments, pictures, model, manifest', (p) => p.startsWith('app/public/')],
  ['sheet-*.html · gallery · megacanvas — the flat set', (p) => /^[^/]+\.html$/.test(p)],
  ['*.md — README (generated), HISTORY and the other prose', (p) => p.endsWith('.md')],
];

const basis = materialize(REF);
try {
  const files = basis.files.filter((f) => f.startsWith(AT));
  const langs = JSON.parse(execFileSync('mise',
    ['x', SCC, '--', 'scc', '--by-file', '--format', 'json', ...files],
    { cwd: basis.dir, maxBuffer: 1 << 26 }).toString('utf8'));
  const scc = new Map(langs.flatMap((l) => l.Files.map((f) => [f.Location, { lang: l.Name, code: f.Code }])));

  const rows = MEMBERS.map(([id, name, ground]) => ({ member: id, name, ground, srcFiles: 0, srcSloc: 0, specFiles: 0, specSloc: 0 }));
  const excluded = EXCLUDED.map(([rule]) => ({ rule, files: 0, sloc: 0 }));
  const offRuler = [];
  const unclaimed = [];
  for (const path of files) {
    const rel = path.slice(AT.length);
    const m = scc.get(path);
    const code = m?.code ?? 0;
    const x = EXCLUDED.findIndex(([, test]) => test(rel));
    if (x !== -1) { excluded[x].files++; excluded[x].sloc += code; continue; }
    const i = MEMBERS.findIndex(([, , , test]) => test(rel));
    if (i === -1) { unclaimed.push(rel); continue; }
    const ruled = onCityRuler(rel);
    if (!ruled) { offRuler.push({ path: rel, member: MEMBERS[i][0], lang: m?.lang ?? null, code }); continue; }
    const k = ruled.spec ? 'spec' : 'src';
    rows[i][`${k}Files`]++; rows[i][`${k}Sloc`] += code;
  }

  for (const r of rows) {
    if (!r.srcFiles && !r.specFiles) console.log('!! ZERO FILES for member', r.member, '— check the path rules');
    console.log(r.name.padEnd(20), String(r.srcFiles).padStart(4), String(r.srcSloc).padStart(7),
      ' | spec', String(r.specFiles).padStart(3), String(r.specSloc).padStart(6));
  }
  for (const e of excluded) console.log('excluded', e.rule.padEnd(54), String(e.files).padStart(4), String(e.sloc).padStart(7));
  for (const o of offRuler) console.log('off-ruler', o.path, o.lang ?? '(unclassified)', o.code);
  if (unclaimed.length) throw new Error(`survey-self: no rule claims ${unclaimed.join(', ')} — give it a member or an exclusion`);

  writeData('survey-self.json', {
    ref: basis.ref,
    sha: basis.sha,
    commitDate: basis.commitDate,
    generatedAtTime: new Date().toISOString(),
    wasGeneratedBy: 'www/atlas.lit-ui-router.dev/generator/survey-self.mjs',
    used: `git archive ${basis.ref} @ ${basis.sha}`,
    wasAssociatedWith: ['scc 4.0.0 (mise x aqua:boyter/scc)', 'git'],
    scope: AT,
    tracked: files.length,
    rows,
    excluded,
    offRuler,
  }, ['rows', 'excluded', 'offRuler']);
  console.log(`survey-self.json: ${basis.ref} @ ${basis.sha} · ${files.length} tracked under ${AT}`);
} finally {
  basis.cleanup();
}
