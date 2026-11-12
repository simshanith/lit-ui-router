import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseCatalogs, WORKSPACE_FILE } from './catalog-commits.js';
import {
  describePeerChange,
  isBreakingPeerChange,
  peerChanges,
} from './peer-changes.js';
import { cancelledCommits, prNumber } from './reverts.js';
import {
  changesShippedCode,
  classifyScope,
  resolveCatalogSpecs,
  resolvedManifestAt,
  workspaceScopes,
} from './scopes.js';

export const SITE_URL = 'https://lit-ui-router.dev';

export const NO_CODE_CHANGES = "No changes to this package's published code.";

const BREAKING = 'BREAKING CHANGES';

const PEER_SECTION = 'Peer Dependencies';

// A squash body lists the branch's commits as `* type(scope): subject`.
const SUB_COMMIT = /^\s*[*-]\s+[a-z]+(?:\([^)]*\))?!?: \S/;

/**
 * A breaking note runs until the next footer token, so in a squash body it
 * swallows the sub-commit list that follows; cut it at the first one.
 *
 * @param {string} text
 */
export function trimNoteText(text) {
  const lines = text.split('\n');
  const end = lines.findIndex((line, i) => i > 0 && SUB_COMMIT.test(line));

  return (end === -1 ? lines : lines.slice(0, end)).join('\n').trim();
}

/**
 * The docs site's pages for a release. `previousVersion` is the earlier
 * release on the same line, or empty on a package's first release.
 *
 * @param {string} packageName
 * @param {string} version
 * @param {string} previousVersion
 */
export function releaseLinks(packageName, version, previousVersion) {
  const base = `${SITE_URL}/releases/${encodeURIComponent(packageName)}`;
  const links = [`[Release page](${base}/${version}/)`];

  if (previousVersion !== '') {
    links.push(
      `[Diff from ${previousVersion}](${base}/diff/${previousVersion}...${version}/)`,
    );
  }

  return links.join(' · ');
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * Everything the notes read about the package release-it runs in (its cwd).
 *
 * @param {string} cwd
 */
function packageState(cwd) {
  const root = git(cwd, 'rev-parse', '--show-toplevel');
  const manifest = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));

  return { cwd, root, manifest, words: workspaceScopes(root) };
}

/** @param {ReturnType<typeof packageState>} state @param {string} previousVersion */
function packagePeerChanges(state, previousVersion) {
  if (previousVersion === '') return [];

  const { cwd, root, manifest } = state;

  const previous = resolvedManifestAt(
    cwd,
    `${manifest.name}@${previousVersion}`,
  );

  const next = resolveCatalogSpecs(
    manifest,
    parseCatalogs(readFileSync(join(root, WORKSPACE_FILE), 'utf8')),
  );

  return peerChanges(previous, next);
}

function repositoryUrl(context) {
  return context.repository
    ? `${context.host}/${context.owner}/${context.repository}`
    : context.repoUrl;
}

function subjectOf(commit) {
  return (commit.raw?.subject ?? commit.subject ?? commit.header ?? '').replace(
    /\s*\(#\d+\)\s*$/,
    '',
  );
}

function refOf(commit, context) {
  const pr = prNumber(commit.header);
  const repo = repositoryUrl(context);

  if (pr === undefined) return commit.shortHash ?? commit.hash?.slice(0, 7);

  return repo ? `[#${pr}](${repo}/pull/${pr})` : `#${pr}`;
}

function touchedLine(commit, context, cancelled) {
  const scope = commit.scope ? `**${commit.scope}:** ` : '';
  const pair = cancelled.get(commit);

  const why = pair
    ? `, ${pair.role === 'reverts' ? 'reverts' : 'reverted by'} ${refOf(pair.partner, context)}`
    : '';

  return `* ${scope}${subjectOf(commit)} (${refOf(commit, context)})${why}`;
}

/**
 * Sorts the range's commits: cancelled revert pairs and foreign-scope
 * commits that leave the shipped code alone go to the closing list.
 */
function partition(state, commits) {
  // the parsed commits: the preset's transform swaps `type` for its section name
  const pairs = cancelledCommits(commits.map((commit) => commit.raw ?? commit));

  const cancelled = new Map(
    commits
      .filter((commit) => pairs.has(commit.raw ?? commit))
      .map((commit) => [commit, pairs.get(commit.raw ?? commit)]),
  );

  const demoted = new Set();
  const foreign = new Set();

  for (const commit of commits) {
    if (cancelled.has(commit)) continue;

    if (
      classifyScope(commit.scope, state.manifest.name, state.words) !==
      'foreign'
    ) {
      continue;
    }

    foreign.add(commit.hash);

    if (!changesShippedCode(state.cwd, commit.hash, state.manifest)) {
      demoted.add(commit);
    }
  }

  const leaving = new Set([...demoted, ...cancelled.keys()].map((c) => c.hash));

  return { cancelled, demoted, foreign, leaving };
}

/** Keeps each breaking note's own text, from commits that stay and name this package. */
function keptNoteGroups(noteGroups, foreign, leaving) {
  return noteGroups
    .map((group) => ({
      ...group,
      notes: group.notes
        .filter(
          ({ commit }) =>
            !foreign.has(commit.hash) && !leaving.has(commit.hash),
        )
        .map((note) => ({ ...note, text: trimNoteText(note.text) })),
    }))
    .filter((group) => group.notes.length > 0);
}

/** Adds the peer statements no kept breaking note already makes. */
function addPeerStatements(context, changes, packageName) {
  const breaking = context.noteGroups.find((group) => group.title === BREAKING);
  const said = (breaking?.notes ?? []).map((note) => note.text);

  const fresh = changes.filter(
    (change) =>
      !said.some(
        (text) =>
          text.includes(change.name) && text.includes(change.to ?? change.from),
      ),
  );

  const notes = fresh.filter(isBreakingPeerChange).map((change) => ({
    title: BREAKING,
    text: describePeerChange(change),
    commit: { scope: packageName },
  }));

  const commits = fresh
    .filter((change) => !isBreakingPeerChange(change))
    .map((change) => ({
      scope: packageName,
      subject: describePeerChange(change),
    }));

  if (notes.length > 0 && breaking) breaking.notes.unshift(...notes);
  else if (notes.length > 0)
    context.noteGroups.unshift({ title: BREAKING, notes });

  if (commits.length > 0)
    context.commitGroups.push({ title: PEER_SECTION, commits });
}

/**
 * The writer's `finalizeContext` for the package release-it runs in. It
 * replaces conventional-changelog's, which only fills the compare link of
 * the header release-it.js blanks.
 *
 * The drivers in @tools/release pass `version` and `previousVersion`; the
 * peer statement and the docs-site links need both.
 */
export async function finalizeContext(
  context,
  _options,
  _filtered,
  _key,
  commits,
) {
  const state = packageState(process.cwd());
  const { name } = state.manifest;
  const { cancelled, demoted, foreign, leaving } = partition(state, commits);
  const known = context.previousVersion !== undefined;

  context.commitGroups = context.commitGroups
    .map((group) => ({
      ...group,
      commits: group.commits.filter((commit) => !leaving.has(commit.hash)),
    }))
    .filter((group) => group.commits.length > 0);
  context.noteGroups = keptNoteGroups(context.noteGroups, foreign, leaving);

  if (known) {
    addPeerStatements(
      context,
      packagePeerChanges(state, context.previousVersion),
      name,
    );
  }

  const touched = commits
    .filter((commit) => demoted.has(commit) || cancelled.has(commit))
    .map((commit) => touchedLine(commit, context, cancelled));

  const main = context.commitGroups.length + context.noteGroups.length > 0;

  context.alsoTouched = touched;
  context.preamble = !main && touched.length > 0 ? NO_CODE_CHANGES : undefined;
  context.releaseLinks =
    known && (main || touched.length > 0)
      ? releaseLinks(name, context.version, context.previousVersion)
      : undefined;

  return context;
}

/** The closing list of commits that left the main sections, then the links. */
export function footerPartial(context) {
  const touched = context.alsoTouched ?? [];

  const details = touched.length
    ? [
        '<details>',
        `<summary>Also touched this package (${touched.length})</summary>`,
        '',
        ...touched,
        '',
        '</details>',
      ].join('\n')
    : '';

  return [details, context.releaseLinks].filter(Boolean).join('\n\n');
}
