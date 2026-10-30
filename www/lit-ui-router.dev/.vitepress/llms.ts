import type { Plugin } from 'vite';
import type { DefaultTheme } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

import { EXAMPLE_NAMES } from 'examples/embeds';

import {
  EXAMPLES,
  githubTreeSrc,
  stackblitzOpenSrc,
} from './theme/components/examples.ts';

const LIVE_EXAMPLE = /^<LiveExample\s([^>]*?)\/>[ \t]*$/gm;

const ATTRIBUTE = /([\w-]+)="([^"]*)"/g;

function parseLiveExample(tag: string, id: string) {
  const attributes = new Map(
    Array.from(tag.matchAll(ATTRIBUTE), ([, key, value]) => [key, value]),
  );

  const name = attributes.get('name');
  const example = EXAMPLE_NAMES.find((key) => key === name);

  if (!example) {
    throw new Error(
      `${id}: <LiveExample name="${name ?? ''}"> names no entry in examples/embeds.ts`,
    );
  }

  return { name: example, file: attributes.get('file') };
}

/** Appends an `<llm-only>` line naming each `<LiveExample>`'s GitHub source and StackBlitz project. */
export function appendExampleSources(markdown: string, id: string): string {
  return markdown.replace(LIVE_EXAMPLE, (line, tag: string) => {
    const { name, file } = parseLiveExample(tag, id);
    const { title } = EXAMPLES[name];

    return [
      line,
      '',
      '<llm-only>',
      '',
      `The ${title} example: [source on GitHub](${githubTreeSrc(name)}), [open in StackBlitz](${stackblitzOpenSrc(name, file)}).`,
      '',
      '</llm-only>',
    ].join('\n');
  });
}

/** Runs before the llms plugin's `pre` transform, which reads the source and strips `<llm-only>` from the HTML. */
export function liveExampleSourcesPlugin(): Plugin {
  return {
    name: 'live-example-sources',
    enforce: 'pre',
    transform: {
      filter: { id: /\.md$/ },
      handler: (code, id) => {
        const transformed = appendExampleSources(code, id);

        return transformed === code ? null : { code: transformed, map: null };
      },
    },
  };
}

const EXCLUDED_PAGE = 'about-this-site';

/** Keeps each API reference's index page, and drops its member pages, the excluded page and the sample-app shells. */
export function llmsSidebar(
  items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] {
  return items.flatMap(({ items: children, ...item }) => {
    if (item.link === `/${EXCLUDED_PAGE}` || item.target === '_self') return [];

    if (item.link?.startsWith('/api/') || !children) return [item];

    return [{ ...item, items: llmsSidebar(children) }];
  });
}

export const LLMS_DETAILS = `lit-ui-router is a client-side routing framework for Lit web components. It is an implementation of UI-Router built on the framework-agnostic \`@uirouter/core\`.

Install it with its peers, \`lit\` and \`@uirouter/core\`:

\`\`\`bash
npm install lit-ui-router lit @uirouter/core
\`\`\`

The Hello World starter is a Vite + TypeScript app. Copy it, then run \`npm install\` and \`npm run dev\` in \`my-app\`:

\`\`\`bash
npx tiged simshanith/lit-ui-router/examples/helloworld my-app
\`\`\`

[\`helloworld-buildless\`](${githubTreeSrc('helloworld-buildless')}) is the same app in plain JavaScript, served as static files: it runs with an import map and no bundler, fetching \`lit\`, \`@uirouter/core\` and \`lit-ui-router\` from a CDN.

For a new SPA, the [Location Plugins](https://lit-ui-router.dev/guides/location-plugins.md) guide recommends \`navigationLocationPlugin\` where the browser has the Navigation API and \`pushStateLocationPlugin\` where it doesn't; the tutorial uses hash URLs, which need no host configuration.`;

export function llmsPlugins(): Plugin[] {
  return [
    liveExampleSourcesPlugin(),
    ...llmstxt({
      domain: 'https://lit-ui-router.dev',
      customTemplateVariables: { details: LLMS_DETAILS },
      ignoreFiles: [`${EXCLUDED_PAGE}.md`],
      // Member pages the sidebar filter drops would otherwise land under "Other".
      ignoreFilesPerOutput: { llmsTxt: ['api/*/**', '!api/*/index.md'] },
      sidebar: (sidebar) => {
        if (!Array.isArray(sidebar)) {
          throw new Error('llms: expected the themeConfig sidebar array');
        }

        return llmsSidebar(sidebar);
      },
    }),
  ];
}
