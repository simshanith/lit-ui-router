// Pure rules for the Notes-Through staleness check; the git reads live in notes-through.ts.
import { NOTES_THROUGH } from '../steps/release-bump.core.ts';

const TRAILER = new RegExp(`^${NOTES_THROUGH}: ([0-9a-f]{40})[ \\t]*$`, 'gm');

// The conventionalcommits preset's header pattern, with the breaking `!` captured.
const HEADER = /^(\w*)(?:\((.*)\))?(!?): (.*)$/;

// The commit parser's note pattern: any case, optionally a `* ` bullet, under any header.
const BREAKING_NOTE = /^(?:\*\s+)?BREAKING[ -]CHANGE:/im;

/**
 * The sha a message's last `Notes-Through:` line names, wherever it sits: a
 * squash merge appends its own trailers after a blank line, so git's
 * trailer parser would not see it there.
 */
export function parseNotesThrough(message: string): string | undefined {
  return [...message.matchAll(TRAILER)].at(-1)?.[1];
}

/**
 * Whether the notes writer would list a commit by its message alone: a listed
 * type, a breaking change under any type, or a git revert. Errs towards
 * listing: the writer's scope and revert-pair rules only move a commit into
 * the closing `Also touched` list, which still names it.
 */
export function isListedMessage(
  message: string,
  types: ReadonlySet<string>,
): boolean {
  const header = message.split('\n', 1)[0] ?? '';

  if (/^Revert\b/.test(header) || BREAKING_NOTE.test(message)) return true;

  const match = HEADER.exec(header);

  if (match === null) return false;

  const [, type = '', , bang] = match;

  return types.has(type) || bang === '!';
}

/** A commit the notes would have listed but were generated without. */
export interface StaleCommit {
  hash: string;
  subject: string;
}

/** One package's verdict. */
export interface NotesThroughResult {
  packageName: string;
  /** The commit carrying the trailer. */
  trailerCommit?: string;
  /** The sha the trailer names. */
  notesThrough?: string;
  stale: StaleCommit[];
  /** Why the check could not run; set means it failed. */
  problem?: string;
}

/** Whether a verdict passes. */
export function passes(result: NotesThroughResult): boolean {
  return result.problem === undefined && result.stale.length === 0;
}

/** The human-readable report, one block per package. */
export function formatNotesThroughReport(
  results: readonly NotesThroughResult[],
): string {
  return results
    .map((result) => {
      const { packageName, notesThrough, problem, stale } = result;

      if (problem !== undefined) return `✗ ${packageName}: ${problem}`;

      if (stale.length === 0) {
        return `✓ ${packageName}: no commit the notes would list landed after ${notesThrough}`;
      }

      return [
        `✗ ${packageName}: the notes were generated at ${notesThrough}, before these commits the notes would list; re-run the bump to regenerate them:`,
        ...stale.map(
          ({ hash, subject }) => `    ${hash.slice(0, 12)} ${subject}`,
        ),
      ].join('\n');
    })
    .join('\n');
}
