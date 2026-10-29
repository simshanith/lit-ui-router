// The default FileWriter for prerender; a caller-supplied `write` never loads it.
import type { FileWriter } from './prerender.ts';

// Built at runtime so no node: specifier enters the static module graph.
const NODE_FS = 'node:fs/promises';

// Typed structurally so src never pulls in @types/node.
interface NodeFsPromises {
  mkdir(
    path: string,
    options: { recursive: boolean },
  ): Promise<string | undefined>;
  writeFile(path: string, data: string, encoding: string): Promise<void>;
}

const dirOf = (file: string): string => {
  const cut = file.lastIndexOf('/');

  return cut === -1 ? '' : file.slice(0, cut);
};

/**
 * Writes `body` to `file` through `node:fs/promises`, creating its directory.
 *
 * @internal
 */
export const nodeWrite: FileWriter = async (file, body) => {
  // SAFETY: `NODE_FS` names `node:fs/promises`, whose `mkdir` and `writeFile` take these shapes.
  const { mkdir, writeFile } = (await import(NODE_FS)) as NodeFsPromises;
  const dir = dirOf(file);

  if (dir) await mkdir(dir, { recursive: true });
  await writeFile(file, body, 'utf8');
};
