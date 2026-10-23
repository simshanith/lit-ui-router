// A package's published files, read from the npm registry's tarballs, and `npm diff` between two versions.
import { formatDiff, packageFiles, type PackageFiles } from './format-diff.ts';
import { readTar } from './tar.ts';

export const REGISTRY = 'https://registry.npmjs.org';

/** The registry's abbreviated packument, as far as the diff reads it. */
interface Packument {
  versions: Record<string, { dist: { tarball: string } }>;
}

/** A version the registry has no tarball for. */
export class NotPublished extends Error {
  override name = 'NotPublished';
}

const ok = (response: Response): Response => {
  if (!response.ok)
    throw new Error(`${response.url} answered ${response.status}`);

  return response;
};

/** Each of `versions`' tarball urls, from the package's abbreviated packument. */
export const tarballUrls = async (
  name: string,
  versions: readonly string[],
): Promise<string[]> => {
  const response = ok(
    await fetch(`${REGISTRY}/${name.replace('/', '%2F')}`, {
      headers: { Accept: 'application/vnd.npm.install-v1+json' },
    }),
  );

  // SAFETY: the registry's documented shape; a version without dist throws below.
  const packument = (await response.json()) as Packument;

  return versions.map((version) => {
    const url = packument.versions[version]?.dist.tarball;

    if (!url) throw new NotPublished(`${name}@${version}`);

    return url;
  });
};

/** One gzipped tarball's files, in archive order. */
export const tarballFiles = async (url: string): Promise<PackageFiles> => {
  const response = ok(await fetch(url));

  if (!response.body) throw new Error(`${url} answered without a body`);

  const tar = await new Response(
    response.body.pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer();

  return packageFiles(readTar(new Uint8Array(tar)));
};

/** The patch `npm diff --diff=<name>@<from> --diff=<name>@<to>` prints, less its final newline. */
export const npmDiff = async (
  name: string,
  from: string,
  to: string,
): Promise<string> => {
  const urls = await tarballUrls(name, [from, to]);
  const [a, b] = await Promise.all(urls.map(tarballFiles));

  return formatDiff({ a, b, versions: { a: from, b: to } });
};
