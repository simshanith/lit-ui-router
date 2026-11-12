import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import matter from '@11ty/gray-matter';
import MarkdownIt from 'markdown-it';
import * as v from 'valibot';

import { GUIDE_TOPICS, guideGroups } from '../../catalog/navigation.ts';
import { GENERATED_PAGES, PageMeta } from '../page-meta.ts';

const site = join(import.meta.dirname, '../..');

const pages = globSync('**/*.md', {
  cwd: site,
  exclude: ['node_modules/**', 'dist/**', ...GENERATED_PAGES],
})
  .sort()
  .map((path) => ({ path, ...matter(readFileSync(join(site, path), 'utf8')) }))
  // The home page is the one hand-written page without a type.
  .filter(({ data }) => data.layout !== 'home');

const route = (path: string) => `/${path.replace(/\.md$/, '')}`;

const parsed = pages.map(({ path, data }) => ({
  path,
  result: v.safeParse(PageMeta, data),
}));

const guides = parsed.flatMap(({ path, result }) =>
  result.success && result.output.type === 'guide'
    ? [{ link: route(path), topic: result.output.topic }]
    : [],
);

/** Each `##` section of guides/index.md that links guides, with those links. */
function indexSections(markdown: string) {
  const sections: { text: string; links: string[] }[] = [];
  const tokens = new MarkdownIt().parse(markdown, {});

  for (const [i, token] of tokens.entries()) {
    if (token.type === 'heading_open' && token.tag === 'h2') {
      sections.push({ text: tokens[i + 1]?.content ?? '', links: [] });
    }

    for (const child of token.children ?? []) {
      const href = child.type === 'link_open' ? child.attrGet('href') : null;

      if (href?.startsWith('./')) {
        sections.at(-1)?.links.push(`/guides/${href.slice(2)}`);
      }
    }
  }

  return sections.filter(({ links }) => links.length > 0);
}

describe('page frontmatter', () => {
  it('finds the hand-written pages', () => {
    assert.ok(pages.some(({ path }) => path === 'introduction.md'));
    assert.ok(pages.every(({ path }) => path !== 'index.md'));
  });

  it('gives every page a type, and a topic to guides only', () => {
    assert.deepEqual(
      parsed.flatMap(({ path, result }) =>
        (result.issues ?? []).map(({ message }) => `${path}: ${message}`),
      ),
      [],
    );
  });

  it('keeps every guide under /guides/', () => {
    assert.deepEqual(
      guides.filter(({ link }) => !link.startsWith('/guides/')),
      [],
    );
  });
});

describe('Guides sidebar', () => {
  it('has one group per topic, in vocabulary order', () => {
    assert.deepEqual(
      guideGroups.map(({ topic, text }) => ({ id: topic, label: text })),
      [...GUIDE_TOPICS],
    );
  });

  it("links each guide from its topic's group, and nothing else", () => {
    const linked = guideGroups.flatMap(({ topic, items }) =>
      items.map(({ link }) => ({ link, topic })),
    );

    const byLink = (a: { link: string }, b: { link: string }) =>
      a.link.localeCompare(b.link);

    assert.deepEqual(linked.sort(byLink), guides.sort(byLink));
  });

  it('links each group heading to an index page', () => {
    const types = new Map(
      parsed.flatMap(({ path, result }) =>
        result.success ? [[route(path), result.output.type]] : [],
      ),
    );

    assert.deepEqual(
      guideGroups.flatMap(({ link }) =>
        link && types.get(link) !== 'index' ? [link] : [],
      ),
      [],
    );
  });

  it('matches the sections of guides/index.md', () => {
    const index = pages.find(({ path }) => path === 'guides/index.md');

    assert.ok(index);
    assert.deepEqual(
      indexSections(index.content),
      guideGroups.map(({ text, items }) => ({
        text,
        links: items.map(({ link }) => link),
      })),
    );
  });
});
