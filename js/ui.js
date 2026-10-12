import * as THREE from 'three';
import { G, lockPointer, unlockPointer } from './state.js';
import { LOCATIONS, CLASSES, RARITIES, ELEMENTS, ARCHETYPES, PERKS, EXOTIC_PERKS, SLOTS, WEAPON_SLOTS, ARMOR_SLOTS, SLOT_NAMES, CONTROLS, AMMO, rarityIndex } from './data.js';
import { playerPower, getEquipped, getItem, equipItem, dismantleItem, infuseInfo, infuseItem, isEquipped, isUnlocked, createSave, writeSave, resetSave, INVENTORY_CAP } from './save.js';
import { dismantleValue } from './loot.js';
import { startMission, retryMission, abandonMission } from './game.js';
import { initAudio, setVolume, sfx } from './audio.js';
import { esc, clamp } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SCREENS = ['title', 'classes', 'orbit', 'pause', 'complete', 'failed'];
const _p = new THREE.Vector3();

function showOnly(...ids) {
  for (const id of SCREENS) $('#' + id).classList.toggle('hidden', !ids.includes(id));
  $('#hud').classList.toggle('hidden', !ids.includes('hud'));
}

export function initUI() {
  $('#title').addEventListener('click', () => {
    initAudio();
    sfx.ui();
    if (G.save) showOrbit(); else showClassSelect();
  });
}

// ---------------------------------------------------------------------------
// Title & class select
// ---------------------------------------------------------------------------
export function showTitle() {
  G.state = 'title';
  showOnly('title');
  G.menu.setLocation(LOCATIONS[0]);
  G.menu.setOffset(4.4);
  $('#title .t-hint').textContent = G.save ? 'Click to continue' : 'Click to begin';
}

export function showClassSelect(fromOrbit = false) {
  G.state = 'classes';
  showOnly('classes');
  G.menu.setOffset(0);
  const el = $('#classes');
  el.innerHTML = `
    <div class="cls-wrap">
      <div class="eyebrow">${fromOrbit ? 'Change class (gear is shared)' : 'Choose your class'}</div>
      <h1 class="screen-title">Who will you be?</h1>
      <div class="cls-grid">
        ${Object.values(CLASSES).map((c) => `
          <button class="cls-card" data-cls="${c.id}" style="--cc:${c.color}">
            <div class="cls-el">${ELEMENTS[c.element].name}  ·  ${c.subclass}</div>
            <div class="cls-name">${c.name}</div>
            <div class="cls-tag">${c.tagline}</div>
            <ul class="cls-abs">
              ${['grenade', 'melee', 'class', 'super'].map((k) => `<li><b>${c.abilities[k].name}</b><span>${c.abilities[k].desc}</span></li>`).join('')}
              <li><b>${c.jumpName}</b><span>Movement ability</span></li>
            </ul>
            <div class="cls-pick">Select</div>
          </button>`).join('')}
      </div>
      ${fromOrbit ? '<button class="btn ghost" id="cls-back">Back</button>' : ''}
    </div>`;
  $$('.cls-card', el).forEach((b) => b.addEventListener('click', () => {
    sfx.ui();
    if (G.save) { G.save.classId = b.dataset.cls; writeSave(G.save); }
    else G.save = createSave(b.dataset.cls);
    showOrbit();
  }));
  $('#cls-back', el)?.addEventListener('click', () => showOrbit());
}

// ---------------------------------------------------------------------------
// Orbit (director / inventory / character)
// ---------------------------------------------------------------------------
let orbitTab = 'director', selLoc = null, selMission = null, invSlot = 'primary', invSel = null;

export function showOrbit(tab) {
  G.state = 'orbit';
  if (tab) orbitTab = tab;
  showOnly('orbit');
  setVolume(G.save.settings.volume);
  if (selLoc === null) {
    let last = 0;
    LOCATIONS.forEach((l, li) => { if (isUnlocked(G.save, li, 0)) last = li; });
    selLoc = last;
  }
  renderOrbit();
}

function renderOrbit() {
  const s = G.save;
  const cls = CLASSES[s.classId];
  const newCount = s.inventory.filter((i) => i.isNew).length;
  $('#orbit').innerHTML = `
    <header class="topbar">
      <div class="brand">AFTERLIGHT</div>
      <nav class="tabs">
        ${['director', 'inventory', 'character'].map((t) => `<button class="tab ${orbitTab === t ? 'on' : ''}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}${t === 'inventory' && newCount ? `<span class="badge">${newCount}</span>` : ''}</button>`).join('')}
      </nav>
      <div class="pstats">
        <span class="cls-chip" style="--cc:${cls.color}">${cls.name}</span>
        <span class="power">◆ ${playerPower(s)}</span>
        <span class="glimmer" title="Glimmer">⬡ ${s.glimmer.toLocaleString()}</span>
      </div>
    </header>
    <main id="orbit-main" class="tab-${orbitTab}"></main>`;
  $$('.tab').forEach((b) => b.addEventListener('click', () => { sfx.ui(); orbitTab = b.dataset.tab; renderOrbit(); }));
  const main = $('#orbit-main');
  if (orbitTab === 'director') renderDirector(main);
  else if (orbitTab === 'inventory') renderInventory(main);
  else renderCharacter(main);
}

function renderDirector(main) {
  const s = G.save;
  const loc = LOCATIONS[selLoc];
  G.menu.setLocation(loc);
  G.menu.setOffset(4.4);
  const missions = loc.missions;
  if (selMission === null || !isUnlocked(s, selLoc, selMission)) {
    selMission = missions.findIndex((m, mi) => isUnlocked(s, selLoc, mi) && !s.cleared[m.id]);
    if (selMission < 0) selMission = missions.reduce((acc, m, mi) => (isUnlocked(s, selLoc, mi) ? mi : acc), -1);
  }
  const pp = playerPower(s);
  const m = missions[selMission];
  const diff = m ? pp - m.power : 0;
  main.innerHTML = `
    <div class="director">
      <aside class="loc-list">
        <div class="eyebrow">Destinations</div>
        ${LOCATIONS.map((l, i) => {
          const un = isUnlocked(s, i, 0);
          const done = l.missions.filter((mm) => s.cleared[mm.id]).length;
          return `<button class="loc ${i === selLoc ? 'sel' : ''} ${un ? '' : 'locked'}" data-loc="${i}" ${un ? '' : 'disabled'}>
            <div class="loc-planet">${l.planetName}</div><div class="loc-name">${l.name}</div>
            <div class="loc-prog">${un ? `${done}/3 cleared` : 'Locked'}</div></button>`;
        }).join('')}
      </aside>
      <section class="loc-detail">
        <div class="eyebrow">${loc.planetName}  ·  ${loc.faction}</div>
        <h1 class="screen-title">${loc.name}</h1>
        <p class="desc">${loc.desc}</p>
        <div class="missions">
          ${missions.map((mm, mi) => {
            const un = isUnlocked(s, selLoc, mi), cl = s.cleared[mm.id];
            return `<button class="mission ${selMission === mi ? 'sel' : ''} ${un ? '' : 'locked'}" data-m="${mi}" ${un ? '' : 'disabled'}>
              <div class="m-top"><span class="m-name">${mm.name}</span><span class="m-power">◆ ${mm.power}</span></div>
              <div class="m-desc">${un ? mm.desc : 'Clear the previous mission to unlock.'}</div>
              <div class="m-foot">${cl ? '<span class="tag done">Cleared</span>' : un ? '<span class="tag new">New</span>' : '<span class="tag">Locked</span>'}
                <span class="m-boss">Boss: ${mm.boss.name}</span>${mi === 2 && !cl ? '<span class="tag exo">Exotic on first clear</span>' : ''}</div>
            </button>`;
          }).join('')}
        </div>
        <div class="launch-row">
          <div class="power-cmp">Your Power <b>◆ ${pp}</b>${m ? (diff < -4 ? `<span class="warn">Underpowered by ${-diff}</span>` : diff >= 0 ? '<span class="ok">Ready</span>' : '<span class="meh">Slightly under</span>') : ''}</div>
          <button id="launch" class="btn primary" ${m ? '' : 'disabled'}>Launch</button>
        </div>
      </section>
    </div>`;
  $$('.loc', main).forEach((b) => b.addEventListener('click', () => { sfx.ui(); selLoc = +b.dataset.loc; selMission = null; renderOrbit(); }));
  $$('.mission', main).forEach((b) => b.addEventListener('click', () => { sfx.ui(); selMission = +b.dataset.m; renderOrbit(); }));
  $('#launch', main)?.addEventListener('click', () => {
    initAudio();
    lockPointer();
    startMission(selLoc, selMission);
  });
}

function typeLine(it) {
  if (it.kind === 'weapon') return `${ARCHETYPES[it.arch].name}`;
  return SLOT_NAMES[it.slot];
}

function itemCard(it, { equipped = false, selected = false, compact = false } = {}) {
  const rar = RARITIES[rarityIndex(it.rarity)];
  const el = it.kind === 'weapon' ? ELEMENTS[it.element] : null;
  return `<div class="item r-${it.rarity} ${selected ? 'sel' : ''} ${compact ? 'compact' : ''}" data-id="${it.id}" style="--rc:${rar.color}">
    <div class="it-top">${el ? `<span class="el" style="background:${el.color}" title="${el.name}"></span>` : ''}<span class="it-name">${esc(it.name)}</span></div>
    <div class="it-sub">${rar.name} ${typeLine(it)}</div>
    <div class="it-power">◆ ${it.power}${it.kind === 'weapon' ? `<span class="ammo-ico" style="--ac:${AMMO[it.slot].color}" title="${AMMO[it.slot].name} ammo"></span>` : ''}</div>
    ${it.isNew ? '<span class="new-dot">New</span>' : ''}${equipped ? '<span class="eq">Equipped</span>' : ''}
  </div>`;
}

function statBar(label, val, max, text) {
  const pct = clamp((val / max) * 100, 2, 100);
  return `<div class="stat"><span class="s-l">${label}</span><span class="s-bar"><i style="width:${pct}%"></i></span><span class="s-v">${text ?? val}</span></div>`;
}

function itemDetail(it) {
  const s = G.save;
  const rar = RARITIES[rarityIndex(it.rarity)];
  const eq = getEquipped(s, it.slot);
  const delta = eq && eq !== it ? it.power - eq.power : 0;
  let body = '';
  if (it.kind === 'weapon') {
    const A = ARCHETYPES[it.arch];
    const st = it.stats;
    const el = ELEMENTS[it.element];
    const am = AMMO[it.slot];
    body += `<div class="d-el"><span style="color:${el.color}">${el.name}</span>  ·  <span class="ammo-chip" style="--ac:${am.color}"><span class="ammo-ico"></span>${am.name} Ammo</span></div>`;
    body += '<div class="stats">';
    body += statBar('Impact', st.dmg * (A.pellets || 1), A.dmg * (A.pellets || 1) * 1.6, Math.round(st.dmg) + (A.pellets ? ` x${A.pellets}` : ''));
    body += statBar('Rate of Fire', st.rpm, A.rpm * 1.6, `${st.rpm} rpm`);
    body += statBar('Magazine', st.mag, A.mag * 1.6, st.mag);
    body += statBar('Reload', 1 / st.reload, (1 / A.reload) * 1.6, `${st.reload.toFixed(1)}s`);
    body += statBar('Range', st.range, A.range * 1.6, `${st.range}m`);
    body += statBar('Stability', 1 / st.spread, (1 / A.spread) * 1.6, Math.round(50 * (A.spread / st.spread)));
    body += '</div>';
    const perks = [];
    if (it.exotic) perks.push(`<div class="perk exo"><b>${EXOTIC_PERKS[it.exotic].name}</b><span>${EXOTIC_PERKS[it.exotic].desc}</span></div>`);
    for (const p of it.perks) perks.push(`<div class="perk"><b>${PERKS[p].name}</b><span>${PERKS[p].desc}</span></div>`);
    body += perks.length ? `<div class="perks">${perks.join('')}</div>` : '<div class="perks none">No perks</div>';
    if (it.flavor) body += `<div class="flavor">${esc(it.flavor)}</div>`;
  } else {
    const st = it.stats;
    body += `<div class="d-el">${SLOT_NAMES[it.slot]}</div><div class="stats">`;
    body += statBar('Mobility', st.mob, 12);
    body += statBar('Resilience', st.res, 12);
    body += statBar('Recovery', st.rec, 12);
    body += `</div><div class="perks none">Total ${st.mob + st.res + st.rec}</div>`;
  }
  const inf = infuseInfo(s, it);
  const equipped = isEquipped(s, it);
  return `<div class="detail" style="--rc:${rar.color}">
    <div class="d-head"><div class="d-rar">${rar.name} ${typeLine(it)}</div><div class="d-name">${esc(it.name)}</div>
      <div class="d-power">◆ ${it.power}${delta ? `<span class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}</span>` : ''}</div></div>
    ${body}
    <div class="d-actions">
      <button class="btn primary" data-act="equip" ${equipped ? 'disabled' : ''}>${equipped ? 'Equipped' : 'Equip'}</button>
      <button class="btn" data-act="infuse" ${inf.possible && s.glimmer >= inf.cost ? '' : 'disabled'} title="Raise this item's power to the highest you own in this slot">Infuse to ◆${inf.target} (⬡${inf.cost})</button>
      <button class="btn danger" data-act="dismantle" ${equipped ? 'disabled' : ''}>Dismantle (+⬡${dismantleValue(it)})</button>
    </div>
  </div>`;
}

function renderInventory(main) {
  const s = G.save;
  G.menu.setOffset(9);
  const rIdx = (x) => rarityIndex(x.rarity);
  const items = s.inventory.filter((i) => i.slot === invSlot).sort((a, b) => (isEquipped(s, b) - isEquipped(s, a)) || b.power - a.power || rIdx(b) - rIdx(a));
  if (!invSel || !getItem(s, invSel) || getItem(s, invSel).slot !== invSlot) invSel = s.equipped[invSlot];
  const sel = getItem(s, invSel);
  main.innerHTML = `
    <div class="inventory">
      <aside class="slots">
        <div class="eyebrow">Weapons</div>
        ${WEAPON_SLOTS.map((sl) => slotBtn(sl)).join('')}
        <div class="eyebrow" style="margin-top:14px">Armor</div>
        ${ARMOR_SLOTS.map((sl) => slotBtn(sl)).join('')}
        <div class="inv-count">${s.inventory.length} / ${INVENTORY_CAP} items</div>
      </aside>
      <section class="grid-wrap">
        <div class="eyebrow">${SLOT_NAMES[invSlot]}  ·  ${items.length} items</div>
        <div class="grid">${items.map((it) => itemCard(it, { equipped: isEquipped(s, it), selected: it.id === invSel })).join('')}</div>
      </section>
      <section class="detail-wrap">${sel ? itemDetail(sel) : ''}</section>
    </div>`;
  function slotBtn(sl) {
    const it = getEquipped(s, sl);
    const hasNew = s.inventory.some((i) => i.slot === sl && i.isNew);
    return `<button class="slot ${sl === invSlot ? 'on' : ''}" data-slot="${sl}"><span class="sl-name">${SLOT_NAMES[sl]}${hasNew ? '<i class="dot"></i>' : ''}</span>${it ? itemCard(it, { compact: true }) : ''}</button>`;
  }
  $$('.slot', main).forEach((b) => b.addEventListener('click', () => { sfx.ui(); invSlot = b.dataset.slot; invSel = null; renderOrbit(); }));
  $$('.grid .item', main).forEach((b) => b.addEventListener('click', () => {
    sfx.ui();
    invSel = b.dataset.id;
    const it = getItem(s, invSel);
    if (it.isNew) { it.isNew = false; writeSave(s); }
    renderOrbit();
  }));
  $$('.grid .item', main).forEach((b) => b.addEventListener('dblclick', () => { equipItem(s, b.dataset.id); renderOrbit(); }));
  $$('.d-actions .btn', main).forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'equip') { equipItem(s, invSel); sfx.engram(1); }
    else if (act === 'dismantle') { dismantleItem(s, invSel); invSel = null; sfx.ui(); }
    else if (act === 'infuse') { if (infuseItem(s, invSel)) sfx.engram(3); }
    renderOrbit();
  }));
}

function renderCharacter(main) {
  const s = G.save;
  G.menu.setOffset(4.4);
  const cls = CLASSES[s.classId];
  const st = { ...cls.base };
  for (const sl of ARMOR_SLOTS) { const it = getEquipped(s, sl); if (it) { st.mob += it.stats.mob; st.res += it.stats.res; st.rec += it.stats.rec; } }
  main.innerHTML = `
    <div class="character">
      <section class="char-main" style="--cc:${cls.color}">
        <div class="eyebrow">${ELEMENTS[cls.element].name}  ·  ${cls.subclass}</div>
        <h1 class="screen-title">${cls.name}</h1>
        <p class="desc">${cls.tagline}</p>
        <div class="stats big">
          ${statBar('Mobility', st.mob, 40, `${st.mob}  (+${Math.round(st.mob * 1.2)}% speed)`)}
          ${statBar('Resilience', st.res, 40, `${st.res}  (${Math.round(55 + st.res * 3)} shield)`)}
          ${statBar('Recovery', st.rec, 40, `${st.rec}  (${clamp(4.6 - st.rec * 0.1, 1.6, 4.6).toFixed(1)}s regen delay)`)}
        </div>
        <div class="abil-list">
          ${[['grenade', 'Q'], ['melee', 'F'], ['class', 'C'], ['super', 'X']].map(([k, key]) => `<div class="abil-row"><kbd>${key}</kbd><div><b>${cls.abilities[k].name}</b><span>${cls.abilities[k].desc}${cls.abilities[k].cd ? `  ·  ${cls.abilities[k].cd}s cooldown` : ''}</span></div></div>`).join('')}
          <div class="abil-row"><kbd>Space</kbd><div><b>${cls.jumpName}</b><span>Class movement</span></div></div>
        </div>
        <div class="row-btns">
          <button class="btn" id="change-class">Change Class</button>
          <button class="btn danger" id="reset-save">Reset Save</button>
        </div>
      </section>
      <section class="controls-card">
        <div class="eyebrow">Controls</div>
        ${CONTROLS.map(([k, v]) => `<div class="ctl"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}
        <div class="eyebrow" style="margin-top:16px">Tips</div>
        <p class="tip">Headshots deal precision damage (yellow numbers). Match your weapon element to an enemy's shield color to break it 2.5x faster. Engrams drop from enemies; boss caches drop guaranteed rare-or-better gear.</p>
      </section>
    </div>`;
  $('#change-class').addEventListener('click', () => showClassSelect(true));
  $('#reset-save').addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Click again to delete everything'; return; }
    resetSave();
    G.save = null;
    selLoc = null; selMission = null;
    showClassSelect();
  });
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const hud = {};
const cache = new Map();
function setText(el, key, txt) { if (cache.get(key) !== txt) { cache.set(key, txt); el.textContent = txt; } }
function setStyle(el, key, prop, val) {
  const k = key + prop;
  if (cache.get(k) === val) return;
  cache.set(k, val);
  if (prop.startsWith('--')) el.style.setProperty(prop, val); else el.style[prop] = val;
}
function setClass(el, key, cls, on) { const k = key + cls; if (cache.get(k) !== on) { cache.set(k, on); el.classList.toggle(cls, on); } }

export function enterMission() {
  showOnly('hud');
  cache.clear();
  const P = G.player;
  hud.shield = $('#vitals .shield-fill'); hud.health = $('#vitals .health-fill'); hud.revives = $('#revives');
  hud.objLoc = $('#objective .obj-loc'); hud.objName = $('#objective .obj-name'); hud.objText = $('#objective .obj-text');
  hud.boss = $('#bossbar'); hud.bossName = $('#bossbar .boss-name'); hud.bossHp = $('#bossbar .boss-hp'); hud.bossSh = $('#bossbar .boss-shield');
  hud.wp = $('#waypoint'); hud.wpDist = $('#waypoint .wp-dist');
  hud.cross = $('#crosshair'); hud.vig = $('#vignette'); hud.reload = $('#reload-hint');
  hud.superFill = $('#super .super-fill'); hud.superLbl = $('#super .super-label'); hud.superBox = $('#super');
  hud.ab = {};
  const ab = P.cls.abilities;
  for (const k of ['grenade', 'melee', 'class']) {
    const el = $(`.ab[data-ab="${k}"]`);
    el.querySelector('.ab-name').textContent = ab[k].name;
    el.style.setProperty('--ec', ELEMENTS[P.cls.element].color);
    hud.ab[k] = { el, fill: el.querySelector('.ab-fill') };
  }
  hud.superBox.style.setProperty('--ec', ELEMENTS[P.cls.element].color);
  $('#super .super-name').textContent = ab.super.name;
  $('#weapons').innerHTML = P.weapons.map((w, i) => {
    const rar = RARITIES[rarityIndex(w.item.rarity)];
    const ammo = AMMO[w.A.slot];
    return `<div class="wrow" data-i="${i}" style="--rc:${rar.color};--ec:${ELEMENTS[w.item.element].color};--ac:${ammo.color}">
      <div class="w-key">${i + 1}</div>
      <div class="w-info"><div class="w-name"><span class="el" title="${ELEMENTS[w.item.element].name}"></span>${esc(w.item.name)}</div><div class="w-type">${ARCHETYPES[w.item.arch].name}</div></div>
      <div class="w-ammo"><span class="ammo-ico" title="${ammo.name} ammo"></span><span class="w-mag"></span><span class="w-res"></span></div>
    </div>`;
  }).join('');
  hud.wrows = $$('#weapons .wrow').map((el) => ({ el, mag: el.querySelector('.w-mag'), res: el.querySelector('.w-res') }));
  const M = G.mission;
  hud.objLoc.textContent = `${M.loc.planetName}  ·  ${M.loc.name}`;
  hud.objName.textContent = M.def.name;
  $('#feed').innerHTML = '';
  $('#center-msg').classList.remove('show');
  hideDeath();
  prompt(null);
  setScope(false);
  for (const d of dmgActive) { d.el.style.display = 'none'; dmgPool.push(d.el); }
  dmgActive.length = 0;
}

let cmT = 0, hitT = 0, flashV = 0;
export function updateHUD(dt) {
  const P = G.player, M = G.mission, cam = G.camera;
  setStyle(hud.shield, 'sh', 'width', `${(P.shield / P.maxShield) * 100}%`);
  setStyle(hud.health, 'hp', 'width', `${(P.health / P.maxHealth) * 100}%`);
  setClass(hud.health.parentElement, 'hpbar', 'low', P.health < 40);
  setText(hud.revives, 'rev', `Revives ${Math.max(0, M.revives)}`);
  setText(hud.objText, 'obj', M.objective);
  // vignette
  flashV = Math.max(0, flashV - dt * 2.5);
  const lowHp = P.dead ? 0.6 : (1 - P.health / P.maxHealth) * 0.6;
  setStyle(hud.vig, 'vig', 'opacity', Math.min(1, lowHp + flashV).toFixed(2));
  // abilities
  for (const k of ['grenade', 'melee', 'class']) {
    const a = hud.ab[k];
    const pct = 1 - P.cd[k] / P.cdMax[k];
    setStyle(a.fill, 'ab' + k, 'height', `${Math.round(pct * 100)}%`);
    setClass(a.el, 'ab' + k, 'ready', pct >= 1);
  }
  const S = P.superActive;
  const sp = S ? S.t / S.max : P.superCharge / 100;
  setStyle(hud.superFill, 'sup', 'width', `${(sp * 100).toFixed(1)}%`);
  setClass(hud.superBox, 'sup', 'ready', !S && P.superCharge >= 100);
  setClass(hud.superBox, 'supa', 'active', !!S);
  setText(hud.superLbl, 'supl', S ? (S.type === 'revolver' ? `${S.shots} shots` : 'Active') : P.superCharge >= 100 ? 'Ready' : `${Math.floor(P.superCharge)}%`);
  // weapons
  P.weapons.forEach((w, i) => {
    const r = hud.wrows[i];
    setClass(r.el, 'w' + i, 'active', i === P.cur && !S);
    setText(r.mag, 'wm' + i, String(w.ammo));
    setText(r.res, 'wr' + i, w.reserve === Infinity ? '∞' : String(w.reserve));
    setClass(r.el, 'wl' + i, 'low', w.ammo <= Math.ceil(w.mag * 0.25));
  });
  const w = P.weapon;
  setClass(hud.reload, 'rl', 'show', !S && !w.reloading && w.ammo <= Math.ceil(w.mag * 0.25) && w.reserve > 0);
  setText(hud.reload, 'rlt', w.ammo === 0 && w.reserve === 0 ? 'NO AMMO' : 'RELOAD [R]');
  // crosshair
  const spread = S ? 0.004 : P.getSpread(w);
  const px = (spread / Math.tan((cam.fov * Math.PI) / 360)) * (innerHeight / 2);
  setStyle(hud.cross, 'chg', '--gap', `${Math.round(5 + px)}px`);
  setClass(hud.cross, 'chads', 'ads', P.adsT > 0.5 && !S);
  setClass(hud.cross, 'chrl', 'dim', w.reloading || P.switchT > 0);
  // super vignette + screen flash
  const sv = $('#super-vignette');
  setClass(sv, 'sv', 'on', !!S);
  setStyle(sv, 'svc', '--sc', ELEMENTS[P.cls.element].color);
  if (sfT > 0) { sfT = Math.max(0, sfT - dt); $('#screen-flash').style.opacity = (sfStrength * (sfT / sfMax)).toFixed(3); }
  // hitmarker
  hitT -= dt;
  if (hitT <= 0) setClass($('#hitmarker'), 'hm', 'show', false);
  // center message
  if (cmT > 0) { cmT -= dt; if (cmT <= 0) $('#center-msg').classList.remove('show'); }
  // boss bar
  const z = M.zones[M.current];
  const boss = z && z.isBoss && z.state === 'active' ? z.enemies.find((e) => e.isBoss && e.alive) : null;
  setClass(hud.boss, 'boss', 'hidden', !boss);
  if (boss) {
    setText(hud.bossName, 'bn', boss.name);
    setStyle(hud.bossHp, 'bh', 'width', `${(boss.hp / boss.maxHp) * 100}%`);
    setStyle(hud.bossSh, 'bs', 'width', `${(boss.shield / boss.maxShield) * 100}%`);
    setStyle(hud.bossSh, 'bsc', 'background', ELEMENTS[boss.shieldEl].color);
  }
  // waypoint
  const wp = M.waypoint;
  setClass(hud.wp, 'wp', 'hidden', !wp);
  if (wp) {
    _p.set(wp.x, (wp.y || 0) + 2.5, wp.z).project(cam);
    let x = _p.x, y = _p.y;
    const behind = _p.z > 1;
    if (behind) { x = -x; y = -y; }
    const sc = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85);
    if (behind || sc > 1) { const k = behind ? 1 / Math.max(sc, 1e-3) : 1 / sc; x *= k; y *= k; }
    hud.wp.style.transform = `translate(${((x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-y * 0.5 + 0.5) * innerHeight).toFixed(0)}px)`;
    setText(hud.wpDist, 'wpd', `${Math.round(Math.hypot(wp.x - P.pos.x, wp.z - P.pos.z))}m`);
  }
  updateDamageNumbers(dt);
  updateDamageDirs(dt);
}

export function setScope(on) {
  const el = $('#scope');
  if (el && el.classList.contains('hidden') === on) el.classList.toggle('hidden', !on);
}

export function centerMessage(title, sub = '', dur = 2.5) {
  const el = $('#center-msg');
  el.querySelector('.cm-title').textContent = title;
  el.querySelector('.cm-sub').textContent = sub;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  cmT = dur;
}

export function feed(text, color = '#e9eef5') {
  const el = document.createElement('div');
  el.className = 'feed-item';
  el.style.setProperty('--fc', color);
  el.textContent = text;
  const f = $('#feed');
  f.prepend(el);
  while (f.children.length > 7) f.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 3500);
  setTimeout(() => el.remove(), 4100);
}

export function lootToast(it) {
  const rar = RARITIES[rarityIndex(it.rarity)];
  const el = document.createElement('div');
  el.className = `feed-item loot r-${it.rarity}`;
  el.style.setProperty('--fc', rar.color);
  el.innerHTML = `<div class="l-k">Acquired</div><div class="l-n">${esc(it.name)}</div><div class="l-s">${rar.name} ${typeLine(it)}  ·  ◆ ${it.power}</div>`;
  const f = $('#feed');
  f.prepend(el);
  while (f.children.length > 7) f.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 5000);
  setTimeout(() => el.remove(), 5600);
}

export function prompt(text) {
  const el = $('#prompt');
  if (!text) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
  if (el.textContent !== text) el.textContent = text;
  el.classList.remove('hidden');
}

export function hitmarker(crit, kill) {
  const el = $('#hitmarker');
  el.classList.remove('crit', 'kill');
  if (crit) el.classList.add('crit');
  if (kill) el.classList.add('kill');
  el.classList.add('show');
  cache.set('hmshow', true);
  hitT = kill ? 0.22 : 0.1;
}

let sfT = 0, sfMax = 1, sfStrength = 0;
export function screenFlash(color, strength = 0.4) {
  const el = $('#screen-flash');
  el.style.setProperty('--fc', color);
  sfT = sfMax = 0.35; sfStrength = strength;
}

export function damageFlash() { flashV = Math.min(0.7, flashV + 0.35); }

// damage direction indicators
const dirPool = [];
export function damageDir(from) {
  const P = G.player;
  const ang = Math.atan2(from.x - P.pos.x, from.z - P.pos.z);
  const rel = -(ang - P.yaw) + Math.PI;
  let d = dirPool.find((x) => x.life <= 0);
  if (!d) {
    if (dirPool.length >= 6) d = dirPool[0];
    else { const el = document.createElement('div'); el.className = 'dmg-dir'; $('#dmg-dirs').appendChild(el); d = { el, life: 0 }; dirPool.push(d); }
  }
  d.life = 0.9; d.rel = rel;
}
function updateDamageDirs(dt) {
  for (const d of dirPool) {
    if (d.life <= 0) { d.el.style.opacity = '0'; continue; }
    d.life -= dt;
    d.el.style.opacity = Math.min(1, d.life * 2).toFixed(2);
    d.el.style.transform = `translate(-50%,-50%) rotate(${d.rel}rad) translateY(-150px)`;
  }
}

// floating damage numbers
const dmgPool = [], dmgActive = [];
export function damageNumber(enemy, pos, amount, o = {}) {
  const ex = dmgActive.find((d) => d.enemy === enemy && G.time - d.born < 0.12 && d.crit === !!o.crit);
  if (ex) { ex.amount += amount; ex.el.textContent = Math.round(ex.amount); return; }
  let el = dmgPool.pop();
  if (!el) { el = document.createElement('div'); $('#dmg-layer').appendChild(el); }
  el.className = 'dmgnum' + (o.crit ? ' crit' : '');
  el.style.color = o.shield ? ELEMENTS[o.shield].color : '';
  el.style.display = 'block';
  el.textContent = Math.max(1, Math.round(amount));
  const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2, (Math.random() - 0.5) * 0.5));
  dmgActive.push({ el, enemy, pos: p, amount, born: G.time, life: 0.8, crit: !!o.crit });
  if (dmgActive.length > 40) { const d = dmgActive.shift(); d.el.style.display = 'none'; dmgPool.push(d.el); }
}
function updateDamageNumbers(dt) {
  for (let i = dmgActive.length - 1; i >= 0; i--) {
    const d = dmgActive[i];
    d.life -= dt;
    if (d.life <= 0) { d.el.style.display = 'none'; dmgPool.push(d.el); dmgActive.splice(i, 1); continue; }
    d.pos.y += dt * 0.9;
    _p.copy(d.pos).project(G.camera);
    if (_p.z > 1) { d.el.style.opacity = '0'; continue; }
    const x = (_p.x * 0.5 + 0.5) * innerWidth, y = (-_p.y * 0.5 + 0.5) * innerHeight;
    const sc = 0.8 + Math.max(0, d.life - 0.6) * 2;
    d.el.style.opacity = Math.min(1, d.life * 3).toFixed(2);
    d.el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%,-50%) scale(${sc.toFixed(2)})`;
  }
}

// death
export function showDeath(revives) {
  const el = $('#death');
  el.classList.remove('hidden');
  el.querySelector('.d-sub').textContent = revives < 0 ? 'No revives remaining' : `Revives remaining: ${revives}`;
}
export function updateDeath(t) { const el = $('#death .d-timer'); if (el) el.textContent = t > 0 ? `Reviving in ${t.toFixed(1)}s` : ''; }
export function hideDeath() { $('#death').classList.add('hidden'); }

export function setLockHint(show) { $('#lock-hint').classList.toggle('hidden', !show); }

// ---------------------------------------------------------------------------
// Pause / complete / failed
// ---------------------------------------------------------------------------
export function showPause() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  unlockPointer();
  const s = G.save.settings;
  const el = $('#pause');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="modal">
      <div class="eyebrow">${esc(G.mission.def.name)}</div>
      <h1 class="screen-title">Paused</h1>
      <div class="settings">
        <label>Mouse sensitivity <span id="v-sens">${s.sens.toFixed(2)}</span><input type="range" id="s-sens" min="0.2" max="3" step="0.05" value="${s.sens}"></label>
        <label>Field of view <span id="v-fov">${s.fov}</span><input type="range" id="s-fov" min="65" max="105" step="1" value="${s.fov}"></label>
        <label>Volume <span id="v-vol">${Math.round(s.volume * 100)}%</span><input type="range" id="s-vol" min="0" max="1" step="0.05" value="${s.volume}"></label>
      </div>
      <div class="row-btns">
        <button class="btn primary" id="p-resume">Resume</button>
        <button class="btn danger" id="p-abandon">Abandon Mission</button>
      </div>
      <div class="ctl-grid">${CONTROLS.map(([k, v]) => `<div class="ctl"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div>
    </div>`;
  const P = G.player;
  $('#s-sens').addEventListener('input', (e) => { s.sens = +e.target.value; $('#v-sens').textContent = s.sens.toFixed(2); P.sens = 0.0022 * s.sens; writeSave(G.save); });
  $('#s-fov').addEventListener('input', (e) => { s.fov = +e.target.value; $('#v-fov').textContent = s.fov; P.baseFov = s.fov; writeSave(G.save); });
  $('#s-vol').addEventListener('input', (e) => { s.volume = +e.target.value; $('#v-vol').textContent = `${Math.round(s.volume * 100)}%`; setVolume(s.volume); writeSave(G.save); });
  $('#p-resume').addEventListener('click', resumeGame);
  $('#p-abandon').addEventListener('click', () => { el.classList.add('hidden'); abandonMission(); });
}

export function resumeGame() {
  if (G.state !== 'paused') return;
  $('#pause').classList.add('hidden');
  G.state = 'playing';
  lockPointer();
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function showComplete(M) {
  showOnly('complete');
  const el = $('#complete');
  const loot = M.loot;
  el.innerHTML = `
    <div class="modal wide">
      <div class="eyebrow">${M.loc.name}</div>
      <h1 class="screen-title gold">Mission Complete</h1>
      <div class="m-name-big">${esc(M.def.name)}${M.firstClear ? '<span class="tag new">First clear</span>' : ''}</div>
      <div class="summary">
        <div><b>${fmtTime(G.time * 1000)}</b><span>Time</span></div>
        <div><b>${M.kills}</b><span>Kills</span></div>
        <div><b>${M.crits}</b><span>Precision kills</span></div>
        <div><b>${M.deaths}</b><span>Deaths</span></div>
        <div><b>⬡ ${M.rewardGlimmer ?? 0}</b><span>Glimmer</span></div>
        <div><b>◆ ${playerPower(G.save)}</b><span>Power</span></div>
      </div>
      <div class="eyebrow">Rewards  ·  ${loot.length} item${loot.length === 1 ? '' : 's'}</div>
      <div class="grid rewards">${loot.map((it) => itemCard(it)).join('')}</div>
      <div class="row-btns">
        <button class="btn primary" id="c-orbit">Return to Orbit</button>
        <button class="btn" id="c-inv">View Inventory</button>
        <button class="btn" id="c-replay">Replay</button>
      </div>
    </div>`;
  $('#c-orbit').addEventListener('click', () => abandonMission());
  $('#c-inv').addEventListener('click', () => { orbitTab = 'inventory'; abandonMission(); });
  $('#c-replay').addEventListener('click', () => { lockPointer(); retryMission(); });
}

export function showFailed(M) {
  showOnly('failed');
  const el = $('#failed');
  el.innerHTML = `
    <div class="modal">
      <div class="eyebrow">${M.loc.name}</div>
      <h1 class="screen-title red">Mission Failed</h1>
      <p class="desc">You ran out of revives in ${esc(M.def.name)}. Loot you picked up along the way is yours to keep.</p>
      <div class="summary"><div><b>${M.kills}</b><span>Kills</span></div><div><b>${M.loot.length}</b><span>Items found</span></div><div><b>◆ ${playerPower(G.save)}</b><span>Power</span></div></div>
      <div class="row-btns">
        <button class="btn primary" id="f-retry">Retry</button>
        <button class="btn" id="f-orbit">Return to Orbit</button>
      </div>
    </div>`;
  $('#f-retry').addEventListener('click', () => { lockPointer(); retryMission(); });
  $('#f-orbit').addEventListener('click', () => abandonMission());
}
