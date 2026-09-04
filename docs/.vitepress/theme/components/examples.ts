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
  'lint-eslint': {
    title: 'ESLint Plugin',
    // reserves the open report at the 688px doc column, where it needs 770px
    height: '780px',
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
): string {
  return `${REPO_TREE}/${name}?embed=1&file=${file}&view=preview`;
}

export function stackblitzOpenSrc(
  name: ExampleName,
  file: string = EXAMPLES[name].file,
): string {
  return `${REPO_TREE}/${name}?file=${file}`;
}
