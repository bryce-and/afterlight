// Loot 2.0 (U10) screens: the D2-style weapon inspect (right-click a weapon) with the model turning behind
// the details and only the perks that dropped, and the Exotic Collection (weapons and the class's armor, by tab).
import * as THREE from 'three';
import { G } from './state.js';
import {
  RARITIES, rarityIndex, ELEMENTS, ARCHETYPES, AMMO, PERKS, EXOTIC_PERKS, EXOTIC_WEAPONS, EXOTIC_ARMOR_PERKS, CLASSES,
  PERK_COLUMNS, PERK_COLUMN_NAMES, perksByColumn, exoticArmorFor,
} from './data.js';
import { RARITY_GATE, canUseRarity } from './progression.js';
import { playerLevel } from './save.js';
import { makeExotic, makeArmor } from './loot.js';
import { frameDef, weaponHandling } from './frames.js';
import { buildGunModel } from './models.js';
import { weaponIcon, armorIcon, elementIcon } from './icons.js';
import { sfx } from './audio.js';
import { esc, clamp } from './util.js';

let closeOpen = null; // closes whichever overlay is open

export function overlay(cls) {
  closeOpen?.();
  const el = document.createElement('div');
  el.className = `loot-ov ${cls}`;
  document.body.appendChild(el);
  const onKey = (e) => { if (e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); } };
  addEventListener('keydown', onKey, true);
  const cleanups = [];
  function close() {
    removeEventListener('keydown', onKey, true);
    for (const f of cleanups) f();
    el.remove();
    if (closeOpen === close) closeOpen = null;
  }
  closeOpen = close;
  return { el, close, onClose: (f) => cleanups.push(f) };
}

/** True while the inspect or collection screen is up. */
export const lootScreenOpen = () => !!closeOpen;

// ---------------------------------------------------------------------------
// Inspect
// ---------------------------------------------------------------------------
/** The model behind the inspect screen: the weapon turning slowly; drag to spin it. Returns a dispose function. */
function mountModel(host, item) {
  const rr = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rr.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  rr.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(rr.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x303040, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(RARITIES[rarityIndex(item.rarity)].hex), 1.6);
  rim.position.set(-3, 1, -3);
  scene.add(rim);
  const model = buildGunModel(item);
  model.traverse((o) => { if (o.userData.hand) o.visible = false; });
  if (model.userData.flash) model.userData.flash.visible = false;
  const spin = new THREE.Group();
  spin.add(model);
  scene.add(spin);
  const bb = new THREE.Box3();
  model.traverse((o) => { if (o.isMesh && o.visible && !o.material.transparent) bb.expandByObject(o); });
  const c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3()).length();
  model.position.sub(c);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  const aim = () => { // the weapon sits left of the details panel on wide screens, above it on narrow ones
    const wide = host.clientWidth > 720, a = cam.aspect, k = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)); // view width = k * d * a
    const d = wide ? size / (0.48 * k * a) : Math.max(size / (0.8 * k * a), size * 1.6); // the gun spans ~48% of a wide view
    cam.position.set(wide ? 0.21 * k * d * a : 0, wide ? 0 : -0.22 * k * d, d); // centered in the left part, beside the panel
    cam.lookAt(cam.position.x, cam.position.y, 0);
  };
  // Destiny 2 style: a still, large side profile (muzzle to the right). Dragging turns it; it eases back on release.
  const REST = -Math.PI / 2 + 0.12;
  let yaw = REST, drag = null, raf = 0, last = performance.now();
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; rr.setSize(w, h); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); aim(); };
  resize();
  addEventListener('resize', resize);
  const down = (e) => { drag = e.clientX; host.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (drag === null) return; yaw += (e.clientX - drag) * 0.01; drag = e.clientX; };
  const up = () => { drag = null; };
  host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up);
  const frame = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (drag === null) yaw += (REST - yaw) * Math.min(1, dt * 3);
    spin.rotation.set(0.06, yaw, 0);
    rr.render(scene, cam);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    model.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    rr.dispose();
    rr.domElement.remove();
  };
}

const perkHTML = (d, exo = false) => `<div class="ins-perk${exo ? ' exo' : ''}"><i></i><div><b>${esc(d.name)}</b><span>${esc(d.desc)}</span></div></div>`;

/** Opens the inspect screen for a weapon (also used by the Collection for exotics). */
export function openInspect(item, { note = '', onBack = null, preview = false } = {}) {
  if (item?.kind !== 'weapon') return;
  const { el, close, onClose } = overlay('ins');
  const rar = RARITIES[rarityIndex(item.rarity)], E = ELEMENTS[item.element], am = AMMO[item.slot], fr = frameDef(item);
  const A = weaponHandling(item), st = item.stats, B = ARCHETYPES[item.arch], pel = A.pellets || 1, bp = B.pellets || 1;
  const bar = (label, v, max, txt) => `<div class="ins-stat"><span>${label}</span><i><em style="width:${clamp((v / max) * 100, 3, 100)}%"></em></i><b>${txt}</b></div>`;
  const cols = perksByColumn(item.perks);
  const colHTML = [...Object.keys(PERK_COLUMNS), 'other'].filter((c) => cols[c].length).map((c) => `
    <div class="ins-col"><div class="ins-col-h">${c === 'other' ? 'Other' : PERK_COLUMN_NAMES[c]}</div>${cols[c].map((p) => perkHTML(PERKS[p])).join('')}</div>`).join('');
  const exo = (item.exoticPerks || (item.exotic ? [item.exotic] : [])).map((p) => EXOTIC_PERKS[p] || PERKS[p]).filter(Boolean);
  const level = G.save ? playerLevel(G.save) : 99;
  const gate = preview || canUseRarity(item.rarity, level) ? '' : `<div class="ins-warn">Requires level ${RARITY_GATE[item.rarity]}. Cannot equip. Player level too low.</div>`;
  el.innerHTML = `
    <div class="ins-model" id="ins-model" style="--rc:${rar.color}"></div>
    <div class="ins-panel" style="--rc:${rar.color}">
      <div class="ins-head"><div class="ins-name">${esc(item.name)}</div><div class="ins-type">${rar.name} ${B.name}</div></div>
      <div class="ins-tags">${preview ? '' : `<span class="ins-pow">◆ ${item.power}</span>`}<span style="color:${E.color}">${elementIcon(item.element)}${E.name}</span><span class="ammo-chip" style="--ac:${am.color}"><span class="ammo-ico"></span>${am.name}</span></div>
      ${item.flavor ? `<div class="ins-flavor">${esc(item.flavor)}</div>` : ''}
      ${fr ? `<div class="ins-frame"><span>Archetype</span><b>${fr.name}</b><em>${fr.desc}</em></div>` : ''}
      <div class="ins-stats">
        ${bar('Impact', st.dmg * pel, B.dmg * bp * 1.6, Math.round(st.dmg) + (pel > 1 ? `×${pel}` : ''))}
        ${bar('Rate of Fire', st.rpm, B.rpm * 1.6, st.rpm)}
        ${bar('Magazine', st.mag, B.mag * 1.6, st.mag)}
        ${bar('Reload', 1 / st.reload, (1 / B.reload) * 1.6, `${st.reload.toFixed(1)}s`)}
        ${bar('Range', st.range, B.range * 1.6, `${st.range}m`)}
      </div>
      ${exo.length ? `<div class="ins-exo"><div class="ins-col-h">Exotic</div>${exo.map((d) => perkHTML(d, true)).join('')}</div>` : ''}
      ${colHTML ? `<div class="ins-cols">${colHTML}</div>` : item.rarity === 'common' ? '<div class="ins-none">Common weapons roll no perks.</div>' : ''}
      ${gate}${note ? `<div class="ins-note">${esc(note)}</div>` : ''}
      <div class="ins-foot"><button class="btn" id="ins-close">Back <kbd>Esc</kbd></button><span class="hint">Drag to turn the weapon</span></div>
    </div>`;
  let dispose = null;
  try { dispose = mountModel(el.querySelector('#ins-model'), item); } catch (e) { console.error('Inspect: could not render the weapon model', e); }
  onClose(() => dispose?.());
  if (onBack) onClose(() => setTimeout(onBack, 0)); // e.g. back to the Collection
  el.querySelector('#ins-close').addEventListener('click', () => { sfx.ui(); close(); });
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); close(); });
  sfx.ui();
}

// ---------------------------------------------------------------------------
// Exotic Collection
// ---------------------------------------------------------------------------
let collTab = 'weapons';

/** Opens the Exotic Collection: every exotic weapon, and the current class's exotic armor, found or not. */
export function openCollection() {
  const { el, close } = overlay('coll');
  const s = G.save, found = new Set(s.exoticsFound || []);
  const render = () => {
    const weapons = EXOTIC_WEAPONS.map((tpl) => ({ tpl, item: makeExotic(tpl.name, 1) }));
    const armor = exoticArmorFor(s.classId).map((x) => ({ x, item: makeArmor(x.slot, 1, 4, null, s.classId, x.name) }));
    const list = collTab === 'weapons' ? weapons : armor;
    const nFound = list.filter(({ item }) => found.has(item.name)).length;
    const card = ({ item }) => {
      const have = found.has(item.name);
      const art = item.kind === 'weapon' ? `<img src="${weaponIcon(item)}" alt="" draggable="false">` : armorIcon(item);
      const perk = item.kind === 'weapon' ? EXOTIC_PERKS[item.exotic] : EXOTIC_ARMOR_PERKS[item.name];
      const type = item.kind === 'weapon' ? ARCHETYPES[item.arch].name : { helmet: 'Helmet', arms: 'Arms', chest: 'Chest', legs: 'Legs' }[item.slot];
      return `<button class="coll-card${have ? ' found' : ''}" data-name="${esc(item.name)}" title="${have ? esc(`${perk?.name}: ${perk?.desc}`) : 'Not found yet'}">
        <span class="coll-art">${art}</span>
        <span class="coll-n">${have ? esc(item.name) : 'Undiscovered'}<small>${type}</small></span></button>`;
    };
    el.innerHTML = `
      <div class="coll-box">
        <div class="coll-head"><div><div class="eyebrow">Collections</div><div class="screen-title gold">Exotics</div></div>
          <div class="coll-tabs">
            <button class="coll-tab${collTab === 'weapons' ? ' on' : ''}" data-tab="weapons">Weapons</button>
            <button class="coll-tab${collTab === 'armor' ? ' on' : ''}" data-tab="armor">${CLASSES[s.classId].name} Armor</button>
          </div>
          <div class="coll-count">${nFound} / ${list.length} found</div></div>
        <div class="coll-grid">${list.map(card).join('')}</div>
        <div class="coll-foot"><button class="btn" id="coll-close">Back <kbd>Esc</kbd></button><span class="hint">${collTab === 'weapons' ? 'Click a found weapon to inspect it.  ·  Exotic weapons are shared by every Guardian.' : 'Exotic armor is found per class.'}</span></div>
      </div>`;
    el.querySelectorAll('.coll-tab').forEach((b) => b.addEventListener('click', () => { collTab = b.dataset.tab; sfx.ui(); render(); }));
    el.querySelector('#coll-close').addEventListener('click', () => { sfx.ui(); close(); });
    if (collTab === 'weapons') el.querySelectorAll('.coll-card.found').forEach((b) => b.addEventListener('click', () => {
      const w = weapons.find(({ item }) => item.name === b.dataset.name);
      if (w) openInspect(w.item, { note: 'From your Collection. Exotic weapons have fixed perks.', onBack: openCollection, preview: true });
    }));
  };
  render();
  sfx.ui();
}
