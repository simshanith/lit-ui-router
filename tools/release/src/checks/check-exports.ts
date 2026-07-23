#!/usr/bin/env node
// Guard publishable packages against shipping an exports/types map that does
// not resolve in the packed tarball — the payload/exports-map class that the
// field-level check:pack and the baseline-comparing check:published-diff cannot
// see. publint lints the packed file set + manifest; @arethetypeswrong/core
// resolves every entrypoint's types under an esm-only profile.
//
// This file is the IO shell: it reads each non-private package's publish-shape
// tarball (produced once by the `@tools/release#pack` task this depends on)
// and runs both validators over the bytes, delegating every gating decision to
// the pure, unit-tested ./check-exports.core.ts. (The strip only removes
// devDependencies + scripts, neither in attw's nor publint's analysis scope,
// so validating the published bytes gives the same verdict a raw pack would.)

import { readFile } from 'node:fs/promises';

import {
  checkPackage,
  createPackageFromTarballData,
} from '@arethetypeswrong/core';
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';

import { packTarballPath } from './cache-paths.ts';
import {
  attwGatingProblems,
  formatExportsReport,
  type PackageExportsCheck,
  publintGatingMessages,
} from './check-exports.core.ts';
import { assertSelfDeclaredDeps } from './self-deps.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

/** Run attw + publint over one package's publish-shape tarball. */
async function checkExports(
  name: string,
  dir: string,
): Promise<PackageExportsCheck> {
  const data = await readFile(packTarballPath(name));

  // Offline — resolves the tarball's own types, no registry fetch.
  const analysis = await checkPackage(
    createPackageFromTarballData(new Uint8Array(data)),
  );

  // No pkgDir: `{ tarball }` roots publint at the archive's own dir; a real
  // path overrides that and throws.
  const { messages, pkg } = await publint({
    pack: {
      tarball: data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ),
    },
    level: 'suggestion',
  });
  const gating = publintGatingMessages(messages);
  const suggestions = messages.filter((m) => m.type === 'suggestion');

  return {
    name,
    dir,
    attw: attwGatingProblems(analysis),
    publint: gating.map((m) => formatMessage(m, pkg) ?? m.code),
    suggestions: suggestions.map((m) => formatMessage(m, pkg) ?? m.code),
  };
}

async function main() {
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(
    (member) =>
      member.dir !== '<root>' &&
      member.manifest &&
      member.manifest.private !== true,
  );
  await assertSelfDeclaredDeps(publishable.map(({ name }) => name));
  const results: PackageExportsCheck[] = [];
  for (const { name, dir } of publishable) {
    results.push(await checkExports(name, dir));
  }
  const { ok, text } = formatExportsReport(results);
  (ok ? console.log : console.error)(text);
  if (!ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
