import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { allSheets } from './src/manifest.ts';
import type { Manifest } from './src/manifest.ts';
import { BASE, mountsFor } from './src/routes.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(HERE, 'dist');
// The visualizer's css asks for `../../images/…` against the document, so the
// icons are served at /images/ beside the page, as the sample apps serve them.
const VISUALIZER_IMAGES = join(
  dirname(createRequire(import.meta.url).resolve('@uirouter/visualizer/package.json')),
  'images',
).replaceAll('\\', '/');
// static-copy keeps the source's own segments under dest; the rename drops them
const VISUALIZER_STRIP = relative(HERE, VISUALIZER_IMAGES).split('/').length;

// The generated index is on disk at config time, so the dev server can narrow
// /sheet/:num to the numbers that were actually drawn — and answer 404 for
// the ones that were not, exactly as the deployed site will. The appendix is
// out of the ascent but not out of the url space.
const manifest = JSON.parse(
  readFileSync(join(HERE, 'public', 'manifest.json'), 'utf8'),
) as Manifest;

const serverRouter = createServerRouter({
  mounts: mountsFor(allSheets(manifest).map((sheet) => sheet.num)),
});

/**
 * ARTIFACT MODE — the condensed atlas as ONE html file: the gallery and the colophon.
 *
 * A claude.ai Artifact is a single page on an opaque origin with every
 * network request blocked, so nothing may be fetched at runtime: the manifest
 * and the card pictures are baked in as a JSON island by artifact.ts,
 * sheets/atlas.css is inlined beside them, and the router runs on the hash.
 * Every plate, scene and the issue log is a link out to the live site, so the
 * libraries only those pages load resolve to an empty module here.
 */
const ARTIFACT_STUBS = new Set(['@google/model-viewer', 'cytoscape', '@uirouter/visualizer']);
const STUB = '\0atlas:artifact-stub';
const artifactStubPlugin: Plugin = {
  name: 'atlas:artifact-stub',
  enforce: 'pre',
  resolveId: (id: string): string | undefined => (ARTIFACT_STUBS.has(id) ? STUB : undefined),
  load: (id: string): string | undefined => (id === STUB ? 'export default undefined;' : undefined),
};

const artifactHtmlPlugin: Plugin = {
  name: 'atlas:artifact-html',
  // Pre, so vite never resolves the two references artifact mode drops: there
  // is no <base> on an opaque origin, and atlas.css is inlined post-build.
  transformIndexHtml: {
    order: 'pre',
    handler: (html: string): string =>
      html
        .replace(/[ \t]*<base href="%BASE_URL%" \/>\n/, '')
        .replace(/[ \t]*<link rel="stylesheet" href="%BASE_URL%sheets\/atlas\.css" \/>\n/, '')
        .replace(/[ \t]*<link rel="preload" as="fetch" href="%BASE_URL%manifest\.json" crossorigin \/>\n/, '')
        // the host sets the artifact's own icon; the icon files are public/, which artifact mode does not ship
        .replace(/[ \t]*<!-- the client's mark is the tab's icon[^\n]*\n(?:[ \t]*<link rel="(?:icon|apple-touch-icon)"[^\n]*\n)+/, ''),
  },
};

export default defineConfig(({ isPreview, mode }) => {
  if (mode === 'artifact') {
    return {
      base: './',
      // Nothing from public/ ships as a file; artifact.ts inlines what it needs.
      publicDir: false as const,
      build: { target: 'esnext', outDir: 'dist-artifact', emptyOutDir: true },
      plugins: [
        artifactHtmlPlugin,
        artifactStubPlugin,
        viteSingleFile({
          // On vite 8 this sets output.codeSplitting = false, which folds every
          // dynamic import into the one chunk.
          useRecommendedBuildConfig: true,
          inlinePattern: ['*.js', '*.css', '**/*.js', '**/*.css'],
        }),
      ],
    };
  }
  return {
    base: BASE,
    build: {
      target: 'esnext',
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: `${VISUALIZER_IMAGES}/**`,
            dest: 'images',
            rename: { stripBase: VISUALIZER_STRIP },
          },
        ],
      }),
      serverRouterPlugin(serverRouter, {
        // Preview serves what Pages serves: the prerendered `<subpath>/index.html`
        // when the build wrote one, with or without the trailing slash. Dev has
        // no dist, so every shell verdict is the live index.html.
        serveShell: (_mount, req, _res, next) => {
          const path = (req.url ?? '/').replace(/[?#].*$/, '').replace(/\/+$/, '');
          const file = `${path}/index.html`;
          req.url = isPreview && existsSync(join(DIST, file)) ? file : BASE;
          next();
        },
        // The adapter sits in front of the static layer here, so it should
        // judge asset requests too — otherwise `vite preview` answers 200 for
        // a path that only looks like a route.
        shouldHandle: (req) => (req.headers.accept ?? '').includes('text/html'),
      }),
    ],
  };
});
