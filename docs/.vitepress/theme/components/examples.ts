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
    // Reserves the open report: 781px at the embed's 686px column, plus the
    // frame's 2px of border. The report rewraps in steps as the column
    // narrows — 752px at 720, 770px at 688, 806px at 680 — so a column much
    // under the doc default scrolls instead of being reserved for.
    height: '800px',
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
