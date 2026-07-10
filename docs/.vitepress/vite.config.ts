import { defineConfig, Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Tutorial examples embedded same-origin at /examples/<name>/; built by
// `examples#build:embeds` (hash routing, so no _redirects entries needed).
const EMBEDDED_EXAMPLES = ['helloworld', 'hellosolarsystem', 'hellogalaxy'];

// VitePress 1.x / vite 6 default targets list `safari14`, but esbuild >=0.27.7
// refuses to emit destructuring for Safari <14.1 (JSC array-rest bug,
// compat-table/compat-table#2008) and has no lowering transform for it.
const TARGET = ['chrome87', 'edge88', 'es2020', 'firefox78', 'safari14.1'];

/**
 * Vite plugin to handle /app/* and /app-mobx/* deep linking in dev server.
 * Mirrors Cloudflare _redirects: `/app/* /app 200`, `/app-mobx/* /app-mobx 200`
 * Rewrites requests to serve the matching sample-app SPA html.
 * Also resolves /examples/<name>/ directory requests to their index.html
 * (production gets this from Cloudflare's static-asset index resolution).
 */
function spaFallbackPlugin(): Plugin {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const exampleDir = req.url?.match(/^\/examples\/([\w-]+)\/?$/);
        if (exampleDir) {
          req.url = `/examples/${exampleDir[1]}/index.html`;
        } else if (req.url?.startsWith('/app-mobx')) {
          req.url = '/app-mobx.html';
        } else if (req.url?.startsWith('/app')) {
          req.url = '/app.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    spaFallbackPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/assets/*',
          dest: 'assets',
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/index.html',
          dest: '',
          rename: 'app.html',
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/assets/*',
          dest: 'assets',
        },
        {
          src: 'node_modules/sample-app-lit-mobx/dist/index.html',
          dest: '',
          rename: 'app-mobx.html',
        },
        // images/ and static/ come from sample-app-shared and are identical
        // in both apps' dists; copy once so neither can silently clobber.
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/images/*',
          dest: 'images',
        },
        {
          src: 'node_modules/sample-app-lit-vanilla/dist/static/*',
          dest: 'static',
        },
        ...EMBEDDED_EXAMPLES.map((name) => ({
          src: `../examples/${name}/dist/*`,
          dest: `examples/${name}`,
        })),
      ],
    }),
  ],

  build: {
    target: TARGET,
  },

  optimizeDeps: {
    // the dev dep-optimizer ignores build.target and pre-bundles against
    // vite's internal ESBUILD_MODULES_TARGET, which still lists safari14
    esbuildOptions: {
      target: TARGET,
    },
  },

  server: {
    open: !Boolean(process.env.CI) && !Boolean(process.env.E2E_TEST),
  },
});
