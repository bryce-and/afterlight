import * as THREE from 'three';
import { mulberry32, hashStr } from './util.js';
import { buildCharacter } from './characters.js';
import { orientedCollider } from './colliders.js';
import EARTH from './level-earth.js';
import MOON from './level-moon.js';
import MARS from './level-mars.js';
import TITAN from './level-titan.js';
import TANGLED from './level-tangled.js';
import IO from './level-io.js';
import DC from './level-dc.js';
import LEVIATHAN from './level-leviathan.js';
import { TOWER } from './level-tower.js';

// Hand-built mission maps, keyed by mission id (see the kit in buildLevel).
const LEVEL_SETS = { ...EARTH, ...MOON, ...MARS, ...TITAN, ...TANGLED, ...IO, ...DC, ...LEVIATHAN, ...TOWER };

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
  const mood = withMood(loc.colors, def.mood);
  const C = mood.C;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.fog, loc.fog[0] * mood.fog, loc.fog[1] * mood.fog);
  scene.add(new THREE.HemisphereLight(C.hemiTop, C.hemiBot, loc.light.hemi * (0.5 + 0.5 * mood.light)));
  const sun = new THREE.DirectionalLight(C.sun, loc.light.sun * mood.light);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 220 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const sunOffset = new THREE.Vector3(...loc.sunDir).normalize().multiplyScalar(90);

  // sky body (planet / moon hanging in the sky)
  const sb = new THREE.Mesh(new THREE.IcosahedronGeometry(loc.skyBody.size, 2), new THREE.MeshBasicMaterial({ color: loc.skyBody.color, fog: false }));
  sb.position.set(...loc.skyBody.pos);
  scene.add(sb);
  if (loc.skyBody.ring) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(loc.skyBody.size * 1.35, loc.skyBody.size * 2.1, 48), new THREE.MeshBasicMaterial({ color: 0xd8c49a, fog: false, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    ring.position.copy(sb.position);
    ring.rotation.set(1.2, 0.3, 0.2);
    scene.add(ring);
  }

  // ---- zones ----
  const set = LEVEL_SETS[def.id];
  if (!set) throw new Error(`No level map for mission ${def.id}; add one to js/level-${loc.id}.js`);
  const zones = set.zones.map((z) => ({ center: new THREE.Vector3(z.x, 0, z.z), isBoss: !!z.boss, name: z.name, leash: z.leash, room: z.room }));
  const spawn = new THREE.Vector3(set.spawn[0], 0, set.spawn[1]);
  const [minX, maxX, minZ, maxZ] = set.bounds;
  const bounds = { minX, maxX, minZ, maxZ };

  // ---- ground ----
  const s1 = rng() * 100;
  const heightAt = (x, z) => {
    const n = Math.sin(x * 0.11 + s1) * Math.cos(z * 0.09 - s1) + 0.6 * Math.sin((x + z) * 0.23 + s1 * 2) + 0.3 * Math.cos(x * 0.41 - z * 0.37);
    const out = Math.max(0, bounds.minX - x, x - bounds.maxX, bounds.minZ - z, z - bounds.maxZ);
    if (out <= 0) return loc.vista ? -0.08 : n * 0.12; // the Tower's paving sits above flat ground (no terrain bumps poking through, no z-fighting)
    if (loc.vista) return n * 0.12 - 1.2 - Math.min(out * out * 0.04, 139); // the Tower stands on a cliff above the Last City
    if (loc.sea) return n * 0.12 - 1.2 - Math.min(out, 40) * 0.25; // the play area is a deck above the sea
    return n * 0.12 + Math.min(out, 90) * 0.7 * (0.75 + 0.25 * n) + Math.max(0, out - 90) * 0.2;
  };
  scene.add(buildGround(bounds, C, heightAt, rng));
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

  const addCollider = (minX, minY, minZ, maxX, maxY, maxZ, mesh) => {
    colliders.push({ min: new THREE.Vector3(minX, minY, minZ), max: new THREE.Vector3(maxX, maxY, maxZ) });
    if (mesh) staticMeshes.push(mesh);
  };
  // yawed box collider (diagonal walls block only where they are); see physics.orientedCollider
  const addOriented = (cx, y0, cz, w, h, d, ry, mesh) => {
    colliders.push(orientedCollider(cx, y0, cz, w, h, d, ry));
    if (mesh) staticMeshes.push(mesh);
  };
  const addBox = (x, z, w, h, d, color, y = 0, collide = true, matOpts) => {
    const m = new THREE.Mesh(BOX, mat(color, matOpts));
    m.scale.set(w, h, d);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (collide) addCollider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, m);
    return m;
  };
  const addRock = (x, z, s, y = 0, collide = true) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(RP([C.rock, C.rock2])));
    const sy = R(0.6, 1.1);
    m.scale.set(R(0.9, 1.2), sy, R(0.9, 1.2));
    m.rotation.y = R(0, 6.28);
    m.position.set(x, y + s * sy * 0.45, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const hw = s * 0.75;
    if (collide) addCollider(x - hw, y, z - hw, x + hw, y + s * sy * 1.25, z + hw, m);
  };
  const addMesh = (geo, color, x, y, z, matOpts) => {
    const m = new THREE.Mesh(geo, mat(color, matOpts));
    m.position.set(x, y, z);
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
  set.build(makeKit());
  if (loc.vista) separateCoplanar(scene);

  // ---- kit handed to hand-built mission maps (js/level-*.js) ----
  function makeKit() {
    const glow = (color, k) => (k ? { emissive: color, emissiveIntensity: k } : undefined);
    const K = {
      C, loc, def, rng, R, RP, chance: (p) => rng() < p, bounds, spawn, zones, scene,
      mat: (color, k) => mat(color, glow(color, k)),
      collider: addCollider,
      ocollider: (x, z, w, h, d, ry, y0 = 0) => addOriented(x, y0, z, w, h, d, ry, null),
      // box yawed by ry, with an exact collider
      obox: (x, z, w, h, d, ry, color = C.wall, o = {}) => {
        const m = addBox(x, z, w, h, d, color, o.y ?? 0, false, glow(color, o.glow));
        m.rotation.y = ry;
        if (o.collide ?? true) addOriented(x, o.y ?? 0, z, w, h, d, ry, m);
        return m;
      },
      box: (x, z, w, h, d, color = C.wall, o = {}) => addBox(x, z, w, h, d, color, o.y ?? 0, o.collide ?? true, glow(color, o.glow)),
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
          addCollider(cx - (cx - bb.min.x) * k, bb.min.y, cz - (cz - bb.min.z) * k, cx + (bb.max.x - cx) * k, bb.max.y, cz + (bb.max.z - cz) * k, m);
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
        const step = 0.4, run = 0.6, n = Math.max(1, Math.ceil(rise / step)), y0 = o.y ?? 0, color = o.color ?? C.metal;
        const [dx, dz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[dir];
        for (let i = 0; i < n; i++) {
          const hh = Math.min(rise, (i + 1) * step), cxs = x + dx * (i + 0.5) * run, czs = z + dz * (i + 0.5) * run;
          addBox(cxs, czs, dx ? run : w, hh, dz ? run : w, color, y0);
        }
        return [x + dx * n * run, z + dz * n * run];
      },
      // raised deck with stairs on the given sides
      platform(x, z, w, d, h, o = {}) {
        const m = addBox(x, z, w, h, d, o.color ?? C.wall, o.y ?? 0);
        const n = Math.ceil(h / 0.4) * 0.6;
        const out = { n: [x, z - d / 2 - n, 's'], s: [x, z + d / 2 + n, 'n'], e: [x + w / 2 + n, z, 'w'], w: [x - w / 2 - n, z, 'e'] };
        for (const side of o.stairs || []) { const [sx, sz, dir] = out[side]; K.stairs(sx, sz, dir, o.stairW ?? 2.4, h, { color: o.stairColor ?? C.metal, y: o.y }); }
        return m;
      },
      // U15: any number of lights per map. Each gets a small glow bulb, and updateLights() lends the 6 nearest the player a real PointLight (point lights are expensive)
      light(x, y, z, color = C.accent, intensity = 8, dist = 22) {
        const bulb = new THREE.Mesh(BULB, new THREE.MeshBasicMaterial({ color, fog: false }));
        bulb.position.set(x, y, z);
        scene.add(bulb);
        lamps.push({ x, y, z, color, intensity, dist, d2: 0 });
        return bulb;
      },
      // U15: a door that is a solid block until a zone clear (zone: index), a story beat (open it by id) or never (zone: null) opens it
      door(x, z, w, h, axis, o = {}) {
        const t = o.t ?? 0.7, color = o.color ?? C.metal;
        const m = addBox(x, z, axis === 'x' ? w : t, h, axis === 'x' ? t : w, color, o.y ?? 0, true, glow(o.trim ?? C.accent, 0.25));
        const stripe = new THREE.Mesh(BOX, mat(o.trim ?? C.accent, { emissive: o.trim ?? C.accent, emissiveIntensity: 1.6 }));
        stripe.scale.set(axis === 'x' ? w * 0.8 : t + 0.06, 0.18, axis === 'x' ? t + 0.06 : w * 0.8);
        stripe.position.set(0, 0, 0);
        const d = { id: o.id ?? `door${doors.length}`, zone: o.zone ?? null, mesh: m, stripe, y0: m.position.y, h, collider: colliders[colliders.length - 1], open: false, t: 0 };
        stripe.position.set(x, (o.y ?? 0) + h * 0.7, z);
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
          fn(x, z, loc.sea ? -0.7 : heightAt(x, z) - 0.6);
        }
      },
    };
    return K;
  }

  // edge scenery on the slopes (no collision)
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
  // invisible boundary walls
  const T = 200;
  addCollider(bounds.minX - 10, -5, bounds.minZ - 10, bounds.minX, T, bounds.maxZ + 10, null);
  addCollider(bounds.maxX, -5, bounds.minZ - 10, bounds.maxX + 10, T, bounds.maxZ + 10, null);
  addCollider(bounds.minX - 10, -5, bounds.minZ - 10, bounds.maxX + 10, T, bounds.minZ, null);
  addCollider(bounds.minX - 10, -5, bounds.maxZ, bounds.maxX + 10, T, bounds.maxZ + 10, null);

  // ---- light pool: the 6 nearest lamps get a real light, so a map can hold dozens (U15) ----
  const pool = [];
  for (let i = 0; i < Math.min(6, lamps.length); i++) { const l = new THREE.PointLight(0xffffff, 0, 1, 1.6); scene.add(l); pool.push(l); }
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

  /** Opens every closed door tied to a cleared zone (or a named door). Returns true if any opened. */
  const openDoors = (zoneIdx, id = null) => {
    let any = false;
    for (const d of doors) {
      if (d.open || (zoneIdx === 'all' ? false : id ? d.id !== id : d.zone !== zoneIdx)) continue;
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
      if (!d.open || d.t >= 1) continue;
      d.t = Math.min(1, d.t + dt * 1.4);
      d.mesh.position.y = d.y0 + d.t * (d.h + 0.2);
      d.stripe.position.y = d.y0 + d.h * 0.7 + d.t * (d.h + 0.2);
      if (d.t >= 1) { d.mesh.visible = false; d.stripe.visible = false; }
    }
  };

  return { scene, sun, sunOffset, colliders, staticMeshes, zones, spawn, bounds, doors, updateLights, openDoors, updateDoors };
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

function buildGround(bounds, C, heightAt, rng) {
  const pad = 130;
  const minX = bounds.minX - pad, maxX = bounds.maxX + pad, minZ = bounds.minZ - pad, maxZ = bounds.maxZ + pad;
  const W = maxX - minX, D = maxZ - minZ;
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W / 5), Math.round(D / 5));
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
    if (y > 1.2) c.lerpColors(rA, rB, rng()); else c.lerpColors(cA, cB, rng());
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

function buildPlanet(loc, locked = false) {
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
    for (let k = 0; k < 3; k++) { colors[(i + k) * 3] = c.r; colors[(i + k) * 3 + 1] = c.g; colors[(i + k) * 3 + 2] = c.b; }
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
export const DIRECTOR_POS = { earth: [-8.2, -1.2], moon: [-5.6, 2.4], mars: [-3.2, -2.2], io: [-0.4, 1.6], titan: [2.2, -1.8], tangled: [4.6, 2.0], dc: [7.0, -1.4], leviathan: [9.2, 2.2], tower: [-6.6, -3.3] };
const MAP_X = 0.9, MAP_SCALE = 0.4, FOCUS_SCALE = 0.62, SUN = new THREE.Vector3(-16, 0, -3);

function buildTowerNode(locked) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: locked ? 0x080b12 : 0xece5d3, flatShading: true, roughness: 0.8 });
  const roof = new THREE.MeshStandardMaterial({ color: locked ? 0x080b12 : 0x7f98ae, flatShading: true, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.9, 7), stone);
  g.add(base);
  for (const [x, z, h] of [[0, 0, 4.4], [-1.1, 0.5, 3], [1.1, 0.4, 3.4], [0.2, -1.0, 2.6]]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), stone);
    t.position.set(x, 0.45 + h / 2, z);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.1, 4), roof);
    c.position.set(x, 0.45 + h + 0.55, z); c.rotation.y = Math.PI / 4;
    g.add(t, c);
  }
  g.userData.radius = 2.6;
  return g;
}

function createDirector(scene, camera) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const sunMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 2), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
  const sunGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(5.4, 2), new THREE.MeshBasicMaterial({ color: 0xffb94a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  sunMesh.position.copy(SUN); sunGlow.position.copy(SUN);
  root.add(sunMesh, sunGlow);
  const sunLight = new THREE.PointLight(0xfff0d0, 90, 0, 1.4);
  sunLight.position.copy(SUN).add(new THREE.Vector3(3, 1, 4));
  root.add(sunLight);

  const nodes = new Map(); // id -> { group, body, basePos, scale, target, locked, radius }
  let key = '', focusId = null, cb = null;
  let focusT = 0; // 0 = whole map, 1 = flown to the focused node
  let camX = 0, camY = 0.3, camZ = 18;

  function clear() {
    for (const n of nodes.values()) root.remove(n.group);
    nodes.clear();
    for (const o of [...root.children]) if (o.userData.ring) root.remove(o);
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
        const p = DIRECTOR_POS[e.id] || [0, 0];
        const pos = new THREE.Vector3(p[0] * MAP_X, p[1], 0);
        const group = new THREE.Group();
        group.position.copy(pos);
        const body = e.id === 'tower' ? buildTowerNode(e.locked) : buildPlanet(e.loc, e.locked);
        const radius = e.id === 'tower' ? 2.6 : 3.2;
        body.scale.setScalar(e.id === 'tower' ? 0.16 : MAP_SCALE);
        if (e.id === 'tower') body.rotation.x = 0.35;
        group.add(body);
        root.add(group);
        nodes.set(e.id, { group, body, pos, locked: e.locked, radius, mapScale: e.id === 'tower' ? 0.16 : MAP_SCALE, focusScale: e.id === 'tower' ? 0.55 : FOCUS_SCALE, scale: e.id === 'tower' ? 0.16 : MAP_SCALE });
        if (e.id !== 'tower') { // orbit ring around the sun through the planet
          const a = pos.x - SUN.x, b = a * 0.3, pts = [];
          for (let i = 0; i <= 96; i++) { const t = (i / 96) * Math.PI * 2; pts.push(new THREE.Vector3(SUN.x + Math.cos(t) * a, Math.sin(t) * b * 0.9 + 0, -0.5)); }
          const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8fa6c8, transparent: true, opacity: e.locked ? 0.07 : 0.16 }));
          ring.userData.ring = true;
          root.add(ring);
        }
      }
    },
    focus(id) { focusId = id && nodes.has(id) ? id : null; },
    onFrame(fn) { cb = fn; },
    update(dt) {
      const aspect = camera.aspect, tan = Math.tan((camera.fov * Math.PI) / 360);
      const k = 1 - Math.exp(-dt * 4.5);
      const f = focusId ? nodes.get(focusId) : null;
      focusT += ((f ? 1 : 0) - focusT) * k;
      const mapZ = 18 * Math.max(1, 1.78 / aspect), fz = 12 * Math.max(1, 1.5 / aspect);
      const tz = f ? fz : mapZ;
      const offX = f ? tan * fz * aspect * 0.42 : 0; // the planet sits left of centre, the panel on the right
      const tx = f ? f.pos.x + offX : 0, ty = f ? f.pos.y * 0.6 : 0.3;
      camX += (tx - camX) * k; camY += (ty - camY) * k; camZ += (tz - camZ) * k;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(camX, camY, 0);
      const list = [];
      for (const [id, n] of nodes) {
        const want = id === focusId ? n.focusScale : n.mapScale;
        n.scale += (want - n.scale) * k;
        n.body.scale.setScalar(n.scale);
        if (!n.locked || id === 'tower') n.body.rotation.y += dt * (id === 'tower' ? 0.15 : 0.12);
        else n.body.rotation.y += dt * 0.03;
        const v = n.pos.clone().project(camera);
        const rpx = ((n.radius * n.scale) / (tan * (camZ - n.pos.z))) * (innerHeight / 2);
        list.push({ id, x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, r: rpx, focused: id === focusId });
      }
      sunMesh.rotation.y += dt * 0.05;
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
