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
import { GLYPH_SYMBOLS } from './exotic-rules.js';

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

// ---------- canvas sprites (glyph symbols and the glyph board) ----------
function symbolTexture(sym, color = '#7ffff0') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(8,14,16,0.7)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
  x.strokeStyle = color; x.lineWidth = 6; x.stroke();
  x.fillStyle = color; x.font = 'bold 76px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(GLYPH_SYMBOLS[sym], 64, 70);
  const t = new THREE.CanvasTexture(c);
  return t;
}
function makeSprite(tex, w, h) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(w, h, 1);
  return s;
}

/** Draws a glyph board: the symbols in order, done ones teal, the next one white, the rest dim. Returns nothing; call again to update. */
export function drawBoard(board, puzzle) {
  const { canvas, ctx, tex } = board;
  const n = puzzle ? puzzle.order.length : 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(8,14,16,0.72)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#d9b36a'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.font = 'bold 84px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let k = 0; k < n; k++) {
    const x = ((k + 0.5) / n) * canvas.width;
    ctx.fillStyle = k < puzzle.progress ? '#3affd8' : k === puzzle.progress ? '#ffffff' : 'rgba(255,255,255,0.35)';
    ctx.fillText(GLYPH_SYMBOLS[puzzle.symbols[puzzle.order[k]]], x, canvas.height / 2 + 6);
  }
  tex.needsUpdate = true;
}
function makeBoard(p, w) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 160;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = makeSprite(tex, w, w / 4);
  sprite.position.copy(p);
  return { canvas, ctx: canvas.getContext('2d'), tex, sprite };
}

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
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), new THREE.MeshStandardMaterial({ color: 0x07060a, emissive: 0x2a1040, emissiveIntensity: 0.9, flatShading: true, roughness: 0.4 }));
  const wisps = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.8, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const a = (k / 5) * Math.PI * 2;
    w.position.set(Math.cos(a) * 0.8, 0.2, Math.sin(a) * 0.8);
    wisps.add(w);
  }
  const hit = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  const ground = new THREE.Mesh(new THREE.RingGeometry(aura - 0.15, aura, 40), new THREE.MeshBasicMaterial({ color: 0xcfc8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.55; // the orb hangs about 1.6 m over the floor
  g.add(core, wisps, hit, ground);
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

// ---------- the whole set ----------
/**
 * Builds every mechanic of a layout into the scene. `cfg`: { blightRadius, blightHits }.
 * `mech.onShot(kind, seg, i, point)` is set by the runtime; shots on eyes and blights arrive there.
 */
export function buildMechanics(layout, cfg) {
  const root = new THREE.Group();
  root.name = 'mechanics';
  G.scene.add(root);
  const mech = { root, segs: [], attuned: false, attuneLeft: 0, onShot: null, cfg, time: 0 };
  layout.segments.forEach((seg, si) => {
    const S = { id: seg.id, kind: seg.kind, index: si, spec: seg, conduits: [], eyes: [], blocks: [], blights: [], gate: null, board: null, puzzle: null, active: false, done: false, blightsOn: false };
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
    if (seg.gate) {
      S.gate = buildGate(seg.gate);
      root.add(S.gate.group);
      G.colliders.push(S.gate.col);
      G.staticMeshes.push(S.gate.slab);
    }
    if (seg.glyph) {
      S.board = makeBoard(v3(seg.glyph), seg.kind === 'boss' ? 5 : 4);
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
    for (const b of S.blocks) { const i = G.colliders.indexOf(b.col); if (i >= 0) G.colliders.splice(i, 1); }
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
    e.sym = makeSprite(symbolTexture(sym), 0.5, 0.5);
    e.sym.userData.sym = sym;
    e.sym.position.set(0, 0.85, 0.15);
    e.group.add(e.sym);
  });
  if (S.board) drawBoard(S.board, puzzle);
}
export function refreshBoard(S) { if (S.board && S.puzzle) drawBoard(S.board, S.puzzle); }

/** 0: dark socket, 1: shot correctly (stays lit), 2: wrong (red flash that fades back to 0). */
export function setEyeLit(S, i, v) {
  const e = S.eyes[i];
  e.lit = v;
  e.flashT = v === 2 ? 0.7 : 0;
  e.iris.material = v === 2 ? mat(0xff3a2a, { emissive: 0xff3a2a, emissiveIntensity: 2 }) : v === 1 ? mat(0xffffff, { emissive: 0xaafff0, emissiveIntensity: 2.4 }) : mat(TEAL, { emissive: TEAL, emissiveIntensity: 1.9 });
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

/** The shootable meshes: eyes of the active segment while Attuned, and live blights that are switched on. */
export function rebuildTargets(mech) {
  const out = [];
  for (const S of mech.segs) {
    if (!S.active) continue;
    if (mech.attuned) for (const e of S.eyes) out.push(e.hit);
    for (const b of S.blights) if (b.on && b.alive) out.push(b.hit);
  }
  targets = out;
  G.hitDirty = true;
}

/** True when an eye is lit-locked or otherwise inert; the runtime decides, this is only the player-facing marker. */
export function eyesVisible(mech) { return mech.attuned; }

// ---------- per frame ----------
const _d = new THREE.Vector3();
/**
 * Animates everything and applies this machine's Attuned. `P`: the local player. Returns 'attuned', 'faded' or null on a change.
 * Co-op: every machine runs this for its own player; the lit state of conduits and the blights come from the host (setConduitLit, setBlightHp).
 */
export function updateMech(mech, dt, P) {
  mech.time += dt;
  const t = mech.time, cfg = mech.cfg;
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
  const now = !!P && !P.dead && P.status.has('attuned');
  mech.attuneLeft = now ? P.status.remaining('attuned') : 0;
  let ev = null;
  if (now !== mech.attuned) {
    mech.attuned = now;
    ev = now ? 'attuned' : 'faded';
    rebuildTargets(mech);
  }
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
      if (e.flashT > 0) { e.flashT -= dt; if (e.flashT <= 0) setEyeLit(S, e.i, 0); }
    }
    for (const bl of S.blocks) {
      bl.col.pass = !now; // solid only for an Attuned player: colliders are this machine's own list
      bl.mesh.material.opacity = now ? 0.4 * blink : 0.12;
      bl.edges.material.opacity = now ? 0.95 * blink : 0.4;
    }
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
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: 0x07060a, emissive: 0x2a1040, emissiveIntensity: 1, flatShading: true }));
  const wisps = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const a = (k / 5) * Math.PI * 2;
    w.position.set(Math.cos(a) * 0.32, 0.12, Math.sin(a) * 0.32);
    wisps.add(w);
  }
  g.add(core, wisps);
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
    dispose() { G.scene.remove(g); g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); },
  });
}
