// The lit-2 alias must stay on a major the published lit peer range still
// covers, or the lit2-compat suites test a support claim nobody ships.
import { readFileSync } from 'node:fs';

const read = (url: URL) => readFileSync(url, 'utf8');

const workspaceYaml = read(
  new URL('../../pnpm-workspace.yaml', import.meta.url),
);
const rangeMatch = /publishedPeer:[\s\S]*?^ {4}lit: (.+)$/m.exec(workspaceYaml);
if (!rangeMatch) {
  throw new Error(
    'lit2-compat-guard: no publishedPeer lit range in pnpm-workspace.yaml',
  );
}
const range = rangeMatch[1].replaceAll("'", '');
if (!/(^|\|\| )\^2\./.test(range)) {
  throw new Error(
    `lit2-compat-guard: publishedPeer lit range "${range}" no longer covers ` +
      'major 2; drop the test:lit2-compat tasks or re-widen the range',
  );
}

const installed = (
  JSON.parse(
    read(new URL('node_modules/lit-2/package.json', import.meta.url)),
  ) as { version: string }
).version;
if (!installed.startsWith('2.')) {
  throw new Error(
    `lit2-compat-guard: lit-2 resolves to ${installed}, not a 2.x build. ` +
      'Repin the lit2-compat catalog in pnpm-workspace.yaml and reinstall.',
  );
}

console.log(`lit2-compat-guard: lit-2 ${installed} within peer range ${range}`);
