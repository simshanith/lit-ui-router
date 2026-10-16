// The gh calls, as argv arrays tests assert through an injectable Exec.

import { defaultCapture, type Exec } from '@tools/shared/exec.ts';
import * as v from 'valibot';

import {
  ArtifactSchema,
  RunInfoSchema,
  type Artifact,
  type RunInfo,
} from './summary.ts';

export const runViewArgs = (runId: string): string[] => [
  'run',
  'view',
  runId,
  '--json',
  Object.keys(RunInfoSchema.entries).join(','),
];

/** One `{name, expired}` JSON object per line, across every page. */
export const artifactListArgs = (runId: string): string[] => [
  'api',
  '--paginate',
  `repos/{owner}/{repo}/actions/runs/${runId}/artifacts`,
  '--jq',
  '.artifacts[] | {name, expired}',
];

export const downloadArgs = (
  runId: string,
  name: string,
  dir: string,
): string[] => ['run', 'download', runId, '-n', name, '--dir', dir];

export const parseArtifactListing = (listing: string): Artifact[] =>
  listing
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => v.parse(ArtifactSchema, JSON.parse(line)));

export async function viewRun(
  runId: string,
  exec: Exec = defaultCapture,
): Promise<RunInfo> {
  const { stdout } = await exec('gh', runViewArgs(runId));

  return v.parse(RunInfoSchema, JSON.parse(stdout));
}

export async function listArtifacts(
  runId: string,
  exec: Exec = defaultCapture,
): Promise<Artifact[]> {
  const { stdout } = await exec('gh', artifactListArgs(runId));

  return parseArtifactListing(stdout);
}

export async function downloadArtifact(
  runId: string,
  name: string,
  dir: string,
  exec: Exec = defaultCapture,
): Promise<void> {
  await exec('gh', downloadArgs(runId, name, dir));
}
