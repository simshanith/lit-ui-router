import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { PackageManifest } from '@tools/bootstrap/types.ts';

import { API_REFERENCES } from '../catalog/navigation.ts';
import {
  type Layer,
  PACKAGES,
  type PackageName,
  ROLES,
} from '../catalog/packages.ts';
import { code, selfLink } from './index-markdown.ts';
import { releasesPath } from './release-stubs.ts';

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

/** One package's index entry: its description, facets, entry points and links. */
export function packageEntry(
  { name, subject, runtime, ...entry }: (typeof PACKAGES)[number],
  manifest: PackageManifest,
): string[] {
  const layer = 'layer' in entry ? entry.layer : undefined;
  const reference = API_REFERENCES[name];

  const facets = [
    `subject ${code(subject)}`,
    ...(layer ? [`layer ${code(layer)}`] : []),
    `runtime ${runtime.map(code).join(', ')}`,
  ];

  const links = [
    `[Package page](/packages/${name})`,
    ...(reference ? [`[API reference](${reference})`] : []),
    selfLink('Releases', releasesPath(name)),
  ];

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
