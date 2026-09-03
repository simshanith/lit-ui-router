// Snapshot IO for Layer 1/2 probes (INITIATIVES.md): load the master per-file
// census, stamp PROV-O provenance, and write reviewable one-row-per-line
// snapshot plates under diagrams/data/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './basis.mjs';

export const loadCensus = () =>
  JSON.parse(readFileSync(join(DATA_DIR, 'census-files.json'), 'utf8'));

export const provenance = (snap, script, tools = []) => ({
  ref: snap.ref,
  sha: snap.sha,
  commitDate: snap.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: script,
  used: `diagrams/data/census-files.json @ ${snap.sha}`,
  wasAssociatedWith: tools,
});

// List entries under `listKeys` render one item per line: snapshots are
// reviewed, committed plates — their diffs must read.
export const compactJson = (obj, listKeys) => {
  const parts = Object.entries(obj).map(([k, v]) => {
    if (listKeys.includes(k) && Array.isArray(v)) {
      const items = v.map((x) => '    ' + JSON.stringify(x)).join(',\n');
      return `  ${JSON.stringify(k)}: [\n${items}\n  ]`;
    }
    const s = JSON.stringify(v, null, 2).split('\n').map((l, i) => (i ? '  ' + l : l)).join('\n');
    return `  ${JSON.stringify(k)}: ${s}`;
  });
  return '{\n' + parts.join(',\n') + '\n}\n';
};

export const writeData = (file, obj, listKeys = ['rows']) => {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, file), compactJson(obj, listKeys));
};
