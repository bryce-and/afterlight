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
    // H17: 3 m pieces, each pitched to the slope between its ends (as Io's tstrip), so the track lies on the ground instead of stepping off it
    const n = Math.max(1, Math.ceil(L / 3)), seg = L / n;
    for (let k = 0; k < n; k++) {
      const ax = x0 + (x1 - x0) * k / n, az = z0 + (z1 - z0) * k / n, bx = x0 + (x1 - x0) * (k + 1) / n, bz = z0 + (z1 - z0) * (k + 1) / n;
      laid(K, ax, az, bx, bz, w, color, { y: 0.04, h: 0.05, over: 0.3 });
      if (k % 2 === 0) for (const e of [-1, 1]) {
        const ox = nx * e * (w / 2 - 0.3), oz = nz * e * (w / 2 - 0.3);
        laid(K, ax + ox, az + oz, bx + ox, bz + oz, 0.22, edge, { y: 0.07, h: 0.07 });
      }
    }
    for (let d = run; d < L; d += gap) {
      const t = d / L;
      o.lamp?.(K, x0 + (x1 - x0) * t + nx * side * (w / 2 + 1.2), z0 + (z1 - z0) * t + nz * side * (w / 2 + 1.2));
      side = -side;
    }
    run = gap - ((L - run) % gap);
  }
}

/**
 * H17: a flat strip from (x0, z0) to (x1, z1) laid on the terrain: 3 m pieces, each pitched to the ground between its ends, so it never steps
 * off a slope. For roads, cracks, seams and painted lines. o: y (height above the ground), h (thickness), over (extra length per piece), glow.
 */
export function laid(K, x0, z0, x1, z1, w, color, o = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 3)), yaw = Math.atan2(-(z1 - z0), x1 - x0);
  const piece = (ax, az, bx, bz) => {
    const seg = Math.hypot(bx - ax, bz - az), ga = K.ground(ax, az), gb = K.ground(bx, bz), mx = (ax + bx) / 2, mz = (az + bz) / 2, gm = K.ground(mx, mz);
    const bend = Math.max(...[0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((f) => Math.abs(K.ground(ax + (bx - ax) * f, az + (bz - az) * f) - (ga + (gb - ga) * f))));
    if (bend > 0.12 && seg > 0.8) { piece(ax, az, mx, mz); piece(mx, mz, bx, bz); return; } // the ground bends here: halve it
    K.mesh(new THREE.BoxGeometry(seg + (o.over ?? 0), o.h ?? 0.05, w), color, mx, (o.y ?? 0.04) + (ga + gb) / 2 - gm, mz, { ry: yaw, rz: Math.atan2(gb - ga, seg), collide: false, glow: o.glow }).userData.noCollide = true; // a decal on the ground
  };
  for (let k = 0; k < n; k++) piece(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, x0 + (x1 - x0) * (k + 1) / n, z0 + (z1 - z0) * (k + 1) / n);
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
