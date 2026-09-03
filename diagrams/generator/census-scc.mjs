// Layer 1 master census: ONE `scc --by-file` run over the materialized ref is
// the per-file measurement every tree view queries (overview/city/yard/bricks
// group the same rows, so cross-sheet totals reconcile by construction).
// Writes diagrams/data/census-files.json — provenance fields named after
// PROV-O (generatedAtTime / wasGeneratedBy / used / wasAssociatedWith) so a
// named-graph-per-ref triple view stays a mechanical lift (INITIATIVES.md).
// Measurement ledger (carried over from the retired batch overview probe):
// the explicit file list IS the tracked set (~26 KB of argv, far under this
// platform's 1 MiB ARG_MAX), so scc's directory walk and .gitignore reading
// are never relied on.  scc SILENTLY SKIPS lockfiles (pnpm-lock.yaml plus the
// example package-lock.json — verified empirically, `scc pnpm-lock.yaml`
// returns []) and reports only files it can name a language for; the
// unclassified remainder (binaries, dotfiles, no extension) is listed in the
// snapshot, not silently swallowed.  sloc = scc 4.0.0 `Code` (string-aware:
// template-literal interiors are code).
import { execFileSync } from 'node:child_process';
import { discoverMembers, materialize, refFromArgv } from './basis.mjs';
import { writeData } from './census-query.mjs';

const SCC = 'aqua:boyter/scc@4.0.0';
const basis = materialize(refFromArgv());
try {
  const langs = JSON.parse(execFileSync('mise',
    ['x', SCC, '--', 'scc', '--by-file', '--format', 'json', ...basis.files],
    { cwd: basis.dir, maxBuffer: 1 << 26 }).toString('utf8'));

  const rows = langs
    .flatMap((l) => l.Files.map((f) => ({
      path: f.Location, lang: l.Name, lines: f.Lines, blank: f.Blank, comment: f.Comment, code: f.Code,
    })))
    .sort((a, b) => (a.path < b.path ? -1 : 1));

  const classified = new Set(rows.map((r) => r.path));
  const meta = {
    ref: basis.ref,
    sha: basis.sha,
    commitDate: basis.commitDate,
    generatedAtTime: new Date().toISOString(),
    wasGeneratedBy: 'diagrams/generator/census-scc.mjs',
    used: `git archive ${basis.ref} @ ${basis.sha}`,
    wasAssociatedWith: ['scc 4.0.0 (mise x aqua:boyter/scc)', 'git'],
    tracked: basis.files.length,
    members: discoverMembers(basis),
    unclassified: basis.files.filter((f) => !classified.has(f)),
  };

  writeData('census-files.json', { ...meta, rows }, ['members', 'unclassified', 'rows']);
  console.log(`census-files.json: ${basis.ref} @ ${basis.sha} · ${rows.length} classified / ${basis.files.length} tracked`);
} finally {
  basis.cleanup();
}
