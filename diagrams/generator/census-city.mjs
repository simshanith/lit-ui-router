// Sheet 7 census, ported onto the pipeline (INITIATIVES.md I2): a QUERY over
// the master per-file snapshot — no measuring here.  The file universe
// (members, dirs, spec split) is the shared CITY UNIVERSE in census-query.mjs,
// which sheets 7B (steam) and 13 (weather) reconcile on exactly.  A member the
// dir rules yield zero files for is printed LOUDLY, not silently dropped.
// sloc = scc `Code` from the snapshot.  Sheet 7 SHOWS test code, so files
// split into SRC and SPEC series.
import { cityUniverse, loadCensus, provenance, writeData } from './census-query.mjs';

const snap = loadCensus();
const { members, files } = cityUniverse(snap);

const rows = [];
for (const m of members) {
  const mine = files.filter((f) => f.member === m.dir);
  const acc = { src: [0, 0], spec: [0, 0] };
  for (const f of mine) {
    const k = f.spec ? 'spec' : 'src';
    acc[k][0]++; acc[k][1] += f.code;
  }
  if (!mine.length) console.log('!! ZERO FILES for member', m.dir, '— check the dir rules');
  rows.push([m.dir, ...acc.src, ...acc.spec]);
  console.log(m.dir.padEnd(38), String(acc.src[0]).padStart(3), String(acc.src[1]).padStart(6),
    ' | spec', String(acc.spec[0]).padStart(3), String(acc.spec[1]).padStart(6));
}
const t = (i) => rows.reduce((a, r) => a + r[i], 0);
console.log('TOTAL', rows.length, 'members ·', t(1), 'src files', t(2), 'src sloc ·', t(3), 'spec files', t(4), 'spec sloc');
console.log(JSON.stringify(rows));

writeData('census-city.json', {
  ...provenance(snap, 'diagrams/generator/census-city.mjs'),
  rows: rows.map(([member, srcFiles, srcSloc, specFiles, specSloc]) =>
    ({ member, srcFiles, srcSloc, specFiles, specSloc })),
});
