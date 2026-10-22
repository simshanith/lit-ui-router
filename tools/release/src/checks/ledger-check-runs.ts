#!/usr/bin/env node
// Posts the release-ledger reconcile verdict on HEAD; a failure is a warning, never an exit; only a usage error exits 2.

import { createHash } from 'node:crypto';

import { defaultCapture, defaultExec } from '@tools/shared/exec.ts';
import { messageOf } from '@tools/shared/errors.ts';
import { ensureGh } from '@tools/shared/gh.ts';
import { appendStepSummary, logWarning } from '@tools/shared/gha.ts';
import * as v from 'valibot';

import { withRetry } from '../lib/retry.ts';
import {
  type Finding,
  type GitHubRelease,
  GitHubReleaseSchema,
  type GitTag,
  GitTagSchema,
  type LedgerSnapshot,
  type Packument,
  PackumentSchema,
  digestFinding,
  packagesOf,
  LedgerSnapshotSchema,
  reconcile,
  releaseOf,
  toLedgerCheckRun,
} from './ledger-check-runs.core.ts';
import {
  checkRunApiArgs,
  checkRunsMarkdown,
} from './publish-check-runs.core.ts';

const LEDGER_ORIGIN = 'https://release-ledger.lit-ui-router.dev';

const NPM_REGISTRY = 'https://registry.npmjs.org';

type Read<T> = { ok: true; value: T } | { ok: false; reason: string };

const attempt = async <T>(
  source: string,
  read: () => Promise<T>,
): Promise<Read<T>> => {
  try {
    return { ok: true, value: await withRetry(read, { baseDelayMs: 1000 }) };
  } catch (cause) {
    return { ok: false, reason: `${source}: ${messageOf(cause)}` };
  }
};

const IdToken = v.object({ value: v.string() });

/** This job's OIDC id-token for the ledger's read audience. */
async function idToken(audience: string): Promise<string> {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

  if (!url || !bearer) {
    throw new Error('no id-token request URL; the job needs id-token: write');
  }

  const request = new URL(url);
  request.searchParams.set('audience', audience);

  const response = await fetch(request, {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  if (!response.ok)
    throw new Error(`id-token request: HTTP ${response.status}`);

  return v.parse(IdToken, await response.json()).value;
}

async function readLedger(origin: string): Promise<LedgerSnapshot> {
  const token = await idToken(`${origin}/ledger`);
  console.log(`::add-mask::${token}`);

  const response = await fetch(`${origin}/ledger`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      `GET /ledger: HTTP ${response.status} ${await response.text()}`,
    );
  }

  return v.parse(LedgerSnapshotSchema, await response.json());
}

const TAGS_QUERY = `query($owner: String!, $name: String!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    refs(refPrefix: "refs/tags/", first: 100, after: $endCursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        target {
          oid
          ... on Tag { tagger { date } target { oid } }
          ... on Commit { committedDate }
        }
      }
    }
  }
}`;

const jsonLines = <T>(
  stdout: string,
  schema: v.GenericSchema<unknown, T>,
): T[] =>
  stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => v.parse(schema, JSON.parse(line)));

/** Every tag with its peeled commit; an annotated tag's ref names the tag object. */
async function readTags(repo: string): Promise<GitTag[]> {
  const [owner = '', name = ''] = repo.split('/');

  const { stdout } = await defaultCapture('gh', [
    'api',
    'graphql',
    '--paginate',
    '-F',
    `owner=${owner}`,
    '-F',
    `name=${name}`,
    '-f',
    `query=${TAGS_QUERY}`,
    '--jq',
    '.data.repository.refs.nodes[] | {name, sha: (.target.target.oid // .target.oid), at: (.target.tagger.date // .target.committedDate)}',
  ]);

  return jsonLines(stdout, GitTagSchema);
}

/** Every published release; the job's token sees no drafts. */
async function readReleases(repo: string): Promise<GitHubRelease[]> {
  const { stdout } = await defaultCapture('gh', [
    'api',
    '--paginate',
    `repos/${repo}/releases?per_page=100`,
    '--jq',
    '.[] | select(.draft | not) | {tag: .tag_name, id, url: .html_url, prerelease, body, publishedAt: .published_at, assets: [.assets[] | {name, digest}]}',
  ]);

  return jsonLines(stdout, GitHubReleaseSchema);
}

const npmPath = (name: string): string => name.replace('/', '%2f');

async function readPackument(name: string): Promise<Packument | null> {
  const response = await fetch(`${NPM_REGISTRY}/${npmPath(name)}`, {
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) return null;

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return v.parse(PackumentSchema, await response.json());
}

async function sha256Of(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return createHash('sha256')
    .update(Buffer.from(await response.arrayBuffer()))
    .digest('hex');
}

/** The digest finding for `release`, the one the post-publish call names. */
async function digestOf(
  release: string,
  releases: readonly GitHubRelease[],
  npm: ReadonlyMap<string, Packument | null>,
): Promise<Read<Finding>> {
  const parsed = releaseOf(release);

  if (!parsed)
    return { ok: false, reason: `RELEASE: not a release: ${release}` };

  const tarball = npm.get(parsed.name)?.versions[parsed.version]?.dist.tarball;

  const asset = releases
    .find(({ tag }) => tag === release)
    ?.assets.find(({ name }) => name.endsWith('.tgz'));

  if (tarball === undefined) {
    return { ok: true, value: digestFinding(release, asset, undefined) };
  }

  const digest = await attempt('npm tarball', () => sha256Of(tarball));

  return digest.ok
    ? { ok: true, value: digestFinding(release, asset, digest.value) }
    : digest;
}

async function observe(repo: string, origin: string, release: string) {
  const [ledger, tags, releases] = await Promise.all([
    attempt('ledger', () => readLedger(origin)),
    attempt('GitHub tags', () => readTags(repo)),
    attempt('GitHub releases', () => readReleases(repo)),
  ]);

  if (!ledger.ok || !tags.ok || !releases.ok) {
    return {
      findings: [],
      unreachable: [ledger, tags, releases].flatMap((read) =>
        read.ok ? [] : [read.reason],
      ),
    };
  }

  const names = packagesOf(ledger.value, tags.value, releases.value);

  const reads = await Promise.all(
    names.map(
      async (name) =>
        [
          name,
          await attempt(`npm ${name}`, () => readPackument(name)),
        ] as const,
    ),
  );

  const npm = new Map(
    reads.flatMap(([name, read]) =>
      read.ok ? [[name, read.value] as const] : [],
    ),
  );

  const unreachable = reads.flatMap(([, read]) =>
    read.ok ? [] : [read.reason],
  );

  const findings = reconcile({
    ledger: ledger.value,
    tags: tags.value,
    releases: releases.value,
    npm,
    now: Date.now(),
  });

  if (release === '') return { findings, unreachable };

  const digest = await digestOf(release, releases.value, npm);

  return digest.ok
    ? { findings: [...findings, digest.value], unreachable }
    : { findings, unreachable: [...unreachable, digest.reason] };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repo = process.env.GITHUB_REPOSITORY ?? 'simshanith/lit-ui-router';

  if (!process.env.GITHUB_REPOSITORY && !dryRun) {
    console.error(
      'ledger-check-runs: GITHUB_REPOSITORY must be set (or pass --dry-run)',
    );
    process.exitCode = 2;

    return;
  }

  await ensureGh();

  const { findings, unreachable } = await observe(
    repo,
    LEDGER_ORIGIN,
    process.env.RELEASE ?? '',
  );

  const payload = toLedgerCheckRun(findings, unreachable);

  await appendStepSummary(checkRunsMarkdown('release-ledger', [payload]));

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));

    return;
  }

  const { stdout } = await defaultExec('git', ['rev-parse', 'HEAD']);
  const headSha = stdout.trim();
  await defaultExec('gh', checkRunApiArgs(repo, headSha, payload));
  console.log(
    `created check run "${payload.name}" (${payload.conclusion}) on ${headSha}`,
  );
}

const warn = (cause: unknown): void =>
  logWarning(`release-ledger check run not reported: ${messageOf(cause)}`);

if (import.meta.main) await main().catch(warn);
