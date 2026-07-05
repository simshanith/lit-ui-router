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
  });
}

/**
 * Resolve the site-absolute link of the output directory from the
 * typedoc-vitepress-theme `docsRoot` option (e.g. `/api/lit-ui-router-mobx/`).
 */
function resolveBaseLink(outDir: string, app: Application): string {
  const docsRoot = String(app.options.getValue('docsRoot') ?? '');
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

  const sidebar = JSON.parse(fs.readFileSync(sidebarPath, 'utf-8'));
  for (const item of sidebar) {
    const folder = folderByTitle[item.text];
    if (folder && fs.existsSync(path.join(outDir, folder, 'index.md'))) {
      item.link = `${baseLink}${folder}/`;
    }
  }

  fs.writeFileSync(sidebarPath, JSON.stringify(sidebar, null, 2));
  app.logger.verbose('[lit-ui-router] Linked sidebar kind groups');
}
