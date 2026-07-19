// Local rules for manifest linting (see eslint.config.js).

// A manifest advertises dist-resolved types when its `types` field, any
// exports leaf under a `types` condition, or any .d.ts exports leaf points
// into dist/.
const intoDist = (value) =>
  typeof value === 'string' && /^(\.\/)?dist\//.test(value);

const exportsAdvertiseDistTypes = (node, underTypes = false) => {
  if (typeof node === 'string') {
    return intoDist(node) && (underTypes || node.endsWith('.d.ts'));
  }
  if (node === null || typeof node !== 'object') return false;
  return Object.entries(node).some(([key, value]) =>
    exportsAdvertiseDistTypes(value, underTypes || key === 'types'),
  );
};

const advertisesDistTypes = (manifest) =>
  intoDist(manifest.types) || exportsAdvertiseDistTypes(manifest.exports);

// jsonc-eslint-parser AST: Program > JSONExpressionStatement > JSONObjectExpression
const findProperty = (objectExpression, key) =>
  objectExpression?.properties?.find((property) => property.key.value === key);

const requireBuildTypes = {
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
        let manifest;
        try {
          manifest = JSON.parse(context.sourceCode.text);
        } catch {
          return;
        }
        if (!advertisesDistTypes(manifest)) return;
        // "builds at all" = build (single-pass) or build:js (pass-split)
        const builds =
          manifest.scripts?.build || manifest.scripts?.['build:js'];
        if (!builds || manifest.scripts['build:types']) return;
        const root = program.body[0]?.expression;
        const scripts = findProperty(root, 'scripts');
        const build =
          findProperty(scripts?.value, 'build') ??
          findProperty(scripts?.value, 'build:js');
        context.report({
          node: build ?? scripts ?? program,
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
