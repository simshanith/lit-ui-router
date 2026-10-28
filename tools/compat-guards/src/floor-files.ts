// Pure logic for floor-types-guard.ts, which owns the IO.
import { sep } from 'node:path';

import * as v from 'valibot';

const ShowConfigSchema = v.object({
  compilerOptions: v.optional(
    v.object({
      paths: v.optional(v.record(v.string(), v.array(v.string()))),
    }),
  ),
});

const FLOOR_TARGET =
  /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+-floor)(?:\/|$)/u;

/** Floor aliases a `tsc --showConfig` maps paths onto, `<peer>[-<line>]-floor`. */
export function floorAliases(showConfig: string): string[] {
  const config = v.parse(ShowConfigSchema, JSON.parse(showConfig));
  const targets = Object.values(config.compilerOptions?.paths ?? {}).flat();

  const aliases = targets.flatMap((target) => {
    const alias = FLOOR_TARGET.exec(target)?.[1];

    return alias === undefined ? [] : [alias];
  });

  return [...new Set(aliases)].sort();
}

/** The paths `tsc --listFilesOnly` printed, one per non-empty line. */
export function listedFiles(stdout: string): string[] {
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export interface PeerDirs {
  peer: string;
  /** Real path of `node_modules/<peer>-floor`. */
  floorDir: string;
  /** Real path of `node_modules/<peer>`: the workspace or dev copy. */
  devDir: string;
}

export interface PeerFiles {
  floor: string[];
  leaked: string[];
}

const within = (dir: string, file: string) => file.startsWith(dir + sep);

/**
 * Split the program's files into those from the floor and from the dev copy.
 * When both resolve to one install the dev copy is the floor, so none leak.
 */
export function peerFiles(files: readonly string[], dirs: PeerDirs): PeerFiles {
  const floor = files.filter((file) => within(dirs.floorDir, file));

  return {
    floor,
    leaked:
      dirs.devDir === dirs.floorDir
        ? []
        : files.filter((file) => within(dirs.devDir, file)),
  };
}
