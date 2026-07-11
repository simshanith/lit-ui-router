export default {
  globs: ['src/ui-{router,view}.ts', 'src/ui-{router,view}.register.ts'],
  litelement: true,
  plugins: [
    {
      // Cross-module define() refs come out as '/src/x.js'; rewrite to the 'src/x.ts' module paths consumers (api-viewer) resolve against.
      name: 'resolve-definition-references',
      packageLinkPhase({ customElementsManifest }) {
        for (const mod of customElementsManifest.modules) {
          for (const exp of mod.exports ?? []) {
            if (
              exp.kind === 'custom-element-definition' &&
              exp.declaration.module
            ) {
              exp.declaration.module = exp.declaration.module
                .replace(/^\//, '')
                .replace(/\.js$/, '.ts');
            }
          }
        }
      },
    },
  ],
};
