import * as THREE from 'three';
import { mulberry32, hashStr } from './util.js';
import { buildCharacter } from './characters.js';

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
  const names = [...loc.zoneNames].sort(() => rng() - 0.5);
  const zones = [];
  for (let i = 0; i < def.zones; i++) {
    const isBoss = i === def.zones - 1;
    const z = -(i + 1) * 58 - (isBoss ? 12 : 0);
    const x = isBoss ? 0 : R(-26, 26);
    zones.push({ center: new THREE.Vector3(x, 0, z), isBoss, name: names[i] });
  }
  const spawn = new THREE.Vector3(0, 0, 14);
  const bounds = { minX: -66, maxX: 66, minZ: zones[zones.length - 1].center.z - 40, maxZ: 28 };

  // ---- ground ----
  const s1 = rng() * 100;
  const heightAt = (x, z) => {
    const n = Math.sin(x * 0.11 + s1) * Math.cos(z * 0.09 - s1) + 0.6 * Math.sin((x + z) * 0.23 + s1 * 2) + 0.3 * Math.cos(x * 0.41 - z * 0.37);
    const out = Math.max(0, bounds.minX - x, x - bounds.maxX, bounds.minZ - z, z - bounds.maxZ);
    if (out <= 0) return n * 0.12;
    if (loc.sea) return n * 0.12 - 1.2 - Math.min(out, 40) * 0.25; // the play area is a deck above the sea
    return n * 0.12 + Math.min(out, 90) * 0.7 * (0.75 + 0.25 * n) + Math.max(0, out - 90) * 0.2;
  };
  scene.add(buildGround(bounds, C, heightAt, rng));
  if (loc.sea) {
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
    platform: (x, z) => { const w = R(5, 8), d = R(5, 8); addBox(x, z, w, 1.1, d, C.wall); addBox(x + w / 2 + 0.7, z, 1.4, 0.55, 1.6, C.metal); },
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

  // ---- layout style (each mission has its own) ----
  const layout = def.layout || 'open';
  // a broken-walled room: wall segments of uneven height, with door gaps on the given sides
  const room = (cx, cz, w, d, h, doors) => {
    const t = 0.8, gap = 3.2;
    const side = (horiz, fixed, from, to, door) => {
      const len = to - from, mid = (from + to) / 2;
      const segs = door ? [[from, mid - gap / 2], [mid + gap / 2, to]] : [[from, to]];
      for (const [a, b] of segs) {
        const L = b - a;
        if (L < 0.6) continue;
        const hh = h * R(0.55, 1);
        if (horiz) addBox((a + b) / 2, fixed, L, hh, t, C.wall); else addBox(fixed, (a + b) / 2, t, hh, L, C.wall);
      }
    };
    side(true, cz - d / 2, cx - w / 2, cx + w / 2, doors.includes('n'));
    side(true, cz + d / 2, cx - w / 2, cx + w / 2, doors.includes('s'));
    side(false, cx - w / 2, cz - d / 2, cz + d / 2, doors.includes('w'));
    side(false, cx + w / 2, cz - d / 2, cz + d / 2, doors.includes('e'));
  };
  const twoDoors = () => { const all = ['n', 's', 'e', 'w'].sort(() => rng() - 0.5); return all.slice(0, 2); };
  // walled compound around a zone, gates on the near (+z) and far (-z) sides, towers at the corners
  const fortress = (cx, cz, half) => {
    const h = 3.6, t = 1.2, gate = 6.5;
    for (const s of [-1, 1]) {
      const zz = cz + s * half;
      for (const [a, b] of [[cx - half, cx - gate / 2], [cx + gate / 2, cx + half]]) if (inBounds((a + b) / 2, zz, 1)) addBox((a + b) / 2, zz, b - a, h, t, C.wall);
      const xx = cx + s * half;
      if (inBounds(xx, cz, 1)) addBox(xx, cz, t, h, half * 2, C.wall);
      for (const s2 of [-1, 1]) {
        const tx = cx + s * half, tz = cz + s2 * half;
        if (!inBounds(tx, tz, 2)) continue;
        addBox(tx, tz, 3, 9, 3, C.wall);
        addBox(tx, tz, 4, 0.5, 4, C.metal, 9, false);
      }
    }
    for (let i = -half + 2; i < half - 1; i += 3) for (const s of [-1, 1]) addBox(cx + i, cz + s * half, 1, 0.6, t + 0.1, C.metal, h, false);
  };
  const coverMix = weighted.bind(null, [[P.crate, 3], [P.wall, 4], [P.rock, 2], [P.pillar, 2], [P.platform, 1], [themed, 2]]);

  for (const z of zones) {
    const cx = z.center.x, cz = z.center.z;
    if (layout === 'fortress') {
      fortress(cx, cz, z.isBoss ? 25 : 17);
      for (let k = 0; k < (z.isBoss ? 10 : 8); k++) placeRandom(coverMix(), cx, cz, 6, z.isBoss ? 20 : 13, 2);
      continue;
    }
    if (layout === 'ruins') {
      for (let k = 0; k < (z.isBoss ? 5 : 4); k++) {
        const w = R(7, 10), d = R(7, 10);
        placeRandom((x, zz) => room(x, zz, w, d, R(2.6, 3.8), twoDoors()), cx, cz, 10, z.isBoss ? 22 : 17, Math.max(w, d) / 2 + 0.5);
      }
      for (let k = 0; k < 5; k++) placeRandom(coverMix(), cx, cz, 5, 18, 2);
      continue;
    }
    if (z.isBoss) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        const x = cx + Math.sin(a) * 24, zz = cz + Math.cos(a) * 24;
        if (inBounds(x, zz, 1)) addBox(x, zz, 1.8, R(6, 10), 1.8, C.wall);
      }
      for (let k = 0; k < 11; k++) placeRandom(weighted([[P.crate, 2], [P.wall, 4], [P.rock, 2], [P.pillar, 1]]), cx, cz, 9, 19, 2);
    } else {
      const n = (layout === 'canyon' ? 9 : 12) + Math.floor(rng() * 4);
      for (let k = 0; k < n; k++) placeRandom(coverMix(), cx, cz, 5, 20, 2.2);
    }
  }
  if (layout === 'canyon') {
    // tall cliff columns line the route between zones, opening up around each arena
    const pts = [spawn, ...zones.map((zz) => zz.center)];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
      for (let tt = 0; tt <= len; tt += 6.5) {
        const px = a.x + dx * tt, pz = a.z + dz * tt;
        const nearZone = zones.some((zz) => Math.hypot(px - zz.center.x, pz - zz.center.z) < 22);
        for (const s of [-1, 1]) {
          const off = (nearZone ? 25 : 14) + R(0, 4);
          const x = px - dz * s * off, zz = pz + dx * s * off;
          const r = R(3.2, 4.8), h = R(8, 15);
          if (!inBounds(x, zz, r * 0.8)) continue;
          const m = addMesh(new THREE.CylinderGeometry(r * 0.75, r, h, 7), RP([C.rock, C.rock2]), x, h / 2, zz);
          addCollider(x - r * 0.75, 0, zz - r * 0.75, x + r * 0.75, h, zz + r * 0.75, m);
        }
      }
    }
  }
  if (layout === 'ruins') {
    for (let k = 0; k < 16; k++) {
      const w = R(7, 11), d = R(7, 11);
      const x = R(bounds.minX + 8, bounds.maxX - 8), zz = R(bounds.minZ + 8, bounds.maxZ - 8);
      if (isClear(x, zz, Math.max(w, d) / 2 + 1)) room(x, zz, w, d, R(2.4, 4.2), twoDoors());
    }
  }
  const filler = { open: 95, ruins: 45, canyon: 40, fortress: 55 }[layout] ?? 95;
  for (let k = 0; k < filler; k++) {
    const fn = weighted([[P.rock, 3], [themed, 4], [P.crate, 2], [P.wall, 2]]);
    const x = R(bounds.minX + 4, bounds.maxX - 4), z = R(bounds.minZ + 4, bounds.maxZ - 4);
    if (isClear(x, z, 3)) fn(x, z);
  }
  // edge scenery on the slopes (no collision)
  for (let k = 0; k < 70; k++) {
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

  return { scene, sun, sunOffset, colliders, staticMeshes, zones, spawn, bounds };
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

function buildPlanet(loc) {
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
  const planet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  const atmo = new THREE.Mesh(new THREE.IcosahedronGeometry(3.55, 3), new THREE.MeshBasicMaterial({ color: loc.atmo, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  const g = new THREE.Group();
  g.add(planet, atmo);
  return g;
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

  return {
    scene, camera,
    setLocation(loc) {
      if (currentId === loc.id) return;
      currentId = loc.id;
      if (planet) holder.remove(planet);
      planet = buildPlanet(loc);
      holder.add(planet);
    },
    setOffset(x) { holder.position.x = x; },
    setMode(m, classId, elementId) {
      mode = m;
      holder.visible = m === 'planet';
      charHolder.visible = m === 'character';
      if (m === 'character') {
        const key = classId + elementId;
        if (charKey !== key) {
          if (character) charHolder.remove(character.group);
          character = buildCharacter(classId, elementId);
          charHolder.add(character.group);
          charKey = key;
        }
        // keep the whole figure in frame on tall or wide screens
        const dist = 5.4 * Math.max(1, 0.95 / camera.aspect);
        camera.position.set(0, 1.25, dist);
        camera.lookAt(0, 1.08, 0);
      } else {
        camera.position.set(0, 0.6, 18);
        camera.lookAt(0, 0, 0);
      }
    },
    rotateChar(d) { charYaw += d; },
    update(dt) {
      if (character && mode === 'character') { character.update(dt); character.group.rotation.y = charYaw; }
      if (planet) planet.rotation.y += dt * 0.08;
      stars.rotation.y += dt * 0.004;
    },
    resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
  };
}
