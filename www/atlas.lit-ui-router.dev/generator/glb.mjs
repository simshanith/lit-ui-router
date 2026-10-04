// A dependency-free glTF 2.0 binary container: accessors packed into one buffer,
// the GLB framing around the JSON and the binary chunk, and the small mesh
// vocabulary the atlas's models share (a flat-shaded triangle soup, its quads and
// segments, a graded box) and a PNG writer for pattern tiles. brick-glb.mjs and
// city-glb.mjs write their scenes with it.
import { deflateSync } from 'node:zlib';

/** sRGB channel (0–1) to linear: glTF colour factors are linear. */
export const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** A `#RRGGBB` token as a linear [r, g, b], rounded to five places. */
export const rgb = (hex) => [1, 3, 5].map((i) => +lin(parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5));

const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** Per-axis min and max of a flat xyz array, as float32 values. */
export function bounds(flat) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < flat.length; i += 3)
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], flat[i + k]); max[k] = Math.max(max[k], flat[i + k]); }
  return { min: min.map((v) => Math.fround(v)), max: max.map((v) => Math.fround(v)) };
}

/** One binary buffer and the bufferViews and accessors that slice it. */
export function glbWriter() {
  const chunks = [];
  let offset = 0;
  const bufferViews = [], accessors = [];
  const push = (typed, target, byteStride) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(byteStride ? { byteStride } : {}), ...(target ? { target } : {}) });
    chunks.push(bytes, Buffer.alloc(pad));
    offset += bytes.length + pad;
    return bufferViews.length - 1;
  };
  /** An accessor over `typed`; `extra` carries min/max or `normalized`. */
  const accessor = (typed, type, componentType, target, extra) => {
    const count = typed.length / WIDTH[type];
    accessors.push({ bufferView: push(typed, target), componentType, count, type, ...extra });
    return accessors.length - 1;
  };
  /** A second accessor over a view already written: a shared index pattern, read to `count`. */
  const over = (view, componentType, count, type, extra) => {
    accessors.push({ bufferView: view, componentType, count, type, ...extra });
    return accessors.length - 1;
  };
  /** Triangle or line indices, 16-bit while the vertex count allows it. */
  const indices = (idx, vertices) => {
    const big = vertices > 65535;
    return accessor(big ? new Uint32Array(idx) : new Uint16Array(idx), 'SCALAR', big ? 5125 : 5123, 34963);
  };
  return { accessors, bufferViews, accessor, over, view: push, indices, bin: () => Buffer.concat(chunks) };
}

/** The GLB framing: header, the JSON chunk space-padded, the binary chunk. */
export function packGlb(gltf, bin) {
  const json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPad = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPad.length + 8 + bin.length, 8);
  const chunk = (type, body) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(body.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, body]);
  };
  return Buffer.concat([header, chunk(0x4e4f534a, jsonPad), chunk(0x004e4942, bin)]);
}

/** Reads a GLB back into its JSON and binary chunk. */
export function readGlb(glb) {
  if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error('glb: not a glTF binary');
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
  const binAt = 20 + jsonLen;
  return { json, bin: glb.subarray(binAt + 8, binAt + 8 + glb.readUInt32LE(binAt)) };
}

// One primitive's triangle soup: flat-shaded, so every face carries its own vertices.
export function soup() {
  return { pos: [], nrm: [], idx: [], col: [], lines: false };
}
// `shade` is a brightness per corner, multiplied into the material as COLOR_0
export function quad(s, a, b, c, d, shade = [1, 1, 1, 1]) {
  const u = a.map((v, i) => b[i] - v), w = a.map((v, i) => d[i] - v);
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const l = Math.hypot(...n);
  const base = s.pos.length / 3;
  [a, b, c, d].forEach((p, i) => { s.pos.push(...p); s.nrm.push(n[0] / l, n[1] / l, n[2] / l); s.col.push(shade[i], shade[i], shade[i]); });
  s.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
export function segment(s, a, b) {
  const base = s.pos.length / 3;
  s.pos.push(...a, ...b);
  s.idx.push(base, base + 1);
}

// A box in node-local units [0..w] × [0..h] × [0..d]: top to `top`, the rest to `side`.
// Winding is counter-clockwise seen from outside. Every face is graded: the cap from
// its near corner across to the far one, each flank from its top edge down.
const CAP_FAR = 0.82, FLANK_FOOT = 0.7;
export function box(top, side, w, h, d) {
  const P = (x, y, z) => [x, y, z];
  const cap = (x, z) => 1 - (1 - CAP_FAR) * ((x / w + z / d) / 2);
  const foot = (y) => (y === h ? 1 : FLANK_FOOT);
  const flank = (a, b, c, e) => quad(side, a, b, c, e, [a, b, c, e].map((v) => foot(v[1])));
  quad(top, P(0, h, 0), P(0, h, d), P(w, h, d), P(w, h, 0), [cap(0, 0), cap(0, d), cap(w, d), cap(w, 0)]);
  quad(side, P(0, 0, 0), P(w, 0, 0), P(w, 0, d), P(0, 0, d), [FLANK_FOOT, FLANK_FOOT, FLANK_FOOT, FLANK_FOOT]);
  flank(P(0, 0, d), P(w, 0, d), P(w, h, d), P(0, h, d));
  flank(P(w, 0, 0), P(0, 0, 0), P(0, h, 0), P(w, h, 0));
  flank(P(w, 0, d), P(w, 0, 0), P(w, h, 0), P(w, h, d));
  flank(P(0, 0, 0), P(0, 0, d), P(0, h, d), P(0, h, 0));
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
/** An RGBA image as PNG bytes: `rgba` is width × height × 4, row by row from the top. */
export function pngRgba(width, height, rgba) {
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
