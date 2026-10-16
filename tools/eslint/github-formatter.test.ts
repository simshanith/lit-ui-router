import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { ESLint, Linter } from 'eslint';
import githubStylish, { annotations } from './github-formatter.ts';

const ROOT = '/repo';

function result(
  filePath: string,
  messages: Partial<Linter.LintMessage>[],
): ESLint.LintResult {
  const full = messages.map((message) => ({
    ruleId: null,
    message: '',
    severity: 2 as const,
    line: 1,
    column: 1,
    ...message,
  }));

  return {
    filePath,
    messages: full,
    suppressedMessages: [],
    errorCount: full.filter(({ severity }) => severity === 2).length,
    fatalErrorCount: full.filter(({ fatal }) => fatal === true).length,
    warningCount: full.filter(({ severity }) => severity === 1).length,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    usedDeprecatedRules: [],
  };
}

describe('annotations', () => {
  it('places an error on the repo-relative file with the rule as title', () => {
    assert.deepEqual(
      annotations(
        [
          result('/repo/packages/lit-ui-router/package.json', [
            {
              ruleId: 'package-json/require-version',
              message: "Property 'version' is required",
            },
          ]),
        ],
        ROOT,
      ),
      [
        "::error file=packages/lit-ui-router/package.json,line=1,col=1,title=package-json/require-version::Property 'version' is required",
      ],
    );
  });

  it('carries the end position and maps severity 1 to a warning', () => {
    assert.deepEqual(
      annotations(
        [
          result('/repo/a.ts', [
            {
              ruleId: 'complexity',
              severity: 1,
              message: 'too complex',
              line: 3,
              column: 8,
              endLine: 9,
              endColumn: 2,
            },
          ]),
        ],
        ROOT,
      ),
      [
        '::warning file=a.ts,line=3,col=8,endLine=9,endColumn=2,title=complexity::too complex',
      ],
    );
  });

  it('leaves the title off a fatal parse error', () => {
    assert.deepEqual(
      annotations(
        [
          result('/repo/b.ts', [
            {
              fatal: true,
              message: 'Parsing error: Unexpected token',
              line: 2,
              column: 5,
            },
          ]),
        ],
        ROOT,
      ),
      ['::error file=b.ts,line=2,col=5::Parsing error: Unexpected token'],
    );
  });

  it('escapes the message and property values', () => {
    assert.deepEqual(
      annotations(
        [
          result('/repo/dir,x/c:d.json', [
            { ruleId: 'r:1,2', message: '100% sure\r\nnext line' },
          ]),
        ],
        ROOT,
      ),
      [
        '::error file=dir%2Cx/c%3Ad.json,line=1,col=1,title=r%3A1%2C2::100%25 sure%0D%0Anext line',
      ],
    );
  });

  it('emits one command per message across files', () => {
    assert.equal(
      annotations(
        [
          result('/repo/a.json', [{ message: 'one' }, { message: 'two' }]),
          result('/repo/b.json', []),
          result('/repo/c.json', [{ message: 'three' }]),
        ],
        ROOT,
      ).length,
      3,
    );
  });
});

describe('githubStylish', () => {
  const context: ESLint.LintResultData = {
    cwd: workspaceRoot,
    rulesMeta: {},
    color: false,
  };

  const results = [
    result(`${workspaceRoot}/package.json`, [
      { ruleId: 'some/rule', message: 'broken' },
    ]),
  ];

  const saved = process.env.GITHUB_ACTIONS;

  beforeEach(() => {
    delete process.env.GITHUB_ACTIONS;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = saved;
  });

  it('prints stylish alone off Actions', async () => {
    const output = await githubStylish(results, context);

    assert.match(output, /1:1\s+error\s+broken\s+some\/rule/);
    assert.doesNotMatch(output, /^::/m);
  });

  it('appends the commands on Actions', async () => {
    process.env.GITHUB_ACTIONS = 'true';
    const output = await githubStylish(results, context);

    assert.match(output, /1:1\s+error\s+broken\s+some\/rule/);
    assert.match(
      output,
      /^::error file=package\.json,line=1,col=1,title=some\/rule::broken$/m,
    );
  });

  it('prints nothing for a clean run on Actions', async () => {
    process.env.GITHUB_ACTIONS = 'true';

    assert.equal(await githubStylish([result('/repo/a.ts', [])], context), '');
  });
});
