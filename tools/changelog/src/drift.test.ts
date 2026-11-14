import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderChangelog } from './changelog.ts';
import { type PublishedNotes, changelogDrift, sameNotes } from './drift.ts';

const NAME = 'pkg';

const file = (...sections: [string, string][]) => ({
  name: NAME,
  text: renderChangelog(
    NAME,
    sections.map(([version, body]) => ({
      version,
      heading: `${version} (2026-01-01)`,
      body,
    })),
  ),
});

const row = (version: string, gh_body: string | null): PublishedNotes => ({
  name: NAME,
  version,
  gh_body,
});

const summary = (findings: ReturnType<typeof changelogDrift>) =>
  findings.map(
    ({ release, level, message }) => `${level} ${release}: ${message}`,
  );

describe('sameNotes', () => {
  it('ignores trailing whitespace only', () => {
    assert.equal(sameNotes('a\n\nb', 'a\n\nb\n'), true);
    assert.equal(sameNotes('a', 'a \n\t'), true);
    assert.equal(sameNotes('a', ' a'), false);
    assert.equal(sameNotes('## a', '### a'), false);
  });
});

describe('changelogDrift', () => {
  it('passes a file that matches every published body', () => {
    assert.deepEqual(
      changelogDrift(
        [file(['1.1.0', 'b'], ['1.0.0', 'a'])],
        [row('1.1.0', 'b\n'), row('1.0.0', 'a'), row('1.2.0-rc.0', 'rc')],
      ),
      [],
    );
  });

  it('reports a differing section and a missing one', () => {
    assert.deepEqual(
      summary(
        changelogDrift(
          [file(['1.1.0', 'edited'])],
          [row('1.1.0', 'b'), row('1.0.0', 'a')],
        ),
      ),
      [
        'action pkg@1.0.0: no section for a published release',
        'action pkg@1.1.0: the section differs from the published notes',
      ],
    );
  });

  it('notes the newest section ahead of every published release', () => {
    assert.deepEqual(
      summary(
        changelogDrift(
          [file(['1.2.0', 'c'], ['1.1.0', 'b'])],
          [row('1.1.0', 'b'), row('1.2.0', null)],
        ),
      ),
      ['info pkg@1.2.0: a section ahead of its GitHub release'],
    );
  });

  it('reports a section with no release that is not the newest', () => {
    assert.deepEqual(
      summary(
        changelogDrift(
          [file(['1.2.0', 'c'], ['1.1.5', 'x'], ['1.1.0', 'b'])],
          [row('1.1.0', 'b'), row('1.2.0', 'c')],
        ),
      ),
      ['action pkg@1.1.5: a section with no published GitHub release'],
    );
  });

  it('reports a newest section older than a published release', () => {
    assert.deepEqual(
      summary(changelogDrift([file(['1.0.5', 'x'])], [row('1.1.0', 'b')])),
      [
        'action pkg@1.1.0: no section for a published release',
        'action pkg@1.0.5: a section with no published GitHub release',
      ],
    );
  });

  it('reports a missing file only when a release was published', () => {
    assert.deepEqual(
      summary(
        changelogDrift(
          [
            { name: NAME, text: undefined },
            { name: 'new', text: undefined },
          ],
          [row('1.0.0', 'a'), { name: 'new', version: '0.1.0', gh_body: null }],
        ),
      ),
      ['action pkg@1.0.0: no CHANGELOG.md for a published release'],
    );
  });
});
