import * as THREE from 'three';
import { G, lockPointer, unlockPointer } from './state.js';
import { LOCATIONS, CLASSES, RARITIES, ELEMENTS, ARCHETYPES, PERKS, EXOTIC_PERKS, SLOTS, WEAPON_SLOTS, ARMOR_SLOTS, SLOT_NAMES, CONTROLS, AMMO, rarityIndex, classKit, ACTIVITIES, EXOTIC_ARMOR_PERKS, ARMOR_PERKS } from './data.js';
import { activeKit, playerPower, getEquipped, getItem, equipItem, dismantleItem, infuseInfo, infuseItem, isEquipped, isUnlocked, createSave, writeSave, resetSave, INVENTORY_CAP } from './save.js';
import { dismantleValue } from './loot.js';
import { weaponIcon, armorIcon, subclassIcon } from './icons.js';
import { startMission, startActivity, newSeed, retryMission, abandonMission } from './game.js';
import { initAudio, setVolume, sfx } from './audio.js';
import { playMusic, setMusicVolume } from './music.js';
import { esc, clamp } from './util.js';
import { net, createFireteam, joinFireteam, leaveFireteam, setSelection, MAX_FIRETEAM } from './net.js';
import { profile, launchFireteam, launchActivity } from './coop.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SCREENS = ['title', 'classes', 'orbit', 'pause', 'complete', 'failed'];
const _p = new THREE.Vector3();

function showOnly(...ids) {
  for (const id of SCREENS) $('#' + id).classList.toggle('hidden', !ids.includes(id));
  $('#hud').classList.toggle('hidden', !ids.includes('hud'));
}

export function initUI() {
  net.onLobby = () => { if (G.state === 'orbit') renderOrbit(); };
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
  G.menu.setMode('planet');
  G.menu.setLocation(LOCATIONS[0]);
  G.menu.setOffset(4.4);
  $('#title .t-hint').textContent = G.save ? 'Click to continue' : 'Click to begin';
}

export function showClassSelect(fromOrbit = false) {
  G.state = 'classes';
  showOnly('classes');
  G.menu.setMode('planet');
  G.menu.setOffset(0);
  const el = $('#classes');
  el.innerHTML = `
    <div class="cls-wrap">
      <div class="eyebrow">${fromOrbit ? 'Change class (gear is shared)' : 'Choose your class'}</div>
      <h1 class="screen-title">Who will you be?</h1>
      <div class="cls-grid">
        ${Object.values(CLASSES).map((c) => `
          <button class="cls-card" data-cls="${c.id}" style="--cc:${c.color}">
            <div class="cls-el">${Object.values(c.subclasses).map((sc) => `<span style="color:${sc.color}">${sc.name}</span>`).join('  ·  ')}</div>
            <div class="cls-name">${c.name}</div>
            <ul class="cls-abs">
              ${Object.values(c.subclasses).map((sc) => `<li><b style="color:${sc.color}">${sc.name} (${ELEMENTS[sc.element].name})</b><span>${sc.tagline} Super: ${sc.abilities.super.name}.</span></li>`).join('')}
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
let orbitTab = 'director', selLoc = null, selMission = null, selAct = 0;

export function showOrbit(tab) {
  G.state = 'orbit';
  if (tab) orbitTab = tab;
  if (orbitTab !== 'director' && orbitTab !== 'activities') orbitTab = 'character';
  showOnly('orbit');
  setVolume(G.save.settings.volume);
  setMusicVolume(G.save.settings.musicVolume ?? 0.5);
  playMusic('orbit');
  if (selLoc === null) {
    let last = 0;
    LOCATIONS.forEach((l, li) => { if (isUnlocked(G.save, li, 0)) last = li; });
    selLoc = last;
  }
  renderOrbit();
}

function renderOrbit() {
  const s = G.save;
  const cls = activeKit(s);
  const newCount = s.inventory.filter((i) => i.isNew).length;
  $('#orbit').innerHTML = `
    <header class="topbar">
      <div class="brand">AFTERLIGHT</div>
      <nav class="tabs">
        ${['director', 'activities', 'character'].map((t) => `<button class="tab ${orbitTab === t ? 'on' : ''}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}${t === 'character' && newCount ? `<span class="badge">${newCount}</span>` : ''}</button>`).join('')}
      </nav>
      <button class="btn install-app hidden" id="install-app" title="Install Afterlight as an app">Install App</button>
      <div class="pstats">
        <span class="cls-chip" style="--cc:${cls.color}">${cls.name}</span>
        <span class="power">◆ ${playerPower(s)}</span>
        <span class="glimmer" title="Glimmer">⬡ ${s.glimmer.toLocaleString()}</span>
      </div>
    </header>
    <main id="orbit-main" class="tab-${orbitTab}"></main>`;
  $$('.tab').forEach((b) => b.addEventListener('click', () => { sfx.ui(); orbitTab = b.dataset.tab; renderOrbit(); }));
  $('#install-app').addEventListener('click', async () => {
    const p = G.installPrompt;
    if (!p) return;
    p.prompt();
    await p.userChoice.catch(() => null);
    G.installPrompt = null;
    refreshInstall();
  });
  refreshInstall();
  const main = $('#orbit-main');
  if (orbitTab === 'director') renderDirector(main);
  else if (orbitTab === 'activities') renderActivities(main);
  else renderCharScreen(main);
}

function renderDirector(main) {
  const s = G.save;
  const loc = LOCATIONS[selLoc];
  G.menu.setMode('planet');
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
        ${fireteamHTML()}
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
          <button id="launch" class="btn primary" ${m && !net.isClient ? '' : 'disabled'}>${net.isClient ? 'Leader launches' : net.isHost ? 'Launch Fireteam' : 'Launch'}</button>
        </div>
      </section>
    </div>`;
  $$('.loc', main).forEach((b) => b.addEventListener('click', () => { sfx.ui(); selLoc = +b.dataset.loc; selMission = null; renderOrbit(); }));
  $$('.mission', main).forEach((b) => b.addEventListener('click', () => { sfx.ui(); selMission = +b.dataset.m; renderOrbit(); }));
  $('#launch', main)?.addEventListener('click', () => {
    initAudio();
    lockPointer();
    if (net.isHost) launchFireteam(selLoc, selMission);
    else startMission(selLoc, selMission);
  });
  if (net.isHost && m && (net.sel?.li !== selLoc || net.sel?.mi !== selMission)) setSelection(selLoc, selMission);
  wireFireteam(main);
}

function renderActivities(main) {
  const s = G.save;
  G.menu.setMode('planet');
  G.menu.setLocation(LOCATIONS[selLoc]);
  G.menu.setOffset(4.4);
  const a = ACTIVITIES[selAct];
  const best = s.records?.endless || 0;
  main.innerHTML = `
    <div class="director">
      <aside class="loc-list">
        <div class="eyebrow">Activities</div>
        ${ACTIVITIES.map((x, i) => `<button class="loc ${i === selAct ? 'sel' : ''}" data-act="${i}">
            <div class="loc-planet">${x.waves === Infinity ? 'Endless waves' : `${x.waves} waves`}</div><div class="loc-name">${x.name}</div>
            <div class="loc-prog">${x.id === 'endless' ? (best ? `Best: wave ${best}` : 'No record yet') : 'Exotic at wave 30'}</div></button>`).join('')}
        ${fireteamHTML()}
      </aside>
      <section class="loc-detail">
        <div class="eyebrow">Activity  ·  Every destination</div>
        <h1 class="screen-title">${a.name}</h1>
        <p class="desc">${a.desc}</p>
        <div class="missions">
          <div class="mission sel"><div class="m-top"><span class="m-name">How it works</span><span class="m-power">◆ ${playerPower(s)}</span></div>
            <div class="m-desc">Fights take place in the boss arenas of every destination, in a random order. Wave ${a.arenaEvery}, ${a.arenaEvery * 2} and ${a.arenaEvery * 3} bring that arena's boss. Each new arena sends denser waves. Enemies scale to your Power and get tougher every wave.</div>
            <div class="m-foot"><span class="tag">Cache every ${a.chestEvery} waves</span><span class="tag">New arena every ${a.arenaEvery} waves</span>${a.waves === Infinity ? '' : '<span class="tag exo">Guaranteed exotic at the end</span>'}</div></div>
          <div class="mission"><div class="m-top"><span class="m-name">Fireteam lives</span></div>
            <div class="m-desc">Solo: 3 revives. Two players share 3 lives, three players share 5. Hold E next to a downed teammate to revive them for free; after ${18} seconds a life brings them back. If everyone goes down with no lives left, the run ends.</div></div>
        </div>
        <div class="launch-row">
          <div class="power-cmp">Your Power <b>◆ ${playerPower(s)}</b><span class="ok">Scales to you</span></div>
          <button id="launch" class="btn primary" ${net.isClient ? 'disabled' : ''}>${net.isClient ? 'Leader launches' : net.isHost ? 'Launch Fireteam' : 'Launch'}</button>
        </div>
      </section>
    </div>`;
  $$('.loc', main).forEach((b) => b.addEventListener('click', () => { sfx.ui(); selAct = +b.dataset.act; renderOrbit(); }));
  $('#launch', main)?.addEventListener('click', () => {
    initAudio();
    lockPointer();
    if (net.isHost) launchActivity(a.id);
    else startActivity(a.id, newSeed());
  });
  if (net.isHost && (net.sel?.li !== -1 || net.sel?.mi !== selAct)) setSelection(-1, selAct);
  wireFireteam(main);
}

function fireteamHTML() {
  if (!net.active) {
    return `<div class="ft">
      <div class="eyebrow">Fireteam</div>
      <label class="ft-lbl" for="ft-name">Your name</label>
      <input id="ft-name" class="ft-in" maxlength="16" value="${esc(profile().name)}" autocomplete="off">
      <button class="btn" id="ft-create">Create Fireteam</button>
      <div class="ft-join"><input id="ft-code" class="ft-in" maxlength="6" placeholder="CODE" autocomplete="off" spellcheck="false" aria-label="Fireteam code"><button class="btn" id="ft-join">Join</button></div>
      ${net.status ? `<div class="ft-status">${esc(net.status)}</div>` : ''}
      <p class="ft-hint">Co-op for up to ${MAX_FIRETEAM}. Share your code; every player gets their own loot.</p>
    </div>`;
  }
  const sel = !net.sel ? null : net.sel.li === -1 ? ACTIVITIES[net.sel.mi] : LOCATIONS[net.sel.li]?.missions[net.sel.mi];
  return `<div class="ft on">
    <div class="eyebrow">Fireteam  ·  ${net.members.length}/${MAX_FIRETEAM}</div>
    <button class="ft-code" id="ft-copy" title="Copy the code">${net.code}<span>Copy</span></button>
    <div class="ft-members">${net.members.map((mm) => `<div class="ft-m"><span class="ft-dot" style="background:${CLASSES[mm.cls]?.color || '#fff'}"></span><b>${esc(mm.name)}</b><span>${CLASSES[mm.cls]?.name || ''}  ◆${mm.power}</span>${mm.leader ? '<i>Leader</i>' : ''}</div>`).join('')}</div>
    ${net.isClient ? `<div class="ft-status">${sel ? `Leader picked: ${esc(sel.name)}` : 'Waiting for the leader to pick a mission'}</div>` : '<div class="ft-status">You lead. Pick a mission and launch.</div>'}
    <button class="btn ghost" id="ft-leave">Leave Fireteam</button>
  </div>`;
}

function wireFireteam(main) {
  const nameIn = $('#ft-name', main);
  nameIn?.addEventListener('change', () => { G.save.settings.name = nameIn.value.trim().slice(0, 16) || profile().name; writeSave(G.save); });
  const errText = (e) => (e && e.message) || String(e);
  $('#ft-create', main)?.addEventListener('click', async () => {
    if (nameIn) { G.save.settings.name = nameIn.value.trim().slice(0, 16) || profile().name; writeSave(G.save); }
    net.status = 'Creating fireteam…'; renderOrbit();
    try { await createFireteam(profile()); } catch (e) { console.error(e); net.status = errText(e); }
    renderOrbit();
  });
  $('#ft-join', main)?.addEventListener('click', async () => {
    if (nameIn) { G.save.settings.name = nameIn.value.trim().slice(0, 16) || profile().name; writeSave(G.save); }
    const code = $('#ft-code', main).value;
    net.status = 'Joining…'; renderOrbit();
    try { await joinFireteam(code, profile()); } catch (e) { console.error(e); net.status = errText(e); }
    renderOrbit();
  });
  $('#ft-code', main)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#ft-join', main).click(); });
  $('#ft-copy', main)?.addEventListener('click', (e) => {
    const b = e.currentTarget;
    navigator.clipboard?.writeText(net.code).then(() => { b.querySelector('span').textContent = 'Copied'; }).catch(() => { b.querySelector('span').textContent = 'Select & copy'; });
  });
  $('#ft-leave', main)?.addEventListener('click', () => leaveFireteam());
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

// ---------------------------------------------------------------------------
// Character screen (Destiny-style): model in the middle, weapons left, armour right
// ---------------------------------------------------------------------------
let flySlot = null, hoverId = null, dismantle = null;

function playerStats() {
  const s = G.save, cls = CLASSES[s.classId];
  const st = { ...cls.base };
  for (const sl of ARMOR_SLOTS) { const it = getEquipped(s, sl); if (it) { st.mob += it.stats.mob; st.res += it.stats.res; st.rec += it.stats.rec; } }
  return st;
}

function tileHTML(it, equipped = false) {
  const rar = RARITIES[rarityIndex(it.rarity)];
  const weapon = it.kind === 'weapon';
  const art = weapon ? `<img src="${weaponIcon(it)}" alt="" draggable="false">` : armorIcon(it.slot);
  return `<button class="tile r-${it.rarity}${equipped ? ' equipped' : ''}" data-id="${it.id}" style="--rc:${rar.color}" aria-label="${esc(it.name)}">
    ${art}
    ${weapon ? `<span class="t-el el" style="background:${ELEMENTS[it.element].color}"></span><span class="t-ammo ammo-ico" style="--ac:${AMMO[it.slot].color}"></span>` : ''}
    <span class="t-power">${it.power}</span>${it.isNew ? '<i class="t-new"></i>' : ''}
  </button>`;
}

function renderCharScreen(main) {
  const s = G.save;
  const cls = activeKit(s);
  const el = ELEMENTS[cls.element];
  G.menu.setMode('character', s.classId, cls.element);
  const st = playerStats();
  const slot = (sl) => {
    const it = getEquipped(s, sl);
    const hasNew = s.inventory.some((i) => i.slot === sl && i.isNew);
    return `<div class="cs-slot" data-slot="${sl}"><div class="cs-label">${SLOT_NAMES[sl]}${hasNew ? '<i class="dot"></i>' : ''}</div>${it ? tileHTML(it, true) : '<div class="tile empty"></div>'}</div>`;
  };
  main.innerHTML = `
    <div class="cs">
      <div class="cs-head">
        <div class="cs-class" style="color:${cls.color}">${cls.name}</div>
        <div class="cs-sub">${cls.subclass}  ·  ${el.name}</div>
      </div>
      <div class="cs-power"><span class="pw">◆</span>${playerPower(s)}<small>Power</small></div>
      <div class="cs-col left">
        <div class="cs-slot"><div class="cs-label">Subclass</div><button class="tile subclass" id="cs-sub" style="--rc:${el.color}" aria-label="Subclass">${subclassIcon(el.color)}</button></div>
        ${WEAPON_SLOTS.map(slot).join('')}
      </div>
      <div class="cs-stage" id="cs-stage" title="Drag to rotate"></div>
      <div class="cs-col right">${ARMOR_SLOTS.map(slot).join('')}</div>
      <div class="cs-stats">
        ${[['Mobility', st.mob, `+${Math.round(st.mob * 1.2)}% speed`], ['Resilience', st.res, `${Math.round(55 + st.res * 3)} shield`], ['Recovery', st.rec, `${clamp(4.6 - st.rec * 0.1, 1.6, 4.6).toFixed(1)}s regen`]]
          .map(([n, v, d]) => `<div class="cs-stat" title="${d}"><b>${v}</b><span>${n}</span><i><em style="width:${Math.min(100, (v / 40) * 100)}%"></em></i></div>`).join('')}
      </div>
      <div class="cs-foot">
        <span>⬡ ${s.glimmer.toLocaleString()}</span><span>${s.inventory.length} / ${INVENTORY_CAP} items</span>
        <span class="cs-auto" title="Weapon and armor drops of these rarities are dismantled into glimmer automatically">Auto-dismantle
          ${['common', 'uncommon', 'rare'].map((r) => `<button class="cs-auto-t ${s.settings.autoDismantle?.[r] ? 'on' : ''}" data-r="${r}" style="--rc:${RARITIES[rarityIndex(r)].color}">${{ common: 'White', uncommon: 'Green', rare: 'Blue' }[r]}</button>`).join('')}</span>
        <button class="btn danger cs-reset" id="cs-reset">Reset Character</button>
        <span class="hint">Click a slot to swap  ·  Hover for details  ·  Hold <kbd>F</kbd> to dismantle  ·  <kbd>Shift</kbd>+Click to infuse</span>
      </div>
      <div class="cs-fly hidden" id="cs-fly"></div>
      <div class="cs-tip hidden" id="cs-tip"></div>
      <div class="cs-panel hidden" id="cs-panel"></div>
    </div>`;

  const root = $('.cs', main);
  root.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-id]');
    if (t) showTip(t); else if (!e.target.closest('#cs-tip')) hideTip();
  });
  root.addEventListener('mouseleave', hideTip);
  root.addEventListener('click', (e) => {
    const t = e.target.closest('.tile');
    if (e.target.closest('#cs-sub')) { openSubclass(); return; }
    if (t && t.dataset.id) {
      const it = getItem(s, t.dataset.id);
      if (t.closest('.cs-slot')) { toggleFly(it.slot, t); return; }
      if (e.shiftKey) { if (infuseItem(s, it.id)) { sfx.engram(3); flySlot = null; renderOrbit(); } else sfx.denied(); return; }
      const swapped = equipItem(s, it.id);
      sfx.engram(1);
      flySlot = null;
      renderOrbit();
      if (swapped) orbitNotice(`${swapped.name} unequipped: only one exotic armor piece at a time.`);
      return;
    }
    if (!e.target.closest('#cs-fly') && !e.target.closest('#cs-panel')) closeFly();
  });
  $$('.cs-auto-t', main).forEach((b) => b.addEventListener('click', () => {
    const set = (s.settings.autoDismantle = s.settings.autoDismantle || {});
    set[b.dataset.r] = !set[b.dataset.r];
    writeSave(s);
    sfx.ui();
    b.classList.toggle('on', set[b.dataset.r]);
  }));
  $('#cs-reset', main).addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Click again: delete gear and progress'; return; }
    resetSave();
    G.save = null;
    selLoc = null; selMission = null;
    showClassSelect();
  });
  // drag the stage to turn the character
  const stage = $('#cs-stage', main);
  let dragX = null;
  stage.addEventListener('pointerdown', (e) => { dragX = e.clientX; stage.setPointerCapture(e.pointerId); closeFly(); });
  stage.addEventListener('pointermove', (e) => { if (dragX === null) return; G.menu.rotateChar((e.clientX - dragX) * 0.012); dragX = e.clientX; });
  stage.addEventListener('pointerup', () => { dragX = null; });
  if (flySlot) { const anchor = $(`.cs-slot[data-slot="${flySlot}"] .tile`, main); if (anchor) openFly(flySlot, anchor); }
}

function toggleFly(sl, anchor) {
  sfx.ui();
  if (flySlot === sl) { closeFly(); return; }
  openFly(sl, anchor);
}

function openFly(sl, anchor) {
  const s = G.save;
  flySlot = sl;
  const items = s.inventory.filter((i) => i.slot === sl && !isEquipped(s, i))
    .sort((a, b) => b.power - a.power || rarityIndex(b.rarity) - rarityIndex(a.rarity));
  const fly = $('#cs-fly');
  fly.innerHTML = `<div class="fly-head">${SLOT_NAMES[sl]}<span>${items.length}</span></div>
    ${items.length ? `<div class="fly-grid">${items.map((it) => tileHTML(it)).join('')}</div>` : '<div class="fly-empty">Nothing else for this slot yet. Engrams drop from enemies and boss caches.</div>'}`;
  fly.classList.remove('hidden');
  const r = anchor.getBoundingClientRect(), host = $('.cs').getBoundingClientRect();
  const left = anchor.closest('.cs-col').classList.contains('left');
  const fw = fly.offsetWidth, fh = fly.offsetHeight;
  let x = left ? r.right + 14 : r.left - fw - 14;
  let y = r.top;
  x = clamp(x, host.left + 8, host.right - fw - 8);
  y = clamp(y, host.top + 8, host.bottom - fh - 8);
  fly.style.left = `${x - host.left}px`;
  fly.style.top = `${y - host.top}px`;
  $$('.cs-slot').forEach((n) => n.classList.toggle('open', n.dataset.slot === sl));
}

function closeFly() {
  flySlot = null;
  hideTip();
  $('#cs-fly')?.classList.add('hidden');
  $$('.cs-slot').forEach((n) => n.classList.remove('open'));
}

function tipHTML(it) {
  const s = G.save;
  const rar = RARITIES[rarityIndex(it.rarity)];
  const eq = getEquipped(s, it.slot);
  const equipped = eq === it;
  const cmp = !equipped && eq ? eq : null;
  const delta = (a, b, invert = false) => {
    if (!cmp) return '';
    const d = invert ? b - a : a - b;
    if (Math.abs(d) < 0.005) return '';
    return `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${Number.isInteger(d) ? d : d.toFixed(1)}</span>`;
  };
  let body = '';
  if (it.kind === 'weapon') {
    const A = ARCHETYPES[it.arch], st = it.stats, el = ELEMENTS[it.element], am = AMMO[it.slot];
    const cs = cmp && cmp.arch === it.arch ? cmp.stats : null;
    const row = (label, v, max, txt, cv, inv) => `<div class="tt-stat"><span>${label}</span><i><em style="width:${clamp((v / max) * 100, 3, 100)}%"></em></i><b>${txt}${cs ? delta(v, cv, inv) : ''}</b></div>`;
    body += `<div class="tt-top"><div class="tt-pow">${it.power}${cmp ? delta(it.power, cmp.power) : ''}</div><div class="tt-tags"><span style="color:${el.color}">◆ ${el.name}</span><span class="ammo-chip" style="--ac:${am.color}"><span class="ammo-ico"></span>${am.name}</span></div></div>`;
    body += '<div class="tt-stats">';
    body += row('Impact', st.dmg * (A.pellets || 1), A.dmg * (A.pellets || 1) * 1.6, Math.round(st.dmg) + (A.pellets ? `×${A.pellets}` : ''), cs && cs.dmg * (A.pellets || 1));
    body += row('Rate of Fire', st.rpm, A.rpm * 1.6, `${st.rpm}`, cs && cs.rpm);
    body += row('Magazine', st.mag, A.mag * 1.6, st.mag, cs && cs.mag);
    body += row('Reload', 1 / st.reload, (1 / A.reload) * 1.6, `${st.reload.toFixed(1)}s`, cs && 1 / cs.reload);
    body += row('Range', st.range, A.range * 1.6, `${st.range}m`, cs && cs.range);
    body += '</div>';
    const perks = [];
    for (const xp of it.exoticPerks || (it.exotic ? [it.exotic] : [])) {
      const d = EXOTIC_PERKS[xp] || PERKS[xp];
      if (d) perks.push(`<div class="tt-perk exo"><i></i><div><b>${d.name}</b><span>${d.desc}</span></div></div>`);
    }
    for (const p of it.perks) perks.push(`<div class="tt-perk"><i></i><div><b>${PERKS[p].name}</b><span>${PERKS[p].desc}</span></div></div>`);
    if (perks.length) body += `<div class="tt-perks">${perks.join('')}</div>`;
    if (it.flavor) body += `<div class="tt-flavor">${esc(it.flavor)}</div>`;
  } else {
    const st = it.stats, c = cmp ? cmp.stats : null;
    body += `<div class="tt-top"><div class="tt-pow">${it.power}${cmp ? delta(it.power, cmp.power) : ''}</div><div class="tt-tags"><span>${SLOT_NAMES[it.slot]}</span></div></div><div class="tt-stats">`;
    for (const [k, n] of [['mob', 'Mobility'], ['res', 'Resilience'], ['rec', 'Recovery']]) {
      body += `<div class="tt-stat"><span>${n}</span><i><em style="width:${clamp((st[k] / 12) * 100, 3, 100)}%"></em></i><b>${st[k]}${c ? delta(st[k], c[k]) : ''}</b></div>`;
    }
    body += `<div class="tt-stat total"><span>Total</span><i></i><b>${st.mob + st.res + st.rec}</b></div></div>`;
    const xp = it.rarity === 'exotic' && EXOTIC_ARMOR_PERKS[it.name];
    if (xp) body += `<div class="tt-perks"><div class="tt-perk exo"><i></i><div><b>${xp.name}</b><span>${xp.desc}</span></div></div></div>`;
    const ap = it.perk && ARMOR_PERKS[it.perk];
    if (ap) body += `<div class="tt-perks"><div class="tt-perk"><i></i><div><b>${ap.name}</b><span>${ap.desc}</span></div></div></div>`;
    if (it.rarity === 'exotic') body += '<div class="tt-note">Only one exotic armor piece can be equipped.</div>';
  }
  const inf = infuseInfo(s, it);
  const foot = equipped
    ? '<div class="tt-foot">Equipped</div>'
    : `<div class="tt-foot"><span>Click: Equip</span><span>Hold <kbd>F</kbd>: Dismantle (+⬡${dismantleValue(it)})</span>${inf.possible ? `<span>Shift+Click: Infuse to ◆${inf.target} (⬡${inf.cost})</span>` : ''}<i class="tt-hold"><em></em></i></div>`;
  return `<div class="tt-head r-${it.rarity}" style="--rc:${rar.color}"><div class="tt-name">${esc(it.name)}</div><div class="tt-type">${rar.name} ${typeLine(it)}</div></div><div class="tt-body">${body}</div>${foot}`;
}

function showTip(tile) {
  const it = getItem(G.save, tile.dataset.id);
  if (!it) return;
  hoverId = it.id;
  if (it.isNew && !tile.closest('.cs-slot')) { it.isNew = false; writeSave(G.save); tile.querySelector('.t-new')?.remove(); }
  const tip = $('#cs-tip');
  tip.innerHTML = tipHTML(it);
  tip.classList.remove('hidden');
  const r = tile.getBoundingClientRect(), host = $('.cs').getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = r.right + 12;
  if (x + tw > host.right - 8) x = r.left - tw - 12;
  const y = clamp(r.top, host.top + 8, host.bottom - th - 8);
  tip.style.left = `${Math.max(host.left + 8, x) - host.left}px`;
  tip.style.top = `${y - host.top}px`;
}

function hideTip() {
  hoverId = null;
  cancelDismantle();
  $('#cs-tip')?.classList.add('hidden');
}

function startDismantle() {
  if (dismantle || !hoverId) return;
  const it = getItem(G.save, hoverId);
  if (!it || isEquipped(G.save, it)) { sfx.denied(); return; }
  const bar = $('#cs-tip .tt-hold em');
  const t0 = performance.now(), DUR = 900;
  const id = it.id;
  const tick = () => {
    const k = (performance.now() - t0) / DUR;
    if (bar) bar.style.width = `${Math.min(100, k * 100)}%`;
    if (k >= 1) {
      dismantle = null;
      const v = dismantleItem(G.save, id);
      sfx.ui();
      hideTip();
      renderOrbit();
      feedOrbit(`Dismantled ${it.name}  +⬡${v}`);
      return;
    }
    dismantle = requestAnimationFrame(tick);
  };
  dismantle = requestAnimationFrame(tick);
}

function cancelDismantle() {
  if (dismantle) cancelAnimationFrame(dismantle);
  dismantle = null;
  const bar = $('#cs-tip .tt-hold em');
  if (bar) bar.style.width = '0%';
}

function feedOrbit(text) {
  const n = document.createElement('div');
  n.className = 'cs-toast';
  n.textContent = text;
  $('.cs')?.appendChild(n);
  setTimeout(() => n.remove(), 2200);
}

function openSubclass() {
  sfx.ui();
  closeFly();
  const s = G.save, cls = activeKit(s), el = ELEMENTS[cls.element];
  const p = $('#cs-panel');
  const subs = CLASSES[s.classId].subclasses;
  p.innerHTML = `
    <div class="sp-head" style="--ec:${el.color}"><div><div class="eyebrow">${cls.className}  ·  ${el.name}</div><div class="sp-title">${cls.subclass}</div><div class="sp-tag">${cls.tagline}</div></div><button class="sp-x" id="sp-close" aria-label="Close">✕</button></div>
    <div class="sp-pick">${Object.entries(subs).map(([id, sc]) => `<button class="sp-sub${id === cls.subclassId ? ' on' : ''}" data-sub="${id}" style="--ec:${sc.color}"><b>${sc.name}</b><span>${ELEMENTS[sc.element].name}</span></button>`).join('')}</div>
    <div class="abil-list">
      ${[['super', 'X'], ['grenade', 'Q'], ['melee', 'F'], ['class', 'C']].map(([k, key]) => `<div class="abil-row" style="--ec:${el.color}"><kbd>${key}</kbd><div><b>${cls.abilities[k].name}</b><span>${cls.abilities[k].desc}${cls.abilities[k].cd ? `  ·  ${cls.abilities[k].cd}s cooldown` : ''}</span></div></div>`).join('')}
      ${cls.passive ? `<div class="abil-row" style="--ec:${el.color}"><kbd>★</kbd><div><b>Subclass trait</b><span>${cls.passive}</span></div></div>` : ''}
      <div class="abil-row"><kbd>Space</kbd><div><b>${cls.jumpName}</b><span>Class jump</span></div></div>
      <div class="abil-row"><kbd>V</kbd><div><b>Melee</b><span>A quick strike that lunges toward close enemies. No cooldown.</span></div></div>
    </div>
    <details class="sp-controls"><summary>All controls</summary>${CONTROLS.map(([k, v]) => `<div class="ctl"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</details>
    <div class="row-btns">
      <button class="btn" id="change-class">Change Class</button>
    </div>`;
  p.classList.remove('hidden');
  $$('.sp-sub', p).forEach((b) => b.addEventListener('click', () => {
    s.subclass = { ...(s.subclass || {}), [s.classId]: b.dataset.sub };
    writeSave(s);
    sfx.engram(2);
    renderOrbit();
    openSubclass();
  }));
  $('#sp-close').addEventListener('click', () => p.classList.add('hidden'));
  $('#change-class').addEventListener('click', () => showClassSelect(true));
}

// Hold F to dismantle, Esc to close flyouts (only on the Character screen)
addEventListener('keydown', (e) => {
  if (G.state !== 'orbit' || orbitTab !== 'character') return;
  if (e.code === 'KeyF' && !e.repeat) startDismantle();
  if (e.code === 'Escape') { closeFly(); $('#cs-panel')?.classList.add('hidden'); }
});
addEventListener('keyup', (e) => { if (e.code === 'KeyF') cancelDismantle(); });

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
  applyHudScale();
  cache.clear();
  const P = G.player;
  hud.shield = $('#vitals .shield-fill'); hud.over = $('#vitals .over-fill'); hud.health = $('#vitals .health-fill'); hud.revives = $('#revives');
  hud.objLoc = $('#objective .obj-loc'); hud.objName = $('#objective .obj-name'); hud.objText = $('#objective .obj-text');
  hud.boss = $('#bossbar'); hud.bossName = $('#bossbar .boss-name'); hud.bossHp = $('#bossbar .boss-hp'); hud.bossSh = $('#bossbar .boss-shield');
  hud.wp = $('#waypoint'); hud.wpDist = $('#waypoint .wp-dist');
  hud.cross = $('#crosshair'); hud.vig = $('#vignette'); hud.crit = $('#crit-vignette'); hud.reload = $('#reload-hint');
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
  renderWeaponRows();
  setMissionHeader();
  $('#feed').innerHTML = '';
  $('#nameplates').innerHTML = '';
  $('#roster').classList.add('hidden');
  $('#center-msg').classList.remove('show');
  hideDeath();
  prompt(null);
  setScope(false);
  for (const d of dmgActive) { d.el.style.display = 'none'; dmgPool.push(d.el); }
  dmgActive.length = 0;
}

/** Weapon list in the HUD (rebuilt when weapons are swapped mid-mission). */
export function renderWeaponRows() {
  const P = G.player;
  cache.clear();
  $('#weapons').innerHTML = P.weapons.map((w, i) => {
    const rar = RARITIES[rarityIndex(w.item.rarity)];
    const ammo = AMMO[w.item.slot];
    return `<div class="wrow" data-i="${i}" style="--rc:${rar.color};--ec:${ELEMENTS[w.item.element].color};--ac:${ammo.color}">
      <div class="w-key">${i + 1}</div>
      <div class="w-info"><div class="w-name"><span class="el" title="${ELEMENTS[w.item.element].name}"></span>${esc(w.item.name)}</div><div class="w-type">${ARCHETYPES[w.item.arch].name}</div></div>
      <div class="w-ammo"><span class="ammo-ico" title="${ammo.name} ammo"></span><span class="w-mag"></span><span class="w-res"></span></div>
    </div>`;
  }).join('');
  hud.wrows = $$('#weapons .wrow').map((el) => ({ el, mag: el.querySelector('.w-mag'), res: el.querySelector('.w-res') }));
}

/** Location + mission name in the objective panel (activities refresh it when the arena changes). */
export function setMissionHeader() {
  const M = G.mission;
  hud.objLoc.textContent = `${M.loc.planetName}  ·  ${M.loc.name}`;
  hud.objName.textContent = M.def.name;
}

let cmT = 0, hitT = 0, flashV = 0;
export function updateHUD(dt) {
  const P = G.player, M = G.mission, cam = G.camera;
  setStyle(hud.shield, 'sh', 'width', `${(P.shield / P.maxShield) * 100}%`);
  setStyle(hud.health, 'hp', 'width', `${(P.health / P.maxHealth) * 100}%`);
  setStyle(hud.over, 'ov', 'width', `${Math.round((P.over / 60) * 100)}%`);
  setClass(hud.health.parentElement, 'hpbar', 'low', P.health < 40);
  setText(hud.revives, 'rev', M.coop ? `Lives ${Math.max(0, M.lives)}` : `Revives ${Math.max(0, M.revives)}`);
  setText(hud.objText, 'obj', M.objective);
  // vignette
  flashV = Math.max(0, flashV - dt * 2.5);
  setStyle(hud.vig, 'vig', 'opacity', Math.min(1, flashV).toFixed(2));
  // critical health: red closes in below 40% health and is strongest near zero
  const frac = P.health / P.maxHealth;
  const crit = P.dead ? 1 : frac < 0.4 ? (0.4 - frac) / 0.4 : 0;
  setStyle(hud.crit, 'crit', '--k', crit.toFixed(2));
  // abilities
  for (const k of ['grenade', 'melee', 'class']) {
    const a = hud.ab[k];
    const pct = 1 - P.cd[k] / P.cdMax[k];
    setStyle(a.fill, 'ab' + k, 'height', `${Math.round(pct * 100)}%`);
    setClass(a.el, 'ab' + k, 'ready', pct >= 1);
    setClass(a.el, 'hx' + k, 'empowered', P.heart[k] > 0); // Heart of Inmost Light
    if (k === 'grenade') setClass(a.el, 'gb', 'charge2', P.gBank > 0); // Armamentarium
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
  const boss = G.enemies.find((e) => e.isBoss && e.alive && e.spawnT >= 1) || null;
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
export function showDeath(title, sub) {
  const el = $('#death');
  el.classList.remove('hidden');
  el.querySelector('.d-title').textContent = title;
  el.querySelector('.d-sub').textContent = sub;
}
export function updateDeath(text) { const el = $('#death .d-timer'); if (el && el.textContent !== text) el.textContent = text; }
export function hideDeath() { $('#death').classList.add('hidden'); }

export function setLockHint(show) { $('#lock-hint').classList.toggle('hidden', !show); }

// ---------------------------------------------------------------------------
// Pause / complete / failed
// ---------------------------------------------------------------------------
export function showPause() {
  if (G.state !== 'playing' || G.mpMenu) return;
  const coop = !!G.mission?.coop;
  if (coop) G.mpMenu = true; else G.state = 'paused';
  unlockPointer();
  const s = G.save.settings;
  const el = $('#pause');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="modal">
      <div class="eyebrow">${esc(G.mission.def.name)}</div>
      <h1 class="screen-title">${coop ? 'Menu' : 'Paused'}</h1>
      ${coop ? '<p class="desc">Your fireteam keeps playing while this menu is open.</p>' : ''}
      <div class="settings">
        <label>Mouse sensitivity <span id="v-sens">${s.sens.toFixed(2)}</span><input type="range" id="s-sens" min="0.2" max="3" step="0.05" value="${s.sens}"></label>
        <label>Field of view <span id="v-fov">${s.fov}</span><input type="range" id="s-fov" min="65" max="105" step="1" value="${s.fov}"></label>
        <label class="toggle-row">Full Auto <span class="hint">Hold the trigger on semi-auto weapons (fires at the weapon's own rate)</span><input type="checkbox" id="s-auto" ${s.fullAuto ? 'checked' : ''}></label>
        <label>HUD scale <span id="v-hud">${Math.round((s.hudScale ?? 1) * 100)}%</span><input type="range" id="s-hud" min="0.7" max="1.4" step="0.05" value="${s.hudScale ?? 1}"></label>
        <label>Music <span id="v-mus">${Math.round((s.musicVolume ?? 0.5) * 100)}%</span><input type="range" id="s-mus" min="0" max="1" step="0.05" value="${s.musicVolume ?? 0.5}"></label>
        <label>Volume <span id="v-vol">${Math.round(s.volume * 100)}%</span><input type="range" id="s-vol" min="0" max="1" step="0.05" value="${s.volume}"></label>
      </div>
      <div class="row-btns">
        <button class="btn primary" id="p-resume">Resume</button>
        <button class="btn danger" id="p-abandon">${coop ? (net.isHost ? 'End Mission for Fireteam' : 'Leave Mission') : 'Abandon Mission'}</button>
      </div>
      <div class="ctl-grid">${CONTROLS.map(([k, v]) => `<div class="ctl"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div>
    </div>`;
  const P = G.player;
  $('#s-sens').addEventListener('input', (e) => { s.sens = +e.target.value; $('#v-sens').textContent = s.sens.toFixed(2); P.sens = 0.0022 * s.sens; writeSave(G.save); });
  $('#s-fov').addEventListener('input', (e) => { s.fov = +e.target.value; $('#v-fov').textContent = s.fov; P.baseFov = s.fov; writeSave(G.save); });
  $('#s-auto').addEventListener('change', (e) => { s.fullAuto = e.target.checked; writeSave(G.save); });
  $('#s-hud').addEventListener('input', (e) => { s.hudScale = +e.target.value; $('#v-hud').textContent = `${Math.round(s.hudScale * 100)}%`; applyHudScale(); writeSave(G.save); });
  $('#s-mus').addEventListener('input', (e) => { s.musicVolume = +e.target.value; $('#v-mus').textContent = `${Math.round(s.musicVolume * 100)}%`; setMusicVolume(s.musicVolume); writeSave(G.save); });
  $('#s-vol').addEventListener('input', (e) => { s.volume = +e.target.value; $('#v-vol').textContent = `${Math.round(s.volume * 100)}%`; setVolume(s.volume); writeSave(G.save); });
  $('#p-resume').addEventListener('click', resumeGame);
  $('#p-abandon').addEventListener('click', () => { el.classList.add('hidden'); G.mpMenu = false; abandonMission(); });
}

/** In-mission inventory: pick any weapon you own for each slot (pauses solo; co-op keeps running). */
export function showInventory() {
  if (G.state !== 'playing' || G.mpMenu) return;
  const coop = !!G.mission?.coop;
  if (coop) G.mpMenu = true; else G.state = 'paused';
  G.invOpen = true;
  unlockPointer();
  renderInventory();
}

function renderInventory() {
  const s = G.save, P = G.player, el = $('#pause');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="modal wide inv-modal">
      <div class="eyebrow">${esc(G.mission.def.name)}  ·  ${G.mission.coop ? 'Your fireteam keeps playing' : 'Paused'}</div>
      <h1 class="screen-title">Inventory</h1>
      <div class="inv-cols">${WEAPON_SLOTS.map((slot, i) => {
        const items = s.inventory.filter((it) => it.kind === 'weapon' && it.slot === slot).sort((a, b) => b.power - a.power || rarityIndex(b.rarity) - rarityIndex(a.rarity));
        return `<div class="inv-col"><div class="eyebrow">${SLOT_NAMES[slot]}  ·  ${items.length}</div>
          <div class="inv-list">${items.map((it) => {
            const on = P.weapons[i].item.id === it.id, rar = RARITIES[rarityIndex(it.rarity)], el = ELEMENTS[it.element];
            return `<button class="inv-pick ${on ? 'on' : ''}" data-slot="${i}" data-id="${it.id}" style="--rc:${rar.color}">
              <span class="el" style="background:${el.color}" title="${el.name}"></span>
              <span class="inv-n">${esc(it.name)}<small>${rar.name} ${ARCHETYPES[it.arch].name}</small></span>
              <span class="inv-p">${on ? '<em>Equipped</em>' : ''}◆ ${it.power}</span></button>`;
          }).join('')}</div></div>`;
      }).join('')}</div>
      <div class="row-btns"><button class="btn primary" id="inv-close">Back to the fight <kbd>I</kbd></button></div>
    </div>`;
  $$('.inv-pick', el).forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.slot, it = getItem(s, b.dataset.id);
    if (!it || P.weapons[i].item.id === it.id) return;
    equipItem(s, it.id);
    writeSave(s);
    P.swapWeapon(i, it);
    renderWeaponRows();
    sfx.engram(1);
    renderInventory();
  }));
  $('#inv-close', el).addEventListener('click', resumeGame);
}

/** HUD scale setting (70%-140%), applied to every HUD panel through a CSS variable. */
export function applyHudScale() {
  document.documentElement.style.setProperty('--hud-scale', String(G.save?.settings.hudScale ?? 1));
}

export function resumeGame() {
  G.invOpen = false;
  if (G.mpMenu) { G.mpMenu = false; $('#pause').classList.add('hidden'); lockPointer(); return; }
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
      <h1 class="screen-title gold">${M.act ? `${esc(M.act.name)} Complete` : 'Mission Complete'}</h1>
      <div class="m-name-big">${esc(M.def.name)}${M.firstClear ? '<span class="tag new">First clear</span>' : ''}</div>
      <div class="summary">
        <div><b>${fmtTime(G.time * 1000)}</b><span>Time</span></div>
        ${M.act ? `<div><b>${M.wave}</b><span>Waves</span></div>` : ''}
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
        <button class="btn" id="c-inv">View Character</button>
        <button class="btn" id="c-replay">Replay</button>
      </div>
    </div>`;
  $('#c-orbit').addEventListener('click', () => abandonMission());
  $('#c-inv').addEventListener('click', () => { orbitTab = 'character'; flySlot = null; abandonMission(); });
  if (M.coop && !net.isHost) $('#c-replay').remove();
  else $('#c-replay').addEventListener('click', () => { lockPointer(); if (net.isHost) { if (M.act) launchActivity(M.act.id); else launchFireteam(M.li, M.mi); } else retryMission(); });
}

export function showFailed(M) {
  showOnly('failed');
  const cleared = M.act ? (M.phase === 'combat' ? M.wave - 1 : M.wave) : 0;
  const el = $('#failed');
  el.innerHTML = `
    <div class="modal">
      <div class="eyebrow">${M.loc.name}</div>
      <h1 class="screen-title red">${M.act ? `${esc(M.act.name)} Over` : 'Mission Failed'}</h1>
      <p class="desc">${M.act ? `You cleared ${cleared} wave${cleared === 1 ? '' : 's'}${M.act.id === 'endless' && cleared > 0 && cleared >= (G.save.records?.endless || 0) ? ', a new record' : ''}.` : `You ran out of ${M.coop ? 'lives' : 'revives'} in ${esc(M.def.name)}.`} Loot you picked up along the way is yours to keep.</p>
      <div class="summary">${M.act ? `<div><b>${cleared}</b><span>Waves cleared</span></div>` : ''}<div><b>${M.kills}</b><span>Kills</span></div><div><b>${M.loot.length}</b><span>Items found</span></div><div><b>◆ ${playerPower(G.save)}</b><span>Power</span></div></div>
      <div class="row-btns">
        <button class="btn primary" id="f-retry">Retry</button>
        <button class="btn" id="f-orbit">Return to Orbit</button>
      </div>
    </div>`;
  if (M.coop && !net.isHost) $('#f-retry').remove();
  else $('#f-retry').addEventListener('click', () => { lockPointer(); if (net.isHost) { if (M.act) launchActivity(M.act.id); else launchFireteam(M.li, M.mi); } else retryMission(); });
  $('#f-orbit').addEventListener('click', () => abandonMission());
}

// ---------------------------------------------------------------------------
// Co-op HUD bits
// ---------------------------------------------------------------------------
export function makeNameplate(name, color) {
  const el = document.createElement('div');
  el.className = 'nameplate';
  el.style.setProperty('--nc', color);
  el.textContent = name;
  $('#nameplates').appendChild(el);
  return el;
}

export function updateRoster(rows) {
  const el = $('#roster');
  el.classList.toggle('hidden', rows.length < 2);
  el.innerHTML = rows.map((r) => `<div class="ro${r.dead ? ' down' : ''}${r.me ? ' me' : ''}"><span class="ro-dot" style="background:${CLASSES[r.cls]?.color || '#fff'}"></span><span class="ro-n">${esc(r.name)}</span><i><em style="width:${Math.round(clamp(r.h ?? 1, 0, 1) * 100)}%"></em></i></div>`).join('');
}

export function hideOverlays() {
  for (const id of ['pause', 'complete', 'failed']) $('#' + id).classList.add('hidden');
  G.mpMenu = false;
  G.invOpen = false;
}

export function orbitNotice(text) {
  const n = document.createElement('div');
  n.className = 'orbit-toast';
  n.textContent = text;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 4500);
}

/** Show the Install App button only when the browser offers installation. */
export function refreshInstall() {
  $('#install-app')?.classList.toggle('hidden', !G.installPrompt);
}
