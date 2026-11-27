import type { DefaultTheme } from 'vitepress';

/**
 * The companion references are small, and their kind categories (Classes,
 * Interfaces, …) are generic — unlike the flagship's semantic categories
 * (Core, Components, …). Flatten them into a single member list under the
 * package-name node; the grouped listing still lives on the reference's
 * index page and the kind-index pages stay reachable by URL.
 */
export function flattenGroups(
  items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] {
  return items.flatMap((item) => (item.items ? item.items : [item]));
}

// A module named with a slash (`@module router/matcher`) arrives as a linkless folder node; lift its modules out under their full name.
const liftFolders = (
  modules: DefaultTheme.SidebarItem[],
  prefix = '',
): DefaultTheme.SidebarItem[] =>
  modules.flatMap((module) =>
    module.link === undefined && module.items
      ? liftFolders(module.items, `${prefix}${module.text}/`)
      : [{ ...module, text: `${prefix}${module.text}` }],
  );

/**
 * Multi-entry packages emit one typedoc module per subpath export, so the
 * module level is the import surface — keep it, retitle each module to its
 * import specifier, and flatten only the kind groups within.
 */
export function entrySidebar(
  pkg: string,
  modules: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] {
  return (
    liftFolders(modules)
      .map((module) => ({
        ...module,
        text: module.text === 'index' ? pkg : `${pkg}/${module.text}`,
        collapsed: true,
        items: module.items && flattenGroups(module.items),
      }))
      // root module first; stable sort keeps the subpaths in typedoc order
      .sort((a, b) => Number(b.text === pkg) - Number(a.text === pkg))
  );
}
