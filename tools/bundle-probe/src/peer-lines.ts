import { realpathSync } from 'node:fs';
import path from 'node:path';

import { requireManifest } from '@tools/bootstrap/manifest.ts';

/**
 * One consumer install to bundle an entry against: the packages inlined
 * instead of external, and a dependency or peer swapped for an alias's older line.
 */
export type PeerLine = {
  label: string;
  inline: string[];
  alias: Record<string, string>;
};

type Installed = { name: string; version: string; registry: boolean };

const installed = (
  packageDir: string,
  specifier: string,
): Installed | undefined => {
  const dir = path.join(packageDir, 'node_modules', specifier);
  let real: string;

  try {
    real = realpathSync(dir);
  } catch {
    return undefined;
  }

  const { name, version } = requireManifest(dir);

  if (name === undefined || version === undefined) {
    throw new Error(`${dir}: package.json has no name or version`);
  }

  // a workspace link resolves into the repo; a registry install into a store
  return {
    name,
    version,
    registry: real.split(path.sep).includes('node_modules'),
  };
};

/**
 * The installs a consumer can pair this package with, read from what the
 * workspace installed: every registry-installed dependency and peer at its
 * installed version, then once per devDependency alias of a dependency or peer
 * at another version (`effect-3` installing `effect`). A workspace peer stays external on the first line,
 * since only its registry floor alias has a dist without a build edge.
 */
export const readPeerLines = (packageDir: string): PeerLine[] => {
  const manifest = requireManifest(packageDir);
  const peers = Object.keys(manifest.peerDependencies ?? {});
  const declared = [...Object.keys(manifest.dependencies ?? {}), ...peers];
  const devDependencies = Object.keys(manifest.devDependencies ?? {});

  const registry = declared.filter(
    (name) => installed(packageDir, name)?.registry === true,
  );

  const version = (name: string): string =>
    `${name}@${installed(packageDir, name)!.version}`;

  const lines: PeerLine[] = [
    { label: registry.map(version).join(', '), inline: registry, alias: {} },
  ];

  for (const alias of devDependencies) {
    const target = installed(packageDir, alias);

    if (!target?.registry || target.name === alias) continue;

    if (!declared.includes(target.name)) continue;

    // an exact dev pin of the installed version adds no line of its own
    if (target.version === installed(packageDir, target.name)?.version) {
      continue;
    }

    lines.push({
      label: `${target.name}@${target.version} via ${alias}`,
      inline: [...new Set([...registry, target.name])],
      alias: { [target.name]: alias },
    });
  }

  return lines.filter((line) => line.inline.length > 0);
};
