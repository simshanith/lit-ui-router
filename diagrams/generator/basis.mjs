// Layer 0 of the census pipeline (INITIATIVES.md): materialize(ref) turns any
// ref into a measurable tree — rev-parse the sha, `git archive <ref>` extracted
// to a tmpdir (the archive holds exactly the ref's tracked set, so nothing is
// excluded by us beyond what git already ignores), then a relative-path walk.
// Extract ONCE per run and share the handle across probes; paths are RELATIVE
// with cwd at the tree root because scc's shebang/filename detection silently
// returns nothing for absolute paths.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
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

// T3 step (INITIATIVES.md): give a materialized archive its node_modules so
// execution probes (turbo dry-runs, nm closures) run against the REF, not a
// checkout.  corepack pnpm honors the archive's own packageManager pin;
// --frozen-lockfile means the ref's lockfile or nothing.  Returns the turbo
// binary to use: the tree's own devDep bin invoked DIRECTLY — bare path, never
// through pnpm, whose relative .bin PATH breaks turbo's spawn.
export const installDeps = (basis) => {
  execFileSync('corepack', ['pnpm', 'install', '--frozen-lockfile', '--silent'],
    { cwd: basis.dir, stdio: ['ignore', 'inherit', 'inherit'] });
  const turbo = join(basis.dir, 'node_modules', '.bin', 'turbo');
  return { turbo: existsSync(turbo) ? turbo : 'turbo' };
};

// The ONE history read feeding every T2 probe (INITIATIVES.md): non-merge
// commits reachable from <ref>, newest first, with rename tracking. Parsed to
// { sha, date, files: [{ code, path, to }] } — `to` set on R/C records.
export const historyLog = (ref, { since } = {}) => {
  const args = ['log', ref, '-M', '--name-status', '--format=@%H|%as'];
  if (since) args.splice(2, 0, `--since=${since}`);
  const raw = execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
  const commits = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('@')) {
      const bar = line.indexOf('|');
      commits.push({ sha: line.slice(1, bar), date: line.slice(bar + 1), files: [] });
    } else if (line) {
      const [code, path, to] = line.split('\t');
      commits.at(-1).files.push({ code, path, to });
    }
  }
  return commits;
};

// Members discovered from the archive's OWN pnpm-workspace.yaml + package.json
// files — never a frozen list (INITIATIVES.md fault 2: a new member appears
// automatically; a vanished one can't silently count as zero).
export const discoverMembers = ({ dir, files }) => {
  const yaml = readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8');
  const globs = [];
  let inPackages = false;
  for (const line of yaml.split('\n')) {
    if (/^packages:/.test(line)) { inPackages = true; continue; }
    if (!inPackages) continue;
    const m = line.match(/^\s+-\s+['"]?([\w./@*-]+)/);
    if (m) globs.push(m[1]);
    else if (line.trim()) break;
  }

  const fileSet = new Set(files);
  const dirs = new Set();
  for (const g of globs) {
    if (g.endsWith('/*')) {
      const prefix = g.slice(0, -1);
      for (const f of files) {
        if (!f.startsWith(prefix)) continue;
        const seg = f.slice(prefix.length).split('/')[0];
        if (fileSet.has(`${prefix}${seg}/package.json`)) dirs.add(prefix + seg);
      }
    } else if (fileSet.has(`${g}/package.json`)) dirs.add(g);
  }

  return [...dirs].sort().map((d) => {
    const pkg = JSON.parse(readFileSync(join(dir, d, 'package.json'), 'utf8'));
    return { dir: d, name: pkg.name, version: pkg.version ?? null, private: !!pkg.private };
  });
};
