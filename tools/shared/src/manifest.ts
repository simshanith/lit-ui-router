// The one way the tools read a package.json off disk: parse the bytes.
//
// Why a raw read, and not a resolver or a reader library — this keeps getting
// re-proposed, so the answers live here:
//
// - No static import can name the file. Every caller computes the path at
//   runtime (a cwd, a workspace member dir, a `node_modules/<alias>` dir), so
//   import attributes are out by construction.
// - `createRequire(import.meta.url)` anchors on THIS package, not the caller,
//   so it resolves the wrong `node_modules`. Re-anchoring it on the caller
//   (`createRequire(<cwd>/package.json)`) plus a bare `<pkg>/package.json`
//   specifier then dies with ERR_PACKAGE_PATH_NOT_EXPORTED on `lit-2`: lit's
//   exports map doesn't expose './package.json'. Verified, not theorized.
// - `@pnpm/workspace.project-manifest-reader` is the read-modify-WRITE half of
//   pack-staged.ts. It costs ~2.5-3x a compat guard's whole runtime to import
//   and drags a `@pnpm/logger` peer along for a read we never write back.
// - `pacote` is a registry client (~169ms just to import) for local bytes.
// - The YAML-fragility argument that earns the SDK its keep in ./workspace.ts
//   has no analogue here: JSON.parse over a package.json is exact and total.
//
// Sync on purpose. Every caller is a short-lived CLI or a test reading a few
// KB of local disk with nothing to overlap, and one shape beats two — the
// async callers already mix `existsSync` into the same functions.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PackageManifest } from './types.ts';

/** Parse `<dir>/package.json`; undefined when there is no such file. */
export function readManifest(dir: string): PackageManifest | undefined {
  const file = join(dir, 'package.json');
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    // absent is a caller-level answer; anything else (EACCES, EISDIR) is a bug
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    throw error;
  }
  try {
    return JSON.parse(source) as PackageManifest;
  } catch (error) {
    throw new Error(`${file}: not valid JSON`, { cause: error });
  }
}

/** Parse `<dir>/package.json`; throws a located error when there is no such file. */
export function requireManifest(dir: string): PackageManifest {
  const manifest = readManifest(dir);
  if (manifest === undefined) {
    throw new Error(`no package.json in ${dir}`);
  }
  return manifest;
}
