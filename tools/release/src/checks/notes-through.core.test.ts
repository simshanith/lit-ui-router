import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatNotesThroughReport,
  isListedMessage,
  parseNotesThrough,
  passes,
} from './notes-through.core.ts';

const A = 'a'.repeat(40);

const B = 'b'.repeat(40);

const TYPES = new Set([
  'feat',
  'fix',
  'refactor',
  'perf',
  'revert',
  'build',
  'docs',
]);

describe('parseNotesThrough', () => {
  it('reads the trailer of a release commit', () => {
    assert.equal(
      parseNotesThrough(
        `Release 1.8.0\n\nRelease notes: …\n\nNotes-Through: ${A}\n`,
      ),
      A,
    );
  });

  it('reads it from a squash body whose own trailers follow a blank line', () => {
    assert.equal(
      parseNotesThrough(
        `Release 1.8.0 (#9)\n\nRelease notes: …\n\nNotes-Through: ${A}\n\n* docs: edit\n\nCo-authored-by: x <x@example.com>`,
      ),
      A,
    );
  });

  it('takes the last when a squash carries two', () => {
    assert.equal(
      parseNotesThrough(
        `Release\n\nNotes-Through: ${A}\n\nNotes-Through: ${B}`,
      ),
      B,
    );
  });

  it('ignores an abbreviated sha and a missing trailer', () => {
    assert.equal(
      parseNotesThrough('Release\n\nNotes-Through: abc1234'),
      undefined,
    );
    assert.equal(parseNotesThrough('Release 1.8.0'), undefined);
  });
});

describe('isListedMessage', () => {
  it('lists the configured types, scoped or not', () => {
    assert.ok(isListedMessage('fix: a', TYPES));
    assert.ok(isListedMessage('feat(lit-ui-router): a (#1)', TYPES));
    assert.ok(isListedMessage('docs(ssr): a', TYPES));
  });

  it('leaves test, chore and ci commits out', () => {
    assert.ok(!isListedMessage('test(lit-ui-router): add a spec', TYPES));
    assert.ok(!isListedMessage('chore: tidy', TYPES));
    assert.ok(!isListedMessage('ci: cache', TYPES));
  });

  it('lists a breaking change under any type', () => {
    assert.ok(isListedMessage('chore!: drop node 20', TYPES));
    assert.ok(isListedMessage('chore: x\n\nBREAKING CHANGE: y', TYPES));
  });

  it('lists a breaking note in every form the parser reads, whatever the header', () => {
    assert.ok(
      isListedMessage('Merge pull request #12\n\nBREAKING CHANGE: y', TYPES),
    );
    assert.ok(isListedMessage('chore: x\n\nbreaking change: y', TYPES));
    assert.ok(isListedMessage('chore: x\n\n* BREAKING-CHANGE: y', TYPES));
    assert.ok(!isListedMessage('chore: x\n\nno BREAKING CHANGE: here', TYPES));
  });

  it('lists a git revert and ignores a header that is not conventional', () => {
    assert.ok(
      isListedMessage('Revert "feat: a"\n\nThis reverts commit 1.', TYPES),
    );
    assert.ok(!isListedMessage('Release 1.8.0', TYPES));
    assert.ok(!isListedMessage('Merge branch main', TYPES));
  });
});

describe('formatNotesThroughReport', () => {
  it('names each stale commit and the remedy', () => {
    const stale = {
      packageName: 'lit-ui-router',
      notesThrough: A,
      stale: [{ hash: B, subject: 'fix: late' }],
    };

    assert.ok(!passes(stale));
    assert.match(formatNotesThroughReport([stale]), /re-run the bump/);
    assert.match(formatNotesThroughReport([stale]), /bbbbbbbbbbbb fix: late/);
  });

  it('fails a problem and passes a clean range', () => {
    assert.ok(!passes({ packageName: 'x', stale: [], problem: 'no trailer' }));
    assert.ok(passes({ packageName: 'x', notesThrough: A, stale: [] }));
  });
});
