// The installed lit-ui-router-floor alias must equal the floor of the
// catalog:publishedPeer lit-ui-router range, or the floor typecheck lies.
import { readFileSync } from 'node:fs';

const read = (url: URL) => readFileSync(url, 'utf8');

const workspaceYaml = read(
  new URL('../../pnpm-workspace.yaml', import.meta.url),
);
const rangeMatch = /publishedPeer:[\s\S]*?^\s+lit-ui-router: (\S+)$/m.exec(
  workspaceYaml,
);
if (!rangeMatch) {
  throw new Error(
    'peer-floor-guard: no publishedPeer lit-ui-router range in pnpm-workspace.yaml',
  );
}
const range = rangeMatch[1];

// caret floor = the literal version; widen deliberately if the range shape changes
const floorMatch = /^\^(\d+\.\d+\.\d+)$/.exec(range);
if (!floorMatch) {
  throw new Error(
    `peer-floor-guard: unsupported range shape "${range}"; teach me its floor`,
  );
}
const floor = floorMatch[1];

const installed = (
  JSON.parse(
    read(
      new URL('node_modules/lit-ui-router-floor/package.json', import.meta.url),
    ),
  ) as { version: string }
).version;

if (installed !== floor) {
  throw new Error(
    `peer-floor-guard: lit-ui-router-floor resolves to ${installed}, but the ` +
      `floor of the declared peer range ${range} is ${floor}. ` +
      'Repin the peerFloor catalog in pnpm-workspace.yaml and reinstall.',
  );
}

console.log(`peer-floor-guard: floor pin ${installed} matches range ${range}`);
