// Content attribute types from the web platform's IDL as W3C webref publishes
// it: an IDL attribute marked [Reflect] (or a variant) reflects the content
// attribute of its lowercased name, or the one its right-hand side names.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { type IDLTypeDescription, parse } from 'webidl2';

export type ReflectedType = 'boolean' | 'number' | 'string';

const REFLECT = new Set([
  'Reflect',
  'ReflectSetter',
  'ReflectURL',
  'ReflectNonNegative',
  'ReflectPositive',
  'ReflectPositiveWithFallback',
]);

const NUMERIC = new Set([
  'byte',
  'octet',
  'short',
  'unsigned short',
  'long',
  'unsigned long',
  'long long',
  'unsigned long long',
  'float',
  'unrestricted float',
  'double',
  'unrestricted double',
]);

const require = createRequire(import.meta.url);

const idlDir = dirname(require.resolve('@webref/idl/package.json'));

// SAFETY: the package's documented elements format, read as shipped
const { elements } = require('@webref/elements/html.json') as {
  elements: { name: string; interface?: string }[];
};

const typeOf = (type: IDLTypeDescription): ReflectedType => {
  if (type.union || type.generic !== '') return 'string';

  if (type.idlType === 'boolean') return 'boolean';

  return NUMERIC.has(type.idlType) ? 'number' : 'string';
};

const own = new Map<string, Map<string, ReflectedType>>();

const parents = new Map<string, string>();

const mixins = new Map<string, string[]>();

const definitions = readdirSync(idlDir)
  .filter((file) => file.endsWith('.idl'))
  .map((file) => readFileSync(join(idlDir, file), 'utf8'))
  .filter((text) => text.includes('Reflect'))
  .flatMap((text) => parse(text));

for (const definition of definitions) {
  if (definition.type === 'includes') {
    const { target, includes } = definition;

    mixins.set(target, [...(mixins.get(target) ?? []), includes]);
    continue;
  }

  if (
    definition.type !== 'interface' &&
    definition.type !== 'interface mixin'
  ) {
    continue;
  }

  if (definition.inheritance) {
    parents.set(definition.name, definition.inheritance);
  }

  const members = own.get(definition.name) ?? new Map<string, ReflectedType>();

  own.set(definition.name, members);

  for (const member of definition.members) {
    if (member.type !== 'attribute') continue;
    const reflect = member.extAttrs.find(({ name }) => REFLECT.has(name));

    if (!reflect) continue;

    const named =
      reflect.rhs?.type === 'string' ? reflect.rhs.value : undefined;

    members.set(
      named?.replace(/^"|"$/g, '') ?? member.name.toLowerCase(),
      typeOf(member.idlType),
    );
  }
}

const resolved = new Map<string, ReadonlyMap<string, ReflectedType>>();

function reflectedBy(name: string): ReadonlyMap<string, ReflectedType> {
  let types = resolved.get(name);

  if (types) return types;
  const parent = parents.get(name);

  types = new Map([
    ...(parent ? reflectedBy(parent) : []),
    ...(mixins.get(name) ?? []).flatMap((mixin) => [...reflectedBy(mixin)]),
    ...(own.get(name) ?? []),
  ]);
  resolved.set(name, types);

  return types;
}

const byTag = new Map(
  elements.map((element) => [
    element.name,
    reflectedBy(element.interface ?? 'HTMLElement'),
  ]),
);

/** The IDL type of the attribute reflecting `name` on the tag's interface. */
export function reflectedType(
  tag: string,
  name: string,
): ReflectedType | undefined {
  return (byTag.get(tag) ?? reflectedBy('HTMLElement')).get(name);
}
