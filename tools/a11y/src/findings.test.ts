import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  findingOf,
  formatFinding,
  screenshotName,
  type Violation,
} from './findings.ts';

/** A nav link half-covered by a toast, as axe 4.13 reports it. */
const TARGET_SIZE: Violation = {
  id: 'target-size',
  impact: 'serious',
  tags: ['cat.sensory-and-visual-cues', 'wcag22aa', 'wcag258'],
  description: 'Ensure touch targets have sufficient size and space',
  help: 'All touch targets must be 24px large, or leave sufficient space',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/target-size',
  nodes: [
    {
      html: '<a href="/app/mymessages">Messages</a>',
      impact: 'serious',
      target: ['sample-nav', 'li:nth-child(2) > a'],
      any: [
        {
          id: 'target-size',
          impact: 'serious',
          message:
            'Target has insufficient size because it is partially obscured (smallest space is 11px by 20px, should be at least 24px by 24px)',
          data: {
            messageKey: 'partiallyObscured',
            minSize: 24,
            width: 11,
            height: 20,
          },
          relatedNodes: [
            {
              html: '<div class="toast">',
              target: ['.toast'],
            },
          ],
        },
        {
          id: 'target-offset',
          impact: 'serious',
          message:
            'Target has insufficient space to its closest neighbors. Safe clickable space has a diameter of 11px instead of at least 24px.',
          data: { closestOffset: 11, minOffset: 24 },
          relatedNodes: [
            {
              html: '<div class="toast">',
              target: ['.toast'],
            },
            {
              html: '<a href="/app/contacts">Contacts</a>',
              target: ['sample-nav', 'li:nth-child(3) > a'],
            },
          ],
        },
      ],
      all: [],
      none: [],
      failureSummary:
        'Fix any of the following:\n  Target has insufficient size because it is partially obscured',
    },
  ],
};

test('findingOf keeps each check with its data and related nodes', () => {
  const finding = findingOf(TARGET_SIZE, '/app inbox', 'light');

  assert.deepEqual(finding.nodes, [
    {
      target: 'sample-nav >> li:nth-child(2) > a',
      checks: [
        {
          id: 'target-size',
          message:
            'Target has insufficient size because it is partially obscured (smallest space is 11px by 20px, should be at least 24px by 24px)',
          data: {
            messageKey: 'partiallyObscured',
            minSize: 24,
            width: 11,
            height: 20,
          },
          related: ['.toast'],
        },
        {
          id: 'target-offset',
          message:
            'Target has insufficient space to its closest neighbors. Safe clickable space has a diameter of 11px instead of at least 24px.',
          data: { closestOffset: 11, minOffset: 24 },
          related: ['.toast', 'sample-nav >> li:nth-child(3) > a'],
        },
      ],
    },
  ]);
});

test('formatFinding indents each check under its target and names related nodes', () => {
  const finding = {
    ...findingOf(TARGET_SIZE, '/app inbox', 'light'),
    screenshot: 'a11y-screenshots/app-inbox-light.png',
  };

  assert.deepEqual(formatFinding(finding), [
    '/app inbox [light] target-size (serious): All touch targets must be 24px large, or leave sufficient space',
    '  screenshot: a11y-screenshots/app-inbox-light.png',
    '  sample-nav >> li:nth-child(2) > a',
    '    target-size: Target has insufficient size because it is partially obscured (smallest space is 11px by 20px, should be at least 24px by 24px)',
    '      related: .toast',
    '    target-offset: Target has insufficient space to its closest neighbors. Safe clickable space has a diameter of 11px instead of at least 24px.',
    '      related: .toast, sample-nav >> li:nth-child(3) > a',
  ]);
});

test('formatFinding leaves out the related line when axe names none', () => {
  const [node] = TARGET_SIZE.nodes;

  const finding = findingOf(
    {
      ...TARGET_SIZE,
      nodes: [
        {
          ...node,
          any: [
            {
              id: 'target-size',
              impact: 'serious',
              message:
                'Target has insufficient size (20px by 20px, should be at least 24px by 24px)',
              data: { minSize: 24, width: 20, height: 20 },
            },
          ],
        },
      ],
    },
    '/',
    'dark',
  );

  assert.deepEqual(formatFinding(finding).slice(1), [
    '  sample-nav >> li:nth-child(2) > a',
    '    target-size: Target has insufficient size (20px by 20px, should be at least 24px by 24px)',
  ]);
});

test('screenshotName sanitises the page label and scheme', () => {
  const taken = new Set<string>();

  assert.equal(
    screenshotName('/app contact edit', 'light', taken),
    'app-contact-edit-light.png',
  );
  assert.equal(screenshotName('/', 'dark', taken), 'dark.png');
  assert.equal(
    screenshotName('/api/reference/types/A', 'dark', taken),
    'api-reference-types-a-dark.png',
  );
});

test('screenshotName numbers labels that sanitise alike', () => {
  const taken = new Set<string>();

  assert.equal(
    screenshotName('/guides/a-b', 'light', taken),
    'guides-a-b-light.png',
  );
  assert.equal(
    screenshotName('/guides/a/b', 'light', taken),
    'guides-a-b-light-2.png',
  );
  assert.equal(
    screenshotName('/guides/a_b', 'light', taken),
    'guides-a-b-light-3.png',
  );
});
