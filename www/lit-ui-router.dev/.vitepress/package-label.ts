import type { DefaultTheme } from 'vitepress';

import { PACKAGES } from '../catalog/packages.ts';

const FAMILY_PREFIX = /^(?:lit-)?ui-router-/;

/** The family prefix a package name repeats and the rest that tells it apart; a name without the prefix is all rest. */
export function splitFamilyPrefix(
  label: string,
): [prefix: string, rest: string] {
  const prefix = FAMILY_PREFIX.exec(label)?.[0] ?? '';

  return [prefix, label.slice(prefix.length)];
}

/** Whether a sidebar label is a catalog package's npm name, or one of its entry points. */
const namesPackage = (label: string): boolean =>
  PACKAGES.some(({ name }) => label === name || label.startsWith(`${name}/`));

/** The sidebar HTML of a package label; VitePress renders sidebar text with `v-html`. */
export function packageLabelHtml(label: string): string {
  const [prefix, rest] = splitFamilyPrefix(label);

  return `${prefix}<span class="package-name-rest">${rest}</span>`;
}

/** Marks up every package label in the sidebar; `docFooterText` keeps the previous and next links plain. */
export function withPackageLabels(
  items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] {
  return items.map((item) => {
    const children = item.items && withPackageLabels(item.items);

    const marked =
      item.text && namesPackage(item.text)
        ? { text: packageLabelHtml(item.text), docFooterText: item.text }
        : {};

    return { ...item, ...marked, ...(children && { items: children }) };
  });
}
