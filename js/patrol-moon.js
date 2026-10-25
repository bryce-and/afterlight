// U17b: the Moon patrol zone (docs/reference/moon-patrol-*, moon-*). Two peoples share it. The Fallen pick through the ruined Golden Age colony: a landing pad
// and lander in the south, the Archer's Line ridge with its research wing and wrecked skiffs, the Anchor of Light station (a hall with rooms) on a shelf, an east
// outpost, and a rail bridge over the road. The Hive hold the dark: the Hellmouth, a ring of spires round a pit; an ossuary yard with a crypt hall, reached by a
// catacomb tunnel from the west canyon; a silo cavern of tilted Golden Age cylinders; and the Hive castle wall along the north. Cliff-walled massifs form
// canyons, and marked roads (dark track, lamps) run from the landing to every area: lamps are white in the colony and green in Hive ground.
import * as THREE from 'three';
import { PATROL_DATA } from './patrol-data.js';
import { road as kitRoad, torch, firePit, lantern, hall as kitHall, desk, console_, shelf } from './patrol-kit.js';
import { MOON_KIT as MK } from './level-moon.js';
import { sandbags, fcrate, shield, banner, skiff, stairTo, CLOTH_B, CLOTH_R, F_BLUE } from './level-earth.js';

const { HR, HR2, BONE, CHIT, VOID, GA, GA2, ORANGE, GREEN, PALE } = MK.C;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ lights and roads

/** A Golden Age lamp: a pale post with a lit head that lights the dust under it. */
function gaLamp(K, x, z, h = 5, dead = false) {
  K.box(x, z, 0.3, h, 0.3, GA2);
  K.box(x, z, 0.9, 0.18, 0.9, GA, { y: h, collide: false });
  if (dead) return;
  K.box(x, z, 0.7, 0.1, 0.7, PALE, { y: h - 0.08, collide: false, glow: 2.2 });
  K.light(x, h - 0.6, z, PALE, 7, 26);
}

/** A marked road (patrol-kit.js): white lamps in the colony ('ga'), green crystal lamps on Hive ground ('hive'). */
const hall = (K, cx, cz, w, d, h, o = {}) => kitHall(K, cx, cz, w, d, h, { color: GA, roofColor: GA2, lamp: PALE, ...o });
const road = (K, pts, kind = 'ga', w = 7, gap = 26) => kitRoad(K, pts, { w, gap, lamp: kind === 'hive' ? (k, x, z) => MK.lamp(k, x, z, 3.2) : (k, x, z) => gaLamp(k, x, z, 4.8) });

// ------------------------------------------------------------------ buildings (patrol-kit.js: hall, desk, console_, shelf)

// ------------------------------------------------------------------ Fallen and Hive set pieces

/** A Fallen camp: sandbag ring, scrap, banners, a patched shelter, a fire pit, torches and a lantern. */
function fallenCamp(K, x, z, r = 7) {
  sandbags(K, x, z, r, 0.4, 2.4); sandbags(K, x, z, r, 3.6, 5.3);
  fcrate(K, x + 3, z - 3); fcrate(K, x - 4, z + 2); fcrate(K, x + 1, z + 4.5, 1.2);
  shield(K, x - 2, z - 5, true); shield(K, x + 5, z + 1, false);
  banner(K, x, z + r + 1, CLOTH_B); banner(K, x - r - 1, z, CLOTH_R);
  for (const [sx, sz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) K.box(x + sx + 1, z + sz - 1, 0.25, 3.0, 0.25, 0x4a4036, { collide: false });
  K.box(x + 1, z - 1, 5.6, 0.25, 5.6, 0x7a6a50, { y: 3.0, collide: false });
  firePit(K, x - 1, z + 1);
  for (const [tx, tz] of [[r - 0.6, -2], [-(r - 0.6), 2], [2, r - 0.6]]) torch(K, x + tx, z + tz, 2.8);
  lantern(K, x + 3.2, z - 3.2);
}

/** A Hive nest: pillars, braziers, bone and crystal round a point. */
function hiveNest(K, x, z, s = 1) {
  MK.broken(K, x - 4 * s, z - 3 * s, K.R(3, 6)); MK.broken(K, x + 5 * s, z + 2 * s, K.R(3, 5));
  MK.brazier(K, x + 2 * s, z - 4 * s, 1); MK.brazier(K, x - 3 * s, z + 4 * s, 0.9);
  for (let i = 0; i < 4; i++) MK.boneSpike(K, x + K.R(-6, 6) * s, z + K.R(-6, 6) * s, K.R(2.5, 4.5));
  MK.crystals(K, x + 6 * s, z - 5 * s, 1);
}

/** Hive growth on a Golden Age wall: bone spikes and green crystals grown through it. */
function growth(K, x, z, s = 1) {
  MK.crystals(K, x, z, 1.1 * s, { n: 3, glow: 1.3 });
  for (let i = 0; i < 3; i++) MK.boneSpike(K, x + K.R(-2, 2) * s, z + K.R(-2, 2) * s, K.R(3, 5.5) * s);
}

/** A ring of spires and broken pillars round (cx, cz), with a gap facing `open` (radians). */
function spireRing(K, cx, cz, r, n, h, open) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    if (Math.abs(Math.atan2(Math.sin(a - open), Math.cos(a - open))) < 0.42) continue;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (i % 2) MK.spire(K, x, z, K.R(2.6, 3.8), h * K.R(0.7, 1.15)); else MK.broken(K, x, z, K.R(3, 7));
  }
}

/** A rocky crag on a massif: a few big rocks and spikes of broken stone, visual only. */
function crag(K, x, z, s) {
  K.rock(x, z, s, { collide: false });
  K.rock(x + s * 0.8, z + s * 0.4, s * 0.6, { collide: false });
  K.rock(x - s * 0.7, z - s * 0.5, s * 0.5, { collide: false });
}

export default {
  m_patrol: {
    ...PATROL_DATA.m_patrol,
    build(K) {
      // ================================================================ the roads: every area is reached by one
      road(K, [[0, 156], [0, 100], [0, 40], [-12, 6], [-30, -28]], 'ga', 8);                            // the spine, landing to the station
      road(K, [[0, 100], [-30, 112], [-50, 104], [-76, 90], [-90, 62]], 'ga');                            // west to the ridge
      road(K, [[0, 100], [58, 100], [104, 92]], 'ga');                                                    // east to the outpost
      road(K, [[0, 40], [40, 10]], 'ga'); road(K, [[40, 10], [70, -20], [94, -40]], 'hive');                // east to the Hellmouth
      road(K, [[-12, 6], [-60, 0], [-104, -8]], 'ga'); road(K, [[-104, -8], [-110, -36], [-110, -66]], 'hive'); // the west canyon to the catacombs
      road(K, [[-30, -28], [-4, -44], [-4, -84], [0, -100]], 'ga');                                       // round the station to the north
      road(K, [[0, -100], [46, -96]], 'hive'); road(K, [[46, -96], [84, -100], [100, -108], [118, -114]], 'hive');     // to the rim camp and the silo cavern
      road(K, [[0, -100], [12, -140]], 'hive'); road(K, [[0, -100], [-30, -112], [-60, -118]], 'hive');   // to the castle wall and the ossuary yard

      // ================================================================ the cracked surface: craters, fissures, rocks, crags on the massifs
      for (const [x, z, r] of [[-60, 124, 6], [44, 150, 5], [-8, 78, 5], [90, 60, 6], [66, 36, 5], [-60, 30, 5], [8, -64, 6], [126, 130, 5], [-132, 136, 6], [130, -150, 6], [-24, 120, 4], [70, 130, 5]]) MK.crater(K, x, z, r);
      for (let i = 0; i < 34; i++) {
        const x = K.R(-140, 140), z = K.R(-170, 160);
        if (!K.clear(x, z, 4)) continue;
        K.mesh(new THREE.BoxGeometry(K.R(0.25, 0.5), 0.04, K.R(8, 22)), 0x3f4349, x, 0.06, z, { ry: K.R(0, TAU), collide: false });
      }
      for (const [x, z, s] of [[-40, 100, 2], [30, 88, 1.8], [-86, 134, 2.6], [90, 142, 2.2], [12, 44, 1.6], [70, -20, 2], [-22, -90, 2.2], [120, 22, 2.6], [-20, 60, 2]]) K.rock(x, z, s);
      for (const [x, z, s] of [[-130, 80, 6], [-132, 30, 7], [-128, -10, 5.5], [-134, 56, 5], [38, 56, 5], [40, 76, 4.5], [32, 46, 4], [130, 90, 6], [132, 50, 6.5], [128, 20, 5.5], [-92, -50, 5], [-98, -44, 4]]) crag(K, x, z, s);
      K.scatter((x, z) => K.rock(x, z, K.R(1, 2.4)), 0, 20, 10, 120, 14, 2);

      // ================================================================ the landing colony (Fallen, ruined humanity)
      K.cyl(0, 156, 9, 0.18, GA2, { sides: 16, collide: false });
      K.mesh(new THREE.TorusGeometry(8.4, 0.18, 4, 24), ORANGE, 0, 0.22, 156, { rx: Math.PI / 2, collide: false });
      K.mesh(new THREE.TorusGeometry(4.2, 0.12, 4, 20), PALE, 0, 0.22, 156, { rx: Math.PI / 2, collide: false, glow: 0.9 });
      for (const dx of [-9.5, 9.5]) gaLamp(K, dx, 156, 4.6);                                          // the pad's own lamps
      MK.lander(K, 28, 140, -0.5); MK.rover(K, -30, 150, true); MK.rover(K, 40, 112, false); MK.antenna(K, -40, 122, 12);
      K.crate(-12, 150); K.crate(-13.3, 150.6); K.crate(16, 146);
      // the customs hall by the landing: a lit room with desks and a broken wall
      hall(K, -44, 134, 20, 12, 5, { doors: { s: 5, e: 4 }, doorOffset: { s: -4 }, breaks: [['n', 12, 15]], lamps: 2, props: (k, cx, cz) => { desk(k, cx - 4, cz); desk(k, cx + 3, cz + 2); shelf(k, cx - 8, cz - 3, false); k.crate(cx + 6, cz - 3); } });
      fallenCamp(K, -70, 126, 6.5); fallenCamp(K, 74, 128, 6.5);

      // ================================================================ Archer's Line: the ridge, wrecked skiffs and a research wing
      MK.lander(K, -92, 36, 0.35); skiff(K, -98, 74); skiff(K, -82, 44);
      MK.rover(K, -100, 80, false); MK.rover(K, -84, 78, true);
      MK.fallenAntenna(K, -96, 50, 12); MK.antenna(K, -82, 30, 12); MK.antenna(K, -104, 90, 10);
      for (const [x, z, w, d] of [[-100, 56, 1.2, 6], [-82, 58, 5, 1.2], [-98, 68, 6, 1.2]]) K.box(x, z, w, 1.4, d, GA2);
      K.crate(-98, 64); K.crate(-86, 48);
      // the research wing at the head of the ramp: two rooms, a corridor and terminals
      hall(K, -92, 86, 22, 12, 5, { doors: { s: 5, e: 5 }, doorOffset: { s: 4 }, lamps: 3, props: (k, cx, cz) => { console_(k, cx - 6, cz - 3); console_(k, cx - 2, cz - 3); desk(k, cx + 5, cz + 2, false); shelf(k, cx - 8, cz + 3, false); } });
      K.wall(-98, 80, -98, 92, 5, { t: 0.7, color: GA, gaps: [[4, 7.6]] });
      fallenCamp(K, -100, 116, 6.5);

      // ================================================================ the rail bridge over the spine (Golden Age conveyor on piers)
      const BZ = 70, BT = 6.5;
      K.box(-15, BZ, 74, 1.2, 6, GA2, { y: BT - 1.2, abs: true });                                         // x -52 to 22
      K.box(-15, BZ - 2.6, 74, 0.5, 0.3, 0xc8ccd2, { y: BT, abs: true, collide: false });                  // rails
      K.box(-15, BZ + 2.6, 74, 0.5, 0.3, 0xc8ccd2, { y: BT, abs: true, collide: false });
      for (let x = -48; x < 20; x += 8) K.box(x, BZ, 1.2, 0.08, 4.4, ORANGE, { y: BT + 0.02, abs: true, collide: false });
      for (const px of [-48, -32, -16, 16]) for (const s of [-1, 1]) K.box(px, BZ + s * 2.4, 1.2, BT - 1.2, 1.2, GA2);
      stairTo(K, -50, BZ, 'e', 3, BT, GA2);
      for (const x of [-44, -20, 10]) { K.box(x, BZ, 0.5, 0.06, 0.5, PALE, { y: BT - 1.3, abs: true, collide: false, glow: 2 }); K.light(x, BT - 0.4, BZ, PALE, 8, 20); }

      // ================================================================ Anchor of Light: the station on its shelf (Fallen), with Hive growth through the walls
      MK.dome(K, -52, -52, 5.5); MK.dome(K, -8, -52, 5);
      hall(K, -30, -58, 28, 14, 6.4, { doors: { s: 6, n: 5 }, doorOffset: { s: 0, n: -6 }, lamps: 4, props: (k, cx, cz) => {
        for (const x of [-8, -2, 4, 10]) console_(k, cx + x, cz - 4);
        desk(k, cx - 10, cz + 2, false); shelf(k, cx + 12, cz + 2, false); k.crate(cx - 4, cz + 3); k.crate(cx - 5.3, cz + 3.6);
      } });
      K.wall(-30, -65, -30, -51, 6.4, { t: 0.7, color: GA, gaps: [[3, 7]] });                              // a partition: two rooms
      hall(K, -56, -28, 12, 9, 4.6, { doors: { e: 4 }, lamps: 2, props: (k, cx, cz) => { console_(k, cx - 2, cz - 2); k.crate(cx + 3, cz + 2); } });
      MK.tube(K, -46, -52, -43, -52); MK.tube(K, -17, -52, -13, -52);
      MK.antenna(K, -64, -62, 14); MK.antenna(K, 2, -64, 11);
      K.mesh(new THREE.CylinderGeometry(7, 7, 0.16, 18), GA2, -30, 0.1, -40, { collide: false });          // the pad where the event is held
      K.mesh(new THREE.TorusGeometry(6.6, 0.14, 4, 22), ORANGE, -30, 0.2, -40, { rx: Math.PI / 2, collide: false });
      growth(K, -60, -22); growth(K, -2, -62); growth(K, -46, -66, 0.8); growth(K, 6, -34, 0.8);
      MK.rover(K, -62, -36, false); MK.rover(K, 0, -42, true);

      // ================================================================ the east outpost: a depot with an interior, domes and an antenna (Fallen)
      MK.dome(K, 92, 108, 5); MK.dome(K, 112, 114, 4.2);
      hall(K, 94, 74, 18, 12, 5.2, { doors: { s: 5, w: 4 }, doorOffset: { s: 3 }, lamps: 2, props: (k, cx, cz) => { console_(k, cx - 3, cz - 3); shelf(k, cx + 5, cz - 2, false); k.crate(cx - 5, cz + 3); desk(k, cx + 2, cz + 3); } });
      MK.tube(K, 92, 102, 92, 80);
      MK.antenna(K, 114, 70, 12); MK.rover(K, 108, 100, false);
      growth(K, 114, 90, 0.9); K.crate(100, 118); K.crate(80, 100);
      fallenCamp(K, 66, 66, 6.5);

      // ================================================================ the Hellmouth: a dark pit ringed by Hive spires (Hive)
      const HX = 100, HZ = -50;
      K.mesh(new THREE.CircleGeometry(8.5, 24).rotateX(-Math.PI / 2), VOID, HX, 0.14, HZ, { collide: false });
      K.mesh(new THREE.TorusGeometry(8.5, 0.35, 4, 28), GREEN, HX, 0.3, HZ, { rx: Math.PI / 2, collide: false, glow: 1.6 });
      K.mesh(new THREE.TorusGeometry(12, 0.2, 4, 32), GREEN, HX, 0.2, HZ, { rx: Math.PI / 2, collide: false, glow: 0.9 });
      K.light(HX, 3, HZ, GREEN, 9, 40);
      spireRing(K, HX, HZ, 36, 16, 26, Math.PI * 0.62);
      spireRing(K, HX, HZ, 20, 10, 10, Math.PI * 0.62);
      for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; MK.brazier(K, HX + Math.cos(a) * 15.5, HZ + Math.sin(a) * 15.5, 1.1); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.2, r = K.R(10, 14); MK.boneSpike(K, HX + Math.cos(a) * r, HZ + Math.sin(a) * r, K.R(2.5, 5)); }
      MK.crystals(K, HX + 24, HZ - 14, 1.3); MK.crystals(K, HX - 10, HZ - 28, 1.2); MK.crystals(K, HX + 28, HZ + 18, 1.1);
      MK.hiveWall(K, HX - 44, HX + 44, HZ - 56, 7, { axis: 'x', face: 1, rib: 9, teeth: 4.5, gaps: [[34, 54]] });
      hiveNest(K, 90, 20, 0.9);

      // ================================================================ the ossuary yard, its crypt hall, and the catacomb tunnel from the west canyon (Hive)
      MK.hiveWall(K, -88, -32, -142, 7, { axis: 'x', face: 1, gaps: [[22, 34]] });
      MK.hiveWall(K, -142, -112, -88, 6, { axis: 'z', face: 1 });
      for (const [x, z, h] of [[-80, -108, 5], [-72, -132, 4], [-52, -102, 3.5]]) MK.broken(K, x, z, h);
      for (const [x, z] of [[-74, -118], [-60, -104]]) MK.brazier(K, x, z, 1);
      MK.crystals(K, -76, -136, 1.2);
      for (let i = 0; i < 6; i++) MK.boneSpike(K, K.R(-84, -66), K.R(-138, -104), K.R(2.5, 5));
      // the crypt hall: a roofed Hive hall with pillars, braziers and stone coffins
      hall(K, -44, -124, 18, 14, 8, { color: HR2, roofColor: CHIT, ceil: 0x2a2d31, lamp: GREEN, doors: { s: 5 }, doorOffset: { s: 0 }, lamps: 2, props: (k, cx, cz) => {
        for (const [dx, dz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) k.box(cx + dx, cz + dz, 1.2, 8, 1.2, HR);
        for (const dx of [-3, 3]) { k.box(cx + dx, cz - 1, 2.4, 0.9, 1.1, HR); MK.brazier(k, cx + dx * 1.6, cz + 4, 0.9); }
        MK.crystals(k, cx, cz - 5, 0.9);
      } });
      MK.tunnelPath(K, [[-110, -68], [-110, -104], [-92, -104]], { w: 7, h: 9 });
      MK.brazier(K, -110, -78, 0.9); MK.brazier(K, -110, -94, 0.9);
      K.rock(-117, -66, 4.4, { collide: false }); K.rock(-103, -66, 4, { collide: false });             // the cave mouth
      hiveNest(K, -60, -84, 0.9);

      // ================================================================ the silo cavern: a Hive-held hall of tilted Golden Age cylinders
      const SX = 118, SZ = -132;
      hall(K, SX, SZ, 44, 30, 18, { color: HR2, roofColor: CHIT, ceil: 0x1f2226, lamp: GREEN, doors: { s: 12 }, doorOffset: { s: 0 }, lamps: 4, props: (k) => {
        for (const [dx, dz, ry, tilt] of [[-12, -6, 0.3, 0.38], [-2, -9, 1.2, -0.34], [9, -6, 2.0, 0.4], [14, 4, 0.7, -0.36], [-10, 6, 2.6, 0.32], [2, 2, 3.4, 0.28]]) {
          k.mesh(new THREE.CylinderGeometry(2.4, 2.6, 13, 10), GA2, SX + dx, 6, SZ + dz, { ry, rz: tilt, collide: 0.5 });
          k.mesh(new THREE.TorusGeometry(2.6, 0.2, 4, 12), 0x5a5f66, SX + dx, 11.4, SZ + dz, { ry, rz: tilt, rx: Math.PI / 2, collide: false });
        }
        for (const [dx, dz] of [[-16, -10], [16, -10], [0, -12]]) { MK.crystals(k, SX + dx, SZ + dz, 1.4); k.light(SX + dx, 4, SZ + dz, GREEN, 9, 26); }
        k.light(SX, 8, SZ, 0xe8d6a0, 6, 34);
        for (let i = 0; i < 6; i++) MK.boneSpike(k, SX + K.R(-18, 18), SZ + K.R(-12, 12), K.R(2.5, 5));
      } });

      // ================================================================ the rim camp and the Hive castle wall along the north
      hiveNest(K, 12, -140, 1);
      MK.hiveWall(K, -148, 148, -174, 24, { axis: 'x', face: 1, rib: 10, teeth: 5 });
      MK.pointedArch(K, 0, -171, 14, 7, { face: 1 });
      for (const x of [-12, 12]) MK.brazier(K, x, -166, 1.4);
      for (const x of [-120, -70, 70, 120]) MK.spire(K, x, -166, 4, 40, { collide: true });
      for (const [x, z] of [[-142, -70], [142, -100], [-60, 164], [60, 166]]) MK.spire(K, x, z, K.R(3, 4.5), K.R(20, 34), { collide: false, pinnacles: false });
      MK.hiveEdge(K, 22, 0.5, 40);
    },
  },
};
