import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  describePeerChange,
  isBreakingPeerChange,
  peerChanges,
} from './peer-changes.ts';

const peers = (
  peerDependencies: Record<string, string>,
  optional: string[] = [],
) => ({
  peerDependencies,
  peerDependenciesMeta: Object.fromEntries(
    optional.map((name) => [name, { optional: true }]),
  ),
});

describe('peerChanges', () => {
  it('reads a moved floor on 0.x as a narrowing (ui-router-registry 0.4.0)', () => {
    const changes = peerChanges(
      peers({ '@uirouter/core': '^6.1.0', 'ui-router-effect': '^0.2.0' }),
      peers({ '@uirouter/core': '^6.1.0', 'ui-router-effect': '^0.3.0' }),
    );

    assert.deepEqual(changes, [
      {
        name: 'ui-router-effect',
        kind: 'narrowed',
        from: '^0.2.0',
        to: '^0.3.0',
        optional: false,
      },
    ]);
    assert.equal(isBreakingPeerChange(changes[0]), true);
    assert.equal(
      describePeerChange(changes[0]),
      'the ui-router-effect peer narrows from ^0.2.0 to ^0.3.0.',
    );
  });

  it('reads dropping a leg as a narrowing', () => {
    const [change] = peerChanges(
      peers({ x: '^0.9.0 || ^0.10.0' }),
      peers({ x: '^0.10.0' }),
    );

    assert.equal(change?.kind, 'narrowed');
  });

  it('reads an added leg as a widening', () => {
    const [change] = peerChanges(
      peers({ x: '^0.9.0' }),
      peers({ x: '^0.9.0 || ^0.10.0' }),
    );

    assert.equal(change?.kind, 'widened');
    assert.equal(isBreakingPeerChange(change), false);
    assert.equal(
      describePeerChange(change),
      'the x peer widens from ^0.9.0 to ^0.9.0 || ^0.10.0.',
    );
  });

  it('states an added peer, breaking unless optional', () => {
    const changes = peerChanges(
      peers({}),
      peers({ x: '^1.0.0', y: '^2.0.0' }, ['y']),
    );

    assert.deepEqual(
      changes.map((change) => [
        describePeerChange(change),
        isBreakingPeerChange(change),
      ]),
      [
        ['adds the x peer at ^1.0.0.', true],
        ['adds the optional y peer at ^2.0.0.', false],
      ],
    );
  });

  it('states a removed peer', () => {
    const [change] = peerChanges(peers({ x: '^1.0.0' }), peers({}));

    assert.equal(change?.kind, 'removed');
    assert.equal(isBreakingPeerChange(change), false);
    assert.equal(describePeerChange(change), 'drops the x peer (was ^1.0.0).');
  });

  it('states an optional peer made required as breaking', () => {
    const [change] = peerChanges(
      peers({ x: '^1.0.0' }, ['x']),
      peers({ x: '^1.0.0' }),
    );

    assert.equal(change?.kind, 'required');
    assert.equal(isBreakingPeerChange(change), true);
  });

  it('ignores an equivalent respelling and an unchanged range', () => {
    assert.deepEqual(
      peerChanges(
        peers({ x: '^1.0.0', y: '^2.0.0' }),
        peers({ x: '>=1.0.0 <2.0.0-0', y: '^2.0.0' }),
      ),
      [],
    );
  });

  it('falls back to a plain change for a spec semver cannot read', () => {
    const [change] = peerChanges(
      peers({ x: '^1.0.0' }),
      peers({ x: 'npm:y@^1.0.0' }),
    );

    assert.equal(change?.kind, 'changed');
    assert.equal(isBreakingPeerChange(change), false);
  });
});
