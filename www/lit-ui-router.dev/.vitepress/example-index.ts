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
  SAMPLE_APPS,
} from '../catalog/examples.ts';
import { code, selfLink } from './index-markdown.ts';
import { pageUrl } from './surfaces.ts';
import {
  EXAMPLES,
  githubTreeSrc,
  stackblitzOpenSrc,
  staticSrc,
} from './theme/components/examples.ts';

const SITE = join(import.meta.dirname, '..');

const GITHUB_APPS =
  'https://github.com/simshanith/lit-ui-router/tree/main/apps';

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

/** Facets an app's dependencies decide: its Lit bindings, prerendering, the registry and the lint plugin. */
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

const LOCATION_PLUGIN =
  /\.plugin\(\s*(navigation|pushState|hash)LocationPlugin\b/g;

/** The one location plugin an example's sources hand the router. */
export function locationOf(
  sources: readonly string[],
): NonNullable<ExampleFacets['location']> {
  const found = new Set(
    sources.flatMap((source) =>
      Array.from(source.matchAll(LOCATION_PLUGIN), ([, plugin]) => plugin),
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
} as const satisfies Record<string, Exclude<ExampleKind, 'sample-app'>>;

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
  /(^|\/)(node_modules|dist)$|^(\.vitepress|reference|package-releases|snapshots)$/;

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

/** One sample-app mount's facets: the app package's dependencies decide them. */
export function sampleAppFacets(app: string): ExampleFacets {
  return {
    kind: 'sample-app',
    ...dependencyFacets(depsOf(manifestIn(join(workspaceRoot, 'apps', app)))),
  };
}

function sampleAppEntries(): string[] {
  return Object.entries(SAMPLE_APPS).flatMap(([mount, { label, app }]) => [
    `### ${label} sample app`,
    '',
    `- Facets: ${facetLine(sampleAppFacets(app))}`,
    `- ${selfLink(`Open ${code(mount)}`, mount)} · [Source](${GITHUB_APPS}/${app})`,
    '',
  ]);
}

/** One section per kind, in vocabulary order: the embedded examples, then the live sample-app mounts. */
export function exampleIndex(): string {
  const pages = embeddingPages();

  const facets = new Map(
    EXAMPLE_NAMES.map((name) => [name, exampleFacets(name)]),
  );

  return EXAMPLE_KINDS.flatMap(({ id, label }) => [
    `## ${label}`,
    '',
    ...(id === 'sample-app'
      ? sampleAppEntries()
      : EXAMPLE_NAMES.filter((name) => facets.get(name)?.kind === id).flatMap(
          (name) =>
            exampleEntry(name, facets.get(name) ?? {}, pages.get(name) ?? []),
        )),
  ]).join('\n');
}
