// Sheet 3A's census, reconstructed as a T1 tree probe (INITIATIVES.md I5): the
// two task managers counted from the ARCHIVE alone — no mise, no turbo, no
// execution — so the handoff plate can be re-measured on any ref.  Everything
// here is a text count over files git already tracks: workflow `mise run` call
// sites, mise task-table headers, and turbo task definitions.
// Counting rules, stated so the numbers stay honest:
//   · a call site is a `mise run <target>` occurrence on a line that is not a
//     whole-line YAML comment (the one commented call site in
//     build-test-branch.yml is prose about a step, not a step);
//   · a mise task is a `[tasks.<name>]` header, minus sub-tables like
//     `[tasks.setup.env]` whose parent is itself a task, plus one per file task
//     in .config/mise/tasks/ — no TOML parser, and a name is never invented;
//   · a task "has an arg spec" when its table carries `usage = ` or, for a file
//     task, at least one `#USAGE` line;
//   · `depends` is counted twice on purpose — tasks that declare one, and the
//     dependency EDGES they declare (setup 1 + lint_workflows 4 = 5).
// turbo.json is JSONC: comments and trailing commas are stripped before parse.
// The default ref is the CABINET's pin (the master plate's sha), not a live
// branch tip — a probe filed later must measure the tree its siblings measured.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { materialize } from './basis.mjs';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const argv = process.argv.slice(2);
const argRef = argv.indexOf('--ref') !== -1 ? argv[argv.indexOf('--ref') + 1] : null;
const snap = loadCensus();
const basis = materialize(argRef ?? snap.sha);
const slurp = (p) => readFileSync(join(basis.dir, p), 'utf8');

try {
  // ---- a) workflows ------------------------------------------------------
  const wfFiles = basis.files.filter((f) => /^\.github\/workflows\/[^/]+\.yml$/.test(f)).sort();
  const targets = new Map();
  const workflows = wfFiles.map((path) => {
    const sites = [];
    for (const line of slurp(path).split('\n')) {
      if (/^\s*#/.test(line)) continue;
      for (const m of line.matchAll(/mise run\s+([^\s;|&'"]+)/g)) {
        sites.push(m[1]);
        targets.set(m[1], (targets.get(m[1]) ?? 0) + 1);
      }
    }
    return { file: path.slice('.github/workflows/'.length), name: path.slice('.github/workflows/'.length, -4), callSites: sites.length };
  });
  const callSites = workflows.reduce((a, w) => a + w.callSites, 0);

  // ---- b) mise tasks by home ---------------------------------------------
  // TOML split into [section] blocks; a task = a `tasks.<name>` section whose
  // parent path is not itself a section (that would be a sub-table).
  const tomlTasks = (path) => {
    const blocks = [];
    for (const line of slurp(path).split('\n')) {
      const head = line.match(/^\[([^\]]+)\]/);
      if (head) blocks.push({ key: head[1].replaceAll('"', ''), lines: [] });
      else if (blocks.length) blocks.at(-1).lines.push(line);
    }
    const keys = new Set(blocks.map((b) => b.key));
    const parents = (key) => key.split('.').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('.'));
    return blocks
      .filter((b) => b.key.startsWith('tasks.') && !parents(b.key).some((p) => keys.has(p)))
      .map((b) => {
        const body = b.lines.join('\n');
        const dep = body.match(/^depends\s*=\s*\[([^\]]*)\]/m);
        return {
          name: b.key.slice('tasks.'.length),
          usage: /^usage\s*=/m.test(body),
          depends: dep ? dep[1].split(',').filter((s) => s.trim()).length : 0,
        };
      });
  };
  const fileTasks = readdirSync(join(basis.dir, '.config/mise/tasks')).sort().map((name) => {
    const body = slurp(join('.config/mise/tasks', name));
    return { name, usage: /^#USAGE/m.test(body), depends: 0 };
  });

  const homes = [
    { home: 'tools/build_and_test/mise.toml', label: 'tools/build_and_test', tasks: tomlTasks('tools/build_and_test/mise.toml') },
    { home: '.config/mise/tasks/*', label: '.config/mise/tasks/*', tasks: fileTasks },
    { home: 'tools/release/mise.toml', label: 'tools/release', tasks: tomlTasks('tools/release/mise.toml') },
    { home: '.config/mise/config.toml', label: 'config.toml inline', tasks: tomlTasks('.config/mise/config.toml') },
  ].map((h) => ({
    home: h.home,
    label: h.label,
    count: h.tasks.length,
    withUsage: h.tasks.filter((t) => t.usage).length,
    withDepends: h.tasks.filter((t) => t.depends).length,
    dependsEdges: h.tasks.reduce((a, t) => a + t.depends, 0),
    names: h.tasks.map((t) => t.name),
  }));
  const sum = (k) => homes.reduce((a, h) => a + h[k], 0);

  // ---- c) turbo ------------------------------------------------------------
  const stripJsonc = (s) => {
    let out = '';
    for (let i = 0, quoted = false; i < s.length;) {
      const c = s[i];
      if (quoted) {
        out += c;
        if (c === '\\') { out += s[i + 1] ?? ''; i += 2; continue; }
        if (c === '"') quoted = false;
        i++;
      } else if (c === '"') { quoted = true; out += c; i++; }
      else if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; }
      else if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; }
      else { out += c; i++; }
    }
    return out.replace(/,(\s*[}\]])/g, '$1');
  };
  const turboFiles = basis.files.filter((f) => f === 'turbo.json' || f.endsWith('/turbo.json')).sort().map((file) => {
    const tasks = JSON.parse(stripJsonc(slurp(file))).tasks ?? {};
    return {
      file,
      root: file === 'turbo.json',
      definitions: Object.keys(tasks).length,
      cacheFalse: Object.values(tasks).filter((t) => t?.cache === false).length,
    };
  });
  const split = (k) => [
    turboFiles.filter((f) => f.root).reduce((a, f) => a + f[k], 0),
    turboFiles.filter((f) => !f.root).reduce((a, f) => a + f[k], 0),
  ];
  const [rootDefs, memberDefs] = split('definitions');
  const [rootCacheFalse, memberCacheFalse] = split('cacheFalse');

  const plate = {
    ...provenance(argRef ? { ref: basis.ref, sha: basis.sha, commitDate: basis.commitDate } : snap,
      'diagrams/generator/census-handoff.mjs', ['git']),
    used: `git archive ${argRef ?? snap.ref} @ ${basis.sha}`,
    workflows: {
      files: workflows.length,
      calling: workflows.filter((w) => w.callSites).length,
      callSites,
      targets: targets.size,
    },
    mise: {
      tasks: sum('count'),
      homes: homes.length,
      withUsage: sum('withUsage'),
      withDepends: sum('withDepends'),
      dependsEdges: sum('dependsEdges'),
    },
    turbo: {
      files: turboFiles.length,
      definitions: rootDefs + memberDefs,
      rootDefinitions: rootDefs,
      memberDefinitions: memberDefs,
      cacheFalse: rootCacheFalse + memberCacheFalse,
      rootCacheFalse,
      memberCacheFalse,
    },
    workflowRows: workflows,
    miseTargets: [...targets].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([target, calls]) => ({ target, calls })),
    miseHomes: homes,
    turboRows: turboFiles,
  };
  writeData('census-handoff.json', plate, ['workflowRows', 'miseTargets', 'miseHomes', 'turboRows']);

  console.log(`census-handoff.json: ${plate.ref} @ ${basis.sha}`);
  for (const w of [...workflows].sort((a, b) => b.callSites - a.callSites)) console.log(' ', w.name.padEnd(20), w.callSites);
  console.log(`workflows ${plate.workflows.files} · ${plate.workflows.calling} call mise · ${callSites} call sites · ${targets.size} distinct targets`);
  for (const h of homes) console.log(' ', h.label.padEnd(24), h.count, '· usage', h.withUsage, '· depends', h.withDepends, `(${h.dependsEdges} edges)`);
  console.log(`mise ${plate.mise.tasks} tasks · ${plate.mise.withUsage} with arg specs · ${plate.mise.withDepends} with depends (${plate.mise.dependsEdges} edges)`);
  console.log(`turbo ${plate.turbo.files} files · ${plate.turbo.definitions} definitions (${rootDefs} root + ${memberDefs} member) · ${plate.turbo.cacheFalse} cache:false (${rootCacheFalse} + ${memberCacheFalse})`);
} finally {
  basis.cleanup();
}
