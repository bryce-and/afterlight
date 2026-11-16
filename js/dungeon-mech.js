// U23 "The Emperor's Shadow": the dungeon's interactive objects, built from SHADOW_LAYOUT. The runtime (js/dungeon.js) decides;
// this file only draws and reports. Sigil plates (the four imperial sigils, readable only while you hold Favor), the sigil board
// (the round's order on four faces), the bath water (burns without Favor; dark when a Bather corrupts it), the censers (lowered
// and shootable when a round is done), the chalices Royal Tasters drop, and the north gate.
// Separate from js/mechanics.js (The Whisper's objects), which this file never touches.
import * as THREE from 'three';
import { G } from './state.js';
import { SIGILS, SIGIL_SHAPES, SIGIL_NAMES } from './dungeon-rules.js';

const GOLD = 0xd9a520, PURPLE = 0x6a2c9c, GEM = 0xa060ff, MARBLE = 0xe9e2d2, OK = '#ffd24d', BAD = '#ff3a2a';
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const _w = new THREE.Vector3();

let targets = []; // shootable meshes right now (lowered censers)
/** Read by getHitTargets (game.js). */
export const dungeonTargets = () => targets;
/** An explosion strikes the nearest live censer within its radius (one only). */
export function dungeonSplash(pos, radius) {
  let best = null, bd = Infinity;
  for (const m of targets) { const d = m.getWorldPosition(_w).distanceTo(pos); if (d < radius + 0.8 && d < bd) { bd = d; best = m; } }
  best?.userData.mechShot?.(pos);
}

// ---------- sigils on a canvas: the same parts dungeon-rules.js tests (inSigil) ----------
/** Draws one sigil centred at (cx, cy), `r` pixels to the edge of the [-1, 1] box, with a dark outline. */
export function drawSigil(ctx, name, cx, cy, r, fill) {
  const parts = SIGIL_SHAPES[name];
  ctx.lineJoin = 'round';
  for (const pass of ['stroke', 'fill']) {
    for (const q of parts) {
      ctx.beginPath();
      if (q.c) ctx.arc(cx + q.c[0] * r, cy - q.c[1] * r, q.c[2] * r, 0, Math.PI * 2);
      else q.p.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * r, cy - y * r) : ctx.moveTo(cx + x * r, cy - y * r)));
      ctx.closePath();
      if (pass === 'stroke') { ctx.lineWidth = r * 0.12; ctx.strokeStyle = 'rgba(20,6,30,0.95)'; ctx.stroke(); }
      else { ctx.fillStyle = fill; ctx.fill(); }
    }
  }
}
/** A medallion: a purple gem disc with a gold ring and, when `sigil` is given, the gold sigil on it. */
function drawMedallion(ctx, S, sigil, ring = '#d9a520') {
  const c = S / 2;
  ctx.clearRect(0, 0, S, S);
  const g = ctx.createRadialGradient(c, c * 0.8, S * 0.05, c, c, S * 0.48);
  g.addColorStop(0, '#b47cff'); g.addColorStop(1, '#3a1460');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, S * 0.47, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = S * 0.05; ctx.strokeStyle = ring; ctx.stroke();
  if (sigil) drawSigil(ctx, sigil, c, c, S * 0.32, '#ffd24d');
}
function canvasPanel(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx: canvas.getContext('2d'), tex };
}
const basic = (tex, extra = {}) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, ...extra });
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5, ...o });

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
/** Builds the Baths' objects into the scene. Returns the handle the runtime drives. */
export function buildBaths(seg) {
  const root = new THREE.Group();
  G.scene.add(root);
  const B = { root, seg, plates: [], pools: [], censers: [], chalices: [], board: null, gate: null, plateSigils: SIGILS.slice(), favored: false };

  // the bath water (drawn over the level's gold mosaic discs)
  for (const pl of seg.pools) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x7fd8c8, emissive: 0x2a6a60, emissiveIntensity: 0.4, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CircleGeometry(pl.r, 32).rotateX(-Math.PI / 2), mat);
    m.position.set(pl.p[0], pl.p[1] + 0.06, pl.p[2]);
    root.add(m);
    B.pools.push({ p: v3(pl.p), r: pl.r, mesh: m, corrupt: false, steamT: Math.random() });
  }

  // the plates, each with a floating medallion (blank without Favor) and a strike label
  seg.plates.forEach((p, i) => {
    const g = new THREE.Group();
    g.position.set(p[0], p[1], p[2]);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.18, 24), std(MARBLE, { metalness: 0.1, roughness: 0.6 }));
    base.position.y = 0.09;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.08, 6, 32).rotateX(Math.PI / 2), std(GOLD, { emissive: 0x4a3008, emissiveIntensity: 0.4 }));
    rim.position.y = 0.2;
    const glowMat = new THREE.MeshBasicMaterial({ color: GEM, transparent: true, opacity: 0.35, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24).rotateX(-Math.PI / 2), glowMat);
    glow.position.y = 0.2;
    const med = canvasPanel(256, 256);
    drawMedallion(med.ctx, 256, null);
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), basic(med.tex));
    disc.position.y = 3.2;
    const lab = canvasPanel(256, 96);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.82), basic(lab.tex));
    label.position.y = 5.0; label.visible = false;
    g.add(base, rim, glow, disc, label);
    root.add(g);
    B.plates.push({ i, p: v3(p), group: g, glow, glowMat, med, disc, lab, label, shown: undefined, flashT: 0, flash: null });
  });

  // the board: a four-faced gold frame hanging over the dais
  {
    const g = new THREE.Group();
    g.position.copy(v3(seg.board));
    const panel = canvasPanel(1024, 256);
    const frame = std(GOLD, { emissive: 0x3a2808, emissiveIntensity: 0.4 });
    const W = 7, H = 1.9, D = W / 2 + 0.02;
    const core = new THREE.Mesh(new THREE.BoxGeometry(W, H + 0.3, W), std(0x241830, { metalness: 0.2 }));
    g.add(core);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, H), basic(panel.tex, { side: THREE.FrontSide }));
      face.position.set(Math.sin(a) * D, 0, Math.cos(a) * D); face.rotation.y = a;
      g.add(face);
    }
    for (const y of [-1, 1]) { const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.25, 0.18, W + 0.25), frame); band.position.y = y * (H / 2 + 0.15); g.add(band); }
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8, 5), frame); chain.position.y = H / 2 + 4; g.add(chain);
    root.add(g);
    B.board = { group: g, ...panel, flash: null, flashT: 0 };
  }

  // the censers: gold bowls on chains. Raised and inert until a round is done; then they drop and can be shot.
  seg.censers.forEach((p, i) => {
    const g = new THREE.Group();
    const top = v3(p);
    g.position.copy(top);
    const gold = std(GOLD, { emissive: 0x5a3a08, emissiveIntensity: 0.5 });
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gold);
    const lid = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.9, 8), gold); lid.position.y = 0.45;
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: GEM, transparent: true, opacity: 0.85 }));
    fire.position.y = -0.1;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 5), gold); chain.position.y = 3.6;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    g.add(bowl, lid, fire, chain, hit);
    root.add(g);
    const C = { i, top, low: top.clone().setY(top.y - 8.5), group: g, fire, hit, hp: 0, max: 0, alive: false, lowered: false, y: 0 };
    hit.userData.mechShot = () => B.onCenserShot?.(i);
    B.censers.push(C);
  });

  // the north gate: a gold door filling the opening, raised when open
  if (seg.gate) {
    const { p, w, h } = seg.gate;
    const door = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), std(GOLD, { emissive: 0x2a1a04, emissiveIntensity: 0.3 }));
    door.position.set(p[0], p[1] + h / 2, p[2]);
    root.add(door);
    const box = new THREE.Box3().setFromObject(door);
    const col = { min: { x: box.min.x, y: box.min.y, z: box.min.z }, max: { x: box.max.x, y: box.max.y, z: box.max.z } };
    G.colliders.push(col);
    G.staticMeshes.push(door);
    G.hitDirty = true;
    B.gate = { door, col, open: false, y0: door.position.y, h };
  }
  return B;
}

export function disposeDungeonMech(B) {
  if (!B) return;
  G.scene?.remove(B.root);
  B.root.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  if (B.gate && G.colliders) { const k = G.colliders.indexOf(B.gate.col); if (k >= 0) G.colliders.splice(k, 1); const j = G.staticMeshes?.indexOf(B.gate.door) ?? -1; if (j >= 0) G.staticMeshes.splice(j, 1); }
  for (const c of B.chalices) G.scene?.remove(c.group);
  targets = [];
}

// ---------------------------------------------------------------------------
// State setters (the runtime calls these on the host, solo and members alike)
// ---------------------------------------------------------------------------
/** Draws the board: done steps gold, the next white, the rest dim; a flash tints the frame. */
export function drawOrder(B, round) {
  const { canvas, ctx, tex } = B.board, W = canvas.width, H = canvas.height;
  const fl = B.board.flashT > 0 ? B.board.flash : null;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = fl === 'bad' ? 'rgba(70,8,12,0.9)' : fl === 'ok' ? 'rgba(70,52,8,0.9)' : 'rgba(26,12,38,0.88)'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = fl === 'bad' ? BAD : fl === 'ok' ? OK : '#d9a520'; ctx.lineWidth = fl ? 18 : 10; ctx.strokeRect(8, 8, W - 16, H - 16);
  const n = round ? round.order.length : 0;
  if (!n) { tex.needsUpdate = true; return; }
  const r = Math.min(H * 0.36, (W / n) * 0.36);
  round.order.forEach((sg, k) => drawSigil(ctx, sg, ((k + 0.5) / n) * W, H / 2, r, k < round.progress ? '#ffd24d' : k === round.progress ? '#ffffff' : 'rgba(255,255,255,0.32)'));
  tex.needsUpdate = true;
}
export function flashOrder(B, kind, round) { B.board.flash = kind; B.board.flashT = 0.7; drawOrder(B, round); }

/** Which sigil each plate carries (a permutation of SIGILS). */
export function setPlateSigils(B, list) { B.plateSigils = list.slice(); for (const P of B.plates) P.shown = undefined; }

/** Shows or hides the sigils on the plates for the local player (only while Favored). */
function refreshPlate(B, P) {
  const want = B.favored ? B.plateSigils[P.i] : null;
  if (P.shown === want && !P.flashT) return;
  P.shown = want;
  drawMedallion(P.med.ctx, 256, want, P.flashT > 0 ? (P.flash === 'bad' ? BAD : OK) : '#d9a520');
  P.med.tex.needsUpdate = true;
}
/** A right or wrong offering on a plate: the ring flashes and the plate glows gold or red. */
export function flashPlate(B, i, kind) {
  const P = B.plates[i];
  P.flash = kind; P.flashT = 0.8; P.shown = undefined;
  P.glowMat.color.setHex(kind === 'bad' ? 0xff3a2a : 0xffd24d); P.glowMat.opacity = 0.8;
}
/** The local player's strikes on a plate ("1 of 3"), or 0 to hide. */
export function setStrikeLabel(B, i, n, limit) {
  const P = B.plates[i], { ctx, canvas, tex } = P.lab;
  P.label.visible = n > 0;
  if (!n) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(40,6,10,0.8)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = BAD;
  ctx.fillText(`${n} of ${limit}`, canvas.width / 2, canvas.height / 2 + 2);
  tex.needsUpdate = true;
}
export function setPoolCorrupt(B, i, on) {
  const P = B.pools[i];
  P.corrupt = on;
  P.mesh.material.color.setHex(on ? 0x3a0a4a : 0x7fd8c8);
  P.mesh.material.emissive.setHex(on ? 0x5a0a6a : 0x2a6a60);
  B.plates[i].group.visible = true;
  B.plates[i].glowMat.color.setHex(on ? 0x1a0a20 : GEM);
}
/** Lowers (and arms) or raises the censers. */
export function setCensers(B, lowered, hits = 1) {
  for (const C of B.censers) { C.lowered = lowered; C.alive = lowered; C.max = hits; C.hp = lowered ? hits : 0; C.group.visible = true; C.fire.visible = true; }
  rebuildTargets(B);
}
export function setCenserHp(B, i, hp) {
  const C = B.censers[i];
  C.hp = Math.max(0, hp);
  if (C.hp <= 0 && C.alive) { C.alive = false; C.fire.visible = false; }
  rebuildTargets(B);
}
/** Opens (the door rises, the way is clear at once) or closes the north gate. */
export function setGate(B, open) {
  const g = B.gate;
  if (!g || g.open === open) return;
  g.open = open;
  const k = G.colliders.indexOf(g.col), j = G.staticMeshes.indexOf(g.door);
  if (open) { if (k >= 0) G.colliders.splice(k, 1); if (j >= 0) G.staticMeshes.splice(j, 1); }
  else { if (k < 0) G.colliders.push(g.col); if (j < 0) G.staticMeshes.push(g.door); g.door.position.y = g.y0; }
  G.hitDirty = true;
}
export function rebuildTargets(B) { targets = B.censers.filter((c) => c.alive && c.lowered).map((c) => c.hit); G.hitDirty = true; }

// ---------- chalices ----------
export function addChalice(B, id, pos) {
  const g = new THREE.Group();
  g.position.copy(pos);
  const gold = std(GOLD, { emissive: 0x7a5010, emissiveIntensity: 0.8 });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.3, 10), gold); cup.position.y = 0.75;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6), gold); stem.position.y = 0.45;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 10), gold); foot.position.y = 0.27;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc247, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 3;
  g.add(cup, stem, foot, beam);
  G.scene.add(g);
  B.chalices.push({ id, pos: pos.clone(), group: g, t: 0 });
}
export function removeChalice(B, id) {
  const k = B.chalices.findIndex((c) => c.id === id);
  if (k < 0) return;
  G.scene.remove(B.chalices[k].group);
  B.chalices.splice(k, 1);
}

// ---------------------------------------------------------------------------
// Per frame (everyone): medallions face the camera, flashes fade, censers move, the gate slides, chalices bob.
// ---------------------------------------------------------------------------
export function updateDungeonMech(B, dt, favored, round) {
  B.favored = favored;
  const cam = G.camera;
  for (const P of B.plates) {
    if (P.flashT > 0) { P.flashT -= dt; if (P.flashT <= 0) { P.flashT = 0; P.glowMat.color.setHex(B.pools[P.i]?.corrupt ? 0x1a0a20 : GEM); P.glowMat.opacity = 0.35; P.shown = undefined; } }
    refreshPlate(B, P);
    if (cam) { const wp = P.group.position; P.disc.rotation.y = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z); P.label.rotation.y = P.disc.rotation.y; }
  }
  if (B.board.flashT > 0) { B.board.flashT -= dt; if (B.board.flashT <= 0) drawOrder(B, round); }
  for (const C of B.censers) {
    const goal = C.lowered ? 1 : 0;
    C.y += Math.sign(goal - C.y) * Math.min(Math.abs(goal - C.y), dt * 0.6);
    C.group.position.lerpVectors(C.top, C.low, C.y);
    C.group.rotation.y += dt * 0.4;
  }
  if (B.gate) {
    const d = B.gate.door, goal = B.gate.y0 + (B.gate.open ? B.gate.h : 0);
    if (Math.abs(d.position.y - goal) > 0.01) d.position.y += Math.sign(goal - d.position.y) * Math.min(Math.abs(goal - d.position.y), dt * 3);
  }
  for (const c of B.chalices) { c.t += dt; c.group.rotation.y += dt * 1.5; c.group.children[0].position.y = 0.75 + Math.sin(c.t * 3) * 0.05; }
}

/** The plate the position stands on (index), or -1. */
export function plateAt(B, pos) {
  for (const P of B.plates) if (Math.hypot(pos.x - P.p.x, pos.z - P.p.z) < 1.8 && Math.abs(pos.y - P.p.y) < 1.2) return P.i;
  return -1;
}
/** The pool the position is in (index), or -1. */
export function poolAt(B, pos) {
  for (let i = 0; i < B.pools.length; i++) { const P = B.pools[i]; if (Math.hypot(pos.x - P.p.x, pos.z - P.p.z) < P.r && Math.abs(pos.y - P.p.y) < 1.2) return i; }
  return -1;
}
export const sigilLabel = (s) => SIGIL_NAMES[s];
