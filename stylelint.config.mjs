// .mjs: cosmiconfig loads a .ts config through the TypeScript JS API, which TS 7 lacks.
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-recommended'],
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  // .gitignore's generated trees; sibling lanes write and delete these mid-graph.
  ignoreFiles: [
    '**/dist/**',
    '**/tmp/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/coverage-effect3/**',
    '**/.turbo/**',
    '**/.cache/**',
    '**/.vitest/**',
    '**/.wrangler/**',
    '**/.claude/**',
    '**/.cloudflare/**',
    '**/*.d.ts',
    'tools/dts-backtest/.probe-scratch/**',
    'apps/sample-app-lit-e2e/cypress/**',
    'www/lit-ui-router.dev/.vitepress/cache/**',
    'www/lit-ui-router.dev/.vitepress/.temp/**',
    'www/lit-ui-router.dev/api/**',
  ],
  rules: {
    'function-no-unknown': true,
    'no-descending-specificity': null,
  },
  overrides: [
    {
      files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
      customSyntax: 'postcss-lit',
    },
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
      rules: {
        'selector-pseudo-class-no-unknown': [
          true,
          { ignorePseudoClasses: ['deep', 'global', 'slotted'] },
        ],
      },
    },
  ],
};
