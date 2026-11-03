// The define plugin's dead-code pass drops an import's unused bindings but keeps
// the statement for its side effects; bundlers then flag that bare import
// against the package's `sideEffects`. See check-dev-split.ts for the gate.
import { parseSync } from 'oxc-parser';

const bareImports = (file: string, code: string) =>
  parseSync(file, code, { lang: 'js' }).module.staticImports.filter(
    ({ entries }) => entries.length === 0,
  );

/**
 * Blank each bare import in `folded` that `unfolded` (the same source emitted
 * without `define`) imports by name. Blanking keeps every offset, so the
 * transform's source map stays valid for the minify pass that prints it away.
 */
export function dropFoldedImports(
  file: string,
  folded: string,
  unfolded: string,
): string {
  const kept = new Set(
    bareImports(file, unfolded).map(({ moduleRequest }) => moduleRequest.value),
  );

  return bareImports(file, folded)
    .filter(({ moduleRequest }) => !kept.has(moduleRequest.value))
    .reduce(
      (code, { start, end }) =>
        code.slice(0, start) +
        code.slice(start, end).replace(/[^\n]/g, ' ') +
        code.slice(end),
      folded,
    );
}
