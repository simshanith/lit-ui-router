// Sheet 7B steam channel, ported onto the pipeline (INITIATIVES.md I3):
// distinct commits touching each member's CITY UNIVERSE files (census-query
// rules — same universe as sheets 7 and 13), in the trailing 90 days ENDING AT
// THE REF'S COMMIT DATE — never a hard-coded date, so a re-run on any ref ages
// against that ref, reproducibly.  History = the shared historyLog() read over
// the snapshot's sha.
import { historyLog } from './basis.mjs';
import { cityUniverse, loadCensus, provenance, writeData } from './census-query.mjs';

const snap = loadCensus();
const { members, files } = cityUniverse(snap);
const fileToMember = new Map(files.map((f) => [f.path, f.member]));

const until = snap.commitDate.slice(0, 10);
const since = new Date(Date.parse(snap.commitDate) - 90 * 86400000).toISOString().slice(0, 10);
const log = historyLog(snap.sha, { since });

const commits = new Map(members.map((m) => [m.dir, new Set()]));
for (const c of log)
  for (const f of c.files) {
    const m = fileToMember.get(f.to ?? f.path);
    if (m) commits.get(m).add(c.sha);
  }

const rows = members.map((m) => [m.dir, commits.get(m.dir).size]);
console.log(`window ${since}..${until} (ref ${snap.ref} @ ${snap.sha})`);
for (const [m, n] of rows) console.log(m.padEnd(38), n);
console.log('window commits total (non-merge listed):', log.length);
const vals = rows.map((r) => r[1]).filter((v) => v > 0).sort((a, b) => a - b);
console.log('nonzero sorted:', vals.join(','));

writeData('census-steam.json', {
  ...provenance(snap, 'diagrams/generator/census-steam.mjs', ['git log (historyLog)']),
  window: { since, until },
  windowCommits: log.length,
  rows: rows.map(([member, touches]) => ({ member, commits: touches })),
});
