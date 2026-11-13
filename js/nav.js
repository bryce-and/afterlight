// Enemy navigation (U13a). A height grid built once per level from the colliders, A* over it,
// and a few pure helpers the enemy AI uses. No wall-scaling: a cell is only reachable from a
// neighbour when the height difference is a step the player could take (NAV.step), so a ledge is a
// firing position only if a ramp or stairs lead to it.
import { G } from './state.js';
import { footprintHit } from './colliders.js';

export const NAV = {
  cell: 1,          // metres per cell
  clearance: 0.55,  // body radius used to keep paths off walls
  step: 0.65,       // largest height change between neighbouring cells
  ledgeMax: 2.2,    // colliders up to this tall are standable surfaces; taller ones are walls
  bodyH: 1.5,       // a collider whose bottom is above this is overhead and does not block
  ledgeMin: 0.9,    // a surface at least this high counts as a ledge (firing position)
  hop: 1.6,         // a unit may hop up onto a ledge this tall (crate, low wall) to take a firing position, or drop down from one; never to reach a target
  hopLen: 3,        // longest hop, metres between cell centres
  maxNodes: 3500,   // A* expansion cap per request
  budget: 3,        // path requests per frame, shared by every enemy
};

/** Build the grid. hgt[i] is the standable height of a cell, or -1 when it is blocked or off the map. */
export function buildNav(colliders, bounds, o = {}) {
  const cell = o.cell ?? NAV.cell, r = o.clearance ?? NAV.clearance;
  const minX = bounds.minX, minZ = bounds.minZ;
  const W = Math.ceil((bounds.maxX - minX) / cell), D = Math.ceil((bounds.maxZ - minZ) / cell);
  const hgt = new Float32Array(W * D);
  const abyss = new Uint8Array(W * D); // U21b: 1 where the cell is the abyss (no floor), so the ledge guard can tell a drop from a wall
  const base = new Float32Array(W * D); // the terrain under each cell (U16e); collider heights below are measured from it
  const blocked = new Uint8Array(W * D);
  const ground = o.ground ?? G.level?.groundAt ?? null, rolling = !!ground; // a flat map keeps the exact old numbers
  const voidAt = o.voidAt ?? G.level?.voidAt ?? null;
  if (rolling) {
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) { const g = ground(minX + (i + 0.5) * cell, minZ + (j + 0.5) * cell); base[j * W + i] = g; hgt[j * W + i] = g; }
  }
  for (const c of colliders) {
    if (!rolling && (c.min.y >= NAV.bodyH || c.max.y <= 0.05)) continue;
    const x0 = Math.max(0, Math.floor((c.min.x - r - minX) / cell)), x1 = Math.min(W - 1, Math.floor((c.max.x + r - minX) / cell));
    const z0 = Math.max(0, Math.floor((c.min.z - r - minZ) / cell)), z1 = Math.min(D - 1, Math.floor((c.max.z + r - minZ) / cell));
    for (let i = x0; i <= x1; i++) {
      for (let j = z0; j <= z1; j++) {
        const cx = minX + (i + 0.5) * cell, cz = minZ + (j + 0.5) * cell, idx = j * W + i, g = base[idx];
        if (c.min.y - g >= NAV.bodyH || c.max.y - g <= 0.05) continue; // overhead, or buried in the terrain
        if (c.max.y - g <= NAV.ledgeMax && footprintHit(c, cx, cz, 0)) { if (c.max.y > hgt[idx]) hgt[idx] = c.max.y; }
        else if (footprintHit(c, cx, cz, r)) blocked[idx] = 1;
      }
    }
  }
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      const idx = j * W + i, cx = minX + (i + 0.5) * cell, cz = minZ + (j + 0.5) * cell;
      const edge = cx < minX + 1 || cx > bounds.maxX - 1 || cz < minZ + 1 || cz > bounds.maxZ - 1; // enemies are clamped 1 m inside the bounds
      const gap = voidAt && hgt[idx] <= base[idx] + 0.05 && voidAt(cx, cz); // U17f: the abyss between islands is no floor (unless something stands in it)
      if (gap) abyss[idx] = 1;
      if (blocked[idx] || edge || gap) hgt[idx] = -1;
    }
  }
  const nav = { cell, minX, minZ, W, D, hgt, base, abyss, links: null };
  addLeapLinks(nav, o.leapLinks ?? G.level?.leapLinks);
  return nav;
}

/**
 * U21b leap links: `[{ a: [x, y, z], b: [x, y, z], two: bool }]`. Each becomes a graph edge between the walkable
 * cells at a and b (both ways when two is true). nav.links maps a cell index to [{ to, ax, az, bx, by, bz }]; a unit
 * that follows a path across one launches a leap from (ax, az) and lands exactly on (bx, by, bz).
 */
export function addLeapLinks(nav, defs) {
  nav.links = null;
  if (!defs?.length) return nav;
  const links = new Map();
  const put = (a, b) => {
    const ca = nearestWalkable(nav, a[0], a[2], 2), cb = nearestWalkable(nav, b[0], b[2], 2);
    if (!ca || !cb || ca.idx === cb.idx) return;
    let arr = links.get(ca.idx); if (!arr) links.set(ca.idx, arr = []);
    arr.push({ to: cb.idx, ax: a[0], az: a[2], bx: b[0], by: b[1], bz: b[2], len: Math.hypot(b[0] - a[0], b[2] - a[2]) });
  };
  for (const d of defs) { put(d.a, d.b); if (d.two) put(d.b, d.a); }
  nav.links = links.size ? links : null;
  return nav;
}

/**
 * U21b ledge guard. May a unit that wants to move on its own from (x0, z0) to (x1, z1) do so? Returns a bitmask:
 * 3 = the whole move, 1 = only the x part, 2 = only the z part, 0 = none. A move is refused when it would put the
 * unit over the abyss, or drop it more than NAV.hop (the same drop the pathfinder allows), so enemies never walk,
 * strafe or get crowd-pushed off a platform. A unit off the grid or already over the abyss (falling) moves freely; pass `y0`
 * (the unit's height) so a unit standing on a platform's edge band is guarded too.
 * Knockback never goes through this, so players can still knock enemies off ledges.
 */
export function ledgeStep(nav, x0, z0, x1, z1, y0) {
  const c0 = cellIndex(nav, x0, z0);
  if (c0 < 0) return 3;
  const h0 = nav.hgt[c0];
  // A unit over the abyss is falling (knocked off): it moves freely. A unit on a non-standable cell that is not the abyss
  // (the edge band of a platform, where a spawn or a knock can leave it) is still guarded, measured from its own height.
  if (h0 < 0 && (nav.abyss?.[c0] || y0 === undefined)) return 3;
  const ref = h0 >= 0 ? h0 : y0;
  const bad = (x, z) => {
    const c = cellIndex(nav, x, z);
    if (c < 0) return false; // the map clamp owns the outer edge
    const h = nav.hgt[c];
    return h < 0 ? !!(nav.abyss ? nav.abyss[c] : 1) : ref - h > NAV.hop;
  };
  if (!bad(x1, z1)) return 3;
  if (!bad(x1, z0)) return 1;
  if (!bad(x0, z1)) return 2;
  return 0;
}

export const cellIndex = (nav, x, z) => {
  const i = Math.floor((x - nav.minX) / nav.cell), j = Math.floor((z - nav.minZ) / nav.cell);
  return i < 0 || j < 0 || i >= nav.W || j >= nav.D ? -1 : j * nav.W + i;
};
/** Standable height at a world point, or -1 when blocked or off the map. */
export const heightAt = (nav, x, z) => { const i = cellIndex(nav, x, z); return i < 0 ? -1 : nav.hgt[i]; };
const cellX = (nav, idx) => nav.minX + ((idx % nav.W) + 0.5) * nav.cell;
const cellZ = (nav, idx) => nav.minZ + (Math.floor(idx / nav.W) + 0.5) * nav.cell;

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/** Can a body step from cell a to its neighbour b (di, dj)? Diagonals may not cut a blocked corner. */
function canStep(nav, a, di, dj) {
  const { W, D, hgt } = nav;
  const i = a % W, j = (a - i) / W, ni = i + di, nj = j + dj;
  if (ni < 0 || nj < 0 || ni >= W || nj >= D) return -1;
  const b = nj * W + ni, hb = hgt[b], ha = hgt[a];
  if (hb < 0 || hb - ha > NAV.step || ha - hb > NAV.hop) return -1; // up only by steps; down by a drop of up to a hop
  if (di && dj) {
    const s1 = j * W + ni, s2 = nj * W + i;
    if (hgt[s1] < 0 || hgt[s2] < 0 || hgt[s1] - ha > NAV.step || hgt[s2] - ha > NAV.step) return -1;
  }
  return b;
}

/** Nearest walkable cell centre to (x, z) within rad cells, or null. */
export function nearestWalkable(nav, x, z, rad = 4) {
  const c = cellIndex(nav, x, z);
  if (c >= 0 && nav.hgt[c] >= 0) return { x, z, idx: c };
  const ci = Math.floor((x - nav.minX) / nav.cell), cj = Math.floor((z - nav.minZ) / nav.cell);
  let best = null, bd = Infinity;
  for (let dj = -rad; dj <= rad; dj++) {
    for (let di = -rad; di <= rad; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= nav.W || j >= nav.D || nav.hgt[j * nav.W + i] < 0) continue;
      const px = nav.minX + (i + 0.5) * nav.cell, pz = nav.minZ + (j + 0.5) * nav.cell;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; best = { x: px, z: pz, idx: j * nav.W + i }; }
    }
  }
  return best;
}

/** True when the straight segment stays on walkable cells with only small height changes. */
export function lineClear(nav, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / (nav.cell * 0.4)));
  let prev = heightAt(nav, x0, z0);
  if (prev < 0) return false;
  for (let k = 1; k <= n; k++) {
    const t = k / n, h = heightAt(nav, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
    if (h < 0 || h - prev > NAV.step || prev - h > NAV.hop) return false;
    prev = h;
  }
  return true;
}

// ---- binary heap keyed by f ----
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n, f) {
    const a = this.a; a.push([n, f]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][1] <= a[i][1]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][1] < a[m][1]) m = l;
        if (r < a.length && a[r][1] < a[m][1]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top[0];
  }
}

/**
 * A* from (sx, sz) to (gx, gz). Returns { pts: [{x, z}], partial } or null. The path is string-pulled
 * (waypoints only where the straight line stops being clear). When the goal can't be reached it
 * returns the explored cell nearest to it with partial = true, so a unit still closes in as far as it can.
 */
export function findPath(nav, sx, sz, gx, gz) {
  const s = nearestWalkable(nav, sx, sz, 3), g = nearestWalkable(nav, gx, gz, 6);
  if (!s || !g) return null;
  if (s.idx === g.idx) return { pts: [{ x: gx, z: gz }], partial: false };
  const { W, hgt } = nav;
  const gi = g.idx % W, gj = (g.idx - gi) / W;
  const hOf = (n) => { const i = n % W, j = (n - i) / W, dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
  const cost = new Map([[s.idx, 0]]), from = new Map(), closed = new Set(), via = nav.links ? new Map() : null; // via: cell -> the leap link used to reach it
  const open = new Heap(); open.push(s.idx, hOf(s.idx));
  let best = s.idx, bestH = hOf(s.idx), expanded = 0, found = false;
  while (open.size) {
    const n = open.pop();
    if (closed.has(n)) continue;
    if (n === g.idx) { found = true; best = n; break; }
    closed.add(n);
    if (++expanded > NAV.maxNodes) break;
    const hn = hOf(n);
    if (hn < bestH) { bestH = hn; best = n; }
    for (const [di, dj, w] of DIRS) {
      const b = canStep(nav, n, di, dj);
      if (b < 0 || closed.has(b)) continue;
      const c = cost.get(n) + w + Math.abs(hgt[b] - hgt[n]) * 0.5;
      if (c < (cost.get(b) ?? Infinity)) { cost.set(b, c); from.set(b, n); via?.delete(b); open.push(b, c + hOf(b)); }
    }
    const ls = nav.links?.get(n);
    if (ls) for (const L of ls) {
      if (closed.has(L.to)) continue;
      const c = cost.get(n) + L.len + 2 + Math.abs(hgt[L.to] - hgt[n]) * 0.5; // a leap costs its length plus a little, so a walk is preferred when there is one
      if (c < (cost.get(L.to) ?? Infinity)) { cost.set(L.to, c); from.set(L.to, n); via.set(L.to, L); open.push(L.to, c + hOf(L.to)); }
    }
  }
  const cells = [best];
  while (from.has(cells[cells.length - 1])) cells.push(from.get(cells[cells.length - 1]));
  cells.reverse();
  const raw = cells.map((c) => ({ x: cellX(nav, c), z: cellZ(nav, c) }));
  if (found) raw[raw.length - 1] = { x: gx, z: gz };
  // string-pull: keep a waypoint only where the line from the last kept one to the next would be blocked.
  // A leap edge is never pulled across: the run before it ends at the launch point, then comes one waypoint
  // flagged `leap` that holds the launch point (ax, az) and the exact landing (x, y, z).
  const pts = [];
  const leapAt = (k) => !!via && k + 1 < cells.length && via.has(cells[k + 1]) && from.get(cells[k + 1]) === cells[k]; // is cells[k] -> cells[k + 1] a leap?
  let a = 0;
  while (a < raw.length - 1) {
    if (leapAt(a)) { const L = via.get(cells[a + 1]); pts.push({ x: L.bx, z: L.bz, y: L.by, leap: true, ax: L.ax, az: L.az }); a++; continue; }
    let end = raw.length - 1;
    if (via) for (let k = a; k < raw.length - 1; k++) if (leapAt(k)) { end = k; break; }
    let b = end;
    while (b > a + 1 && !lineClear(nav, raw[a].x, raw[a].z, raw[b].x, raw[b].z)) b--;
    pts.push(raw[b]); a = b;
  }
  return { pts, partial: !found };
}

/** Flood fill: cells reachable from (x, z) by legal steps. Used once per zone to find ledges worth standing on. */
export function floodReach(nav, x, z) {
  const s = nearestWalkable(nav, x, z, 6), seen = new Uint8Array(nav.W * nav.D);
  if (!s) return seen;
  const q = [s.idx]; seen[s.idx] = 1;
  for (let h = 0; h < q.length; h++) {
    for (const [di, dj] of DIRS) {
      const b = canStep(nav, q[h], di, dj);
      if (b >= 0 && !seen[b]) { seen[b] = 1; q.push(b); }
    }
  }
  return seen;
}

/**
 * Firing positions: ledge cells (ledgeMin to hop tall) near (cx, cz), sampled every `every` cells. A spot
 * is `from: null` when ordinary steps lead onto it; otherwise `from` is the reachable ground point a unit
 * hops up from (within hopLen). Spots with neither are unreachable and left out.
 */
export function ledgeSpots(nav, reach, cx, cz, rad, every = 2) {
  const out = [];
  const i0 = Math.floor((cx - rad - nav.minX) / nav.cell), i1 = Math.floor((cx + rad - nav.minX) / nav.cell);
  const j0 = Math.floor((cz - rad - nav.minZ) / nav.cell), j1 = Math.floor((cz + rad - nav.minZ) / nav.cell);
  const R = Math.ceil(NAV.hopLen / nav.cell);
  for (let j = Math.max(0, j0); j <= Math.min(nav.D - 1, j1); j += every) {
    for (let i = Math.max(0, i0); i <= Math.min(nav.W - 1, i1); i += every) {
      const idx = j * nav.W + i, h = nav.hgt[idx] - nav.base[idx]; // height above the terrain
      if (h < NAV.ledgeMin || h > NAV.hop) continue;
      const x = nav.minX + (i + 0.5) * nav.cell, z = nav.minZ + (j + 0.5) * nav.cell;
      if ((x - cx) ** 2 + (z - cz) ** 2 > rad * rad) continue;
      if (reach[idx]) { out.push({ x, z, h, from: null }); continue; }
      let from = null, bd = Infinity;
      for (let dj = -R; dj <= R; dj++) {
        for (let di = -R; di <= R; di++) {
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= nav.W || nj >= nav.D) continue;
          const nb = nj * nav.W + ni, hn = nav.hgt[nb] - nav.base[nb];
          if (nav.hgt[nb] < 0 || !reach[nb] || hn > NAV.step || h - hn > NAV.hop) continue; // hop up from the floor, not from another ledge
          const d = Math.hypot(di, dj) * nav.cell;
          if (d <= NAV.hopLen && d < bd) { bd = d; from = { x: nav.minX + (ni + 0.5) * nav.cell, z: nav.minZ + (nj + 0.5) * nav.cell }; }
        }
      }
      if (from) out.push({ x, z, h, from });
    }
  }
  return out;
}
