import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { Json } from '@tools/bootstrap/types.ts';
import { parse } from 'jsonc-parser';

import { WORKSPACE_SRC_GLOB } from './globs.ts';

interface Override {
  files: string[];
  rules?: Record<string, Json>;
}

// SAFETY: oxlint validates .oxlintrc.json against its schema, which this subsets
const { overrides } = parse(
  readFileSync(join(workspaceRoot, '.oxlintrc.json'), 'utf8'),
) as { overrides: Override[] };

function expandBraces(glob: string): string[] {
  const match = /\{([^}]+)\}/.exec(glob);

  if (match === null) return [glob];

  return match[1]
    .split(',')
    .flatMap((part) => expandBraces(glob.replace(match[0], part)));
}

describe('WORKSPACE_SRC_GLOB', () => {
  it('matches the files of the oxlint custom-element override', () => {
    const elements = overrides.filter(
      (o) => o.rules?.['lit/no-invalid-html'] === 'error',
    );

    assert.equal(elements.length, 1);
    assert.deepEqual(elements[0].files, expandBraces(WORKSPACE_SRC_GLOB));
  });
});
