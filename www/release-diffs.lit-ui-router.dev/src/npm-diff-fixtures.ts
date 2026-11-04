// In-memory tarballs and package files for the npm diff port's tests.
import type { PackageFile } from './format-diff.ts';

const encoder = new TextEncoder();

/** One archive member as the tests write it; `type` defaults to a regular file. */
export interface Member {
  name: string;
  body?: string;
  mode?: number;
  type?: string;
  prefix?: string;
}

const field = (block: Uint8Array, at: number, length: number, value: string) =>
  block.set(encoder.encode(value).subarray(0, length), at);

const octal = (value: number, length: number): string =>
  `${value.toString(8).padStart(length - 1, '0')}\0`;

const header = (
  { name, mode = 0o644, type = '0', prefix = '' }: Member,
  size: number,
) => {
  const block = new Uint8Array(512);

  field(block, 0, 100, name);
  field(block, 100, 8, octal(mode, 8));
  field(block, 124, 12, octal(size, 12));
  field(block, 156, 1, type);
  field(block, 257, 6, 'ustar\0');
  field(block, 263, 2, '00');
  field(block, 345, 155, prefix);

  return block;
};

const padded = (bytes: Uint8Array): Uint8Array => {
  const out = new Uint8Array(Math.ceil(bytes.length / 512) * 512);

  out.set(bytes);

  return out;
};

/** An uncompressed ustar archive of `members`, ending in two zero blocks; checksums are left blank. */
export const tar = (members: readonly Member[]): Uint8Array => {
  const parts = members.flatMap((member) => {
    const body = encoder.encode(member.body ?? '');

    return [header(member, body.length), padded(body)];
  });

  const archive = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 1024),
  );

  let at = 0;

  for (const part of parts) {
    archive.set(part, at);
    at += part.length;
  }

  return archive;
};

/** A pax extended header member carrying `records`. */
export const pax = (records: Record<string, string>): Member => {
  const body = Object.entries(records)
    .map(([key, value]) => {
      const record = ` ${key}=${value}\n`;
      let length = encoder.encode(record).length;

      length += String(length + String(length).length).length;

      return `${length}${record}`;
    })
    .join('');

  return { name: 'PaxHeader', type: 'x', body };
};

/** Package files from `[path, content, mode?]` triples, in order. */
export const files = (
  ...entries: readonly (readonly [string, string, string?])[]
): Map<string, PackageFile> =>
  new Map(
    entries.map(([path, content, mode = '100644']) => [
      path,
      { content, mode },
    ]),
  );
