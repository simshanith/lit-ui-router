#!/usr/bin/env node
// Adds one version's section to a package's CHANGELOG.md; the bump runs it from release-it's after:bump hook.
//
// Usage: write-section.ts --file <CHANGELOG.md> --package <name> --version <version> --notes <file> [--date <iso>]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { insertSection } from './changelog.ts';

const USAGE =
  'usage: write-section.ts --file <CHANGELOG.md> --package <name> --version <version> --notes <file> [--date <iso>]';

function main(argv: readonly string[]): void {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      file: { type: 'string' },
      package: { type: 'string' },
      version: { type: 'string' },
      notes: { type: 'string' },
      date: { type: 'string' },
    },
  });

  const { file, package: packageName, version, notes } = values;

  if (!file || !packageName || !version || notes === undefined) {
    console.error(
      `write-section: --file, --package, --version and --notes are required\n${USAGE}`,
    );
    process.exitCode = 2;

    return;
  }

  const text = existsSync(file) ? readFileSync(file, 'utf8') : undefined;

  writeFileSync(
    file,
    insertSection(packageName, text, {
      version,
      date: values.date ?? new Date().toISOString(),
      body: readFileSync(notes, 'utf8'),
    }),
  );

  console.error(`write-section: added ${version} to ${file}`);
}

if (import.meta.main) main(process.argv.slice(2));
