// Shared by the config, the theme and the snapshot build: no node, DOM or vitepress imports but types.
import type { Plugin } from 'vite';
import type { DefaultTheme } from 'vitepress';

import {
  bannerKind,
  BUNDLED_MANIFEST,
  versionOf,
  type BannerKind,
  type VersionManifest,
} from './versions.ts';

/** The name the theme registers the version menu under, which its nav entry asks for. */
export const VERSION_MENU = 'VersionMenu';

/** The build-time switch that puts the version menu in the current version's top nav: `1` is on, `0` or unset is off. */
export const VERSION_MENU_FLAG = 'WWW_VERSION_MENU';

type Env = Readonly<Record<string, string | undefined>>;

/** Whether the environment turns the version menu on. Throws for a value that is neither on nor off. */
export function versionMenuEnabled(env: Env): boolean {
  const raw = env[VERSION_MENU_FLAG]?.trim() ?? '';

  if (raw === '1') return true;

  if (raw === '' || raw === '0') return false;

  throw new Error(`${VERSION_MENU_FLAG} must be 1 or 0, not ${raw}`);
}

/** The top nav VitePress gets: the entries, then the version menu on a build that shows the version banner, or when the switch is on. */
export function withVersionMenu<Entry>(
  nav: readonly Entry[],
  env: Env,
  banner: BannerKind,
): (Entry | { component: string })[] {
  // Read first, so a bad value fails a snapshot's build too.
  const enabled = versionMenuEnabled(env);

  return enabled || banner !== 'none'
    ? [...nav, { component: VERSION_MENU }]
    : [...nav];
}

/** Sets the top nav from the build's resolved base: `--base` lands after config.ts is read. */
export function versionMenuPlugin(
  nav: readonly DefaultTheme.NavItem[],
  env: Env,
  manifest: VersionManifest = BUNDLED_MANIFEST,
): Plugin {
  return {
    name: 'version-menu',
    configResolved({ vitepress }) {
      if (!vitepress) throw new Error('version-menu: not a VitePress build');
      const { site } = vitepress;

      // SAFETY: the site extends the default theme, and VitePress types a resolved theme config as any
      const theme = site.themeConfig as DefaultTheme.Config;

      // Assigned from `nav`, never appended to: the client and server builds each resolve a config.
      theme.nav = withVersionMenu(
        nav,
        env,
        bannerKind(manifest, versionOf(manifest, site.base)),
      );
    },
  };
}
