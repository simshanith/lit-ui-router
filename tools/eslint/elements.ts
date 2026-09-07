// Suppressed on purpose, to keep the workaround visible: delete both lines
// the day eslint-plugin-lit-a11y ships its own declarations.
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./eslint-plugins.d.ts" />
// The custom-element lane: eslint-plugin-lit / -wc / -lit-a11y over workspace
// src, composed into the root eslint.config.ts.
//
// eslint-plugin-lit-a11y ships no declarations, and an ambient declaration is
// only in scope for a program that names the file. The reference above carries
// it into every program that compiles this one — this package's own typecheck
// and the root's, which reaches here through eslint.config.ts.

import tsParser from '@tools/eslint-ts-parser';
import { WORKSPACE_SRC_GLOB } from '@tools/shared/globs.ts';
import { defineConfig } from 'eslint/config';
import { configs as litConfigs } from 'eslint-plugin-lit';
import litA11y, {
  recommendedRules as litA11yRecommendedRules,
} from 'eslint-plugin-lit-a11y';
import { configs as wcConfigs } from 'eslint-plugin-wc';

import oxlintDirectiveStubs from './oxlint-directives.ts';

export default defineConfig(
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
    plugins: { ...oxlintDirectiveStubs },
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
      // Displaced by lit-ui-router/anchor-is-valid, which oxlint runs via
      // .oxlintrc.json jsPlugins. eslint-plugin-oxlint's config reader only
      // knows oxlint's native rule names, so it cannot de-duplicate a JS-plugin
      // rule — this `off` is the manual half of the split.
      'lit-a11y/anchor-is-valid': 'off',
    },
  },
  {
    // Demo/docs surfaces, not shipped UI: a11y findings here are worth seeing
    // but must not gate the library's lint. packages/* stay at error.
    files: ['apps/*/src/**/*.ts', 'examples/*/src/**/*.ts'],
    rules: {
      ...Object.fromEntries(
        Object.entries(litA11yRecommendedRules).map(([rule, severity]) => [
          rule,
          severity === 'off' ? 'off' : 'warn',
        ]),
      ),
      // The map above would switch the displaced rule back on; oxlint owns it.
      'lit-a11y/anchor-is-valid': 'off',
    },
  },
  {
    // Test fixtures: elements exist to be driven, not shipped, and their
    // templates are assertion inputs rather than UI.
    files: ['**/*.spec.ts', '**/src/specs/**/*.ts'],
    rules: {
      ...Object.fromEntries(
        Object.keys(litA11yRecommendedRules).map((rule) => [rule, 'off']),
      ),
    },
  },
);
