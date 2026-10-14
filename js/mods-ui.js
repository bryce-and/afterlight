// The Mods screen (Armor 2.0): slides in from the character screen's right edge. Your character in the
// middle, the six stats on the left, your four armor pieces with their sockets and energy on the right.
// Hover an empty socket to see the mods it takes; click to socket one (click the socket to pin the list on touch).
import { G } from './state.js';
import { ARMOR_SLOTS, SLOT_NAMES, RARITIES, rarityIndex } from './data.js';
import { getEquipped, writeSave, playerLevel } from './save.js';
import { armorIcon } from './icons.js';
import { abilityIcon, emptySlotIcon } from './ability-icons.js';
import { sfx } from './audio.js';
import { esc } from './util.js';
import {
  MODS, MODS_LEVEL, SOCKETS, STAT_KEYS, STATS, CLASS_STAT, armorStats, tierOf, cooldownMult, superRateMult, speedMult, shieldMax, regenDelay,
  energyCap, energyUsed, activeMods, modsForSlot, statMods, modUnlocked, setMod,
} from './armor.js';

let sel = 'helmet', pinned = null;

/** One line of effect for a stat value (shared with the character screen's stat bar). */
export function statLine(k, v, classId) {
  const pct = (m) => `${Math.round(m * 100)}%`;
  const cls = CLASS_STAT[classId] === k ? `  ·  class ability cooldown ${pct(cooldownMult(v))}` : '';
  switch (k) {
    case 'mob': return `+${Math.round((speedMult(v) - 1) * 100)}% move speed${cls}`;
    case 'res': return `${shieldMax(v)} shield${cls}`;
    case 'rec': return `${regenDelay(v).toFixed(1)}s shield delay${cls}`;
    case 'dis': return `Grenade cooldown ${pct(cooldownMult(v))}`;
    case 'int': return `Passive super gain ${pct(superRateMult(v))}`;
    default: return `Powered melee cooldown ${pct(cooldownMult(v))}`;
  }
}

const modIcon = (id, size = '') => abilityIcon(MODS[id].slot === 'any' ? 'aspect' : 'fragment', id, '#cdb6ff').replace('class="ab-svg"', `class="ab-svg ${size}"`);

function statsHTML(st, classId) {
  return STAT_KEYS.map((k) => `<div class="ms-stat" title="${esc(STATS[k].desc)}">
      <div class="ms-stat-h"><span>${STATS[k].name}</span><b>${st[k]}</b><em>T${tierOf(st[k])}</em></div>
      <i><em style="width:${st[k]}%"></em></i>
      <small>${esc(statLine(k, st[k], classId))}</small></div>`).join('');
}

function socketHTML(it, i, L) {
  const id = it.mods?.[i] ?? null;
  const live = id && activeMods(it, L).includes(id);
  const cap = energyCap(it), spent = energyUsed(it.mods);
  const ids = i === 0 ? statMods() : modsForSlot(it.slot);
  const opts = ids.map((m) => {
    const d = MODS[m];
    const locked = !modUnlocked(m, L);
    const room = spent - (id ? MODS[id].cost : 0) + d.cost <= cap;
    const on = id === m;
    const note = locked ? `Level ${d.unlock}` : !room && !on ? 'No energy' : on ? 'Equipped' : '';
    return `<button class="ms-opt${locked || (!room && !on) ? ' off' : ''}${on ? ' on' : ''}" data-mod="${m}" data-i="${i}">
      ${modIcon(m, 'sm')}<span class="ms-opt-t"><b>${esc(d.name)}</b><small>${esc(d.desc)}</small></span><span class="ms-cost">${d.cost}</span>${note ? `<em>${note}</em>` : ''}</button>`;
  }).join('');
  const clear = id ? `<button class="ms-opt clear" data-mod="" data-i="${i}"><span class="ms-opt-t"><b>Remove ${esc(MODS[id].name)}</b></span></button>` : '';
  return `<div class="ms-socket${pinned === i ? ' pinned' : ''}${id ? ' filled' : ''}${id && !live ? ' idle' : ''}" data-i="${i}">
    <button class="ms-sock-btn" data-i="${i}" aria-label="${i === 0 ? 'Stat' : 'Mod'} socket ${i + 1}: ${id ? esc(MODS[id].name) : 'Empty'}">
      ${id ? modIcon(id) : emptySlotIcon(i === 0 ? 'aspect' : 'fragment')}
      <span class="ms-sock-l">${id ? esc(MODS[id].name) : i === 0 ? 'Stat' : 'Mod'}</span>${id ? `<span class="ms-cost">${MODS[id].cost}</span>` : ''}
    </button>
    <div class="ms-pick ${i < 2 ? 'l' : 'r'}"><div class="ms-pick-in"><div class="ms-pick-h">${i === 0 ? 'Stat mods' : `${SLOT_NAMES[it.slot]} mods`}<span>${spent} / ${cap} energy</span></div>${clear}${opts}</div></div>
  </div>`;
}

function detailHTML(it, L) {
  const cap = energyCap(it), spent = energyUsed(it.mods);
  const rar = RARITIES[rarityIndex(it.rarity)];
  const pips = Array.from({ length: cap }, (_, n) => `<i class="${n < spent ? 'on' : ''}"></i>`).join('');
  return `<div class="ms-detail" style="--rc:${rar.color}">
    <div class="ms-d-name">${esc(it.name)}<small>${SLOT_NAMES[it.slot]}  ·  ${rar.name}</small></div>
    <div class="ms-energy"><span>Energy</span><div class="ms-pips">${pips}</div><b>${spent} / ${cap}</b></div>
    <div class="ms-sockets">${Array.from({ length: SOCKETS }, (_, i) => socketHTML(it, i, L)).join('')}</div>
    <div class="ms-hint">The first socket takes stat mods. Hover a socket to see the mods it takes.</div>
  </div>`;
}

/** Fills the Mods screen element. onChange runs after a mod is socketed or removed (the caller refreshes its own stats). */
export function fillMods(el, onChange) {
  const s = G.save, L = playerLevel(s);
  const items = ARMOR_SLOTS.map((sl) => getEquipped(s, sl));
  const st = armorStats(s.classId, items.filter(Boolean), L);
  const cur = items[ARMOR_SLOTS.indexOf(sel)] || items.find(Boolean);
  if (cur) sel = cur.slot;
  el.innerHTML = `
    <div class="ms-panel ms-left">
      <button class="btn ms-back" id="ms-back">‹ Character</button>
      <div class="ms-title">Mods</div>
      ${statsHTML(st, s.classId)}
    </div>
    <div class="ms-panel ms-right">
      <div class="ms-pieces">${items.map((it, n) => it ? `<button class="ms-piece r-${it.rarity}${it.slot === sel ? ' on' : ''}" data-slot="${it.slot}" style="--rc:${RARITIES[rarityIndex(it.rarity)].color}">
        ${armorIcon(it.slot)}<span>${SLOT_NAMES[it.slot]}</span><small>${energyUsed(it.mods)} / ${energyCap(it)}</small></button>` : `<div class="ms-piece empty"><span>${SLOT_NAMES[ARMOR_SLOTS[n]]}</span></div>`).join('')}</div>
      ${cur ? detailHTML(cur, L) : '<div class="ms-hint">Equip armor to socket mods.</div>'}
    </div>`;
  el.querySelectorAll('.ms-piece[data-slot]').forEach((b) => b.addEventListener('click', () => { sel = b.dataset.slot; pinned = null; sfx.ui(); fillMods(el, onChange); }));
  el.querySelectorAll('.ms-sock-btn').forEach((b) => b.addEventListener('click', () => { pinned = pinned === +b.dataset.i ? null : +b.dataset.i; sfx.ui(); el.querySelectorAll('.ms-socket').forEach((n) => n.classList.toggle('pinned', +n.dataset.i === pinned)); }));
  el.querySelectorAll('.ms-opt').forEach((b) => b.addEventListener('click', () => {
    if (b.classList.contains('off')) { sfx.denied(); return; }
    const it = getEquipped(s, sel);
    const err = setMod(it, +b.dataset.i, b.dataset.mod || null, L);
    if (err) { sfx.denied(); return; }
    writeSave(s);
    sfx.engram(1);
    pinned = null;
    fillMods(el, onChange);
    onChange?.();
  }));
}

/** Slides the Mods screen in over the character screen. */
export function openMods(host, onChange, onClose) {
  const el = document.createElement('div');
  el.className = 'cs-mods';
  host.appendChild(el);
  host.classList.add('mods-open');
  fillMods(el, onChange);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    el.classList.remove('in');
    host.classList.remove('mods-open');
    setTimeout(() => el.remove(), 360);
    onClose?.();
  };
  const onKey = (e) => { if (e.code === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => { if (e.target.closest('#ms-back')) { sfx.ui(); close(); } });
  return el;
}
