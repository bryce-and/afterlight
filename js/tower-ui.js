// U16 "The Last City": the Tower's three terminals (Postmaster, Exotic Kiosk, Quest Kiosk) and the Range readout.
// They reuse the Collection screen's overlay and card styles (loot-ui.js, style.css).
import { G } from './state.js';
import { CLASSES, EXOTIC_WEAPONS, ARCHETYPES, EXOTIC_ARMOR_PERKS, EXOTIC_PERKS, RARITIES, exoticArmorFor, rarityIndex } from './data.js';
import { makeExotic, makeArmor } from './loot.js';
import { addItem, collectPostmaster, writeSave, playerPower, POSTMASTER_CAP, INVENTORY_CAP, KIOSK_PRICE } from './save.js';
import { questList, pickUpQuest, QUESTS } from './quests.js';
import { overlay } from './loot-ui.js';
import { weaponIcon, armorIcon } from './icons.js';
import { sfx } from './audio.js';
import { esc } from './util.js';

const art = (it) => (it.kind === 'weapon' ? `<img src="${weaponIcon(it)}" alt="" draggable="false">` : armorIcon(it));
const typeOf = (it) => (it.kind === 'weapon' ? ARCHETYPES[it.arch].name : { helmet: 'Helmet', arms: 'Arms', chest: 'Chest', legs: 'Legs' }[it.slot]);
const rc = (it) => RARITIES[rarityIndex(it.rarity)].color;

/** Opens an overlay and frees the pointer. `done` runs once on close (the Tower re-locks the pointer). */
function panel(cls, done) {
  const o = overlay(`coll ${cls}`);
  o.onClose(done);
  return o;
}

// ---------------------------------------------------------------------------
// Postmaster: what you could not carry
// ---------------------------------------------------------------------------
export function openPostmaster(done) {
  const { el, close } = panel('postmaster', done);
  const s = G.save;
  const render = (msg = '') => {
    const list = s.postmaster || [];
    el.innerHTML = `
      <div class="coll-box">
        <div class="coll-head"><div><div class="eyebrow">Kadi 55-30  ·  Postmaster</div><div class="screen-title gold">Postmaster</div></div>
          <div class="coll-count">${list.length} / ${POSTMASTER_CAP} held  ·  Inventory ${s.inventory.length} / ${INVENTORY_CAP}</div></div>
        <div class="coll-grid">${list.length ? list.map((it) => `<button class="coll-card found pm-card" data-id="${it.id}" style="border-color:${rc(it)}">
          <span class="coll-art">${art(it)}</span><span class="coll-n" style="color:${rc(it)}">${esc(it.name)}<small>${typeOf(it)}  ·  ◆ ${it.power}</small></span></button>`).join('') : '<p class="desc">Nothing is waiting for you.</p>'}</div>
        <div class="coll-foot"><button class="btn" id="pm-close">Back <kbd>Esc</kbd></button><span class="hint">${esc(msg) || 'Click an item to take it. A full Postmaster dismantles its oldest common gear; exotics are never lost.'}</span></div>
      </div>`;
    el.querySelector('#pm-close').addEventListener('click', () => { sfx.ui(); close(); });
    el.querySelectorAll('.pm-card').forEach((b) => b.addEventListener('click', () => {
      const e = collectPostmaster(s, b.dataset.id);
      sfx.ui();
      render(e || 'Collected.');
    }));
  };
  render();
}

// ---------------------------------------------------------------------------
// Exotic Kiosk: any exotic you have found, at your current Light, for KIOSK_PRICE glimmer
// ---------------------------------------------------------------------------
let kioskTab = 'weapons';
const owns = (s, name) => [...s.inventory, ...s.vault, ...(s.postmaster || [])].some((i) => i.name === name);

export function openExoticKiosk(done) {
  const { el, close } = panel('kiosk', done);
  const s = G.save, found = new Set(s.exoticsFound || []);
  const render = (msg = '') => {
    const power = playerPower(s);
    const weapons = EXOTIC_WEAPONS.map((tpl) => makeExotic(tpl.name, power));
    const armor = exoticArmorFor(s.classId).map((x) => makeArmor(x.slot, power, 4, null, s.classId, x.name));
    const list = kioskTab === 'weapons' ? weapons : armor;
    const card = (it) => {
      const have = found.has(it.name), held = owns(s, it.name);
      const perk = it.kind === 'weapon' ? EXOTIC_PERKS[it.exotic] : EXOTIC_ARMOR_PERKS[it.name];
      return `<button class="coll-card${have ? ' found' : ''}" data-name="${esc(it.name)}" title="${have ? esc(`${perk?.name}: ${perk?.desc}`) : 'Not found yet'}">
        <span class="coll-art">${art(it)}</span>
        <span class="coll-n">${have ? esc(it.name) : 'Undiscovered'}<small>${typeOf(it)}${have ? (held ? '  ·  you have it' : `  ·  ⬡ ${KIOSK_PRICE.toLocaleString()}`) : ''}</small></span></button>`;
    };
    el.innerHTML = `
      <div class="coll-box">
        <div class="coll-head"><div><div class="eyebrow">Hall of Guardians</div><div class="screen-title gold">Exotic Kiosk</div></div>
          <div class="coll-tabs">
            <button class="coll-tab${kioskTab === 'weapons' ? ' on' : ''}" data-tab="weapons">Weapons</button>
            <button class="coll-tab${kioskTab === 'armor' ? ' on' : ''}" data-tab="armor">${CLASSES[s.classId].name} Armor</button>
          </div>
          <div class="coll-count">⬡ ${s.glimmer.toLocaleString()}  ·  your Light ◆ ${power}</div></div>
        <div class="coll-grid">${list.map(card).join('')}</div>
        <div class="coll-foot"><button class="btn" id="kk-close">Back <kbd>Esc</kbd></button><span class="hint">${esc(msg) || `Click an exotic you have found to pull it at your Light for ${KIOSK_PRICE.toLocaleString()} glimmer. Armor rolls random stats; weapons have fixed perks.`}</span></div>
      </div>`;
    el.querySelectorAll('.coll-tab').forEach((b) => b.addEventListener('click', () => { kioskTab = b.dataset.tab; sfx.ui(); render(); }));
    el.querySelector('#kk-close').addEventListener('click', () => { sfx.ui(); close(); });
    el.querySelectorAll('.coll-card.found').forEach((b) => b.addEventListener('click', () => {
      const it = list.find((x) => x.name === b.dataset.name);
      sfx.ui();
      if (!it) return;
      if (owns(s, it.name)) return render(`You already have ${it.name}.`);
      if (s.glimmer < KIOSK_PRICE) return render(`Not enough glimmer: ${KIOSK_PRICE.toLocaleString()} needed.`);
      s.glimmer -= KIOSK_PRICE;
      const sent = addItem(s, it);
      writeSave(s);
      render(sent ? `${it.name} was sent to the Postmaster (inventory full).` : `${it.name} is yours, at ◆ ${it.power}.`);
    }));
  };
  render();
  sfx.ui();
}

// ---------------------------------------------------------------------------
// Quest Kiosk: pick dropped quests back up
// ---------------------------------------------------------------------------
export function openQuestKiosk(done) {
  const { el, close } = panel('qkiosk', done);
  const s = G.save;
  const render = (msg = '') => {
    const rows = questList(s);
    el.innerHTML = `
      <div class="coll-box">
        <div class="coll-head"><div><div class="eyebrow">Hall of Guardians  ·  ${CLASSES[s.classId].name}</div><div class="screen-title gold">Quest Kiosk</div></div></div>
        <div class="coll-grid">${rows.map((r) => `<div class="coll-card found">
            <span class="coll-n">${esc(r.quest.name)}<small>${r.state === 'active' ? 'Active' : r.state === 'dropped' ? 'Available' : 'Complete'}${r.quest.abandonable ? '' : '  ·  cannot be abandoned'}</small></span>
            <span class="hint">${esc(r.quest.desc)}</span>
            ${r.state === 'dropped' ? `<button class="btn primary" data-q="${r.quest.id}">Pick up</button>` : ''}</div>`).join('')}</div>
        <div class="coll-foot"><button class="btn" id="qk-close">Back <kbd>Esc</kbd></button><span class="hint">${esc(msg) || 'Quests you abandon wait here. The campaign is always active.'}</span></div>
      </div>`;
    el.querySelector('#qk-close').addEventListener('click', () => { sfx.ui(); close(); });
    el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const e = pickUpQuest(s, b.dataset.q);
      if (!e) writeSave(s);
      sfx.ui();
      render(e || `${QUESTS[b.dataset.q].name} picked up.`);
    }));
  };
  render();
  sfx.ui();
}

// ---------------------------------------------------------------------------
// Range readout: damage per second over the last few seconds, and the best burst
// ---------------------------------------------------------------------------
let rangeEl = null;
export function showRangeHud(on) {
  if (!on) { rangeEl?.remove(); rangeEl = null; return; }
  if (rangeEl) return;
  rangeEl = document.createElement('div');
  rangeEl.id = 'range-hud';
  rangeEl.innerHTML = '<div class="eyebrow">Shooting Range</div><div class="rg-dps">0 <small>DPS</small></div><div class="rg-sub">Total 0  ·  Best 0</div><div class="rg-hint">Walk out of the range to holster your weapons</div>';
  document.body.appendChild(rangeEl);
}
export function setRangeHud(dps, total, best) {
  if (!rangeEl) return;
  rangeEl.querySelector('.rg-dps').innerHTML = `${Math.round(dps).toLocaleString()} <small>DPS</small>`;
  rangeEl.querySelector('.rg-sub').textContent = `Total ${Math.round(total).toLocaleString()}  ·  Best ${Math.round(best).toLocaleString()}`;
}
