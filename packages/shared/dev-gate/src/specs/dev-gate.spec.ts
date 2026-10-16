import { afterEach, describe, expect, it, vi } from 'vitest';

import { devGate } from '../dev-gate.ts';
import { devGate as nodeDevGate } from '../dev-gate.node.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('devGate', () => {
  it('stays open whatever NODE_ENV says', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(devGate()).toBe(true);
  });
});

describe('devGate from @repo/dev-gate/node', () => {
  it('opens unless NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(nodeDevGate()).toBe(true);

    vi.stubEnv('NODE_ENV', undefined);
    expect(nodeDevGate()).toBe(true);
  });

  it('closes when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(nodeDevGate()).toBe(false);
  });
});
