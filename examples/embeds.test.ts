// The one axis the type system can't see: what is actually on disk. TS cannot
// enumerate a directory, so this is the runtime half of the pin embeds.test-d.ts
// makes at compile time. An example directory missing from embeds.ts is never
// built, never typechecked and never seeded with node_modules by postinstall —
// it rots silently, so fail the build instead.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { EXAMPLE_NAMES } from './embeds.ts';

const root = dirname(fileURLToPath(import.meta.url));

/** Directories under examples/ that are examples: the tutorials, not the workspace member. */
function exampleDirs(): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
    .filter((entry) => {
      try {
        return statSync(join(root, entry.name, 'package.json')).isFile();
      } catch {
        return false;
      }
    })
    .map((entry) => entry.name)
    .sort();
}

describe('embeds manifest', () => {
  it('declares every example directory, and no others', () => {
    assert.deepEqual(exampleDirs(), [...EXAMPLE_NAMES].sort());
  });
});

/** An example's index.html: at its root for vite, or in the `public/` it serves as-is. */
function indexPage(example: string): string | undefined {
  return ['index.html', 'public/index.html'].find((page) =>
    existsSync(join(root, example, page)),
  );
}

/** The `<script type="importmap">` JSON in an example's index.html, if it has one. */
function importMap(example: string): Record<string, string> | undefined {
  const page = indexPage(example);

  if (!page) return undefined;

  const script = /<script type="importmap">([\s\S]*?)<\/script>/.exec(
    readFileSync(join(root, example, page), 'utf8'),
  );

  // SAFETY: an import map is `{ imports: { specifier: url } }`; esmShPin fails on a non-URL
  return script
    ? (JSON.parse(script[1]) as { imports: Record<string, string> }).imports
    : undefined;
}

/** Package name and exact version from an esm.sh URL such as `https://esm.sh/*@scope/pkg@1.2.3/path`. */
function esmShPin(url: string) {
  const { host, pathname } = new URL(url);
  const pin = /^\/\*?((?:@[^/]+\/)?[^@/]+)@([^/]+)/.exec(pathname);

  assert.ok(
    host === 'esm.sh' && pin,
    `${url} is not an esm.sh URL with an exact version`,
  );

  return { name: pin[1], version: pin[2] };
}

describe('import maps', () => {
  // Example bumps regenerate package-lock.json; the CDN URLs only move by hand.
  it('pin each CDN URL to the version package-lock.json installs', () => {
    const maps = EXAMPLE_NAMES.flatMap((example) => {
      const imports = importMap(example);

      return imports ? [{ example, imports }] : [];
    });

    assert.notDeepEqual(maps, [], 'no example has an import map to check');

    const drift = maps.flatMap(({ example, imports }) => {
      // SAFETY: npm lockfile v3 keys installed packages by `node_modules/<name>`
      const lock = JSON.parse(
        readFileSync(join(root, example, 'package-lock.json'), 'utf8'),
      ) as { packages: Record<string, { version?: string }> };

      return Object.values(imports).flatMap((url) => {
        const { name, version } = esmShPin(url);
        const locked = lock.packages[`node_modules/${name}`]?.version;
        const fixed = url.replace(`${name}@${version}`, `${name}@${locked}`);

        return locked === version
          ? []
          : [
              `examples/${example}/${indexPage(example)}: update ${url} to ${fixed} (package-lock.json installs ${name}@${locked})`,
            ];
      });
    });

    assert.deepEqual(drift, []);
  });
});
