import * as THREE from 'three';
import { mulberry32, hashStr } from './util.js';
import { buildCharacter } from './characters.js';
import { orientedCollider } from './colliders.js';
import { buildTerrain } from './terrain.js';
import { skyFor, buildSky } from './sky.js';
import EARTH from './level-earth.js';
import EARTH_PATROL from './patrol-earth.js';
import MOON_PATROL from './patrol-moon.js';
import MARS_PATROL from './patrol-mars.js';
import MOON from './level-moon.js';
import MARS from './level-mars.js';
import TITAN from './level-titan.js';
import TANGLED from './level-tangled.js';
import IO from './level-io.js';
import DC from './level-dc.js';
import LEVIATHAN from './level-leviathan.js';
import { TOWER } from './level-tower.js';

// Hand-built mission maps, keyed by mission id (see the kit in buildLevel).
const LEVEL_SETS = { ...EARTH, ...EARTH_PATROL, ...MOON_PATROL, ...MARS_PATROL, ...MOON, ...MARS, ...TITAN, ...TANGLED, ...IO, ...DC, ...LEVIATHAN, ...TOWER };

const matCache = new Map();
export function mat(color, o = {}) {
  const key = `${color}|${o.emissive ?? ''}|${o.emissiveIntensity ?? ''}|${o.opacity ?? ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05, ...o });
    matCache.set(key, m);
  }
  return m;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const BULB = new THREE.SphereGeometry(0.16, 6, 4);

// ---------------------------------------------------------------------------
// Mission level
// ---------------------------------------------------------------------------
// Time of day / weather per mission: tints the sky, fog and light.
const MOODS = {
  day: null,
  dawn: { tint: 0xffa27a, k: 0.35, light: 0.9, fog: 1 },
  dusk: { tint: 0x8a4a7a, k: 0.45, light: 0.72, fog: 0.9 },
  storm: { tint: 0x56606c, k: 0.6, light: 0.6, fog: 0.55 },
  night: { tint: 0x0c1424, k: 0.65, light: 0.55, fog: 0.8 },
};
function withMood(colors, moodId) {
  const m = MOODS[moodId];
  if (!m) return { C: colors, light: 1, fog: 1 };
  const C = { ...colors };
  const t = new THREE.Color(m.tint);
  for (const key of ['sky', 'fog', 'hemiTop', 'sun']) C[key] = new THREE.Color(colors[key]).lerp(t, m.k).getHex();
  return { C, light: m.light, fog: m.fog };
}

export function buildLevel(loc, def) {
  const rng = mulberry32(hashStr(def.id));
  const R = (a, b) => a + rng() * (b - a);
  const RP = (arr) => arr[Math.floor(rng() * arr.length)];
  const over = LEVEL_SETS[def.id] || {}; // a map may recolour its destination (`colors`) and set its own fog (`fog`): the Earth patrol is a cool, clear day
  const mood = withMood({ ...loc.colors, ...(over.colors || {}) }, def.mood);
  const fogR = over.fog || loc.fog;
  const C = mood.C;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.fog, fogR[0] * mood.fog, fogR[1] * mood.fog);
  scene.add(new THREE.HemisphereLight(C.hemiTop, C.hemiBot, loc.light.hemi * (0.5 + 0.5 * mood.light)));
  const sun = new THREE.DirectionalLight(C.sun, loc.light.sun * mood.light);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 220 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const sunOffset = new THREE.Vector3(...loc.sunDir).normalize().multiplyScalar(90);

  // U16e sky: a data-driven dome, stars, bodies and silhouettes (js/sky.js); a destination without a spec keeps the plain sky body
  const skySpec = skyFor(loc, def, LEVEL_SETS[def.id]?.sky); // a map may carry its own `sky` overrides
  let sky = null;
  if (skySpec) {
    const spec = { ...skySpec, horizon: skySpec.horizon ?? C.fog };
    if (spec.fog != null) { scene.fog.color.setHex(spec.fog); scene.background = new THREE.Color(spec.fog); }
    sky = buildSky(scene, spec, def.id);
  } else {
    const sb = new THREE.Mesh(new THREE.IcosahedronGeometry(loc.skyBody.size, 2), new THREE.MeshBasicMaterial({ color: loc.skyBody.color, fog: false }));
    sb.position.set(...loc.skyBody.pos);
    scene.add(sb);
    if (loc.skyBody.ring) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(loc.skyBody.size * 1.35, loc.skyBody.size * 2.1, 48), new THREE.MeshBasicMaterial({ color: 0xd8c49a, fog: false, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
      ring.position.copy(sb.position);
      ring.rotation.set(1.2, 0.3, 0.2);
      scene.add(ring);
    }
  }

  // ---- zones ----
  const set = LEVEL_SETS[def.id];
  if (!set) throw new Error(`No level map for mission ${def.id}; add one to js/level-${loc.id}.js`);
  // U16e: a map may list terrain features (js/terrain.js); without them the ground is flat and every number below is unchanged
  const terrain = buildTerrain(set.terrain), gAt = terrain ? terrain.at : null;
  const GY = gAt || (() => 0);
  const zones = set.zones.map((z) => ({ center: new THREE.Vector3(z.x, GY(z.x, z.z), z.z), isBoss: !!z.boss, name: z.name, leash: z.leash, room: z.room }));
  const spawn = new THREE.Vector3(set.spawn[0], GY(set.spawn[0], set.spawn[1]), set.spawn[1]);
  const [minX, maxX, minZ, maxZ] = set.bounds;
  const bounds = { minX, maxX, minZ, maxZ };

  // ---- ground ----
  const s1 = rng() * 100;
  const rimK = sky && !loc.sea ? (set.rim ?? 0.45) : 1; // the bowl of hills round the play area is lower under a real sky, so its horizon shows
  const heightAt = (x, z) => {
    const n = Math.sin(x * 0.11 + s1) * Math.cos(z * 0.09 - s1) + 0.6 * Math.sin((x + z) * 0.23 + s1 * 2) + 0.3 * Math.cos(x * 0.41 - z * 0.37);
    const out = Math.max(0, bounds.minX - x, x - bounds.maxX, bounds.minZ - z, z - bounds.maxZ);
    if (gAt) { // the play area is the terrain; past its edge the slopes rise from wherever the terrain ends
      const base = gAt(Math.min(bounds.maxX, Math.max(bounds.minX, x)), Math.min(bounds.maxZ, Math.max(bounds.minZ, z)));
      if (out <= 0) return base - 0.03;
      if (loc.sea) return base + n * 0.12 - 1.2 - Math.min(out, 40) * 0.25; // a deck over the sea: past the edge the ground falls away into the water
      return base + n * 0.12 + Math.min(out, 90) * 0.7 * rimK * (0.75 + 0.25 * n) + Math.max(0, out - 90) * 0.2;
    }
    if (out <= 0) return loc.vista ? -0.08 : n * 0.12; // the Tower's paving sits above flat ground (no terrain bumps poking through, no z-fighting)
    if (loc.vista) return n * 0.12 - 1.2 - Math.min(out * out * 0.04, 139); // the Tower stands on a cliff above the Last City
    if (loc.sea) return n * 0.12 - 1.2 - Math.min(out, 40) * 0.25; // the play area is a deck above the sea
    return n * 0.12 + Math.min(out, 90) * 0.7 * rimK * (0.75 + 0.25 * n) + Math.max(0, out - 90) * 0.2;
  };
  scene.add(buildGround(bounds, C, heightAt, rng, gAt ? 2 : 5));
  if (loc.vista) loc.vista(scene, C);
  else if (loc.sea) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: C.sea, roughness: 0.25, metalness: 0.3 }));
    sea.position.set(0, -0.7, (bounds.minZ + bounds.maxZ) / 2);
    scene.add(sea);
  }

  // ---- obstacles ----
  const colliders = [], staticMeshes = [];
  const clear = [{ x: spawn.x, z: spawn.z, r: 7 }, ...zones.map((z) => ({ x: z.center.x, z: z.center.z, r: z.isBoss ? 9 : 4.5 }))];
  const inBounds = (x, z, r) => x - r > bounds.minX + 1 && x + r < bounds.maxX - 1 && z - r > bounds.minZ + 1 && z + r < bounds.maxZ - 1;
  const isClear = (x, z, r) => inBounds(x, z, r) && clear.every((c) => (x - c.x) ** 2 + (z - c.z) ** 2 > (c.r + r) ** 2);

  // U16e: every y a map gives is measured from the terrain under (x, z); a flat map has none, so nothing moves. `lift` is off for scenery
  // outside the play area (it is placed at the absolute height of the slope).
  let lift = !!gAt;
  const gy = (x, z) => (lift ? gAt(x, z) : 0);
  /** Lowest ground under a footprint: a box on a slope gets a skirt down to it so it never floats. */
  const lowest = (x, z, w, d) => {
    let m = Infinity;
    for (const sx of [-0.5, 0, 0.5]) for (const sz of [-0.5, 0, 0.5]) m = Math.min(m, gAt(x + sx * w, z + sz * d));
    return m;
  };
  const rawCollider = (minX, minY, minZ, maxX, maxY, maxZ, mesh) => {
    colliders.push({ min: new THREE.Vector3(minX, minY, minZ), max: new THREE.Vector3(maxX, maxY, maxZ) });
    if (mesh) staticMeshes.push(mesh);
  };
  const addCollider = (minX, minY, minZ, maxX, maxY, maxZ, mesh) => {
    const g = gy((minX + maxX) / 2, (minZ + maxZ) / 2);
    rawCollider(minX, minY + g, minZ, maxX, maxY + g, maxZ, mesh);
  };
  // yawed box collider (diagonal walls block only where they are); see physics.orientedCollider
  const addOriented = (cx, y0, cz, w, h, d, ry, mesh) => {
    colliders.push(orientedCollider(cx, y0 + gy(cx, cz), cz, w, h, d, ry));
    if (mesh) staticMeshes.push(mesh);
  };
  const addBox = (x, z, w, h, d, color, y = 0, collide = true, matOpts, abs = false) => {
    let base = y, hh = h;
    if (lift && !abs) {
      const g = gAt(x, z);
      base = y + g;
      if (y === 0) { const skirt = g - lowest(x, z, w, d); base -= skirt; hh += skirt; }
    }
    const m = new THREE.Mesh(BOX, mat(color, matOpts));
    m.scale.set(w, hh, d);
    m.position.set(x, base + hh / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (collide) rawCollider(x - w / 2, base, z - d / 2, x + w / 2, base + hh, z + d / 2, m);
    return m;
  };
  const addRock = (x, z, s, y = 0, collide = true) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(RP([C.rock, C.rock2])));
    const sy = R(0.6, 1.1);
    m.scale.set(R(0.9, 1.2), sy, R(0.9, 1.2));
    m.rotation.y = R(0, 6.28);
    const yy = y + gy(x, z);
    m.position.set(x, yy + s * sy * 0.45, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const hw = s * 0.75;
    if (collide) rawCollider(x - hw, yy, z - hw, x + hw, yy + s * sy * 1.25, z + hw, m);
  };
  const addMesh = (geo, color, x, y, z, matOpts) => {
    const m = new THREE.Mesh(geo, mat(color, matOpts));
    m.position.set(x, y + gy(x, z), z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  const P = {
    crate: (x, z) => { const s = R(1.1, 1.6); addBox(x, z, s, s, s, RP([C.metal, C.accent, C.crate])); if (rng() < 0.4) addBox(x + R(-0.2, 0.2), z + R(-0.2, 0.2), s * 0.7, s * 0.7, s * 0.7, C.metal, s); },
    wall: (x, z) => { const len = R(4, 8), h = R(1.3, 2.8); if (rng() < 0.5) addBox(x, z, len, h, 0.8, C.wall); else addBox(x, z, 0.8, h, len, C.wall); },
    pillar: (x, z) => { const h = R(3, 7); addBox(x, z, 1.4, h, 1.4, C.wall); if (rng() < 0.5) addBox(x, z, 1.9, 0.4, 1.9, C.metal, h); },
    rock: (x, z) => addRock(x, z, R(1.2, 3)),
  };

  const themed = {
    earth: (x, z, y = 0, col = true) => {
      const t = rng();
      if (t < 0.45) { // rusted car hulk
        const rot = rng() < 0.5;
        const w = rot ? 1.9 : 4.2, d = rot ? 4.2 : 1.9;
        const col1 = RP([C.accent, 0x8e4a2a, 0x6b5a4a]);
        addBox(x, z, w, 1.0, d, col1, y + 0.25, col);
        addBox(x + (rot ? 0 : -0.3), z + (rot ? -0.3 : 0), rot ? 1.7 : 2.2, 0.8, rot ? 2.2 : 1.7, col1, y + 1.25, col);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) addBox(x + sx * (w / 2 - 0.3), z + sz * (d / 2 - 0.6), rot ? 0.3 : 0.6, 0.5, rot ? 0.6 : 0.3, 0x222222, y, false);
      } else if (t < 0.8) { // pine tree
        const h = R(4, 7);
        addMesh(new THREE.CylinderGeometry(0.18, 0.28, h * 0.5, 5), 0x4a3a2a, x, y + h * 0.25, z);
        for (let k = 0; k < 3; k++) addMesh(new THREE.ConeGeometry(1.6 - k * 0.4, h * 0.38, 6), C.foliage, x, y + h * (0.45 + k * 0.17), z);
        if (col) addCollider(x - 0.35, y, z - 0.35, x + 0.35, y + h, z + 0.35, null);
      } else { // fuel tank
        const r = R(1.6, 2.4), h = R(2.5, 4);
        const m = addMesh(new THREE.CylinderGeometry(r, r, h, 8), C.metal, x, y + h / 2, z);
        addMesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.25, 8), C.accent, x, y + h * 0.7, z);
        if (col) addCollider(x - r * 0.85, y, z - r * 0.85, x + r * 0.85, y + h, z + r * 0.85, m);
      }
    },
    moon: (x, z, y = 0, col = true) => {
      if (rng() < 0.5) { // glowing crystal cluster
        const n = 3 + Math.floor(rng() * 3);
        let main = null;
        for (let k = 0; k < n; k++) {
          const s = R(0.5, 1.4);
          const m = addMesh(new THREE.OctahedronGeometry(s, 0), C.accent, x + R(-1, 1), y + s * 0.8, z + R(-1, 1), { emissive: C.accent, emissiveIntensity: 0.9 });
          m.scale.y = R(1.5, 2.6); m.rotation.set(R(-0.3, 0.3), R(0, 6), R(-0.3, 0.3));
          if (!main) main = m;
        }
        if (col) addCollider(x - 1.2, y, z - 1.2, x + 1.2, y + 2.5, z + 1.2, main);
      } else { // bone spire
        const r = R(0.8, 1.5), h = R(5, 11);
        const m = addMesh(new THREE.ConeGeometry(r, h, 5), 0xcfc8b2, x, y + h / 2, z);
        m.rotation.z = R(-0.12, 0.12);
        if (col) addCollider(x - r * 0.6, y, z - r * 0.6, x + r * 0.6, y + h * 0.7, z + r * 0.6, m);
      }
    },
    mars: (x, z, y = 0, col = true) => {
      if (rng() < 0.55) { // mesa
        const r = R(2.5, 5), h = R(3, 8);
        const m = addMesh(new THREE.CylinderGeometry(r * 0.8, r, h, 7), RP([C.rock, C.rock2]), x, y + h / 2, z);
        if (col) addCollider(x - r * 0.75, y, z - r * 0.75, x + r * 0.75, y + h, z + r * 0.75, m);
      } else { // half-buried dome
        const r = R(2, 3.5);
        const m = addMesh(new THREE.SphereGeometry(r, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), C.metal, x, y, z);
        addMesh(new THREE.TorusGeometry(r * 0.98, 0.12, 4, 12).rotateX(Math.PI / 2), C.accent, x, y + 0.2, z, { emissive: C.accent, emissiveIntensity: 0.4 });
        if (col) addCollider(x - r * 0.7, y, z - r * 0.7, x + r * 0.7, y + r * 0.85, z + r * 0.7, m);
      }
    },
    titan: (x, z, y = 0, col = true) => {
      const t = rng();
      if (t < 0.4) { // arcology module with lit windows
        const rot = rng() < 0.5, w = rot ? 6 : 4, d = rot ? 4 : 6, h = R(3, 4.5);
        const m = addBox(x, z, w, h, d, C.wall, y, col);
        addBox(x, z, w + 0.06, 0.35, d + 0.06, C.accent, y + h * 0.62, false, { emissive: C.accent, emissiveIntensity: 1.1 });
        addBox(x, z, w * 0.7, 0.4, d * 0.7, C.metal, y + h, false);
        return m;
      } else if (t < 0.7) { // pipeline on supports
        const along = rng() < 0.5, L = R(8, 13);
        const pipe = addMesh(new THREE.CylinderGeometry(0.55, 0.55, L, 8).rotateZ(Math.PI / 2).rotateY(along ? 0 : Math.PI / 2), C.metal, x, y + 1.1, z);
        for (const s of [-1, 1]) addBox(along ? x + s * (L / 2 - 0.6) : x, along ? z : z + s * (L / 2 - 0.6), 0.5, 1.1, 0.5, C.rock2, y, false);
        if (col) addCollider(along ? x - L / 2 : x - 0.6, y, along ? z - 0.6 : z - L / 2, along ? x + L / 2 : x + 0.6, y + 1.7, along ? z + 0.6 : z + L / 2, pipe);
        return pipe;
      }
      // stilted tower with a tank on top
      const h = R(5, 8);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) addBox(x + sx * 1.4, z + sz * 1.4, 0.4, h, 0.4, C.rock2, y, col);
      addBox(x, z, 3.6, 0.4, 3.6, C.metal, y + h, false);
      return addMesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 10), C.wall, x, y + h + 1.5, z);
    },
    tangled: (x, z, y = 0, col = true) => {
      const t = rng();
      if (t < 0.4) { // scrap shanty with a lantern
        const w = R(3, 4.5), d = R(3, 4.5), h = R(2.6, 3.4);
        const m = addBox(x, z, w, h, d, RP([C.wall, C.metal, C.crate]), y, col);
        const roof = addBox(x, z, w + 0.8, 0.2, d + 0.8, C.rock2, y + h, false);
        roof.rotation.z = R(-0.12, 0.12);
        addBox(x + w / 2 + 0.1, z, 0.25, 0.35, 0.25, C.accent, y + h * 0.7, false, { emissive: C.accent, emissiveIntensity: 1.4 });
        return m;
      } else if (t < 0.7) { // lashed asteroid boulder with a cable spike
        const s = R(1.6, 3);
        addRock(x, z, s, y, col);
        addMesh(new THREE.CylinderGeometry(0.08, 0.08, s * 2.6, 4), 0x2a2a2e, x, y + s * 1.2, z).rotation.z = R(-0.5, 0.5);
        return null;
      }
      // Fallen banner pole
      const h = R(4, 6);
      addBox(x, z, 0.25, h, 0.25, C.metal, y, col);
      addBox(x + 0.45, z, 0.7, 1.6, 0.05, RP([C.enemy, 0x8a3a5a]), y + h - 1.9, false);
      return addBox(x, z, 0.2, 0.2, 0.2, C.accent, y + h, false, { emissive: C.accent, emissiveIntensity: 1.5 });
    },
    dc: (x, z, y = 0, col = true) => {
      const t = rng();
      if (t < 0.4) { // ivory Awoken spire with a glowing crystal tip
        const h = R(5, 11), r = R(0.5, 0.9);
        addMesh(new THREE.CylinderGeometry(r * 0.6, r * 1.5, h * 0.25, 6), C.wall, x, y + h * 0.125, z);
        const m = addMesh(new THREE.ConeGeometry(r, h, 6), C.wall, x, y + h / 2, z);
        addMesh(new THREE.OctahedronGeometry(r * 0.7), C.accent, x, y + h + r * 0.4, z, { emissive: C.accent, emissiveIntensity: 1.2 });
        if (col) addCollider(x - r, y, z - r, x + r, y + h, z + r, m);
        return m;
      } else if (t < 0.75) { // crystal cluster, pale blue
        const n = 3 + Math.floor(rng() * 3);
        let m = null;
        for (let k = 0; k < n; k++) m = addMesh(new THREE.ConeGeometry(R(0.3, 0.6), R(1.4, 3.4), 5), 0x9fe8ff, x + R(-1, 1), y + 1, z + R(-1, 1), { emissive: 0x6ac8ff, emissiveIntensity: 0.5 });
        if (col) addCollider(x - 1, y, z - 1, x + 1, y + 2.4, z + 1, null);
        return m;
      }
      // overgrown low wall of ivory stone
      const w = R(3, 6);
      const m = addBox(x, z, w, 1.1, 0.7, C.wall, y, col);
      addBox(x, z, w + 0.2, 0.15, 0.9, C.foliage, y + 1.1, false);
      return m;
    },
    leviathan: (x, z, y = 0, col = true) => {
      const t = rng();
      if (t < 0.5) { // gold-banded black marble column
        const h = R(4, 7);
        const m = addBox(x, z, 1.3, h, 1.3, C.rock, y, col);
        addBox(x, z, 1.5, 0.3, 1.5, C.accent, y + 0.4, false, { emissive: C.accent, emissiveIntensity: 0.6 });
        addBox(x, z, 1.5, 0.3, 1.5, C.accent, y + h - 0.6, false, { emissive: C.accent, emissiveIntensity: 0.6 });
        return m;
      }
      // banquet table with golden goblets
      const m = addBox(x, z, 4.2, 0.9, 1.4, C.wall, y, col);
      for (let k = -1; k <= 1; k++) addMesh(new THREE.CylinderGeometry(0.1, 0.07, 0.22, 6), C.accent, x + k * 1.2, y + 1.01, z, { emissive: C.accent, emissiveIntensity: 0.8 });
      return m;
    },
    io: (x, z, y = 0, col = true) => {
      const t = rng();
      if (t < 0.4) { // white mineral spire where the Traveler's Light crystallised
        const h = R(4, 9), r = R(0.6, 1.2);
        addMesh(new THREE.ConeGeometry(r * 1.6, h * 0.3, 6), C.rock, x, y + h * 0.15, z);
        const m = addMesh(new THREE.ConeGeometry(r, h, 5), 0xf2eee0, x, y + h / 2, z, { emissive: 0xfff4d0, emissiveIntensity: 0.25 });
        m.rotation.z = R(-0.15, 0.15);
        if (col) addCollider(x - r, y, z - r, x + r, y + h, z + r, m);
        return m;
      } else if (t < 0.7) { // teal sulfur pool with a steaming vent
        const r = R(1.8, 3.2);
        addMesh(new THREE.CylinderGeometry(r * 1.15, r * 1.25, 0.18, 9), C.ground2, x, y + 0.09, z);
        addMesh(new THREE.CylinderGeometry(r, r, 0.04, 9), C.foliage, x, y + 0.2, z, { emissive: C.foliage, emissiveIntensity: 0.6 });
        return addMesh(new THREE.ConeGeometry(0.5, 1.2, 6), C.rock2, x + r * 0.4, y + 0.6, z);
      }
      // Red Legion supply drop pod
      const h = R(2.4, 3.2);
      const m = addBox(x, z, 1.8, h, 1.8, C.metal, y, col);
      addBox(x, z, 2.2, 0.3, 2.2, C.enemy, y + h, false);
      addBox(x, z + 0.92, 1.2, 0.18, 0.06, C.accent, y + h * 0.6, false, { emissive: C.accent, emissiveIntensity: 1.6 });
      return m;
    },
  }[loc.theme || loc.id];

  const placeRandom = (fn, cx, cz, rMin, rMax, size = 3) => {
    for (let t = 0; t < 12; t++) {
      const a = R(0, Math.PI * 2), r = R(rMin, rMax);
      const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      if (isClear(x, z, size)) { fn(x, z); return true; }
    }
    return false;
  };
  const weighted = (table) => {
    const total = table.reduce((s, t) => s + t[1], 0);
    let r = rng() * total;
    for (const [fn, w] of table) { r -= w; if (r <= 0) return fn; }
    return table[0][0];
  };

  const lamps = [], doors = [];
  const buildFrom = scene.children.length;
  set.build(makeKit());
  if (loc.vista) separateCoplanar(scene);

  // ---- kit handed to hand-built mission maps (js/level-*.js) ----
  function makeKit() {
    const glow = (color, k) => (k ? { emissive: color, emissiveIntensity: k } : undefined);
    const K = {
      C, loc, def, rng, R, RP, chance: (p) => rng() < p, bounds, spawn, zones, scene,
      mat: (color, k) => mat(color, glow(color, k)),
      collider: addCollider,
      ground: GY, // terrain height at (x, z); every y the kit takes is measured from it (pass { abs: true } to a box for a world height)
      terrain,
      ocollider: (x, z, w, h, d, ry, y0 = 0) => addOriented(x, y0, z, w, h, d, ry, null),
      // box yawed by ry, with an exact collider
      obox: (x, z, w, h, d, ry, color = C.wall, o = {}) => {
        const m = addBox(x, z, w, h, d, color, o.y ?? 0, false, glow(color, o.glow));
        m.rotation.y = ry;
        if (o.collide ?? true) addOriented(x, o.y ?? 0, z, w, h, d, ry, m);
        return m;
      },
      box: (x, z, w, h, d, color = C.wall, o = {}) => addBox(x, z, w, h, d, color, o.y ?? 0, o.collide ?? true, glow(color, o.glow), !!o.abs),
      mesh(geo, color, x, y, z, o = {}) {
        const m = addMesh(geo, color, x, y, z, glow(color, o.glow));
        m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
        if (o.scale) m.scale.set(...[].concat(o.scale, o.scale, o.scale).slice(0, 3));
        const yawOnly = geo.type === 'BoxGeometry' && o.ry && !o.rx && !o.rz && o.collide === true;
        if (yawOnly) {
          const sc = m.scale, gp = geo.parameters;
          addOriented(x, y - gp.height * sc.y / 2, z, gp.width * sc.x, gp.height * sc.y, gp.depth * sc.z, o.ry, m);
        } else if (o.collide) {
          m.updateMatrixWorld(true);
          const bb = new THREE.Box3().setFromObject(m);
          const k = o.collide === true ? 1 : o.collide; // shrink factor for round shapes
          const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
          rawCollider(cx - (cx - bb.min.x) * k, bb.min.y, cz - (cz - bb.min.z) * k, cx + (bb.max.x - cx) * k, bb.max.y, cz + (bb.max.z - cz) * k, m);
        }
        return m;
      },
      cyl: (x, z, r, h, color = C.metal, o = {}) => K.mesh(new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.sides ?? 8), color, x, (o.y ?? 0) + h / 2, z, { ...o, collide: o.collide === false ? false : 0.8 }),
      cone: (x, z, r, h, color = C.rock, o = {}) => K.mesh(new THREE.ConeGeometry(r, h, o.sides ?? 6), color, x, (o.y ?? 0) + h / 2, z, { ...o, collide: o.collide === false ? false : 0.55 }),
      rock: (x, z, s, o = {}) => addRock(x, z, s, o.y ?? 0, o.collide ?? true),
      // axis-aligned wall from (x1,z1) to (x2,z2); gaps are [from, to] distances along it
      wall(x1, z1, x2, z2, h, o = {}) {
        const t = o.t ?? 0.8, color = o.color ?? C.wall, y = o.y ?? 0;
        const horiz = Math.abs(z2 - z1) < Math.abs(x2 - x1);
        const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
        const start = horiz ? Math.min(x1, x2) : Math.min(z1, z2), fixed = horiz ? z1 : x1;
        const gaps = (o.gaps || []).slice().sort((a, b) => a[0] - b[0]);
        let from = 0;
        for (const [a, b] of [...gaps, [len, len]]) {
          if (a - from > 0.3) {
            const mid = start + (from + a) / 2, L = a - from;
            if (horiz) addBox(mid, fixed, L, h, t, color, y); else addBox(fixed, mid, t, h, L, color, y);
          }
          from = Math.max(from, b);
        }
      },
      // four walls with door gaps ({ n: width, s: width, e: width, w: width }) and an optional roof
      room(cx, cz, w, d, h, o = {}) {
        const t = o.t ?? 0.8, doors = o.doors || {}, color = o.color ?? C.wall;
        const gap = (side, len) => (doors[side] ? [[len / 2 - doors[side] / 2 + (o.doorOffset?.[side] ?? 0), len / 2 + doors[side] / 2 + (o.doorOffset?.[side] ?? 0)]] : []);
        K.wall(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, h, { t, color, gaps: gap('n', w) });
        K.wall(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2, h, { t, color, gaps: gap('s', w) });
        K.wall(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2, h, { t, color, gaps: gap('w', d) });
        K.wall(cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h, { t, color, gaps: gap('e', d) });
        if (o.roof) addBox(cx, cz, w + t, 0.6, d + t, o.roofColor ?? color, h, true);
      },
      // stairs climbing toward dir ('n' = -z, 's' = +z, 'e' = +x, 'w' = -x), starting at (x, z); returns the top edge point
      stairs(x, z, dir, w, rise, o = {}) {
        const step = 0.4, run = 0.6, n = Math.max(1, Math.ceil(rise / step)), color = o.color ?? C.metal;
        // on terrain the stairs start from the ground at their foot, so they land on the deck whatever the slope does between
        const abs = !!(o.abs || lift), y0 = lift && !o.abs ? gAt(x, z) + (o.y ?? 0) : o.y ?? 0;
        const [dx, dz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[dir];
        for (let i = 0; i < n; i++) {
          const hh = Math.min(rise, (i + 1) * step), cxs = x + dx * (i + 0.5) * run, czs = z + dz * (i + 0.5) * run;
          addBox(cxs, czs, dx ? run : w, hh, dz ? run : w, color, y0, true, undefined, abs);
        }
        return [x + dx * n * run, z + dz * n * run];
      },
      // raised deck with stairs on the given sides
      platform(x, z, w, d, h, o = {}) {
        const m = addBox(x, z, w, h, d, o.color ?? C.wall, o.y ?? 0);
        const top = lift ? gAt(x, z) + (o.y ?? 0) + h : h + (o.y ?? 0); // world height of the deck
        const out = (side, n) => ({ n: [x, z - d / 2 - n, 's'], s: [x, z + d / 2 + n, 'n'], e: [x + w / 2 + n, z, 'w'], w: [x - w / 2 - n, z, 'e'] })[side];
        for (const side of o.stairs || []) {
          if (!lift) { const [sx, sz, dir] = out(side, Math.ceil(h / 0.4) * 0.6); K.stairs(sx, sz, dir, o.stairW ?? 2.4, h, { color: o.stairColor ?? C.metal, y: o.y }); continue; }
          // measure the foot on the ground just outside the deck, then climb whatever height that leaves
          let [sx, sz, dir] = out(side, 0.6), foot = (o.y ?? 0) > 0 ? top - h : gAt(sx, sz), rise = top - foot;
          [sx, sz, dir] = out(side, Math.ceil(rise / 0.4) * 0.6);
          if ((o.y ?? 0) <= 0) { foot = gAt(sx, sz); rise = top - foot; }
          if (rise > 0.2) K.stairs(sx, sz, dir, o.stairW ?? 2.4, rise, { color: o.stairColor ?? C.metal, y: foot, abs: true });
        }
        return m;
      },
      // U15: any number of lights per map. Each gets a small glow bulb, and updateLights() lends the 6 nearest the player a real PointLight (point lights are expensive)
      light(x, y, z, color = C.accent, intensity = 8, dist = 22) {
        lamps.push({ x, y: y + gy(x, z), z, color, intensity, dist, d2: 0 });
        if (set.hideBulbs) return null; // a map whose lights sit in visible fixtures (the patrol zones) shows no glow dot of its own
        const bulb = new THREE.Mesh(BULB, new THREE.MeshBasicMaterial({ color, fog: false }));
        bulb.position.set(x, y + gy(x, z), z);
        scene.add(bulb);
        return bulb;
      },
      // U15: a door that is a solid block until a zone clear (zone: index), a story beat (open it by id) or never (zone: null) opens it
      door(x, z, w, h, axis, o = {}) {
        const t = o.t ?? 0.7, color = o.color ?? C.metal;
        const m = addBox(x, z, axis === 'x' ? w : t, h, axis === 'x' ? t : w, color, o.y ?? 0, true, glow(o.trim ?? C.accent, 0.25));
        const gd = gy(x, z); // the door's base sits on the terrain (a skirt, if any, hides below it)
        const stripe = new THREE.Mesh(BOX, mat(o.trim ?? C.accent, { emissive: o.trim ?? C.accent, emissiveIntensity: 1.6 }));
        stripe.scale.set(axis === 'x' ? w * 0.8 : t + 0.06, 0.18, axis === 'x' ? t + 0.06 : w * 0.8);
        stripe.position.set(0, 0, 0);
        const d = { id: o.id ?? `door${doors.length}`, zone: o.zone ?? null, mesh: m, stripe, y0: m.position.y, h, collider: colliders[colliders.length - 1], open: false, t: 0, x, z, w, t2: t, axis, lock: null, lockHeld: false };
        stripe.position.set(x, (o.y ?? 0) + gd + h * 0.7, z);
        scene.add(stripe);
        doors.push(d);
        return d;
      },
      clear: isClear, inBounds,
      scatter: (fn, cx, cz, rMin, rMax, n, size = 2) => { for (let i = 0; i < n; i++) placeRandom(fn, cx, cz, rMin, rMax, size); },
      cover: (x, z) => weighted([[P.crate, 3], [P.wall, 4], [P.rock, 2], [P.pillar, 2]])(x, z),
      crate: P.crate, pillar: P.pillar,
      prop: (x, z, y = 0, collide = true) => themed(x, z, y, collide),
      // scenery on the slopes outside the play area; fn(x, z, y) should not add colliders
      edge(fn, n = 40, near = 6, far = 45) {
        for (let k = 0; k < n; k++) {
          const side = Math.floor(rng() * 4), off = R(near, far);
          let x, z;
          if (side === 0) { x = bounds.minX - off; z = R(bounds.minZ - 40, bounds.maxZ + 40); }
          else if (side === 1) { x = bounds.maxX + off; z = R(bounds.minZ - 40, bounds.maxZ + 40); }
          else if (side === 2) { z = bounds.minZ - off; x = R(bounds.minX - 40, bounds.maxX + 40); }
          else { z = bounds.maxZ + off; x = R(bounds.minX - 40, bounds.maxX + 40); }
          lift = false; // slope scenery is placed at the absolute height of the slope
          fn(x, z, loc.sea ? -0.7 : heightAt(x, z) - 0.6);
          lift = !!gAt;
        }
      },
    };
    return K;
  }

  // edge scenery on the slopes (no collision)
  lift = false;
  if (!set.noEdge) for (let k = 0; k < 70; k++) {
    const side = Math.floor(rng() * 4);
    const off = R(6, 45);
    let x, z;
    if (side === 0) { x = bounds.minX - off; z = R(bounds.minZ - 40, bounds.maxZ + 40); }
    else if (side === 1) { x = bounds.maxX + off; z = R(bounds.minZ - 40, bounds.maxZ + 40); }
    else if (side === 2) { z = bounds.minZ - off; x = R(bounds.minX - 40, bounds.maxX + 40); }
    else { z = bounds.maxZ + off; x = R(bounds.minX - 40, bounds.maxX + 40); }
    const y = loc.sea ? -0.7 : heightAt(x, z) - 0.6;
    if (rng() < 0.5 && !loc.sea) addRock(x, z, R(3, 8), y, false); else themed(x, z, y, false);
  }
  lift = !!gAt;
  // invisible boundary walls
  const T = 200;
  // U16d: a map can leave sides open (`open: { e: true }`): no boundary wall there, and past the edge there is no floor (see voidAt)
  const open = set.open || {};
  if (!open.w) rawCollider(bounds.minX - 10, -5, bounds.minZ - 10, bounds.minX, T, bounds.maxZ + 10, null);
  if (!open.e) rawCollider(bounds.maxX, -5, bounds.minZ - 10, bounds.maxX + 10, T, bounds.maxZ + 10, null);
  if (!open.n) rawCollider(bounds.minX - 10, -5, bounds.minZ - 10, bounds.maxX + 10, T, bounds.minZ, null);
  if (!open.s) rawCollider(bounds.minX - 10, -5, bounds.maxZ, bounds.maxX + 10, T, bounds.maxZ + 10, null);
  const voidAt = Object.keys(open).length ? (x, z) => (open.w && x < bounds.minX) || (open.e && x > bounds.maxX) || (open.n && z < bounds.minZ) || (open.s && z > bounds.maxZ) : null;

  if (set.merge) mergeDecor(scene, buildFrom, new Set(staticMeshes)); // U17a: a packed map folds its scenery into few draw calls

  // ---- light pool: the 6 nearest lamps get a real light, so a map can hold dozens (U15) ----
  const pool = [];
  const POOL = set.lightPool ?? 6; // real lights lent to the nearest lamps (point lights are costly; a fixture-lit map asks for a few more)
  for (let i = 0; i < Math.min(POOL, lamps.length); i++) { const l = new THREE.PointLight(0xffffff, 0, 1, 1.6); scene.add(l); pool.push(l); }
  const updateLights = (p) => {
    if (!pool.length) return;
    for (const l of lamps) l.d2 = (l.x - p.x) ** 2 + (l.z - p.z) ** 2;
    const near = lamps.length > pool.length ? lamps.slice().sort((a, b) => a.d2 - b.d2) : lamps;
    pool.forEach((pl, i) => {
      const l = near[i];
      if (!l) { pl.intensity = 0; return; }
      pl.color.setHex(l.color); pl.intensity = l.intensity; pl.distance = l.dist; pl.position.set(l.x, l.y, l.z);
    });
  };
  updateLights(spawn);
  const updateAll = (p) => { sky?.update(p, performance.now() / 1000); updateLights(p); };

  /** Opens every closed door tied to a cleared zone (or a named door). Returns true if any opened. */
  const openDoors = (zoneIdx, id = null) => {
    let any = false;
    for (const d of doors) {
      if (d.open || d.lockHeld || (zoneIdx === 'all' ? false : id ? d.id !== id : d.zone !== zoneIdx)) continue;
      d.open = true; any = true;
      const i = colliders.indexOf(d.collider);
      if (i >= 0) colliders.splice(i, 1);
      const j = staticMeshes.indexOf(d.mesh);
      if (j >= 0) staticMeshes.splice(j, 1);
    }
    return any;
  };
  const updateDoors = (dt) => {
    for (const d of doors) {
      if (!d.open && d.lockHeld && d.t > 0) { // a sealed boss room door sliding shut
        d.t = Math.max(0, d.t - dt * 1.4);
        d.mesh.position.y = d.y0 + d.t * (d.h + 0.2);
        d.stripe.position.y = d.y0 + d.h * 0.7 + d.t * (d.h + 0.2);
        continue;
      }
      if (!d.open || d.t >= 1) continue;
      d.t = Math.min(1, d.t + dt * 1.4);
      d.mesh.position.y = d.y0 + d.t * (d.h + 0.2);
      d.stripe.position.y = d.y0 + d.h * 0.7 + d.t * (d.h + 0.2);
      if (d.t >= 1) { d.mesh.visible = false; d.stripe.visible = false; }
    }
  };

  // U16d boss lock-in: the doors that led into a boss room shut again once the boss fight starts and everyone is inside, and open
  // when it ends or when someone is outside (a respawn, a Guardian who lagged behind). `want` is the set of boss zone indexes that
  // should be sealed now; `points` are the players' positions, so a door never closes on someone standing in it.
  // Returns 'sealed', 'opened' or null when nothing changed.
  const syncLocks = (want, points) => {
    let res = null;
    for (const d of doors) {
      if (d.lock == null) continue;
      if (want.has(d.lock) && !d.lockHeld && d.open) {
        const hx = (d.axis === 'x' ? d.w : d.t2) / 2 + 1.3, hz = (d.axis === 'x' ? d.t2 : d.w) / 2 + 1.3;
        if (points.some((p) => Math.abs(p.x - d.x) < hx && Math.abs(p.z - d.z) < hz)) continue;
        d.open = false; d.lockHeld = true; d.t = 1;
        d.mesh.visible = true; d.stripe.visible = true;
        if (!colliders.includes(d.collider)) colliders.push(d.collider);
        if (!staticMeshes.includes(d.mesh)) staticMeshes.push(d.mesh);
        res = 'sealed';
      } else if (!want.has(d.lock) && d.lockHeld) {
        d.lockHeld = false; d.open = true; d.t = 0;
        const i = colliders.indexOf(d.collider); if (i >= 0) colliders.splice(i, 1);
        const j = staticMeshes.indexOf(d.mesh); if (j >= 0) staticMeshes.splice(j, 1);
        res = res || 'opened';
      }
    }
    return res;
  };
  // every door into a boss room (it opens on the zone before) can seal behind the party
  const bossIdx = zones.findIndex((z) => z.isBoss);
  if (bossIdx > 0 && set.lockIn !== false) for (const d of doors) if (d.zone === bossIdx - 1) d.lock = bossIdx;

  return { scene, sun, sunOffset, colliders, staticMeshes, zones, spawn, bounds, doors, updateLights: updateAll, openDoors, updateDoors, syncLocks, voidAt, groundAt: gAt, terrain, patrol: set.patrol };
}

/**
 * Coplanar faces of different colours (trim against walls, slab edges) flicker at distance. Each material gets its own
 * small depth offset from its colour, so any two such faces always resolve the same way instead of fighting.
 */
function separateCoplanar(scene) {
  const seen = new Set();
  scene.traverse((o) => {
    const m = o.isMesh && !o.isInstancedMesh && o.material;
    if (!m || seen.has(m) || !m.color || m.transparent || m.fog === false) return;
    seen.add(m);
    m.polygonOffset = true;
    m.polygonOffsetFactor = 1;
    m.polygonOffsetUnits = 1 + (m.color.getHex() % 7);
  });
}

/**
 * U17a: folds scenery into one mesh per material. Packed maps (the patrol zones) have thousands of small boxes; merged, they cost a few
 * hundred draw calls instead. Only plain lit meshes added by the map's build are merged; anything that collides, moves or is looked through
 * (staticMeshes, doors, lamps, sky) stays as it is.
 */
function mergeDecor(scene, from, keep) {
  scene.updateMatrixWorld(true);
  const groups = new Map();
  for (const o of scene.children.slice(from)) {
    const m = o.material;
    if (!o.isMesh || o.isInstancedMesh || o.children.length || keep.has(o) || o.userData.noMerge || Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent || m.vertexColors) continue;
    const cell = `${Math.floor(o.matrixWorld.elements[12] / 64)},${Math.floor(o.matrixWorld.elements[14] / 64)}`; // chunks keep frustum culling working
    const key = `${m.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${cell}`;
    (groups.get(key) || groups.set(key, []).get(key)).push(o);
  }
  for (const list of groups.values()) {
    if (list.length < 3) continue;
    const parts = list.map((o) => {
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
      return g;
    });
    let n = 0;
    for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let at = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, at * 3); nor.set(g.attributes.normal.array, at * 3); at += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, list[0].material);
    mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
    scene.add(mesh);
    for (const o of list) scene.remove(o);
  }
}

function buildGround(bounds, C, heightAt, rng, cellSize = 5) {
  const rolling = cellSize < 5; // terrain map: rock shows where the ground is steep, not just where it is high
  const pad = 130;
  const minX = bounds.minX - pad, maxX = bounds.maxX + pad, minZ = bounds.minZ - pad, maxZ = bounds.maxZ + pad;
  const W = maxX - minX, D = maxZ - minZ;
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W / cellSize), Math.round(D / cellSize));
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  const g2 = geo.toNonIndexed();
  g2.computeVertexNormals();
  const p2 = g2.attributes.position;
  const colors = new Float32Array(p2.count * 3);
  const c = new THREE.Color(), cA = new THREE.Color(C.ground), cB = new THREE.Color(C.ground2), rA = new THREE.Color(C.rock), rB = new THREE.Color(C.rock2);
  for (let i = 0; i < p2.count; i += 3) {
    const y = (p2.getY(i) + p2.getY(i + 1) + p2.getY(i + 2)) / 3;
    const steep = rolling ? g2.attributes.normal.getY(i) < 0.93 : y > 1.2;
    if (steep) c.lerpColors(rA, rB, rng()); else c.lerpColors(cA, cB, rng());
    for (let k = 0; k < 3; k++) { colors[(i + k) * 3] = c.r; colors[(i + k) * 3 + 1] = c.g; colors[(i + k) * 3 + 2] = c.b; }
  }
  g2.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Orbit / menu backdrop: a spinning low-poly planet in a starfield
// ---------------------------------------------------------------------------
function planetNoise(v) {
  return Math.sin(v.x * 3.1 + 1.3) * Math.sin(v.y * 2.7 + 0.4) * Math.sin(v.z * 3.3 + 2.1)
    + 0.5 * Math.sin(v.x * 7.3 - v.z * 5.1 + v.y * 6.2)
    + 0.25 * Math.sin(v.x * 13 + v.y * 11 - v.z * 9);
}

function buildPlanet(loc, locked = false, dim = 1) {
  const geo = new THREE.IcosahedronGeometry(3.2, 4);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const elev = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let n = planetNoise(v);
    if (loc.planetColors.sea) n = Math.max(n, 0);
    elev[i] = n;
    v.multiplyScalar(3.2 * (1 + n * 0.055));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const cols = loc.planetColors.c.map((h) => new THREE.Color(h));
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const e = Math.max(elev[i], elev[i + 1], elev[i + 2]);
    const c = e <= 0.0 ? cols[0] : e < 0.35 ? cols[1] : e < 0.75 ? cols[2] : cols[3];
    for (let k = 0; k < 3; k++) { colors[(i + k) * 3] = c.r * dim; colors[(i + k) * 3 + 1] = c.g * dim; colors[(i + k) * 3 + 2] = c.b * dim; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const planet = new THREE.Mesh(geo, locked ? new THREE.MeshBasicMaterial({ color: 0x080b12 }) : new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  const atmo = new THREE.Mesh(new THREE.IcosahedronGeometry(3.55, 3), new THREE.MeshBasicMaterial({ color: locked ? 0x6c7a96 : loc.atmo, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  const g = new THREE.Group();
  g.add(planet, atmo);
  return g;
}


// ---------------------------------------------------------------------------
// U16b Director star map: every destination in view around the sun (Destiny 1 style). Unlocked planets are
// lit and spinning, locked ones are black silhouettes. `focus(id)` flies the camera to one planet; `onFrame`
// hands the screen position and size of every node to the UI so it can place its click targets.
// ---------------------------------------------------------------------------
// [x, y, scale] per node, all inside the part of the screen below the top bar. The Tower (a Traveler orb) is in the
// middle; the Moon is a small planet above Earth with Titan beside it, the Reef is a nebula and the Leviathan is a ship.
export const DIRECTOR_POS = {
  tower: [0, -0.3, 0.9], earth: [-5.6, -2.3, 0.62], moon: [-5.0, 0.9, 0.22], titan: [-7.7, 0.6, 0.38],
  tangled: [-2.4, 2.1, 0.85], dc: [2.9, 2.3, 0.34], io: [6.0, 1.3, 0.45], mars: [6.2, -2.2, 0.55], leviathan: [0.4, -3.7, 0.9],
};
const FOCUS_SCALE = 0.62;
const NODE_RADIUS = { tower: 1.5, tangled: 2.1, leviathan: 2.2 };
const FOCUS = { tower: 1.5, tangled: 1.35, leviathan: 1.5 };

let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (_glow = new THREE.CanvasTexture(c));
}

// the Reef: a purple and magenta nebula full of drifting rock
function buildNebulaNode(locked) {
  const g = new THREE.Group();
  const cols = locked ? [0x2a3040] : [0x9b5cff, 0xe0489c, 0x3fb3d9, 0x6a3fd0];
  let seed = 11; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 20; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: cols[i % cols.length], transparent: true, opacity: locked ? 0.35 : 0.42, blending: locked ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false }));
    const a = r() * Math.PI * 2, d = r() * 1.5;
    sp.position.set(Math.cos(a) * d * 1.3, Math.sin(a) * d * 0.8, (r() - 0.5) * 0.6);
    sp.scale.setScalar(1.6 + r() * 2.2);
    g.add(sp);
  }
  const rock = new THREE.MeshStandardMaterial({ color: locked ? 0x0a0d14 : 0x3a3446, flatShading: true, roughness: 1 });
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05 + r() * 0.16, 0), rock);
    const a = r() * Math.PI * 2, d = 0.4 + r() * 1.6;
    m.position.set(Math.cos(a) * d * 1.2, Math.sin(a) * d * 0.75, (r() - 0.3) * 0.8);
    m.rotation.set(r() * 3, r() * 3, 0);
    g.add(m);
  }
  return g;
}

// the Leviathan: Calus's pleasure barge, a long gold hull with a crowned fore deck, a central spire and twin engines
function buildShipNode(locked) {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: locked ? 0x080b12 : 0x9a7a3c, flatShading: true, roughness: 0.6, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: locked ? 0x080b12 : 0x5a4626, flatShading: true, roughness: 0.7 });
  const lit = new THREE.MeshBasicMaterial({ color: locked ? 0x10141c : 0xffd27a });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hull);
  body.scale.set(3.4, 0.55, 0.95); g.add(body);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.9), dark); deck.position.y = 0.38; g.add(deck);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), hull); crown.position.set(2.2, 0.3, 0); crown.scale.set(1.1, 0.8, 0.9); g.add(crown);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.34, 1.7, 6), hull); spire.position.set(-0.2, 1.1, 0); g.add(spire);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), lit); tip.position.set(-0.2, 2.2, 0); g.add(tip);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 20), lit); ring.rotation.x = Math.PI / 2; ring.position.set(-0.2, 0.75, 0); g.add(ring);
  for (const z of [-0.55, 0.55]) { // engines and fins
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 1.1, 7), dark); eng.rotation.z = Math.PI / 2; eng.position.set(-3.1, -0.05, z); g.add(eng);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 7), lit); fl.rotation.z = Math.PI / 2; fl.position.set(-3.75, -0.05, z); g.add(fl);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.06), dark); fin.position.set(-2.6, 0.25, z * 1.5); fin.rotation.z = 0.25; g.add(fin);
  }
  for (let i = 0; i < 9; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.02), lit); w.position.set(-2 + i * 0.5, 0.05, 0.9 - Math.abs(i - 4) * 0.03); g.add(w); }
  g.scale.setScalar(0.6);
  g.rotation.set(0.35, 0, 0.12);
  return g;
}

function buildTowerNode(locked) {
  // the Traveler: a pale, cracked orb
  const g = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 3), new THREE.MeshStandardMaterial({ color: locked ? 0x080b12 : 0xc9d2da, flatShading: true, roughness: 0.7 }));
  const cut = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.04, 6, 40, Math.PI * 0.9), new THREE.MeshBasicMaterial({ color: 0x0b0e14 }));
  cut.rotation.set(0.5, 0.2, -0.6);
  g.add(orb, cut);
  return g;
}

function ringLine(r, opacity, z = -0.2, dash = false) {
  const pts = [];
  for (let i = 0; i <= 96; i++) { const t = (i / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0)); }
  const m = dash ? new THREE.LineDashedMaterial({ color: 0x9fb4c8, transparent: true, opacity, dashSize: 0.25, gapSize: 0.18 }) : new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity });
  const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m);
  if (dash) l.computeLineDistances();
  l.position.z = z;
  return l;
}

function createDirector(scene, camera) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  // faint chart grid and the rays round the Tower
  const grid = [];
  for (let x = -22; x <= 22; x += 2.2) grid.push(x, -14, -1, x, 14, -1);
  for (let y = -14; y <= 14; y += 2.2) grid.push(-22, y, -1, 22, y, -1);
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
  root.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x6f8a86, transparent: true, opacity: 0.05 })));
  const rays = [];
  for (let i = 0; i < 48; i++) { const t = (i / 48) * Math.PI * 2, r0 = 2.4, r1 = i % 4 ? 4.2 : 6.5; rays.push(Math.cos(t) * r0, Math.sin(t) * r0 + 0.2, -0.3, Math.cos(t) * r1, Math.sin(t) * r1 + 0.2, -0.3); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rays, 3));
  root.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xb9cdd8, transparent: true, opacity: 0.16 })));
  const keyLight = new THREE.DirectionalLight(0xdfe8ee, 1.6);
  keyLight.position.set(-6, 8, 10);
  root.add(keyLight);

  const nodes = new Map();
  let key = '', focusId = null, cb = null;
  let camX = 0, camY = 0, camZ = 18;

  function clear() {
    for (const n of nodes.values()) root.remove(n.group);
    nodes.clear();
  }

  const api = {
    root,
    /** entries: [{ id, loc, locked }]. Rebuilt only when the set or lock state changes. */
    setup(entries) {
      const k = entries.map((e) => e.id + (e.locked ? 'L' : 'U')).join(',');
      if (k === key) return;
      key = k;
      clear();
      for (const e of entries) {
        const [x, y, sc] = DIRECTOR_POS[e.id] || [0, 0, 1];
        const tower = e.id === 'tower';
        const pos = new THREE.Vector3(x, y, 0);
        const group = new THREE.Group();
        group.position.copy(pos);
        const body = tower ? buildTowerNode(e.locked) : e.id === 'tangled' ? buildNebulaNode(e.locked) : e.id === 'leviathan' ? buildShipNode(e.locked) : buildPlanet(e.loc, e.locked, 0.55);
        const radius = NODE_RADIUS[e.id] || 3.2;
        if (e.id === 'leviathan') body.userData.base = 0.6;
        body.scale.setScalar(e.id === 'leviathan' ? sc * 0.6 : sc);
        group.add(body);
        const ringR = radius * sc;
        if (e.id === 'tangled' || e.id === 'leviathan') group.add(ringLine(ringR * 1.12, 0.16, -0.2, true));
        else group.add(ringLine(ringR * 1.14, e.locked ? 0.1 : 0.32), ringLine(ringR * 1.3, 0.16, -0.2, true));
        if (tower) group.add(ringLine(ringR * 1.7, 0.2));
        root.add(group);
        nodes.set(e.id, { group, body, pos, locked: e.locked, radius, mapScale: sc, focusScale: FOCUS[e.id] || FOCUS_SCALE, scale: sc, rings: group.children.slice(1), base: e.id === 'leviathan' ? 0.6 : 1 });
      }
    },
    focus(id) { focusId = id && nodes.has(id) ? id : null; },
    onFrame(fn) { cb = fn; },
    update(dt) {
      const aspect = camera.aspect, tan = Math.tan((camera.fov * Math.PI) / 360);
      const k = 1 - Math.exp(-dt * 4.5);
      const f = focusId ? nodes.get(focusId) : null;
      const mapZ = 18 * Math.max(1, 1.78 / aspect), fz = 12 * Math.max(1, 1.5 / aspect);
      const tz = f ? fz : mapZ;
      const offX = f ? tan * fz * aspect * 0.42 : 0; // the planet sits left of centre, the panel on the right
      const tx = f ? f.pos.x + offX : 0, ty = f ? f.pos.y * 0.6 : 0;
      camX += (tx - camX) * k; camY += (ty - camY) * k; camZ += (tz - camZ) * k;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(camX, camY, 0);
      const list = [];
      for (const [id, n] of nodes) {
        const want = id === focusId ? n.focusScale : n.mapScale;
        n.scale += (want - n.scale) * k;
        n.body.scale.setScalar(n.scale * n.base);
        const ringS = n.scale / n.mapScale;
        for (const r of n.rings) r.scale.setScalar(ringS);
        if (id === 'leviathan') n.body.rotation.y = Math.sin(performance.now() / 4000) * 0.35;
        else if (id !== 'tangled') n.body.rotation.y += dt * (n.locked ? 0.02 : id === 'tower' ? 0.06 : 0.1);
        const v = n.pos.clone().project(camera);
        const rpx = ((n.radius * n.scale) / (tan * (camZ - n.pos.z))) * (innerHeight / 2);
        list.push({ id, x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, r: rpx, focused: id === focusId });
      }
      cb?.(list);
    },
  };
  return api;
}

export function createMenuScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060a);
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 0.6, 18);
  scene.add(new THREE.HemisphereLight(0x8899bb, 0x050608, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-10, 4, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fa8ff, 1.0);
  rim.position.set(8, -2, -6);
  scene.add(rim);

  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(2400 * 3);
  for (let i = 0; i < 2400; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(200 + Math.random() * 100);
    sp.set([v.x, v.y, v.z], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false }));
  scene.add(stars);

  // character stage (Character screen)
  const charHolder = new THREE.Group();
  charHolder.visible = false;
  scene.add(charHolder);
  const charLight = new THREE.DirectionalLight(0xfff2e0, 2.6);
  charLight.position.set(2, 3, 4);
  const charRim = new THREE.DirectionalLight(0x8fb4ff, 2.2);
  charRim.position.set(-3, 2.5, -3);
  charHolder.add(charLight, charRim, new THREE.HemisphereLight(0xc8d4e8, 0x1a1c22, 1.2));
  let character = null, charKey = null, charYaw = 0.35, mode = 'planet';

  const holder = new THREE.Group();
  holder.position.set(4.4, -0.2, 0);
  holder.rotation.z = 0.25;
  scene.add(holder);
  let planet = null, currentId = null;
  const director = createDirector(scene, camera);

  return {
    scene, camera, director,
    setLocation(loc) {
      if (currentId === loc.id) return;
      currentId = loc.id;
      if (planet) holder.remove(planet);
      planet = buildPlanet(loc);
      holder.add(planet);
    },
    setOffset(x) { holder.position.x = x; },
    setMode(m, classId, elementId, look) {
      mode = m;
      holder.visible = m === 'planet';
      director.root.visible = m === 'director';
      charHolder.visible = m === 'character';
      if (m === 'character') {
        const key = classId + elementId + JSON.stringify(look || null);
        if (charKey !== key) {
          if (character) charHolder.remove(character.group);
          character = buildCharacter(classId, elementId, look);
          charHolder.add(character.group);
          charKey = key;
        }
        // keep the whole figure in frame on tall or wide screens
        const dist = 5.4 * Math.max(1, 0.95 / camera.aspect);
        camera.position.set(0, 1.25, dist);
        camera.lookAt(0, 1.08, 0);
      } else if (m !== 'director') {
        camera.position.set(0, 0.6, 18);
        camera.lookAt(0, 0, 0);
      }
    },
    rotateChar(d) { charYaw += d; },
    update(dt) {
      if (character && mode === 'character') { character.update(dt); character.group.rotation.y = charYaw; }
      if (planet) planet.rotation.y += dt * 0.08;
      if (mode === 'director') director.update(dt);
      stars.rotation.y += dt * 0.004;
    },
    resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
  };
}
