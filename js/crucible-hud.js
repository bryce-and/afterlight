// U25 Crucible: the match HUD (score, timer, zones, kill feed, zone and ally markers) and the end screen. Plain DOM, styled here so no
// stylesheet is touched; everything is removed when the match is left (hideCrucibleHud).
import * as THREE from 'three';
import { G } from './state.js';
import { hasLOS } from './physics.js';
import { killPoints, zonesHeld, DUEL } from './pvp.js';

const TEAM = { blue: '#6ec8ff', red: '#ff6a5a' };
let root = null, el = {}, labels = [], plates = [], styleEl = null, plateCount = 0;
const _p = new THREE.Vector3(), _eye = new THREE.Vector3(), _q = new THREE.Vector3();
const FOE_TAG_RANGE = 60; // m: a foe's name tag shows inside this, in line of sight

const CSS = `
#crucible-hud{position:fixed;inset:0;pointer-events:none;z-index:6;font-family:inherit;color:#eef3f8}
#crucible-hud .cr-top{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#crucible-hud .cr-row{display:flex;align-items:center;gap:14px;background:rgba(10,14,20,.62);border:1px solid rgba(255,255,255,.14);padding:6px 16px;border-radius:4px}
#crucible-hud .cr-score{font-size:28px;font-weight:700;min-width:58px;text-align:center;letter-spacing:.04em}
#crucible-hud .cr-time{font-size:16px;opacity:.9;min-width:52px;text-align:center;font-variant-numeric:tabular-nums}
#crucible-hud .cr-bars{display:flex;gap:6px;width:320px}
#crucible-hud .cr-bar{flex:1;height:4px;background:rgba(255,255,255,.14);position:relative;overflow:hidden}
#crucible-hud .cr-bar i{position:absolute;top:0;bottom:0;left:0;width:0}
#crucible-hud .cr-bar.red i{left:auto;right:0}
#crucible-hud .cr-zones{display:flex;gap:8px}
#crucible-hud .cr-zone{width:34px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;background:rgba(10,14,20,.62);border:2px solid #aaa;position:relative}
#crucible-hud .cr-zone b{position:relative;z-index:1}
#crucible-hud .cr-zone i{position:absolute;left:0;right:0;bottom:0;height:0;opacity:.55}
#crucible-hud .cr-kv{font-size:12px;opacity:.85;letter-spacing:.06em}
#crucible-hud .cr-feed{position:absolute;top:96px;right:18px;display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-size:13px}
#crucible-hud .cr-how{opacity:.85;font-size:12px;color:#d8dde4}
#crucible-hud .cr-feed div{background:rgba(10,14,20,.55);padding:2px 8px;border-radius:3px}
#crucible-hud .cr-lbl{position:absolute;left:0;top:0;font-weight:700;font-size:22px;text-shadow:0 0 6px #000;transform:translate(-50%,-50%);white-space:nowrap}
#crucible-hud .cr-lbl small{display:block;font-size:11px;font-weight:600;opacity:.85;text-align:center}
#crucible-hud .cr-ally.cr-foe{color:#ff8a7a}
#crucible-hud .cr-ally{position:absolute;left:0;top:0;font-size:12px;font-weight:600;color:#6ec8ff;text-shadow:0 0 4px #000;transform:translate(-50%,-100%);white-space:nowrap}
#crucible-end{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(6,9,14,.78);font-family:inherit;color:#eef3f8}
#crucible-end .ce{width:min(560px,92vw);background:rgba(16,22,32,.96);border:1px solid rgba(255,255,255,.18);padding:28px 30px;text-align:center}
#crucible-end h1{margin:0 0 4px;font-size:40px;letter-spacing:.08em}
#crucible-end .ce-sub{opacity:.8;margin-bottom:18px}
#crucible-end .ce-score{display:flex;justify-content:center;gap:34px;font-size:34px;font-weight:700;margin:10px 0 16px}
#crucible-end .ce-rows{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;text-align:left;font-size:14px;margin:0 auto 18px;max-width:380px}
#crucible-end .ce-rows span:nth-child(odd){opacity:.7}
#crucible-end .ce-btns{display:flex;gap:10px;justify-content:center}
#crucible-end button{pointer-events:auto;cursor:pointer;font:inherit;font-weight:600;padding:10px 22px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff}
#crucible-end button.primary{background:#2c7fd0;border-color:#5aa6ee}
`;

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function div(cls, parent, text = '') { const d = document.createElement('div'); d.className = cls; if (text) d.textContent = text; parent.appendChild(d); return d; }

export function showCrucibleHud(M) {
  hideCrucibleHud();
  styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
  root = document.createElement('div'); root.id = 'crucible-hud'; document.body.appendChild(root);
  const top = div('cr-top', root), row = div('cr-row', top);
  el.blue = div('cr-score', row); el.blue.style.color = TEAM.blue;
  el.time = div('cr-time', row);
  el.red = div('cr-score', row); el.red.style.color = TEAM.red;
  const bars = div('cr-bars', top);
  const bb = div('cr-bar blue', bars), rb = div('cr-bar red', bars);
  el.bbar = document.createElement('i'); el.bbar.style.background = TEAM.blue; bb.appendChild(el.bbar);
  el.rbar = document.createElement('i'); el.rbar.style.background = TEAM.red; rb.appendChild(el.rbar);
  const zr = div('cr-zones', top);
  el.zones = M.crucible.zones.map((z) => { const d = div('cr-zone', zr); const f = document.createElement('i'); d.appendChild(f); const b = document.createElement('b'); b.textContent = z.id; d.appendChild(b); return { d, f }; });
  el.kv = div('cr-kv', top);
  el.feed = div('cr-feed', root);
  labels = M.crucible.zones.map((z) => { const d = div('cr-lbl', root); d.innerHTML = `${z.id}<small>${z.name}</small>`; return d; });
  buildPlates(M);
}
/**
 * Every Guardian's name over their head: allies always (blue), foes while you can see them (red, H29). The name is the one the roster gave
 * that Guardian for the whole match, so the tag, the aimed plate and the kill feed always agree. Rebuilt when a human's body joins.
 */
function buildPlates(M) {
  for (const p of plates) p.d.remove();
  plates = M.crucible.guardians.map((g) => {
    const ally = g.team === M.team, d = div(ally ? 'cr-ally' : 'cr-ally cr-foe', root, g.subName && !g.humanId ? `${g.name}  ·  ${g.subName}` : g.name);
    return { g, d, ally, seen: false, losT: Math.random() * 0.2 };
  });
  plateCount = M.crucible.guardians.length;
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const proj = (x, y, z) => { _p.set(x, y, z).project(G.camera); return _p.z < 1 ? [(_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight] : null; };

export function updateCrucibleHud(M) {
  if (!root) return;
  const C = M.crucible;
  if (C.guardians.length !== plateCount) buildPlates(M);
  el.blue.textContent = C.score.blue; el.red.textContent = C.score.red;
  el.time.textContent = fmt(C.timeLeft);
  el.bbar.style.width = `${Math.min(100, (C.score.blue / C.scoreLimit) * 100)}%`;
  el.rbar.style.width = `${Math.min(100, (C.score.red / C.scoreLimit) * 100)}%`;
  C.zones.forEach((z, i) => {
    const e = el.zones[i], col = z.owner ? TEAM[z.owner] : z.prog < 0 ? TEAM.red : z.prog > 0 ? TEAM.blue : '#aaaaaa';
    e.d.style.borderColor = z.owner ? TEAM[z.owner] : '#aaaaaa';
    e.f.style.background = col; e.f.style.height = `${(z.owner ? 1 : Math.abs(z.prog)) * 100}%`;
  });
  const held = zonesHeld(C.zones, M.team);
  el.kv.textContent = C.duel ? `Round ${C.duel.round}${C.duel.phase === 'between' ? '  ·  next round in ' + Math.max(0, Math.ceil(C.duel.t)) : ''}  ·  First to ${DUEL.toWin} rounds` : `Kill ${killPoints(held)} pt${killPoints(held) === 1 ? '' : 's'}  ·  First to ${C.scoreLimit}`;
  // kill feed: the last few kills, fading after 8 s
  const live = C.feed.filter((f) => G.time - f.t < 8);
  const key = live.map((f) => f.t).join(',');
  if (el.feedKey !== key) {
    el.feedKey = key;
    el.feed.innerHTML = live.map((f) => `<div><b style="color:${TEAM[f.kteam]}">${esc(f.killer)}</b> ${f.how ? `<span class="cr-how">[${esc(f.how)}]</span>` : 'eliminated'} <b style="color:${TEAM[f.vteam]}">${esc(f.victim)}</b> <span style="opacity:.7">+${f.pts}</span></div>`).join(''); // U29: the weapon, grenade or super that got the kill
  }
  // zone letters over the map and ally names over their heads
  C.zones.forEach((z, i) => {
    const p = proj(z.x, 12, z.z), d = labels[i];
    d.style.display = p ? 'block' : 'none';
    if (p) { d.style.left = `${p[0].toFixed(0)}px`; d.style.top = `${p[1].toFixed(0)}px`; d.style.color = z.owner ? TEAM[z.owner] : '#eeeeee'; }
  });
  const eye = G.camera.getWorldPosition(_eye), dt = Math.min(0.1, G.time - (el.lastT ?? G.time)); el.lastT = G.time;
  for (const pl of plates) {
    const g = pl.g;
    if (!pl.ally) { // a foe's tag shows only while it is in sight and in range (checked a few times a second)
      pl.losT -= dt;
      if (pl.losT <= 0) { pl.losT = 0.15; pl.seen = g.alive && eye.distanceTo(g.pos) < FOE_TAG_RANGE && hasLOS(eye, _q.set(g.pos.x, g.pos.y + 1.6, g.pos.z)); }
    }
    const p = g.alive && (pl.ally || pl.seen) ? proj(g.pos.x, g.pos.y + 2.7, g.pos.z) : null;
    pl.d.style.display = p ? 'block' : 'none';
    if (p) { pl.d.style.left = `${p[0].toFixed(0)}px`; pl.d.style.top = `${p[1].toFixed(0)}px`; }
  }
}

export function hideCrucibleHud() {
  root?.remove(); styleEl?.remove(); document.getElementById('crucible-end')?.remove();
  root = styleEl = null; el = {}; labels = []; plates = []; plateCount = 0;
}

/** The end screen: winner, score, your numbers, the reward, and two buttons. */
export function showCrucibleEnd(M, r, h) {
  document.getElementById('crucible-end')?.remove();
  const C = M.crucible, box = document.createElement('div');
  box.id = 'crucible-end';
  const title = r.winner === 'draw' ? 'DRAW' : C.spectate ? `${r.winner.toUpperCase()} WINS` : r.won ? 'VICTORY' : 'DEFEAT';
  box.innerHTML = `<div class="ce"><h1 style="color:${r.winner === 'draw' ? '#eeeeee' : r.won ? TEAM.blue : TEAM.red}">${title}</h1>
    <div class="ce-sub">${C.mode.name}  ·  Bannerfall</div>
    <div class="ce-score"><span style="color:${TEAM.blue}">${C.score.blue}</span><span style="opacity:.5">:</span><span style="color:${TEAM.red}">${C.score.red}</span></div>
    ${C.spectate ? '' : `<div class="ce-rows"><span>Eliminations</span><span>${C.stats.kills}</span><span>Deaths</span><span>${C.stats.deaths}</span><span>XP</span><span>+${r.xp}</span><span>Reward</span><span>${r.item ? r.item.name : 'None'}</span></div>`}
    <div class="ce-btns">${h.again ? '<button class="primary" id="ce-again">Play Again</button>' : ''}<button id="ce-orbit">Return to Orbit</button></div>${h.again ? '' : '<div class="ce-sub" style="margin:12px 0 0">The leader starts the next match.</div>'}</div>`;
  document.body.appendChild(box);
  box.querySelector('#ce-again')?.addEventListener('click', () => { box.remove(); h.again(); });
  box.querySelector('#ce-orbit').addEventListener('click', () => { box.remove(); h.orbit(); });
}

