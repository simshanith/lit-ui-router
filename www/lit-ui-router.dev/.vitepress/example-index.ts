import { globSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { DependencyMap, PackageManifest } from '@tools/bootstrap/types.ts';

import { EXAMPLE_NAMES, type ExampleName } from 'examples/embeds';

import {
  EXAMPLE_FACETS,
  EXAMPLE_KINDS,
  type ExampleFacets,
  type ExampleKind,
} from '../catalog/examples.ts';
import { code, selfLink } from './index-markdown.ts';
import { pageUrl } from './surfaces.ts';
import {
  EXAMPLES,
  githubTreeSrc,
  stackblitzOpenSrc,
  staticSrc,
} from './theme/components/examples.ts';
import type {
  FacetDefinition,
  FacetIndexData,
} from './theme/components/faceted-index.ts';

const SITE = join(import.meta.dirname, '..');

const manifestIn = (dir: string): PackageManifest => {
  const manifest = readManifest(dir);

  if (!manifest) throw new Error(`${dir}: no package.json`);

  return manifest;
};

const depsOf = ({ dependencies, devDependencies }: PackageManifest) => ({
  ...dependencies,
  ...devDependencies,
});

const BINDINGS = ['mobx', 'signals', 'effect'] as const;

/** Facets an app's dependencies decide: its Lit bindings, prerendering, the registry and its own lint plugin. */
export function dependencyFacets(deps: DependencyMap): ExampleFacets {
  const bindings = BINDINGS.filter((name) => `lit-ui-router-${name}` in deps);

  if (bindings.length > 1)
    throw new Error(`more than one binding: ${bindings.join(', ')}`);

  return {
    bindings: bindings[0] ?? 'none',
    render: 'lit-ui-router-ssr' in deps ? 'prerender' : 'client',
    registry: 'ui-router-registry' in deps ? 'on' : 'off',
    lint: 'eslint-plugin-lit-ui-router' in deps ? 'on' : 'off',
  };
}

// replaceAwareHashLocationPlugin is the unmatched-urls guide's HashLocationService subclass: a hash location.
const LOCATION_PLUGIN =
  /\.plugin\(\s*(navigation|pushState|hash|replaceAwareHash)LocationPlugin\b/g;

/** The one location plugin an example's sources hand the router. */
export function locationOf(
  sources: readonly string[],
): NonNullable<ExampleFacets['location']> {
  const found = new Set(
    sources.flatMap((source) =>
      Array.from(source.matchAll(LOCATION_PLUGIN), ([, plugin]) =>
        plugin === 'replaceAwareHash' ? 'hash' : plugin,
      ),
    ),
  );

  const [location, ...others] = EXAMPLE_FACETS.location.filter((plugin) =>
    found.has(plugin),
  );

  if (!location || others.length > 0)
    throw new Error(
      `expected one location plugin, found ${[...found].join(', ') || 'none'}`,
    );

  return location;
}

const KIND_PREFIXES = {
  'lit-ui-router-tutorial-': 'tutorial',
  'lit-ui-router-example-': 'example',
} as const satisfies Record<string, ExampleKind>;

/** An example's kind, from its package name. */
export function kindOf(packageName = ''): ExampleKind {
  const kind = Object.entries(KIND_PREFIXES).find(([prefix]) =>
    packageName.startsWith(prefix),
  )?.[1];

  if (!kind) throw new Error(`${packageName}: no example kind prefix`);

  return kind;
}

const sourcesOf = (dir: string): string[] =>
  globSync(['src/**/*.{ts,js}', 'public/**/*.js', '*.js'], { cwd: dir }).map(
    (file) => readFileSync(join(dir, file), 'utf8'),
  );

/** Every facet of one example, read from its own folder. */
export function exampleFacets(name: ExampleName): ExampleFacets {
  const dir = join(workspaceRoot, 'examples', name);
  const manifest = manifestIn(dir);
  const lang = extname(EXAMPLES[name].file) === '.js' ? 'js' : 'ts';

  try {
    return {
      kind: kindOf(manifest.name),
      lang,
      location: locationOf(sourcesOf(dir)),
      ...dependencyFacets(depsOf(manifest)),
    };
  } catch (error) {
    throw new Error(`examples/${name}`, { cause: error });
  }
}

const LIVE_EXAMPLE = /<LiveExample\s[^>]*name="([\w-]+)"/g;

const TITLE = /^title:\s*(.+)$|^# (.+)$/m;

const SKIPPED =
  /(^|\/)(node_modules|dist)$|^(\.vitepress|reference|package-releases)$/;

interface PageLink {
  title: string;
  url: string;
}

/** The docs pages whose sources embed each example, by `<LiveExample>`; generated page trees are skipped, and the live-examples page's source holds only its marker. */
export function embeddingPages(): Map<string, PageLink[]> {
  const pages = new Map<string, PageLink[]>();

  const files = globSync('**/*.md', {
    cwd: SITE,
    exclude: (path) => SKIPPED.test(path),
  }).sort();

  for (const file of files) {
    const markdown = readFileSync(join(SITE, file), 'utf8');
    const match = TITLE.exec(markdown);
    const title = (match?.[1] ?? match?.[2] ?? file).trim();

    for (const [, name] of markdown.matchAll(LIVE_EXAMPLE)) {
      const list = pages.get(name) ?? [];

      if (!list.some(({ url }) => url === pageUrl(file)))
        list.push({ title, url: pageUrl(file) });
      pages.set(name, list);
    }
  }

  return pages;
}

/** A facet line in the vocabulary's key order. */
export function facetLine(facets: ExampleFacets): string {
  // SAFETY: EXAMPLE_FACETS is a const literal, so its own keys are exactly keyof ExampleFacets
  const keys = Object.keys(EXAMPLE_FACETS) as (keyof ExampleFacets)[];

  return keys
    .flatMap((key) => {
      const value = facets[key];

      return value ? [`${key} ${code(value)}`] : [];
    })
    .join(' · ');
}

/** The live-examples page: it embeds the examples no other page embeds. */
export const LIVE_EXAMPLES = { title: 'Live examples', url: '/examples/live' };

const SPECIAL = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g;

/** A heading's anchor, as VitePress's default slugify writes it. */
export const headingSlug = (heading: string): string =>
  heading
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(SPECIAL, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase();

/** The examples no docs page source embeds, in embeds.ts order. */
export const unembeddedExamples = (
  pages: ReadonlyMap<string, readonly PageLink[]> = embeddingPages(),
): ExampleName[] => EXAMPLE_NAMES.filter((name) => !pages.has(name));

export const EMPTY_LIVE_EXAMPLES = `every example is embedded on a docs page, so ${LIVE_EXAMPLES.url} would be empty: delete examples/live.md, its sidebar link in catalog/navigation.ts and its path in catalog/surfaces.ts`;

/** One section per example no other page embeds, each under its examples-index heading. */
export function liveExamples(
  pages: ReadonlyMap<string, readonly PageLink[]> = embeddingPages(),
): string {
  const names = unembeddedExamples(pages);

  if (names.length === 0) throw new Error(EMPTY_LIVE_EXAMPLES);

  return names
    .flatMap((name) => {
      const { title, summary } = EXAMPLES[name];

      return [
        `## ${title}`,
        '',
        `${summary}. [Facets and links](/examples/#${headingSlug(title)}).`,
        '',
        `<LiveExample name="${name}" />`,
        '',
      ];
    })
    .join('\n');
}

const pageLink = ({ title, url }: PageLink): string => `[${title}](${url})`;

function exampleEntry(
  name: ExampleName,
  facets: ExampleFacets,
  pages: readonly PageLink[],
): string[] {
  const { title, summary } = EXAMPLES[name];

  const links = [
    selfLink('Run it', staticSrc(name)),
    `[Open in StackBlitz](${stackblitzOpenSrc(name)})`,
    `[Source](${githubTreeSrc(name)})`,
  ];

  return [
    `### ${title}`,
    '',
    `${summary}.`,
    '',
    `- Facets: ${facetLine(facets)}`,
    `- ${links.join(' · ')}`,
    `- Embedded in: ${
      pages.length > 0
        ? pages.map(pageLink).join(', ')
        : pageLink({
            title: LIVE_EXAMPLES.title,
            url: `${LIVE_EXAMPLES.url}#${headingSlug(title)}`,
          })
    }`,
    '',
  ];
}

const EXAMPLE_FACET_DEFINITIONS: readonly FacetDefinition[] = [
  {
    key: 'kind',
    hint: 'tutorial / example',
    description:
      '`tutorial` for a tutorial rung or a variant of one; `example` for an app that shows one feature.',
    values: EXAMPLE_FACETS.kind,
    showOnRow: false,
  },
  {
    key: 'lang',
    hint: 'ts / js',
    description:
      '`ts` (TypeScript) or `js` (plain JavaScript with no build step).',
    values: EXAMPLE_FACETS.lang,
    defaultValue: 'ts',
  },
  {
    key: 'location',
    hint: 'URL plugin',
    description:
      'The location plugin handed to the router: `navigation`, `pushState`, or `hash`. A hash URL keeps navigation inside an embed frame.',
    values: EXAMPLE_FACETS.location,
    defaultValue: 'hash',
  },
  {
    key: 'bindings',
    hint: 'reactivity adapter',
    description:
      'The reactivity bindings used for route state: `none`, `mobx`, `signals`, or `effect`.',
    values: EXAMPLE_FACETS.bindings,
    defaultValue: 'none',
  },
  {
    key: 'render',
    hint: 'client / prerender',
    description:
      '`client` when the browser renders every page; `prerender` when a build emits static HTML with `lit-ui-router-ssr`.',
    values: EXAMPLE_FACETS.render,
    defaultValue: 'client',
  },
  {
    key: 'registry',
    hint: 'typed routes',
    description:
      '`on` when the example types its state names and params with `ui-router-registry`.',
    values: EXAMPLE_FACETS.registry,
    defaultValue: 'off',
  },
  {
    key: 'lint',
    hint: 'own ESLint config',
    description:
      "`on` when the example's own project runs `eslint-plugin-lit-ui-router`, so a copy keeps the rules. The repository's lint runs the same rules over every example either way.",
    values: EXAMPLE_FACETS.lint,
    defaultValue: 'off',
  },
];

const EXAMPLE_PICKER_ORDER = [
  'bindings',
  'render',
  'location',
  'kind',
  'lang',
  'registry',
  'lint',
] as const;

/** Structured catalog data for the interactive /examples/ faceted index. */
export function exampleIndexData(): FacetIndexData {
  const pages = embeddingPages();

  return {
    itemSingular: 'example',
    itemPlural: 'examples',
    defaultFacet: 'bindings',
    pickerOrder: EXAMPLE_PICKER_ORDER,
    facets: EXAMPLE_FACET_DEFINITIONS,
    groups: EXAMPLE_KINDS.map(({ id, label }) => ({ id, label })),
    entries: EXAMPLE_NAMES.map((name) => {
      const { title, summary } = EXAMPLES[name];
      const facets = exampleFacets(name);
      const embedded = pages.get(name) ?? [];
      const slug = headingSlug(title);

      return {
        id: name,
        slug,
        title,
        summary: `${summary}.`,
        group: facets.kind ?? 'example',
        facets: Object.fromEntries(
          Object.entries(facets).flatMap(([k, v]) => (v ? [[k, [v]]] : [])),
        ),
        links: [
          { text: 'Run it', href: staticSrc(name), self: true },
          {
            text: 'StackBlitz',
            href: stackblitzOpenSrc(name),
            external: true,
          },
          { text: 'Source', href: githubTreeSrc(name), external: true },
        ],
        embeddedIn:
          embedded.length > 0
            ? embedded.map(({ title: text, url: href }) => ({ text, href }))
            : [
                {
                  text: LIVE_EXAMPLES.title,
                  href: `${LIVE_EXAMPLES.url}#${slug}`,
                },
              ],
      };
    }),
  };
}

/** One section per kind, in vocabulary order. */
export function exampleIndex(): string {
  const pages = embeddingPages();

  const facets = new Map(
    EXAMPLE_NAMES.map((name) => [name, exampleFacets(name)]),
  );

  return EXAMPLE_KINDS.flatMap(({ id, label }) => [
    `## ${label}`,
    '',
    ...EXAMPLE_NAMES.filter((name) => facets.get(name)?.kind === id).flatMap(
      (name) =>
        exampleEntry(name, facets.get(name) ?? {}, pages.get(name) ?? []),
    ),
  ]).join('\n');
}
