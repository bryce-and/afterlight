// U25 Crucible: Bannerfall (The Last City, Earth). Our own low-poly layout following the callout map in docs/reference/bannerfall/:
// mirrored west (Market) and east (Depot) halves around a Plaza on the south edge with the dead tree stump, and a Courtyard under the big
// buttressed wall to the north. Zones: A Assembly Hall (west), B Courtyard (north centre), C Depot Bay (east).
// Look: sun-bleached cream plaster and concrete, arched doorways, red City banners and awnings, overhead cables, moss, green-trimmed crates.
// Scaled to sprint time (a lane crossing is about 10 to 15 s), not to Destiny's metres. x grows east, z grows south.
import * as THREE from 'three';

const PLASTER = 0xe4d8bd, PLASTER2 = 0xd3c6a8, CONCRETE = 0xb9b3a4, CONCRETE2 = 0x9a9486, TRIM = 0x6e6558, BANNER = 0xb02a2a, BANNER2 = 0xc4403a;
const GREEN = 0x4d7a4f, MOSS = 0x5e7c3e, RUST = 0x8a5a3a, WOOD = 0x7a5a3a, GOLD = 0xe8c060, STONE = 0xcfc9ba;

// shared unit geometries, created lazily (THREE is only needed once build() runs)
let GEO = null;
const g = () => GEO || (GEO = { box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 6), cyl: new THREE.CylinderGeometry(1, 1, 1, 8) });

/** Spawn points, capture zones and crates: read by js/crucible.js (the level kit only knows `zones` and `spawn`). */
export const BANNERFALL = {
  name: 'Bannerfall',
  spawns: { blue: [[-60, -40], [-62, -34], [-58, -44], [-62, -44], [-56, -37], [-60, -30]], red: [[60, -40], [62, -34], [58, -44], [62, -44], [56, -37], [60, -30]] },
  zones: [{ id: 'A', name: 'Assembly Hall', x: -46, z: 12 }, { id: 'B', name: 'Courtyard', x: 0, z: -35 }, { id: 'C', name: 'Depot Bay', x: 46, z: 12 }],
  heavyCrate: { x: 0, z: 14 }, // the Plaza
  specialCrates: [{ x: -40, z: -32 }, { x: -52, z: 24 }, { x: 40, z: -32 }, { x: 52, z: 24 }],
  callouts: ['Market', 'Top Market', 'Market Balcony', 'Depot', 'Top Depot', 'Depot Balcony', 'Passage', 'Plaza', 'Stump'],
};

export default {
  bannerfall: {
    spawn: [-60, -40],
    bounds: [-72, 72, -55, 46],
    zones: BANNERFALL.zones.map((z) => ({ name: z.name, x: z.x, z: z.z })),
    noEdge: true,
    colors: { ground: 0xcdc3a8, ground2: 0xb9ae92, wall: PLASTER, metal: CONCRETE2, accent: BANNER, crate: GREEN, foliage: MOSS, rock: CONCRETE, rock2: CONCRETE2 },
    fog: [120, 330],
    build(K) {
      const { box, mesh } = K;
      const M = (geo, color, x, y, z, o = {}) => mesh(geo, color, x, y, z, { collide: false, ...o });

      // ---- helpers ----
      /** A hanging City banner on a wall face: a thin red cloth with a pale stripe. */
      const banner = (x, z, ry = 0, h = 5, y = 4) => {
        M(g().box, BANNER, x, y + h / 2, z, { ry, scale: [ry ? 0.12 : 1.5, h, ry ? 1.5 : 0.12] });
        M(g().box, GOLD, x, y + h * 0.78, z, { ry, scale: [ry ? 0.14 : 1.0, 0.18, ry ? 1.0 : 0.14] });
      };
      /** A red awning slung between a wall and the lane. */
      const awning = (x, z, w, d, y = 3.1, rx = 0.18) => M(g().box, BANNER2, x, y, z, { rx, scale: [w, 0.14, d] });
      /** Overhead cable across a lane. */
      const cable = (x1, z1, x2, z2, y = 9) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        M(g().box, 0x2c2a28, (x1 + x2) / 2, y, (z1 + z2) / 2, { ry: -Math.atan2(z2 - z1, x2 - x1), scale: [len, 0.07, 0.07] });
      };
      /** Arched doorway trim on a hall face (a lintel and two jamb stones; the doorway itself is left open by K.wall gaps). */
      const arch = (x, z, w, axis) => {
        const horiz = axis === 'x';
        box(horiz ? x : x, z, horiz ? w + 1.2 : 0.9, 1.0, horiz ? 0.9 : w + 1.2, STONE, { y: 4.4 });
        for (const s of [-1, 1]) box(horiz ? x + s * (w / 2 + 0.3) : x, horiz ? z : z + s * (w / 2 + 0.3), horiz ? 0.6 : 0.9, 4.4, horiz ? 0.9 : 0.6, STONE, { collide: false });
      };
      /** A moss and grass patch lying on the paving. */
      const moss = (x, z, w, d) => M(g().box, MOSS, x, 0.03, z, { scale: [w, 0.05, d] });
      const planter = (x, z, w = 3, d = 1.4) => { box(x, z, w, 0.9, d, CONCRETE); M(g().box, MOSS, x, 1.0, z, { scale: [w * 0.9, 0.2, d * 0.8] }); };
      const tree = (x, z, h = 4.5) => {
        box(x, z, 0.5, h * 0.55, 0.5, WOOD);
        M(g().cone, MOSS, x, h * 0.8, z, { scale: [2.0, h * 0.7, 2.0] });
      };
      /** A column with the vertical pattern of the Courtyard wall: a pale shaft with thin dark flutes. */
      const pillar = (x, z, w, h, d) => {
        box(x, z, w, h, d, STONE);
        for (let i = -2; i <= 2; i++) M(g().box, TRIM, x + i * (w / 5.2), h / 2, z + d / 2 + 0.04, { scale: [0.1, h * 0.86, 0.06] });
      };

      // ---- the city wall round the field (visible walls; the kit's invisible bounds are just beyond) ----
      K.wall(-72, -55, 72, -55, 15, { t: 3, color: PLASTER2 }); // north: the Courtyard's buttressed wall stands inside this
      K.wall(-72, 46, 72, 46, 11, { t: 3, color: PLASTER2 });
      K.wall(-72, -55, -72, 46, 12, { t: 3, color: PLASTER2 });
      K.wall(72, -55, 72, 46, 12, { t: 3, color: PLASTER2 });

      // ---- the Courtyard (B): a sunken-feel court under the big buttressed wall ----
      for (let i = -4; i <= 4; i++) pillar(i * 6.6, -52.2, 2.6, 15, 2.6); // vertical patterned pillars / buttresses
      box(0, -50.6, 56, 9, 1.0, PLASTER); // the wall face between the buttresses
      for (let i = -3; i <= 3; i++) banner(i * 8.2 + 3.3, -49.9, 0, 6, 4.5);
      for (const s of [-1, 1]) K.wall(s * 19, -49, s * 19, -22, 7, { t: 1.2, color: PLASTER, gaps: [[10, 22]] }); // side walls; the Passage opens toward each Market
      K.wall(-19, -22, 19, -22, 1.6, { t: 1.2, color: CONCRETE, gaps: [[10, 28]] }); // low parapet toward the Plaza
      box(0, -34, 5.4, 1.1, 5.4, STONE); M(g().cyl, 0x6aa8c8, 0, 1.15, -34, { scale: [2.3, 0.15, 2.3] }); // fountain basin
      planter(-9, -30, 5, 1.6); planter(9, -30, 5, 1.6); planter(-8, -42, 1.6, 5); planter(8, -42, 1.6, 5);
      tree(-13, -45); tree(13, -45); tree(-13, -27, 3.6); tree(13, -27, 3.6);
      box(-5, -26, 3, 1.2, 1.0, STONE); box(5, -26, 3, 1.2, 1.0, STONE); // low benches
      moss(0, -30, 14, 3); moss(-12, -40, 4, 8);

      // ---- the two halves: sx = -1 the Market (west), sx = 1 the Depot (east) ----
      for (const sx of [-1, 1]) {
        const X = (x) => sx * x;
        const market = sx < 0;
        const wallC = market ? PLASTER : CONCRETE; // the Depot is more concrete and green trim

        // the outer block along the edge, with the spawn yard in front of it (north)
        box(X(62), -17, 14, 10, 24, wallC);
        for (let z = -27; z <= -7; z += 6) banner(X(55.4), z, Math.PI / 2, 5, 4.2);
        box(X(62), 10, 14, 6, 14, CONCRETE); // a low service block south of it
        // the north block (Top Market / Top Depot stand on its east end)
        box(X(42), -44.5, 18, 9, 9, wallC);
        K.platform(X(24), -44, 8, 8, 3, { color: CONCRETE, stairs: [sx < 0 ? 'w' : 'e'] }); // Top Market / Top Depot
        awning(X(35), -39.3, 12, 3);
        // the middle block between the two lanes
        box(X(44), -20, 10, 6.5, 12, wallC);
        awning(X(49.7), -20, 3, 9, 3.1, market ? 0.2 : -0.2);
        // lane dressing
        if (market) { // stalls: counters under red awnings
          for (const [x, z] of [[-52, -33], [-44, -31], [-36, -43], [-55, -2], [-40, 4]]) { box(x, z, 3.2, 1.1, 1.4, WOOD); awning(x, z, 3.6, 2.6, 2.9); }
        } else { // green-trimmed crate stacks and a loading dock
          for (const [x, z] of [[52, -33], [44, -31], [36, -36], [55, -2], [40, 4]]) { box(x, z, 2.2, 1.6, 2.2, GREEN); box(x + 0.4, z - 0.2, 1.5, 1.2, 1.5, GREEN, { y: 1.6 }); }
          box(X(56), -33, 3, 0.35, 10, GOLD, { collide: false, y: 0.02 });
        }
        moss(X(52), -34, 6, 3); moss(X(47), 2, 5, 4);

        // the assembly hall (A) / the repair bay (C): a roofed room with wide doorways
        const hx = X(46), hz = 12;
        K.room(hx, hz, 22, 18, 8, { color: wallC, roof: true, roofColor: CONCRETE2, doors: market ? { n: 7, s: 7, w: 6, e: 9 } : { n: 7, s: 9, w: 9, e: 6 } });
        arch(hx, hz - 9, 7, 'x'); arch(hx, hz + 9, market ? 7 : 9, 'x'); arch(hx + sx * 11, hz, 6, 'z'); arch(hx - sx * 11, hz, market ? 9 : 9, 'z');
        box(hx - 5, hz - 3, 1.6, 7, 1.6, STONE); box(hx + 5, hz + 3, 1.6, 7, 1.6, STONE); // pillars inside
        box(hx, hz, 4, 1.2, 4, market ? WOOD : GREEN); // a central table / crate pile
        K.light(hx, 6, hz, 0xffe0a0, 6, 22);
        banner(hx, hz - 8.6, 0, 4, 2.2);
        // the balcony (south corner) with stairs up from the Plaza side
        K.platform(X(60), 36, 16, 10, 3.5, { color: market ? PLASTER2 : CONCRETE, stairs: ['n'] });
        box(X(60), 31.2, 16, 1.1, 0.4, TRIM, { y: 3.5 }); // balustrade
        for (let k = -2; k <= 2; k++) box(X(60 + k * 3), 40.8, 1.2, 1.4, 1.2, STONE, { y: 3.5 }); // cover on the deck
        // southern lane dressing
        planter(X(42), 24, 4, 1.6);
        for (const z of [-6, 28]) banner(X(28.5), z, Math.PI / 2, 4, 3);
        cable(X(66), -30, X(30), -30); cable(X(66), -4, X(26), 0, 8.5);
      }

      // ---- segmenting: walls, a roofed Passage, kiosks, terraces and a colonnade break every lane and the Plaza into rooms (Tower style) ----
      for (const sx of [-1, 1]) {
        const X = (x) => sx * x;
        const wallC = sx < 0 ? PLASTER : CONCRETE;
        const toward = sx < 0 ? 'e' : 'w'; // the side facing the middle of the map
        // the Passage: a roofed tunnel from each Market / Depot lane into the Courtyard
        K.room(X(26), -33.5, 12, 12, 5.5, { color: wallC, roof: true, roofColor: CONCRETE2, doors: { e: 6, w: 6 } });
        K.light(X(26), 4.4, -33.5, 0xffe0a0, 5, 16);
        arch(X(32), -33.5, 6, 'z'); arch(X(20), -33.5, 6, 'z');
        // a dividing wall splits the Plaza into a central avenue and a side court; two gaps connect them
        K.wall(X(15), -14, X(15), 26, 5.5, { t: 1.2, color: wallC, gaps: [[8, 14], [26, 32]] });
        for (const z of [-6, 3, 15, 22]) banner(X(14.3), z, Math.PI / 2, 4, 1.6);
        // the side court: a kiosk, a raised terrace and a pergola colonnade, each leaving 5 m or more to walk
        K.room(X(25), 4, 9, 9, 4.5, { color: wallC, roof: true, roofColor: CONCRETE2, doors: { n: 4, s: 4 } });
        K.platform(X(25), 18, 10, 6, 1.7, { color: STONE, stairs: [toward] });
        for (const [px, pz] of [[18, 27], [31, 27], [18, 36], [31, 36]]) box(X(px), pz, 1.3, 4.6, 1.3, STONE);
        box(X(24.5), 31.5, 15, 0.5, 11, CONCRETE2, { y: 4.6 }); // the pergola roof
        K.light(X(24.5), 4.3, 31.5, 0xfff0c8, 5, 18);
        // the lane between the Market / Depot block and the hall gets a mid wall and a half block
        box(X(34), -8, 8, 5, 5, wallC);
        K.wall(X(36), 24, X(36), 46, 5.5, { t: 1.2, color: wallC, gaps: [[8, 14]] }); // the balcony pocket: one door in from the Plaza side
        banner(X(36.7), 30, Math.PI / 2, 4, 3);
        // lane cover
        box(X(47), -33, 6, 4.6, 2.4, wallC); awning(X(47), -33, 6.4, 3.0, 4.7, 0);
        box(X(60), 24, 2, 2.6, 8, wallC);
        for (const [px, pz] of [[X(52), 25], [X(44), 28]]) box(px, pz, 2.4, 1.3, 2.4, sx < 0 ? WOOD : GREEN);
      }
      // the Stump pen: low walls round the Stump with one opening to the north
      K.wall(-8, 30, 8, 30, 1.5, { t: 1, color: CONCRETE, gaps: [[5, 11]] });
      K.wall(-8, 30, -8, 43, 1.5, { t: 1, color: CONCRETE });
      K.wall(8, 30, 8, 43, 1.5, { t: 1, color: CONCRETE });
      // the central avenue: pillars and low walls in two rows so no sightline runs the whole Plaza
      for (const z of [-10, 0, 22]) for (const x of [-8, 8]) box(x, z, 1.4, 4, 1.4, STONE);
      K.wall(-7, 5, -3, 5, 1.4, { t: 1, color: CONCRETE }); K.wall(3, 5, 7, 5, 1.4, { t: 1, color: CONCRETE });
      K.wall(-5, 21, -2, 21, 1.4, { t: 1, color: CONCRETE }); K.wall(2, 21, 5, 21, 1.4, { t: 1, color: CONCRETE });

      // ---- the Plaza and the Stump ----
      box(0, 36, 5.2, 3.2, 5.2, 0x6a5a48); K.cone(0, 36, 3.2, 3.6, 0x5a4a3a, { y: 3.2, sides: 6, collide: false }); // the dead tree stump
      for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3; M(g().cone, 0x5a4a3a, Math.sin(a) * 2.6, 2.1, 36 + Math.cos(a) * 2.6, { scale: [0.5, 2.8, 0.5], rx: 0.5, rz: -0.4 }); } // roots and jag
      box(-3, 25, 6, 1.3, 1.3, WOOD); // a fallen trunk
      box(0, 14, 3, 0.4, 3, CONCRETE2); // the heavy crate pad
      moss(0, 28, 16, 8); moss(-18, 6, 6, 6); moss(18, 6, 6, 6);
      for (const [x, z] of [[-3, 40], [3, 40]]) tree(x, z, 4);
      for (const x of [-12, 12]) banner(x, 44.6, 0, 6, 3.5);
      // lamps over the Courtyard and the Plaza
      K.light(0, 6, -34, 0xfff0c8, 7, 34); K.light(0, 7, 20, 0xfff0c8, 6, 40);
    },
  },
};
