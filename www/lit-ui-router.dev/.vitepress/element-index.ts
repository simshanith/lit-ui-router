import { globSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import * as v from 'valibot';

import { API_REFERENCES } from '../catalog/references.ts';
import type { PackageName } from '../catalog/packages.ts';
import { code } from './index-markdown.ts';

const Named = v.object({ name: v.string() });

const Member = v.object({
  name: v.string(),
  kind: v.string(),
  privacy: v.optional(v.string()),
});

const Declaration = v.object({
  name: v.string(),
  customElement: v.optional(v.boolean()),
  summary: v.optional(v.string()),
  description: v.optional(v.string()),
  members: v.optional(v.array(Member), []),
  attributes: v.optional(v.array(Named), []),
  events: v.optional(v.array(Named), []),
  slots: v.optional(v.array(Named), []),
  cssParts: v.optional(v.array(Named), []),
  cssProperties: v.optional(v.array(Named), []),
});

const Export = v.object({
  kind: v.string(),
  name: v.string(),
  declaration: v.object({
    name: v.string(),
    module: v.optional(v.string()),
  }),
});

/** The parts of a Custom Elements Manifest the element list reads. */
export const Manifest = v.object({
  modules: v.array(
    v.object({
      path: v.string(),
      declarations: v.optional(v.array(Declaration), []),
      exports: v.optional(v.array(Export), []),
    }),
  ),
});

export type Manifest = v.InferOutput<typeof Manifest>;

/** A custom element as the manifest records it: public members only, as the viewer shows them. */
export interface ElementSummary {
  tag: string;
  className: string;
  summary: string | undefined;
  /** Each non-empty kind of member, in the viewer's tab order. */
  members: { label: string; names: string[] }[];
}

const isPublic = ({ privacy }: v.InferOutput<typeof Member>): boolean =>
  privacy !== 'private' && privacy !== 'protected';

/** A doc comment's first paragraph on one line; the analyzer writes inline code as HTML. */
const firstParagraph = (text: string | undefined): string | undefined =>
  text
    ?.trim()
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ') || undefined;

/** Every element the manifest defines, in definition order. */
export function elementsOf(manifest: Manifest): ElementSummary[] {
  return manifest.modules.flatMap(({ exports }) =>
    exports.flatMap(({ kind, name: tag, declaration }) => {
      if (kind !== 'custom-element-definition') return [];

      const declared = manifest.modules
        .filter(
          ({ path }) => !declaration.module || path === declaration.module,
        )
        .flatMap(({ declarations }) => declarations)
        .find(
          ({ name, customElement }) =>
            customElement && name === declaration.name,
        );

      if (!declared) {
        throw new Error(
          `<${tag}>: the manifest has no declaration of ${declaration.name}`,
        );
      }

      const members = declared.members.filter(isPublic);

      const kinds = [
        ['Properties', members.filter(({ kind }) => kind === 'field')],
        ['Attributes', declared.attributes],
        ['Methods', members.filter(({ kind }) => kind === 'method')],
        ['Slots', declared.slots],
        ['Events', declared.events],
        ['CSS custom properties', declared.cssProperties],
        ['CSS shadow parts', declared.cssParts],
      ] as const;

      return [
        {
          tag,
          className: declared.name,
          summary: firstParagraph(declared.summary ?? declared.description),
          members: kinds.flatMap(([label, entries]) =>
            entries.length > 0
              ? [{ label, names: entries.map((entry) => entry.name) }]
              : [],
          ),
        },
      ];
    }),
  );
}

/** The link of a class's page in a package's API reference, or `undefined` when the reference has none. */
export type ClassLink = (className: string) => string | undefined;

/** One list item per element: its tag, class and summary, then the names of each kind of member. */
export function elementList(
  elements: readonly ElementSummary[],
  classLink: ClassLink = () => undefined,
): string {
  return elements
    .map(({ tag, className, summary, members }) => {
      const link = classLink(className);
      const name = link ? `[${code(className)}](${link})` : code(className);

      return [
        `- **${code(`<${tag}>`)}** (${name})${summary ? ` — ${summary}` : ''}`,
        ...members.map(
          ({ label, names }) =>
            // An unnamed slot is the default one.
            `  - ${label}: ${names.map((name) => (name ? code(name) : 'default')).join(', ')}`,
        ),
      ].join('\n');
    })
    .join('\n');
}

const SITE = join(import.meta.dirname, '..');

const require = createRequire(import.meta.url);

/** The manifest a package ships as `<name>/custom-elements.json`, read from its build. */
export const readManifest = (name: PackageName): Manifest =>
  v.parse(
    Manifest,
    JSON.parse(
      readFileSync(require.resolve(`${name}/custom-elements.json`), 'utf8'),
    ),
  );

/** Finds a class's page among those docs:api wrote for a package. */
export const referenceClassLink =
  (name: PackageName): ClassLink =>
  (className) => {
    const reference = API_REFERENCES[name];

    const [page] = reference
      ? globSync(`${reference.slice(1)}**/${className}.md`, { cwd: SITE })
      : [];

    return page && `/${page.replace(/\.md$/, '')}`;
  };

/** The elements `lit-ui-router` defines, from the manifest it ships. */
export const elementIndex = (): string =>
  elementList(
    elementsOf(readManifest('lit-ui-router')),
    referenceClassLink('lit-ui-router'),
  );
