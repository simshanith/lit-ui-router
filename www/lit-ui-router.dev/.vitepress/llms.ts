import type { Plugin, Rollup, TransformResult } from 'vite';
import type { DefaultTheme } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

import { EXAMPLE_NAMES } from 'examples/embeds';

import {
  EXAMPLES,
  githubTreeSrc,
  stackblitzOpenSrc,
} from './theme/components/examples.ts';
import { SIDEBAR } from '../catalog/navigation.ts';
import { PACKAGES } from '../catalog/packages.ts';
import { ELEMENT_REFERENCES } from '../catalog/references.ts';
import { changelogMarkdownPath } from './changelog.ts';
import { RELEASES_PATH } from './release-stubs.ts';
import { pageGlobs, surfaceOf } from './surfaces.ts';
import { SITE_ORIGIN } from './versions.ts';

const LIVE_EXAMPLE = /^<LiveExample\s([^>]*?)\/>[ \t]*$/gm;

const LINT_EXAMPLE =
  /^<LintExample\s([^>]*?)>\n([\s\S]*?)\n<\/LintExample>[ \t]*$/gm;

const LINT_SLOT = /^<template #(\w+)>\n([\s\S]*?)\n<\/template>[ \t]*$/gm;

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

/** Emits plain Incorrect / Lint error / Correct Markdown for LLMs and hides the Vue slot wrapper from them. */
export function formatLintExamples(markdown: string): string {
  return markdown.replace(LINT_EXAMPLE, (block, tag: string, body: string) => {
    const attributes = new Map(
      Array.from(tag.matchAll(ATTRIBUTE), ([, key, value]) => [key, value]),
    );

    const slots = new Map(
      Array.from(body.matchAll(LINT_SLOT), ([, name, content]) => [
        name,
        content.trim(),
      ]),
    );

    const rule = attributes.get('rule');

    const sections = [
      [
        rule ? `**Incorrect** (\`${rule}\`):` : '**Incorrect**:',
        slots.get('incorrect'),
      ],
      ['Lint error:', slots.get('diagnostic')],
      ['**Correct**:', slots.get('correct')],
    ].flatMap(([heading, content]) =>
      content ? [`${heading}\n\n${content}`] : [],
    );

    return [
      '<llm-exclude>',
      '',
      block,
      '',
      '</llm-exclude>',
      '',
      '<llm-only>',
      '',
      sections.join('\n\n'),
      '',
      '</llm-only>',
    ].join('\n');
  });
}

/** Runs every docs-side Markdown pre-transform before `vitepress-plugin-llms` reads the page. */
export function transformMarkdownForLlms(markdown: string, id: string): string {
  return formatLintExamples(appendExampleSources(markdown, id));
}

/** Runs before the llms plugin's `pre` transform, which reads the source and strips `<llm-only>` from the HTML. */
export function liveExampleSourcesPlugin(): Plugin {
  return {
    name: 'live-example-sources',
    enforce: 'pre',
    transform: {
      filter: { id: /\.md$/ },
      handler: (code, id) => {
        const transformed = transformMarkdownForLlms(code, id);

        return transformed === code ? null : { code: transformed, map: null };
      },
    },
  };
}

/** The llms.txt listing of a sidebar link: external links stay, and the catalog decides for site paths. */
const llmsOf = (link: string | undefined) =>
  link?.startsWith('/') ? surfaceOf(link).llms : 'pages';

/** Keeps the pages the catalog lists, and only the index page of an `index` row such as an API reference. */
export function llmsSidebar(
  items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] {
  return items.flatMap(({ items: children, ...item }) => {
    const llms = llmsOf(item.link);

    if (llms !== 'pages' && llms !== 'index') return [];

    if (!children) return [item];

    if (llms === 'index') {
      // An index row lists its own page, and a hand-written page inside it.
      const pages = children.filter(({ link }) => llmsOf(link) === 'pages');

      return [pages.length > 0 ? { ...item, items: pages } : item];
    }

    return [{ ...item, items: llmsSidebar(children) }];
  });
}

/** Page paths llms.txt leaves out: the members of each `index` row, including a multi-entry reference's root module (`reference/<pkg>/index.md`), which matches the same sidebar link as the package index (`reference/<pkg>.md`). */
export const LLMS_TXT_IGNORE = [
  ...pageGlobs(({ llms }) => llms === 'index'),
  // A hand-written page inside a reference is listed.
  ...Object.values(ELEMENT_REFERENCES).map(
    ({ link }) => `!${link.slice(1)}.md`,
  ),
];

export const LLMS_DETAILS = `lit-ui-router is a client-side routing framework for Lit web components. It is an implementation of UI-Router built on the framework-agnostic \`@uirouter/core\`.

Install it with its peers, \`lit\` and \`@uirouter/core\`:

\`\`\`bash
npm install lit-ui-router lit @uirouter/core
\`\`\`

The Hello World starter is a Vite + TypeScript app. Copy it, then run \`npm install\` and \`npm run dev\` in \`my-app\`:

\`\`\`bash
npx tiged simshanith/lit-ui-router/examples/helloworld my-app
\`\`\`

[\`helloworld-buildless\`](${githubTreeSrc('helloworld-buildless')}) is the same app in plain JavaScript, served as static files: it runs with an import map and no bundler, fetching \`lit\`, \`@uirouter/core\` and \`lit-ui-router\` from [esm.sh](https://esm.sh), a CDN that builds npm packages into browser ES modules, and \`checkJs\` still typechecks it against the published types. [\`helloworld-nudeps\`](${githubTreeSrc('helloworld-nudeps')}) installs the same three packages from npm instead and serves them from the page's own origin through an import map that [nudeps](https://nudeps.dev) generates on install.

For a new SPA, the [Location Plugins](https://lit-ui-router.dev/guides/location-plugins.md) guide recommends \`navigationLocationPlugin\` where the browser has the Navigation API and \`pushStateLocationPlugin\` where it doesn't; the tutorial uses hash URLs, which need no host configuration.`;

/** The worker renders the release pages, so no Markdown source or sidebar item can list them; each package's changelog is a static Markdown copy. */
export const LLMS_RELEASES = [
  `- [Releases](${SITE_ORIGIN}${RELEASES_PATH}): The newest stable releases across packages, then the latest stable release of every package. Each package's page, at \`${SITE_ORIGIN}${RELEASES_PATH}<npm-name>/\`, lists every version it has released, with release notes and version diffs.`,
  ...PACKAGES.map(
    ({ name }) =>
      `- [${name} changelog](${SITE_ORIGIN}${changelogMarkdownPath(name)}): The release notes of every stable ${name} release, newest first, as Markdown.`,
  ),
].join('\n');

// The plugin's default template plus the Releases section; `{toc}` ends with its own blank line.
const LLMS_TEMPLATE = `# {title}

{description}

{details}

## Table of Contents

{toc}## Releases

{releases}
`;

/** The hooks vitepress-plugin-llms defines, as plain functions that ignore `this`. */
export interface LlmsHooks {
  transform: (code: string, id: string) => Promise<TransformResult>;
  buildStart: () => void;
  generateBundle: (
    options: Rollup.NormalizedOutputOptions,
    bundle: Rollup.OutputBundle,
    isWrite: boolean,
  ) => Promise<void>;
}

/** Hands the llms plugin its pages in source-path order: it sorts by title alone, so equal titles otherwise keep Vite's concurrent transform order. */
export function inPathOrder([tags, build]: [Plugin, Plugin]): [Plugin, Plugin] {
  // SAFETY: vitepress-plugin-llms 1.14 defines each hook as a plain function; llms-order.test.ts runs them
  const transform = tags.transform as LlmsHooks['transform'];

  // SAFETY: as above
  const buildStart = build.buildStart as LlmsHooks['buildStart'];

  // SAFETY: as above
  const generateBundle = build.generateBundle as LlmsHooks['generateBundle'];

  const pages = new Map<string, string>();

  return [
    {
      ...tags,
      transform(code, id) {
        if (id.endsWith('.md')) pages.set(id, code);

        return transform(code, id);
      },
    },
    {
      ...build,
      buildStart() {
        pages.clear();
        buildStart();
      },
      async generateBundle(options, bundle, isWrite) {
        // The plugin's buildStart empties its page map; refill it sorted.
        buildStart();

        for (const [id, code] of [...pages].sort(([a], [b]) =>
          a < b ? -1 : 1,
        )) {
          await transform(code, id);
        }

        await generateBundle(options, bundle, isWrite);
      },
    },
  ];
}

export function llmsPlugins(): Plugin[] {
  return [
    liveExampleSourcesPlugin(),
    ...inPathOrder(
      llmstxt({
        domain: SITE_ORIGIN,
        customLLMsTxtTemplate: LLMS_TEMPLATE,
        customTemplateVariables: {
          details: LLMS_DETAILS,
          releases: LLMS_RELEASES,
        },
        // The release stubs exist for local search; the Releases section covers them here.
        ignoreFiles: pageGlobs(({ llms }) => llms === false),
        // Member pages the sidebar filter drops would otherwise land under "Other".
        ignoreFilesPerOutput: { llmsTxt: LLMS_TXT_IGNORE },
        // The catalog's own labels: config.ts marks up the package names for the rendered sidebar.
        sidebar: llmsSidebar(SIDEBAR),
      }),
    ),
  ];
}
