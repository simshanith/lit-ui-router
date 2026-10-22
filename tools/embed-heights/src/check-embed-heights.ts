#!/usr/bin/env node
// Checks the heights the docs reserve for their example embeds against what
// the built examples actually need.
//
// The height is a space reservation, applied before the iframe loads so the
// page doesn't shift when the example paints (LiveExample's min-height,
// ExampleEmbed's --embed-height) — so it stays a static number in the docs
// source. This measures every built example in headless Chromium at the docs
// content column and fails when a declared height no longer covers it, or
// exceeds the cap past which content scrolls inside the embed.
//
// Usage: check-embed-heights [--json] [--verbose]

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { measureExamples, serveExamples, serverOrigin } from './measure.ts';
import {
  COLUMN_WIDTH_PX,
  judge,
  MAX_HEIGHT_PX,
  parsePx,
  type Verdict,
} from './reserve.core.ts';

const MANIFEST = join(workspaceRoot, 'examples/embeds.ts');

const EXAMPLES_DIR = join(workspaceRoot, 'examples');

const args = new Set(process.argv.slice(2));

const asJson = args.has('--json');

const verbose = args.has('--verbose');

function fail(message: string): void {
  console.error(`check-embed-heights: ${message}`);
  process.exitCode = 1;
}

/** Directories under examples/ that are examples: the tutorials, not the workspace member. */
async function exampleDirs(): Promise<string[]> {
  const entries = await readdir(EXAMPLES_DIR, { withFileTypes: true });
  const names: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;

    const isExample = await stat(
      join(EXAMPLES_DIR, entry.name, 'package.json'),
    ).then(
      () => true,
      () => false,
    );

    if (isExample) names.push(entry.name);
  }

  return names.sort();
}

function problem(name: string, verdict: Verdict): string {
  const { status, required, declared, suggested } = verdict;
  const fix = `Use '${suggested}px'.`;

  if (status === 'over')
    return `${name}: reserves ${declared}px, over the ${MAX_HEIGHT_PX}px cap. ${fix}`;

  if (status === 'stale')
    return `${name}: reserves ${declared}px for ${required}px of content — stale. ${fix}`;

  return required > MAX_HEIGHT_PX
    ? `${name}: reserves ${declared}px but needs ${required}px, over the ${MAX_HEIGHT_PX}px cap — reserve the cap and let the rest scroll. ${fix}`
    : `${name}: reserves ${declared}px but needs ${required}px — the embed scrolls inside itself. ${fix}`;
}

const main = async (): Promise<void> => {
  // SAFETY: examples/embeds.ts exports EXAMPLES as a record of this entry shape
  const manifest = (await import(pathToFileURL(MANIFEST).href)) as {
    EXAMPLES: Record<string, { title: string; height: string }>;
  };

  const declared = manifest.EXAMPLES;

  const built = await exampleDirs();

  const missing = built.filter((name) => !(name in declared));

  if (missing.length > 0) {
    fail(`no entry in examples/embeds.ts for: ${missing.join(', ')}`);

    return;
  }

  const orphaned = Object.keys(declared).filter(
    (name) => !built.includes(name),
  );

  if (orphaned.length > 0) {
    fail(`declared but not an example under examples/: ${orphaned.join(', ')}`);

    return;
  }

  for (const name of built) {
    const isBuilt = await stat(
      join(EXAMPLES_DIR, name, 'dist', 'index.html'),
    ).then(
      (stats) => stats.isFile(),
      () => false,
    );

    if (!isBuilt) {
      fail(
        `examples/${name}/dist is not built — run \`turbo run build:embeds --filter=examples\`` +
          ` (is ${name} listed in examples/embeds.ts?)`,
      );

      return;
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
    console.log(
      `content measured at the docs ${COLUMN_WIDTH_PX}px column; reservations cap at ${MAX_HEIGHT_PX}px\n`,
    );
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

  const broken = built.filter((name) => {
    const { status } = verdicts.get(name)!;

    return status !== 'ok' && status !== 'capped';
  });

  if (broken.length > 0) {
    console.error('');

    for (const name of broken)
      console.error(problem(name, verdicts.get(name)!));

    fail(`${broken.length} height(s) out of date in examples/embeds.ts`);
  }
};

if (import.meta.main) await main();
