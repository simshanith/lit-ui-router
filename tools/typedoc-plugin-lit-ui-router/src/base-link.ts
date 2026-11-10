import type { Application } from 'typedoc';
import * as path from 'path';

/** `docsRoot` is another plugin's option, so typedoc hands it over untyped. */
const isDocsRoot = (value: unknown): value is string =>
  typeof value === 'string';

/**
 * Resolve the site-absolute link of the output directory from the
 * typedoc-vitepress-theme `docsRoot` option (e.g. `/reference/lit-ui-router-mobx/`).
 */
export function resolveBaseLink(outDir: string, app: Application): string {
  const docsRootValue = app.options.getValue('docsRoot');
  const docsRoot = isDocsRoot(docsRootValue) ? docsRootValue : '';

  if (!docsRoot) return './';
  const relative = path.relative(path.resolve(docsRoot), outDir);

  return `/${relative.split(path.sep).join('/')}/`;
}
