// Pure: no fs, registry or top-level valibot, so the docs worker can bundle it.
import semver from 'semver';

/**
 * @typedef {{
 *   peerDependencies?: Record<string, string>;
 *   peerDependenciesMeta?: Record<string, { optional?: boolean } | undefined>;
 * }} PeerManifest
 *
 * @typedef {'narrowed' | 'widened' | 'changed' | 'added' | 'removed' | 'required' | 'optional'} PeerChangeKind
 *
 * @typedef {{
 *   name: string;
 *   kind: PeerChangeKind;
 *   from?: string;
 *   to?: string;
 *   optional: boolean;
 * }} PeerChange
 */

/** @param {PeerManifest} manifest @param {string} name */
function isOptional(manifest, name) {
  return manifest.peerDependenciesMeta?.[name]?.optional === true;
}

/**
 * How a range moved: `narrowed` when some version the old range admitted no
 * longer satisfies it, `widened` when it admits everything it did and more,
 * `changed` when either side is not a semver range.
 *
 * @param {string} from
 * @param {string} to
 * @returns {'narrowed' | 'widened' | 'changed' | undefined} undefined for an equivalent range
 */
function rangeMove(from, to) {
  if (semver.validRange(from) === null || semver.validRange(to) === null) {
    return 'changed';
  }

  if (!semver.subset(from, to)) return 'narrowed';

  return semver.subset(to, from) ? undefined : 'widened';
}

/** @param {PeerManifest} previous @param {PeerManifest} next @param {string} name @returns {PeerChange | undefined} */
function peerChange(previous, next, name) {
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
 * (published manifests, or workspace ones with `catalog:` substituted).
 *
 * @param {PeerManifest} previous the last published manifest
 * @param {PeerManifest} next the manifest about to publish
 * @returns {PeerChange[]} sorted by peer name
 */
export function peerChanges(previous, next) {
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
 *
 * @param {PeerChange} change
 */
export function isBreakingPeerChange(change) {
  return (
    change.kind === 'narrowed' ||
    change.kind === 'required' ||
    (change.kind === 'added' && !change.optional)
  );
}

/**
 * One sentence per change, written to follow `**<package>:** `.
 *
 * @param {PeerChange} change
 */
export function describePeerChange(change) {
  const { name, from, to } = change;

  switch (change.kind) {
    case 'narrowed':
      return `the ${name} peer narrows from ${from} to ${to}.`;
    case 'widened':
      return `the ${name} peer widens from ${from} to ${to}.`;
    case 'changed':
      return `the ${name} peer changes from ${from} to ${to}.`;
    case 'added':
      return `adds the ${change.optional ? 'optional ' : ''}${name} peer at ${to}.`;
    case 'removed':
      return `drops the ${name} peer (was ${from}).`;
    case 'required':
      return `the ${name} peer is no longer optional (${to}).`;
    case 'optional':
      return `the ${name} peer is now optional (${to}).`;
  }
}
