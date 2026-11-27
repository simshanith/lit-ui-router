import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import type { ResolvedConfig } from 'vite';
import type { DefaultTheme } from 'vitepress';

import { NAV } from '../../catalog/navigation.ts';
import { VERSION_EDITS, VERSION_FILES } from '../../scripts/docs-snapshot.ts';
import {
  VERSION_MENU,
  VERSION_MENU_FLAG,
  versionMenuEnabled,
  versionMenuPlugin,
  withVersionMenu,
} from '../version-menu.ts';
import { BUNDLED_MANIFEST, type VersionManifest } from '../versions.ts';

const site = join(import.meta.dirname, '../..');

const WITH_MENU = [...NAV, { component: VERSION_MENU }];

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
  it('is the catalog entries alone on the current version by default', () => {
    for (const env of [{}, { [VERSION_MENU_FLAG]: '0' }]) {
      assert.deepEqual(withVersionMenu(NAV, env, 'none'), NAV);
    }
  });

  it('ends with the version menu on the current version when the switch is on', () => {
    assert.deepEqual(
      withVersionMenu(NAV, { [VERSION_MENU_FLAG]: '1' }, 'none'),
      WITH_MENU,
    );
  });

  it('ends with the version menu wherever the banner shows, whatever the switch says', () => {
    for (const banner of ['older', 'deprecated', 'unreleased'] as const) {
      for (const env of [
        {},
        { [VERSION_MENU_FLAG]: '0' },
        { [VERSION_MENU_FLAG]: '1' },
      ]) {
        assert.deepEqual(withVersionMenu(NAV, env, banner), WITH_MENU);
      }
    }
  });

  it('fails a build of any version on a bad switch value', () => {
    assert.throws(
      () => withVersionMenu(NAV, { [VERSION_MENU_FLAG]: 'yes' }, 'older'),
      /WWW_VERSION_MENU must be 1 or 0, not yes/,
    );
  });
});

/** The nav the plugin leaves on a build with this base. */
function navAt(
  base: string,
  env: Record<string, string> = {},
  manifest: VersionManifest = BUNDLED_MANIFEST,
): DefaultTheme.Config['nav'] {
  const themeConfig: DefaultTheme.Config = {};
  const { configResolved } = versionMenuPlugin(NAV, env, manifest);

  // SAFETY: the plugin reads only the site's base and theme config, and defines the hook as a plain function
  const resolve = configResolved as (config: ResolvedConfig) => void;

  for (const _build of ['client', 'server']) {
    // SAFETY: as above
    resolve({ vitepress: { site: { base, themeConfig } } } as ResolvedConfig);
  }

  return themeConfig.nav;
}

describe('the version menu plugin', () => {
  it('leaves the current version the catalog entries, and adds the menu for the switch', () => {
    assert.deepEqual(navAt('/'), NAV);
    assert.deepEqual(navAt('/', { [VERSION_MENU_FLAG]: '1' }), WITH_MENU);
  });

  it('adds the menu once on a build under another version, with no switch', () => {
    assert.deepEqual(navAt('/v1/'), WITH_MENU);
    assert.deepEqual(navAt('/v1/', { [VERSION_MENU_FLAG]: '0' }), WITH_MENU);
  });

  it('treats a base the manifest does not list as the current version, as the banner does', () => {
    assert.deepEqual(navAt('/v0/'), NAV);
    assert.deepEqual(
      navAt('/v1/', {}, { ...BUNDLED_MANIFEST, others: [] }),
      NAV,
    );
  });

  it('refuses a build that is not VitePress', () => {
    const { configResolved } = versionMenuPlugin(NAV, {});

    // SAFETY: as above
    const resolve = configResolved as (config: ResolvedConfig) => void;

    // SAFETY: a config without the vitepress field is the case under test
    assert.throws(() => resolve({} as ResolvedConfig), /not a VitePress build/);
  });
});

describe("the snapshot's version overlay", () => {
  it('copies files this checkout has', () => {
    for (const file of VERSION_FILES) {
      assert.ok(readFileSync(join(site, file), 'utf8').length > 0, file);
    }
  });

  it('adds to a tag only lines this checkout carries in the same file', () => {
    for (const [file, from, to] of VERSION_EDITS) {
      const lines = readFileSync(join(site, file), 'utf8').split('\n');
      const before = from.split('\n');

      for (const line of to.split('\n').filter((l) => !before.includes(l))) {
        assert.ok(lines.includes(line), `${file}: ${line}`);
      }
    }
  });

  it('registers the nav plugin, which the menu on a snapshot comes from', () => {
    assert.ok(
      VERSION_EDITS.some(
        ([file, , to]) =>
          file === '.vitepress/config.ts' &&
          to.includes('plugins: [versionMenuPlugin(NAV, process.env)]'),
      ),
    );
  });
});
