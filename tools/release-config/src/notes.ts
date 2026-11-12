import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseCatalogs, WORKSPACE_FILE } from './catalog-commits.ts';
import {
  describePeerChange,
  isBreakingPeerChange,
  peerChanges,
  type PeerChange,
} from './peer-changes.ts';
import {
  type CancelledPair,
  cancelledCommits,
  prNumber,
  type RevertableCommit,
} from './reverts.ts';
import {
  changesShippedCode,
  classifyScope,
  type PackageManifest,
  resolveCatalogSpecs,
  resolvedManifestAt,
  type ScopeWords,
  workspaceScopes,
} from './scopes.ts';

export const SITE_URL = 'https://lit-ui-router.dev';

export const NO_CODE_CHANGES = "No changes to this package's published code.";

const BREAKING = 'BREAKING CHANGES';

const PEER_SECTION = 'Peer Dependencies';

// A squash body lists the branch's commits as `* type(scope): subject`.
const SUB_COMMIT = /^\s*[*-]\s+[a-z]+(?:\([^)]*\))?!?: \S/;

// Links, fenced blocks, code spans and urls stay as they are; elsewhere `@name` and `<` would render as a mention and a tag.
const MARKUP_OR_KEPT =
  /\[[^\]]*\]\([^)]*\)|^[ \t]*(?=(`{3,}|~{3,}))\1[\s\S]*?^[ \t]*\1[ \t]*\r?$|`[^`\n]*`|https?:\/\/\S+|\B@[a-z0-9][\w-]*(?:\/[\w.-]+)?|\\?</gim;

/** A commit as the parser hands it to the preset's transform. */
interface ParsedCommit extends RevertableCommit {
  scope?: string | null;
  subject?: string | null;
}

/** A commit after the preset's transform; `raw` keeps the parsed one. */
export interface WriterCommit extends ParsedCommit {
  shortHash?: string;
  raw?: ParsedCommit;
}

interface Note {
  title: string;
  text: string;
  // the writer attaches it; its published types leave it out
  commit?: { hash?: string | null; scope?: string | null };
}

interface NoteGroup {
  title: string;
  notes: Note[];
}

interface CommitGroup {
  title: string;
  commits: WriterCommit[];
}

/** The writer context fields the notes read and write. */
export interface NotesContext {
  // passed by the drivers in @tools/release
  releaseVersion?: string;
  previousVersion?: string;
  host?: string;
  owner?: string;
  repository?: string;
  repoUrl?: string;
  commitGroups: CommitGroup[];
  noteGroups: NoteGroup[];
  preamble?: string;
  alsoTouched?: string[];
  releaseLinks?: string;
}

/** The writer options finalizeContext receives; the notes read none of them. */
interface WriterOptions {
  ignoreReverted?: boolean;
}

interface PackageState {
  cwd: string;
  root: string;
  name: string;
  manifest: PackageManifest;
  words: ScopeWords;
}

/**
 * A breaking note runs until the next footer token, so in a squash body it
 * swallows the sub-commit list that follows; cut it at the first one.
 */
export function trimNoteText(text: string): string {
  const lines = text.split('\n');
  const end = lines.findIndex((line, i) => i > 0 && SUB_COMMIT.test(line));

  return (end === -1 ? lines : lines.slice(0, end)).join('\n').trim();
}

/**
 * Keeps commit text literal in Markdown: each `@name` (a JSDoc tag, an npm
 * scope, a decorator) becomes a code span, so GitHub never renders or
 * notifies it as a mention, and each `<` is escaped, so a placeholder such as
 * `<name>` is not dropped as an unknown tag.
 */
export function literalText(text: string): string {
  return text.replace(MARKUP_OR_KEPT, (match) => {
    if (match.startsWith('@')) return `\`${match}\``;

    return match === '<' || match === '\\<' ? '\\<' : match;
  });
}

/**
 * The docs site's pages for a release. `previousVersion` is the earlier
 * release on the same line, or empty on a package's first release.
 */
export function releaseLinks(
  packageName: string,
  version: string,
  previousVersion: string,
): string {
  const base = `${SITE_URL}/releases/${encodeURIComponent(packageName)}`;
  const links = [`[Release page](${base}/${version}/)`];

  if (previousVersion !== '') {
    links.push(
      `[Diff from ${previousVersion}](${base}/diff/${previousVersion}...${version}/)`,
    );
  }

  return links.join(' · ');
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Everything the notes read about the package release-it runs in (its cwd). */
function packageState(cwd: string): PackageState {
  const root = git(cwd, 'rev-parse', '--show-toplevel');

  // SAFETY: a package.json is a JSON object and every declared field is optional
  const manifest = JSON.parse(
    readFileSync(join(cwd, 'package.json'), 'utf8'),
  ) as PackageManifest;

  if (manifest.name === undefined) {
    throw new Error(`${cwd}/package.json has no name`);
  }

  return {
    cwd,
    root,
    name: manifest.name,
    manifest,
    words: workspaceScopes(root),
  };
}

/**
 * The latest stable tag's version, as the drivers pick it for a stable
 * release; empty when the package has none. Only previews without a passed
 * `previousVersion` reach this.
 */
function latestStableVersion(state: PackageState): string {
  try {
    const tag = git(
      state.cwd,
      'describe',
      '--tags',
      `--match=${state.name}@*`,
      `--exclude=${state.name}@*-*`,
      '--abbrev=0',
    );

    return tag.slice(state.name.length + 1);
  } catch (error) {
    // SAFETY: execFileSync throws errors carrying the child's stderr
    const { stderr } = error as { stderr?: string };

    if (/No names found|No tags can describe/i.test(stderr ?? '')) return '';

    throw error;
  }
}

function packagePeerChanges(
  state: PackageState,
  previousVersion: string,
): PeerChange[] {
  if (previousVersion === '') return [];

  const { cwd, root, manifest, name } = state;
  const previous = resolvedManifestAt(cwd, `${name}@${previousVersion}`);

  const next = resolveCatalogSpecs(
    manifest,
    parseCatalogs(readFileSync(join(root, WORKSPACE_FILE), 'utf8')),
  );

  return peerChanges(previous, next);
}

function repositoryUrl(context: NotesContext): string | undefined {
  return context.repository
    ? `${context.host}/${context.owner}/${context.repository}`
    : context.repoUrl;
}

function subjectOf(commit: WriterCommit): string {
  return (commit.raw?.subject ?? commit.subject ?? commit.header ?? '').replace(
    /\s*\(#\d+\)\s*$/,
    '',
  );
}

function refOf(commit: WriterCommit, context: NotesContext): string {
  const pr = prNumber(commit.header);
  const repo = repositoryUrl(context);

  if (pr === undefined) {
    return commit.shortHash ?? commit.hash?.slice(0, 7) ?? '';
  }

  return repo ? `[#${pr}](${repo}/pull/${pr})` : `#${pr}`;
}

function touchedLine(
  commit: WriterCommit,
  context: NotesContext,
  pair: CancelledPair<ParsedCommit> | undefined,
): string {
  const scope = commit.scope ? `**${commit.scope}:** ` : '';

  const why = pair
    ? `, ${pair.role === 'reverts' ? 'reverts' : 'reverted by'} ${refOf(pair.partner, context)}`
    : '';

  return `* ${scope}${literalText(subjectOf(commit))} (${refOf(commit, context)})${why}`;
}

interface Partition {
  cancelled: Map<WriterCommit, CancelledPair<ParsedCommit>>;
  demoted: Set<WriterCommit>;
  foreign: Set<string>;
  leaving: Set<string>;
}

/**
 * Sorts the range's commits: cancelled revert pairs and foreign-scope
 * commits that leave the shipped code alone go to the closing list.
 */
function partition(
  state: PackageState,
  commits: readonly WriterCommit[],
): Partition {
  // the parsed commits: the preset's transform swaps `type` for its section name
  const pairs = cancelledCommits(commits.map((commit) => commit.raw ?? commit));
  const cancelled = new Map<WriterCommit, CancelledPair<ParsedCommit>>();
  const demoted = new Set<WriterCommit>();
  const foreign = new Set<string>();

  for (const commit of commits) {
    const pair = pairs.get(commit.raw ?? commit);

    if (pair !== undefined) {
      cancelled.set(commit, pair);
      continue;
    }

    if (
      !commit.hash ||
      classifyScope(commit.scope, state.name, state.words) !== 'foreign'
    ) {
      continue;
    }

    foreign.add(commit.hash);

    if (!changesShippedCode(state.cwd, commit.hash, state.manifest)) {
      demoted.add(commit);
    }
  }

  const leaving = new Set(
    [...demoted, ...cancelled.keys()].flatMap((c) => (c.hash ? [c.hash] : [])),
  );

  return { cancelled, demoted, foreign, leaving };
}

/** Keeps each breaking note's own text, from commits that stay and name this package. */
function keptNoteGroups(
  noteGroups: readonly NoteGroup[],
  { foreign, leaving }: Partition,
): NoteGroup[] {
  const gone = (hash: string | null | undefined) =>
    !!hash && (foreign.has(hash) || leaving.has(hash));

  return noteGroups.flatMap((group) => {
    const notes = group.notes.flatMap((note) =>
      gone(note.commit?.hash)
        ? []
        : [{ ...note, text: literalText(trimNoteText(note.text)) }],
    );

    return notes.length > 0 ? [{ ...group, notes }] : [];
  });
}

/** Adds the peer statements no kept breaking note already makes. */
function addPeerStatements(
  context: NotesContext,
  changes: readonly PeerChange[],
  packageName: string,
): void {
  const { noteGroups } = context;
  const breaking = noteGroups.find((group) => group.title === BREAKING);
  const said = (breaking?.notes ?? []).map((note) => note.text);

  const fresh = changes.filter(
    (change) =>
      !said.some(
        (text) =>
          text.includes(change.name) &&
          text.includes(change.to ?? change.from ?? ''),
      ),
  );

  const notes: Note[] = [];
  const commits: WriterCommit[] = [];

  for (const change of fresh) {
    const text = literalText(describePeerChange(change));

    if (isBreakingPeerChange(change)) {
      notes.push({ title: BREAKING, text, commit: { scope: packageName } });
    } else {
      commits.push({ scope: packageName, subject: text });
    }
  }

  if (notes.length > 0) {
    if (breaking) breaking.notes.unshift(...notes);
    else noteGroups.unshift({ title: BREAKING, notes });
  }

  if (commits.length > 0) {
    context.commitGroups.push({ title: PEER_SECTION, commits });
  }
}

/**
 * The writer's `finalizeContext` for the package release-it runs in. It
 * replaces conventional-changelog's, which only fills the compare link of
 * the header release-it.ts blanks.
 *
 * `previousVersion` (empty on a first release) feeds the peer statement and
 * defaults to the latest stable tag; `releaseVersion` adds the docs-site links.
 */
export function finalizeContext(
  context: NotesContext,
  _options: WriterOptions,
  _filtered: readonly WriterCommit[],
  _key: WriterCommit | null,
  commits: readonly WriterCommit[],
): NotesContext {
  const state = packageState(process.cwd());
  const parts = partition(state, commits);
  const previousVersion = context.previousVersion ?? latestStableVersion(state);

  context.commitGroups = context.commitGroups.flatMap((group) => {
    const kept = group.commits.flatMap((commit) =>
      commit.hash && parts.leaving.has(commit.hash)
        ? []
        : [
            {
              ...commit,
              subject: commit.subject && literalText(commit.subject),
            },
          ],
    );

    return kept.length > 0 ? [{ ...group, commits: kept }] : [];
  });
  context.noteGroups = keptNoteGroups(context.noteGroups, parts);

  addPeerStatements(
    context,
    packagePeerChanges(state, previousVersion),
    state.name,
  );

  const touched = commits.flatMap((commit) =>
    parts.demoted.has(commit) || parts.cancelled.has(commit)
      ? [touchedLine(commit, context, parts.cancelled.get(commit))]
      : [],
  );

  const main = context.commitGroups.length + context.noteGroups.length > 0;

  context.alsoTouched = touched;
  context.preamble = !main && touched.length > 0 ? NO_CODE_CHANGES : undefined;
  context.releaseLinks =
    context.releaseVersion !== undefined && (main || touched.length > 0)
      ? releaseLinks(state.name, context.releaseVersion, previousVersion)
      : undefined;

  return context;
}

/** The closing list of commits that left the main sections, then the links. */
export function footerPartial(context: NotesContext): string {
  const touched = context.alsoTouched ?? [];

  const details =
    touched.length > 0
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
