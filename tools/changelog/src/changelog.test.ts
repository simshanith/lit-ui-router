import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractSection,
  mergeSections,
  parseChangelog,
  preamble,
  renderChangelog,
  sectionHeading,
} from './changelog.ts';

const FILE = `${preamble('lit-ui-router')}

## 1.20.0 (2026-11-12)

### Features

* one

## 1.3.0 (2026-07-05)

\`\`\`md
## not a heading
\`\`\`

## 1.2.0 (2026-06-01)
`;

describe('preamble', () => {
  it('links the package’s GitHub releases with the @ encoded', () => {
    assert.match(
      preamble('lit-ui-router'),
      /\(https:\/\/github\.com\/simshanith\/lit-ui-router\/releases\?q=lit-ui-router%40&expanded=true\)/,
    );
  });
});

describe('sectionHeading', () => {
  it('dates the heading by the UTC day', () => {
    assert.equal(
      sectionHeading('1.2.0', '2026-07-05T23:30:00-05:00'),
      '1.2.0 (2026-07-06)',
    );
  });
});

describe('parseChangelog', () => {
  const changelog = parseChangelog(FILE);

  it('keeps everything before the first ## as the preamble', () => {
    assert.equal(changelog.preamble, preamble('lit-ui-router'));
  });

  it('takes the version from the heading’s first token', () => {
    assert.deepEqual(
      changelog.sections.map(({ version, heading }) => [version, heading]),
      [
        ['1.20.0', '1.20.0 (2026-11-12)'],
        ['1.3.0', '1.3.0 (2026-07-05)'],
        ['1.2.0', '1.2.0 (2026-06-01)'],
      ],
    );
  });

  it('reads a ## inside a code fence as body', () => {
    assert.equal(changelog.sections[1]?.body, '```md\n## not a heading\n```');
  });

  it('round-trips through renderChangelog', () => {
    assert.equal(renderChangelog('lit-ui-router', changelog.sections), FILE);
  });

  it('reads CRLF line endings', () => {
    assert.deepEqual(
      parseChangelog(FILE.replace(/\n/g, '\r\n')).sections,
      changelog.sections,
    );
  });
});

describe('extractSection', () => {
  it('returns one version’s body', () => {
    assert.equal(extractSection(FILE, '1.20.0'), '### Features\n\n* one');
  });

  it('does not match a version by prefix', () => {
    assert.equal(extractSection(FILE, '1.2'), undefined);
  });

  it('returns an empty body for a heading with nothing under it', () => {
    assert.equal(extractSection(FILE, '1.2.0'), '');
  });
});

describe('mergeSections', () => {
  const changelog = parseChangelog(FILE);

  it('adds missing versions newest first by semver', () => {
    const { changelog: merged, added } = mergeSections(changelog, [
      { version: '1.10.0', heading: '1.10.0 (2026-09-01)', body: 'ten' },
      { version: '1.21.0', heading: '1.21.0 (2026-11-20)', body: 'next' },
    ]);

    assert.deepEqual(
      added.map(({ version }) => version),
      ['1.10.0', '1.21.0'],
    );
    assert.deepEqual(
      merged.sections.map(({ version }) => version),
      ['1.21.0', '1.20.0', '1.10.0', '1.3.0', '1.2.0'],
    );
  });

  it('never rewrites a version already present', () => {
    const { changelog: merged, added } = mergeSections(changelog, [
      { version: '1.20.0', heading: '1.20.0 (2000-01-01)', body: 'changed' },
    ]);

    assert.deepEqual(added, []);
    assert.deepEqual(merged.sections, changelog.sections);
  });

  it('adds a version once when it arrives twice', () => {
    const section = {
      version: '2.0.0',
      heading: '2.0.0 (2027-01-01)',
      body: '',
    };

    const { added } = mergeSections(changelog, [section, section]);

    assert.equal(added.length, 1);
  });
});

describe('renderChangelog', () => {
  it('writes the fixed preamble alone when there are no sections', () => {
    assert.equal(
      renderChangelog('ui-router-server', []),
      `${preamble('ui-router-server')}\n`,
    );
  });
});
