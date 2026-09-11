import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import type { Manifest } from './src/manifest.ts';
import { BASE, mountsFor } from './src/routes.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(HERE, 'dist');

// The generated index is on disk at config time, so the dev server can narrow
// /sheet/:num to the numbers that were actually drawn — and answer 404 for
// the ones that were not, exactly as the deployed site will.
const manifest = JSON.parse(
  readFileSync(join(HERE, 'public', 'manifest.json'), 'utf8'),
) as Manifest;

const serverRouter = createServerRouter({
  mounts: mountsFor(manifest.sheets.map((sheet) => sheet.num)),
});

/**
 * ARTIFACT MODE — the whole atlas as ONE html file.
 *
 * A claude.ai Artifact is a single page on an opaque origin with every
 * network request blocked, so nothing may be fetched at runtime: the manifest
 * and all twenty-three fragments are baked in as a JSON island by artifact.ts,
 * sheets/atlas.css is inlined beside them, the cytoscape and three dynamic
 * imports are folded into the one chunk, and the router runs on the hash.
 */
const artifactHtmlPlugin: Plugin = {
  name: 'atlas:artifact-html',
  // Pre, so vite never resolves the two references artifact mode drops: there
  // is no <base> on an opaque origin, and atlas.css is inlined post-build.
  transformIndexHtml: {
    order: 'pre',
    handler: (html: string): string =>
      html
        .replace(/[ \t]*<base href="%BASE_URL%" \/>\n/, '')
        .replace(/[ \t]*<link rel="stylesheet" href="%BASE_URL%sheets\/atlas\.css" \/>\n/, ''),
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
        viteSingleFile({
          // On vite 8 this sets output.codeSplitting = false, which is what
          // folds fragment.ts's `import('cytoscape')` into the one chunk.
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
