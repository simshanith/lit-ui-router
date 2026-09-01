// Cover census: the WHOLE tracked repo at origin/main — deliberately broader
// than the sheets, which count only authored source under each member's src dir,
// and deliberately NOT this atlas branch: surveying the branch counts the atlas's
// own drawings (a 29k-sloc self-portrait), which the cover should not do.
// Basis: `git archive origin/main` extracted to a temp dir (the archive holds
// exactly main's tracked set), every extracted file handed to scc in ONE batch
// (~26 KB of argv, far under this platform's 1 MiB ARG_MAX, so the explicit
// file list is used rather than scc's directory walk — the list IS the tracked
// set, with no reliance on scc's .gitignore reading).  `git fetch origin main`
// first if the local origin/main may be stale; the measured sha is printed.
// Nothing is excluded by US beyond what git already ignores — fixtures,
// snapshots and generated .d.ts all count — but scc itself SILENTLY SKIPS
// lockfiles (pnpm-lock.yaml 12,945 lines, plus the four example
// package-lock.json): verified empirically, `scc pnpm-lock.yaml` returns [].
// scc also reports only files it can name a language for, so the table is
// short of the tracked set by the unclassified paths — binaries (favicons, the
// gzipped demo corpora), dotfiles, and those lockfiles.  The gap is printed,
// not silently swallowed.  Cross-check: wc -l over the whole tree is 75,949;
// minus binaries (3,833), lockfiles (18,273) and dotfiles (778) it lands
// within ~264 of scc's Lines total (trailing-newline off-by-ones).
// sloc = scc 4.0.0 `Code` (string-aware: template-literal interiors are code).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REF = 'origin/main';

const sha = execFileSync('git', ['rev-parse', '--short', REF], { cwd: ROOT }).toString().trim();
const tmp = mkdtempSync(join(tmpdir(), 'census-main-'));
try {
  const tar = execFileSync('git', ['archive', REF], { cwd: ROOT, maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', tmp], { input: tar, maxBuffer: 1 << 28 });

  const walk = (dir, out = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name), out);
      else out.push(join(dir, e.name));
    }
    return out;
  };
  // RELATIVE paths, cwd at the extraction root: scc's shebang and filename
  // detection (BASH task scripts, LICENSE) silently returns nothing for
  // absolute paths — only extension-based classification survives them.
  const files = walk(tmp).map((f) => f.slice(tmp.length + 1));

  // Per-language rollups straight from scc; no --by-file, so each row is a language.
  const langs = JSON.parse(execFileSync('mise',
    ['x', 'aqua:boyter/scc@4.0.0', '--', 'scc', '--format', 'json', ...files],
    { cwd: tmp, maxBuffer: 1 << 26 }).toString('utf8'));

  const rows = langs
    .map((l) => ({ name: l.Name, count: l.Count, lines: l.Lines, blank: l.Blank, comment: l.Comment, code: l.Code }))
    .sort((a, b) => b.code - a.code || b.count - a.count);

  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const TOTAL = { name: 'TOTAL', count: sum('count'), lines: sum('lines'), blank: sum('blank'), comment: sum('comment'), code: sum('code') };

  const n = (v) => v.toLocaleString('en-US');
  const line = (r) => [r.name.padEnd(24), n(r.count).padStart(6), n(r.lines).padStart(9),
    n(r.blank).padStart(8), n(r.comment).padStart(9), n(r.code).padStart(9)].join(' ');

  console.log(`ref: ${REF} @ ${sha} · tracked files:`, files.length, '· scc classified:', TOTAL.count,
    '· unclassified (binary / dotfile / no extension):', files.length - TOTAL.count);
  console.log(['LANGUAGE'.padEnd(24), 'FILES'.padStart(6), 'LINES'.padStart(9),
    'BLANKS'.padStart(8), 'COMMENTS'.padStart(9), 'CODE'.padStart(9)].join(' '));
  for (const r of rows) console.log(line(r));
  console.log(line(TOTAL));
  console.log(JSON.stringify({ ref: REF, sha, tracked: files.length, total: TOTAL, langs: rows }));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
