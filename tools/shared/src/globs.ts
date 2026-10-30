// The custom-element source set //#lint:templates analyzes and the
// @tools/lint-elements oxlint override covers; that package's globs.test.ts
// holds the two together. Every consumer expands `**/` as matching zero
// directories, which keeps files sitting directly in `src/` in the set; a git
// pathspec drops them.
export const WORKSPACE_SRC_GLOB = '{packages,apps,examples}/*/src/**/*.ts';
