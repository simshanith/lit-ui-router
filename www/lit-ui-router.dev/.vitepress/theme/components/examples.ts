// The manifest lives with the examples it describes; build-embeds.ts and
// vite.config.ts derive from the same one. Re-exported here so doc components
// keep importing their embed data from the theme.
import { EXAMPLES, type ExampleName } from 'examples/embeds';

export { EXAMPLES, type ExampleName };

/** `default`, which is also omitting it, shows both panes only when wide. */
export type StackBlitzView = 'default' | 'editor' | 'preview';

const REPO_TREE =
  'https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples';

export function staticSrc(name: ExampleName): string {
  return `/examples/${name}/`;
}

export function stackblitzEmbedSrc(
  name: ExampleName,
  file: string = EXAMPLES[name].file,
  view?: StackBlitzView,
): string {
  const url = new URL(`${REPO_TREE}/${name}`);
  url.searchParams.set('embed', '1');
  url.searchParams.set('file', file);
  if (view) url.searchParams.set('view', view);
  return url.toString();
}

export function stackblitzOpenSrc(
  name: ExampleName,
  file: string = EXAMPLES[name].file,
): string {
  const url = new URL(`${REPO_TREE}/${name}`);
  url.searchParams.set('file', file);
  return url.toString();
}
