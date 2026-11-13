#!/usr/bin/env node
// Prints one version's section body from a CHANGELOG.md; the publish runs it as release-it's github.releaseNotes.
//
// Usage: extract.ts --file <CHANGELOG.md> --version <version>
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { extractSection } from './changelog.ts';

const USAGE = 'usage: extract.ts --file <CHANGELOG.md> --version <version>';

function main(argv: readonly string[]): void {
  const { values } = parseArgs({
    args: [...argv],
    options: { file: { type: 'string' }, version: { type: 'string' } },
  });

  const { file, version } = values;

  if (!file || !version) {
    console.error(`extract: --file and --version are required\n${USAGE}`);
    process.exitCode = 2;

    return;
  }

  const body = extractSection(readFileSync(file, 'utf8'), version);

  if (body === undefined) {
    console.error(`extract: ${file} has no ${version} section`);
    process.exitCode = 1;

    return;
  }

  process.stdout.write(body === '' ? '' : `${body}\n`);
}

if (import.meta.main) main(process.argv.slice(2));
