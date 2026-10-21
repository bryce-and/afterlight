// Dev-only z-fight finder. In the browser console on the running game (a level or the Tower already built):
//   const { findZFights } = await import('/tools/zfight.js');  findZFights(G.scene)
// Looks at every box-shaped mesh (BoxGeometry, any scale or yaw), takes its six faces, and reports pairs of faces that lie in the same
// plane, face the same way and overlap, with different materials: those fight over the same pixels. Opposite-facing coplanar faces
// (two boxes touching) are fine and ignored. Returns [{ a, b, at, area }].
import * as THREE from 'three';

const EPS = 0.004;

function faces(mesh) {
  const out = [];
  const m = mesh.matrixWorld, c = new THREE.Vector3(), ax = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const p = mesh.geometry.parameters;
  const half = [p.width / 2, p.height / 2, p.depth / 2];
  c.setFromMatrixPosition(m);
  for (let i = 0; i < 3; i++) { ax[i].setFromMatrixColumn(m, i); }
  const len = ax.map((a) => a.length());
  const dir = ax.map((a, i) => a.clone().divideScalar(len[i] || 1));
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const n = dir[i].clone().multiplyScalar(s);
    const j = (i + 1) % 3, k = (i + 2) % 3;
    const center = c.clone().addScaledVector(n, half[i] * len[i]);
    out.push({ mesh, n, d: n.dot(center), center, u: dir[j], v: dir[k], hu: half[j] * len[j], hv: half[k] * len[k] });
  }
  return out;
}

function overlap(a, b) {
  // 2D overlap of two coplanar rectangles by separating axes (their four edge directions); returns the smaller overlapping extent estimate
  const axes = [a.u, a.v, b.u, b.v];
  const dc = b.center.clone().sub(a.center);
  let minOver = Infinity;
  for (const ax of axes) {
    const ra = Math.abs(a.u.dot(ax)) * a.hu + Math.abs(a.v.dot(ax)) * a.hv;
    const rb = Math.abs(b.u.dot(ax)) * b.hu + Math.abs(b.v.dot(ax)) * b.hv;
    const over = ra + rb - Math.abs(dc.dot(ax));
    if (over <= 0.01) return 0;
    minOver = Math.min(minOver, over);
  }
  return minOver;
}

const label = (m) => `${m.material?.color ? '#' + m.material.color.getHexString() : '?'} @ ${m.position.x.toFixed(1)},${m.position.y.toFixed(1)},${m.position.z.toFixed(1)} s ${m.scale.x.toFixed(1)}x${m.scale.y.toFixed(1)}x${m.scale.z.toFixed(1)}`;

export function findZFights(scene, { sameColor = false } = {}) {
  scene.updateMatrixWorld(true);
  const all = [], boxes = [];
  scene.traverse((o) => {
    if (!(o.isMesh && !o.isInstancedMesh && o.geometry?.type === 'BoxGeometry' && o.visible)) return;
    if (o.material?.transparent) return; // glass, mist, light shafts
    boxes.push({ mesh: o, inv: o.matrixWorld.clone().invert() });
    for (const f of faces(o)) if (f.n.y > -0.5) all.push(f); // a downward face is against the floor or a ceiling we cannot see
  });
  const _p = new THREE.Vector3();
  const hidden = (f) => { // a face buried inside another solid box is never drawn
    _p.copy(f.center).addScaledVector(f.n, 0.02);
    return boxes.some(({ mesh, inv }) => {
      if (mesh === f.mesh) return false;
      const q = _p.clone().applyMatrix4(inv), p = mesh.geometry.parameters;
      return Math.abs(q.x) < p.width / 2 - 1e-3 && Math.abs(q.y) < p.height / 2 - 1e-3 && Math.abs(q.z) < p.depth / 2 - 1e-3;
    });
  };
  // group by quantised normal, then sweep by plane offset
  const groups = new Map();
  for (const f of all) {
    const key = `${Math.round(f.n.x * 100)},${Math.round(f.n.y * 100)},${Math.round(f.n.z * 100)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const hits = [];
  for (const list of groups.values()) {
    list.sort((p, q) => p.d - q.d);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length && list[j].d - list[i].d < EPS; j++) {
        const A = list[i], B = list[j];
        if (A.mesh === B.mesh) continue;
        const ca = A.mesh.material?.color?.getHex(), cb = B.mesh.material?.color?.getHex();
        if (!sameColor && ca === cb) continue;
        const area = overlap(A, B);
        if (area > 0.05 && !hidden(A) && !hidden(B)) hits.push({ a: label(A.mesh), b: label(B.mesh), at: `${A.center.x.toFixed(1)},${A.center.y.toFixed(1)},${A.center.z.toFixed(1)}`, area: +area.toFixed(2) });
      }
    }
  }
  return hits;
}
