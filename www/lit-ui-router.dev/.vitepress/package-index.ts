import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { PackageManifest } from '@tools/bootstrap/types.ts';

import { API_REFERENCES } from '../catalog/references.ts';
import {
  LAYERS,
  type Layer,
  PACKAGES,
  type PackageName,
  packagePagePath,
  ROLES,
  RUNTIMES,
  SUBJECTS,
} from '../catalog/packages.ts';
import { headingSlug } from './example-index.ts';
import { code, markdownLink } from './index-markdown.ts';
import { releasesPath } from './release-stubs.ts';
import type {
  FacetDefinition,
  FacetIndexData,
  FacetLink,
} from './theme/components/faceted-index.ts';

/** Every manifest under packages/, keyed by package name. */
export function packageManifests(): Map<string, PackageManifest> {
  const dir = join(workspaceRoot, 'packages');

  return new Map(
    readdirSync(dir).flatMap((entry) => {
      const manifest = readManifest(join(dir, entry));

      return manifest?.name ? [[manifest.name, manifest] as const] : [];
    }),
  );
}

const manifestOf = (
  manifests: ReadonlyMap<string, PackageManifest>,
  name: PackageName,
): PackageManifest => {
  const manifest = manifests.get(name);

  if (!manifest) throw new Error(`${name}: no package.json under packages/`);

  return manifest;
};

/** The layer a package's peers decide: `lit` when it peers on `lit` or `lit-ui-router`, `agnostic` on `@uirouter/core` alone, none otherwise. */
export function peerLayer({
  peerDependencies = {},
}: PackageManifest): Layer | undefined {
  if ('lit' in peerDependencies || 'lit-ui-router' in peerDependencies)
    return 'lit';

  return '@uirouter/core' in peerDependencies ? 'agnostic' : undefined;
}

/** The import specifiers a package's `exports` map offers: wildcards and JSON files left out. */
export function entryPoints({ name, exports = {} }: PackageManifest): string[] {
  return Object.keys(exports)
    .filter((subpath) => !subpath.includes('*') && !subpath.endsWith('.json'))
    .map((subpath) =>
      subpath === '.' ? `${name}` : `${name}/${subpath.slice(2)}`,
    );
}

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

function packageLinks(name: PackageName): FacetLink[] {
  const reference = API_REFERENCES[name];

  return [
    { text: 'Package page', href: packagePagePath(name) },
    ...(reference ? [{ text: 'API reference', href: reference }] : []),
    { text: 'Releases', href: releasesPath(name), self: true },
  ];
}

/** One package's index entry: its description, facets, entry points and links. */
export function packageEntry(
  { name, subject, runtime, ...entry }: (typeof PACKAGES)[number],
  manifest: PackageManifest,
): string[] {
  const layer = 'layer' in entry ? entry.layer : undefined;

  const facets = [
    `subject ${code(subject)}`,
    ...(layer ? [`layer ${code(layer)}`] : []),
    `runtime ${runtime.map(code).join(', ')}`,
  ];

  const links = packageLinks(name).map(markdownLink);

  return [
    `### ${name}`,
    '',
    ...(manifest.description ? [sentence(manifest.description), ''] : []),
    `- Facets: ${facets.join(' · ')}`,
    `- Entry points: ${entryPoints(manifest).map(code).join(', ')}`,
    `- ${links.join(' · ')}`,
    '',
  ];
}

const allRouterSubject = PACKAGES.every(({ subject }) => subject === 'router');

const PACKAGE_FACET_DEFINITIONS: readonly FacetDefinition[] = [
  {
    key: 'subject',
    hint: 'router / lit',
    description: allRouterSubject
      ? '`router` for the router family; `lit` for Lit tooling with no router dependency. All published packages are `router` today.'
      : '`router` for the router family; `lit` for Lit tooling with no router dependency.',
    values: SUBJECTS,
    defaultValue: 'router',
    showOnRow: false,
  },
  {
    key: 'layer',
    hint: 'core-only vs Lit peers',
    description:
      '`agnostic` when the package peers on `@uirouter/core` and its runtime only; `lit` when it also peers on `lit` or `lit-ui-router` (`eslint-plugin-lit-ui-router` peers only on `eslint` and is `lit` by what it lints).',
    values: LAYERS,
    defaultValue: 'lit',
  },
  {
    key: 'role',
    hint: 'package category',
    description:
      'What job the package does in the family: `renderer`, `reactivity`, `location`, `server`, `dx`, or `observability`.',
    values: ROLES.map(({ id }) => id),
    showOnRow: false,
  },
  {
    key: 'runtime',
    hint: 'where code runs',
    description:
      'Where its code runs: `browser`, `server`, `build`, `type-check`, `editor`, or `ci`.',
    values: RUNTIMES,
    defaultValue: 'browser',
  },
];

const PACKAGE_PICKER_ORDER = ['layer', 'runtime', 'role', 'subject'] as const;

/** Structured catalog data for the interactive /packages/ faceted index. */
export function packageIndexData(
  manifests = packageManifests(),
): FacetIndexData {
  return {
    itemSingular: 'package',
    itemPlural: 'packages',
    defaultFacet: 'layer',
    pickerOrder: PACKAGE_PICKER_ORDER,
    facets: PACKAGE_FACET_DEFINITIONS,
    groups: ROLES.map(({ id, label }) => ({ id, label })),
    entries: PACKAGES.map((entry) => {
      const manifest = manifestOf(manifests, entry.name);
      const layer = 'layer' in entry ? entry.layer : undefined;

      return {
        id: entry.name,
        slug: headingSlug(entry.name),
        title: entry.name,
        monoTitle: true,
        summary: manifest.description
          ? sentence(manifest.description)
          : undefined,
        group: entry.role,
        facets: {
          subject: [entry.subject],
          layer: layer ? [layer] : [],
          role: [entry.role],
          runtime: entry.runtime,
        },
        links: packageLinks(entry.name),
        entryPoints: entryPoints(manifest),
      };
    }),
  };
}

/** One section per role, in catalog order, each package with its facets and links. */
export function packageIndex(manifests = packageManifests()): string {
  return ROLES.flatMap(({ id, label }) => [
    `## ${label}`,
    '',
    ...PACKAGES.filter(({ role }) => role === id).flatMap((entry) =>
      packageEntry(entry, manifestOf(manifests, entry.name)),
    ),
  ]).join('\n');
}
