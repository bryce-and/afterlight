import * as THREE from 'three';

// H22: an enemy model is ~50 separate meshes; this folds each group's rigid parts that share a material into one mesh so a unit is ~10 draw calls.
// Pure (THREE only) so the headless tests can run it on synthetic groups. Turn it off for debugging with globalThis.__noEnemyMerge = true.

const SKIP_USERDATA = new Set(['enemy', 'crit']);

/** Collect every Object3D reachable from `v` (arrays and plain objects, `depth` levels), without entering Object3D internals. */
function collectRefs(v, out, depth = 2) {
  if (!v || typeof v !== 'object') return;
  if (v.isObject3D) { out.add(v); return; }
  if (depth <= 0) return;
  if (Array.isArray(v)) { for (const x of v) collectRefs(x, out, depth - 1); return; }
  for (const k of Object.keys(v)) collectRefs(v[k], out, depth - 1);
}

function attrSig(geo) {
  return Object.keys(geo.attributes).sort().join(',') + (geo.index ? '|i' : '|n');
}

function mergeable(m, protect) {
  if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || m.isPoints || m.isLine || m.isSprite) return false;
  if (m.children.length || !m.visible || protect.has(m) || m.name) return false;
  if (m.renderOrder !== 0 || m.frustumCulled === false || m.layers.mask !== 1) return false;
  for (const k of Object.keys(m.userData)) if (!SKIP_USERDATA.has(k)) return false;
  const mt = m.material, geo = m.geometry;
  if (!mt || Array.isArray(mt) || mt.transparent || mt.blending !== THREE.NormalBlending || mt.opacity < 1) return false;
  if (!geo || !geo.attributes.position || !geo.attributes.normal) return false;
  if (geo.morphAttributes && Object.keys(geo.morphAttributes).length) return false;
  m.updateMatrix();
  if (m.matrix.determinant() <= 0) return false; // mirrored parts would flip their winding
  return true;
}

function mergeGeometries(list) {
  const first = list[0].geo, indexed = !!first.index;
  const names = Object.keys(first.attributes);
  const out = new THREE.BufferGeometry();
  let vcount = 0, icount = 0;
  for (const { geo } of list) { vcount += geo.attributes.position.count; if (indexed) icount += geo.index.count; }
  for (const n of names) {
    const a = first.attributes[n], arr = new a.array.constructor(vcount * a.itemSize);
    let off = 0;
    for (const { geo } of list) { arr.set(geo.attributes[n].array, off); off += geo.attributes[n].array.length; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  }
  if (indexed) {
    const idx = new Uint32Array(icount);
    let io = 0, vo = 0;
    for (const { geo } of list) { const ia = geo.index.array; for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo; io += ia.length; vo += geo.attributes.position.count; }
    out.setIndex(new THREE.BufferAttribute(vcount > 65535 ? idx : new Uint16Array(idx), 1));
  }
  return out;
}

/** Hoist the children of plain sub-groups nobody addresses (not in the context, no extra userData, only meshes and groups inside) into their parent, baking the group's transform, so their parts can merge with the parent's. */
function flattenStatic(root, protect) {
  const groups = [];
  root.traverse((o) => { if (o !== root && o.type === 'Group') groups.push(o); });
  for (let i = groups.length - 1; i >= 0; i--) {
    const grp = groups[i], par = grp.parent;
    if (!par || protect.has(grp) || grp.name || !grp.visible) continue;
    if (Object.keys(grp.userData).length) continue;
    if (!grp.children.every((c) => c.isMesh || c.type === 'Group')) continue;
    grp.updateMatrix();
    if (grp.matrix.determinant() <= 0) continue;
    for (const ch of grp.children.slice()) {
      ch.updateMatrix();
      ch.matrix.premultiply(grp.matrix);
      ch.matrix.decompose(ch.position, ch.quaternion, ch.scale);
      par.add(ch);
    }
    par.remove(grp);
  }
}

/**
 * Merge the rigid parts of a built enemy model in place.
 * root: the model's top group. hit: the hit-mesh array (edited in place). refs: the builder context and/or model objects, scanned for meshes other code still addresses.
 * Crit parts merge only with other crit parts (the merged mesh stays crit). Skips referenced or named meshes, anything transparent/additive, and meshes with extra userData. Never merges across parents, so pivots keep animating.
 * Returns the new merged geometries (unique per enemy; the caller disposes them) and the merge count.
 */
export function mergeEnemyModel(root, hit, e, refs = []) {
  const geos = [];
  if (globalThis.__noEnemyMerge) return { geos, merged: 0 };
  const protect = new Set();
  for (const r of refs) collectRefs(r, protect, 4);
  root.traverse((o) => { for (const k of Object.keys(o.userData)) if (!SKIP_USERDATA.has(k)) collectRefs(o.userData[k], protect, 2); });
  flattenStatic(root, protect);
  const parents = [];
  root.traverse((o) => { if (o.children.some((c) => c.isMesh)) parents.push(o); });
  const dead = new Set();
  for (const p of parents) {
    const groups = new Map();
    for (const m of p.children) {
      if (!mergeable(m, protect)) continue;
      const key = [m.material.uuid, m.userData.crit ? 'c' : 'b', attrSig(m.geometry)].join('#');
      let g = groups.get(key);
      if (!g) groups.set(key, g = []);
      g.push(m);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geo = mergeGeometries(list.map((m) => ({ geo: m.geometry.clone().applyMatrix4(m.matrix) })));
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, list[0].material);
      mesh.castShadow = list.some((m) => m.castShadow); mesh.receiveShadow = list.some((m) => m.receiveShadow);
      mesh.userData.enemy = e; mesh.userData.crit = !!list[0].userData.crit; // crit parts merge only with crit parts, so a precision hit still means the same triangles
      p.add(mesh);
      for (const m of list) { p.remove(m); dead.add(m); }
      hit.push(mesh);
      geos.push(geo);
    }
  }
  if (dead.size) { let w = 0; for (let i = 0; i < hit.length; i++) if (!dead.has(hit[i])) hit[w++] = hit[i]; hit.length = w; }
  return { geos, merged: dead.size };
}
