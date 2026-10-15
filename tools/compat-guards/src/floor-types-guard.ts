#!/usr/bin/env node
// A tsconfig `paths` target that doesn't exist falls back to normal resolution,
// so a peer-floor typecheck can pass against the workspace copy. This asserts
// the outcome: every peer the config maps onto a <peer>-floor alias loads at
// least one file from the floor and none from the dev copy.
// Usage (from the package dir): floor-types-guard <tsconfig>
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';

import { flooredPeers, listedFiles, peerFiles } from './floor-files.ts';
import { type Guard, guard } from './guard.ts';

// annotated: TS only treats `g.fail` as never-returning through a dotted name
// whose type is explicit
const g: Guard = guard('floor-types-guard');

// the same tsc off PATH that the typecheck step after this guard runs
function tsc(args: string[]): string {
  const run = spawnSync('tsc', args, { encoding: 'utf8' });

  if (run.error !== undefined) {
    g.fail(`could not run tsc: ${run.error.message}`);
  }

  if (run.status !== 0) {
    g.fail(`tsc ${args.join(' ')} exited ${run.status}:\n${run.stdout}`);
  }

  return run.stdout;
}

function realDir(name: string): string {
  const dir = join(process.cwd(), 'node_modules', name);

  try {
    return realpathSync(dir);
  } catch {
    return g.fail(`no ${name} installed in ${process.cwd()}; reinstall`);
  }
}

function main(): void {
  const [config] = process.argv.slice(2);

  if (config === undefined) {
    g.fail('usage: floor-types-guard <tsconfig>');
  }

  const peers = flooredPeers(tsc(['-p', config, '--showConfig']));

  if (peers.length === 0) {
    g.fail(
      `${config} maps no paths onto a node_modules/<peer>-floor alias, so ` +
        'it typechecks against no floor.',
    );
  }

  const files = listedFiles(tsc(['-p', config, '--listFilesOnly']));

  for (const peer of peers) {
    const dirs = {
      peer,
      floorDir: realDir(`${peer}-floor`),
      devDir: realDir(peer),
    };

    if (dirs.floorDir === dirs.devDir) {
      g.fail(
        `${peer}-floor and ${peer} install to the same ${dirs.floorDir}; ` +
          'the floor check cannot tell them apart.',
      );
    }

    const { floor, leaked } = peerFiles(files, dirs);

    if (leaked.length > 0) {
      g.fail(
        `${config} loads ${peer} from ${dirs.devDir}, not ${peer}-floor. ` +
          'A paths target that does not exist falls back to normal ' +
          `resolution; map the subpath explicitly:\n  ${leaked.join('\n  ')}`,
      );
    }

    if (floor.length === 0) {
      g.fail(
        `${config} maps ${peer} onto ${peer}-floor, but loads no file from ` +
          `${dirs.floorDir}; nothing imports ${peer}, or every mapping misses.`,
      );
    }

    g.pass(`${peer}: ${floor.length} files from ${peer}-floor, none leaked`);
  }
}

if (import.meta.main) main();
