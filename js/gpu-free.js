// H28: free GPU memory that removed enemies and finished levels used to keep.
// three.js holds a geometry's or texture's GPU buffers until dispose() is called; removing an object from the scene is not enough.
// A disposed geometry or texture that is used again later is simply uploaded again, so freeing a shared one costs an upload, not a bug.
// Materials are left alone: they share shader programs, and freeing the last user of a program would mean a recompile hitch later.
// Pure (THREE objects only) so tools/tests.js can run it on synthetic scenes.

const TEX_SLOTS = ['map', 'alphaMap', 'aoMap', 'bumpMap', 'emissiveMap', 'envMap', 'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap', 'displacementMap', 'specularMap', 'gradientMap', 'matcap'];

/** Dispose every geometry under `root` that no object still in `scene` uses. Call after root has left the scene. Returns the count freed. */
export function freeObjectGeometries(root, scene) {
  const inUse = new Set();
  scene?.traverse((o) => { if (o.geometry) inUse.add(o.geometry); });
  const freed = new Set();
  root.traverse((o) => { const g = o.geometry; if (g && !inUse.has(g) && !freed.has(g)) { g.dispose(); freed.add(g); } });
  return freed.size;
}

/** Dispose every geometry, texture and light shadow map in a scene that is being thrown away (the previous mission's level). Returns { geometries, textures, shadows }. */
export function freeScene(scene) {
  const geos = new Set(), texs = new Set(), shadows = new Set();
  const addTex = (t) => { if (t?.isTexture) texs.add(t); };
  scene.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.shadow?.map) shadows.add(o.shadow); // the sun's 2048 shadow map is a render target the renderer never frees on its own
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) for (const k of TEX_SLOTS) addTex(m[k]);
  });
  addTex(scene.background); addTex(scene.environment);
  for (const g of geos) g.dispose();
  for (const t of texs) t.dispose();
  for (const s of shadows) s.dispose();
  return { geometries: geos.size, textures: texs.size, shadows: shadows.size };
}
