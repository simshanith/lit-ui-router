// Registry dates probe (INITIATIVES.md I5): the npm facts the family sheets
// cite — latest version and its publish date — fetched by script, never by
// hand.  Universe: the @uirouter family constellation (sheet 4's spine) plus
// this repo's published packages, read from the master snapshot's member
// table.  Writes diagrams/data/census-npm.json.
import { execFileSync } from 'node:child_process';
import { loadCensus, writeData } from './census-query.mjs';

// No @uirouter/vue here: it was never published to npm (sheet 4 draws it as an
// absence, not a package).
const FAMILY = [
  '@uirouter/core', '@uirouter/angularjs', '@uirouter/angular', '@uirouter/react',
  '@uirouter/visualizer', '@uirouter/rx', '@uirouter/sticky-states', '@uirouter/dsr',
];

const snap = loadCensus();
const names = [...FAMILY, ...snap.members.filter((m) => !m.private).map((m) => m.name)];

const rows = [];
for (const name of names) {
  // npm emits an ARRAY for multi-field --json views; take the sole element.
  const raw = JSON.parse(execFileSync('npm', ['view', name, 'version', 'time', '--json']).toString('utf8'));
  const info = Array.isArray(raw) ? raw[0] : raw;
  const version = info.version;
  rows.push({
    name,
    version,
    published: info.time?.[version]?.slice(0, 10) ?? null,
    created: info.time?.created?.slice(0, 10) ?? null,
  });
  console.log(name.padEnd(40), (version ?? '?').padEnd(12), rows.at(-1).published);
}

writeData('census-npm.json', {
  ref: snap.ref,
  sha: snap.sha,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'diagrams/generator/census-npm.mjs',
  used: 'npm view <pkg> version time (registry.npmjs.org)',
  wasAssociatedWith: ['npm'],
  rows,
});
