import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PackageSummary } from './check-published-diff.core.ts';
import {
  checkRunApiArgs,
  checkRunName,
  releaseWorkflowUrl,
  toCheckRun,
} from './publish-check-runs.core.ts';

const REPO = 'simshanith/lit-ui-router';
const RELEASE_URL = `https://github.com/${REPO}/actions/workflows/bump-version.yml`;

const clean: PackageSummary = {
  name: 'lit-ui-router-mobx',
  dir: 'packages/lit-ui-router-mobx',
  version: '0.3.3',
  shipAffecting: 0,
  shipInert: 0,
  clean: true,
  shipAffectingFiles: [],
  shipInertFiles: [],
};

const drifting: PackageSummary = {
  name: 'lit-ui-router',
  dir: 'packages/lit-ui-router',
  version: '1.7.0',
  shipAffecting: 2,
  shipInert: 1,
  clean: false,
  shipAffectingFiles: ['dist/core.js', 'package.json'],
  shipInertFiles: ['src/core.ts'],
};

describe('checkRunName', () => {
  it('composes the exact name the README badge nameFilter matches', () => {
    assert.equal(
      checkRunName('lit-ui-router'),
      'published-diff (lit-ui-router)',
    );
  });
});

describe('toCheckRun', () => {
  it('maps a clean package to success with the published baseline named', () => {
    const payload = toCheckRun(clean, REPO);
    assert.equal(payload.conclusion, 'success');
    assert.equal(payload.title, 'up to date with 0.3.3');
    assert.match(payload.summary, /match lit-ui-router-mobx@0\.3\.3/);
    assert.doesNotMatch(payload.summary, /<details>/);
  });

  it('maps drift to action_required, never failure, with unit and baseline in the title', () => {
    const payload = toCheckRun(drifting, REPO);
    assert.equal(payload.conclusion, 'action_required');
    assert.equal(
      payload.title,
      'unreleased changes vs 1.7.0 (2 shipped files differ)',
    );
  });

  it('opens a drifting summary with the resolve line linking the release workflow', () => {
    const { summary } = toCheckRun(drifting, REPO);
    const [first] = summary.split('\n');
    assert.equal(
      first,
      `To resolve: [release lit-ui-router via the bump-version workflow](${RELEASE_URL}) — select the package in its Run workflow menu.`,
    );
  });

  it('never puts the resolve line on a clean summary', () => {
    assert.doesNotMatch(toCheckRun(clean, REPO).summary, /To resolve/);
  });

  it('lists ship-affecting files expanded and ship-inert collapsed', () => {
    const { summary } = toCheckRun(drifting, REPO);
    const details = summary.indexOf('<details>');
    assert.notEqual(details, -1);
    assert.equal(summary.indexOf('- `dist/core.js`') < details, true);
    assert.equal(summary.indexOf('- `package.json`') < details, true);
    assert.equal(summary.indexOf('- `src/core.ts`') > details, true);
    assert.match(summary, /<summary>1 ship-inert file\(s\)/);
  });

  it('treats an unpublished package as success with nothing to diff', () => {
    const payload = toCheckRun({ ...clean, version: null }, REPO);
    assert.equal(payload.conclusion, 'success');
    assert.match(payload.title, /never published/);
  });
});

describe('releaseWorkflowUrl', () => {
  it('composes the bump-version workflow page for the repo', () => {
    assert.equal(releaseWorkflowUrl(REPO), RELEASE_URL);
  });
});

describe('checkRunApiArgs', () => {
  it('builds the gh api argv for one check run on the given head', () => {
    assert.deepEqual(
      checkRunApiArgs('simshanith/lit-ui-router', 'abc123', {
        name: 'published-diff (lit-ui-router)',
        conclusion: 'action_required',
        title: 'unreleased changes vs 1.7.0 (2 shipped files differ)',
        summary: 'body',
      }),
      [
        'api',
        'repos/simshanith/lit-ui-router/check-runs',
        '-f',
        'name=published-diff (lit-ui-router)',
        '-f',
        'head_sha=abc123',
        '-f',
        'status=completed',
        '-f',
        'conclusion=action_required',
        '-f',
        'output[title]=unreleased changes vs 1.7.0 (2 shipped files differ)',
        '-f',
        'output[summary]=body',
      ],
    );
  });
});
