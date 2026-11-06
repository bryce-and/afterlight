// Dev-only collision audit (H17 "Solid Ground"). In the browser console on the running game (a level or patrol zone already built; for a patrol
// zone set globalThis.__noMerge = true first so pieces are not merged):
//   const { auditCollision } = await import('/tools/collidecheck.js');  auditCollision(G)
// Scans the play area on a grid at body height (ground + 0.55 and + 1.15 m) and finds two kinds of wrong spot:
//   missing:  inside a visible solid piece but in no collider (you walk through it)
//   phantom:  inside a collider but in no visible piece (you bump into air; a square collider on a diagonal or round piece does this)
// Points are grouped by the piece (missing) or collider (phantom) they belong to. Returns { missing: [...], phantom: [...] }, each item
// { at, n (grid points), size, what }. Invisible walls on the map bounds, door blocks and pieces marked userData.noCollide are left out.
import * as THREE from 'three';

const STEP = 0.5, CELL = 4;
const SOLID = new Set(['BoxGeometry', 'CylinderGeometry', 'ConeGeometry', 'DodecahedronGeometry', 'OctahedronGeometry', 'IcosahedronGeometry']);
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Vector3();
const SLACK = 0.6, RING = [[SLACK, 0], [-SLACK, 0], [0, SLACK], [0, -SLACK], [SLACK * 0.7, SLACK * 0.7], [-SLACK * 0.7, SLACK * 0.7], [SLACK * 0.7, -SLACK * 0.7], [-SLACK * 0.7, -SLACK * 0.7]];

function solidMeshes(scene) {
  const out = [];
  for (const o of scene.children) {
    if (!o.isMesh || !o.visible || o.userData.noCollide) continue;
    const m = o.material;
    if (!m || Array.isArray(m) || m.transparent || m.isMeshBasicMaterial || !o.geometry) continue;
    if (!SOLID.has(o.geometry.type)) continue; // rings, domes, lathes and custom shapes are hollow or open: not judged here
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = new THREE.Box3().setFromObject(o);
    if (bb.max.x - bb.min.x > 150 || bb.max.z - bb.min.z > 150) continue; // ground, sky, sea
    // thin pieces (strips, panels under 0.25 m both ways) are not something you bump into
    const s = new THREE.Vector3(); bb.getSize(s);
    if (Math.min(s.x, s.z) < 0.25 && Math.max(s.x, s.z) < 0.6) continue;
    out.push({ o, bb, inv: _m.copy(o.matrixWorld).invert().clone(), lb: o.geometry.boundingBox });
  }
  return out;
}

const inMesh = (e, p) => {
  if (p.x < e.bb.min.x || p.x > e.bb.max.x || p.y < e.bb.min.y || p.y > e.bb.max.y || p.z < e.bb.min.z || p.z > e.bb.max.z) return false;
  _v.copy(p).applyMatrix4(e.inv); // local space: exact for boxes at any rotation, the local box for other shapes
  const b = e.lb, k = e.o.geometry.type === 'BoxGeometry' ? 0 : 0.15; // round shapes: allow their box corners
  const sx = (b.max.x - b.min.x) * k, sz = (b.max.z - b.min.z) * k;
  return _v.x > b.min.x + sx && _v.x < b.max.x - sx && _v.y > b.min.y && _v.y < b.max.y && _v.z > b.min.z + sz && _v.z < b.max.z - sz;
};

function inCollider(c, p) {
  if (p.x <= c.min.x || p.x >= c.max.x || p.y <= c.min.y || p.y >= c.max.y || p.z <= c.min.z || p.z >= c.max.z) return false;
  const q = c.rot;
  if (!q) return true;
  const dx = p.x - q.cx, dz = p.z - q.cz;
  return Math.abs(dx * q.c - dz * q.s) < q.hw && Math.abs(dx * q.s + dz * q.c) < q.hd; // same frame as colliders.js localX / localZ
}

function hash(list, box) {
  const g = new Map(), key = (i, j) => i * 92821 + j;
  for (const it of list) {
    const b = box(it);
    for (let i = Math.floor(b.min.x / CELL); i <= Math.floor(b.max.x / CELL); i++)
      for (let j = Math.floor(b.min.z / CELL); j <= Math.floor(b.max.z / CELL); j++) (g.get(key(i, j)) || g.set(key(i, j), []).get(key(i, j))).push(it);
  }
  return (x, z) => g.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
}

export function auditCollision(G) {
  G.scene.updateMatrixWorld(true);
  const L = G.level, b = L.bounds, ga = L.groundAt || (() => 0);
  const doorCols = new Set((L.doors || []).map((d) => d.collider));
  const cols = G.colliders.filter((c) => !doorCols.has(c) && c.max.x - c.min.x < 150 && c.max.z - c.min.z < 150);
  const meshes = solidMeshes(G.scene);
  const nearM = hash(meshes, (e) => e.bb), nearC = hash(cols, (c) => c);
  const miss = new Map(), phan = new Map();
  for (let x = b.minX + 1; x < b.maxX - 1; x += STEP) for (let z = b.minZ + 1; z < b.maxZ - 1; z += STEP) {
    if (L.voidAt?.(x, z)) continue;
    const g = ga(x, z);
    for (const h of [0.55, 1.15]) { // off the round heights maps use for box tops, so a 1.2 m bench is not judged on its own edge
      const p = new THREE.Vector3(x, g + h, z);
      const c = nearC(x, z).find((cc) => inCollider(cc, p));
      const m = nearM(x, z).find((e) => inMesh(e, p));
      // slack: a collider that hugs a rock or a crystal cluster within 0.6 m is a fair fit; only count what is off by more
      const near = (test) => RING.some(([dx, dz]) => { _q.set(x + dx, p.y, z + dz); return test(_q); });
      if (m && !c && near((q) => nearC(q.x, q.z).some((cc) => inCollider(cc, q)))) continue;
      if (c && !m && near((q) => nearM(q.x, q.z).some((e) => inMesh(e, q)))) continue;
      if (m && !c) { const r = miss.get(m) || miss.set(m, { n: 0, x, z, y: p.y }).get(m); r.n++; }
      else if (c && !m) {
        const r = phan.get(c) || phan.set(c, { n: 0, x, z, y: p.y }).get(c); r.n++;
      }
    }
  }
  const fmt = (r) => `${r.x.toFixed(1)},${r.y.toFixed(1)},${r.z.toFixed(1)}`;
  const missing = [...miss].filter(([, r]) => r.n >= 2).map(([e, r]) => {
    const p = e.o.geometry.parameters || {}, s = e.o.scale;
    return { at: fmt(r), n: r.n, src: e.o.userData.src || '', what: `${e.o.geometry.type.replace('Geometry', '')} ${p.width ? (p.width * s.x).toFixed(1) + 'x' + (p.height * s.y).toFixed(1) + 'x' + (p.depth * s.z).toFixed(1) : ''} #${e.o.material.color?.getHexString()} ry ${e.o.rotation.y.toFixed(2)}`, mesh: e.o };
  }).sort((a, c) => c.n - a.n);
  // phantom kinds: 'diagonal' (an axis-aligned collider round a yawed piece: its empty corners block), 'oversize' (bigger than the piece it
  // belongs to), 'invisible' (no piece at all under it: a deliberate blocker such as a sea edge or a cliff, listed apart)
  const kind = (c) => {
    const over = nearM((c.min.x + c.max.x) / 2, (c.min.z + c.max.z) / 2).concat(nearM(c.min.x, c.min.z), nearM(c.max.x, c.max.z))
      .filter((e) => e.bb.max.x > c.min.x && e.bb.min.x < c.max.x && e.bb.max.z > c.min.z && e.bb.min.z < c.max.z && e.bb.max.y > c.min.y && e.bb.min.y < c.max.y);
    if (!over.length || over.every((e) => e.bb.max.y - e.bb.min.y < 0.5)) return 'invisible'; // nothing there, or only a floor plane (a sea, a pit): a deliberate blocker
    if (!c.rot && over.some((e) => Math.abs(Math.sin(2 * e.o.rotation.y)) > 0.15 || Math.abs(e.o.rotation.x) > 0.15 || Math.abs(e.o.rotation.z) > 0.15)) return 'diagonal';
    return 'oversize';
  };
  const phantom = [...phan].filter(([, r]) => r.n >= 4).map(([c, r]) => ({ at: fmt(r), n: r.n, kind: kind(c), src: c.src || '', what: `${c.rot ? 'oriented' : 'box'} ${(c.max.x - c.min.x).toFixed(1)}x${(c.max.y - c.min.y).toFixed(1)}x${(c.max.z - c.min.z).toFixed(1)}`, collider: c })).sort((a, c) => c.n - a.n);
  return { missing: missing.filter((x) => x.n >= 4), phantom };
}
