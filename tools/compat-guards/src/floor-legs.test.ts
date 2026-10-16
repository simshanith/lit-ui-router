import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type FloorLegs,
  legAlias,
  legLine,
  parseFloorAlias,
  proveLegs,
} from './floor-legs.ts';

const legs = (overrides: Partial<FloorLegs>): FloorLegs => ({
  dep: 'ui-router-server',
  kind: 'peer',
  catalog: 'publishedPeerSsr',
  range: '^0.2.0 || ^0.3.0',
  floorCatalog: 'peerFloorSsr',
  aliases: { 'ui-router-server-floor': '0.2.0' },
  dev: () => '0.3.1',
  ...overrides,
});

describe('parseFloorAlias', () => {
  it('reads the dep of a <dep>-floor alias', () => {
    assert.deepEqual(parseFloorAlias('ui-router-server-floor'), {
      dep: 'ui-router-server',
    });
    assert.deepEqual(parseFloorAlias('@lit-labs/ssr-client-floor'), {
      dep: '@lit-labs/ssr-client',
    });
  });

  it('reads the dep and line of a <dep>-<line>-floor alias', () => {
    assert.deepEqual(parseFloorAlias('ui-router-server-0.3-floor'), {
      dep: 'ui-router-server',
      line: '0.3',
    });
    assert.deepEqual(parseFloorAlias('@scope/pkg-2-floor'), {
      dep: '@scope/pkg',
      line: '2',
    });
  });

  it('is undefined for a name that is no floor alias', () => {
    assert.equal(parseFloorAlias('effect-3'), undefined);
    assert.equal(parseFloorAlias('floor'), undefined);
  });
});

describe('legLine', () => {
  it('names the major, or the minor below 1.0', () => {
    assert.equal(legLine('2.1.0'), '2');
    assert.equal(legLine('0.3.0'), '0.3');
    assert.equal(legLine('0.0.4'), '0.0.4');
    assert.equal(legAlias('mobx', '6.0.0'), 'mobx-6-floor');
  });
});

describe('proveLegs', () => {
  it('passes two legs on the floor alias and the dev dependency', () => {
    assert.deepEqual(proveLegs(legs({})), {
      failures: [],
      proofs: [
        'ui-router-server-floor -> ui-router-server 0.2.0 proves ">=0.2.0 <0.3.0-0"',
        'dev ui-router-server 0.3.1 runs ">=0.3.0 <0.4.0-0"',
      ],
    });
  });

  it('passes one leg on the floor alias alone, never reading the dev copy', () => {
    const verdict = proveLegs(
      legs({
        range: '^0.2.0',
        dev: () => assert.fail('dev read for a single leg'),
      }),
    );

    assert.deepEqual(verdict.failures, []);
  });

  it('passes three legs with an alias for each lower leg', () => {
    const verdict = proveLegs(
      legs({
        range: '^0.2.0 || ^0.3.0 || ^0.4.0',
        aliases: {
          'ui-router-server-floor': '0.2.0',
          'ui-router-server-0.3-floor': '0.3.0',
        },
        dev: () => '0.4.0',
      }),
    );

    assert.deepEqual(verdict, {
      failures: [],
      proofs: [
        'ui-router-server-floor -> ui-router-server 0.2.0 proves ">=0.2.0 <0.3.0-0"',
        'ui-router-server-0.3-floor -> ui-router-server 0.3.0 proves ">=0.3.0 <0.4.0-0"',
        'dev ui-router-server 0.4.0 runs ">=0.4.0 <0.5.0-0"',
      ],
    });
  });

  it('fails three legs missing the middle alias, naming the alias to add', () => {
    const verdict = proveLegs(
      legs({ range: '^0.2.0 || ^0.3.0 || ^0.4.0', dev: () => '0.4.0' }),
    );

    assert.deepEqual(verdict.failures, [
      'publishedPeerSsr ui-router-server range "^0.2.0 || ^0.3.0 || ^0.4.0" ' +
        'has a leg ">=0.3.0 <0.4.0-0" that no alias proves. Add ' +
        'ui-router-server-0.3-floor: npm:ui-router-server@0.3.0 to the ' +
        'peerFloorSsr catalog, declare it as a devDependency, and reinstall.',
    ]);
  });

  it('fails a lowest-leg alias that does not pin its floor', () => {
    const verdict = proveLegs(
      legs({ aliases: { 'ui-router-server-floor': '0.2.2' } }),
    );

    assert.deepEqual(verdict.failures, [
      'ui-router-server-floor resolves to 0.2.2, but the floor of the peer ' +
        'range ^0.2.0 || ^0.3.0 leg ">=0.2.0 <0.3.0-0" is 0.2.0. Repin the ' +
        'alias in the peerFloorSsr catalog in pnpm-workspace.yaml and reinstall.',
    ]);
  });

  it('fails a middle-leg alias that does not pin its floor', () => {
    const verdict = proveLegs(
      legs({
        range: '^0.2.0 || ^0.3.0 || ^0.4.0',
        aliases: {
          'ui-router-server-floor': '0.2.0',
          'ui-router-server-0.3-floor': '0.3.1',
        },
        dev: () => '0.4.0',
      }),
    );

    assert.deepEqual(verdict.failures, [
      'ui-router-server-0.3-floor resolves to 0.3.1, but the floor of the ' +
        'peer range ^0.2.0 || ^0.3.0 || ^0.4.0 leg ">=0.3.0 <0.4.0-0" is ' +
        '0.3.0. Repin the alias in the peerFloorSsr catalog in ' +
        'pnpm-workspace.yaml and reinstall.',
    ]);
  });

  it('fails a top leg the dev dependency does not run', () => {
    const verdict = proveLegs(legs({ dev: () => '0.2.2' }));

    assert.deepEqual(verdict.failures, [
      'publishedPeerSsr ui-router-server range "^0.2.0 || ^0.3.0" has a top ' +
        'leg ">=0.3.0 <0.4.0-0" that the ui-router-server devDependency ' +
        '(0.2.2) does not exercise. Move the devDependency into it, or ' +
        'narrow the range.',
    ]);
  });

  it('fails a top leg the dev dependency sits below, even with its alias', () => {
    const verdict = proveLegs(
      legs({
        aliases: {
          'ui-router-server-floor': '0.2.0',
          'ui-router-server-0.3-floor': '0.3.0',
        },
        dev: () => '0.2.2',
      }),
    );

    assert.deepEqual(verdict.failures, [
      'publishedPeerSsr ui-router-server range "^0.2.0 || ^0.3.0" has a top ' +
        'leg ">=0.3.0 <0.4.0-0" that the ui-router-server devDependency ' +
        '(0.2.2) does not exercise. Move the devDependency into it, or ' +
        'narrow the range.',
    ]);
  });

  it('passes a dev dependency past the range on the top-leg alias', () => {
    const verdict = proveLegs(
      legs({
        aliases: {
          'ui-router-server-floor': '0.2.0',
          'ui-router-server-0.3-floor': '0.3.0',
        },
        dev: () => '0.4.0',
      }),
    );

    assert.deepEqual(verdict, {
      failures: [],
      proofs: [
        'ui-router-server-floor -> ui-router-server 0.2.0 proves ">=0.2.0 <0.3.0-0"',
        'ui-router-server-0.3-floor -> ui-router-server 0.3.0 proves ">=0.3.0 <0.4.0-0"',
        'dev ui-router-server 0.4.0 is past "^0.2.0 || ^0.3.0"; widen the ' +
          'publishedPeerSsr range to admit it',
      ],
    });
  });

  it('fails a dev dependency past the range without the top-leg alias, naming it', () => {
    const verdict = proveLegs(legs({ dev: () => '0.4.0' }));

    assert.deepEqual(verdict.failures, [
      'publishedPeerSsr ui-router-server range "^0.2.0 || ^0.3.0" has a top ' +
        'leg ">=0.3.0 <0.4.0-0" that the ui-router-server devDependency ' +
        '(0.4.0) has moved past. Add ui-router-server-0.3-floor: ' +
        'npm:ui-router-server@0.3.0 to the peerFloorSsr catalog, declare it ' +
        'as a devDependency, and reinstall, or widen the range.',
    ]);
  });

  it('passes a top-leg alias added while the dev dependency still runs the leg', () => {
    const verdict = proveLegs(
      legs({
        aliases: {
          'ui-router-server-floor': '0.2.0',
          'ui-router-server-0.3-floor': '0.3.0',
        },
      }),
    );

    assert.deepEqual(verdict, {
      failures: [],
      proofs: [
        'ui-router-server-floor -> ui-router-server 0.2.0 proves ">=0.2.0 <0.3.0-0"',
        'dev ui-router-server 0.3.1 runs ">=0.3.0 <0.4.0-0"',
        'ui-router-server-0.3-floor -> ui-router-server 0.3.0 proves ">=0.3.0 <0.4.0-0"',
      ],
    });
  });

  it('fails a top-leg alias that does not pin its floor', () => {
    const aliases = {
      'ui-router-server-floor': '0.2.0',
      'ui-router-server-0.3-floor': '0.3.1',
    };

    const failure =
      'ui-router-server-0.3-floor resolves to 0.3.1, but the floor of the ' +
      'peer range ^0.2.0 || ^0.3.0 leg ">=0.3.0 <0.4.0-0" is 0.3.0. Repin ' +
      'the alias in the peerFloorSsr catalog in pnpm-workspace.yaml and ' +
      'reinstall.';

    assert.deepEqual(
      proveLegs(legs({ aliases, dev: () => '0.4.0' })).failures,
      [failure],
    );
    assert.deepEqual(proveLegs(legs({ aliases })).failures, [failure]);
  });

  it('fails a leg alias that proves no leg', () => {
    const verdict = proveLegs(
      legs({
        aliases: {
          'ui-router-server-floor': '0.2.0',
          'ui-router-server-0.5-floor': '0.5.0',
        },
      }),
    );

    assert.deepEqual(verdict.failures, [
      'ui-router-server-0.5-floor proves no leg of publishedPeerSsr ' +
        'ui-router-server range "^0.2.0 || ^0.3.0". Remove it from the ' +
        'peerFloorSsr catalog and the devDependencies.',
    ]);
  });
});
