import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { basename } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { bundleEntry, bundlers, DEVELOPMENT_DEFINE } from '@tools/bundle-probe';
import { readPackageProbe } from '@tools/bundle-probe/entries';

// Entries derive from the exports map — new exports join the report without
// touching this file. Peers are the consumer's own installs; externalizing
// them prices only this package's code in the reported entries. The matcher
// is bundled with NO externals: its dependency-free claim must hold with
// nothing supplied from outside. Size is governed by the codecov
// bundle_analysis check, so entry sizes are reported as diagnostics, not
// gated. (History: the matcher once targeted the 10,240 B CloudFront
// Functions ceiling; that adapter line is abandoned and the number survives
// only as context in the diagnostics.)
const { declared, entries } = readPackageProbe(
  fileURLToPath(new URL('..', import.meta.url)),
);

const matcher = entries.find((entry) => entry.label === 'matcher');

const reported = entries.filter((entry) => entry !== matcher);

const router = entries.find((entry) => entry.label === 'router/matcher');

assert.ok(router, 'expected a router/matcher export');

const matcherOnly = [
  { build: 'production', file: router.file },
  {
    build: 'development',
    file: router.file.replace(
      /router-matcher\.js$/,
      'development/router-matcher.js',
    ),
  },
];

const ADAPTERS = ['fetch', 'connect', 'hono'] as const;

const probeDir = mkdtempSync(path.join(tmpdir(), 'router-matcher-'));

after(() => rmSync(probeDir, { recursive: true, force: true }));

// One module importing both, as a handler does: no export of either may be shaken away.
const combined = (file: string, adapter: (typeof ADAPTERS)[number]): string => {
  const entry = path.join(
    probeDir,
    `${basename(path.dirname(file))}-${adapter}.ts`,
  );

  const imported = (target: string): string => JSON.stringify(target);

  writeFileSync(
    entry,
    [
      `export * from ${imported(file)};`,
      `export * from ${imported(path.join(path.dirname(file), `${adapter}.js`))};`,
    ].join('\n'),
  );

  return entry;
};

const gzipBytes = (code: string): number => gzipSync(code).byteLength;

for (const bundler of bundlers) {
  describe(`bundle size (${bundler})`, () => {
    it('bundles the matcher tier from zero node_modules inputs', async (t) => {
      assert.ok(matcher, 'expected a matcher export');

      const { entry, inputs } = await bundleEntry(matcher.file, bundler, {
        minify: true,
      });

      t.diagnostic(
        `matcher: ${entry.bytes} B minified, ${gzipBytes(entry.code)} B gzip`,
      );
      const deps = inputs.filter((input) => input.includes('node_modules'));
      assert.deepEqual(deps, [], 'matcher tier pulled in dependencies');
    });

    it('bundles the ssr client without the server half', async () => {
      const client = entries.find((entry) => entry.label === 'ssr/client');
      assert.ok(client, 'expected an ssr/client export');

      const { inputs } = await bundleEntry(client.file, bundler, {
        external: declared,
      });

      const server = inputs.filter((input) =>
        /[/\\](ssr|dehydrate)\.js$/.test(input),
      );

      assert.deepEqual(server, [], 'ssr/client pulled in the server entry');
      assert.ok(
        inputs.some((input) => input.endsWith('resolve-payload.js')),
        'expected the shared payload module among the inputs',
      );
    });

    it('bundles the ssr entry without the prerender loop or the resolver', async () => {
      const ssr = entries.find((entry) => entry.label === 'ssr');
      assert.ok(ssr, 'expected an ssr export');

      const { inputs } = await bundleEntry(ssr.file, bundler, {
        external: declared,
      });

      const loop = inputs.filter((input) =>
        /[/\\](prerender|index)\.js$/.test(input),
      );

      assert.deepEqual(loop, [], 'ssr pulled in the prerender loop');
    });

    // A single-file bundler inlines every import(), so nothing router/matcher or an adapter reaches may import core.
    for (const { build, file } of matcherOnly) {
      for (const adapter of [undefined, ...ADAPTERS]) {
        const probe = adapter
          ? `router/matcher + ${adapter}`
          : 'router/matcher';

        it(`bundles ${probe} (${build}) into one chunk without @uirouter/core`, async () => {
          const entry = adapter ? combined(file, adapter) : file;

          const { chunks, inputs } = await bundleEntry(entry, bundler, {
            annotations: false,
            define: DEVELOPMENT_DEFINE,
          });

          assert.deepEqual(
            inputs.filter((input) => input.includes('@uirouter/core')),
            [],
          );

          assert.deepEqual(
            chunks.map((chunk) => chunk.name),
            [basename(entry).replace(/\.ts$/, '.js')],
          );
          assert.doesNotMatch(chunks[0]?.code ?? '', /@uirouter\/core/);
        });
      }
    }

    it('reports the remaining entry sizes (visibility, not a gate)', async (t) => {
      for (const { label, file } of reported) {
        const { entry } = await bundleEntry(file, bundler, {
          minify: true,
          external: declared,
        });

        t.diagnostic(
          `${label}: ${entry.bytes} B minified, ${gzipBytes(entry.code)} B gzip`,
        );
      }
    });
  });
}
