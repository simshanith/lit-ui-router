import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NAV } from '../../catalog/navigation.ts';
import {
  VERSION_MENU,
  VERSION_MENU_FLAG,
  versionMenuEnabled,
  withVersionMenu,
} from '../version-menu.ts';

describe('the version menu switch', () => {
  it('is off when unset, empty or 0', () => {
    for (const env of [
      {},
      { [VERSION_MENU_FLAG]: '' },
      { [VERSION_MENU_FLAG]: '0' },
    ]) {
      assert.equal(versionMenuEnabled(env), false);
    }
  });

  it('is on for 1', () => {
    for (const raw of ['1', ' 1 ']) {
      assert.equal(versionMenuEnabled({ [VERSION_MENU_FLAG]: raw }), true);
    }
  });

  it('throws for any other value', () => {
    for (const raw of ['true', 'yes']) {
      assert.throws(
        () => versionMenuEnabled({ [VERSION_MENU_FLAG]: raw }),
        new RegExp(`WWW_VERSION_MENU must be 1 or 0, not ${raw}`),
      );
    }
  });
});

describe('the top nav', () => {
  it('is the catalog entries alone by default', () => {
    assert.deepEqual(withVersionMenu(NAV, {}), NAV);
  });

  it('ends with the version menu when the switch is on', () => {
    assert.deepEqual(withVersionMenu(NAV, { [VERSION_MENU_FLAG]: '1' }), [
      ...NAV,
      { component: VERSION_MENU },
    ]);
  });
});
