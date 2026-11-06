// Dev-only float finder (H17 "Solid Ground"). In the browser console on the running game (a level or patrol zone already built):
//   const { findFloats } = await import('/tools/floatcheck.js');  findFloats(G.scene, G.level.groundAt, G.level.bounds)
// Judges every box-shaped mesh placed straight into the scene (the map kit's pieces: decks, rails, walkways, road strips) and samples its
// bottom face at the corners, edge midpoints and centre. Under each sample it finds what holds it up: the terrain, or the top of another
// piece below it (any mesh). The gap between the bottom and that support is what the eye reads as floating.
// A piece is reported when it is resting on something at one sample and hanging in the air at another (the slope case: one end touches,
// the other end hovers), or when it hovers a little everywhere (a rail or strip lifted off the ground). Pieces held clear of everything
// (roofs, beams, rings, gantries) are deliberate and not reported, and so are: pieces tilted on purpose (leaning slabs, beams, pitched
// strips), pieces carried by a post, leg or wheel under them, pieces fixed to the side of a taller piece well above the ground (bands,
// wall lights), pieces outside `bounds` (edge scenery on the drawn hills), and pieces a map marks with userData.floatOk.
// Patrol zones merge their scenery into big meshes: set globalThis.__noMerge = true before building one (tools/maptest.html does).
// Returns [{ mesh, at, gap, kind }].
import * as THREE from 'three';

const TOUCH = 0.12;   // a sample this close to its support is resting on it
const GAP = 0.3;      // a sample further than this from its support is hanging
const HOVER = 1.2;    // a piece hanging everywhere, but less than this, is a lifted strip (bug); more is a deliberate overhead piece
const SLOPE_MAX = 2.5; // a piece hanging more than this off one end is a deliberate overhang, not a slope float
const TILT = 0.06; // radians: a piece tilted more than this was leaned on purpose
const MOUNT = 0.6; // a piece fixed to a taller one's side counts as mounted only this far above the ground
const CELL = 4;

function bottomSamples(mesh) {
  const p = mesh.geometry.parameters, m = mesh.matrixWorld;
  const hx = p.width / 2, hy = p.height / 2, hz = p.depth / 2;
  // the face whose normal points most downward is the bottom
  const ax = [0, 1, 2].map((i) => new THREE.Vector3().setFromMatrixColumn(m, i));
  let best = null;
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const ny = ax[i].y * s / (ax[i].length() || 1);
    if (!best || ny < best.ny) best = { i, s, ny };
  }
  const h = [hx, hy, hz], out = [];
  const j = (best.i + 1) % 3, k = (best.i + 2) % 3;
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
    const v = [0, 0, 0];
    v[best.i] = best.s * h[best.i]; v[j] = a * h[j]; v[k] = b * h[k];
    out.push(new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(m));
  }
  return out;
}

export function findFloats(scene, groundAt = () => 0, bounds = null) {
  // edge scenery outside the play area stands on the hills drawn there, not on the terrain, so only the play area is judged
  const inside = (p) => !bounds || (p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ);
  scene.updateMatrixWorld(true);
  const boxes = [];
  for (const o of scene.children) {
    if (!o.isMesh || !o.visible) continue;
    const bb = new THREE.Box3().setFromObject(o);
    const fw = bb.max.x - bb.min.x, fd = bb.max.z - bb.min.z;
    if (fw > 300 || fd > 300) continue; // sky shells, sea planes, the ground mesh
    // every static piece can hold something up (wheels, legs, pipes); only boxes are judged
    boxes.push({ o, bb, judge: o.geometry?.type === 'BoxGeometry' });
  }
  // grid of box footprints, to find what stands under a sample
  const grid = new Map(), key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  for (const b of boxes) {
    for (let cx = Math.floor(b.bb.min.x / CELL); cx <= Math.floor(b.bb.max.x / CELL); cx++)
      for (let cz = Math.floor(b.bb.min.z / CELL); cz <= Math.floor(b.bb.max.z / CELL); cz++) {
        const k = key(cx, cz);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(b);
      }
  }
  const near = (x, z) => grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  // what holds a sample up: { y, box } (box null when it is the terrain)
  const support = (self, x, y, z) => {
    let s = groundAt(x, z), by = null;
    for (const b of near(x, z)) {
      if (b.o === self) continue;
      if (x < b.bb.min.x - 0.05 || x > b.bb.max.x + 0.05 || z < b.bb.min.z - 0.05 || z > b.bb.max.z + 0.05) continue;
      const top = b.bb.max.y;
      if (top <= y + TOUCH && top > s) { s = top; by = b; }
      // a piece sunk into a taller box (a rail set into a wall, a strip inside a deck) is held by it
      if (b.bb.min.y <= y + TOUCH && top > y + TOUCH && y >= s) { s = y; by = b; }
    }
    return { y: s, box: by };
  };
  // legs, posts, wheels: another box under the footprint whose top meets this piece's underside
  const carried = (b) => {
    const seen = new Set();
    for (let cx = Math.floor(b.bb.min.x / CELL); cx <= Math.floor(b.bb.max.x / CELL); cx++)
      for (let cz = Math.floor(b.bb.min.z / CELL); cz <= Math.floor(b.bb.max.z / CELL); cz++)
        for (const o of grid.get(key(cx, cz)) || []) {
          if (o === b || seen.has(o)) continue;
          seen.add(o);
          if (o.bb.max.x < b.bb.min.x || o.bb.min.x > b.bb.max.x || o.bb.max.z < b.bb.min.z || o.bb.min.z > b.bb.max.z) continue;
          if (o.bb.max.y >= b.bb.min.y - 0.3 && o.bb.max.y <= b.bb.min.y + TOUCH + 0.3 && o.bb.min.y < b.bb.min.y) return true;
        }
    return false;
  };
  // fixed to the side of a taller piece (a band round a tower, a strip on a wall, a pane on a shaft) and well clear of the ground under it
  const mounted = (b, highest) => {
    if (b.bb.min.y - highest < MOUNT) return false; // low pieces should reach the ground (a door slot, a plinth)
    const e = 0.06;
    for (let cx = Math.floor((b.bb.min.x - e) / CELL); cx <= Math.floor((b.bb.max.x + e) / CELL); cx++)
      for (let cz = Math.floor((b.bb.min.z - e) / CELL); cz <= Math.floor((b.bb.max.z + e) / CELL); cz++)
        for (const o of grid.get(key(cx, cz)) || []) {
          if (o === b || o.bb.max.x < b.bb.min.x - e || o.bb.min.x > b.bb.max.x + e || o.bb.max.z < b.bb.min.z - e || o.bb.min.z > b.bb.max.z + e) continue;
          if (o.bb.min.y < b.bb.min.y && o.bb.max.y > b.bb.min.y + 0.05) return true;
        }
    return false;
  };
  const found = [];
  for (const b of boxes) {
    if (!b.judge || b.o.userData.floatOk || !inside(b.o.position)) continue; // floatOk: a map marks a piece that hangs on purpose
    const p = b.o.geometry.parameters, s = b.o.scale;
    if (Math.max(p.width * s.x, p.depth * s.z) < 0.6) continue; // bolts, bulbs, small trim
    if (Math.abs(b.o.rotation.x) > TILT || Math.abs(b.o.rotation.z) > TILT) continue; // leaning on purpose (slabs, beams, rubble): one end down is the point
    let touch = 0, hang = 0, onBox = 0, worst = 0, at = null, minGap = Infinity, highest = -Infinity;
    for (const v of bottomSamples(b.o)) {
      highest = Math.max(highest, groundAt(v.x, v.z));
      const sp = support(b.o, v.x, v.y, v.z), g = v.y - sp.y;
      if (sp.box) { onBox++; continue; } // resting on (or over) another piece: that piece is judged on its own
      if (g <= TOUCH) touch++;
      if (g > GAP) { hang++; if (g > worst) { worst = g; at = v; } }
      minGap = Math.min(minGap, g);
    }
    let kind = null;
    // the slope case: on the ground at one end, hanging over open ground at the other (deliberate overhangs hang far higher)
    if (touch && hang && worst < SLOPE_MAX && !carried(b)) kind = 'slope';
    // a strip lifted a little off the ground everywhere, with nothing under it
    else if (!touch && !onBox && minGap > GAP && minGap < HOVER && !carried(b)) { kind = 'hover'; worst = minGap; at = at || b.o.position; }
    if (kind && mounted(b, highest)) kind = null;
    if (kind) found.push({ mesh: b.o, kind, gap: +worst.toFixed(2), at: `${at.x.toFixed(1)},${at.y.toFixed(1)},${at.z.toFixed(1)}` });
  }
  return found.sort((a, b) => b.gap - a.gap);
}
