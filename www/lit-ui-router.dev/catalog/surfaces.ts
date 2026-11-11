// Data only: the VitePress config reads each policy from it; lookup and checks live in .vitepress/surfaces.ts.

export interface Surface {
  id: string;
  /** `run_worker_first` globs: `*` matches any run of characters, `/` included. The most specific match owns a path. */
  paths: readonly string[];
  /** `typedoc` is Markdown that docs:api generates and VitePress renders; `static` is files copied into dist. */
  renderer: 'vitepress' | 'typedoc' | 'worker' | 'static';
  /** A worker row in the sitemap serves its own at `<paths[0]>/sitemap.xml`, which the build's sitemap index lists. */
  sitemap: boolean;
  /** `pages`: listed in llms.txt and llms-full.txt; `index`: llms.txt lists only the index pages; `section`: a hand-written llms.txt section names it. */
  llms: 'pages' | 'index' | 'section' | false;
  search: boolean;
  /** VitePress's dead-link check: `ignore` skips links into the space, `ignore-bare` only links to its paths without `*`. */
  deadLinks: 'check' | 'ignore' | 'ignore-bare';
}

/** Every URL space the site serves, and who indexes it. */
export const SURFACES = [
  {
    id: 'docs',
    paths: ['/*'],
    renderer: 'vitepress',
    sitemap: true,
    llms: 'pages',
    search: true,
    deadLinks: 'check',
  },
  {
    id: 'site',
    paths: ['/site/'],
    renderer: 'vitepress',
    sitemap: true,
    llms: false,
    search: true,
    deadLinks: 'check',
  },
  {
    id: 'api-references',
    paths: ['/reference/*/*'],
    renderer: 'typedoc',
    sitemap: true,
    llms: 'index',
    search: true,
    deadLinks: 'check',
  },
  {
    id: 'release-stubs',
    paths: ['/package-releases/*'],
    renderer: 'vitepress',
    sitemap: false,
    llms: false,
    search: true,
    deadLinks: 'check',
  },
  {
    id: 'examples',
    paths: ['/examples/*'],
    renderer: 'static',
    sitemap: false,
    llms: false,
    search: false,
    deadLinks: 'ignore',
  },
  {
    id: 'sample-apps',
    paths: [
      '/app',
      '/app/*',
      '/app-mobx',
      '/app-mobx/*',
      '/app-effect',
      '/app-effect/*',
      '/app-signals',
      '/app-signals/*',
    ],
    renderer: 'worker',
    sitemap: false,
    llms: false,
    search: false,
    deadLinks: 'ignore-bare',
  },
  {
    id: 'sample-app-hash',
    paths: ['/app-hash', '/app-hash/*'],
    renderer: 'worker',
    sitemap: false,
    llms: false,
    search: false,
    deadLinks: 'check',
  },
  {
    id: 'exhibits',
    paths: [
      '/not-found-naive',
      '/not-found-naive/*',
      '/not-found-spa',
      '/not-found-spa/*',
      '/simulated-routing',
      '/simulated-routing/*',
    ],
    renderer: 'worker',
    sitemap: false,
    llms: false,
    search: false,
    deadLinks: 'check',
  },
  {
    id: 'releases',
    paths: ['/releases', '/releases/*'],
    renderer: 'worker',
    sitemap: true,
    llms: 'section',
    search: false,
    deadLinks: 'check',
  },
  {
    id: 'gh',
    paths: ['/gh', '/gh/*'],
    renderer: 'worker',
    sitemap: false,
    llms: false,
    search: false,
    deadLinks: 'check',
  },
] as const satisfies readonly Surface[];
