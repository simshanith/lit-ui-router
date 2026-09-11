import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const cwd = process.argv[2];
const files = execSync('git ls-files', { cwd, encoding: 'utf8' }).trim().split('\n');
const SRC = /\.(ts|js|mjs|vue|html|css)$/;
const groups = {};
for (const f of files) {
  if (!SRC.test(f)) continue;
  if (/(^|\/)dist\//.test(f)) continue;
  const m = f.match(/^(packages|tools|apps)\/([^/]+)\//) || f.match(/^(docs|examples)\//);
  if (!m) continue;
  const key = m[2] ? `${m[1]}/${m[2]}` : m[1];
  const spec = /(\.spec\.|\.test\.|\/tests?\/|\/specs?\/|cypress|\.cy\.)/.test(f);
  const g = (groups[key] ??= { files: 0, loc: 0, specFiles: 0, specLoc: 0 });
  let loc = 0;
  try { loc = readFileSync(`${cwd}/${f}`, 'utf8').split('\n').length; } catch { /* unreadable file: keep the 0 */ }
  if (spec) { g.specFiles++; g.specLoc += loc; } else { g.files++; g.loc += loc; }
}
const rows = Object.entries(groups).sort((a, b) => b[1].loc - a[1].loc);
for (const [k, g] of rows) console.log(`${k}\t${g.files}f ${g.loc}l\tspec ${g.specFiles}f ${g.specLoc}l`);
