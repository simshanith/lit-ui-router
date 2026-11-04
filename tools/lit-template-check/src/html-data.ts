// Built-in attribute value types as lit-analyzer derives them: the
// @vscode/web-custom-data value sets, with its own table laid over them.
import { createRequire } from 'node:module';

import { ATTRIBUTE_TYPES } from './attribute-types.ts';
import { PRELUDE_NAMESPACE as NS } from './prelude.ts';

interface DataAttribute {
  name: string;
  valueSet?: string;
  values?: { name: string }[];
}

interface HtmlData {
  tags: { name: string; attributes: DataAttribute[] }[];
  globalAttributes: DataAttribute[];
  valueSets: { name: string; values: { name: string }[] }[];
}

// SAFETY: the package's documented html-data format, read as shipped
const data = createRequire(import.meta.url)(
  '@vscode/web-custom-data/data/browsers.html-data.json',
) as HtmlData;

// lit-analyzer's additions to the vscode data
const EXTRA_TAG_ATTRIBUTES = new Map<string, DataAttribute[]>([
  ['audio', [{ name: 'controlslist' }]],
  [
    'video',
    [
      { name: 'controlslist' },
      { name: 'disablepictureinpicture', valueSet: 'v' },
      { name: 'playsinline', valueSet: 'v' },
    ],
  ],
]);

const EXTRA_GLOBAL_ATTRIBUTES = [
  'tabindex',
  'slot',
  'part',
  'theme',
  'exportparts',
];

const union = (values: readonly string[]) =>
  values.map((value) => JSON.stringify(value)).join(' | ');

function tableType(name: string): string | undefined {
  const spec = ATTRIBUTE_TYPES.get(name);

  if (spec === undefined) return undefined;

  if ('type' in spec) return spec.type.split('|').join(' | ');

  return 'tokens' in spec
    ? `${NS}.Tokens<${union(spec.tokens)}>`
    : union(spec.values);
}

const valueSets = new Map<string, string>(
  data.valueSets.map(({ name, values }) => [
    name,
    union([
      ...(name === 'inputautocomplete' ? ['on', 'off'] : []),
      ...values.map((value) => value.name),
    ]),
  ]),
);

valueSets.set('v', 'boolean');

// a table entry wins; an attribute the data leaves untyped takes the table's
function typeOf({ name, valueSet, values }: DataAttribute): string | undefined {
  const fromData =
    valueSet === undefined
      ? values && union(values.map((value) => value.name))
      : valueSets.get(valueSet);

  return tableType(name) ?? fromData;
}

const typesOf = (attributes: DataAttribute[]) => {
  const types = new Map<string, string>();

  for (const attribute of attributes) {
    const type = typeOf(attribute);

    if (type !== undefined && !types.has(attribute.name)) {
      types.set(attribute.name, type);
    }
  }

  return types;
};

const globalTypes = typesOf([
  ...data.globalAttributes,
  ...EXTRA_GLOBAL_ATTRIBUTES.map((name) => ({ name })),
]);

const tagTypes = new Map(
  data.tags.map((tag) => [
    tag.name,
    typesOf([...tag.attributes, ...(EXTRA_TAG_ATTRIBUTES.get(tag.name) ?? [])]),
  ]),
);

/** Tags the html data describes. */
export const BUILT_IN_TAGS: ReadonlySet<string> = new Set(tagTypes.keys());

/** The type an attribute value must fit, as TypeScript type text, if the data has one. */
export function attributeType(tag: string, name: string): string | undefined {
  return tagTypes.get(tag)?.get(name) ?? globalTypes.get(name);
}
