import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { floorAliases, listedFiles, peerFiles } from './floor-files.ts';

const showConfig = (paths?: Record<string, string[]>) =>
  JSON.stringify({ compilerOptions: { strict: true, paths } });

describe('floorAliases', () => {
  it('names each floor alias a paths target goes through, once', () => {
    assert.deepEqual(
      floorAliases(
        showConfig({
          'lit-ui-router': [
            './node_modules/lit-ui-router-floor/dist/index.d.ts',
          ],
          'lit-ui-router/*': ['./node_modules/lit-ui-router-floor/*'],
          'ui-router-server': [
            './node_modules/ui-router-server-floor/dist/index.d.ts',
          ],
          '@uirouter/core': [
            'node_modules/@uirouter/core-floor/lib/index.d.ts',
          ],
        }),
      ),
      ['@uirouter/core-floor', 'lit-ui-router-floor', 'ui-router-server-floor'],
    );
  });

  it('names a per-leg <peer>-<line>-floor alias', () => {
    assert.deepEqual(
      floorAliases(
        showConfig({
          'ui-router-server': [
            './node_modules/ui-router-server-0.3-floor/dist/index.d.ts',
          ],
        }),
      ),
      ['ui-router-server-0.3-floor'],
    );
  });

  it('ignores targets outside a floor alias', () => {
    assert.deepEqual(
      floorAliases(
        showConfig({
          '~/*': ['./src/*'],
          lit: ['./node_modules/lit-2/index.d.ts'],
          floorish: ['./node_modules/floor/index.d.ts'],
        }),
      ),
      [],
    );
  });

  it('is empty with no paths, so the guard can fail on testing nothing', () => {
    assert.deepEqual(floorAliases(showConfig()), []);
    assert.deepEqual(floorAliases('{}'), []);
  });

  it('rejects a config whose paths are not string arrays', () => {
    assert.throws(() =>
      floorAliases(JSON.stringify({ compilerOptions: { paths: { a: 'b' } } })),
    );
  });
});

describe('listedFiles', () => {
  it('drops blank lines and surrounding whitespace', () => {
    assert.deepEqual(listedFiles('/a.d.ts\r\n\n  /b.ts  \n'), [
      '/a.d.ts',
      '/b.ts',
    ]);
  });
});

describe('peerFiles', () => {
  const dirs = {
    peer: 'lit-ui-router',
    floorDir:
      '/repo/node_modules/.pnpm/lit-ui-router@1.0.0/node_modules/lit-ui-router',
    devDir: '/repo/packages/lit-ui-router',
  };

  it('splits floor files from dev-copy files', () => {
    assert.deepEqual(
      peerFiles(
        [
          `${dirs.floorDir}/dist/index.d.ts`,
          '/repo/packages/lit-ui-router/dist/ui-router.register.d.ts',
          '/repo/packages/lit-ui-router-ssr/src/index.ts',
        ],
        dirs,
      ),
      {
        floor: [`${dirs.floorDir}/dist/index.d.ts`],
        leaked: ['/repo/packages/lit-ui-router/dist/ui-router.register.d.ts'],
      },
    );
  });

  it('does not count a sibling package sharing the name as a prefix', () => {
    assert.deepEqual(
      peerFiles(['/repo/packages/lit-ui-router-mobx/src/index.ts'], dirs),
      { floor: [], leaked: [] },
    );
  });

  it('counts a floor that shares the dev install as the floor, not a leak', () => {
    const shared = { ...dirs, devDir: dirs.floorDir };

    assert.deepEqual(peerFiles([`${dirs.floorDir}/dist/index.d.ts`], shared), {
      floor: [`${dirs.floorDir}/dist/index.d.ts`],
      leaked: [],
    });
  });
});
