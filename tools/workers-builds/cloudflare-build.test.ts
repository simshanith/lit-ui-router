// Fixture-only: that the derived spec agrees with the repo's other pnpm pins
// is pnpm-pin.test.ts's job, so nothing here reads the real root.
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  DEFAULT_SITE,
  buildSteps,
  pnpmSpec,
  resolveSite,
  siteFromArgs,
} from './cloudflare-build.ts';

const rootWith = (packageManager?: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'cloudflare-build-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(packageManager === undefined ? {} : { packageManager }),
  );

  return dir;
};

describe('pnpmSpec', () => {
  it('drops the integrity hash npm has no use for', () => {
    assert.equal(
      pnpmSpec(rootWith('pnpm@12.3.4+sha512.961aa41fb077da3a')),
      'pnpm@12.3.4',
    );
  });

  it('passes through a pin with no hash', () => {
    assert.equal(pnpmSpec(rootWith('pnpm@12.3.4')), 'pnpm@12.3.4');
  });

  // Bootstrapping the wrong package manager would fail deep inside the build,
  // where the message is about a missing binary rather than the manifest.
  it('rejects a manifest that names another package manager', () => {
    assert.throws(() => pnpmSpec(rootWith('yarn@4.0.0')), /not a pnpm pin/);
  });

  it('rejects a manifest with no packageManager at all', () => {
    assert.throws(() => pnpmSpec(rootWith()), /not a pnpm pin/);
  });
});

// A root holding one www/ package per entry, keyed by directory name.
const rootWithSites = (sites: Record<string, string | undefined>): string => {
  const dir = rootWith('pnpm@12.3.4');

  for (const [key, name] of Object.entries(sites)) {
    mkdirSync(join(dir, 'www', key), { recursive: true });
    writeFileSync(
      join(dir, 'www', key, 'package.json'),
      JSON.stringify(name === undefined ? {} : { name }),
    );
  }

  return dir;
};

describe('resolveSite', () => {
  const root = rootWithSites({
    'lit-ui-router.dev': '@www/lit-ui-router.dev',
    'example.test': '@www/example.test',
    'misnamed.test': '@www/something-else',
  });

  it('resolves a domain key to its www/ package', () => {
    assert.deepEqual(resolveSite(root, 'example.test'), {
      key: 'example.test',
      dir: 'www/example.test',
      packageName: '@www/example.test',
    });
  });

  it('builds the site package through turbo after the install', () => {
    assert.deepEqual(
      buildSteps(
        root,
        '/nonexistent/bin',
        resolveSite(root, 'example.test'),
      ).at(-1),
      ['npx', ['turbo', '@www/example.test#build']],
    );
  });

  it('throws on a site with no package', () => {
    assert.throws(
      () => resolveSite(root, 'nowhere.test'),
      /unknown site nowhere\.test/,
    );
  });

  // The convention is what the build and deploy rely on; a rename must not
  // quietly build one package and deploy another.
  it('throws when the package name does not match the directory', () => {
    assert.throws(
      () => resolveSite(root, 'misnamed.test'),
      /named "@www\/something-else", not @www\/misnamed\.test/,
    );
  });

  it('refuses keys that are not a domain name', () => {
    for (const key of [
      '',
      '..',
      '../www',
      'www/example.test',
      'Example.test',
      'localhost',
    ]) {
      assert.throws(
        () => resolveSite(root, key),
        /not a www\/ domain name/,
        key,
      );
    }
  });

  it('defaults to the docs site and refuses extra arguments', () => {
    assert.equal(siteFromArgs(root, []).key, DEFAULT_SITE);
    assert.equal(siteFromArgs(root, ['example.test']).key, 'example.test');
    assert.throws(
      () => siteFromArgs(root, ['example.test', 'extra']),
      /unexpected argument\(s\) after the site: extra/,
    );
  });
});

// Arguments are checked before any step, so a bad one runs nothing. PATH names
// no directory, so a regression reaches no real npm.
describe('cloudflare-build.ts arguments', () => {
  const script = fileURLToPath(
    new URL('./cloudflare-build.ts', import.meta.url),
  );

  it('exits 2 with usage on an unknown site or an extra argument', () => {
    for (const args of [
      ['nowhere.lit-ui-router.dev'],
      [DEFAULT_SITE, 'extra'],
    ]) {
      const result = spawnSync(process.execPath, [script, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PATH: '/nonexistent' },
      });

      assert.equal(result.status, 2, args.join(' '));
      assert.match(result.stderr, /usage: cloudflare-build\.ts \[site\]/);
    }
  });
});

// SKIP_DEPENDENCY_INSTALL=1 means this script loads with no node_modules, which
// `.oxlintrc.json` guards per-specifier. oxlint's no-restricted-imports reads
// string literals only, so `import(spec)` slips past it; loading the script
// outside the repo catches every form. The tree is mirrored rather than
// flattened because the one allowed exception is a relative reach across a
// package boundary — copying it in is what puts that reach under test.
describe('cloudflare-build.ts resolution', () => {
  const PACKAGE_DIR = 'tools/workers-builds';
  const BOOTSTRAP_DIR = 'tools/bootstrap/src';

  it('loads with no node_modules on any parent', async () => {
    const root = new URL('../../', import.meta.url);
    const bootstrap = new URL(`${BOOTSTRAP_DIR}/`, root);

    const sources = (await readdir(bootstrap)).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );

    const dir = await mkdtemp(join(tmpdir(), 'cloudflare-build-resolution-'));

    try {
      await mkdir(join(dir, PACKAGE_DIR), { recursive: true });
      await mkdir(join(dir, BOOTSTRAP_DIR), { recursive: true });
      await copyFile(
        fileURLToPath(new URL('./cloudflare-build.ts', import.meta.url)),
        join(dir, PACKAGE_DIR, 'cloudflare-build.ts'),
      );

      for (const name of sources) {
        await copyFile(
          fileURLToPath(new URL(name, bootstrap)),
          join(dir, BOOTSTRAP_DIR, name),
        );
      }

      // `import.meta.main` is false for an imported module, so this resolves
      // the graph without running the build steps.
      await writeFile(
        join(dir, 'load.mjs'),
        `await import('./${PACKAGE_DIR}/cloudflare-build.ts');\n`,
      );

      await promisify(execFile)(process.execPath, [join(dir, 'load.mjs')], {
        cwd: dir,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
