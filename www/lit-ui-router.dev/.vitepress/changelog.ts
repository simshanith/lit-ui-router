import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { parseChangelog, preamble } from '@tools/changelog';
import MarkdownIt from 'markdown-it';
import * as v from 'valibot';
import type { PageData } from 'vitepress';

import {
  changelogPath,
  PACKAGES,
  type PackageName,
} from '../catalog/packages.ts';
import { mounts } from '../worker/releases/routes.ts';
import { releasesPath } from './release-stubs.ts';

/** Every package's changelog file, which the paths loader watches. */
export const CHANGELOG_GLOB = join(workspaceRoot, 'packages/*/CHANGELOG.md');

/** `<version> (<YYYY-MM-DD>)`, the heading `@tools/changelog` writes. */
const Heading = v.pipe(
  v.string(),
  v.regex(
    /^\d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)$/,
    'expected "<version> (<YYYY-MM-DD>)"',
  ),
);

/** One rendered section; its body is HTML that only `v-html` ever sees. */
export interface ChangelogSection {
  version: string;
  heading: string;
  /** `v<version>`: the heading id, and the page param holding the body. */
  anchor: string;
  /** The release page, unless the body already links it. */
  release?: string;
  html: string;
}

export interface ChangelogPage {
  name: PackageName;
  preambleHtml: string;
  sections: ChangelogSection[];
  /** The page as Markdown, for the llms outputs only. */
  markdown: string;
}

// GitHub release bodies: raw HTML passes through, bare URLs link.
const md = new MarkdownIt({ html: true, linkify: true });

const ORIGIN = 'https://lit-ui-router.dev';

const WORKER_MOUNTS = Object.keys(mounts);

/** A path the worker renders, which VitePress's client router must not take. */
const isWorkerPath = (path: string): boolean =>
  WORKER_MOUNTS.some((mount) => path === mount || path.startsWith(`${mount}/`));

// A link to the site stays on the deployment serving the page.
md.core.ruler.push('same-site-links', (state) => {
  for (const token of state.tokens) {
    for (const child of token.children ?? []) {
      const href = child.type === 'link_open' ? child.attrGet('href') : null;

      if (href === null || !href.startsWith(`${ORIGIN}/`)) continue;

      const path = href.slice(ORIGIN.length);

      child.attrSet('href', path);

      if (isWorkerPath(new URL(path, ORIGIN).pathname)) {
        child.attrSet('target', '_self');
      }
    }
  }
});

/** A release body as HTML, never compiled as a Vue template. */
export const renderBody = (body: string): string => md.render(body);

/** Each package's CHANGELOG.md, keyed by package name; a package without one has none yet. */
export function changelogFiles(): Map<string, string> {
  const dir = join(workspaceRoot, 'packages');

  return new Map(
    readdirSync(dir).flatMap((entry) => {
      const name = readManifest(join(dir, entry))?.name;
      const file = join(dir, entry, 'CHANGELOG.md');

      return name && existsSync(file) ? [[name, file] as const] : [];
    }),
  );
}

/** A package's page from its changelog text; a package with no file gets the fixed preamble and no sections. */
export function changelogPage(
  name: PackageName,
  text: string = preamble(name),
): ChangelogPage {
  const changelog = parseChangelog(text);
  const seen = new Set<string>();

  const sections = changelog.sections.map(({ version, heading, body }) => {
    const result = v.safeParse(Heading, heading);

    if (!result.success) {
      throw new Error(
        `${name} CHANGELOG.md: "## ${heading}": ${result.issues[0].message}`,
      );
    }

    if (seen.has(version)) {
      throw new Error(`${name} CHANGELOG.md: two ${version} sections`);
    }

    seen.add(version);

    const release = `${releasesPath(name)}${version}/`;

    const section: ChangelogSection = {
      version,
      heading,
      anchor: `v${version}`,
      html: renderBody(body),
    };

    if (!body.includes(release)) section.release = release;

    return section;
  });

  const intro = changelog.preamble.replace(/^# .*\n*/, '');

  return {
    name,
    preambleHtml: renderBody(intro),
    sections,
    markdown: [
      intro,
      ...changelog.sections.map(({ heading, body }) =>
        body ? `## ${heading}\n\n${body}` : `## ${heading}`,
      ),
    ].join('\n\n'),
  };
}

/**
 * The page's Markdown: headings and links only, every body a `v-html` of its
 * page param, and the Markdown copy behind a placeholder the llms plugin fills.
 */
export function changelogContent({ name, sections }: ChangelogPage): string {
  return [
    `# ${name} changelog`,
    '',
    '<llm-exclude>',
    '',
    '<div class="changelog-preamble" v-html="$params.preamble"></div>',
    '',
    ...sections.flatMap(({ heading, anchor, release }) => [
      `## ${heading} {#${anchor}}`,
      '',
      ...(release ? [`[Release page](${release}){target="_self"}`, ''] : []),
      `<div class="changelog-body" v-html="$params['${anchor}']"></div>`,
      '',
    ]),
    '</llm-exclude>',
    '',
    '<llm-only>',
    '',
    '{{ $params.llms }}',
    '',
    '</llm-only>',
    '',
  ].join('\n');
}

/** A package's page, read from its file in `files`. */
function readPage(
  name: PackageName,
  files: ReadonlyMap<string, string>,
): ChangelogPage {
  const file = files.get(name);

  return changelogPage(
    name,
    file === undefined ? undefined : readFileSync(file, 'utf8'),
  );
}

/** One dynamic route per package: its params carry the rendered bodies and the llms copy. */
export function changelogRoutes(
  files = changelogFiles(),
): { params: Record<string, string>; content: string }[] {
  return PACKAGES.map(({ name }) => {
    const page = readPage(name, files);

    return {
      params: {
        pkg: name,
        preamble: page.preambleHtml,
        llms: page.markdown,
        ...Object.fromEntries(
          page.sections.map(({ anchor, html }) => [anchor, html]),
        ),
      },
      content: changelogContent(page),
    };
  });
}

/** The heading ids a package's changelog page has, or `undefined` when the path is no changelog page. */
export function changelogAnchors(path: string): Set<string> | undefined {
  const entry = PACKAGES.find(({ name }) => changelogPath(name) === path);

  if (!entry) return undefined;

  return new Set(
    readPage(entry.name, changelogFiles()).sections.map(({ anchor }) => anchor),
  );
}

/** Drops the llms copy from the page data the client loads, and names the package in the description. */
export function changelogTransform({
  params = {},
  frontmatter,
}: Pick<PageData, 'params' | 'frontmatter'>): Partial<PageData> {
  const { llms: _llms, ...rest } = params;
  const description = `Every stable release of ${String(rest.pkg)}, newest first, with its release notes.`;

  return {
    params: rest,
    description,
    frontmatter: { ...frontmatter, description },
  };
}
