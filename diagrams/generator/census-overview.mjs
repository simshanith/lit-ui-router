// Cover census, ported onto the pipeline (INITIATIVES.md I1): no measuring
// here — this is a group-by-language QUERY over the master per-file snapshot
// diagrams/data/census-files.json (written by census-scc.mjs, default ref
// origin/main).  Deliberately main and not this atlas branch: surveying the
// branch counts the atlas's own drawings (a ~29k-sloc self-portrait), which
// the cover should not do.  The measurement ledger — what scc skips, the wc
// cross-check discipline — lives with the measurement in census-scc.mjs.
// Refresh flow: `node census-scc.mjs [--ref <ref>]` then re-run this.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './basis.mjs';

const snap = JSON.parse(readFileSync(join(DATA_DIR, 'census-files.json'), 'utf8'));

const byLang = new Map();
for (const r of snap.rows) {
  const l = byLang.get(r.lang) ?? { name: r.lang, count: 0, lines: 0, blank: 0, comment: 0, code: 0 };
  l.count += 1; l.lines += r.lines; l.blank += r.blank; l.comment += r.comment; l.code += r.code;
  byLang.set(r.lang, l);
}
const rows = [...byLang.values()].sort((a, b) => b.code - a.code || b.count - a.count);

const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const TOTAL = { name: 'TOTAL', count: sum('count'), lines: sum('lines'), blank: sum('blank'), comment: sum('comment'), code: sum('code') };

const n = (v) => v.toLocaleString('en-US');
const line = (r) => [r.name.padEnd(24), n(r.count).padStart(6), n(r.lines).padStart(9),
  n(r.blank).padStart(8), n(r.comment).padStart(9), n(r.code).padStart(9)].join(' ');

console.log(`ref: ${snap.ref} @ ${snap.sha} · tracked files:`, snap.tracked, '· scc classified:', TOTAL.count,
  '· unclassified (binary / dotfile / no extension):', snap.tracked - TOTAL.count);
console.log(['LANGUAGE'.padEnd(24), 'FILES'.padStart(6), 'LINES'.padStart(9),
  'BLANKS'.padStart(8), 'COMMENTS'.padStart(9), 'CODE'.padStart(9)].join(' '));
for (const r of rows) console.log(line(r));
console.log(line(TOTAL));
console.log(JSON.stringify({ ref: snap.ref, sha: snap.sha, tracked: snap.tracked, total: TOTAL, langs: rows }));
