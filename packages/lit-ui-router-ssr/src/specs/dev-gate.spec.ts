import { afterEach, describe, expect, it, vi } from 'vitest';

import { devGate } from '../dev-gate.js';
import { devGate as nodeDevGate } from '../dev-gate.node.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('#dev-gate', () => {
  it('stays open off node, whatever NODE_ENV says', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(devGate()).toBe(true);
  });

  it('closes under node when NODE_ENV is production', () => {
    expect(nodeDevGate()).toBe(true);

    vi.stubEnv('NODE_ENV', 'production');

    expect(nodeDevGate()).toBe(false);
  });
});
