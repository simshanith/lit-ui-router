// The examples embedded in the docs site, and the one hand-written list of
// them: build-embeds.ts builds these, EMBEDDED_EXAMPLES used to repeat them,
// and the docs theme re-exports this for <LiveExample>. embeds.test.ts holds
// the directories on disk to these keys; embeds.test-d.ts holds the
// per-example npm scripts to them. `summary` is the example's Markdown line
// on the docs site's /examples/ index; a `[label]` in it is a reference to the
// entry's link of that label, and the index lists the same links under "Links".
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

/** Something a summary names: an outside URL or a docs-site path (`href`), or a published package, which the docs site links to its package page. */
export type ExampleLink =
  | { label: string; href: string }
  | { label: string; package: string };

export interface ExampleEntry {
  title: string;
  summary: string;
  /** What the summary names, in the order it names them; each label is referenced there once, as `[label]`. */
  links?: readonly ExampleLink[];
  height: string;
  file: string;
}

const IMPORT_MAP = {
  label: 'import map',
  href: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap',
} as const;

const TC39_SIGNALS = {
  label: 'TC39 Signals',
  href: 'https://github.com/tc39/proposal-signals',
} as const;

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
      'The same starter in plain JavaScript, with no TypeScript and no build step: an [import map] loads its packages from [esm.sh], a CDN that builds npm packages into browser ES modules. [`@uirouter/core`] arrives as one module; its published ES files import each other without the file extensions a browser needs',
    links: [
      IMPORT_MAP,
      { label: 'esm.sh', href: 'https://esm.sh' },
      {
        label: '`@uirouter/core`',
        href: 'https://npmx.dev/package/@uirouter/core',
      },
    ],
    height: '190px',
    file: 'public/main.js',
  },
  'helloworld-nudeps': {
    title: 'Hello World (nudeps)',
    summary:
      'The same starter with [`nudeps`]: npm packages self-hosted through a generated [import map], no CDN and no build step',
    links: [{ label: '`nudeps`', href: 'https://nudeps.dev' }, IMPORT_MAP],
    height: '190px',
    file: 'public/main.js',
  },
  'features-tour': {
    title: 'Features Tour',
    summary:
      "The tour in the home page's [See it run] section: one state with a `cardId` param, re-entered as its pager steps through the feature cards. Runs on its own, or inside a host page on a fragment shared with the page's anchors",
    links: [{ label: 'See it run', href: '/#see-it-run' }],
    // Reserves the tallest card at a phone's column (546px at 320-375), so the live page never scrolls inside; wider columns get slack below.
    height: '560px',
    file: 'src/tour.ts',
  },
  hellosolarsystem: {
    title: 'Hello Solar System',
    summary:
      'Solar System tour: route parameters and async `resolve` data with a list/detail flow',
    height: '800px',
    file: 'src/main.ts',
  },
  'hellosolarsystem-mobx': {
    title: 'Hello Solar System (MobX)',
    summary:
      'The same tour rebuilt on [`lit-ui-router-mobx`]: a [MobX] observable router store, reactions, and a computed tour',
    links: [
      { label: '`lit-ui-router-mobx`', package: 'lit-ui-router-mobx' },
      { label: 'MobX', href: 'https://mobx.js.org' },
    ],
    height: '880px',
    file: 'src/main.ts',
  },
  'hellosolarsystem-signals': {
    title: 'Hello Solar System (Signals)',
    summary:
      'The same tour on [TC39 Signals] with [`lit-ui-router-signals`] and [`@lit/context`]: a provided unit signal, the consumed router, and a tab title that follows the route through [`ui-router-signals`]',
    links: [
      TC39_SIGNALS,
      { label: '`lit-ui-router-signals`', package: 'lit-ui-router-signals' },
      { label: '`@lit/context`', href: 'https://lit.dev/docs/data/context/' },
      { label: '`ui-router-signals`', package: 'ui-router-signals' },
    ],
    height: '810px',
    file: 'src/main.ts',
  },
  'hellosolarsystem-eleventy': {
    title: 'Hello Solar System (Eleventy SSR)',
    summary:
      'The same tour prerendered by [Eleventy] and [`lit-ui-router-ssr`]: static pages, a 404 page and redirect rules, adopted on boot',
    links: [
      { label: 'Eleventy', href: 'https://www.11ty.dev' },
      { label: '`lit-ui-router-ssr`', package: 'lit-ui-router-ssr' },
    ],
    height: '800px',
    file: 'src/prerender.ts',
  },
  'hellosolarsystem-ssr': {
    title: 'Hello Solar System (Vite SSR)',
    summary:
      'The same tour prerendered by [`vite build`] alone: `serverRouterPlugin` from [`lit-ui-router-ssr`] and one prerender script',
    links: [
      { label: '`vite build`', href: 'https://vite.dev/guide/build' },
      { label: '`lit-ui-router-ssr`', package: 'lit-ui-router-ssr' },
    ],
    height: '800px',
    file: 'src/prerender.ts',
  },
  hellogalaxy: {
    title: 'Hello Galaxy',
    summary:
      'Milky Way explorer: nested states and views, resolve inheritance, and a 3D [`<model-viewer>`] surprise',
    links: [{ label: '`<model-viewer>`', href: 'https://modelviewer.dev/' }],
    height: '920px',
    file: 'src/main.ts',
  },
  'hellogalaxy-effect': {
    title: 'Hello Galaxy (Effect)',
    summary:
      'The same explorer rebuilt on [Effect]: typed resolve inheritance, state-scoped fibers, and interruptible loads',
    links: [{ label: 'Effect', href: 'https://effect.website' }],
    // Tallest at the astronaut route, whose <model-viewer> mounts a frame
    // later than hellogalaxy's — re-measure over several runs, not one.
    height: '1120px',
    file: 'src/main.ts',
  },
  'hellogalaxy-signals': {
    title: 'Hello Galaxy (Signals)',
    summary:
      'The same explorer on [TC39 Signals] with both Lit bindings, [`@lit-labs/signals`] and [`lit-ui-router-signals`]: a star chart shared by nested views, route-driven crumbs',
    links: [
      TC39_SIGNALS,
      {
        label: '`@lit-labs/signals`',
        href: 'https://lit.dev/docs/data/signals/',
      },
      { label: '`lit-ui-router-signals`', package: 'lit-ui-router-signals' },
    ],
    height: '930px',
    file: 'src/main.ts',
  },
  'design-system-links': {
    title: 'Design System Links',
    summary:
      "`uiSref` driving a design-system link element ([`<sp-link>`]): `assignHref: true` vs `'auto'`",
    links: [
      {
        label: '`<sp-link>`',
        href: 'https://opensource.adobe.com/spectrum-web-components/components/link/',
      },
    ],
    height: '540px',
    file: 'src/main.ts',
  },
  'lint-eslint': {
    title: 'ESLint Plugin',
    summary:
      '[`eslint-plugin-lit-ui-router`] the [ESLint]-only way, with the lint report rendered in the page',
    links: [
      {
        label: '`eslint-plugin-lit-ui-router`',
        package: 'eslint-plugin-lit-ui-router',
      },
      { label: 'ESLint', href: 'https://eslint.org' },
    ],
    // Capped: the open report outgrows the cap and scrolls inside the embed.
    height: '1200px',
    file: 'src/main.ts',
  },
  'navigation-api': {
    title: 'Navigation API',
    summary:
      '[`ui-router-navigation-location-plugin`] with an app [`navigate`] listener that holds a link leaving the app',
    links: [
      {
        label: '`ui-router-navigation-location-plugin`',
        package: 'ui-router-navigation-location-plugin',
      },
      {
        label: '`navigate`',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate_event',
      },
    ],
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
} as const satisfies Record<string, ExampleEntry>;

export type ExampleName = keyof typeof EXAMPLES;

// SAFETY: EXAMPLES is a const literal, so its own keys are exactly ExampleName
export const EXAMPLE_NAMES = Object.keys(EXAMPLES) as ExampleName[];

/** Docs pages under the site's /examples/, beside the built examples at /examples/<name>/: no example may take one's slug. */
export const RESERVED_NAMES = ['live'] as const;

export type ReservedName = (typeof RESERVED_NAMES)[number];
