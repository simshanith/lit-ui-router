import { iso } from './helpers.mjs';

// A LEGO brick kit at one stud pitch U: plates, bricks and studs projected on the
// atlas iso, plus a painter's order for seated assemblies. Every face is drawn
// opaque — a stroke class's fill:none outranks a fill attribute, so fills are inline.
export function brickKit({ U = 40, p = 's2' } = {}) {
  const K = U / 40;
  const CRS = 24 * K, PT = 12 * K, SH = 7 * K, SR = 12 * K;
  const RX = +(SR * Math.SQRT2 * 0.866).toFixed(2);
  const RY = +(SR * Math.SQRT2 * 0.5).toFixed(2);
  const pt = (ox, oy, x, y, z = 0) => iso(x, y, z).map((v, i) => +((i ? oy : ox) + v).toFixed(1));
  const p2 = (ox, oy, x, y, z = 0) => pt(ox, oy, x, y, z).join(',');
  const face = (pts, cls, fill, { under = null, extra = '' } = {}) =>
    (under ? `<polygon points="${pts}" stroke="none" style="fill:${under}"/>\n` : '')
    + `<polygon points="${pts}" class="${cls}"${extra} style="fill:${fill}"/>`;

  // One stud: an iso cylinder — swept side wall under an ellipse cap.
  function stud(ox, oy, x, y, z, { edge = 'sks', cap = 'fp2', ring = null, extra = '' } = {}) {
    const [cx, cy] = pt(ox, oy, x, y, z + SH);
    const by = +(cy + SH).toFixed(1);
    const halo = ring
      ? `<ellipse cx="${cx}" cy="${cy}" rx="${(RX + 5.5 * K).toFixed(1)}" ry="${(RY + 3.2 * K).toFixed(1)}" class="${ring} fnone"/>`
      : '';
    return `<path d="M${cx - RX},${cy} L${cx - RX},${by} A${RX},${RY} 0 0 0 ${cx + RX},${by} L${cx + RX},${cy} Z" class="${edge}"${extra} style="fill:var(--paper-2)"/>
<ellipse cx="${cx}" cy="${cy}" rx="${RX}" ry="${RY}" class="${edge} ${cap}"${extra}/>${halo}`;
  }

  // One brick body: three faces, course seams scored on both visible flanks, studs on the cap.
  function brick(ox, oy, x, y, ws, ds, courses, { z0 = 0, edge = 'sk', cap = 'fp', side, studCap = 'fp2', studEdge, ringStuds = new Set(), dash = '' } = {}) {
    const w = ws * U, d = ds * U, h = courses * CRS, t = z0 + h;
    const q = (px, py, pz) => p2(ox, oy, px, py, pz);
    const da = dash ? ` stroke-dasharray="${dash}"` : '';
    const top = [q(x, y, t), q(x + w, y, t), q(x + w, y + d, t), q(x, y + d, t)].join(' ');
    const left = [q(x, y + d, t), q(x + w, y + d, t), q(x + w, y + d, z0), q(x, y + d, z0)].join(' ');
    const right = [q(x + w, y, t), q(x + w, y + d, t), q(x + w, y + d, z0), q(x + w, y, z0)].join(' ');
    const seams = [];
    for (let k = 1; k < courses; k++) {
      const z = z0 + k * CRS;
      const a = pt(ox, oy, x, y + d, z), b = pt(ox, oy, x + w, y + d, z), c = pt(ox, oy, x + w, y, z);
      seams.push(`<path d="M${a} L${b} L${c}" class="skf fnone"/>`);
    }
    const studs = [];
    for (let i = 0; i < ws; i++)
      for (let j = 0; j < ds; j++)
        studs.push(stud(ox, oy, x + (i + 0.5) * U, y + (j + 0.5) * U, t, ringStuds.has(`${i},${j}`) ? { edge: 'ska', cap: 'fp', ring: 'ska', extra: da } : { edge: studEdge ?? edge, cap: studCap, extra: da }));
    return `${face(left, edge, 'var(--paper-2)', { extra: da })}
${face(right, edge, side ?? `url(#${p}-hx)`, { under: 'var(--paper)', extra: da })}
<polygon points="${top}" class="${edge} ${cap}"${da}/>
${seams.join('\n')}
${studs.join('\n')}`;
  }

  // A baseplate: a thin slab carrying its stud grid; `covered` studs are not drawn.
  function plate(ox, oy, cols, rows, { x = 0, y = 0, z0 = 0, edge = 'sk', dash = '', named = new Map(), covered = () => false } = {}) {
    const w = cols * U, d = rows * U, t = z0 + PT;
    const q = (px, py, pz) => p2(ox, oy, px, py, pz);
    const top = [q(x, y, t), q(x + w, y, t), q(x + w, y + d, t), q(x, y + d, t)].join(' ');
    const left = [q(x, y + d, t), q(x + w, y + d, t), q(x + w, y + d, z0), q(x, y + d, z0)].join(' ');
    const right = [q(x + w, y, t), q(x + w, y + d, t), q(x + w, y + d, z0), q(x + w, y, z0)].join(' ');
    const da = dash ? ` stroke-dasharray="${dash}"` : '';
    const studs = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        if (covered(i, j)) continue;
        const k = named.get(`${i},${j}`);
        studs.push(stud(ox, oy, x + (i + 0.5) * U, y + (j + 0.5) * U, t, { ...(k ?? {}), extra: da }));
      }
    return `${face(left, edge, 'var(--paper-2)', { extra: da })}
${face(right, edge, `url(#${p}-hx)`, { under: 'var(--paper)', extra: da })}
<polygon points="${top}" class="${edge} fp"${da}/>
${studs.join('\n')}`;
  }

  // A plain block with no studs: ground.
  function block(ox, oy, x, y, w, d, z0, h, { edge = 'sk', side } = {}) {
    const q = (px, py, pz) => p2(ox, oy, px, py, pz), t = z0 + h;
    return `${face([q(x, y + d, t), q(x + w, y + d, t), q(x + w, y + d, z0), q(x, y + d, z0)].join(' '), edge, 'var(--paper-2)')}
${face([q(x + w, y, t), q(x + w, y + d, t), q(x + w, y + d, z0), q(x + w, y, z0)].join(' '), edge, side ?? `url(#${p}-hx)`, { under: 'var(--paper)' })}
<polygon points="${[q(x, y, t), q(x + w, y, t), q(x + w, y + d, t), q(x, y + d, t)].join(' ')}" class="${edge} fp"/>`;
  }

  return { U, CRS, PT, SH, RX, RY, pt, p2, face, stud, brick, plate, block };
}

// Rotate a plan rect a quarter turn counter-clockwise, `turn` times: the same
// model seen from the next iso corner. Stud indices turn with it.
export function turnRect({ x, y, w, d }, turn) {
  let r = { x, y, w, d };
  for (let k = 0; k < (turn % 4 + 4) % 4; k++) r = { x: -r.y - r.d, y: r.x, w: r.d, d: r.w };
  return r;
}
export function turnStud([i, j], [ws, ds], turn) {
  let s = [i, j], sh = [ws, ds];
  for (let k = 0; k < (turn % 4 + 4) % 4; k++) { s = [sh[1] - 1 - s[1], s[0]]; sh = [sh[1], sh[0]]; }
  return s;
}

// Painter's order for seated boxes {x,y,w,d,z0,h}: a box separated from another
// along +x, +y or +z is in front of it; the pairwise edges are topologically sorted,
// and a cycle falls back to far-corner order.
export function paintOrder(boxes) {
  const n = boxes.length, after = Array.from({ length: n }, () => new Set());
  const E = 0.01;
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const A = boxes[a], B = boxes[b];
      const front = A.x >= B.x + B.w - E || A.y >= B.y + B.d - E || A.z0 >= B.z0 + B.h - E;
      const behind = B.x >= A.x + A.w - E || B.y >= A.y + A.d - E || B.z0 >= A.z0 + A.h - E;
      if (front && !behind) after[b].add(a);   // A is in front: B first
    }
  const indeg = after.map(() => 0);
  for (const s of after) for (const v of s) indeg[v]++;
  const order = [], ready = boxes.map((_, i) => i).filter((i) => !indeg[i]);
  const key = (i) => boxes[i].x + boxes[i].w + boxes[i].y + boxes[i].d + boxes[i].z0;
  while (ready.length) {
    ready.sort((i, j) => key(i) - key(j));
    const i = ready.shift();
    order.push(i);
    for (const v of after[i]) if (!--indeg[v]) ready.push(v);
  }
  if (order.length !== n) throw new Error('brick-iso: the painter’s order has a cycle — split a box');
  return order;
}

// A seated assembly: parts are {id, kind:'ground'|'plate'|'brick', x, y, ws, ds,
// h|courses, z0, on, rings, named, dash, edge} in U-40 plan units; a part with `on`
// stands on that part's top. Returns the drawing's extent and a placer; a plate
// standing on nothing drops masts.
export function seated(parts, { U = 40, turn = 0, p = 's2', pad = 12 } = {}) {
  const kit = brickKit({ U, p });
  const K = U / 40;
  const byId = new Map(parts.map((m) => [m.id, m]));
  const hOf = (m) => (m.kind === 'ground' ? m.h : m.kind === 'plate' ? 12 : m.courses * 24);
  const z0Of = (m) => (m.on ? z0Of(byId.get(m.on)) + hOf(byId.get(m.on)) : m.z0 ?? 0);
  const boxes = parts.map((m) => ({ ...turnRect({ x: m.x, y: m.y, w: m.ws * 40, d: m.ds * 40 }, turn), z0: z0Of(m), h: hOf(m), m }));
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const see = (x, y, z) => {
    const [sx, sy] = kit.pt(0, 0, x * K, y * K, z * K);
    minx = Math.min(minx, sx); maxx = Math.max(maxx, sx); miny = Math.min(miny, sy - kit.SH); maxy = Math.max(maxy, sy);
  };
  for (const b of boxes) {
    for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.d], [b.x + b.w, b.y + b.d]]) { see(x, y, b.z0); see(x, y, b.z0 + b.h); }
    if (b.m.kind === 'plate' && b.z0 > 0 && !b.m.on) see(b.x + b.w, b.y + b.d, 0);
  }
  const ox = pad - minx, oy = pad - miny;
  const out = [];
  for (const i of paintOrder(boxes)) {
    const b = boxes[i], m = b.m, shape = [m.ws, m.ds];
    const turnKey = (k) => turnStud(k.split(',').map(Number), shape, turn).join(',');
    if (m.kind === 'ground') {
      out.push(kit.block(ox, oy, b.x * K, b.y * K, b.w * K, b.d * K, b.z0 * K, b.h * K, { edge: m.edge ?? 'sk', side: m.side }));
    } else if (m.kind === 'plate') {
      const named = new Map([...(m.named ?? new Map())].map(([k, v]) => [turnKey(k), v]));
      const on = boxes.filter((o) => o.m.kind === 'brick' && o.m.on === m.id);
      const covered = (i2, j2) => {
        const cx = b.x + (i2 + 0.5) * 40, cy = b.y + (j2 + 0.5) * 40;
        return on.some((o) => cx > o.x && cx < o.x + o.w && cy > o.y && cy < o.y + o.d);
      };
      if (b.z0 > 0 && !m.on)
        for (const [cx, cy] of [[b.x + b.w, b.y + b.d], [b.x + b.w, b.y], [b.x, b.y + b.d]]) {
          const [x1, y1] = kit.pt(ox, oy, cx * K, cy * K, b.z0 * K), [x2, y2] = kit.pt(ox, oy, cx * K, cy * K, 0);
          out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="sks" stroke-dasharray="2 3"/>`);
        }
      out.push(kit.plate(ox, oy, b.w / 40, b.d / 40, { x: b.x * K, y: b.y * K, z0: b.z0 * K, edge: m.edge ?? 'sk', dash: m.dash ?? '', named, covered }));
    } else {
      out.push(kit.brick(ox, oy, b.x * K, b.y * K, b.w / 40, b.d / 40, m.courses, { z0: b.z0 * K, studEdge: 'sk', ringStuds: new Set((m.rings ?? []).map(turnKey)) }));
    }
  }
  const w = +(maxx - minx + 2 * pad).toFixed(1), h = +(maxy - miny + 2 * pad).toFixed(1);
  return { w, h, at: (dx, dy) => `<g transform="translate(${dx},${dy})">\n${out.join('\n')}\n</g>` };
}
