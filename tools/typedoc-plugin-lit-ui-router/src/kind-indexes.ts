/**
 * TypeDoc plugin generating index pages for kind folders.
 *
 * typedoc-plugin-markdown's default (kind) router writes member pages into
 * folders such as `classes/` and `interfaces/` but no index page for the
 * folder itself, so the bare folder URL 404s. This plugin writes an
 * `index.md` into each kind folder listing its members — the
 * package-agnostic counterpart of the category index pages the main plugin
 * generates for the core package — and links the folders from the sidebar
 * group headings.
 *
 * @packageDocumentation
 */

import { Application, RendererEvent } from 'typedoc';
import * as fs from 'fs';
import * as path from 'path';

/** Shape of the entries in typedoc-plugin-markdown's typedoc-sidebar.json. */
interface SidebarItem {
  text: string;
  link?: string;
}

/** Kind folders emitted by typedoc-plugin-markdown and their page titles. */
const KIND_FOLDER_TITLES: Record<string, string> = {
  classes: 'Classes',
  enumerations: 'Enumerations',
  functions: 'Functions',
  interfaces: 'Interfaces',
  'type-aliases': 'Type Aliases',
  variables: 'Variables',
};

/**
 * Load the kind-indexes TypeDoc plugin.
 */
export function load(app: Application): void {
  app.renderer.on(RendererEvent.END, (event: RendererEvent) => {
    const outDir = event.outputDirectory;
    const baseLink = resolveBaseLink(outDir, app);
    generateKindIndexFiles(outDir, baseLink, app);
    linkSidebarGroups(outDir, baseLink, app);
    retitleRootModule(outDir, app);
  });
}

/**
 * Resolve the site-absolute link of the output directory from the
 * typedoc-vitepress-theme `docsRoot` option (e.g. `/api/lit-ui-router-mobx/`).
 */
function resolveBaseLink(outDir: string, app: Application): string {
  const docsRootValue = app.options.getValue('docsRoot');
  const docsRoot = typeof docsRootValue === 'string' ? docsRootValue : '';
  if (!docsRoot) return './';
  const relative = path.relative(path.resolve(docsRoot), outDir);
  return `/${relative.split(path.sep).join('/')}/`;
}

/**
 * Generate index.md files for each kind folder.
 */
function generateKindIndexFiles(
  outDir: string,
  baseLink: string,
  app: Application,
): void {
  const packageName = path.basename(outDir);

  for (const [folder, title] of Object.entries(KIND_FOLDER_TITLES)) {
    const kindDir = path.join(outDir, folder);
    if (!fs.existsSync(kindDir)) continue;

    const files = fs
      .readdirSync(kindDir)
      .filter((f: string) => f.endsWith('.md') && f !== 'index.md')
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (files.length === 0) continue;

    const items = files
      .map((f: string) => {
        const name = path.basename(f, '.md');
        return `- [\`${name}\`](./${name})`;
      })
      .join('\n');

    const next = path.basename(files[0], '.md');
    const indexContent = `---
next:
  text: ${next}
  link: ./${next}
prev:
  text: ${packageName}
  link: ${baseLink}
---
# ${title}

${items}
`;

    fs.writeFileSync(path.join(kindDir, 'index.md'), indexContent);
    app.logger.verbose(`[lit-ui-router] Generated ${folder}/index.md`);
  }
}

/**
 * Retitle a multi-entry package's root module from typedoc's filename
 * default ("index") to the package name and lift it to the top of the
 * root Modules list. Text-only: URLs keep the `index/` folder, and the
 * typedoc-sidebar.json entry stays "index" for the site config to map.
 */
function retitleRootModule(outDir: string, app: Application): void {
  const packageName = path.basename(outDir);
  const moduleDir = path.join(outDir, 'index');
  const modulePage = path.join(moduleDir, 'index.md');
  const rootPage = path.join(outDir, 'index.md');
  // Single-entry packages have no `index/` module folder.
  if (!fs.existsSync(modulePage) || !fs.existsSync(rootPage)) return;

  const entry = `- [index](index/index.md)\n`;
  const root = fs.readFileSync(rootPage, 'utf-8');
  if (root.includes(entry)) {
    fs.writeFileSync(
      rootPage,
      root
        .replace(entry, '')
        .replace(
          '## Modules\n\n',
          `## Modules\n\n- [${packageName}](index/index.md)\n`,
        ),
    );
  }

  const page = fs.readFileSync(modulePage, 'utf-8');
  fs.writeFileSync(
    modulePage,
    page
      .replace(/^(\[.+\]\(\.\.\/index\.md\)) \/ index$/m, `$1 / ${packageName}`)
      .replace(/^# index$/m, `# ${packageName}`),
  );

  for (const kindFolder of fs.readdirSync(moduleDir)) {
    const kindDir = path.join(moduleDir, kindFolder);
    if (!fs.statSync(kindDir).isDirectory()) continue;
    for (const file of fs.readdirSync(kindDir)) {
      if (!file.endsWith('.md')) continue;
      const memberPage = path.join(kindDir, file);
      const content = fs.readFileSync(memberPage, 'utf-8');
      fs.writeFileSync(
        memberPage,
        content.replace(
          /^(\[.+\]\(\.\.\/\.\.\/index\.md\)) \/ \[index\]\(\.\.\/index\.md\)/m,
          `$1 / [${packageName}](../index.md)`,
        ),
      );
    }
  }
  app.logger.verbose(`[lit-ui-router] Retitled root module to ${packageName}`);
}

/**
 * Point typedoc-sidebar.json group headings at the generated index pages.
 */
function linkSidebarGroups(
  outDir: string,
  baseLink: string,
  app: Application,
): void {
  const sidebarPath = path.join(outDir, 'typedoc-sidebar.json');
  if (!fs.existsSync(sidebarPath)) return;

  const folderByTitle = Object.fromEntries(
    Object.entries(KIND_FOLDER_TITLES).map(([folder, title]) => [
      title,
      folder,
    ]),
  );

  const sidebar = JSON.parse(
    fs.readFileSync(sidebarPath, 'utf-8'),
  ) as SidebarItem[];
  for (const item of sidebar) {
    const folder = folderByTitle[item.text];
    if (folder && fs.existsSync(path.join(outDir, folder, 'index.md'))) {
      item.link = `${baseLink}${folder}/`;
    }
  }

  fs.writeFileSync(sidebarPath, JSON.stringify(sidebar, null, 2));
  app.logger.verbose('[lit-ui-router] Linked sidebar kind groups');
}
