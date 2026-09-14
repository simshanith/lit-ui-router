import { html, type TemplateResult } from 'lit';
import { UIRouterLit } from 'lit-ui-router';
import {
  prerender,
  type EmittedPage,
  type FileWriter,
  type PrerenderOptions,
  type PrerenderResult,
  type PrerenderTally,
  type RedirectLine,
  type RenderContext,
} from 'lit-ui-router-ssr';
import type { MountConfig } from 'ui-router-server';

const mounts: Record<string, MountConfig> = {
  '/': {
    routes: [
      { name: 'home', url: '/' },
      { name: 'sheet', url: '/sheet/:num' },
      { name: 'notFound' },
    ],
    otherwise: { state: 'notFound' },
  },
};

const files = new Map<string, string>();

const write: FileWriter = (file, body) => void files.set(file, body);

const page = (context: RenderContext): TemplateResult =>
  html`<main data-path=${context.path} data-subpath=${context.subpath}></main>`;

const extraRules: RedirectLine[] = [
  { from: '/megacanvas', to: '/megacanvas.html', status: 301 },
];

const options: PrerenderOptions = {
  mounts,
  router: new UIRouterLit(),
  outDir: 'dist',
  paths: ['/', '/sheet/7B'],
  renderShell: (_verdict, context) => page(context),
  document: (body, context) => `<title>${context.file}</title>${body}`,
  extraRules,
  trailingSlash: 'both',
  rules: '_redirects',
  root: new EventTarget(),
  write,
  dryRun: false,
};

export const emit = async (): Promise<{
  tally: PrerenderTally;
  first: EmittedPage | undefined;
}> => {
  const result: PrerenderResult = await prerender(options);
  return { tally: result.tally, first: result.pages[0] };
};
