// U21 Exotic Missions: reusable interactive objects, built from layout data (the Whisper's WHISPER_LAYOUT, js/level-whisper.js).
//   conduits  : bronze Vex pillars throwing a pale shaft of light; standing in one makes you Attuned (status 'attuned')
//   eyes      : teal Vex sockets in walls, seen and shot only while Attuned
//   phase blocks : translucent teal cubes that are solid only for a player who is Attuned (per machine: each player's own colliders)
//   glyph board : the order of eyes to shoot; blights : Taken orbs that drain Attuned inside their aura until shot down
//   gate      : a Vex door that opens when its encounter is solved
// This file builds meshes and colliders and animates them; the rules (what a shot means) live in exotic-missions.js and exotic-rules.js.
import * as THREE from 'three';
import { G } from './state.js';
import { mat } from './world.js';
import { sparks, ringFx, basicMat } from './effects.js';
import { GLYPH_SHAPES, GLYPH_SYMBOLS, EYE_SYM, boardWidth, boardYaw, moverState, moverBox } from './exotic-rules.js';
import { sfx } from './audio.js';
import { pointInColliders } from './colliders.js';
export { EYE_SYM, boardWidth, boardYaw };
import { blightOrb, disposeBlightOrb } from './blight-look.js';

const TEAL = 0x3affd8, BRONZE = 0x8a6a3a, DARK = 0x2b2118, PALE = 0xdff3ff;

let targets = []; // the meshes a shot can hit right now (eyes while Attuned, live blights)
/** Read by getHitTargets (game.js). */
export const mechTargets = () => targets;
const _sw = new THREE.Vector3();
/** An explosion (rocket, grenade, explosive perk) at pos strikes the single nearest live eye or blight within its radius. Only one, so a blast never fires several eyes of an ordered set at once. */
export function mechSplash(pos, radius) {
  let best = null, bd = Infinity;
  for (const m of targets) {
    const d = m.getWorldPosition(_sw).distanceTo(pos);
    if (d < radius + 0.5 && d < bd) { bd = d; best = m; }
  }
  best?.userData.mechShot?.(pos);
}

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ---------- canvas panels (glyph symbols and the glyph board): vector shapes (exotic-rules.js GLYPH_SHAPES), not font characters ----------
/** Fills one symbol on a canvas, centred at (cx, cy), `r` pixels from the centre to the farthest edge, with a dark outline so it reads on any wall. */
function drawGlyph(ctx, name, cx, cy, r, fill, outline = 0.16) {
  ctx.beginPath();
  for (const poly of GLYPH_SHAPES[name]) {
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * r, cy + y * r) : ctx.moveTo(cx + x * r, cy + y * r)));
    ctx.closePath();
  }
  ctx.lineJoin = 'round'; ctx.lineWidth = r * outline; ctx.strokeStyle = 'rgba(2,6,8,0.95)'; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill('evenodd');
}
function symbolTexture(sym) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(6,12,14,0.62)'; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill(); // a dark plate: the symbol is white, the material tints it
  drawGlyph(x, GLYPH_SYMBOLS[sym], 128, 128, 92, '#ffffff');
  return new THREE.CanvasTexture(c);
}
/** H22: a flat glyph panel fixed to the wall (a unit plane facing +z, sized by scale), not a sprite that turns to face the camera. */
function makeFlat(tex, w, h) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  s.scale.set(w, h, 1);
  return s;
}

/** Draws a glyph board: the symbols in order, done ones teal, the next one white, the rest dim. A shot sets board.flash ('ok' or 'bad') for a short colour pulse of the frame. Call again to update. */
export function drawBoard(board, puzzle) {
  const { canvas, ctx, tex } = board;
  const n = puzzle ? puzzle.order.length : 0, W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const fl = board.flashT > 0 ? board.flash : null;
  ctx.fillStyle = fl === 'bad' ? 'rgba(60,8,8,0.8)' : fl === 'ok' ? 'rgba(6,50,44,0.8)' : 'rgba(8,14,16,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = fl === 'bad' ? '#ff3a2a' : fl === 'ok' ? '#3affd8' : '#d9b36a'; ctx.lineWidth = fl ? 16 : 8; ctx.strokeRect(6, 6, W - 12, H - 12);
  const r = Math.min(H * 0.4, (W / Math.max(n, 1)) * 0.4);
  for (let k = 0; k < n; k++) {
    const x = ((k + 0.5) / n) * W;
    drawGlyph(ctx, GLYPH_SYMBOLS[puzzle.symbols[puzzle.order[k]]], x, H / 2, r, k < puzzle.progress ? '#3affd8' : k === puzzle.progress ? '#ffffff' : 'rgba(255,255,255,0.4)');
  }
  tex.needsUpdate = true;
}
/** A shot on the board's puzzle: flash its frame teal (right) or red (wrong) for 0.6 s. */
export function flashBoard(S, kind) { if (S.board) { S.board.flash = kind; S.board.flashT = 0.6; if (S.puzzle) drawBoard(S.board, S.puzzle); } }
function makeBoard(p, w, face) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = makeFlat(tex, w, w / 4);
  sprite.position.copy(p);
  sprite.rotation.y = boardYaw(p, face); // faces into the room
  return { canvas, ctx: canvas.getContext('2d'), tex, sprite };
}

const FLARE_T = 0.6;

// ---------- builders ----------
function buildConduit(p) {
  const g = new THREE.Group();
  g.position.copy(p);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.9), mat(DARK));
  base.position.y = 0.1;
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), mat(BRONZE));
  pillar.position.y = 0.6;
  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), mat(TEAL, { emissive: TEAL, emissiveIntensity: 1.6 }));
  cap.position.y = 1.2;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 9, 14, 1, true), new THREE.MeshBasicMaterial({ color: PALE, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  shaft.position.y = 4.5;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 6, 28), basicMat(TEAL, true));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
  g.add(base, pillar, cap, shaft, ring);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { p, group: g, cap, shaft, ring, lit: true };
}

function buildEye(spec, segI, i) {
  const n = new THREE.Vector3(spec.n[0], 0, spec.n[1]).normalize();
  const g = new THREE.Group();
  g.position.copy(v3(spec.p)).addScaledVector(n, 0.12);
  g.rotation.y = Math.atan2(n.x, n.z);
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 12).rotateX(Math.PI / 2), mat(DARK));
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), mat(TEAL, { emissive: TEAL, emissiveIntensity: 1.9 }));
  iris.scale.z = 0.5; iris.position.z = 0.07;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0x04120f));
  pupil.scale.z = 0.5; pupil.position.z = 0.17;
  g.add(socket, iris, pupil);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.z = 0.1;
  g.add(hit);
  g.visible = false;
  return { p: v3(spec.p), n, group: g, iris, hit, sym: null, lit: 0, seg: segI, i };
}

function buildBlight(p, segI, i, aura, hits) {
  const g = new THREE.Group();
  g.position.copy(p);
  const orb = blightOrb(0.85); // H22: the shared blight look (black orb, pale halo)
  const core = orb.core, wisps = orb.core; // the core spins (its surface streaks swirl) and swells when hit
  const hit = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  const ground = new THREE.Mesh(new THREE.RingGeometry(aura - 0.15, aura, 40), new THREE.MeshBasicMaterial({ color: 0xcfc8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.55; // the orb hangs about 1.6 m over the floor
  g.add(orb.group, hit, ground);
  g.visible = false;
  return { p, group: g, core, wisps, hit, ground, hp: hits, max: hits, alive: true, on: false, seg: segI, i, flash: 0 };
}

/** The AABB of a phase block from its layout entry: p is the block's centre, s its full size (level-whisper.js). */
export function blockBox(b) {
  const [x, y, z] = b.p, [w, h, d] = b.s;
  return { min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2) };
}

function buildBlock(b) {
  const box = blockBox(b);
  const size = box.max.clone().sub(box.min), c = box.min.clone().addScaledVector(size, 0.5);
  const solid = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.14, depthWrite: false, fog: false }));
  solid.position.copy(c);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(solid.geometry), new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.6, fog: false }));
  edges.position.copy(c);
  const col = { min: box.min, max: box.max, pass: true, phase: true };
  return { mesh: solid, edges, col, box };
}

function buildGate(spec) {
  const [x, y, z] = spec.p;
  const alongX = spec.axis === 'x';
  const w = spec.w, h = spec.h, thick = 0.8;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w : thick, h, alongX ? thick : w), mat(BRONZE));
  slab.position.y = h / 2;
  const seam = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w * 0.9 : thick + 0.04, 0.12, alongX ? thick + 0.04 : w * 0.9), mat(TEAL, { emissive: TEAL, emissiveIntensity: 1.5 }));
  seam.position.y = h * 0.5;
  g.add(slab, seam);
  const col = { min: new THREE.Vector3(x - (alongX ? w : thick) / 2, y, z - (alongX ? thick : w) / 2), max: new THREE.Vector3(x + (alongX ? w : thick) / 2, y + h, z + (alongX ? thick : w) / 2), gate: true };
  slab.userData.gate = true;
  return { p: v3(spec.p), w, h, axis: spec.axis, group: g, slab, seam, col, open: false, sink: 0 };
}

// ---------- movers: Vex pistons (data: layout segment `movers`, rules: exotic-rules.js moverState) ----------
function buildMover(spec, root) {
  const [sx, sy, sz] = spec.s, ai = spec.axis, sgn = Math.sign(spec.travel), th = ai === 'x' ? sx : sz;
  const g = new THREE.Group();
  g.position.set(spec.p[0], spec.p[1], spec.p[2]);
  const glow = new THREE.MeshBasicMaterial({ color: 0x401008, fog: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(0x6e4c2a));
  const face = new THREE.Mesh(ai === 'x' ? new THREE.BoxGeometry(0.08, sy * 0.78, sz * 0.9) : new THREE.BoxGeometry(sx * 0.9, sy * 0.78, 0.08), glow); // the face it slams with
  face.position[ai] = sgn * (th / 2 + 0.02);
  const bandA = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.06, 0.16, sz + 0.06), glow), bandB = bandA.clone();
  bandA.position.y = sy * 0.34; bandB.position.y = -sy * 0.34;
  g.add(body, face, bandA, bandB);
  const house = new THREE.Mesh(ai === 'x' ? new THREE.BoxGeometry(1.4, sy + 0.8, sz + 0.8) : new THREE.BoxGeometry(sx + 0.8, sy + 0.8, 1.4), mat(0x4a3320)); // the bronze housing it comes out of
  house.position.set(spec.p[0], spec.p[1], spec.p[2]); house.position[ai === 'x' ? 'x' : 'z'] -= sgn * (th / 2 + 0.7);
  const len = Math.abs(spec.travel) + th, rail = new THREE.Mesh(ai === 'x' ? new THREE.BoxGeometry(len, 0.12, 0.3) : new THREE.BoxGeometry(0.3, 0.12, len), new THREE.MeshBasicMaterial({ color: 0xffa83a, transparent: true, opacity: 0.55, fog: false })); // its lane, drawn so the danger is readable
  rail.position.set(spec.p[0], spec.p[1] - sy / 2 - 0.02, spec.p[2]); rail.position[ai === 'x' ? 'x' : 'z'] += spec.travel / 2;
  root.add(g, house, rail);
  const b = moverBox(spec, 0);
  const col = { min: { x: b.min[0], y: b.min[1], z: b.min[2] }, max: { x: b.max[0], y: b.max[1], z: b.max[2] }, mover: true };
  G.colliders.push(col);
  return { spec, group: g, glow, col, house, rail, phase: 'rest', u: 0 };
}

/** A set of hidden eyes (seen and shot only while Attuned) that reveals a side path of phase blocks and a cache. layout segment `secret`. */
function buildSecret(spec, segI, mech, root) {
  const eyes = spec.eyes.map((e, i) => {
    const eye = buildEye(e, segI, i);
    eye.secret = true;
    eye.iris.material = mat(SECRET_EYE, { emissive: SECRET_EYE, emissiveIntensity: 1.9 });
    eye.ring = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.86, 24), new THREE.MeshBasicMaterial({ color: SECRET_EYE, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
    eye.ring.position.z = 0.04; eye.group.add(eye.ring);
    eye.hit.userData.mechShot = (pt) => mech.onShot?.('seye', segI, i, pt);
    root.add(eye.group);
    return eye;
  });
  const blocks = spec.blocks.map((b) => { const bl = buildBlock(b); bl.mesh.visible = false; bl.edges.visible = false; root.add(bl.mesh, bl.edges); return bl; });
  return { spec, eyes, blocks, lit: eyes.map(() => 0), revealed: false, fade: 0, chestAt: v3(spec.chest) };
}
const SECRET_EYE = 0xffb347;

// ---------- the whole set ----------
/**
 * Builds every mechanic of a layout into the scene. `cfg`: { blightRadius, blightHits }.
 * `mech.onShot(kind, seg, i, point)` is set by the runtime; shots on eyes and blights arrive there.
 */
export function buildMechanics(layout, cfg) {
  const root = new THREE.Group();
  root.name = 'mechanics';
  G.scene.add(root);
  const mech = { root, segs: [], attuned: false, attuneLeft: 0, onShot: null, onPush: null, onTrapped: null, cfg, time: 0, clock: null, fadeCause: null, smother: false };
  layout.segments.forEach((seg, si) => {
    const S = { id: seg.id, kind: seg.kind, index: si, spec: seg, conduits: [], eyes: [], blocks: [], blights: [], movers: [], secret: null, gate: null, board: null, puzzle: null, active: false, done: false, blightsOn: false };
    for (const c of seg.conduits || []) { const cd = buildConduit(v3(c)); S.conduits.push(cd); root.add(cd.group); }
    (seg.eyes || []).forEach((e, i) => {
      const eye = buildEye(e, si, i);
      eye.hit.userData.mechShot = (pt) => mech.onShot?.('eye', si, i, pt);
      S.eyes.push(eye); root.add(eye.group);
    });
    for (const b of seg.phaseBlocks || []) {
      const bl = buildBlock(b);
      root.add(bl.mesh, bl.edges);
      G.colliders.push(bl.col);
      S.blocks.push(bl);
    }
    (seg.blights || []).forEach((b, i) => {
      const bp = v3(b); // the layout gives the orb's centre (about 1.6 m above the floor)
      const bt = buildBlight(bp, si, i, cfg.blightRadius, cfg.blightHits);
      bt.hit.userData.mechShot = (pt) => mech.onShot?.('blight', si, i, pt);
      S.blights.push(bt); root.add(bt.group);
    });
    for (const m of seg.movers || []) S.movers.push(buildMover(m, root));
    if (seg.secret) S.secret = buildSecret(seg.secret, si, mech, root);
    if (seg.gate) {
      S.gate = buildGate(seg.gate);
      root.add(S.gate.group);
      G.colliders.push(S.gate.col);
      G.staticMeshes.push(S.gate.slab);
    }
    if (seg.glyph) {
      const r = seg.room || seg.region;
      S.board = makeBoard(v3(seg.glyph), boardWidth(seg), r ? { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 } : null);
      S.board.sprite.visible = false;
      root.add(S.board.sprite);
    }
    mech.segs.push(S);
  });
  G.hitDirty = true;
  return mech;
}

/** Removes a set (its colliders leave the level's list; the meshes leave the scene). */
export function disposeMechanics(mech) {
  if (!mech) return;
  mech.root.parent?.remove(mech.root);
  for (const S of mech.segs) {
    for (const b of [...S.blocks, ...(S.secret?.blocks || [])]) { const i = G.colliders.indexOf(b.col); if (i >= 0) G.colliders.splice(i, 1); }
    for (const m of S.movers) { const i = G.colliders.indexOf(m.col); if (i >= 0) G.colliders.splice(i, 1); }
    if (S.gate) {
      const i = G.colliders.indexOf(S.gate.col); if (i >= 0) G.colliders.splice(i, 1);
      const j = G.staticMeshes.indexOf(S.gate.slab); if (j >= 0) G.staticMeshes.splice(j, 1);
    }
  }
  targets = [];
  G.hitDirty = true;
}

// ---------- state setters (used by the runtime and the co-op mirror) ----------
/** Gives a segment's eyes their symbols from a puzzle and draws its board. */
export function setPuzzle(S, puzzle) {
  S.puzzle = puzzle;
  S.eyes.forEach((e, i) => {
    const sym = puzzle.symbols[i];
    if (e.sym?.userData.sym === sym) return;
    if (e.sym) { e.group.remove(e.sym); e.sym.material.map.dispose(); e.sym.material.dispose(); }
    e.sym = makeFlat(symbolTexture(sym), EYE_SYM.size, EYE_SYM.size);
    e.sym.userData.sym = sym;
    e.sym.position.set(0, EYE_SYM.y, EYE_SYM.z);
    e.group.add(e.sym);
    if (!e.ring) { // a soft teal halo behind the symbol so it reads from across the room
      e.ring = new THREE.Mesh(new THREE.RingGeometry(EYE_SYM.size * 0.46, EYE_SYM.size * 0.56, 28), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
      e.ring.position.set(0, EYE_SYM.y, EYE_SYM.z - 0.05);
      e.group.add(e.ring);
    }
    paintEye(e);
  });
  if (S.board) drawBoard(S.board, puzzle);
}
export function refreshBoard(S) { if (S.board && S.puzzle) drawBoard(S.board, S.puzzle); }

/** 0: dark socket, 1: shot correctly (stays lit, flares first when `flare`), 2: wrong (red flash that fades back to 0). */
export function setEyeLit(S, i, v, flare = false) {
  const e = S.eyes[i];
  e.lit = v;
  e.flashT = v === 2 ? 0.7 : 0;
  if (v !== 1) e.flareT = 0;
  else if (flare) e.flareT = FLARE_T;
  if (e.ownIris) { e.ownIris.dispose(); e.ownIris = null; }
  e.iris.material = v === 2 ? mat(0xff3a2a, { emissive: 0xff3a2a, emissiveIntensity: 2 }) : v === 1 ? mat(TEAL, { emissive: TEAL, emissiveIntensity: 2.6 }) : mat(TEAL, { emissive: TEAL, emissiveIntensity: 1.9 });
  // the flare animates emissiveIntensity, so a flaring iris gets its own copy (mat() materials are shared by every mesh of that look)
  if (v === 1 && flare) e.iris.material = e.ownIris = e.iris.material.clone();
  paintEye(e);
}
/** The symbol and halo follow the eye: teal when lit, red on a wrong shot, pale when dark. */
function paintEye(e) {
  const col = e.lit === 1 ? TEAL : e.lit === 2 ? 0xff3a2a : 0xffffff;
  if (e.sym) e.sym.material.color.setHex(col);
  if (e.ring) { e.ring.material.color.setHex(e.lit === 2 ? 0xff3a2a : TEAL); e.ring.material.opacity = e.lit === 1 ? 0.8 : 0.35; e.ring.scale.setScalar(1); }
}
/** Steps the right-shot flare: a strong emissive burst that settles to the steady lit glow. Returns true while flaring. */
export function stepEyeFlare(e, dt) {
  if (!(e.flareT > 0)) return false;
  e.flareT = Math.max(0, e.flareT - dt);
  const k = e.flareT / FLARE_T;
  e.iris.material.emissiveIntensity = 2.6 + 7 * k * k;
  if (e.ring) { e.ring.material.opacity = 0.8 + 0.2 * k; e.ring.scale.setScalar(1 + 0.7 * k); }
  if (e.sym) e.sym.scale.setScalar(EYE_SYM.size * (1 + 0.25 * k));
  if (e.flareT === 0 && e.sym) e.sym.scale.set(EYE_SYM.size, EYE_SYM.size, 1);
  return e.flareT > 0;
}

export function setConduitLit(S, i, lit) {
  const c = S.conduits[i];
  c.lit = lit;
  c.shaft.visible = lit;
  c.ring.visible = lit;
  c.cap.material = lit ? mat(TEAL, { emissive: TEAL, emissiveIntensity: 1.6 }) : mat(0x3a3a3a);
}

export function setGate(S, open, instant = false) {
  const g = S.gate;
  if (!g || g.open === open) return;
  g.open = open;
  const i = G.colliders.indexOf(g.col);
  if (open && i >= 0) G.colliders.splice(i, 1);
  if (!open && i < 0) G.colliders.push(g.col);
  const j = G.staticMeshes.indexOf(g.slab);
  if (open && j >= 0) G.staticMeshes.splice(j, 1);
  if (!open && j < 0) G.staticMeshes.push(g.slab);
  if (!open) { g.sink = 0; g.group.position.y = g.p.y; }
  else if (instant) { g.sink = 1; g.group.position.y = g.p.y - g.h - 0.2; }
  G.hitDirty = true;
}

export function setBlightsOn(S, on) {
  S.blightsOn = on;
  for (const b of S.blights) b.on = on;
}
export function setBlightHp(S, i, hp) {
  const b = S.blights[i];
  const was = b.alive;
  b.hp = hp; b.alive = hp > 0;
  b.flash = 0.2;
  if (was && !b.alive) { sparks(b.p, 0xffffff, 26, 8, 0.12, 0.7); ringFx(b.p.clone().setY(b.p.y - 1.4), mechRadius(S), 0xcfc8ff, 0.6); }
}
const mechRadius = (S) => S.blights[0] ? 5 : 3;

/** Marks which segment the player is in. Only that one's eyes and blights can be shot. */
export function setActiveSegment(mech, index) {
  mech.segs.forEach((S, i) => { S.active = i === index; });
  rebuildTargets(mech);
}
export function setSegmentDone(S, done) { S.done = done; }
// ---------- the hidden eyes, the side path and the cache ----------
/** A hidden eye shot: lit (1) stays lit, with a flare when `flare`; 0 puts it back dark (a segment reset). */
export function setSecretEye(S, i, lit, flare = false) {
  const sec = S.secret, e = sec?.eyes[i];
  if (!e) return;
  sec.lit[i] = lit; e.lit = lit;
  if (e.ownIris) { e.ownIris.dispose(); e.ownIris = null; }
  e.iris.material = mat(lit ? 0xfff0c0 : SECRET_EYE, { emissive: lit ? 0xffd27a : SECRET_EYE, emissiveIntensity: lit ? 2.8 : 1.9 });
  if (lit && flare) { e.iris.material = e.ownIris = e.iris.material.clone(); e.flareT = FLARE_T; } else e.flareT = 0;
  e.ring.material.opacity = lit ? 0.95 : 0.6; e.ring.scale.setScalar(1);
}
/** Shows or hides the side path (its blocks become solid-while-Attuned colliders). `instant` skips the fade-in. */
export function setSecretRevealed(S, on, instant = false) {
  const sec = S.secret;
  if (!sec || sec.revealed === on) return;
  sec.revealed = on;
  for (const b of sec.blocks) {
    const i = G.colliders.indexOf(b.col);
    if (on && i < 0) G.colliders.push(b.col);
    if (!on && i >= 0) G.colliders.splice(i, 1);
    b.mesh.visible = b.edges.visible = on;
  }
  sec.fade = on ? (instant ? 1 : 0) : 0;
  G.hitDirty = true;
}
/** Puts the hidden set back as it was (a segment reset). */
export function resetSecret(S) {
  if (!S.secret) return;
  S.secret.eyes.forEach((_, i) => setSecretEye(S, i, 0));
  setSecretRevealed(S, false);
}


/** The shootable meshes: eyes of the active segment while Attuned, and live blights that are switched on. */
export function rebuildTargets(mech) {
  const out = [];
  for (const S of mech.segs) {
    if (!S.active) continue;
    if (mech.attuned) for (const e of S.eyes) out.push(e.hit);
    if (mech.attuned && S.secret) for (const e of S.secret.eyes) out.push(e.hit);
    for (const b of S.blights) if (b.on && b.alive) out.push(b.hit);
  }
  targets = out;
  G.hitDirty = true;
}

/** True when an eye is lit-locked or otherwise inert; the runtime decides, this is only the player-facing marker. */
export function eyesVisible(mech) { return mech.attuned; }

// ---------- per frame ----------
const _d = new THREE.Vector3();
/** True when the player stands on (or just over) one of this machine's phase blocks. */
export function overBlock(mech, P) {
  for (const S of mech.segs) for (const b of [...S.blocks, ...(S.secret?.revealed ? S.secret.blocks : [])]) {
    if (P.pos.x > b.box.min.x - 0.4 && P.pos.x < b.box.max.x + 0.4 && P.pos.z > b.box.min.z - 0.4 && P.pos.z < b.box.max.z + 0.4 && Math.abs(P.pos.y - b.box.max.y) < 0.4) return true;
  }
  return false;
}

const _pv = new THREE.Vector3();
/** Moves one piston to where the clock says, lights its charge-up, plays its sounds and knocks the local player out of its way. */
function stepMover(mech, m, T, P) {
  const st = moverState(m.spec, T), b = moverBox(m.spec, st.u), ai = m.spec.axis === 'x' ? 0 : 2;
  m.u = st.u;
  m.group.position.set(m.spec.p[0], m.spec.p[1], m.spec.p[2]);
  m.group.position[m.spec.axis] += m.spec.travel * st.u;
  m.col.min.x = b.min[0]; m.col.min.y = b.min[1]; m.col.min.z = b.min[2]; m.col.max.x = b.max[0]; m.col.max.y = b.max[1]; m.col.max.z = b.max[2];
  // charge-up: the glow climbs from dim red to white-hot and flickers faster as the slam nears; held out it burns
  const k = st.phase === 'tele' ? st.tele : st.phase === 'fire' || st.phase === 'hold' ? 1 : st.phase === 'ret' ? 0.35 : 0;
  const flick = st.phase === 'tele' ? 0.7 + 0.3 * Math.sin(T * (10 + 24 * st.tele)) : 1;
  m.glow.color.setRGB(0.25 + 0.75 * k * flick, 0.06 + 0.5 * k * k * flick, 0.04 + 0.35 * k * k * k);
  m.rail.material.opacity = 0.3 + 0.5 * k;
  if (st.phase !== m.phase) {
    _pv.set(m.spec.p[0], m.spec.p[1], m.spec.p[2]);
    const near = P && _pv.distanceTo(P.pos) < 42;
    if (near && st.phase === 'tele') sfx.pistonHum(_pv.clone());
    if (near && st.phase === 'fire') sfx.pistonSlam(_pv.clone());
    m.phase = st.phase;
  }
  if (P && !P.dead && st.u > 0.002 && pushOut(mech, m, b, ai, P)) mech.onPush?.(m);
}
/** The player's body inside a piston's box: carry it ahead of the piston's face with an outward impulse (or, if the piston came out under them, behind it). Never leaves the player inside any solid. */
function pushOut(mech, m, b, ai, P) {
  const r = P.radius ?? 0.4, h = P.height ?? 1.8;
  if (P.pos.x + r <= b.min[0] || P.pos.x - r >= b.max[0] || P.pos.z + r <= b.min[2] || P.pos.z - r >= b.max[2] || P.pos.y + h <= b.min[1] || P.pos.y >= b.max[1]) return false;
  const key = ai === 0 ? 'x' : 'z', sgn = Math.sign(m.spec.travel), mid = (b.min[ai] + b.max[ai]) / 2;
  const lead = sgn > 0 ? b.max[ai] + r + 0.05 : b.min[ai] - r - 0.05, trail = sgn > 0 ? b.min[ai] - r - 0.05 : b.max[ai] + r + 0.05;
  const ahead = (P.pos[key] - mid) * sgn >= 0, from = P.pos[key];
  const tryAt = (v, dir) => {
    P.pos[key] = v;
    if (pointInColliders({ x: P.pos.x, y: P.pos.y + 0.9, z: P.pos.z }, 0, true)) return false;
    P.vel[key] = dir * m.spec.push; P.vel.y = Math.max(P.vel.y, 3.2); P.onGround = false;
    return true;
  };
  if (!(ahead ? tryAt(lead, sgn) : tryAt(trail, -sgn)) && !(ahead ? tryAt(trail, -sgn) : tryAt(lead, sgn))) { P.pos[key] = from; mech.onTrapped?.(P); }
  P.shake = Math.max(P.shake || 0, 0.4);
  return true;
}

/**
 * Animates everything and applies this machine's Attuned. `P`: the local player. Returns 'attuned', 'faded' or null on a change.
 * Co-op: every machine runs this for its own player; the lit state of conduits and the blights come from the host (setConduitLit, setBlightHp).
 */
export function updateMech(mech, dt, P) {
  mech.time += dt;
  const t = mech.time, cfg = mech.cfg, T = mech.clock ?? mech.time; // T: the shared mission clock (movers), the local one before the runtime sets it
  // Attuned: stand in a lit conduit's light; a live blight's aura blocks and removes it
  let inLight = false, drained = false;
  if (P && !P.dead) {
    for (const S of mech.segs) {
      for (const c of S.conduits) {
        if (!c.lit) continue;
        if (Math.hypot(P.pos.x - c.p.x, P.pos.z - c.p.z) < cfg.conduitRadius && P.pos.y > c.p.y - 0.6 && P.pos.y < c.p.y + 3) inLight = true;
      }
      for (const b of S.blights) {
        if (!b.on || !b.alive) continue;
        if (_d.set(P.pos.x - b.p.x, P.pos.y + 1 - b.p.y, P.pos.z - b.p.z).length() < cfg.blightRadius) drained = true;
      }
    }
    if (drained) P.status.remove('attuned');
    else if (inLight) P.status.apply('attuned', { t: cfg.attuneTime, set: true });
  }
  mech.smother = inLight && drained; // standing in a conduit while a blight smothers it
  const now = !!P && !P.dead && P.status.has('attuned');
  mech.attuneLeft = now ? P.status.remaining('attuned') : 0;
  let ev = null;
  if (now !== mech.attuned) {
    mech.attuned = now;
    ev = now ? 'attuned' : 'faded';
    if (!now) mech.fadeCause = !P || P.dead ? 'dead' : drained ? 'blight' : 'time';
    rebuildTargets(mech);
  }
  // about to fade while you stand on a phase block: a ticking warning (the blocks flicker too)
  mech.tickT = (mech.tickT ?? 0) - dt;
  if (now && mech.attuneLeft < 4 && mech.tickT <= 0 && P.onGround && overBlock(mech, P)) { mech.tickT = mech.attuneLeft < 2 ? 0.3 : 0.6; sfx.attuneTick(mech.attuneLeft < 2); }
  // visuals
  const blink = now && mech.attuneLeft < 3 ? 0.5 + 0.5 * Math.sin(t * 14) : 1; // about to fade: blocks flicker
  for (const S of mech.segs) {
    for (const c of S.conduits) {
      if (!c.lit) continue;
      c.cap.rotation.y = t * 1.5; c.cap.position.y = 1.2 + Math.sin(t * 2 + c.p.x) * 0.06;
      c.shaft.material.opacity = 0.17 + 0.05 * Math.sin(t * 2.4 + c.p.z);
    }
    for (const e of S.eyes) {
      e.group.visible = now && (S.active || S.done);
      stepEyeFlare(e, dt);
      if (e.flashT > 0) { e.flashT -= dt; if (e.flashT <= 0) setEyeLit(S, e.i, 0); }
    }
    for (const bl of S.blocks) {
      bl.col.pass = !now; // solid only for an Attuned player: colliders are this machine's own list
      bl.mesh.material.opacity = now ? 0.4 * blink : 0.12;
      bl.edges.material.opacity = now ? 0.95 * blink : 0.4;
    }
    if (S.secret) {
      const sec = S.secret;
      for (const e of sec.eyes) {
        e.group.visible = now && S.active;
        stepEyeFlare(e, dt);
        if (e.group.visible) e.ring.rotation.z = t * 0.8; // the halo turns: a hidden eye reads as something alive
      }
      if (sec.revealed) {
        sec.fade = Math.min(1, sec.fade + dt / 1.4);
        for (const bl of sec.blocks) {
          bl.col.pass = !now;
          bl.mesh.material.opacity = (now ? 0.4 * blink : 0.12) * sec.fade;
          bl.edges.material.opacity = (now ? 0.95 * blink : 0.4) * sec.fade;
        }
      }
    }
    for (const m of S.movers) stepMover(mech, m, T, P);
    if (S.board?.flashT > 0) { S.board.flashT -= dt; if (S.board.flashT <= 0 && S.puzzle) drawBoard(S.board, S.puzzle); }
    for (const b of S.blights) {
      b.group.visible = b.on && b.alive;
      if (!b.group.visible) continue;
      b.wisps.rotation.y = t * 1.2;
      b.group.position.y = b.p.y + Math.sin(t * 1.6 + b.i) * 0.12;
      b.flash = Math.max(0, b.flash - dt);
      b.core.scale.setScalar(1 + b.flash * 1.5);
    }
    if (S.gate && S.gate.open && S.gate.sink < 1) {
      S.gate.sink = Math.min(1, S.gate.sink + dt / 1.6);
      S.gate.group.position.y = S.gate.p.y - (S.gate.h + 0.2) * S.gate.sink;
    }
    if (S.board) S.board.sprite.visible = S.active && !!S.puzzle;
  }
  return ev;
}

/** A shot landed on an eye or blight mesh: tell the runtime. Called from the hitscan (player.js) with the mesh's userData. */
export function shotMesh(mesh, point) { mesh.userData.mechShot?.(point); }

// ---------- Blight Edge: the blight bomb (a black orb with white Taken wisps that pulses, then detonates) ----------
/** The bomb's orb for `fuse` seconds, then onDone() once (leave it out for a teammate's copy, which is only a picture). */
export function blightBombFx(pos, fuse, onDone) {
  const g = new THREE.Group();
  g.position.copy(pos);
  const orb = blightOrb(0.34, true), wisps = orb.core; // H22: the same blight look as the Whisper's
  g.add(orb.group);
  G.scene.add(g);
  let t = 0;
  G.tickers.push({
    update(dt) {
      t += dt;
      const k = Math.min(1, t / fuse);
      g.scale.setScalar(1 + 0.25 * Math.sin(t * (10 + 20 * k)) + k * 0.5); // pulses faster as it nears
      wisps.rotation.y += dt * 5;
      if (t < fuse) return true;
      onDone?.();
      return false;
    },
    dispose() { G.scene.remove(g); disposeBlightOrb(orb); },
  });
}
