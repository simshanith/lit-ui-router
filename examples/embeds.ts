// The examples embedded in the docs site, and the one hand-written list of
// them: build-embeds.ts builds these, EMBEDDED_EXAMPLES used to repeat them,
// and the docs theme re-exports this for <LiveExample>. embeds.test.ts holds
// the directories on disk to these keys; embeds.test-d.ts holds the
// per-example npm scripts to them. `summary` is the example's line on the
// docs site's /examples/ index.
//
// `height` reserves the embed's space before its iframe loads, so the page
// doesn't shift when the example paints — a static number by design. It is not
// eyeballed: `turbo run check:embeds --filter=@www/lit-ui-router.dev` measures
// every state each built example reaches at this column and fails when one
// outgrows what is reserved here. Slack above the measurement is fine (and
// wanted — text wraps at engine-specific metrics); slack below it is a
// scrollbar inside the embed. Reservations cap at 1200px (`MAX_HEIGHT_PX` in
// tools/embed-heights): an example taller than that reserves the cap and
// scrolls inside the embed.
export const EXAMPLES = {
  helloworld: {
    title: 'Hello World',
    summary:
      'Ultra-minimal starter: two states with `uiSref`/`uiSrefActive` navigation',
    height: '190px',
    file: 'src/main.ts',
  },
  'helloworld-buildless': {
    title: 'Hello World (No Build)',
    summary:
      'The same starter in plain JavaScript: an import map to a CDN, no TypeScript and no build step',
    height: '190px',
    file: 'public/main.js',
  },
  hellosolarsystem: {
    title: 'Hello Solar System',
    summary:
      'Solar System tour: route parameters and async `resolve` data with a master/detail flow',
    height: '800px',
    file: 'src/main.ts',
  },
  'hellosolarsystem-mobx': {
    title: 'Hello Solar System (MobX)',
    summary:
      'The same tour rebuilt on `lit-ui-router-mobx`: an observable router store, reactions, and a computed tour',
    height: '880px',
    file: 'src/main.ts',
  },
  'hellosolarsystem-signals': {
    title: 'Hello Solar System (Signals)',
    summary:
      'The same tour with `lit-ui-router-signals` and `@lit/context`: a provided unit signal, the consumed router',
    height: '810px',
    file: 'src/main.ts',
  },
  'hellosolarsystem-eleventy': {
    title: 'Hello Solar System (Eleventy SSR)',
    summary:
      'The same tour prerendered by Eleventy and `lit-ui-router-ssr`: static pages, a 404 page and redirect rules, adopted on boot',
    height: '800px',
    file: 'src/prerender.ts',
  },
  'hellosolarsystem-ssr': {
    title: 'Hello Solar System (Vite SSR)',
    height: '800px',
    file: 'src/prerender.ts',
  },
  hellogalaxy: {
    title: 'Hello Galaxy',
    summary:
      'Milky Way explorer: nested states and views, resolve inheritance, and a 3D model-viewer surprise',
    height: '920px',
    file: 'src/main.ts',
  },
  'hellogalaxy-effect': {
    title: 'Hello Galaxy (Effect)',
    summary:
      'The same explorer rebuilt on Effect: typed resolve inheritance, state-scoped fibers, and interruptible loads',
    // Tallest at the astronaut route, whose <model-viewer> mounts a frame
    // later than hellogalaxy's — re-measure over several runs, not one.
    height: '1120px',
    file: 'src/main.ts',
  },
  'hellogalaxy-signals': {
    title: 'Hello Galaxy (Signals)',
    summary:
      'The same explorer with both Lit signal bindings: a star chart shared by nested views, route-driven crumbs',
    height: '930px',
    file: 'src/main.ts',
  },
  'design-system-links': {
    title: 'Design System Links',
    summary:
      "`uiSref` driving a design-system link element (`<sp-link>`): `assignHref: true` vs `'auto'`",
    height: '540px',
    file: 'src/main.ts',
  },
  'lint-eslint': {
    title: 'ESLint Plugin',
    summary:
      '`eslint-plugin-lit-ui-router` the ESLint-only way, with the lint report rendered in the page',
    // Capped: the open report outgrows the cap and scrolls inside the embed.
    height: '1200px',
    file: 'src/main.ts',
  },
  'navigation-api': {
    title: 'Navigation API',
    summary:
      '`ui-router-navigation-location-plugin` with an app `navigate` listener that holds a link leaving the app',
    // check:embeds walks hash links only, so it measures the initial state; every other state keeps that height.
    height: '650px',
    file: 'src/main.ts',
  },
  'loading-and-error-views': {
    title: 'Loading and Error Views',
    summary:
      'Per-route pending and error views from transition hooks and inherited `data`, a NOWAIT resolve, and retry',
    // check:embeds never ticks Fail requests, so this also covers the error views, which stand a few px taller.
    height: '410px',
    file: 'src/main.ts',
  },
} as const;

export type ExampleName = keyof typeof EXAMPLES;

// SAFETY: EXAMPLES is a const literal, so its own keys are exactly ExampleName
export const EXAMPLE_NAMES = Object.keys(EXAMPLES) as ExampleName[];
