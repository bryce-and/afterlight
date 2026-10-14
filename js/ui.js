import * as THREE from 'three';
import { G, lockPointer, unlockPointer } from './state.js';
import { LOCATIONS, CLASSES, RARITIES, ELEMENTS, ARCHETYPES, PERKS, EXOTIC_PERKS, SLOTS, WEAPON_SLOTS, ARMOR_SLOTS, SLOT_NAMES, CONTROLS, AMMO, rarityIndex, classKit, ACTIVITIES, EXOTIC_ARMOR_PERKS } from './data.js';
import { MODS, MODS_LEVEL, modsUnlockedAt, STAT_KEYS, STATS, activeMods, energyCap, energyUsed } from './armor.js';
import { openMods } from './mods-ui.js';
import { getLoadout, setLoadout, wornAppearance, applyShader, switchCharacter, charPower, playedClasses, usableBy, subclassFor } from './save.js';
import { GRENADES, CLASS_ABILITIES, ASPECTS, FRAGMENTS, ASPECT_SLOTS, grenadesFor, classAbilitiesFor, aspectsFor, fragmentsFor, aspectLevel, fragmentLevel, fragmentSlots, buildUnlocksAt } from './subclass.js';
import { abilityIcon, emptySlotIcon } from './ability-icons.js';
import { activeKit, playerPower, getEquipped, getItem, equipItem, dismantleItem, infuseInfo, infuseItem, isEquipped, isUnlocked, createSave, writeSave, resetSave, INVENTORY_CAP, VAULT_CAP, toVault, fromVault, playerLevel, isSubclassUnlocked, rewardState, claimLevelReward, takeLegacyNotice } from './save.js';
import { LEVEL_CAP, levelInfo, rewardAt, subclassLevel, subclassesUnlockedAt } from './progression.js';
import { RELEASES, ROADMAP } from './releases.js';
import { dismantleValue } from './loot.js';
import { weaponIcon, elementIcon, armorIcon, subclassIcon, factionIcon, FACTION_NAMES, setArmorIconContext } from './icons.js';
import { SETS, SET_PIECES, SHADERS, SHADER_IDS, setCounts, shaderFor } from './style.js';
import { frameDef, weaponHandling } from './frames.js';
import { startMission, startActivity, newSeed, retryMission, abandonMission, getHitTargets } from './game.js';
import { dmgDrift, HUD_SCALE } from './combat.js';
import { initAudio, setVolume, sfx } from './audio.js';
import { playMusic, setMusicVolume } from './music.js';
import { esc, clamp } from './util.js';
import { net, createFireteam, joinFireteam, leaveFireteam, setSelection, setReady, readyState, MAX_FIRETEAM } from './net.js';
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
  // Ready Up: the last member to ready launches the leader's pick for the whole fireteam
  net.onAllReady = (sel) => {
    if (G.state !== 'orbit') return;
    initAudio();
    if (sel.li === -1) launchActivity(ACTIVITIES[sel.mi].id); else launchFireteam(sel.li, sel.mi);
    lockPointer(); // works when the leader's own click was the last ready; otherwise the next click captures the mouse
  };
  $('#title').addEventListener('click', () => {
    initAudio();
    sfx.ui();
    if (G.save) showCharacterSelect(); else showClassSelect();
  });
  // Update Log / Roadmap: clicks inside them must not start the game
  for (const el of [$('#t-links'), $('#t-panel'), $('#t-notice')]) el.addEventListener('click', (e) => e.stopPropagation());
  $('#t-log').addEventListener('click', () => { sfx.ui(); openTitlePanel('log'); });
  $('#t-road').addEventListener('click', () => { sfx.ui(); openTitlePanel('roadmap'); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && G.state === 'title') closeTitlePanel(); });
}

function openTitlePanel(kind) {
  const p = $('#t-panel');
  const log = kind === 'log';
  const body = log
    ? RELEASES.map((r) => `
      <article class="tp-entry" style="--ac:${r.accent}">
        <div class="tp-glyph">${r.glyph}</div>
        <div><div class="tp-meta">Version ${esc(r.version)}  ·  ${esc(r.date)}</div><h2>${esc(r.name)}</h2><p>${esc(r.summary)}</p>
        <ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>
      </article>`).join('')
    : ROADMAP.map((r) => `
      <article class="tp-entry" style="--ac:${r.accent}">
        <div class="tp-glyph">${r.glyph}</div>
        <div><div class="tp-meta"><span class="tp-status">${esc(r.status)}</span></div><h2>${esc(r.name)}</h2><p>${esc(r.teaser)}</p>
        <div class="tp-themes">${r.themes.map((t) => `<span>${esc(t)}</span>`).join('')}</div></div>
      </article>`).join('');
  p.innerHTML = `
    <div class="tp-head"><div><div class="eyebrow">Afterlight</div><h1 class="screen-title">${log ? 'Update Log' : 'Roadmap'}</h1>
      <p class="desc">${log ? 'Everything that has arrived so far.' : 'A glimpse of what lies ahead. Nothing here is final.'}</p></div>
      <button class="btn" id="tp-back">Back</button></div>
    <div class="tp-list">${body}</div>`;
  p.classList.remove('hidden');
  $('#title .title-wrap').classList.add('hidden');
  $('#tp-back').addEventListener('click', () => { sfx.ui(); closeTitlePanel(); });
}

function closeTitlePanel() {
  $('#t-panel').classList.add('hidden');
  $('#title .title-wrap').classList.remove('hidden');
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
  // the current update: its artwork, name and version
  const cur = RELEASES[0];
  $('#t-update').innerHTML = `<div class="tu-art">${cur.art || ''}</div><div class="tu-info"><span>Version ${esc(cur.version)}</span><b style="color:${cur.accent}">${esc(cur.name)}</b></div>`;
  closeTitlePanel();
  if (takeLegacyNotice()) {
    const n = $('#t-notice');
    n.textContent = 'Afterlight has been reborn. Every Guardian begins anew in First Light. Your settings carry over.';
    n.classList.remove('hidden');
  }
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
              ${Object.values(c.subclasses).map((sc) => `<li><b style="color:${sc.color}">${sc.name} (${ELEMENTS[sc.element].name})${sc.unlockLevel ? `<em class="cls-lock">Level ${sc.unlockLevel}</em>` : ''}</b><span>${sc.tagline} Super: ${sc.abilities.super.name}.</span></li>`).join('')}
              <li><b>${c.jumpName}</b><span>Movement ability</span></li>
            </ul>
            <div class="cls-pick">Select</div>
          </button>`).join('')}
      </div>
      ${fromOrbit ? '<button class="btn ghost" id="cls-back">Back</button>' : ''}
    </div>`;
  $$('.cls-card', el).forEach((b) => b.addEventListener('click', () => {
    sfx.ui();
    if (G.save) switchCharacter(G.save, b.dataset.cls);
    else G.save = createSave(b.dataset.cls);
    showOrbit();
  }));
  $('#cls-back', el)?.addEventListener('click', () => showOrbit());
}

/** Character select: one Guardian per class. Played ones show their Light; the others start fresh with their own armor. */
export function showCharacterSelect(fromOrbit = false) {
  const s = G.save;
  G.state = 'classes';
  showOnly('classes');
  G.menu.setMode('planet');
  G.menu.setOffset(0);
  const played = playedClasses(s), lvl = playerLevel(s);
  const card = (c) => {
    if (!played.includes(c.id)) {
      return `<button class="chs-card new" data-cls="${c.id}" style="--cc:${c.color}">
        <div class="chs-emblem">+</div>
        <div class="chs-info"><b>${c.name}</b><span>New Guardian  ·  starts with a fresh kit</span></div>
        <div class="chs-pow"><small>Create</small></div></button>`;
    }
    const sc = c.subclasses[subclassFor(s, c.id)];
    return `<button class="chs-card${c.id === s.classId ? ' cur' : ''}" data-cls="${c.id}" style="--cc:${sc.color}">
      <div class="chs-emblem">${subclassIcon(sc.color)}</div>
      <div class="chs-info"><b>${c.name}</b><span>${sc.name}  ·  ${ELEMENTS[sc.element].name}</span></div>
      <div class="chs-pow"><span>◆ ${charPower(s, c.id)}</span><small>Level ${lvl}</small></div></button>`;
  };
  $('#classes').innerHTML = `
    <div class="chs-wrap">
      <div class="eyebrow">Afterlight</div>
      <h1 class="screen-title">Choose your Guardian</h1>
      <div class="chs-list">${Object.values(CLASSES).map(card).join('')}</div>
      <p class="desc chs-note">Your level, glimmer, shaders and the vault are shared. Each Guardian has its own gear and Light: move items between them through the vault. Armor belongs to one class.</p>
      ${fromOrbit ? '<button class="btn ghost" id="chs-back">Back</button>' : ''}
    </div>`;
  $$('.chs-card').forEach((b) => b.addEventListener('click', () => {
    sfx.ui();
    switchCharacter(s, b.dataset.cls);
    flySlot = null; vaultOpen = false;
    showOrbit();
  }));
  $('#chs-back')?.addEventListener('click', () => { sfx.ui(); showOrbit(); });
}

// ---------------------------------------------------------------------------
// Orbit (director / inventory / character)
// ---------------------------------------------------------------------------
let orbitTab = 'director', selLoc = null, selMission = null, selAct = 0;

export function showOrbit(tab) {
  G.state = 'orbit';
  if (tab) orbitTab = tab;
  if (!['director', 'activities', 'level'].includes(orbitTab)) orbitTab = 'character';
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
  let readyRewards = 0;
  for (let L = 1; L <= LEVEL_CAP; L++) if (rewardState(s, L) === 'ready') readyRewards++;
  $('#orbit').innerHTML = `
    <header class="topbar">
      <button class="brand" id="brand" title="Back to the title screen">AFTERLIGHT</button>
      <nav class="tabs">
        ${['director', 'activities', 'character', 'level'].map((t) => `<button class="tab ${orbitTab === t ? 'on' : ''}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}${t === 'character' && newCount ? `<span class="badge">${newCount}</span>` : ''}${t === 'level' && readyRewards ? `<span class="badge">${readyRewards}</span>` : ''}</button>`).join('')}
      </nav>
      <button class="btn install-app hidden" id="install-app" title="Install Afterlight as an app">Install App</button>
      <div class="pstats">
        <span class="cls-chip" style="--cc:${cls.color}">${cls.name}</span>
        <span class="lvl-chip" title="Guardian level">Lv ${playerLevel(s)}</span>
        <span class="power" title="Light">◆ ${playerPower(s)}</span>
        <span class="glimmer" title="Glimmer">⬡ ${s.glimmer.toLocaleString()}</span>
      </div>
    </header>
    <main id="orbit-main" class="tab-${orbitTab}"></main>`;
  $$('.tab').forEach((b) => b.addEventListener('click', () => { sfx.ui(); orbitTab = b.dataset.tab; renderOrbit(); }));
  $('#brand').addEventListener('click', () => {
    if (net.active && !confirm('Return to the title screen? You will leave your fireteam.')) return;
    sfx.ui();
    if (net.active) leaveFireteam();
    showTitle();
  });
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
  else if (orbitTab === 'level') renderLevel(main);
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
  // the leader's pick (set before drawing, so the Ready Up bar shows it)
  if (net.isHost && m && (net.sel?.li !== selLoc || net.sel?.mi !== selMission)) setSelection(selLoc, selMission);
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
          <div class="power-cmp">Your Light <b>◆ ${pp}</b>${m ? (diff < -4 ? `<span class="warn">Underpowered by ${-diff}</span>` : diff >= 0 ? '<span class="ok">Ready</span>' : '<span class="meh">Slightly under</span>') : ''}</div>
          ${net.active ? readyBarHTML() : `<button id="launch" class="btn primary" ${m ? '' : 'disabled'}>Launch</button>`}
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
  wireFireteam(main);
}

function renderActivities(main) {
  const s = G.save;
  G.menu.setMode('planet');
  G.menu.setLocation(LOCATIONS[selLoc]);
  G.menu.setOffset(4.4);
  const a = ACTIVITIES[selAct];
  const best = s.records?.endless || 0;
  if (net.isHost && (net.sel?.li !== -1 || net.sel?.mi !== selAct)) setSelection(-1, selAct);
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
            <div class="m-desc">Fights take place in the boss arenas of every destination, in a random order. Wave ${a.arenaEvery}, ${a.arenaEvery * 2} and ${a.arenaEvery * 3} bring that arena's boss. Each new arena sends denser waves. Enemies scale to your Light and get tougher every wave.</div>
            <div class="m-foot"><span class="tag">Cache every ${a.chestEvery} waves</span><span class="tag">New arena every ${a.arenaEvery} waves</span>${a.waves === Infinity ? '' : '<span class="tag exo">Guaranteed exotic at the end</span>'}</div></div>
          <div class="mission"><div class="m-top"><span class="m-name">Fireteam lives</span></div>
            <div class="m-desc">Solo: 3 revives. Two players share 3 lives, three players share 5. Hold E next to a downed teammate to revive them for free; after ${18} seconds a life brings them back. If everyone goes down with no lives left, the run ends.</div></div>
        </div>
        <div class="launch-row">
          <div class="power-cmp">Your Light <b>◆ ${playerPower(s)}</b><span class="ok">Scales to you</span></div>
          ${net.active ? readyBarHTML() : '<button id="launch" class="btn primary">Launch</button>'}
        </div>
      </section>
    </div>`;
  $$('.loc', main).forEach((b) => b.addEventListener('click', () => { sfx.ui(); selAct = +b.dataset.act; renderOrbit(); }));
  $('#launch', main)?.addEventListener('click', () => {
    initAudio();
    lockPointer();
    startActivity(a.id, newSeed());
  });
  wireFireteam(main);
}

/** Fireteam launch: one segment per Guardian; when the last one readies up, the leader's pick launches. */
function readyBarHTML() {
  const st = readyState(net.members, net.ready, net.sel);
  const me = net.ready.includes(net.myId);
  const pick = !net.sel ? null : net.sel.li === -1 ? ACTIVITIES[net.sel.mi] : LOCATIONS[net.sel.li]?.missions[net.sel.mi];
  return `<div class="ready-bar">
    <div class="rb-head"><span>${pick ? `Ready Up  ·  ${esc(pick.name)}` : 'Waiting for the leader to pick'}</span><b>${st.count}/${st.total}</b></div>
    <div class="rb-segs">${net.members.map((mm) => `<span class="rb-seg${net.ready.includes(mm.id) ? ' on' : ''}" style="--nc:${CLASSES[mm.cls]?.color || '#fff'}"><b>${esc(mm.name)}</b><i>${net.ready.includes(mm.id) ? 'Ready' : 'Not ready'}</i></span>`).join('')}</div>
    <button id="ready" class="btn ${me ? '' : 'primary'}" ${net.sel ? '' : 'disabled'}>${me ? 'Cancel' : 'Ready Up'}</button>
  </div>`;
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
    ${net.isClient ? `<div class="ft-status">${sel ? `Leader picked: ${esc(sel.name)}` : 'Waiting for the leader to pick a mission'}</div>` : '<div class="ft-status">You lead. Pick a mission; it launches when everyone is ready.</div>'}
    <button class="btn ghost" id="ft-leave">Leave Fireteam</button>
  </div>`;
}

function wireFireteam(main) {
  $('#ready', main)?.addEventListener('click', () => { initAudio(); sfx.ui(); setReady(!net.ready.includes(net.myId)); });
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
  return `${it.classId ? `${CLASSES[it.classId].name} ` : ''}${SLOT_NAMES[it.slot]}`;
}

function itemCard(it, { equipped = false, selected = false, compact = false } = {}) {
  const rar = RARITIES[rarityIndex(it.rarity)];
  const el = it.kind === 'weapon' ? ELEMENTS[it.element] : null;
  return `<div class="item r-${it.rarity} ${selected ? 'sel' : ''} ${compact ? 'compact' : ''}" data-id="${it.id}" style="--rc:${rar.color}">
    <div class="it-top">${el ? elementIcon(it.element) : ''}<span class="it-name">${esc(it.name)}</span></div>
    <div class="it-sub">${rar.name} ${typeLine(it)}</div>
    <div class="it-power">◆ ${it.power}${it.kind === 'weapon' ? `<span class="ammo-ico" style="--ac:${AMMO[it.slot].color}" title="${AMMO[it.slot].name} ammo"></span>` : ''}</div>
    ${it.isNew ? '<span class="new-dot">New</span>' : ''}${equipped ? '<span class="eq">Equipped</span>' : ''}
  </div>`;
}

// ---------------------------------------------------------------------------
// Character screen (Destiny-style): model in the middle, weapons left, armour right
// ---------------------------------------------------------------------------
let flySlot = null, hoverId = null, dismantle = null, vaultOpen = false, modsScreen = null;

function tileHTML(it, equipped = false) {
  const rar = RARITIES[rarityIndex(it.rarity)];
  const weapon = it.kind === 'weapon';
  const art = weapon ? `<img src="${weaponIcon(it)}" alt="" draggable="false">` : armorIcon(it);
  const other = !weapon && it.classId && it.classId !== G.save.classId;
  return `<button class="tile r-${it.rarity}${equipped ? ' equipped' : ''}${other ? ' other-class' : ''}" data-id="${it.id}" style="--rc:${rar.color}" aria-label="${esc(it.name)}">
    ${art}${other ? `<span class="t-cls">${CLASSES[it.classId].name}</span>` : ''}
    ${weapon ? `${elementIcon(it.element, 'el-ico t-el')}<span class="t-ammo ammo-ico" style="--ac:${AMMO[it.slot].color}"></span>` : ''}
    <span class="t-power">${it.power}</span>${it.isNew ? '<i class="t-new"></i>' : ''}
  </button>`;
}

// ---------------------------------------------------------------------------
// Level: XP progress and the reward track
// ---------------------------------------------------------------------------
function renderLevel(main) {
  const s = G.save;
  G.menu.setMode('planet');
  const info = levelInfo(s.progression.xp);
  const node = (L) => {
    const kind = rewardAt(L), state = rewardState(s, L);
    const sub = subclassesUnlockedAt(L).find((x) => x.classId === s.classId);
    const build = buildUnlocksAt(L, s.classId)[0]; // an aspect or fragment that unlocks here
    const reached = info.level >= L;
    let icon = '', label = '';
    if (kind === 'exotic') { icon = '<i class="lt-engram exo"></i>'; label = 'Exotic'; }
    else if (kind === 'legendary') { icon = '<i class="lt-engram leg"></i>'; label = 'Legendary'; }
    else if (sub) { icon = subclassIcon(CLASSES[s.classId].subclasses[sub.subId].color); label = sub.name; }
    else if (build) {
      const color = build.type === 'aspect' ? CLASSES[s.classId].subclasses[build.sub].color : ELEMENTS[build.element].color;
      icon = abilityIcon(build.type, build.id, color);
      label = `${build.type === 'aspect' ? 'Aspect' : 'Fragment'}: ${build.name}`;
    }
    const mods = L === MODS_LEVEL ? [] : modsUnlockedAt(L).map((id) => MODS[id]);
    if (L === MODS_LEVEL) { if (!icon) { icon = abilityIcon('fragment', 'mods', '#cdb6ff'); label = 'Armor Mods'; } else label += '<br>+ Armor Mods'; }
    else if (mods.length) { const t = mods.map((m) => m.name).join(', '); if (!icon) { icon = abilityIcon('fragment', mods[0].id, '#cdb6ff'); label = `Mod: ${t}`; } else label += `<br>+ Mod: ${t}`; }
    const unlock = sub || build || mods.length || L === MODS_LEVEL;
    const cls = ['lt-node', reached ? 'reached' : '', L === info.level ? 'current' : '', state ? `r-${state}` : '', kind || unlock ? 'has' : ''].join(' ');
    const action = state === 'ready' ? `<button class="btn primary lt-claim" data-l="${L}">Claim</button>`
      : state === 'claimed' ? '<span class="lt-done">Claimed</span>'
      : unlock && reached ? '<span class="lt-done">Unlocked</span>' : '';
    return `<div class="${cls}"><div class="lt-l">${L}</div><div class="lt-r">${icon}</div><div class="lt-label">${label}</div>${action}</div>`;
  };
  const third = Object.keys(CLASSES[s.classId].subclasses).map((id) => subclassLevel(s.classId, id)).reduce((a, b) => Math.max(a, b), 1);
  main.innerHTML = `
    <div class="lvl">
      <div class="lvl-head">
        <div><div class="eyebrow">Guardian Level</div><div class="lvl-big">${info.level}<small>/ ${LEVEL_CAP}</small></div></div>
        <div class="lvl-xp">${info.max ? '<b>Max level</b>' : `<div class="xp-track big"><div class="xp-fill" style="width:${((info.into / info.need) * 100).toFixed(1)}%"></div></div>
          <div class="lvl-xp-t">${info.into.toLocaleString()} / ${info.need.toLocaleString()} XP to level ${info.level + 1}</div>`}</div>
        <p class="desc">Earn XP from every kill, mission and cache. A Legendary every three levels, Exotics at 20 and 40, your third subclass at level ${third}, then its last aspect and new fragments. Item rewards wait here until you claim them.</p>
      </div>
      <div class="lt-track" id="lt-track">${Array.from({ length: LEVEL_CAP }, (_, i) => node(i + 1)).join('')}</div>
    </div>`;
  const track = $('#lt-track', main);
  const cur = track.querySelector('.lt-node.current');
  if (cur) track.scrollLeft = cur.offsetLeft - track.clientWidth / 2 + cur.clientWidth / 2;
  track.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { track.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  $$('.lt-claim', main).forEach((b) => b.addEventListener('click', () => {
    const res = claimLevelReward(s, +b.dataset.l);
    if (res.error) { sfx.denied(); orbitNotice(res.error); return; }
    sfx.engram(rarityIndex(res.item.rarity));
    orbitNotice(`Acquired ${res.item.name}  ·  ${RARITIES[rarityIndex(res.item.rarity)].name}`);
    const left = track.scrollLeft;
    renderOrbit();
    $('#lt-track').scrollLeft = left;
  }));
}

function renderCharScreen(main) {
  const s = G.save;
  const cls = activeKit(s);
  const el = ELEMENTS[cls.element];
  G.menu.setMode('character', s.classId, cls.element, wornAppearance(s));
  const shader = shaderFor(s.shaders, s.classId);
  setArmorIconContext(s.classId, cls.element, shader);
  const worn = ARMOR_SLOTS.map((sl) => getEquipped(s, sl)).filter(Boolean);
  const sets = Object.entries(setCounts(worn)).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2); // set progress worth showing
  const slot = (sl) => {
    const it = getEquipped(s, sl);
    const hasNew = s.inventory.some((i) => i.slot === sl && i.isNew && usableBy(i, s.classId));
    return `<div class="cs-slot" data-slot="${sl}"><div class="cs-label">${SLOT_NAMES[sl]}${hasNew ? '<i class="dot"></i>' : ''}</div>${it ? tileHTML(it, true) : '<div class="tile empty"></div>'}</div>`;
  };
  main.innerHTML = `
    <div class="cs">
      <div class="cs-head">
        <div class="cs-class" style="color:${cls.color}">${cls.name}</div>
        <div class="cs-sub">${cls.subclass}  ·  ${el.name}</div>
      </div>
      <div class="cs-power"><span class="pw">◆</span>${playerPower(s)}<small>Light</small></div>
      <div class="cs-col left">
        <div class="cs-row">
          <div class="cs-slot" data-slot="shader"><div class="cs-label">Shader</div><button class="tile shader-tile" id="cs-shader" aria-label="Shader: ${shader ? esc(SHADERS[shader].name) : 'none'}" title="${shader ? esc(SHADERS[shader].name) : 'No shader'}">${shaderSwatch(shader)}</button></div>
          <div class="cs-slot"><div class="cs-label">Subclass</div><button class="tile subclass" id="cs-sub" style="--rc:${el.color}" aria-label="Subclass">${subclassIcon(el.color)}</button></div>
        </div>
        ${WEAPON_SLOTS.map(slot).join('')}
      </div>
      <div class="cs-stage" id="cs-stage" title="Drag to rotate"></div>
      <div class="cs-col right">${ARMOR_SLOTS.map(slot).join('')}
        ${sets.length ? `<div class="cs-sets">${sets.map(([id, n]) => `<div class="cs-set${n >= SET_PIECES ? ' on' : ''}" title="${esc(`${SETS[id].bonus.name}: ${SETS[id].bonus.desc}`)}"><b>${SETS[id].name}</b><span>${Math.min(n, 4)} / 4</span></div>`).join('')}</div>` : ''}
      </div>
      <div class="cs-foot">
        <span>⬡ ${s.glimmer.toLocaleString()}</span><span>${s.inventory.length} / ${INVENTORY_CAP} items</span>
        <button class="btn cs-vault-btn cs-switch" id="cs-switch" title="Choose another Guardian">⇄ Characters</button>
        <button class="btn cs-vault-btn" id="cs-vault-btn">Vault <small>${s.vault.length} / ${VAULT_CAP}</small></button>
        <span class="cs-auto" title="Weapon and armor drops of these rarities are dismantled into glimmer automatically">Auto-dismantle
          ${['common', 'uncommon', 'rare'].map((r) => `<button class="cs-auto-t ${s.settings.autoDismantle?.[r] ? 'on' : ''}" data-r="${r}" style="--rc:${RARITIES[rarityIndex(r)].color}">${{ common: 'White', uncommon: 'Green', rare: 'Blue' }[r]}</button>`).join('')}</span>
        <button class="btn danger cs-reset" id="cs-reset">Reset Character</button>
        <span class="hint">Click a slot to swap  ·  Hover for details  ·  Hold <kbd>F</kbd> to dismantle  ·  <kbd>Shift</kbd>+Click to infuse</span>
      </div>
      <button class="cs-mods-arrow" id="cs-mods-btn" title="${playerLevel(s) < MODS_LEVEL ? `Armor stats (mods unlock at level ${MODS_LEVEL})` : 'Armor stats and mods'}"><span>${playerLevel(s) < MODS_LEVEL ? 'Stats' : 'Mods'}</span><i>❯</i></button>
      <div class="cs-fly hidden" id="cs-fly"></div>
      <div class="cs-tip hidden" id="cs-tip"></div>
      <div class="cs-panel hidden" id="cs-panel"></div>
      <div class="cs-vault hidden" id="cs-vault"></div>
    </div>`;

  const root = $('.cs', main);
  root.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-id]');
    if (t) showTip(t); else if (!e.target.closest('#cs-tip')) hideTip();
  });
  root.addEventListener('mouseleave', hideTip);
  root.addEventListener('click', (e) => {
    if (e.target.closest('#cs-vault')) return; // the vault handles its own clicks
    const opt = e.target.closest('.sh-opt');
    if (opt) {
      if (opt.classList.contains('locked')) { sfx.denied(); orbitNotice('Shaders drop from mission caches.'); return; }
      const err = applyShader(s, opt.dataset.sh || null);
      if (err) { sfx.denied(); orbitNotice(err); return; }
      sfx.engram(1); flySlot = null; renderOrbit();
      return;
    }
    const t = e.target.closest('.tile');
    if (e.target.closest('#cs-sub')) { openSubclass(); return; }
    if (e.target.closest('#cs-shader')) { toggleFly('shader', e.target.closest('#cs-shader')); return; }
    if (t && t.dataset.id) {
      const it = getItem(s, t.dataset.id);
      if (t.closest('.cs-slot')) { toggleFly(it.slot, t); return; }
      if (e.shiftKey) { if (infuseItem(s, it.id)) { sfx.engram(3); flySlot = null; renderOrbit(); } else sfx.denied(); return; }
      const blocker = equipItem(s, it.id);
      if (typeof blocker === 'string') { sfx.denied(); orbitNotice(blocker); return; }
      if (blocker) { sfx.denied(); orbitNotice(`Swap out ${blocker.name} first: only one exotic ${blocker.kind === 'weapon' ? 'weapon' : 'armor piece'} at a time.`); return; }
      sfx.engram(1);
      flySlot = null;
      renderOrbit();
      return;
    }
    if (!e.target.closest('#cs-fly') && !e.target.closest('#cs-panel')) closeFly();
  });
  $('#cs-mods-btn', main).addEventListener('click', () => {
    sfx.ui(); closeFly(); closeVault();
    modsScreen = openMods(root, () => { /* stats refresh when the screen closes */ }, () => { modsScreen = null; renderOrbit(); });
  });
  if (s.armorNote) {
    orbitNotice(`Armor 2.0: perks are now mods and armor has six stats.${s.armorNote.dropped ? ` ${s.armorNote.dropped} perk${s.armorNote.dropped > 1 ? 's' : ''} did not fit their piece and were removed (the mods are yours to socket from level ${MODS_LEVEL}).` : ''}`);
    delete s.armorNote; writeSave(s);
  }
  $('#cs-switch', main).addEventListener('click', () => { sfx.ui(); closeFly(); closeVault(); showCharacterSelect(true); });
  $('#cs-vault-btn', main).addEventListener('click', () => { sfx.ui(); closeFly(); vaultOpen = true; renderVault(); });
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
  if (vaultOpen) renderVault();
}

// Vault: click an item to move it between the character and the vault
const SLOT_ORDER = [...WEAPON_SLOTS, ...ARMOR_SLOTS];
const vaultSort = (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || rarityIndex(b.rarity) - rarityIndex(a.rarity) || b.power - a.power;

function renderVault() {
  const s = G.save, v = $('#cs-vault');
  if (!v) return;
  const mine = s.inventory.filter((i) => !isEquipped(s, i)).sort(vaultSort);
  const stored = [...s.vault].sort(vaultSort);
  const grid = (items, empty) => (items.length ? `<div class="vault-grid">${items.map((it) => tileHTML(it)).join('')}</div>` : `<div class="fly-empty">${empty}</div>`);
  v.innerHTML = `
    <div class="vault-head"><div class="sp-title">Vault</div><button class="sp-x" id="vault-close" aria-label="Close vault">✕</button></div>
    <div class="vault-cols">
      <section class="vault-col" data-side="char"><div class="fly-head">Character<span>${s.inventory.length} / ${INVENTORY_CAP}</span></div>
        ${grid(mine, 'Nothing unequipped to store. Equipped gear stays on your character.')}</section>
      <section class="vault-col" data-side="vault"><div class="fly-head">Vault<span>${s.vault.length} / ${VAULT_CAP}</span></div>
        ${grid(stored, 'The vault is empty. Click gear on the left to store it here.')}</section>
    </div>
    <div class="vault-hint">Click an item to move it to the other side</div>`;
  v.classList.remove('hidden');
  $('#vault-close', v).addEventListener('click', closeVault);
  $$('.tile[data-id]', v).forEach((t) => t.addEventListener('click', () => {
    const toChar = !!t.closest('[data-side="vault"]');
    const err = toChar ? fromVault(s, t.dataset.id) : toVault(s, t.dataset.id);
    hideTip();
    if (err) { sfx.denied(); orbitNotice(err); return; }
    sfx.engram(1);
    renderOrbit(); // counts in the footer change too; reopens the vault
  }));
}

function closeVault() {
  vaultOpen = false;
  hideTip();
  $('#cs-vault')?.classList.add('hidden');
}

function toggleFly(sl, anchor) {
  sfx.ui();
  if (flySlot === sl) { closeFly(); return; }
  openFly(sl, anchor);
}

function openFly(sl, anchor) {
  const s = G.save;
  flySlot = sl;
  const fly = $('#cs-fly');
  if (sl === 'shader') fly.innerHTML = shaderFlyHTML(s);
  else {
    const items = s.inventory.filter((i) => i.slot === sl && !isEquipped(s, i) && usableBy(i, s.classId))
      .sort((a, b) => b.power - a.power || rarityIndex(b.rarity) - rarityIndex(a.rarity));
    fly.innerHTML = `<div class="fly-head">${SLOT_NAMES[sl]}<span>${items.length}</span></div>
      ${items.length ? `<div class="fly-grid">${items.map((it) => tileHTML(it)).join('')}</div>` : '<div class="fly-empty">Nothing else for this slot yet. Engrams drop from enemies and boss caches.</div>'}`;
  }
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

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
/** A shader as a swatch: armor, trim and cloth colors. null = the armor's own colors. */
function shaderSwatch(id) {
  if (!id) return '<span class="sh-sw none"><i></i></span>';
  const c = SHADERS[id].colors;
  return `<span class="sh-sw" style="--a:${hex(c.armor)};--t:${hex(c.trim)};--c:${hex(c.cloth)}"><i></i></span>`;
}

function shaderFlyHTML(s) {
  const cur = shaderFor(s.shaders, s.classId), owned = s.shaders.owned;
  const opt = (id) => {
    const have = id === null || owned.includes(id), on = id === cur;
    const name = id ? (have ? SHADERS[id].name : 'Not found yet') : 'Default';
    return `<button class="sh-opt${on ? ' on' : ''}${have ? '' : ' locked'}" data-sh="${id || ''}" title="${esc(name)}">${have ? shaderSwatch(id) : '<span class="sh-sw lock">?</span>'}<small>${esc(name)}</small></button>`;
  };
  return `<div class="fly-head">Shader<span>${owned.length} / ${SHADER_IDS.length}</span></div>
    <div class="sh-grid">${[null, ...SHADER_IDS].map(opt).join('')}</div>
    <div class="fly-note">Recolors all of your ${CLASSES[s.classId].name}'s armor. Shaders drop from mission caches.</div>`;
}

function closeFly() {
  flySlot = null;
  hideTip();
  $('#cs-fly')?.classList.add('hidden');
  $$('.cs-slot').forEach((n) => n.classList.remove('open'));
}

function tipHTML(it, side) {
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
    const A = weaponHandling(it), st = it.stats, el = ELEMENTS[it.element], am = AMMO[it.slot], fr = frameDef(it);
    const cs = cmp && cmp.arch === it.arch ? cmp.stats : null;
    const row = (label, v, max, txt, cv, inv) => `<div class="tt-stat"><span>${label}</span><i><em style="width:${clamp((v / max) * 100, 3, 100)}%"></em></i><b>${txt}${cs ? delta(v, cv, inv) : ''}</b></div>`;
    body += `<div class="tt-top"><div class="tt-pow">${it.power}${cmp ? delta(it.power, cmp.power) : ''}</div><div class="tt-tags"><span class="tt-el" style="color:${el.color}">${elementIcon(it.element)}${el.name}</span><span class="ammo-chip" style="--ac:${am.color}"><span class="ammo-ico"></span>${am.name}</span></div></div>`;
    body += '<div class="tt-stats">';
    const B = ARCHETYPES[it.arch], bp = B.pellets || 1, pel = A.pellets || 1; // bars scale to the family, not the archetype
    body += row('Impact', st.dmg * pel, B.dmg * bp * 1.6, Math.round(st.dmg) + (pel > 1 ? `×${pel}` : ''), cs && cs.dmg * (weaponHandling(cmp).pellets || 1));
    body += row('Rate of Fire', st.rpm, B.rpm * 1.6, `${st.rpm}`, cs && cs.rpm);
    body += row('Magazine', st.mag, B.mag * 1.6, st.mag, cs && cs.mag);
    body += row('Reload', 1 / st.reload, (1 / B.reload) * 1.6, `${st.reload.toFixed(1)}s`, cs && 1 / cs.reload);
    body += row('Range', st.range, B.range * 1.6, `${st.range}m`, cs && cs.range);
    body += '</div>';
    if (fr) body += `<div class="tt-frame"><span>Archetype</span><b>${fr.name}</b><em>${fr.desc}</em></div>`;
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
    for (const k of STAT_KEYS) {
      body += `<div class="tt-stat"><span>${STATS[k].name}</span><i><em style="width:${clamp((st[k] / 20) * 100, 3, 100)}%"></em></i><b>${st[k]}${c ? delta(st[k], c[k]) : ''}</b></div>`;
    }
    const sum = (o) => STAT_KEYS.reduce((n, k) => n + (o[k] || 0), 0);
    body += `<div class="tt-stat total"><span>Total</span><i></i><b>${sum(st)}${c ? delta(sum(st), sum(c)) : ''}</b></div></div>`;
    if (it.set && SETS[it.set] && it.rarity !== 'exotic') {
      const set = SETS[it.set], n = setCounts(ARMOR_SLOTS.map((sl) => getEquipped(s, sl)).filter(Boolean))[it.set] || 0;
      body += `<div class="tt-set${n >= SET_PIECES ? ' on' : ''}"><span>${esc(set.name)} set  ·  ${set.dest}  ·  ${Math.min(n, 4)} / 4 equipped</span><b>${esc(set.bonus.name)}</b><em>${esc(set.bonus.desc)}${n >= SET_PIECES ? '' : ` Equip ${SET_PIECES} pieces of this set.`}</em></div>`;
    }
    const xp = it.rarity === 'exotic' && EXOTIC_ARMOR_PERKS[it.name];
    if (xp) body += `<div class="tt-perks"><div class="tt-perk exo"><i></i><div><b>${xp.name}</b><span>${xp.desc}</span></div></div></div>`;
    const lv = playerLevel(s), live = activeMods(it, lv);
    const socketed = (it.mods || []).filter(Boolean);
    if (socketed.length) body += `<div class="tt-perks">${socketed.map((id) => `<div class="tt-perk${live.includes(id) ? '' : ' idle'}"><i></i><div><b>${MODS[id].name}</b><span>${live.includes(id) ? MODS[id].desc : lv < MODS_LEVEL ? `Unlocks at level ${MODS_LEVEL}.` : 'Not active (locked or over energy).'}</span></div></div>`).join('')}</div>`;
    body += `<div class="tt-note">Mods ${energyUsed(it.mods)} / ${energyCap(it)} energy${lv < MODS_LEVEL ? `  ·  unlock at level ${MODS_LEVEL}` : ''}</div>`;
    if (it.rarity === 'exotic') body += '<div class="tt-note">Only one exotic armor piece can be equipped.</div>';
    if (!usableBy(it, s.classId)) body += `<div class="tt-note">Only a ${CLASSES[it.classId].name} can wear this.</div>`;
  }
  if (it.kind === 'weapon' && it.rarity === 'exotic') {
    body += '<div class="tt-note">Only one exotic weapon can be equipped.</div>';
  }
  const inf = infuseInfo(s, it);
  const foot = side === 'vault' ? '<div class="tt-foot"><span>Click: Move to character</span></div>'
    : side === 'char' ? `<div class="tt-foot"><span>Click: Move to vault</span><span>Hold <kbd>F</kbd>: Dismantle (+⬡${dismantleValue(it)})</span><i class="tt-hold"><em></em></i></div>`
    : equipped
    ? '<div class="tt-foot">Equipped</div>'
    : `<div class="tt-foot"><span>Click: Equip</span><span>Hold <kbd>F</kbd>: Dismantle (+⬡${dismantleValue(it)})</span>${inf.possible ? `<span>Shift+Click: Infuse to ◆${inf.target} (⬡${inf.cost})</span>` : ''}<i class="tt-hold"><em></em></i></div>`;
  return `<div class="tt-head r-${it.rarity}" style="--rc:${rar.color}"><div class="tt-name">${esc(it.name)}</div><div class="tt-type">${rar.name} ${typeLine(it)}</div></div><div class="tt-body">${body}</div>${foot}`;
}

function showTip(tile) {
  const side = tile.closest('.vault-col')?.dataset.side; // 'char' or 'vault' inside the vault
  const it = side === 'vault' ? G.save.vault.find((i) => i.id === tile.dataset.id) : getItem(G.save, tile.dataset.id);
  if (!it) return;
  hoverId = side === 'vault' ? null : it.id; // vaulted items can't be dismantled from here
  if (it.isNew && !tile.closest('.cs-slot')) { it.isNew = false; writeSave(G.save); tile.querySelector('.t-new')?.remove(); }
  const tip = $('#cs-tip');
  tip.innerHTML = tipHTML(it, side);
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

// ---------------------------------------------------------------------------
// Subclass screen (D2 style): abilities, aspects and fragments for the active subclass
// ---------------------------------------------------------------------------
let spSlot = null; // the slot whose options are open: 'grenade' | 'class' | 'aspect0' | 'frag2' ...
const MAX_FRAGMENT_SLOTS = 4;

/** Everything the screen can show about one entry: { kind, id, name, desc, meta, color, locked }. */
function spEntry(kind, id, ctx) {
  const { cls, el, L } = ctx;
  if (kind === 'grenade') { const g = GRENADES[id]; return { kind, id, name: g.name, desc: g.desc, meta: `Grenade  ·  ${Math.round(g.cd * (cls.grenadeCdMult ?? 1))}s cooldown`, color: el.color }; }
  if (kind === 'class') { const c = CLASS_ABILITIES[cls.id][id]; return { kind, id, name: c.name, desc: c.desc, meta: `Class ability  ·  ${c.cd}s cooldown`, color: '#e9eef5' }; }
  if (kind === 'aspect') { const a = ASPECTS[id], lv = aspectLevel(id); return { kind, id, name: a.name, desc: a.desc, meta: `Aspect  ·  ${a.slots} fragment slot${a.slots > 1 ? 's' : ''}`, color: el.color, locked: L < lv ? lv : 0 }; }
  if (kind === 'fragment') { const f = FRAGMENTS[id], lv = fragmentLevel(id); return { kind, id, name: f.name, desc: f.desc, meta: `${ELEMENTS[f.element].name} fragment`, color: ELEMENTS[f.element].color, locked: L < lv ? lv : 0 }; }
  throw new Error(`spEntry: unknown kind ${kind}`);
}

function spDetailHTML(e) {
  if (!e) return '<div class="sp-d-empty">Empty slot. Pick an option to equip it.</div>';
  return `<div class="sp-d-ico">${e.icon}</div><div class="eyebrow">${esc(e.meta)}</div><div class="sp-d-name" style="color:${e.color}">${esc(e.name)}</div><p class="sp-d-desc">${esc(e.desc)}</p>${e.locked ? `<div class="sp-d-lock">Unlocks at Guardian level ${e.locked}</div>` : ''}`;
}

function openSubclass() {
  sfx.ui();
  closeFly();
  const s = G.save, cls = activeKit(s), el = ELEMENTS[cls.element];
  const L = playerLevel(s), lo = getLoadout(s, s.classId, cls.subclassId), ctx = { cls, el, L };
  const p = $('#cs-panel');
  p.classList.add('sp-wide');
  const subs = CLASSES[s.classId].subclasses;
  const slots = fragmentSlots(lo.aspects);
  const ab = cls.abilities;
  const fixed = {
    super: { kind: 'super', name: ab.super.name, desc: ab.super.desc, meta: `Super  ·  ${ab.super.camera === 'third' ? 'third person' : 'first person'}`, color: el.color, icon: abilityIcon('super', ab.super.id, el.color) },
    melee: { kind: 'melee', name: ab.melee.name, desc: ab.melee.desc, meta: `Melee  ·  ${ab.melee.cd}s cooldown`, color: el.color, icon: abilityIcon('melee', ab.melee.id, el.color) },
    jump: { kind: 'jump', name: cls.jumpName, desc: 'Your class jump. Jump variants arrive in a later update.', meta: 'Jump', color: '#e9eef5', icon: abilityIcon('jump', cls.jump, '#e9eef5') },
  };
  const entries = {}; // slot -> entry (with icon)
  const withIcon = (e, frame) => ({ ...e, icon: abilityIcon(frame, e.id, e.color) });
  entries.grenade = withIcon(spEntry('grenade', lo.grenade, ctx), 'grenade');
  entries.class = withIcon(spEntry('class', lo.class, ctx), 'class');
  if (ab.class.id === 'ward') entries.class = { ...entries.class, name: ab.class.name, desc: `${ab.class.desc} (Bastion replaces your barricade.)` };
  for (let i = 0; i < ASPECT_SLOTS; i++) entries['aspect' + i] = lo.aspects[i] ? withIcon(spEntry('aspect', lo.aspects[i], ctx), 'aspect') : null;
  for (let i = 0; i < MAX_FRAGMENT_SLOTS; i++) entries['frag' + i] = lo.fragments[i] ? withIcon(spEntry('fragment', lo.fragments[i], ctx), 'fragment') : null;

  const slotBtn = (slot, frame, e, label, { ro = false, closed = false } = {}) => `<button class="sp-slot${spSlot === slot ? ' sel' : ''}${ro ? ' fixed' : ''}${closed ? ' closed' : ''}" data-slot="${slot}" ${closed ? 'disabled' : ''} aria-label="${esc(label)}: ${esc(e?.name ?? 'Empty')}">
      ${e ? e.icon : emptySlotIcon(frame)}<span class="sp-slot-l">${esc(e?.name ?? (closed ? 'Locked' : 'Empty'))}</span></button>`;

  // options for the open slot
  let opts = '';
  if (spSlot) {
    const kind = spSlot === 'grenade' ? 'grenade' : spSlot === 'class' ? 'class' : spSlot.startsWith('aspect') ? 'aspect' : 'fragment';
    const frame = kind === 'fragment' ? 'fragment' : kind;
    const ids = kind === 'grenade' ? grenadesFor(cls.element) : kind === 'class' ? classAbilitiesFor(s.classId) : kind === 'aspect' ? aspectsFor(s.classId, cls.subclassId) : fragmentsFor(cls.element);
    const current = entries[spSlot]?.id;
    const used = new Set(kind === 'aspect' ? lo.aspects : kind === 'fragment' ? lo.fragments : []);
    const removable = kind === 'aspect' || kind === 'fragment';
    opts = ids.map((id) => {
      const e = withIcon(spEntry(kind, id, ctx), frame);
      const elsewhere = used.has(id) && id !== current;
      const dis = e.locked || elsewhere;
      return `<button class="sp-opt${id === current ? ' on' : ''}${dis ? ' locked' : ''}" data-opt="${id}" data-kind="${kind}" ${dis ? 'aria-disabled="true"' : ''}>${e.icon}<span>${esc(e.name)}</span>${e.locked ? `<em>Level ${e.locked}</em>` : elsewhere ? '<em>Equipped</em>' : ''}</button>`;
    }).join('') + (removable && current ? `<button class="sp-opt clear" data-opt="" data-kind="${kind}">${emptySlotIcon(frame)}<span>Remove</span></button>` : '');
  }

  p.innerHTML = `
    <div class="sp-head" style="--ec:${el.color}"><div><div class="eyebrow">${cls.className}  ·  ${el.name}</div><div class="sp-title">${cls.subclass}</div><div class="sp-tag">${cls.tagline}</div></div><button class="sp-x" id="sp-close" aria-label="Close">✕</button></div>
    <div class="sp-pick">${Object.entries(subs).map(([id, sc]) => {
      const open = isSubclassUnlocked(s, s.classId, id);
      return `<button class="sp-sub${id === cls.subclassId ? ' on' : ''}${open ? '' : ' locked'}" data-sub="${id}" style="--ec:${sc.color}" ${open ? '' : 'disabled'}><b>${sc.name}</b><span>${open ? ELEMENTS[sc.element].name : `Unlocks at level ${subclassLevel(s.classId, id)}`}</span></button>`;
    }).join('')}</div>
    <div class="sp-body" style="--ec:${el.color}">
      <div class="sp-main">
        <div class="sp-sec"><div class="sp-sec-t">Abilities</div><div class="sp-slots">
          ${slotBtn('super', 'super', fixed.super, 'Super', { ro: true })}
          ${slotBtn('class', 'class', entries.class, 'Class ability')}
          ${slotBtn('jump', 'jump', fixed.jump, 'Jump', { ro: true })}
          ${slotBtn('melee', 'melee', fixed.melee, 'Melee', { ro: true })}
          ${slotBtn('grenade', 'grenade', entries.grenade, 'Grenade')}
        </div></div>
        <div class="sp-sec"><div class="sp-sec-t">Aspects</div><div class="sp-slots">
          ${Array.from({ length: ASPECT_SLOTS }, (_, i) => slotBtn('aspect' + i, 'aspect', entries['aspect' + i], 'Aspect')).join('')}
        </div></div>
        <div class="sp-sec"><div class="sp-sec-t">Fragments <small>${lo.fragments.length} of ${slots} slot${slots === 1 ? '' : 's'}  ·  aspects open fragment slots</small></div><div class="sp-slots">
          ${Array.from({ length: MAX_FRAGMENT_SLOTS }, (_, i) => slotBtn('frag' + i, 'fragment', entries['frag' + i], 'Fragment', { closed: i >= slots })).join('')}
        </div></div>
        ${spSlot ? `<div class="sp-opts" aria-label="Options">${opts}</div>` : ''}
        ${cls.passive ? `<div class="abil-row sp-trait"><kbd>★</kbd><div><b>Subclass trait</b><span>${cls.passive}</span></div></div>` : ''}
      </div>
      <aside class="sp-detail" id="sp-detail">${spDetailHTML(spSlot ? entries[spSlot] ?? null : fixed.super)}</aside>
    </div>
    <details class="sp-controls"><summary>All controls</summary>${CONTROLS.map(([k, v]) => `<div class="ctl"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</details>
    <div class="row-btns">
      <button class="btn" id="change-class">Change Class</button>
    </div>`;
  p.classList.remove('hidden');
  const detail = $('#sp-detail', p);
  const slotEntry = (slot) => entries[slot] ?? fixed[slot] ?? null;
  const show = (e) => { detail.innerHTML = spDetailHTML(e); };
  const restore = () => show(spSlot ? slotEntry(spSlot) : fixed.super);
  $$('.sp-slot', p).forEach((b) => {
    const slot = b.dataset.slot;
    b.addEventListener('mouseenter', () => show(slotEntry(slot)));
    b.addEventListener('focus', () => show(slotEntry(slot)));
    b.addEventListener('mouseleave', restore);
    b.addEventListener('click', () => {
      if (b.classList.contains('fixed')) { show(slotEntry(slot)); return; }
      spSlot = spSlot === slot ? null : slot;
      sfx.ui();
      openSubclass();
    });
  });
  $$('.sp-opt', p).forEach((b) => {
    const kind = b.dataset.kind, id = b.dataset.opt;
    const entry = id ? { ...spEntry(kind, id, ctx), icon: abilityIcon(kind, id, spEntry(kind, id, ctx).color) } : null;
    if (entry) { b.addEventListener('mouseenter', () => show(entry)); b.addEventListener('focus', () => show(entry)); b.addEventListener('mouseleave', restore); }
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled')) { sfx.denied(); return; }
      const i = +(spSlot.match(/\d+$/)?.[0] ?? 0);
      let patch;
      if (kind === 'grenade') patch = { grenade: id };
      else if (kind === 'class') patch = { class: id };
      else {
        const key = kind === 'aspect' ? 'aspects' : 'fragments';
        const arr = [...lo[key]];
        if (id) arr[i] = id; else arr.splice(i, 1);
        patch = { [key]: arr.filter(Boolean) };
      }
      const before = lo.fragments.length;
      const next = setLoadout(s, s.classId, cls.subclassId, patch);
      if (next.fragments.length < before && kind === 'aspect') orbitNotice('Fewer fragment slots: the last fragments were removed.');
      sfx.engram(2);
      openSubclass();
    });
  });
  $$('.sp-sub', p).forEach((b) => b.addEventListener('click', () => {
    s.subclass = { ...(s.subclass || {}), [s.classId]: b.dataset.sub };
    writeSave(s);
    spSlot = null;
    sfx.engram(2);
    renderOrbit();
    openSubclass();
  }));
  $('#sp-close').addEventListener('click', () => { spSlot = null; p.classList.add('hidden'); });
  $('#change-class').addEventListener('click', () => showCharacterSelect(true));
}

// Hold F to dismantle, Esc to close flyouts (only on the Character screen)
addEventListener('keydown', (e) => {
  if (G.state !== 'orbit' || orbitTab !== 'character') return;
  if (e.code === 'KeyF' && !e.repeat) startDismantle();
  if (e.code === 'Escape') { closeFly(); closeVault(); $('#cs-panel')?.classList.add('hidden'); }
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
  hud.xpLvl = $('#xpbar .xp-lvl'); hud.xpFill = $('#xpbar .xp-fill');
  hud.superFill = $('#super .super-fill'); hud.superLbl = $('#super .super-label'); hud.superBox = $('#super');
  hud.plate = $('#eplate'); hud.plateIco = $('#eplate .ep-ico'); hud.plateName = $('#eplate .ep-name'); hud.plateHp = $('#eplate .ep-hp'); hud.plateSh = $('#eplate .ep-shield'); hud.plateDb = $('#eplate .ep-debuffs');
  hud.buffs = { general: $('#buffs-gen'), weapon: $('#buffs-wpn') };
  for (const box of Object.values(hud.buffs)) box.innerHTML = '';
  buffChips.clear();
  plateE = null; plateHold = 0;
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
      <div class="w-key">${i + 1}</div><img class="w-ico" src="${weaponIcon(w.item)}" alt="">
      <div class="w-info"><div class="w-name">${elementIcon(w.item.element)}${esc(w.item.name)}</div><div class="w-type">${ARCHETYPES[w.item.arch].name}</div></div>
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
  // level and XP
  const li = levelInfo(G.save.progression.xp);
  setText(hud.xpLvl, 'xpl', `Lv ${li.level}`);
  setStyle(hud.xpFill, 'xpf', 'width', li.max ? '100%' : `${((li.into / li.need) * 100).toFixed(1)}%`);
  // abilities
  for (const k of ['grenade', 'melee', 'class']) {
    const a = hud.ab[k];
    const pct = 1 - P.cd[k] / P.cdMax[k];
    setStyle(a.fill, 'ab' + k, 'height', `${Math.round(pct * 100)}%`);
    setClass(a.el, 'ab' + k, 'ready', pct >= 1);
    setClass(a.el, 'hx' + k, 'empowered', P.status.has('heart', k)); // Heart of Inmost Light
    if (k === 'grenade') setClass(a.el, 'gb', 'charge2', P.gBank > 0); // Starfire Protocol
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
  updateEnemyPlate(dt);
  updateBuffs();
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

// floating damage numbers: they pop at the hit, then drift out to the side and ease down
// (alternating sides so a stream of hits fans out instead of stacking)
const dmgPool = [], dmgActive = [];
let dmgSide = 1;
export function damageNumber(enemy, pos, amount, o = {}) {
  let el = dmgPool.pop();
  if (!el) { el = document.createElement('div'); $('#dmg-layer').appendChild(el); }
  el.className = 'dmgnum' + (o.crit ? ' crit' : '');
  el.style.color = o.shield ? ELEMENTS[o.shield].color : '';
  el.style.display = 'block';
  el.textContent = Math.max(1, Math.round(amount));
  dmgSide = -dmgSide;
  const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.15 + Math.random() * 0.2, (Math.random() - 0.5) * 0.3));
  dmgActive.push({ el, enemy, pos: p, amount, born: G.time, life: 0.8, crit: !!o.crit, side: dmgSide * (0.8 + Math.random() * 0.4) });
  if (dmgActive.length > 70) { const d = dmgActive.shift(); d.el.style.display = 'none'; dmgPool.push(d.el); }
}
function updateDamageNumbers(dt) {
  for (let i = dmgActive.length - 1; i >= 0; i--) {
    const d = dmgActive[i];
    d.life -= dt;
    if (d.life <= 0) { d.el.style.display = 'none'; dmgPool.push(d.el); dmgActive.splice(i, 1); continue; }
    _p.copy(d.pos).project(G.camera);
    if (_p.z > 1) { d.el.style.opacity = '0'; continue; }
    const off = dmgDrift(d.side, 0.8 - d.life);
    const x = (_p.x * 0.5 + 0.5) * innerWidth + off.x, y = (-_p.y * 0.5 + 0.5) * innerHeight + off.y;
    const sc = 0.85 + Math.max(0, d.life - 0.6) * 2.75; // pops in big, then settles
    d.el.style.opacity = Math.min(1, d.life * 3).toFixed(2);
    d.el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%,-50%) scale(${sc.toFixed(2)})`;
  }
}

// enemy name + health plate above the enemy's head: shown while the crosshair is on it, fades ~1 s after looking away
const aimRay = new THREE.Raycaster(), _aimFwd = new THREE.Vector3();
let plateE = null, plateHold = 0;
const PLATE_HOLD = 1, PLATE_FADE = 0.6;
const PLATE_CENTER = 24 + 5 + 63; // icon + gap + half the bar at 100% HUD scale: the bar, not the icon, sits over the head
function aimedEnemy() {
  const cam = G.camera;
  cam.getWorldDirection(_aimFwd);
  aimRay.set(cam.getWorldPosition(_p), _aimFwd);
  aimRay.far = 120;
  for (const h of aimRay.intersectObjects(getHitTargets(), false)) {
    const e = h.object.userData.enemy;
    if (!e) return null; // a wall or prop is in the way
    if (e.alive) return e.isBoss ? null : e;
  }
  return null;
}
const _head = new THREE.Vector3();
function updateEnemyPlate(dt) {
  const e = G.player.dead ? null : aimedEnemy();
  if (e) {
    if (e !== plateE) {
      plateE = e; setText(hud.plateName, 'epn', e.name);
      if (cache.get('epf') !== e.faction) { cache.set('epf', e.faction); hud.plateIco.innerHTML = factionIcon(e.faction); hud.plateIco.title = FACTION_NAMES[e.faction]; }
      setClass(hud.plate, 'epm', 'major', e.typeId === 'captain' || e.typeId === 'heavy');
    }
    plateHold = PLATE_HOLD;
  } else plateHold = Math.max(0, plateHold - dt);
  const show = !!plateE && plateHold > 0;
  setClass(hud.plate, 'ep', 'hidden', !show);
  if (!show) { plateE = null; return; }
  // track the enemy: just above its head, hidden while it's behind the camera
  _head.copy(plateE.headPos(_head)); _head.y += 0.35 + 0.15 * plateE.def.scale;
  _head.project(G.camera);
  const behind = _head.z > 1;
  const x = (_head.x * 0.5 + 0.5) * innerWidth, y = (-_head.y * 0.5 + 0.5) * innerHeight;
  const ps = G.save?.settings.hudScale ?? 1; // the plate follows HUD scale (its CSS sizes use --hud-scale)
  hud.plate.style.transform = `translate(${(x - PLATE_CENTER * ps).toFixed(0)}px, ${y.toFixed(0)}px) translate(0, -100%)`;
  setStyle(hud.plate, 'epo', 'opacity', behind ? '0' : Math.min(1, plateHold / PLATE_FADE).toFixed(2));
  setStyle(hud.plateHp, 'eph', 'width', `${(Math.max(0, plateE.hp) / plateE.maxHp * 100).toFixed(1)}%`);
  const sh = plateE.maxShield ? plateE.shield / plateE.maxShield : 0;
  setStyle(hud.plateSh, 'eps', 'width', `${(sh * 100).toFixed(1)}%`);
  if (sh > 0) setStyle(hud.plateSh, 'epsc', 'background', ELEMENTS[plateE.shieldEl].color);
  // debuffs (js/status.js ENEMY_STATUS)
  const db = plateE.status.list();
  const dbKey = db.map((x) => x.id).join(',');
  if (cache.get('epdb') !== dbKey) { cache.set('epdb', dbKey); hud.plateDb.innerHTML = db.map((x) => `<span class="ep-db" style="--dc:${x.def.color}" title="${x.def.name}">${x.def.glyph}</span>`).join(''); }
}

// buff HUD: the player's status effects (js/status.js); general above the abilities, weapon effects below
const buffChips = new Map();
const SCOPE_LABEL = { grenade: 'Grenade', melee: 'Melee', class: 'Class' };
function updateBuffs() {
  const live = new Set();
  for (const s of G.player.status.list()) {
    const key = s.scope == null ? s.id : `${s.id}@${s.scope}`;
    live.add(key);
    let c = buffChips.get(key);
    if (!c) {
      const el = document.createElement('div');
      el.className = 'buff' + (s.def.exotic ? ' exo' : '');
      el.style.setProperty('--bc', s.def.color);
      const label = s.def.name + (SCOPE_LABEL[s.scope] ? `: ${SCOPE_LABEL[s.scope]}` : '');
      el.innerHTML = `<span class="b-ico">${s.def.glyph}</span><span class="b-name">${esc(label)}</span><span class="b-st"></span><span class="b-t"></span><i class="b-bar"></i>`;
      hud.buffs[s.def.group].appendChild(el);
      c = { el, st: el.querySelector('.b-st'), t: el.querySelector('.b-t'), bar: el.querySelector('.b-bar'), v: {} };
      buffChips.set(key, c);
    }
    const timed = s.t !== Infinity;
    const st = s.stacks > 1 ? `x${s.stacks}` : '';
    const t = timed ? (s.t < 3 ? s.t.toFixed(1) : String(Math.ceil(s.t))) : '';
    const w = timed && s.max > 0 ? `${Math.max(0, (s.t / s.max) * 100).toFixed(0)}%` : '0%';
    if (c.v.st !== st) { c.v.st = st; c.st.textContent = st; }
    if (c.v.t !== t) { c.v.t = t; c.t.textContent = t; }
    if (c.v.w !== w) { c.v.w = w; c.bar.style.width = w; }
  }
  for (const [key, c] of buffChips) if (!live.has(key)) { c.el.remove(); buffChips.delete(key); }
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
        <label>HUD scale <span id="v-hud">${Math.round((s.hudScale ?? 1) * 100)}%</span><input type="range" id="s-hud" min="${HUD_SCALE.min}" max="${HUD_SCALE.max}" step="${HUD_SCALE.step}" value="${s.hudScale ?? 1}"></label>
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
              ${elementIcon(it.element)}
              <span class="inv-n">${esc(it.name)}<small>${rar.name} ${ARCHETYPES[it.arch].name}</small></span>
              <span class="inv-p">${on ? '<em>Equipped</em>' : ''}◆ ${it.power}</span></button>`;
          }).join('')}</div></div>`;
      }).join('')}</div>
      <div class="row-btns"><button class="btn primary" id="inv-close">Back to the fight <kbd>I</kbd></button></div>
    </div>`;
  $$('.inv-pick', el).forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.slot, it = getItem(s, b.dataset.id);
    if (!it || P.weapons[i].item.id === it.id) return;
    const blocker = equipItem(s, it.id);
    if (blocker) { sfx.denied(); orbitNotice(`Swap out ${blocker.name} first: only one exotic weapon at a time.`); return; }
    writeSave(s);
    P.swapWeapon(i, it);
    renderWeaponRows();
    sfx.engram(1);
    renderInventory();
  }));
  $('#inv-close', el).addEventListener('click', resumeGame);
}

/** HUD scale setting (70%-200%), applied to every HUD panel and the enemy plate through a CSS variable. */
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
        <div><b>+${(M.xp || 0).toLocaleString()}</b><span>XP</span></div>
        <div><b>${playerLevel(G.save)}</b><span>Level</span></div>
        <div><b>◆ ${playerPower(G.save)}</b><span>Light</span></div>
      </div>
      <div class="eyebrow">Rewards  ·  ${loot.length} item${loot.length === 1 ? '' : 's'}</div>
      <div class="grid rewards">${loot.map((it) => itemCard(it)).join('')}${M.rewardShader ? `<div class="item shader-card" style="--rc:#c9a6ff"><div class="it-top">${shaderSwatch(M.rewardShader)}<span class="it-name">${esc(SHADERS[M.rewardShader].name)}</span></div><div class="it-sub">Shader  ·  apply it on the Character screen</div></div>` : ''}</div>
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
      <div class="summary">${M.act ? `<div><b>${cleared}</b><span>Waves cleared</span></div>` : ''}<div><b>${M.kills}</b><span>Kills</span></div><div><b>${M.loot.length}</b><span>Items found</span></div><div><b>+${(M.xp || 0).toLocaleString()}</b><span>XP</span></div><div><b>◆ ${playerPower(G.save)}</b><span>Light</span></div></div>
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
