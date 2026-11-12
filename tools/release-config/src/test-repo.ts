import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { ConventionalChangelog } from 'conventional-changelog';

type WriterOptions = Parameters<ConventionalChangelog['writer']>[0];

import config from './release-it.js';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

export function git(cwd: string, ...args: string[]): string {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  assert.equal(run.status, 0, `git ${args.join(' ')} failed: ${run.stderr}`);

  return run.stdout.trim();
}

/** Writes each file, then commits them all with `message`. */
export function commitFiles(
  cwd: string,
  files: Record<string, string>,
  message: string,
): string {
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), content);
    git(cwd, 'add', file);
  }

  git(cwd, 'commit', '-q', '-m', message);

  return git(cwd, 'rev-parse', 'HEAD');
}

/** The plugin's context plus what the drivers in @tools/release add. */
interface NotesContext {
  version?: string;
  releaseVersion?: string;
  previousVersion?: string;
  previousTag?: string;
  currentTag?: string;
}

const plugin = config.plugins['@release-it/conventional-changelog'];

// SAFETY: notes.ts types only the writer context fields it reads
// oxlint-disable-next-line anti-slop/no-chained-type-assertions -- notes.ts types a subset of the writer context, which the writer's type can't see
const writerOpts = plugin.writerOpts as unknown as WriterOptions;

/**
 * Renders a package's notes as the release-it plugin does, from inside the
 * package directory; `context` carries what the drivers pass.
 */
export async function renderNotes(
  cwd: string,
  options: { from?: string; context?: NotesContext } = {},
): Promise<string> {
  const previous = process.cwd();

  process.chdir(cwd);

  try {
    const generator = new ConventionalChangelog(cwd)
      .loadPreset(plugin.preset)
      .repository('https://github.com/simshanith/lit-ui-router')
      .context({ version: '1.0.0', ...options.context })
      .commits({ ...plugin.gitRawCommitsOpts, from: options.from })
      .writer(writerOpts);

    let notes = '';

    for await (const chunk of generator.write()) notes += chunk;

    return notes.trim();
  } finally {
    process.chdir(previous);
  }
}
