/** StackBlitz's `view` param: which pane an embed opens on. */
export type StackBlitzView = 'editor' | 'preview' | 'both';

type ExampleConfig = {
  title: string;
  height: string;
  file: string;
  /** Opts this example out of DEFAULT_EMBED_VIEW. */
  view?: StackBlitzView;
};

/**
 * Every embed on this site opens on the code. The Preview tab beside it is the
 * same example served from this origin, interactive before a WebContainer can
 * finish booting — so the reason to open StackBlitz at all is the source.
 */
export const DEFAULT_EMBED_VIEW: StackBlitzView = 'editor';

// Keep in sync with examples/build-embeds.ts and EMBEDDED_EXAMPLES in docs/.vitepress/vite.config.ts.
export const EXAMPLES = {
  helloworld: { title: 'Hello World', height: '180px', file: 'src/main.ts' },
  hellosolarsystem: {
    title: 'Hello Solar System',
    height: '800px',
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
} as const satisfies Record<string, ExampleConfig>;

export type ExampleName = keyof typeof EXAMPLES;

/** Widened past the `as const` literals, so optional fields are readable. */
export function exampleConfig(name: ExampleName): ExampleConfig {
  return EXAMPLES[name];
}

const REPO_TREE =
  'https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples';

export function staticSrc(name: ExampleName): string {
  return `/examples/${name}/`;
}

export function stackblitzEmbedSrc(
  name: ExampleName,
  file: string = EXAMPLES[name].file,
  view: StackBlitzView = exampleConfig(name).view ?? DEFAULT_EMBED_VIEW,
): string {
  return `${REPO_TREE}/${name}?embed=1&file=${file}&view=${view}`;
}

export function stackblitzOpenSrc(
  name: ExampleName,
  file: string = EXAMPLES[name].file,
): string {
  return `${REPO_TREE}/${name}?file=${file}`;
}
