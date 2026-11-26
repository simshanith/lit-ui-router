// Shared by the config, the theme and the snapshot build: no node, DOM or vitepress imports.

/** The name the theme registers the version menu under, which its nav entry asks for. */
export const VERSION_MENU = 'VersionMenu';

/** The build-time switch that puts the version menu in the top nav: `1` is on, `0` or unset is off. */
export const VERSION_MENU_FLAG = 'WWW_VERSION_MENU';

/** Whether the environment turns the version menu on. Throws for a value that is neither on nor off. */
export function versionMenuEnabled(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  const raw = env[VERSION_MENU_FLAG]?.trim() ?? '';

  if (raw === '1') return true;

  if (raw === '' || raw === '0') return false;

  throw new Error(`${VERSION_MENU_FLAG} must be 1 or 0, not ${raw}`);
}

/** The top nav VitePress gets: the entries, then the version menu when the switch is on. */
export const withVersionMenu = <Entry>(
  nav: readonly Entry[],
  env: Readonly<Record<string, string | undefined>>,
): (Entry | { component: string })[] =>
  versionMenuEnabled(env) ? [...nav, { component: VERSION_MENU }] : [...nav];
