// The deployed worker with its npm registry reads answered from fixtures, for src/worker.test.ts.
// The harness's outbound fetches run in node, which a synchronous RPC call from the test blocks.
import { tar } from '../../src/npm-diff-fixtures.ts';
import { REGISTRY } from '../../src/registry.ts';
import ReleaseDiffs from '../index.ts';

const NAME = 'stub-pkg';

/** Each fixture version's files, as `package/<path>` archive members, keyed by tarball url. */
const TARBALLS = new Map(
  Object.entries({
    '1.0.0': {
      'package.json': '{ "version": "1.0.0" }\n',
      'src/index.ts': 'export const a = 1;\n',
      'dist/index.js': 'export const a = 1;\n',
      'dist/index.d.ts': 'export declare const a = 1;\n',
    },
    '1.1.0': {
      'package.json': '{ "version": "1.1.0" }\n',
      'src/index.ts': 'export const a = 2;\n',
      'dist/index.js': 'export const a = 2;\n',
      'dist/index.d.ts': 'export declare const a = 2;\n',
    },
  }).map(([version, members]) => [
    `${REGISTRY}/${NAME}/-/${NAME}-${version}.tgz`,
    { version, members },
  ]),
);

const tarball = (members: Readonly<Record<string, string>>) =>
  new Response(
    new Blob([
      tar(
        Object.entries(members).map(([path, body]) => ({
          name: `package/${path}`,
          body,
        })),
      ),
    ])
      .stream()
      .pipeThrough(new CompressionStream('gzip')),
  );

const registry = (url: string): Response => {
  if (url === `${REGISTRY}/${NAME}`) {
    return Response.json({
      versions: Object.fromEntries(
        [...TARBALLS].map(([tarballUrl, { version }]) => [
          version,
          { dist: { tarball: tarballUrl } },
        ]),
      ),
    });
  }

  const found = TARBALLS.get(url);

  return found ? tarball(found.members) : new Response(null, { status: 404 });
};

const reads: string[] = [];

const upstream = globalThis.fetch;

globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input);

  if (!url.startsWith(`${REGISTRY}/`)) return upstream(input, init);

  reads.push(url);

  return Promise.resolve(registry(url));
};

export { ReleaseDiff } from '../index.ts';

export default class extends ReleaseDiffs {
  /** The registry urls read since the last call. */
  registryReads(): string[] {
    return reads.splice(0);
  }
}
