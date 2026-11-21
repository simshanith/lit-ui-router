// mise pins the bun that runs the Workers Builds bootstrap
// (tools/workers-builds/cloudflare-build.ts), and every trigger pins the image's
// bun to it with BUN_VERSION, so the tests run the bun the deploy does. Assert
// the triggers agree with mise.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { parse as parseJsonc } from 'jsonc-parser';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { taploGet } from './cli-query.ts';

type Trigger = { environment_variables?: { BUN_VERSION?: string } };

type TriggersConfig = {
  workers: Record<string, { production: Trigger; preview: Trigger }>;
};

// SAFETY: workers-builds-triggers.ts validates this file's shape before every apply
const { workers } = parseJsonc(
  readFileSync(
    join(
      workspaceRoot,
      'tools/workers-builds/workers-builds-triggers.config.jsonc',
    ),
    'utf8',
  ),
) as TriggersConfig;

describe('bun version pins', () => {
  it('pins every Workers Builds trigger to the mise bun', () => {
    const pinned = taploGet(
      '.config/mise/config.toml',
      'tools."aqua:oven-sh/bun"',
    );

    for (const [site, { production, preview }] of Object.entries(workers)) {
      assert.equal(
        production.environment_variables?.BUN_VERSION,
        pinned,
        `${site} production`,
      );
      assert.equal(
        preview.environment_variables?.BUN_VERSION,
        pinned,
        `${site} preview`,
      );
    }
  });
});
