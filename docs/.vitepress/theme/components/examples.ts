/** `default`, which is also omitting it, shows both panes only when wide. */
export type StackBlitzView = 'default' | 'editor' | 'preview';

// Keep in sync with examples/build-embeds.ts and EMBEDDED_EXAMPLES in docs/.vitepress/vite.config.ts.
export const EXAMPLES = {
  helloworld: { title: 'Hello World', height: '180px', file: 'src/main.ts' },
  hellosolarsystem: {
    title: 'Hello Solar System',
    height: '800px',
    file: 'src/main.ts',
  },
  'hellosolarsystem-mobx': {
    title: 'Hello Solar System (MobX)',
    height: '840px',
    file: 'src/main.ts',
  },
  hellogalaxy: {
    title: 'Hello Galaxy',
    height: '920px',
    file: 'src/main.ts',
  },
  'design-system-links': {
    title: 'Design System Links',
    height: '520px',
    file: 'src/main.ts',
  },
} as const;

export type ExampleName = keyof typeof EXAMPLES;

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
