#!/usr/bin/env node
// Checks the heights the docs reserve for their example embeds against what
// the built examples actually need.
//
// The height is a space reservation, applied before the iframe loads so the
// page doesn't shift when the example paints (LiveExample's min-height,
// ExampleEmbed's --embed-height) — so it stays a static number in the docs
// source. This measures every built example in headless Chromium at the docs
// content column and fails when a declared height no longer covers it.
//
// Usage: check-embed-heights [--json] [--verbose]

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { workspaceRoot } from '@tools/shared/workspace.ts';

import { measureExamples, serveExamples, serverOrigin } from './measure.ts';
import {
  COLUMN_WIDTH_PX,
  judge,
  parsePx,
  type Verdict,
} from './reserve.core.ts';

const MANIFEST = join(
  workspaceRoot,
  'docs/.vitepress/theme/components/examples.ts',
);
const EXAMPLES_DIR = join(workspaceRoot, 'examples');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const verbose = args.has('--verbose');

function fail(message: string): never {
  console.error(`check-embed-heights: ${message}`);
  process.exit(1);
}

/** Directories under examples/ that are examples: the tutorials, not the workspace member. */
async function exampleDirs(): Promise<string[]> {
  const entries = await readdir(EXAMPLES_DIR, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    try {
      await stat(join(EXAMPLES_DIR, entry.name, 'package.json'));
      names.push(entry.name);
    } catch {
      // not an example
    }
  }
  return names.sort();
}

const manifest = (await import(pathToFileURL(MANIFEST).href)) as {
  EXAMPLES: Record<string, { title: string; height: string }>;
};
const declared = manifest.EXAMPLES;
const built = await exampleDirs();

const missing = built.filter((name) => !(name in declared));
if (missing.length > 0) {
  fail(
    `no entry in docs/.vitepress/theme/components/examples.ts for: ${missing.join(', ')}`,
  );
}
const orphaned = Object.keys(declared).filter((name) => !built.includes(name));
if (orphaned.length > 0) {
  fail(`declared but not an example under examples/: ${orphaned.join(', ')}`);
}
for (const name of built) {
  try {
    if (
      !(await stat(join(EXAMPLES_DIR, name, 'dist', 'index.html'))).isFile()
    ) {
      throw new Error('not a file');
    }
  } catch {
    fail(
      `examples/${name}/dist is not built — run \`turbo run build:embeds --filter=examples\`` +
        ` (is ${name} listed in examples/build-embeds.ts?)`,
    );
  }
}

const server = await serveExamples(EXAMPLES_DIR);
let measured;
try {
  measured = await measureExamples(serverOrigin(server), built);
} finally {
  server.close();
}

const verdicts = new Map<string, Verdict>();
for (const name of built) {
  verdicts.set(
    name,
    judge(measured.get(name)!.height, parsePx(declared[name].height)),
  );
}

if (asJson) {
  console.log(
    JSON.stringify(
      {
        columnWidth: COLUMN_WIDTH_PX,
        examples: Object.fromEntries(
          built.map((name) => [
            name,
            { ...verdicts.get(name)!, ...measured.get(name)! },
          ]),
        ),
      },
      null,
      2,
    ),
  );
} else {
  const pad = Math.max(...built.map((name) => name.length));
  console.log(`content measured at the docs ${COLUMN_WIDTH_PX}px column\n`);
  console.log(
    `${'example'.padEnd(pad)}  measured  required  declared  status  tallest state`,
  );
  for (const name of built) {
    const verdict = verdicts.get(name)!;
    const shot = measured.get(name)!;
    console.log(
      `${name.padEnd(pad)}  ${String(verdict.measured).padStart(8)}  ${String(
        verdict.required,
      ).padStart(
        8,
      )}  ${String(verdict.declared).padStart(8)}  ${verdict.status.padEnd(6)}  ${shot.tallest}`,
    );
    if (verbose) {
      for (const state of shot.states) {
        console.log(`  ${String(state.height).padStart(6)}  ${state.state}`);
      }
    }
  }
}

const broken = built.filter((name) => verdicts.get(name)!.status !== 'ok');
if (broken.length > 0) {
  console.error('');
  for (const name of broken) {
    const {
      status,
      required,
      declared: value,
      suggested,
    } = verdicts.get(name)!;
    console.error(
      status === 'under'
        ? `${name}: reserves ${value}px but needs ${required}px — the embed scrolls inside itself. Use '${suggested}px'.`
        : `${name}: reserves ${value}px for ${required}px of content — stale. Use '${suggested}px'.`,
    );
  }
  fail(
    `${broken.length} height(s) out of date in docs/.vitepress/theme/components/examples.ts`,
  );
}
