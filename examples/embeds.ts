// The examples embedded in the docs site, and the one hand-written list of
// them: build-embeds.ts builds these, EMBEDDED_EXAMPLES used to repeat them,
// and the docs theme re-exports this for <LiveExample>. embeds.test.ts holds
// the directories on disk to these keys; embeds.test-d.ts holds the
// per-example npm scripts to them.
//
// `height` reserves the embed's space before its iframe loads, so the page
// doesn't shift when the example paints — a static number by design. It is not
// eyeballed: `turbo run check:embeds --filter=@www/lit-ui-router.dev` measures
// every state each built example reaches at this column and fails when one
// outgrows what is reserved here. Slack above the measurement is fine (and
// wanted — text wraps at engine-specific metrics); slack below it is a
// scrollbar inside the embed.
export const EXAMPLES = {
  helloworld: { title: 'Hello World', height: '190px', file: 'src/main.ts' },
  hellosolarsystem: {
    title: 'Hello Solar System',
    height: '800px',
    file: 'src/main.ts',
  },
  'hellosolarsystem-mobx': {
    title: 'Hello Solar System (MobX)',
    height: '880px',
    file: 'src/main.ts',
  },
  hellogalaxy: {
    title: 'Hello Galaxy',
    height: '920px',
    file: 'src/main.ts',
  },
  'hellogalaxy-effect': {
    title: 'Hello Galaxy (Effect)',
    // Tallest at the astronaut route, whose <model-viewer> mounts a frame
    // later than hellogalaxy's — re-measure over several runs, not one.
    height: '1120px',
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

export const EXAMPLE_NAMES = Object.keys(EXAMPLES) as ExampleName[];
