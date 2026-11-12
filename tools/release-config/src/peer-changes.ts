// Pure: no fs, registry or top-level valibot, so the docs worker can bundle it.
import semver from 'semver';

export interface PeerManifest {
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean } | undefined>;
}

export type PeerChangeKind =
  | 'narrowed'
  | 'widened'
  | 'changed'
  | 'added'
  | 'removed'
  | 'required'
  | 'optional';

export interface PeerChange {
  name: string;
  kind: PeerChangeKind;
  from?: string;
  to?: string;
  optional: boolean;
}

function isOptional(manifest: PeerManifest, name: string): boolean {
  return manifest.peerDependenciesMeta?.[name]?.optional === true;
}

/**
 * How a range moved: `narrowed` when some version the old range admitted no
 * longer satisfies it, `widened` when it admits everything it did and more,
 * `changed` when either side is not a semver range, undefined when equivalent.
 */
function rangeMove(
  from: string,
  to: string,
): 'narrowed' | 'widened' | 'changed' | undefined {
  if (semver.validRange(from) === null || semver.validRange(to) === null) {
    return 'changed';
  }

  if (!semver.subset(from, to)) return 'narrowed';

  return semver.subset(to, from) ? undefined : 'widened';
}

function peerChange(
  previous: PeerManifest,
  next: PeerManifest,
  name: string,
): PeerChange | undefined {
  const from = previous.peerDependencies?.[name];
  const to = next.peerDependencies?.[name];
  const optional = isOptional(next, name);

  if (from === undefined) return { name, kind: 'added', to, optional };

  if (to === undefined) {
    return {
      name,
      kind: 'removed',
      from,
      optional: isOptional(previous, name),
    };
  }

  const move = from === to ? undefined : rangeMove(from, to);

  if (move !== undefined) return { name, kind: move, from, to, optional };

  if (optional === isOptional(previous, name)) return undefined;

  return { name, kind: optional ? 'optional' : 'required', from, to, optional };
}

/**
 * The peer changes between two manifests whose ranges are already resolved
 * (published manifests, or workspace ones with `catalog:` substituted),
 * sorted by peer name.
 *
 * @param previous the last published manifest
 * @param next the manifest about to publish
 */
export function peerChanges(
  previous: PeerManifest,
  next: PeerManifest,
): PeerChange[] {
  const names = new Set([
    ...Object.keys(previous.peerDependencies ?? {}),
    ...Object.keys(next.peerDependencies ?? {}),
  ]);

  return [...names]
    .sort()
    .map((name) => peerChange(previous, next, name))
    .filter((change) => change !== undefined);
}

/**
 * Whether a consumer upgrading could stop satisfying the peer: a narrowed
 * range, a new required peer, or an optional peer made required.
 */
export function isBreakingPeerChange(change: PeerChange): boolean {
  return (
    change.kind === 'narrowed' ||
    change.kind === 'required' ||
    (change.kind === 'added' && !change.optional)
  );
}

const SENTENCES: Record<PeerChangeKind, (change: PeerChange) => string> = {
  narrowed: ({ name, from, to }) =>
    `the ${name} peer narrows from ${from} to ${to}.`,
  widened: ({ name, from, to }) =>
    `the ${name} peer widens from ${from} to ${to}.`,
  changed: ({ name, from, to }) =>
    `the ${name} peer changes from ${from} to ${to}.`,
  added: ({ name, to, optional }) =>
    `adds the ${optional ? 'optional ' : ''}${name} peer at ${to}.`,
  removed: ({ name, from }) => `drops the ${name} peer (was ${from}).`,
  required: ({ name, to }) => `the ${name} peer is no longer optional (${to}).`,
  optional: ({ name, to }) => `the ${name} peer is now optional (${to}).`,
};

/** One sentence per change, written to follow `**<package>:** `. */
export function describePeerChange(change: PeerChange): string {
  return SENTENCES[change.kind](change);
}
