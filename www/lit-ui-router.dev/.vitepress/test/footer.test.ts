import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import {
  COPYRIGHT,
  FOOTER_BAR,
  FOOTER_GROUPS,
  FOOTER_REFERENCES,
} from '../../catalog/footer.ts';
import {
  NAV,
  SIDEBAR,
  type NavLink,
  type SidebarEntry,
} from '../../catalog/navigation.ts';
import { linkProblem, ORIGIN } from '../published-links.ts';

const links = [
  ...new Set([...FOOTER_BAR, ...FOOTER_GROUPS.flatMap((group) => group.links)]),
];

const internal = links.filter(({ link }) => link.startsWith('/'));

// Files the build writes, which have no source for linkProblem to find; the docs e2e suite requests them.
const GENERATED = ['/llms.txt'];

const sidebarEntries = (entries: readonly SidebarEntry[]): SidebarEntry[] =>
  entries.flatMap((entry) => [entry, ...sidebarEntries(entry.items ?? [])]);

/** Every name and target navigation.ts gives a link: nav and sidebar text, and the pager's name for an Overview. */
const named = [
  ...NAV.flatMap((entry): NavLink[] =>
    'items' in entry ? entry.items : [entry],
  ),
  ...sidebarEntries(SIDEBAR).flatMap(
    ({ text, docFooterText, link, target }): NavLink[] =>
      link ? [{ text: docFooterText ?? text, link, target }] : [],
  ),
];

describe('the site footer links', () => {
  it('reach a page, a worker route or a generated file on this site', async () => {
    assert.deepEqual(
      (
        await Promise.all(
          internal.flatMap(({ link }) =>
            GENERATED.includes(link) ? [] : [linkProblem(`${ORIGIN}${link}`)],
          ),
        )
      ).filter(Boolean),
      [],
    );
  });

  it('use the name and target navigation.ts gives the same destination', () => {
    const shared = links.filter(({ link }) =>
      named.some((entry) => entry.link === link),
    );

    assert.deepEqual(
      shared.map(({ text }) => text),
      ['Releases', 'How this site runs', 'Sample App', 'Atlas'],
    );

    for (const { text, link, target } of shared) {
      assert.ok(
        named.some(
          (entry) =>
            entry.link === link &&
            entry.text === text &&
            entry.target === target,
        ),
        `${link} is not "${text}" with target ${target} in navigation.ts`,
      );
    }
  });

  it('take a full navigation to each path VitePress has no page for', () => {
    assert.deepEqual(
      internal.flatMap(({ link, target }) => (target ? [link] : [])),
      ['/releases/', '/llms.txt'],
    );
  });

  it('link other sites over https', () => {
    for (const link of [
      ...links.flatMap(({ link }) => (link.startsWith('/') ? [] : [link])),
      ...Object.values(FOOTER_REFERENCES),
    ]) {
      assert.equal(new URL(link).protocol, 'https:');
    }
  });

  it('list one destination once in the bar and once across the groups', () => {
    for (const list of [
      FOOTER_BAR,
      FOOTER_GROUPS.flatMap((group) => group.links),
    ]) {
      assert.equal(new Set(list.map(({ link }) => link)).size, list.length);
    }
  });
});

describe('the site footer copyright line', () => {
  it("names LICENSE's years and holder", () => {
    const license = readFileSync(join(workspaceRoot, 'LICENSE'), 'utf8');

    assert.ok(license.includes(`\nCopyright (c) ${COPYRIGHT}\n`));
  });
});
