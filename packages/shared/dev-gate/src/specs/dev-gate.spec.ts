import { afterEach, describe, expect, it, vi } from 'vitest';

import { devGate } from '../dev-gate.ts';

describe('devGate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('opens unless NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(devGate()).toBe(true);

    vi.stubEnv('NODE_ENV', undefined);
    expect(devGate()).toBe(true);
  });

  it('closes when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(devGate()).toBe(false);
  });
});
