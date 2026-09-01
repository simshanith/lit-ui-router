// ESLint owns two lanes: manifests (package.json via eslint-plugin-package-json
// and eslint-plugin-pnpm, pnpm-workspace.yaml via eslint-plugin-pnpm) and the
// custom-element lane over src (eslint-plugin-lit / -wc / -lit-a11y).
// General-purpose JS/TS linting stays in oxlint (.oxlintrc.json).
import tsParser from '@tools/eslint-ts-parser';
import { WORKSPACE_SRC_GLOB } from '@tools/shared/globs.ts';
import { defineConfig, globalIgnores } from 'eslint/config';
import { configs as litConfigs } from 'eslint-plugin-lit';
import litA11y, {
  recommendedRules as litA11yRecommendedRules,
} from 'eslint-plugin-lit-a11y';
import oxlint from 'eslint-plugin-oxlint';
import packageJson from 'eslint-plugin-package-json';
import { configs as pnpmConfigs } from 'eslint-plugin-pnpm';
import { configs as wcConfigs } from 'eslint-plugin-wc';
import oxlintDirectiveStubs from './eslint.oxlint-directives.ts';
import repoRules from './eslint.repo-rules.ts';

export default defineConfig(
  globalIgnores([
    // build outputs (every output lives under a dist/ dir): parallel tasks
    // rewrite these mid-lint, so the **/package.json glob must never traverse them
    '**/dist/**',
    'docs/api/**',
    'tools/release/.cache/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/.vitepress/cache/**',
    '**/.claude/**',
  ]),
  {
    extends: [packageJson.configs.recommended],
    files: ['**/package.json'],
    rules: {
      'package-json/require-description': [
        'error',
        {
          ignorePrivate: true,
        },
      ],
    },
  },
  pnpmConfigs.json,
  pnpmConfigs.yaml,
  {
    files: ['**/package.json'],
    rules: {
      'pnpm/json-enforce-catalog': [
        'error',
        {
          // non-registry specs stay inline; npm: aliases belong in the catalog
          allowedProtocols: ['workspace', 'link', 'file', 'portal'],
          // report catalog-version conflicts instead of auto-creating a new catalog
          conflicts: 'error',
          fields: [
            'dependencies',
            'devDependencies',
            'peerDependencies',
            'optionalDependencies',
          ],
        },
      ],
      // autoInsert would fix a missing catalog entry by inventing ^0.0.0.
      'pnpm/json-valid-catalog': ['error', { autoInsert: false }],
    },
  },
  {
    // Root scripts must not execute another workspace package's files: the
    // owning package exposes a script and the root delegates (turbo run <task>
    // or pnpm --filter). scripts/** stays runnable — the root owns it.
    files: ['package.json'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSONProperty[key.value="scripts"] > JSONObjectExpression > JSONProperty > JSONLiteral[value=/\\b(?:node|tsx) +(?:\\.\\u002F)?(?:tools|packages|apps|docs|examples)\\u002F/]',
          message:
            "Cross-package execution: root scripts must not run another package's files with node/tsx. Add a script to the owning package and delegate via `turbo run <task>` (cached) or `pnpm --filter <pkg> run <script>` (uncached).",
        },
      ],
    },
  },
  {
    // The same boundary for every other package: scripts must not reach into
    // a sibling (or the root) by relative parent path. Own files run
    // directly; another package's entry points come through a workspace:*
    // dep's bin or a turbo/pnpm delegation.
    files: ['**/package.json'],
    ignores: ['package.json'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSONProperty[key.value="scripts"] > JSONObjectExpression > JSONProperty > JSONLiteral[value=/\\b(?:node|tsx) +\\.\\.\\u002F/]',
          message:
            'Cross-package execution: scripts must not run files outside their own package with node/tsx. Depend on the owning package (workspace:* bin) or delegate via `turbo run <task>` / `pnpm --filter <pkg> run <script>`.',
        },
      ],
    },
  },
  {
    // Shipped dep fields of publishable packages must not use workspace: refs:
    // pnpm's pack-substitution re-appends the substituted entry, breaking the
    // sorted published manifest. devDependencies is exempt (stripped at pack;
    // workspace:* is correct there), as are private manifests (never packed).
    files: ['packages/*/package.json'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSONObjectExpression:not(:has(> JSONProperty[key.value="private"][value.value=true])) > JSONProperty:matches([key.value="dependencies"], [key.value="peerDependencies"], [key.value="optionalDependencies"]) > JSONObjectExpression > JSONProperty > JSONLiteral[value=/^workspace:/]',
          message:
            'workspace: refs in shipped fields get pack-substituted with re-appended key order, breaking published-manifest sorting — use catalog:publishedPeer (or a version range) instead.',
        },
      ],
    },
  },
  {
    // Workspace members advertising dist-resolved types must pass-split their
    // build: turbo typecheck/lint depend on ^build:types only, so a dist-typed
    // package without one leaves dependents typechecking against a missing dist.
    // Src-exported types and buildless manifests are exempt by condition.
    files: [
      'packages/*/package.json',
      'apps/*/package.json',
      'tools/*/package.json',
      'docs/package.json',
      'examples/package.json',
    ],
    plugins: { repo: repoRules },
    rules: {
      'repo/require-build-types': 'error',
    },
  },
  {
    // examples/* are standalone `npm ci` projects (StackBlitz): inline versions required.
    files: ['examples/*/package.json'],
    rules: {
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      // name-only would flag the intentional publishedPeer/typescript6-compat/vitepress1 pins.
      'pnpm/yaml-no-duplicate-catalog-item': [
        'error',
        { checkDuplicates: 'exact-version' },
      ],
    },
  },
  {
    // Custom-element lane. lit-analyzer (//#lint:templates) gates template
    // *correctness* — unknown tags/attributes/properties/events — and is blind
    // to lifecycle and reactivity semantics: deleting a @property leaves it
    // green. These three plugins cover that blind spot from the class AST.
    files: [WORKSPACE_SRC_GLOB],
    extends: [
      litConfigs['flat/recommended'],
      // best-practice over recommended. Note require-listener-teardown scores
      // zero coverage here despite being the rule closest to this router's
      // lifecycle: it only reads addEventListener calls lexically inside
      // connectedCallback, with a string-literal event name. Every site in
      // packages/lit-ui-router breaks one of those — the names come from
      // `this.constructor.*` statics, and seekRouter() adds from a helper. It
      // is on as a guard against future code written in the shape it can see.
      wcConfigs['flat/best-practice'],
      litA11y.configs.recommended,
    ],
    languageOptions: {
      parser: tsParser,
      // Syntax-only: every rule here is class/template AST, so no project
      // service and no type information — that keeps the lane seconds, not minutes.
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: oxlintDirectiveStubs,
    linterOptions: {
      // oxlint owns the inline directives in these files, so ESLint cannot
      // judge whether one is unused.
      reportUnusedDisableDirectives: 'off',
    },
    settings: {
      // wc infers element base classes by resolving `lit` from cwd; the root has
      // no lit dep, so without this every LitElement subclass that registers via
      // a sibling *.register.ts (rather than a @customElement decorator) —
      // including <ui-view> and <ui-router> — is invisible to the whole plugin.
      wc: { elementBaseClasses: ['LitElement'] },
    },
    rules: {
      // Reactivity/lifecycle correctness, beyond flat/recommended.
      'lit/lifecycle-super': 'error',
      'lit/no-legacy-imports': 'error',
      // Owned by lit-analyzer's no-unknown-attribute/-property under
      // ts-lit-plugin, which resolves against real element types.
      'lit/attribute-names': 'off',
      'lit/no-native-attributes': 'off',
      // Every element here descends from LitElement, which always implements the
      // lifecycle callbacks and documents the unguarded `super.connectedCallback()`
      // call as required; the rule's premise (base may not implement them) holds
      // only for mixins over a bare HTMLElement.
      'wc/guard-super-call': 'off',
      // Constructor injection (`new Component(props)`) is a documented
      // lit-ui-router API — see RoutedLitElement in packages/lit-ui-router.
      'wc/no-constructor-params': 'off',
      // Deliberately not adopted (it ships outside best-practice): file
      // organisation, not element semantics — ~20 hits, no defect behind any.
      'wc/no-exports-with-element': 'off',
    },
  },
  {
    // Demo/docs surfaces, not shipped UI: a11y findings here are worth seeing
    // but must not gate the library's lint. packages/* stay at error.
    files: ['apps/*/src/**/*.ts', 'examples/*/src/**/*.ts'],
    rules: Object.fromEntries(
      Object.entries(litA11yRecommendedRules).map(([rule, severity]) => [
        rule,
        severity === 'off' ? 'off' : 'warn',
      ]),
    ),
  },
  {
    // Test fixtures: elements exist to be driven, not shipped, and their
    // templates are assertion inputs rather than UI.
    files: ['**/*.spec.ts', '**/src/specs/**/*.ts'],
    rules: Object.fromEntries(
      Object.keys(litA11yRecommendedRules).map((rule) => [rule, 'off']),
    ),
  },
  // Keep last: disables any rules oxlint already enforces.
  oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
);
