import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { workerObservability } from './worker-observability.ts';
import {
  desiredWorkersFromConfig,
  parseJsonc,
} from './workers-builds-triggers.core.ts';

const workers = desiredWorkersFromConfig(
  parseJsonc(
    await readFile(
      join(import.meta.dirname, 'workers-builds-triggers.config.jsonc'),
      'utf8',
    ),
  ),
);

describe('worker observability', () => {
  // The destination lives on the account, so a config can only name it; www/OBSERVABILITY.md describes the block.
  it('is the same block in every deployed worker config', async () => {
    for (const worker of workers) {
      assert.deepEqual(
        await workerObservability(join(workspaceRoot, worker.workerConfig)),
        {
          enabled: true,
          traces: {
            enabled: true,
            persist: false,
            destinations: ['honeycomb-traces'],
          },
        },
        worker.workerConfig,
      );
    }
  });
});
