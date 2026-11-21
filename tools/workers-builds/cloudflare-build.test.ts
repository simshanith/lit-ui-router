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
  type Site,
  type SiteResult,
  buildSteps,
  misePin,
  npmSpec,
  pnpmSpec,
  resolveSite,
  siteFromArgs,
} from './cloudflare-build.ts';

const siteOf = (result: SiteResult): Site => {
  if (!result.ok) assert.fail(result.error);

  return result.site;
};

const rootWith = (packageManager?: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'cloudflare-build-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(packageManager === undefined ? {} : { packageManager }),
  );

  return dir;
};

const rootWithMiseConfig = (toml: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'cloudflare-build-'));
  mkdirSync(join(dir, '.config/mise'), { recursive: true });
  writeFileSync(join(dir, '.config/mise/config.toml'), toml);

  return dir;
};

describe('misePin', () => {
  it('reads a plain version pin from [tools]', () => {
    assert.equal(
      misePin({ tools: { 'npm:npm': '12.3.4', node: '24' } }, 'npm:npm'),
      '12.3.4',
    );
  });

  it('is empty for a tool with no pin', () => {
    assert.equal(misePin({ tools: { node: '24' } }, 'npm:npm'), '');
  });

  it('is empty for a table-form pin', () => {
    assert.equal(
      misePin({ tools: { 'npm:npm': { version: '12.3.4' } } }, 'npm:npm'),
      '',
    );
  });

  it('is empty for a config with no [tools] table', () => {
    assert.equal(misePin({}, 'npm:npm'), '');
  });
});

// readMiseConfig is bun-only, so these run it in the mise-pinned bun: the
// version every Workers Builds trigger pins with BUN_VERSION.
const npmPinUnderBun = (root: string): ReturnType<typeof spawnSync> =>
  spawnSync(
    'bun',
    [
      '--print',
      `import(${JSON.stringify(join(import.meta.dirname, 'cloudflare-build.ts'))}).then(async (m) => m.misePin(await m.readMiseConfig(${JSON.stringify(root)}), 'npm:npm'))`,
    ],
    { encoding: 'utf8' },
  );

describe('readMiseConfig', () => {
  it("reads [tools] through bun's TOML loader", () => {
    const result = npmPinUnderBun(
      rootWithMiseConfig(
        '[settings]\nexperimental = true\n\n[tools]\n"npm:npm" = "12.3.4"\n',
      ),
    );

    assert.equal(result.status, 0, String(result.stderr));
    assert.equal(String(result.stdout).trim(), '12.3.4');
  });

  it('fails on a config that is not TOML', () => {
    assert.notEqual(
      npmPinUnderBun(rootWithMiseConfig('version = \n')).status,
      0,
    );
  });
});

describe('npmSpec', () => {
  it('pins npm to the mise version', () => {
    assert.equal(npmSpec('12.3.4'), 'npm@12.3.4');
  });

  it('rejects a missing mise pin', () => {
    assert.throws(() => npmSpec(''), /no "npm:npm" version pin/);
  });
});

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
      ok: true,
      site: {
        key: 'example.test',
        dir: 'www/example.test',
        packageName: '@www/example.test',
      },
    });
  });

  it('installs the pinned npm before pnpm', () => {
    assert.deepEqual(
      buildSteps(
        root,
        '/nonexistent/bin',
        siteOf(resolveSite(root, 'example.test')),
        '12.3.4',
      ).at(0),
      ['npm', ['install', '--global', 'npm@12.3.4']],
    );
  });

  it('builds the site package through turbo after the install', () => {
    assert.deepEqual(
      buildSteps(
        root,
        '/nonexistent/bin',
        siteOf(resolveSite(root, 'example.test')),
        '12.3.4',
      ).at(-1),
      ['npx', ['turbo', '@www/example.test#build']],
    );
  });

  it('fails on a site with no package', () => {
    assert.deepEqual(resolveSite(root, 'nowhere.test'), {
      ok: false,
      error: 'unknown site nowhere.test: no package.json in www/nowhere.test',
    });
  });

  // The convention is what the build and deploy rely on; a rename must not
  // quietly build one package and deploy another.
  it('fails when the package name does not match the directory', () => {
    assert.deepEqual(resolveSite(root, 'misnamed.test'), {
      ok: false,
      error:
        'www/misnamed.test/package.json is named "@www/something-else", not @www/misnamed.test',
    });
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
      assert.deepEqual(
        resolveSite(root, key),
        {
          ok: false,
          error: `site is not a www/ domain name: ${JSON.stringify(key)}`,
        },
        key,
      );
    }
  });

  it('defaults to the docs site and refuses extra arguments', () => {
    assert.equal(siteOf(siteFromArgs(root, [])).key, DEFAULT_SITE);
    assert.equal(
      siteOf(siteFromArgs(root, ['example.test'])).key,
      'example.test',
    );
    assert.deepEqual(siteFromArgs(root, ['example.test', 'extra']), {
      ok: false,
      error: 'unexpected argument(s) after the site: extra',
    });
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
