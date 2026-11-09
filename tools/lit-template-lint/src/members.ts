// lit-analyzer's component rules: property visibility and converter types, attribute and tag names.
import { createHash } from 'node:crypto';

import { BUILT_IN_TAGS } from './html-data.ts';
import type { Insertion } from './lower.ts';
import { PRELUDE_NAMESPACE as NS } from './prelude.ts';
import type { Definition, Member, ObservedAttribute } from './sites.ts';

/** A finding with no template position, so no template comment covers it. */
export interface ClassFinding {
  start: number;
  rule:
    | 'property-visibility'
    | 'property-type'
    | 'invalid-attribute-name'
    | 'invalid-tag-name';
  text: string;
}

const CONVERTER_TYPES = new Set([
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
]);

// the html spec's illegal attribute name characters, and the noncharacters
const ILLEGAL_NAME = /[ "'>/=￿￾﷐-﷯]/;

const isValidAttributeName = (name: string) => !ILLEGAL_NAME.test(name);

const isValidTagName = (tag: string) =>
  tag.includes('-') && tag.toLowerCase() === tag && isValidAttributeName(tag);

function visibilityFinding(member: Member): ClassFinding | undefined {
  if (
    member.decorator === 'internalProperty' &&
    member.visibility === 'public'
  ) {
    return {
      start: member.start,
      rule: 'property-visibility',
      text: `'${member.name}' is marked as an internal property (@internalProperty) but is publicly accessible.`,
    };
  }

  if (member.decorator === 'property' && member.visibility !== 'public') {
    return {
      start: member.start,
      rule: 'property-visibility',
      text: `'${member.name}' is not publicly accessible but is marked as a public property (@property).`,
    };
  }

  return undefined;
}

export function classFindings(
  members: Member[],
  observed: ObservedAttribute[],
  definitions: Definition[],
): ClassFinding[] {
  const findings: ClassFinding[] = [];
  const attributes = [...observed];

  for (const member of members) {
    const visibility = visibilityFinding(member);

    if (visibility) findings.push(visibility);
    const { type, attribute } = member;

    if (attribute) attributes.push(attribute);

    if (
      member.decorator === 'property' &&
      type &&
      'literal' in type &&
      !member.converter
    ) {
      findings.push({
        start: member.start,
        rule: 'property-type',
        text: `'${type.literal}' is not a valid type for the default converter.`,
      });
    }
  }

  for (const { name, start } of attributes) {
    if (!isValidAttributeName(name)) {
      findings.push({
        start,
        rule: 'invalid-attribute-name',
        text: `'${name}' is not a valid attribute name.`,
      });
    }
  }

  for (const { tag, tagStart } of definitions) {
    if (tag !== '' && !isValidTagName(tag) && !BUILT_IN_TAGS.has(tag)) {
      findings.push({
        start: tagStart,
        rule: 'invalid-tag-name',
        text: `The tag name '${tag}' is not a valid custom element name. Remember that a hyphen (-) is required.`,
      });
    }
  }

  return findings;
}

/** `@property` converter checks, spliced in before each class's closing brace. */
export function propertyInsertions(
  path: string,
  members: Member[],
): Insertion[] {
  // unique across files, so a subclass check never overrides its base's
  const file = createHash('sha1').update(path).digest('hex').slice(0, 8);

  return members.flatMap((member) => {
    if (member.decorator !== 'property' || member.static || member.abstract) {
      return [];
    }

    if (member.converter) return [];
    const { type } = member;
    let kind: string;

    if (type === undefined) {
      if (member.noAttribute) return [];
      kind = 'none';
    } else if ('name' in type && CONVERTER_TYPES.has(type.name)) {
      kind = type.name;
    } else return [];

    const name = JSON.stringify(member.name);

    return [
      {
        at: member.classEnd,
        originalStart: member.start,
        rule: 'property-type',
        text: `__ltc_${file}_${member.start}?(): void { ${NS}.propertyType(${JSON.stringify(kind)}, ${name}, this.${member.name}, true); }\n`,
      },
    ];
  });
}
