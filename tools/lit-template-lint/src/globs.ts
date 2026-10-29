// The custom-element source set //#lint:templates analyzes; the custom-element
// override in .oxlintrc.json lists the same globs (globs.test.ts holds them
// together). lit-analyzer expands `**/` as matching zero directories, which
// keeps files sitting directly in `src/` in the set; a git pathspec drops them.
export const WORKSPACE_SRC_GLOB = '{packages,apps,examples}/*/src/**/*.ts';
