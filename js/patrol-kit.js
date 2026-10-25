// U17b: shared pieces for the patrol zones (js/patrol-moon.js, js/patrol-mars.js, and the zones to come).
import * as THREE from 'three';

/**
 * A marked road: a strip of track laid in short pieces along the points `pts` ([x, z] each), pale cairns on both edges, and a lamp every `gap` metres on
 * alternating sides. Roads are how a patrol zone is read: every beacon, event, camp and meeting sits on one (docs/DECISIONS.md, U17b).
 * o: w (width), gap, color, edge (cairn colour), lamp(K, x, z) (draws one lamp).
 */
export function road(K, pts, o = {}) {
  const w = o.w ?? 7, gap = o.gap ?? 26, color = o.color ?? 0x6f757b, edge = o.edge ?? 0xaab0b6;
  let run = gap / 2, side = 1;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), nx = Math.cos(ry), nz = -Math.sin(ry);
    const n = Math.max(1, Math.round(L / 6));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      K.mesh(new THREE.BoxGeometry(w, 0.05, L / n + 0.4), color, x, 0.04, z, { ry, collide: false });
      if (k % 2 === 0) for (const e of [-1, 1]) K.mesh(new THREE.BoxGeometry(0.22, 0.07, L / n * 0.5), edge, x + nx * e * (w / 2 - 0.3), 0.07, z + nz * e * (w / 2 - 0.3), { ry, collide: false });
    }
    for (let d = run; d < L; d += gap) {
      const t = d / L;
      o.lamp?.(K, x0 + (x1 - x0) * t + nx * side * (w / 2 + 1.2), z0 + (z1 - z0) * t + nz * side * (w / 2 + 1.2));
      side = -side;
    }
    run = gap - ((L - run) % gap);
  }
}

/** A standing torch: a pole with a basket of fire on top, lighting what is round it. For Fallen and Scorn camps and other firelit places. */
export function torch(K, x, z, h = 2.6, power = 8) {
  K.box(x, z, 0.16, h, 0.16, 0x3a2f24);
  K.box(x, z, 0.5, 0.18, 0.5, 0x2a2420, { y: h, collide: false });
  K.cone(x, z, 0.28, 0.7, 0xff9a2a, { y: h + 0.15, sides: 5, collide: false, glow: 2.4 });
  K.cone(x, z, 0.14, 0.45, 0xffe08a, { y: h + 0.3, sides: 4, collide: false, glow: 3 });
  K.light(x, h + 0.7, z, 0xff9a40, power, 20);
}

/** A fire pit: a ring of stones round a low blaze. */
export function firePit(K, x, z, power = 10) {
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; K.box(x + Math.cos(a) * 0.9, z + Math.sin(a) * 0.9, 0.5, 0.35, 0.5, 0x5a5650, { collide: false }); }
  K.cone(x, z, 0.7, 1.1, 0xff8a22, { sides: 6, collide: false, glow: 2.6 });
  K.cone(x, z, 0.35, 0.8, 0xffd860, { y: 0.2, sides: 5, collide: false, glow: 3 });
  K.light(x, 1.4, z, 0xff8a40, power, 24);
}

/** A hanging lantern on a short post. */
export function lantern(K, x, z, h = 1.6) {
  K.box(x, z, 0.12, h, 0.12, 0x3a3228);
  K.box(x, z, 0.34, 0.4, 0.34, 0xffc060, { y: h, collide: false, glow: 2.2 });
  K.light(x, h + 0.4, z, 0xffb050, 5, 14);
}

// ------------------------------------------------------------------ buildings

/**
 * A building you walk into: four walls with door gaps and ruined openings, a roof (full, half or none) with a lit ceiling, strip lights, a window band.
 * o: doors {n,s,e,w: width}, doorOffset {side: metres from the middle}, breaks [[side, from, to]], roof, color, roofColor, ceil, lamp (light colour), lamps (count),
 * t (wall thickness), props(K, cx, cz, w, d, h) to furnish it.
 */
export function hall(K, cx, cz, w, d, h, o = {}) {
  const t = o.t ?? 0.9, color = o.color ?? 0xc9cdd2, doors = o.doors || {}, off = o.doorOffset || {}, lampC = o.lamp ?? 0xbfe4ff;
  const gaps = (side, len) => {
    const g = [];
    if (doors[side]) g.push([len / 2 - doors[side] / 2 + (off[side] ?? 0), len / 2 + doors[side] / 2 + (off[side] ?? 0)]);
    for (const [s, a, b] of o.breaks || []) if (s === side) g.push([a, b]);
    return g;
  };
  K.wall(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, h, { t, color, gaps: gaps('n', w) });
  K.wall(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2, h, { t, color, gaps: gaps('s', w) });
  K.wall(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2, h, { t, color, gaps: gaps('w', d) });
  K.wall(cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h, { t, color, gaps: gaps('e', d) });
  const roof = o.roof ?? 'full', rx = roof === 'half' ? cx - w * 0.2 : cx, rw = roof === 'half' ? w * 0.6 : w;
  if (roof !== 'none') {
    K.box(rx, cz, rw + t, 0.6, d + t, o.roofColor ?? 0x9aa0a7, { y: h });
    K.box(rx, cz, rw - 0.2, 0.08, d - 0.2, o.ceil ?? 0xb7bcc2, { y: h - 0.08, collide: false, glow: 0.4 });
    const n = o.lamps ?? Math.max(1, Math.round(w / 8));
    for (let i = 0; i < n; i++) {
      const lx = rx - rw / 2 + (i + 0.5) * rw / n;
      K.box(lx, cz, Math.min(2.8, rw / n * 0.6), 0.06, 0.34, lampC, { y: h - 0.18, collide: false, glow: 2.2 });
      K.light(lx, h - 0.9, cz, lampC, 8, 20);
    }
  }
  if (o.windows !== false) for (const s of [-1, 1]) K.box(cx, cz + s * (d / 2 + 0.47), w * 0.8, 0.9, 0.06, 0x2b3a46, { y: h * 0.52, collide: false });
  o.props?.(K, cx, cz, w, d, h);
}

export const desk = (K, x, z, alongX = true, c = {}) => { K.box(x, z, alongX ? 2.2 : 0.9, 0.85, alongX ? 0.9 : 2.2, c.body ?? 0x9aa0a7); K.box(x, z, alongX ? 2.0 : 0.7, 0.06, alongX ? 0.7 : 2.0, c.top ?? 0xd5d9de, { y: 0.85, collide: false, glow: 0.3 }); };
export const console_ = (K, x, z, c = {}) => { K.box(x, z, 1.8, 1.1, 0.8, c.body ?? 0x9aa0a7); K.box(x, z + 0.3, 1.5, 0.5, 0.06, c.screen ?? 0xbfe4ff, { y: 1.1, collide: false, glow: 1.4 }); };
export const shelf = (K, x, z, alongX = true, c = {}) => { K.box(x, z, alongX ? 3 : 0.6, 2.2, alongX ? 0.6 : 3, c.shelf ?? 0x6c7277); for (const y of [0.7, 1.4]) K.box(x, z, alongX ? 3.1 : 0.7, 0.08, alongX ? 0.7 : 3.1, c.shelfTop ?? 0x8a9096, { y, collide: false }); };
