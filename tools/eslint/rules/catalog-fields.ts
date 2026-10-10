// The `repo/catalog-fields` rule: which catalogs each manifest field may name
// (see eslint.config.ts). Published ranges live in `published*` catalogs and
// only ever reach shipped fields; `peerFloor*` pins only reach devDependencies.
import type { Rule } from 'eslint';

const SHIPPED_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

const FIELDS = [...SHIPPED_FIELDS, 'devDependencies'] as const;

// Minimal structural view of jsonc-eslint-parser's JSON AST; eslint's types
// speak ESTree, so nodes cross that boundary via casts.
interface JSONProperty {
  key: { value: string | number };
  value: JSONNode;
}

interface JSONNode {
  // a literal's value; objects and arrays carry none
  value?: string | number | boolean | null;
  properties?: JSONProperty[];
}

interface JSONProgram {
  body: [{ expression?: JSONNode }?];
}

const findProperty = (
  node: JSONNode | undefined,
  key: string,
): JSONProperty | undefined =>
  node?.properties?.find((property) => property.key.value === key);

const isPrivate = (root: JSONNode | undefined): boolean =>
  findProperty(root, 'private')?.value.value === true;

const catalogName = (spec: JSONNode['value']): string | undefined =>
  typeof spec === 'string' ? /^catalog:(.*)$/.exec(spec)?.[1] : undefined;

const messageFor = (
  catalog: string | undefined,
  shipped: boolean,
  published: boolean,
) => {
  const publishedCatalog = catalog?.startsWith('published') === true;

  if (shipped && published && !publishedCatalog) return 'shippedNotPublished';

  if (publishedCatalog && !(shipped && published)) {
    return 'publishedOutsideShipped';
  }

  if (catalog?.startsWith('peerFloor') && shipped) {
    return 'floorOutsideDevDependencies';
  }

  return undefined;
};

const catalogFields: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'published* catalogs feed only shipped fields of published packages, which take nothing else; peerFloor* catalogs feed only devDependencies',
    },
    schema: [],
    messages: {
      shippedNotPublished:
        '{{field}} of a published package must name a published* catalog (publishedPeer, publishedPeer<Pkg>, publishedDependencies) — anything else ships a range no published catalog owns.',
      publishedOutsideShipped:
        'catalog:{{catalog}} holds published ranges; name it only from dependencies, peerDependencies or optionalDependencies of a published (non-private) package.',
      floorOutsideDevDependencies:
        'catalog:{{catalog}} pins a peer floor; name it only from devDependencies.',
    },
  },
  create(context) {
    return {
      Program(program) {
        const root = (program as unknown as JSONProgram).body[0]?.expression;
        const published = !isPrivate(root);

        for (const field of FIELDS) {
          const shipped = (SHIPPED_FIELDS as readonly string[]).includes(field);

          for (const entry of findProperty(root, field)?.value.properties ??
            []) {
            const catalog = catalogName(entry.value.value);
            const messageId = messageFor(catalog, shipped, published);

            if (messageId === undefined) continue;
            context.report({
              node: entry.value as unknown as Rule.Node,
              messageId,
              data: { field, catalog: catalog ?? '' },
            });
          }
        }
      },
    };
  },
};

export { catalogFields };
