#!/usr/bin/env node
// Type-check the repo's Markdown ts fences through the content mapper, then
// re-run without the syntax-broken fences, since tsc skips every semantic
// check while any syntax error remains.
// Reads the workspace packages' built types, so build first.
// Usage: check [tsconfig] (default docs/tsconfig.json)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { extractBlocks, type CodeBlock } from './blocks.ts';
import {
  attribute,
  brokenBlocks,
  parseDiagnostics,
  summarize,
} from './report.ts';
import { workspacePaths } from './resolution.ts';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

const tsc = path.join(packageDir, 'node_modules', '.bin', 'tsc');

const runTsc = (args: string[]): string => {
  const result = spawnSync(
    tsc,
    [...args, '--runExternalCode', '--pretty', 'false'],
    {
      cwd: workspaceRoot,
      encoding: 'utf8',
    },
  );

  return `${result.stdout}${result.stderr}`;
};

const listMarkdown = (config: string): string[] =>
  runTsc(['-p', config, '--listFilesOnly'])
    .split('\n')
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.relative(workspaceRoot, file));

/**
 * A config extending `config` with consumer `paths` and the fences to leave
 * out; it sits in this package's node_modules/.cache, outside every task's inputs.
 */
const writeConfig = (config: string, skip: string[]): string => {
  const dir = path.join(
    packageDir,
    'node_modules',
    '.cache',
    'md-content-mapper',
  );

  const file = path.join(
    dir,
    `tsconfig.${skip.length > 0 ? 'skip' : 'all'}.json`,
  );

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({
      extends: path.relative(dir, config),
      compilerOptions: {
        paths: Object.fromEntries(workspacePaths(workspaceRoot)),
      },
      contentMappers: [
        {
          package: path.relative(dir, packageDir),
          extensions: ['.md'],
          options: { skip },
        },
      ],
    }),
  );

  return file;
};

const main = (): void => {
  const config = path.resolve(
    process.argv[2] ?? path.join(packageDir, 'docs', 'tsconfig.json'),
  );

  const blocksByFile = new Map<string, CodeBlock[]>(
    listMarkdown(config).map((file) => [
      file,
      extractBlocks(fs.readFileSync(path.join(workspaceRoot, file), 'utf8')),
    ]),
  );

  const first = runTsc(['-p', writeConfig(config, [])]);

  const broken = brokenBlocks(blocksByFile, parseDiagnostics(first));

  const skip = [...broken].map((key) => path.join(workspaceRoot, key));

  const second =
    skip.length > 0 ? runTsc(['-p', writeConfig(config, skip)]) : '';

  const results = attribute(
    blocksByFile,
    [...parseDiagnostics(first), ...parseDiagnostics(second)],
    broken,
  );

  process.stdout.write(`${first}${second}`);
  console.log(`\n${summarize(results)}`);
  process.exitCode = results.some((r) => r.diagnostics.length > 0) ? 1 : 0;
};

if (import.meta.main) main();
