// Layer 0 of the census pipeline (INITIATIVES.md): materialize(ref) turns any
// ref into a measurable tree — rev-parse the sha, `git archive <ref>` extracted
// to a tmpdir (the archive holds exactly the ref's tracked set, so nothing is
// excluded by us beyond what git already ignores), then a relative-path walk.
// Extract ONCE per run and share the handle across probes; paths are RELATIVE
// with cwd at the tree root because scc's shebang/filename detection silently
// returns nothing for absolute paths.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));

export const refFromArgv = (argv = process.argv.slice(2)) => {
  const i = argv.indexOf('--ref');
  return i !== -1 && argv[i + 1] ? argv[i + 1] : 'origin/main';
};

export const materialize = (ref) => {
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 28 });
  const sha = git('rev-parse', '--short', ref).toString().trim();
  const commitDate = git('show', '-s', '--format=%cI', ref).toString().trim();
  const dir = mkdtempSync(join(tmpdir(), `census-${sha.replaceAll('/', '-')}-`));
  execFileSync('tar', ['-x', '-C', dir], { input: git('archive', ref), maxBuffer: 1 << 28 });

  const walk = (d, out = []) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name), out);
      else out.push(join(d, e.name));
    }
    return out;
  };
  const files = walk(dir).map((f) => f.slice(dir.length + 1)).sort();

  return { ref, sha, dir, files, commitDate, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};
