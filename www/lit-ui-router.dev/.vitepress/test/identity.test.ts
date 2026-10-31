import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { RENDERED_IMAGES } from '../identity.ts';

const PUBLIC = join(import.meta.dirname, '../../public');

describe('RENDERED_IMAGES', () => {
  for (const [source, { path, width, height }] of Object.entries(
    RENDERED_IMAGES,
  )) {
    it(`public${path} is the ${width}×${height} render of ${source}`, async () => {
      const png = await readFile(join(PUBLIC, path));

      // IHDR follows the 8-byte signature and 8-byte chunk header
      assert.equal(png.toString('latin1', 12, 16), 'IHDR');
      assert.deepEqual(
        { width: png.readUInt32BE(16), height: png.readUInt32BE(20) },
        { width, height },
      );
    });
  }
});
