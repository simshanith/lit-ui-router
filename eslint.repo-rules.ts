// Local rules for manifest linting (see eslint.config.js).
import type { Rule } from 'eslint';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

interface Manifest {
  types?: Json;
  exports?: Json;
  scripts?: Record<string, string>;
}

// Minimal structural view of jsonc-eslint-parser's JSON AST; eslint's types
// speak ESTree, so nodes cross that boundary via casts.
interface JSONProperty {
  key: { value: string | number };
  value: JSONNode;
}
interface JSONNode {
  properties?: JSONProperty[];
}
interface JSONProgram {
  body: [{ expression?: JSONNode }?];
}

// A manifest advertises dist-resolved types when its `types` field, any
// exports leaf under a `types` condition, or any .d.ts exports leaf points
// into dist/.
const intoDist = (value: Json | undefined): value is string =>
  typeof value === 'string' && /^(\.\/)?dist\//.test(value);

const exportsAdvertiseDistTypes = (
  node: Json | undefined,
  underTypes = false,
): boolean => {
  if (typeof node === 'string') {
    return intoDist(node) && (underTypes || node.endsWith('.d.ts'));
  }
  if (node === null || typeof node !== 'object') return false;
  return Object.entries(node).some(([key, value]) =>
    exportsAdvertiseDistTypes(value, underTypes || key === 'types'),
  );
};

const advertisesDistTypes = (manifest: Manifest): boolean =>
  intoDist(manifest.types) || exportsAdvertiseDistTypes(manifest.exports);

const findProperty = (
  node: JSONNode | undefined,
  key: string,
): JSONProperty | undefined =>
  node?.properties?.find((property) => property.key.value === key);

const requireBuildTypes: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'dist-advertised types require a build:types script (typecheck/lint depend on ^build:types only)',
    },
    schema: [],
    messages: {
      missingBuildTypes:
        'dist-advertised types require a build:types script — typecheck/lint depend on ^build:types only, so without one dependents typecheck against a missing dist.',
    },
  },
  create(context) {
    return {
      Program(program) {
        let manifest: Manifest;
        try {
          manifest = JSON.parse(context.sourceCode.text) as Manifest;
        } catch {
          return;
        }
        if (!advertisesDistTypes(manifest)) return;
        // "builds at all" = build (single-pass) or build:js (pass-split)
        const builds =
          manifest.scripts?.build ?? manifest.scripts?.['build:js'];
        if (
          builds === undefined ||
          manifest.scripts?.['build:types'] !== undefined
        ) {
          return;
        }
        const root = (program as unknown as JSONProgram).body[0]?.expression;
        const scripts = findProperty(root, 'scripts');
        const build =
          findProperty(scripts?.value, 'build') ??
          findProperty(scripts?.value, 'build:js');
        context.report({
          node:
            ((build ?? scripts) as unknown as Rule.Node | undefined) ?? program,
          messageId: 'missingBuildTypes',
        });
      },
    };
  },
};

export default {
  rules: {
    'require-build-types': requireBuildTypes,
  },
};
