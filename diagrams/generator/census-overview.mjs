// Cover census: the WHOLE tracked repo at HEAD — deliberately broader than the
// sheets, which count only authored source under each member's src dir.
// Basis: every path `git ls-files` reports from ROOT, handed to scc in ONE batch
// (636 paths / ~26 KB of argv, far under this platform's 1 MiB ARG_MAX, so the
// explicit file list is used rather than scc's directory walk — the list IS the
// tracked set, with no reliance on scc's .gitignore reading).
// Nothing is excluded beyond what git already ignores: lockfiles, fixtures,
// snapshots, generated .d.ts and this atlas's own drawings all count.
// scc reports only files it can name a language for, so the language table is
// short of `git ls-files` by the unclassified paths — binaries (favicons, the
// gzipped demo corpora), dotfiles and extensionless task scripts.  The gap is
// printed, not silently swallowed.
// sloc = scc 4.0.0 `Code` (string-aware: template-literal interiors are code).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 26 })
  .toString('utf8').split('\0').filter(Boolean);

// Per-language rollups straight from scc; no --by-file, so each row is a language.
const langs = JSON.parse(execFileSync('mise',
  ['x', 'aqua:boyter/scc@4.0.0', '--', 'scc', '--format', 'json', ...files],
  { cwd: ROOT, maxBuffer: 1 << 26 }).toString('utf8'));

const rows = langs
  .map((l) => ({ name: l.Name, count: l.Count, lines: l.Lines, blank: l.Blank, comment: l.Comment, code: l.Code }))
  .sort((a, b) => b.code - a.code || b.count - a.count);

const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const TOTAL = { name: 'TOTAL', count: sum('count'), lines: sum('lines'), blank: sum('blank'), comment: sum('comment'), code: sum('code') };

const n = (v) => v.toLocaleString('en-US');
const line = (r) => [r.name.padEnd(24), n(r.count).padStart(6), n(r.lines).padStart(9),
  n(r.blank).padStart(8), n(r.comment).padStart(9), n(r.code).padStart(9)].join(' ');

console.log('tracked files (git ls-files):', files.length, '· scc classified:', TOTAL.count,
  '· unclassified (binary / dotfile / no extension):', files.length - TOTAL.count);
console.log(['LANGUAGE'.padEnd(24), 'FILES'.padStart(6), 'LINES'.padStart(9),
  'BLANKS'.padStart(8), 'COMMENTS'.padStart(9), 'CODE'.padStart(9)].join(' '));
for (const r of rows) console.log(line(r));
console.log(line(TOTAL));
console.log(JSON.stringify({ total: TOTAL, langs: rows }));
