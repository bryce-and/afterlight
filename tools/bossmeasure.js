// U29: measures a boss model the way the boss tests and the baseline recorder need it.
// Builds through the game's own buildModel (so the kit, the crit tags and the runtime fields are the real ones), unmerged so mesh counts are raw.
// Used by tools/tests.js (compare to tools/boss-baselines.json) and tools/bossbaseline.html (records the baselines).
import * as THREE from 'three';
import { buildModel } from '../js/enemies.js';
import { LOCATIONS } from '../js/data.js';

export const HOOKS = ['hover', 'head', 'visor', 'lens', 'gobletArm', 'goblet', 'onDeath', 'deathStep'];

/** Meshes left after the runtime merge (enemy-merge.js): the draw-call proxy. */
function mergedMeshes(name) {
  const m = buildModel({ typeId: 'boss', bossModel: name, maxShield: 0 }, LOCATIONS[0].colors, 'legion');
  let n = 0;
  m.group.traverse((o) => { if (o.isMesh) n++; });
  return n;
}

export function measureBoss(name) {
  const drawn = mergedMeshes(name);
  const prev = globalThis.__noEnemyMerge;
  globalThis.__noEnemyMerge = true;
  let m;
  try { m = buildModel({ typeId: 'boss', bossModel: name, maxShield: 0 }, LOCATIONS[0].colors, 'legion'); } finally { globalThis.__noEnemyMerge = prev; }
  m.group.scale.setScalar(1);
  m.group.updateMatrixWorld(true);
  const all = new THREE.Box3(), crit = new THREE.Box3();
  let meshes = 0, critMeshes = 0;
  m.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const b = new THREE.Box3().setFromObject(o);
    all.union(b);
    if (o.userData.crit) { critMeshes++; crit.union(b); }
  });
  const size = all.getSize(new THREE.Vector3()), csize = crit.getSize(new THREE.Vector3());
  const mw = new THREE.Vector3();
  m.muzzle.getWorldPosition(mw);
  const r = (v) => Math.round(v * 1000) / 1000;
  return {
    height: r(m.height), torso: !!m.torso,
    minX: r(all.min.x), maxX: r(all.max.x), minZ: r(all.min.z), maxZ: r(all.max.z), maxY: r(all.max.y),
    critVol: critMeshes ? r(csize.x * csize.y * csize.z) : 0, critMeshes, critMinY: critMeshes ? r(crit.min.y) : 0, critMaxY: critMeshes ? r(crit.max.y) : 0,
    meshes, drawn, muzzle: [r(mw.x), r(mw.y), r(mw.z)],
    hooks: HOOKS.filter((k) => !!m[k]),
  };
}
