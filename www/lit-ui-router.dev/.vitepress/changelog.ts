import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { parseChangelog, preamble } from '@tools/changelog';
import MarkdownIt from 'markdown-it';
import * as v from 'valibot';
import type { Plugin } from 'vite';

import { PACKAGES } from '../catalog/packages.ts';
import {
  notesAsset,
  type ReleaseNote,
  type ReleaseNotes,
} from '../worker/releases/notes.ts';
import { mounts } from '../worker/releases/routes.ts';

/** `<version> (<YYYY-MM-DD>)`, the heading `@tools/changelog` writes. */
const Heading = v.pipe(
  v.string(),
  v.regex(
    /^\d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)$/,
    'expected "<version> (<YYYY-MM-DD>)"',
  ),
);

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

/** A release body as HTML, as GitHub renders it. */
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

/** A package's changelog text; a package with no file has the fixed preamble and no sections. */
export const changelogText = (
  name: string,
  files: ReadonlyMap<string, string> = changelogFiles(),
): string => {
  const file = files.get(name);

  return file === undefined ? preamble(name) : readFileSync(file, 'utf8');
};

/** Every section of a changelog rendered, by version, newest first; throws on a heading off the contract or a repeated version. */
export function releaseNotes(name: string, text: string): ReleaseNotes {
  const notes: Record<string, ReleaseNote> = {};

  for (const { version, heading, body } of parseChangelog(text).sections) {
    const result = v.safeParse(Heading, heading);

    if (!result.success) {
      throw new Error(
        `${name} CHANGELOG.md: "## ${heading}": ${result.issues[0].message}`,
      );
    }

    if (Object.hasOwn(notes, version)) {
      throw new Error(`${name} CHANGELOG.md: two ${version} sections`);
    }

    notes[version] = { date: heading.slice(-11, -1), html: renderBody(body) };
  }

  return notes;
}

/** Where the build copies a package's CHANGELOG.md for llms.txt: a static file outside every page and mount. */
export const changelogMarkdownPath = (name: string): string =>
  `/changelogs/${name}.md`;

/** The files the build emits per catalog package: its rendered notes for the worker, and its changelog as Markdown for llms.txt. */
export function changelogAssets(
  files: ReadonlyMap<string, string> = changelogFiles(),
): { fileName: string; source: string }[] {
  return PACKAGES.flatMap(({ name }) => {
    const text = changelogText(name, files);

    return [
      {
        fileName: notesAsset(name).slice(1),
        source: JSON.stringify(releaseNotes(name, text)),
      },
      { fileName: changelogMarkdownPath(name).slice(1), source: text },
    ];
  });
}

/** Emits each package's rendered notes and Markdown changelog with the client build. */
export function changelogAssetsPlugin(): Plugin {
  return {
    name: 'changelog-assets',
    apply: (_config, { command, isSsrBuild }) =>
      command === 'build' && !isSsrBuild,
    generateBundle() {
      for (const { fileName, source } of changelogAssets()) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}
