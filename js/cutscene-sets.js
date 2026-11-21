// U33 Transmissions: the stages cutscenes play on, built from primitives. Each set is (def) => { scene, tick(dt, t, step, k, c), defaultCam, cams }.
// tick runs every frame with the current step and its progress k (0..1); a step's `name` and `ghost(k)` drive the actors.
import * as THREE from 'three';
import { G } from './state.js';
import { buildCharacter, ghost } from './characters.js';
import { buildNpc } from './models-npc.js';
import { activeKit, wornAppearance } from './save.js';
import { buildModel } from './enemies.js';
import { enemyColors } from './factions.js';
import { LOCATIONS } from './data.js';

const ease = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, metalness: 0.05, ...o });
const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const rngOf = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
function box(p, w, h, d, x, y, z, m, ry = 0) {
  const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  k.position.set(x, y, z); k.rotation.y = ry; p.add(k); return k;
}
function cyl(p, rt, rb, h, x, y, z, m, seg = 10) {
  const k = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  k.position.set(x, y, z); p.add(k); return k;
}
function glowSprite(color, size, opacity = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity }));
  s.scale.setScalar(size); return s;
}
function lights(scene, { sky = 0xbcd0ff, ground = 0x3a2f2a, hemi = 0.8, sun = 0xfff0d0, sunI = 1.1, sunPos = [10, 20, 10] } = {}) {
  scene.add(new THREE.HemisphereLight(sky, ground, hemi));
  const d = new THREE.DirectionalLight(sun, sunI); d.position.set(...sunPos); scene.add(d);
}
function skyDome(scene, top, horizon, r = 600) {
  const g = new THREE.SphereGeometry(r, 24, 14), cols = [], a = new THREE.Color(top), b = new THREE.Color(horizon), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, p.getY(i) / r)); const c = b.clone().lerp(a, Math.pow(t, 0.6)); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(m); return m;
}
/** The Guardian (their own class and armour). Returns the character; its stage disc, ring and Ghost are hidden. */
function makeGuardian() {
  const ch = buildCharacter(G.save.classId, activeKit(G.save).element, wornAppearance(G.save));
  for (const i of [1, 2, 3]) if (ch.group.children[i]) ch.group.children[i].visible = false;
  ch.setGun(null);
  return ch;
}
function makeGhost() { const g = ghost(); g.scale.setScalar(1.6); g.add(new THREE.PointLight(0x8fd8ff, 1, 9)); return g; }
function npcAt(scene, id, x, y, z, face) {
  const n = buildNpc(id); n.group.position.set(x, y, z); n.group.lookAt(face[0], y, face[1]); scene.add(n.group); return n;
}
function sparks(scene, color, size = 0.12, max = 160) {
  const pos = new Float32Array(max * 3).fill(-999), vel = new Float32Array(max * 3), life = new Float32Array(max);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  let n = 0;
  return {
    emit(x, y, z, count, speed, up = 0.6) {
      for (let c = 0; c < count; c++) {
        const i = n++ % max, a = Math.random() * 6.283, s = speed * (0.3 + Math.random());
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = (up + Math.random()) * speed * 0.8; vel[i * 3 + 2] = Math.sin(a) * s;
        life[i] = 0.8 + Math.random() * 1.4;
      }
    },
    tick(dt) {
      for (let i = 0; i < max; i++) {
        if (life[i] > 0) { life[i] -= dt; vel[i * 3 + 1] -= 4 * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; } else pos[i * 3 + 1] = -999;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}
/** Slow floating motes (dust, mist lights) around a point. */
function motes(scene, n, area, color, size = 0.06, seed = 5) {
  const r = rngOf(seed), pos = new Float32Array(n * 3), base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { base[i * 3] = (r() - 0.5) * area[0]; base[i * 3 + 1] = r() * area[1]; base[i * 3 + 2] = (r() - 0.5) * area[2]; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  return (t, cx = 0, cz = 0) => {
    for (let i = 0; i < n; i++) {
      pos[i * 3] = cx + base[i * 3] + Math.sin(t * 0.2 + i) * 0.6;
      pos[i * 3 + 1] = (base[i * 3 + 1] + t * 0.08 * (1 + (i % 3))) % area[1];
      pos[i * 3 + 2] = cz + base[i * 3 + 2] + Math.cos(t * 0.17 + i * 1.3) * 0.6;
    }
    g.attributes.position.needsUpdate = true;
  };
}
/** A boss body for a cutscene, built with the real model code. Returns { group, height }. */
function bossStub(kind, locId) {
  const loc = LOCATIONS.find((l) => l.id === locId) || LOCATIONS[0];
  const faction = kind === 'crota' ? 'hollow' : 'legion';
  const stub = { bossModel: kind, typeId: 'boss', maxShield: 0, isBoss: true, shieldEl: 'void' };
  const m = buildModel(stub, enemyColors(faction, loc, true), faction);
  const boss = (G.enemies || []).find((e) => e.bossModel === kind);
  const sc = kind === 'emperorCalus' ? 0.8 : boss?.scale || 1;
  m.group.scale.setScalar(sc);
  return { group: m.group, height: m.height * sc };
}

// ---------------------------------------------------------------------------
export const SETS = {
  /** The Cosmodrome car wreck at dusk: the Guardian lies in the dust and the Ghost finds them. */
  wreck() {
    const scene = new THREE.Scene(), bg = 0x3a2c36;
    scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, 10, 60);
    lights(scene, { sky: 0xffc9a0, ground: 0x2a2430, hemi: 0.55, sun: 0xff9a60, sunI: 1.5, sunPos: [-30, 7, -18] });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), mat(0x5e5249)); scene.add(ground);
    const r = rngOf(11);
    for (let i = 0; i < 46; i++) { const s = 0.3 + r() * 1.1, a = r() * 6.283, d = 4 + r() * 38; box(scene, s * 1.4, s, s, Math.cos(a) * d, s * 0.3, Math.sin(a) * d, mat(0x6e6258), r() * 3); }
    const rust = mat(0x7a4a2e), dark = mat(0x1c1c20), glass = mat(0x23303a, { metalness: 0.4 });
    const car = (x, z, ry, tilt, col = rust) => {
      const g = new THREE.Group(); g.position.set(x, 0.55, z); g.rotation.set(0, ry, tilt);
      box(g, 4.4, 0.8, 1.9, 0, 0, 0, col); box(g, 2.2, 0.75, 1.7, -0.2, 0.75, 0, col); box(g, 1.9, 0.45, 1.74, -0.2, 0.8, 0, glass);
      for (const [wx, wz] of [[-1.4, 0.95], [1.4, 0.95], [-1.4, -0.95], [1.4, -0.95]]) { const w = cyl(g, 0.42, 0.42, 0.3, wx, -0.4, wz, dark, 10); w.rotation.x = Math.PI / 2; }
      scene.add(g); return g;
    };
    car(-5.2, -2.6, 0.5, 0.0); car(4.8, -4.4, -0.9, 0.35, mat(0x4c5560)); car(-8, -9, 2.2, 0.0, mat(0x6b5a34)); car(8.5, 5, 1.2, 0.18, mat(0x594038));
    // concrete ruin walls and pylons behind
    for (let i = 0; i < 8; i++) { const h = 6 + r() * 14; box(scene, 3 + r() * 4, h, 2, -34 + i * 9 + r() * 3, h / 2, -26 - r() * 10, mat(0x5a5560)); }
    const hull = new THREE.Group(); hull.position.set(-14, 0, -16); hull.rotation.y = 0.5; scene.add(hull); // a toppled ship hull
    box(hull, 14, 3.4, 5, 0, 1.7, 0, mat(0x6a6f78)); box(hull, 6, 2, 4, 5, 3.8, 0, mat(0x575c66));
    const dust = motes(scene, 70, [30, 5, 30], 0xffd9b0, 0.07);
    const piv = new THREE.Group(), gd = makeGuardian();
    gd.group.position.y = -0.95; piv.add(gd.group); piv.position.set(0, 0.22, 0); piv.rotation.x = -Math.PI / 2; scene.add(piv);
    const gh = makeGhost(); gh.position.set(-9, 6, 7); scene.add(gh);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1, 14, 1, true).translate(0, -0.5, 0), basic(0x8fd8ff, { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    scene.add(beam);
    const light = gh.children.find((o) => o.isPointLight);
    const look = new THREE.Vector3(), tgt = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, -1, 0);
    return {
      scene, defaultCam: [-7, 4, 9, 0, 0.8, 0], gd, gh,
      tick(dt, t, st, k, c) {
        gd.update(dt); dust(t);
        if (st.ghost) { const p = st.ghost(k); gh.position.set(p[0], p[1] + Math.sin(t * 2.2) * 0.06, p[2]); }
        tgt.set(0, 0.4, -0.3); look.copy(st.ghostLook ? new THREE.Vector3(...st.ghostLook) : tgt); gh.lookAt(look);
        light.intensity = (st.glow ?? 1) * (1 + Math.sin(t * 6) * 0.1);
        const bo = st.beam ? Math.min(1, k * 4) * 0.2 : 0;
        beam.material.opacity = bo; beam.visible = bo > 0;
        if (bo > 0) {
          const bt = new THREE.Vector3(0.3 * Math.sin(t * 0.9), 0.2, -0.7 + 0.9 * Math.sin(t * 0.7));
          dir.subVectors(bt, gh.position); const len = dir.length(); dir.normalize();
          beam.position.copy(gh.position); beam.scale.set(1, len, 1); beam.quaternion.setFromUnitVectors(up, dir);
        }
        if (st.name === 'rise') { const e = ease(k); piv.rotation.x = -Math.PI / 2 * (1 - e); piv.position.y = 0.22 + 0.73 * e; if (k > 0.55 && !st.flashed) { st.flashed = true; c.flash = 1; } } else if (st.name === 'stand') { piv.rotation.x = 0; piv.position.y = 0.95; }
      },
    };
  },

  /** The jumpship over the Last City and the Tower terrace where it lands. */
  sky() {
    const scene = new THREE.Scene(), bg = 0xb89a78;
    scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, 90, 700);
    skyDome(scene, 0x4a6490, 0xf2b676);
    lights(scene, { sky: 0xe6e8f0, ground: 0x8a7a60, hemi: 0.8, sun: 0xffd9a0, sunI: 1.5, sunPos: [-60, 40, -80] });
    // the Traveler: huge, close and pale, with a bright rim and golden rays
    const trav = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 20), basic(0xb9c6d8, { fog: false })); trav.position.set(-170, 95, -360); scene.add(trav);
    const rim = new THREE.Mesh(new THREE.SphereGeometry(121, 32, 20), basic(0xfff1c8, { fog: false, transparent: true, opacity: 0.55, side: THREE.BackSide })); rim.position.copy(trav.position); rim.scale.setScalar(1.015); scene.add(rim);
    const h1 = glowSprite(0xffe6b0, 360, 0.3), h2 = glowSprite(0xffcf90, 700, 0.12); h1.position.set(-60, 60, -330); h2.position.set(-20, 40, -340); scene.add(h1, h2);
    for (let i = 0; i < 6; i++) { const ray = new THREE.Mesh(new THREE.PlaneGeometry(28, 420), basic(0xffe8b8, { transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); ray.position.set(-20 + i * 36, 120, -300); ray.rotation.z = (i - 2.5) * 0.18; scene.add(ray); }
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), mat(0x6e6858)); gnd.position.y = -30; scene.add(gnd);
    const r = rngOf(3), stone = [mat(0xc7bfae), mat(0xb3ac9c), mat(0xd6cdb8)];
    for (let i = 0; i < 120; i++) { // the City far below, lit windows and all
      const a = (r() - 0.5) * 3.2, d = 90 + r() * 260, h = 4 + r() * 22, w = 4 + r() * 8;
      box(scene, w, h, w, Math.sin(a) * d, h / 2 - 28, -Math.cos(a) * d, stone[i % 3], r());
      if (i % 3 === 0) box(scene, 0.8, 0.8, 0.2, Math.sin(a) * d, h * 0.6 - 28, -Math.cos(a) * d + w / 2, basic(0xffe3a0));
    }
    for (const [x, z, h] of [[-120, -170, 70], [90, -250, 90], [-40, -230, 60]]) box(scene, 5, h, 5, x, h / 2 - 28, z, mat(0x8f8a80)); // obelisk towers
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(70 + i * 20, 70 + i * 14, 5), mat(0x6f6a64)); m.position.set(-210 + i * 150, 5, -420); scene.add(m); } // far mountains
    // the Tower: a vast ribbed slab in the mist, a shaft rising from it, and the deck on top with a swept wing and two horns
    const tower = new THREE.Group(); tower.position.set(46, 0, -150); scene.add(tower);
    const slab = mat(0x8d9093), rib = mat(0x6f7378), steel = mat(0x5a5e64);
    box(tower, 78, 120, 62, 0, 30, 0, slab); box(tower, 82, 5, 66, 0, 92.5, 0, steel);
    for (let i = -18; i <= 18; i++) { box(tower, 0.9, 118, 0.8, i * 2.1, 30, 31.2, rib); if (i % 3 === 0) box(tower, 1.2, 118, 0.6, i * 2.1, 30, -31.2, rib); }
    for (let i = 0; i < 6; i++) box(tower, 78.4, 0.6, 62.4, 0, 6 + i * 16, 0, steel);
    for (const x of [-30, -8, 22]) box(tower, 2, 16, 0.3, x, 80, 31.4, basic(0xdfe9ff)); // lit panels down the face
    cyl(tower, 5.5, 8, 62, 8, 126, 0, mat(0x777b80), 4); // the central shaft
    box(tower, 14, 4, 14, 8, 158, 0, steel);
    const deck = new THREE.Group(); deck.position.set(8, 163, 0); tower.add(deck);
    box(deck, 62, 4, 24, 0, 0, 0, mat(0x70757b)); box(deck, 44, 2, 20, -6, 3, 0, mat(0x898d92));
    const wing = new THREE.Mesh(new THREE.ConeGeometry(11, 54, 4), mat(0x7d8288)); wing.rotation.set(0, Math.PI / 4, Math.PI / 2); wing.scale.set(1, 1, 0.26); wing.position.set(-50, 0.5, 0); deck.add(wing); // the swept prow
    for (let i = 0; i < 5; i++) box(deck, 6, 1.6, 0.3, -20 + i * 8, -0.4, 12.2, basic(0xcfe6ff)); // lit hangar windows
    for (let i = 0; i < 9; i++) box(deck, 1.6 + r() * 2, 1 + r() * 1.5, 1.6 + r() * 2, 8 + r() * 18, 4.5, -6 + r() * 12, mat(0x4f7a46)); // gardens on the deck
    box(deck, 7, 9, 7, 16, 8, -2, steel); box(deck, 0.6, 14, 0.6, -18, 10, -4, steel);
    for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(2.1, 26, 5), mat(0x4a4e54)); horn.position.set(14 + s * 7, 18, 0); horn.rotation.z = -s * 0.22; deck.add(horn); }
    const tg = glowSprite(0xfff0c8, 110, 0.35); tg.position.set(14, 22, 0); deck.add(tg);
    // mist banks that hide the foot of the Tower and the City
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), basic(0xd9b88c, { transparent: true, opacity: 0.1, depthWrite: false })); m.position.y = -12 + i * 8; scene.add(m); }
    for (let i = 0; i < 14; i++) { const c = glowSprite(0xf2cf9c, 90 + r() * 90, 0.16); c.position.set((r() - 0.5) * 300, -10 + r() * 60, -60 - r() * 160); scene.add(c); }
    const pad = new THREE.Group(); scene.add(pad); // the terrace
    box(pad, 22, 0.8, 22, 0, -0.4, 0, mat(0x8c8f94)); box(pad, 24, 0.3, 24, 0, -0.8, 0, mat(0x5c5f66));
    for (let i = -5; i <= 5; i++) { box(pad, 0.18, 1.0, 0.18, i * 2, 0.5, -11, mat(0x2c2f35)); box(pad, 0.18, 1.0, 0.18, i * 2, 0.5, 11, mat(0x2c2f35)); box(pad, 0.18, 1.0, 0.18, -11, 0.5, i * 2, mat(0x2c2f35)); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.5, 40).rotateX(-Math.PI / 2), basic(0xaee0ff, { transparent: true, opacity: 0.8 })); ring.position.set(-6, 0.02, 6); scene.add(ring);
    // the jumpship (nose toward +z)
    const ship = new THREE.Group(), hullM = mat(0xc9ccd2, { metalness: 0.3, roughness: 0.5 }), trim = mat(0x3a4150);
    box(ship, 1.6, 0.6, 4.6, 0, 0, 0, hullM);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 4), hullM); nose.rotation.set(Math.PI / 2, Math.PI / 4, 0); nose.position.z = 3.3; nose.scale.y = 1; ship.add(nose);
    box(ship, 1.0, 0.5, 1.6, 0, 0.45, 0.4, mat(0x24303c, { metalness: 0.5 }));
    for (const s of [-1, 1]) { const w = box(ship, 3.6, 0.1, 2.0, s * 2.1, -0.05, -0.6, hullM); w.rotation.y = s * -0.35; w.rotation.z = s * 0.06; box(ship, 0.2, 0.9, 1.0, s * 3.6, 0.2, -1.6, trim); const e = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), basic(0xffa860)); e.position.set(s * 0.7, 0, -2.4); ship.add(e); const eg = glowSprite(0xffa860, 2.6, 0.9); eg.position.copy(e.position); ship.add(eg); }
    ship.scale.setScalar(1.6); scene.add(ship);
    const land = new THREE.Vector3(-6, 1.1, 6), from = new THREE.Vector3(-80, 46, -210), pos = new THREE.Vector3(), nxt = new THREE.Vector3();
    const path = (k, o) => { const e = 1 - Math.pow(1 - k, 2); o.lerpVectors(from, land, e); o.y += Math.sin(k * 3.14) * 6; return o; };
    path(1, ship.position); ship.rotation.y = 2.4; ship.visible = true;
    const gd = makeGuardian(); gd.group.position.set(2.2, 0, 1.5); gd.group.rotation.y = Math.PI; gd.group.visible = false; scene.add(gd.group);
    const gh = makeGhost(); gh.visible = false; scene.add(gh);
    const cloud = motes(scene, 40, [60, 12, 60], 0xffffff, 0.12, 9);
    return {
      scene, defaultCam: [0, 2, 12, 0, 3, -20], ship, gd, gh, land,
      tick(dt, t, st, k) {
        gd.update(dt); cloud(t, 0, 0);
        if (st.name === 'fly') {
          path(k, ship.position); path(Math.min(1, k + 0.02), nxt); ship.lookAt(nxt); ship.rotation.z = Math.sin(k * 3) * 0.12;
          ship.rotation.x = k > 0.9 ? -0.15 : 0;
        } else { ship.position.copy(land); ship.rotation.set(0, 2.4, 0); }
        const here = st.name !== 'fly';
        gd.group.visible = gh.visible = here;
        if (here) { gh.position.set(3.1 + Math.sin(t * 1.3) * 0.08, 1.85 + Math.sin(t * 2) * 0.05, 1.2); gh.lookAt(0, 1.7, -8); }
        if (st.name === 'walk') { gd.group.position.z = lerp(1.5, -3.5, k); gd.group.position.x = lerp(2.2, 0.6, k); }
        else if (st.name === 'land') { gd.group.position.set(2.2, 0, 1.5); gd.group.rotation.y = Math.PI + Math.sin(t * 0.5) * 0.3; }
      },
    };
  },

  /** The Vanguard room: Zavala, Ikora and Cayde on the dais, the Traveler through the open wall. */
  room() {
    const scene = new THREE.Scene(), bg = 0x1b1f2b;
    scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, 24, 90);
    lights(scene, { sky: 0xc8d4f0, ground: 0x4a3f3a, hemi: 1.6, sun: 0xfff3d8, sunI: 1.3, sunPos: [0, 12, 20] });
    const stone = mat(0x3a3f4a), pale = mat(0xc9c2b0);
    cyl(scene, 12, 12, 0.4, 0, -0.2, 0, mat(0x30343c), 28);
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.6, 8.9, 48).rotateX(-Math.PI / 2), basic(0xe8d49a)); ring.position.y = 0.01; scene.add(ring);
    for (const s of [-1, 1]) { box(scene, 0.7, 10, 20, s * 10, 5, -2, stone); for (let i = 0; i < 4; i++) box(scene, 0.9, 10, 1.2, s * 9.4, 5, -9 + i * 5, pale); }
    box(scene, 6.5, 10, 1, -7.2, 5, -10, stone); box(scene, 6.5, 10, 1, 7.2, 5, -10, stone); box(scene, 8.2, 3.6, 1, 0, 8.2, -10, stone);
    const trav = new THREE.Mesh(new THREE.SphereGeometry(18, 24, 16), basic(0xf6f8fc, { fog: false })); trav.position.set(0, 12, -70); scene.add(trav);
    const th = glowSprite(0xdfe9ff, 120, 0.6); th.position.set(0, 12, -68); scene.add(th);
    const cols = [0xb23a3a, 0x3a64b2, 0x3f8a52, 0xb23a3a, 0x3a64b2, 0x3f8a52];
    cols.forEach((c, i) => { const x = i < 3 ? -9.4 : 9.4; box(scene, 0.1, 6, 1.8, x * 0.99, 5, -7 + (i % 3) * 5, mat(c)); });
    box(scene, 9.5, 0.4, 4, 0, 0.2, -0.5, mat(0x4a505c));
    cyl(scene, 1.0, 1.2, 0.9, 0, 0.45, 2.0, stone, 12); // the holo table
    const holo = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.03, 24), basic(0x7fd0ff, { transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })); holo.position.set(0, 0.95, 2.0); scene.add(holo);
    for (const [x, z, col] of [[-4, 2, 0xffd9a0], [4, 2, 0xffd9a0], [0, 1, 0xdfe8ff]]) { const l = new THREE.PointLight(col, 2.4, 14); l.position.set(x, 4, z); scene.add(l); }
    const face = [0, 3.4];
    const zav = npcAt(scene, 'zavala', -2.6, 0.4, -0.7, face), ik = npcAt(scene, 'ikora', 0, 0.4, -1.1, face), cay = npcAt(scene, 'cayde', 2.6, 0.4, -0.7, face);
    const gd = makeGuardian(); gd.group.position.set(0, 0, 4.3); gd.group.rotation.y = Math.PI; scene.add(gd.group);
    const gh = makeGhost(); gh.position.set(0.85, 1.95, 3.9); scene.add(gh);
    const glim = new THREE.Group(); glim.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), basic(0xaee6ff)), glowSprite(0xaee6ff, 0.7, 0.8));
    const sig = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 24), basic(0xff5a4a, { transparent: true, opacity: 0.9 })); glim.add(sig); glim.visible = false; scene.add(glim);
    const out = new THREE.Vector3(0.85, 1.95, 3.9).add(new THREE.Vector3(-0.05, -0.05, -0.5));
    const sideOf = (x) => (x > 0.5 ? -0.9 : 0.9);
    const npcCam = (x, y) => (k) => [sideOf(x), 1.7, 2.9 - k * 0.5, x, y, -0.8];
    // tighter shots on the speaker's face (close) and from the other side, lower (side)
    const closeCam = (x, hy) => (k) => [x * 0.8 + sideOf(x) * 0.55, hy + 0.05, 1.5 - k * 0.3, x, hy, -0.8];
    const sideCam = (x, hy) => (k) => [x - sideOf(x) * 2.2 + k * 0.3, hy - 0.2, 1.7, x, hy, -0.8];
    const cams = {
      zavala_close: closeCam(-2.6, 2.1), zavala_side: sideCam(-2.6, 2.1), ikora_close: closeCam(0, 2.0), ikora_side: sideCam(0, 2.0), cayde_close: closeCam(2.6, 1.9), cayde_side: sideCam(2.6, 1.9),
      ghost_close: (k) => [0.4, 1.95, 2.6 - k * 0.2, 0.85, 1.95, 3.9], ghost_side: (k) => [2.0, 2.1, 2.8, 0.85, 1.95, 3.9],
      zavala: npcCam(-2.6, 1.75), ikora: npcCam(0, 1.6), cayde: npcCam(2.6, 1.45),
      ghost: (k) => [-0.3 + k * 0.2, 2.0, 1.8, 0.85, 1.95, 3.9],
      guardian: (k) => [-0.7, 1.7, 2.2 + k * 0.2, 0, 1.6, 4.3],
      glimmer: (k) => [-0.9, 2.1, 1.6 - k * 0.2, 0.6, 1.9, 3.2],
      wide: (k) => [lerp(-7, -4.5, k), lerp(4, 3.2, k), lerp(9.5, 8, k), 0, 1.3, 0],
    };
    return {
      scene, cams, defaultCam: [-7, 4, 9.5, 0, 1.3, 0], zav, ik, cay, gd, gh, glim,
      tick(dt, t, st, k) {
        gd.update(dt); for (const n of [zav, ik, cay]) n.update(dt, t);
        gh.position.y = 1.95 + Math.sin(t * 2) * 0.05; gh.lookAt(0, 1.8, -2);
        holo.rotation.y = t * 0.6;
        const g = st.glimmer === 'move' ? ease(Math.min(1, k * 1.6)) : 1;
        glim.visible = !!st.glimmer;
        if (glim.visible) { glim.position.lerpVectors(gh.position, out.clone().setX(0.3).setY(2.0).setZ(2.5), g); glim.position.y += Math.sin(t * 3) * 0.03; sig.rotation.set(t * 1.5, t * 1.1, 0); sig.scale.setScalar(1 + Math.sin(t * 5) * 0.1); }
      },
    };
  },

  /** Mara Sov's throne room in the Dreaming City. */
  throne() {
    const scene = new THREE.Scene(), bg = 0x2a2150;
    scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, 6, 52);
    lights(scene, { sky: 0x9aa0ff, ground: 0x2a1a44, hemi: 0.8, sun: 0x88e0ff, sunI: 0.9, sunPos: [0, 10, -10] });
    cyl(scene, 30, 30, 0.4, 0, -0.2, -10, mat(0x1d1838, { metalness: 0.5, roughness: 0.35 }), 6);
    const carpet = box(scene, 3.2, 0.04, 30, 0, 0.02, -8, mat(0x4a2a7a)); carpet.material.emissive = new THREE.Color(0x1a0a33);
    const colM = mat(0x6a5aa0), gold = mat(0xd9b24a, { metalness: 0.7, roughness: 0.35 });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      const z = 6 - i * 6.5; cyl(scene, 0.55, 0.7, 11, s * 6.5, 5.5, z, colM, 8); box(scene, 1.5, 0.5, 1.5, s * 6.5, 11, z, gold); box(scene, 1.2, 0.35, 1.2, s * 6.5, 0.2, z, gold);
      const l = new THREE.PointLight(i % 2 ? 0x7be0ff : 0xc89bff, 1.0, 14); l.position.set(s * 5.4, 4.5, z); scene.add(l);
      box(scene, 0.12, 6.5, 1.6, s * 8.6, 5, z - 3.2, mat(0x3a2a6a, { emissive: 0x241056 })); // hanging banner
    }
    // the dais and the throne
    for (let i = 0; i < 4; i++) box(scene, 14 - i * 2, 0.35, 6 - i * 0.6, 0, 0.17 + i * 0.3, -22 + i * 0.4, i % 2 ? gold : mat(0x4a3a7a));
    const tr = new THREE.Group(); tr.position.set(0, 1.1, -25); scene.add(tr);
    box(tr, 3.4, 0.6, 2.4, 0, 0.3, 0, gold); box(tr, 3.0, 5.5, 0.5, 0, 3, -1, mat(0x35286a));
    box(tr, 0.4, 7.5, 0.4, -1.8, 4, -1, gold); box(tr, 0.4, 7.5, 0.4, 1.8, 4, -1, gold);
    const tri = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.4, 3), basic(0xe8d27a)); tri.position.set(0, 4.4, -0.7); tr.add(tri);
    const ths = glowSprite(0xb48cff, 14, 0.5); ths.position.set(0, 3.5, -2); tr.add(ths);
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), basic(0x8f7cff, { transparent: true, opacity: 0.16, depthWrite: false })); mist.position.y = 0.5; scene.add(mist);
    const fl = motes(scene, 90, [20, 9, 50], 0xbfe9ff, 0.09, 21);
    const pet = npcAt(scene, 'petra', -2.4, 0, -12, [0, -2]), mara = npcAt(scene, 'mara', 0, 1.4, -21.5, [0, 8]);
    const gd = makeGuardian(); gd.group.position.set(0.2, 0, -3); gd.group.rotation.y = Math.PI; scene.add(gd.group);
    const gh = makeGhost(); gh.position.set(1.0, 1.95, -3.4); scene.add(gh);
    const cams = {
      approach: (k) => [lerp(0.2, 0.1, k), lerp(1.9, 1.8, k), lerp(7, -1.2, k), 0, 2.4, -22],
      petra: (k) => [-0.6 + k * 0.2, 1.6, -7.8 + k * 0.4, -2.4, 1.55, -12],
      mara: (k) => [lerp(-0.7, -0.35, k), lerp(2.7, 2.5, k), lerp(-14.5, -15.5, k), 0, 2.6, -21.5],
      maraWide: (k) => [lerp(1.8, -1.0, k), 2.2, -9.5, 0, 2.2, -22],
      ghost: (k) => [-0.2, 2.0, -5 + k * 0.2, 1.0, 1.95, -3.4],
      guardian: (k) => [-0.8, 1.75, -5.2 + k * 0.2, 0.2, 1.65, -3],
      mara_close: (k) => [lerp(-0.2, 0.2, k), 2.75, lerp(-17.2, -18.2, k), 0, 2.7, -21.5],
      mara_side: (k) => [lerp(3.2, 2.6, k), 2.4, -16.5, 0, 2.55, -21.5],
    };
    return {
      scene, cams, defaultCam: [0, 1.9, 7, 0, 2.4, -22], pet, mara, gd, gh,
      tick(dt, t) { gd.update(dt); pet.update(dt, t); mara.update(dt, t); fl(t, 0, -8); gh.position.y = 1.95 + Math.sin(t * 2) * 0.05; gh.lookAt(0, 2, -20); mist.position.y = 0.5 + Math.sin(t * 0.4) * 0.05; tri.rotation.y = t * 0.5; },
    };
  },

  /** A boss falling in a dark hall: Crota kneels in a ring of green fire, then dies. */
  crota() {
    const scene = new THREE.Scene(), bg = 0x0b1210;
    scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, 8, 55);
    lights(scene, { sky: 0x5a8a6a, ground: 0x10181a, hemi: 0.55, sun: 0x9dff8a, sunI: 0.5, sunPos: [6, 12, 8] });
    cyl(scene, 26, 26, 0.5, 0, -0.25, 0, mat(0x2a3030), 18);
    const r = rngOf(7), rock = mat(0x2d3433);
    for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.283, d = 18 + r() * 5, h = 6 + r() * 12; const k = cyl(scene, 0.1, 1.6 + r(), h, Math.cos(a) * d, h / 2, Math.sin(a) * d, rock, 5); k.rotation.z = (r() - 0.5) * 0.2; }
    const fires = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + 0.3, x = Math.cos(a) * 7, z = Math.sin(a) * 7; cyl(scene, 0.2, 0.35, 1.2, x, 0.6, z, mat(0x3a3f3e), 6); const f = glowSprite(0x7dff6a, 3.2, 0.85); f.position.set(x, 1.7, z); scene.add(f); const l = new THREE.PointLight(0x6dff5a, 1.4, 16); l.position.set(x, 1.8, z); scene.add(l); fires.push(f); }
    const boss = bossStub('crota', 'moon'), cg = boss.group; scene.add(cg);
    const gd = makeGuardian(); gd.group.position.set(-3.2, 0, 7.5); gd.group.rotation.y = Math.PI + 0.35; scene.add(gd.group);
    const gh = makeGhost(); gh.position.set(-2.3, 1.9, 7.0); scene.add(gh);
    const sp = sparks(scene, 0x8dff7a, 0.16, 200), H = boss.height;
    const fogm = motes(scene, 60, [30, 8, 30], 0x7dff8a, 0.07, 13);
    let burst = false;
    return {
      scene, defaultCam: [0, 2.4, 10, 0, H * 0.5, 0], boss, H, gd,
      tick(dt, t, st, k) {
        gd.update(dt); sp.tick(dt); fogm(t);
        fires.forEach((f, i) => { f.scale.setScalar(3.1 + Math.sin(t * 7 + i * 2) * 0.35); });
        gh.position.y = 1.9 + Math.sin(t * 2) * 0.05; gh.lookAt(0, 2, 0);
        if (st.name === 'die') {
          const e = ease(k);
          cg.position.y = -e * H * 0.55; cg.rotation.x = 0.2 + e * 0.55; cg.position.x = Math.sin(t * 40) * 0.05 * (1 - e);
          cg.traverse((o) => { if (o.material?.emissive) o.material.emissiveIntensity = Math.max(0, (o.material.userData.ei ??= o.material.emissiveIntensity) * (1 - e)); });
          if (!burst) { burst = true; }
          if (k < 0.8) sp.emit(0, H * 0.6, 0, 3, 3, 0.9);
          cg.visible = k < 0.96;
        } else { cg.position.y = Math.sin(t * 1.1) * 0.04; cg.rotation.x = 0.2 + Math.sin(t * 0.9) * 0.012; }
      },
    };
  },

  /** The Leviathan's throne hall: Calus's body comes apart into wires. */
  calus() {
    const scene = new THREE.Scene(), bg = 0x1a1226;
    scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, 12, 70);
    lights(scene, { sky: 0xd8b8ff, ground: 0x3a2a1a, hemi: 0.75, sun: 0xffd890, sunI: 1.0, sunPos: [6, 14, 10] });
    const gold = mat(0xd9a93c, { metalness: 0.7, roughness: 0.35 }), pur = mat(0x4a1f6e);
    cyl(scene, 24, 24, 0.4, 0, -0.2, 0, mat(0x2a2030, { metalness: 0.4, roughness: 0.4 }), 20);
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.5, 7, 48).rotateX(-Math.PI / 2), basic(0xe8c25a)); ring.position.y = 0.01; scene.add(ring);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283, x = Math.cos(a) * 16, z = Math.sin(a) * 16; cyl(scene, 0.8, 1.0, 14, x, 7, z, gold, 8); box(scene, 3.2, 12, 0.2, Math.cos(a) * 14.6, 7, Math.sin(a) * 14.6, pur, -a + Math.PI / 2); const l = new THREE.PointLight(0xffc870, 1.0, 18); l.position.set(x * 0.8, 6, z * 0.8); scene.add(l); }
    cyl(scene, 3.2, 3.6, 0.6, 0, 0.3, 0, gold, 14);
    const boss = bossStub('emperorCalus', 'leviathan'), cg = boss.group; cg.position.y = 0.6; cg.rotation.y = 0; scene.add(cg);
    const gd = makeGuardian(); gd.group.position.set(-3.4, 0, 8); gd.group.rotation.y = Math.PI + 0.3; scene.add(gd.group);
    const gh = makeGhost(); gh.position.set(-2.5, 1.9, 7.5); scene.add(gh);
    const sp = sparks(scene, 0xffd060, 0.14, 240), sb = sparks(scene, 0x6ab8ff, 0.12, 160), H = boss.height;
    const wires = [], shards = [], wireCols = [0x2d6cff, 0xffa63a, 0xc9d1d8, 0xff4a3a];
    let spawned = false;
    const spawn = () => {
      spawned = true;
      for (let i = 0; i < 70; i++) {
        const len = 0.6 + Math.random() * 1.1, w = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 4), basic(wireCols[i % 4]));
        w.position.set((Math.random() - 0.5) * 0.8, H * (0.35 + Math.random() * 0.3) + 0.6, (Math.random() - 0.5) * 0.8);
        w.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        w.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 3.5, (Math.random() - 0.5) * 3); w.userData.s = new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
        scene.add(w); wires.push(w);
      }
      for (let i = 0; i < 18; i++) {
        const s = box(scene, 0.25 + Math.random() * 0.4, 0.18 + Math.random() * 0.2, 0.25 + Math.random() * 0.4, (Math.random() - 0.5) * 0.8, H * (0.3 + Math.random() * 0.4) + 0.6, (Math.random() - 0.5) * 0.8, gold, Math.random() * 3);
        s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4); shards.push(s);
      }
    };
    const phys = (list, dt) => {
      for (const o of list) {
        const v = o.userData.v; v.y -= 9 * dt; o.position.addScaledVector(v, dt);
        const floor = 0.62 + (o.geometry.type === 'CylinderGeometry' ? 0.03 : 0.1);
        if (o.position.y < floor) { o.position.y = floor; v.y *= -0.25; v.x *= 0.7; v.z *= 0.7; if (o.userData.s) { o.rotation.x += 0.0; } }
      }
    };
    return {
      scene, defaultCam: [0, 2.6, 11, 0, H * 0.55, 0], boss, H, gd,
      tick(dt, t, st, k, c) {
        gd.update(dt); sp.tick(dt); sb.tick(dt);
        gh.position.y = 1.9 + Math.sin(t * 2) * 0.05; gh.lookAt(0, 2, 0);
        if (st.name === 'shake') { cg.position.x = Math.sin(t * 55) * 0.05 * k; if (Math.random() < k * 0.6) sb.emit((Math.random() - 0.5), H * 0.6, 0.3, 2, 2.5, 0.5); }
        if (st.name === 'fall') {
          const e = ease(k);
          cg.scale.y = 0.8 * (1 - 0.88 * e); cg.scale.x = cg.scale.z = 0.8 * (1 + 0.1 * e); cg.position.x = Math.sin(t * 50) * 0.05 * (1 - e);
          sp.emit((Math.random() - 0.5) * 0.8, H * (1 - e) * 0.5 + 0.6, 0.2, 4, 3.5, 0.8); sb.emit(0, H * 0.4 * (1 - e) + 0.7, 0.2, 2, 3, 0.8);
          if (k > 0.35 && !spawned) { spawn(); c.flash = 0.7; }
          cg.visible = k < 0.9;
        } else if (st.name === 'pile') cg.visible = false;
        if (spawned) { phys(wires, dt); phys(shards, dt); if (Math.random() < 0.15) sb.emit(wires[0].position.x, 0.9, wires[0].position.z, 1, 1.2, 0.4); }
      },
    };
  },
};
