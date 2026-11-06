// Dev-only clearance audit (H19). Run on a built level with globalThis.__traceBuild = true set before the build (tools/maptest.sh does this),
// so js/world.js lists every wall doorway and platform deck in globalThis.__openings.
//   blocked: a visible piece reaching into a doorway (the gap in a K.wall / K.room wall, 0.6 m either side of it, body height) or into the
//            walking space over a narrow deck (a catwalk, balcony or bridge built with K.platform, 8 m or narrower)
//   posts:   a thin upright piece (a rail post, a lamp pole) standing on nothing: more than 0.25 m over whatever is under it.
//            The float check lets anything that hangs over 1.2 m everywhere pass as an overhead piece, so a whole rail lifted 2.4 m
//            off a walkway slipped through it.
// Returns { blocked: [...], posts: [...] }, each item { at, n (metres: how far into the doorway or deck, or the gap under a post), what, src, in }.
import * as THREE from 'three';

const STEP = 0.25, CELL = 4;
const _v = new THREE.Vector3();

function pieces(scene, skip, any = false) {
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible || skip.has(o) || !o.geometry) return;
    if (!any && o.material?.isMeshBasicMaterial) return; // bulbs, beams of light (still counted as something a post can stand on)
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = new THREE.Box3().setFromObject(o);
    if (bb.max.x - bb.min.x > 150 || bb.max.z - bb.min.z > 150) return; // ground, sky, sea
    out.push({ o, bb, inv: o.matrixWorld.clone().invert(), lb: o.geometry.boundingBox });
  });
  return out;
}

const inside = (e, p) => {
  if (p.x < e.bb.min.x || p.x > e.bb.max.x || p.y < e.bb.min.y || p.y > e.bb.max.y || p.z < e.bb.min.z || p.z > e.bb.max.z) return false;
  _v.copy(p).applyMatrix4(e.inv);
  const b = e.lb, k = e.o.geometry.type === 'BoxGeometry' ? 0 : 0.15; // round shapes: allow their box corners
  const sx = (b.max.x - b.min.x) * k, sz = (b.max.z - b.min.z) * k;
  return _v.x > b.min.x + sx && _v.x < b.max.x - sx && _v.y > b.min.y && _v.y < b.max.y && _v.z > b.min.z + sz && _v.z < b.max.z - sz;
};

function hash(list) {
  const g = new Map(), key = (i, j) => i * 92821 + j;
  for (const it of list)
    for (let i = Math.floor(it.bb.min.x / CELL); i <= Math.floor(it.bb.max.x / CELL); i++)
      for (let j = Math.floor(it.bb.min.z / CELL); j <= Math.floor(it.bb.max.z / CELL); j++) (g.get(key(i, j)) || g.set(key(i, j), []).get(key(i, j))).push(it);
  return (x, z) => g.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
}

const f1 = (v) => v.toFixed(1);
const size = (bb) => f1(bb.max.x - bb.min.x) + 'x' + f1(bb.max.y - bb.min.y) + 'x' + f1(bb.max.z - bb.min.z);

export function auditClearance(G) {
  G.scene.updateMatrixWorld(true);
  const L = G.level, ga = L.groundAt || (() => 0), b = L.bounds;
  const open = globalThis.__openings || [];
  const skip = new Set();
  for (const d of L.doors || []) { skip.add(d.mesh); if (d.stripe) skip.add(d.stripe); } // door blocks belong in their doorway
  const all = pieces(G.scene, skip), near = hash(all);
  const hits = new Map(); // piece + opening -> { n, at, in, lo, hi (reach along the doorway, or into the deck) }
  // on a deck only a piece that crosses the deck's edge counts (a wall or beam through a catwalk); a prop standing on the deck is placed there
  const crosses = (e, op) => e.bb.min.x < op.x - op.w / 2 - 0.3 || e.bb.max.x > op.x + op.w / 2 + 0.3 || e.bb.min.z < op.z - op.d / 2 - 0.3 || e.bb.max.z > op.z + op.d / 2 + 0.3;
  // a slab (thinnest along its own up axis, under 0.6 m) is a floor, a ramp or a step: walked on, not in the way
  const slab = (e) => {
    const g = e.lb, sc = e.o.scale, d = [(g.max.x - g.min.x) * sc.x, (g.max.y - g.min.y) * sc.y, (g.max.z - g.min.z) * sc.z];
    return d[1] <= 0.6 && d[1] <= d[0] && d[1] <= d[2] && Math.abs(e.o.rotation.x) < 0.5 && Math.abs(e.o.rotation.z) < 0.5;
  };
  // on a deck only a wall-like piece counts (long and thin: a wall, a rail or a beam running across it); stacked tiers, pillars and props are placed
  const wallish = (e) => { const a = e.bb.max.x - e.bb.min.x, c = e.bb.max.z - e.bb.min.z; return Math.max(a, c) >= 3 && Math.min(a, c) <= 1.2; };
  const probe = (p, op, along, exclude, deck) => {
    for (const e of near(p.x, p.z)) {
      if (e.o === exclude || (deck && (!crosses(e, deck) || !wallish(e))) || slab(e) || !inside(e, p)) continue;
      const k = e.o.uuid + '|' + open.indexOf(op);
      const r = hits.get(k) || hits.set(k, { n: 0, at: [p.x, p.y, p.z], op, e, lo: Infinity, hi: -Infinity }).get(k);
      r.n++; r.lo = Math.min(r.lo, along); r.hi = Math.max(r.hi, along);
    }
  };
  // a doorway closed by an invisible barrier across its whole width (a sealed dock bay) is not a way through
  const doorCols = new Set((L.doors || []).map((d) => d.collider));
  const sealed = (op) => G.colliders.some((c) => {
    if (doorCols.has(c)) return false;
    const mx = op.horiz ? (op.a0 + op.a1) / 2 : op.fixed, mz = op.horiz ? op.fixed : (op.a0 + op.a1) / 2, y = ga(mx, mz) + op.y + 1.2;
    if (y < c.min.y || y > c.max.y) return false;
    return op.horiz ? c.min.x <= op.a0 + 0.2 && c.max.x >= op.a1 - 0.2 && c.min.z <= mz && c.max.z >= mz
      : c.min.z <= op.a0 + 0.2 && c.max.z >= op.a1 - 0.2 && c.min.x <= mx && c.max.x >= mx;
  });
  for (const op of open) {
    if (op.kind === 'door') {
      const span = op.a1 - op.a0, depth = op.t / 2 + 0.6;
      if (span < 0.8 || sealed(op)) continue;
      for (let s = op.a0 + 0.15; s <= op.a1 - 0.15 + 1e-6; s += STEP)
        for (let q = -depth; q <= depth + 1e-6; q += STEP) {
          const x = op.horiz ? s : op.fixed + q, z = op.horiz ? op.fixed + q : s, g = ga(x, z) + op.y;
          for (const h of [0.8, 1.3, 1.8, 2.1]) if (h < op.h - 0.15) probe(new THREE.Vector3(x, g + h, z), op, s);
        }
    } else if (op.kind === 'deck' && Math.min(op.w, op.d) <= 8) {
      const ix = op.w / 2 - 0.7, iz = op.d / 2 - 0.7;
      if (ix <= 0 || iz <= 0) continue;
      for (let x = op.x - ix; x <= op.x + ix + 1e-6; x += STEP)
        for (let z = op.z - iz; z <= op.z + iz + 1e-6; z += STEP)
          for (const h of [0.8, 1.3, 1.8]) probe(new THREE.Vector3(x, op.top + h, z), op, Math.min(op.w / 2 - Math.abs(x - op.x), op.d / 2 - Math.abs(z - op.z)), op.mesh, op);
    }
  }
  // a doorway piece that fills the whole span is a sill, lintel, window infill or a gateway on purpose, not something in the way; one that
  // reaches less than 0.6 m in from a jamb is a wall end overlapping the frame (the next wall over meets the door on its centre line)
  const fills = (r) => r.op.kind === 'door' && r.hi - r.lo + STEP >= r.op.a1 - r.op.a0 - 0.3 - 0.05;
  const filled = new Set([...hits.values()].filter(fills).map((r) => r.op)); // a window (a sill fills it) is not a way through: nothing in it counts
  const blocked = [];
  for (const r of hits.values()) {
    if (r.n < 3 || filled.has(r.op)) continue;
    let reach;
    if (r.op.kind === 'door') {
      reach = r.hi - r.lo + STEP;
      if (reach < 0.6) continue;
    } else reach = r.hi; // how far in from the deck's edge it gets
    blocked.push({ at: r.at.map(f1).join(','), n: +reach.toFixed(1), what: r.e.o.geometry.type.replace('Geometry', '').toLowerCase() + ' ' + size(r.e.bb), src: r.e.o.userData.src || '', in: (r.op.kind === 'door' ? 'doorway ' : 'deck ') + r.op.src });
  }
  blocked.sort((p, q) => q.n - p.n);

  // thin uprights standing on nothing
  const posts = [], rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), under = hash(pieces(G.scene, new Set(), true));
  for (const e of all) {
    const bb = e.bb, w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, h = bb.max.y - bb.min.y;
    if (e.o.geometry.type !== 'BoxGeometry' && e.o.geometry.type !== 'CylinderGeometry') continue;
    if (w > 0.35 || d > 0.35 || h < 0.5 || h > 8 || e.o.userData.floatOk) continue;
    const x = (bb.min.x + bb.max.x) / 2, z = (bb.min.z + bb.max.z) / 2;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue; // edge scenery
    // hung from a piece just above its top (an aerial under a crossbar, a chain under a vault)
    // its foot is inside another piece (a strut set into an arch rib, a post sunk into a deck)
    const foot = new THREE.Vector3(x, bb.min.y + 0.05, z);
    const head = new THREE.Vector3(x, bb.max.y - 0.05, z); // or its top is inside the piece it hangs from
    if (under(x, z).some((c) => c.o !== e.o && (inside(c, foot) || inside(c, head)))) continue;
    rc.set(new THREE.Vector3(x, bb.max.y - 0.15, z), new THREE.Vector3(0, 1, 0));
    const above = rc.intersectObjects(under(x, z).filter((c) => c.o !== e.o).map((c) => c.o), false)[0];
    if (above && above.distance < 0.35) continue;
    // fixed to the side of a piece at least as tall (a strip on a wall, a pole on a pillar): mounted, not standing
    if (near(x, z).some((c) => c !== e && c.bb.max.y >= bb.max.y - 0.05 && c.bb.min.y <= bb.min.y + 0.05 && c.bb.min.x <= bb.max.x + 0.08 && c.bb.max.x >= bb.min.x - 0.08 && c.bb.min.z <= bb.max.z + 0.08 && c.bb.max.z >= bb.min.z - 0.08)) continue;
    let sup = -Infinity;
    for (const [dx, dz] of [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) {
      const px = x + dx, pz = z + dz;
      let s = ga(px, pz);
      rc.set(new THREE.Vector3(px, bb.min.y + 0.4, pz), down);
      const cand = under(px, pz).filter((c) => c.o !== e.o).map((c) => c.o);
      const hit = rc.intersectObjects(cand, false)[0];
      if (hit && hit.point.y > s) s = hit.point.y;
      sup = Math.max(sup, s);
    }
    if (bb.min.y - sup > 0.25) posts.push({ at: [x, bb.min.y, z].map(f1).join(','), n: +(bb.min.y - sup).toFixed(2), what: 'post ' + size(bb), src: e.o.userData.src || '' });
  }
  posts.sort((p, q) => q.n - p.n);
  return { blocked, posts };
}
