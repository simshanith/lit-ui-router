import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { DefaultTheme } from 'vitepress';

import { packageGroups } from '../../catalog/navigation.ts';
import { PACKAGES } from '../../catalog/packages.ts';

const site = join(import.meta.dirname, '../..');

const packagesDir = join(workspaceRoot, 'packages');

const published = readdirSync(packagesDir)
  .flatMap((dir) => readManifest(join(packagesDir, dir)) ?? [])
  .flatMap(({ name, private: isPrivate }) => (name && !isPrivate ? [name] : []))
  .sort();

const cataloged = PACKAGES.map(({ name }) => name);

const links = (items: readonly DefaultTheme.SidebarItem[]): string[] =>
  items.flatMap(({ link, items: children = [] }) => [
    ...(link ? [link] : []),
    ...links(children),
  ]);

// A package page leads with its own npm badge; a family page has none.
const packageOf = (link: string): string[] => {
  const markdown = readFileSync(join(site, `${link}.md`), 'utf8');
  const name = /npmx\.dev\/package\/([\w-]+)/.exec(markdown)?.[1];

  return name ? [name] : [];
};

describe('the package catalog', () => {
  it('finds the published packages', () => {
    assert.ok(published.includes('lit-ui-router'));
  });

  it('gives every published package a role', () => {
    assert.deepEqual(
      published.filter((name) => !cataloged.some((known) => known === name)),
      [],
    );
  });

  it('names no package that is not published', () => {
    assert.deepEqual(
      cataloged.filter((name) => !published.includes(name)),
      [],
    );
  });

  it('names each package once', () => {
    assert.equal(new Set(cataloged).size, cataloged.length);
  });

  it('puts the same packages under each Packages role as the catalog', () => {
    for (const { role, items } of packageGroups) {
      assert.deepEqual(
        links(items).flatMap(packageOf).sort(),
        PACKAGES.filter((entry) => entry.role === role)
          .map(({ name }) => name)
          .sort(),
        role,
      );
    }
  });
});
