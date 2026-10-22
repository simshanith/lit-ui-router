// The regular files of an uncompressed tar archive, read the way node-tar's `list` reports them to libnpmdiff.

const BLOCK = 512;

/** One regular file: its path as the archive names it, its permission bits and its bytes. */
export interface TarFile {
  path: string;
  mode: number;
  data: Uint8Array;
}

const utf8 = new TextDecoder('utf-8');

/** A NUL-terminated header field. */
const text = (block: Uint8Array, start: number, length: number): string => {
  const field = block.subarray(start, start + length);
  const end = field.indexOf(0);

  return utf8.decode(end === -1 ? field : field.subarray(0, end));
};

/** An octal header field, or a base-256 one when its high bit is set. */
const number = (block: Uint8Array, start: number, length: number): number => {
  const field = block.subarray(start, start + length);

  if (field[0] !== undefined && field[0] & 0x80)
    return field.subarray(1).reduce((sum, byte) => sum * 256 + byte, 0);

  return Number.parseInt(text(block, start, length).trim() || '0', 8);
};

/** The `key=value` records of a pax extended header. */
const paxRecords = (data: Uint8Array): Map<string, string> => {
  const records = new Map<string, string>();
  let at = 0;

  // Each record's length counts bytes, so slice before decoding.
  while (at < data.length) {
    const space = data.indexOf(0x20, at);
    const length = Number(utf8.decode(data.subarray(at, space)));

    if (space === -1 || !(length > 0)) break;

    const record = utf8.decode(data.subarray(space + 1, at + length - 1));
    const equals = record.indexOf('=');

    records.set(record.slice(0, equals), record.slice(equals + 1));
    at += length;
  }

  return records;
};

/** What a pax or GNU long-name header sets for the entry after it. */
interface Pending {
  path?: string;
  mode?: number;
  size?: number;
}

/** Headers that describe the next entry instead of being one. */
const EXTENSIONS = new Set(['x', 'g', 'L']);

/** `pending` with what one extension header adds; npm tarballs set no global (`g`) field. */
const extend = (type: string, data: Uint8Array, pending: Pending): Pending => {
  if (type === 'L') return { ...pending, path: text(data, 0, data.length) };

  if (type === 'g') return pending;

  const records = paxRecords(data);
  const path = records.get('path');
  const size = records.get('size');
  const mode = records.get('mode');

  return {
    ...pending,
    ...(path !== undefined && { path }),
    ...(size !== undefined && { size: Number(size) }),
    ...(mode !== undefined && { mode: Number.parseInt(mode, 8) }),
  };
};

/** The path a header names, under its ustar prefix. */
const pathOf = (block: Uint8Array): string => {
  const name = text(block, 0, 100);
  const prefix = text(block, 345, 155);

  return text(block, 257, 6) === 'ustar' && prefix ? `${prefix}/${name}` : name;
};

const isZero = (block: Uint8Array): boolean =>
  block.every((byte) => byte === 0);

/** Every regular file in `archive`, in archive order; pax and GNU long names apply to the entry after them. */
export const readTar = (archive: Uint8Array): TarFile[] => {
  const files: TarFile[] = [];
  let pending: Pending = {};

  for (let at = 0; at + BLOCK <= archive.length;) {
    const block = archive.subarray(at, at + BLOCK);

    if (isZero(block)) break;

    const type = text(block, 156, 1) || '0';
    const extension = EXTENSIONS.has(type);

    const size =
      (extension ? undefined : pending.size) ?? number(block, 124, 12);

    const data = archive.subarray(at + BLOCK, at + BLOCK + size);

    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;

    if (extension) {
      pending = extend(type, data, pending);
      continue;
    }

    const path = pending.path ?? pathOf(block);
    const mode = pending.mode ?? number(block, 100, 8);

    pending = {};

    // node-tar reads a `0` entry whose name ends in a slash as a directory.
    if (type === '0' && !path.endsWith('/'))
      files.push({ path, mode, data: data.slice() });
  }

  return files;
};
