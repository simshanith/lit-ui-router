/** `default`, which is also omitting it, shows both panes only when wide. */
export type StackBlitzView = 'default' | 'editor' | 'preview';

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
