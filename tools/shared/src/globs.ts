// The custom-element source set, shared so eslint.config.ts, `//#lint:elements`
// and `//#lint:templates` cannot disagree on it: a lane reaching wider than the
// rule block exits 2 on the first uncovered file, narrower goes quietly green.
// Every consumer expands `**/` as matching zero directories, which keeps files
// sitting directly in `src/` in the set; a git pathspec drops them.
export const WORKSPACE_SRC_GLOB = '{packages,apps,examples}/*/src/**/*.ts';
