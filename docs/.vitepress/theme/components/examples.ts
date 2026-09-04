// Keep in sync with examples/build-embeds.ts and EMBEDDED_EXAMPLES in docs/.vitepress/vite.config.ts.
//
// `height` reserves the embed's space before its iframe loads, so the page
// doesn't shift when the example paints — a static number by design. It is not
// eyeballed: `turbo run check:embeds --filter=docs` measures every state each
// built example reaches at this column and fails when one outgrows what is
// reserved here. Slack above the measurement is fine (and wanted — text wraps
// at engine-specific metrics); slack below it is a scrollbar inside the embed.
export const EXAMPLES = {
  helloworld: { title: 'Hello World', height: '190px', file: 'src/main.ts' },
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
