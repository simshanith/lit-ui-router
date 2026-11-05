// Built-in attribute value types: an enumerated attribute's keywords from the
// @vscode/web-custom-data value sets, else the type of the IDL attribute that
// reflects it (./reflected.ts).
import { createRequire } from 'node:module';

import { PRELUDE_NAMESPACE as NS } from './prelude.ts';
import { reflectedType } from './reflected.ts';

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

// a valid navigable target name or keyword: the set lists only the keywords
const OPEN_VALUE_SETS = new Set(['target']);

const union = (values: readonly string[]) =>
  values.map((value) => JSON.stringify(value)).join(' | ');

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

const keywordsOf = ({
  valueSet,
  values,
}: DataAttribute): string | undefined => {
  if (valueSet === undefined) {
    return values && union(values.map((value) => value.name));
  }

  return OPEN_VALUE_SETS.has(valueSet) ? undefined : valueSets.get(valueSet);
};

const byName = (attributes: DataAttribute[]) =>
  new Map(
    attributes.flatMap((attribute) => {
      const keywords = keywordsOf(attribute);

      return keywords === undefined
        ? []
        : [[attribute.name, keywords] as const];
    }),
  );

const globalKeywords = byName(data.globalAttributes);

const tagKeywords = new Map(
  data.tags.map((tag) => [tag.name, byName(tag.attributes)]),
);

// WAI-ARIA: role takes a space-separated list of tokens, the first valid one applies
const ROLE = `${NS}.Tokens<${valueSets.get('roles')}>`;

// HTML: download may have a value, a default file name
const DOWNLOAD = 'boolean | string';

/** Tags the html data describes. */
export const BUILT_IN_TAGS: ReadonlySet<string> = new Set(tagKeywords.keys());

/** The type an attribute value must fit, as TypeScript type text, if the data has one. */
export function attributeType(tag: string, name: string): string | undefined {
  if (name === 'role') return ROLE;

  if (name === 'download' && reflectedType(tag, name)) return DOWNLOAD;

  return (
    tagKeywords.get(tag)?.get(name) ??
    globalKeywords.get(name) ??
    reflectedType(tag, name)
  );
}
