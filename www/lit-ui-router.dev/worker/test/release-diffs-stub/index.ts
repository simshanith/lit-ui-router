// A release-diffs worker whose default entrypoint answers every pair with one fixed file, for workerd tests.
import { WorkerEntrypoint } from 'cloudflare:workers';

import type {
  DiffIndex,
  DiffPair,
  ReleaseDiffs,
} from '../../releases/diff-data.ts';
import type { FileFilter } from '../../releases/npm-diff/file-filter.ts';

const patchOf = ({ name, from, to }: DiffPair): string =>
  `diff --git a/package.json b/package.json\nindex v${from}..v${to} 100644\n--- a/package.json\n+++ b/package.json\n@@ -1,1 +1,1 @@\n-"name": "${name}"\n+"name": "${name}"\n`;

const streamOf = (text: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start: (controller) => {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

export default class extends WorkerEntrypoint implements ReleaseDiffs {
  index(pair: DiffPair): Promise<DiffIndex> {
    const bytes = new TextEncoder().encode(patchOf(pair)).length;

    return Promise.resolve({
      files: [
        {
          path: 'package.json',
          kind: 'modified',
          added: 1,
          removed: 1,
          offset: 0,
          length: bytes,
          filters: ['src', 'all'],
        },
      ],
      bytes,
    });
  }

  files(
    pair: DiffPair,
    filter: FileFilter,
  ): Promise<ReadableStream<Uint8Array>> {
    return Promise.resolve(
      streamOf(filter === 'src' || filter === 'all' ? patchOf(pair) : ''),
    );
  }

  patch(pair: DiffPair): Promise<ReadableStream<Uint8Array>> {
    return Promise.resolve(streamOf(patchOf(pair)));
  }

  override fetch(): Response {
    return new Response(null, { status: 404 });
  }
}
