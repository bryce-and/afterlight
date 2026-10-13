import { SLOTS, LOCATIONS, RARITIES, classKit } from './data.js';
import { starterGear, dismantleValue, armoryGear, modernizeItem, heavyVersion, makeExotic, rollArmorPerk } from './loot.js';
import { EXOTIC_WEAPONS } from './data.js';

const KEY = 'afterlight_save_v1';
export const INVENTORY_CAP = 60;

export function loadSave() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch (e) { console.error('localStorage unavailable:', e); return null; }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s && s.version === 1 && Array.isArray(s.inventory) && s.equipped && s.classId) {
      s.settings = { sens: 1, fov: 80, volume: 0.6, ...(s.settings || {}) };
      grantArmory(s);
      if (!s.namesV3) { s.inventory.forEach(modernizeItem); s.namesV3 = true; writeSave(s); }
      if (!s.heavyExoticsV4) { migrateHeavyExotics(s); s.heavyExoticsV4 = true; writeSave(s); }
      const exoticsFresh = !s.exoticsV5; // regenerated from current stats, so already balanced
      if (!s.exoticsV5) { upgradeExotics(s); s.exoticsV5 = true; writeSave(s); }
      if (!s.balanceV6) { rebalanceWeapons(s, exoticsFresh); s.balanceV6 = true; writeSave(s); }
      if (!s.exoticsV9) { upgradeExotics(s); s.exoticsV9 = true; writeSave(s); } // exotic signature perks, damage and handling
      if (!s.armorV7) {
        // Legendary armor gains a rolled perk; only one exotic armor piece may be equipped
        for (const it of s.inventory) if (it.kind === 'armor' && it.rarity === 'legendary' && !it.perk) it.perk = rollArmorPerk();
        const exo = ['helmet', 'arms', 'chest', 'legs'].map((sl) => getEquipped(s, sl)).filter((it) => it?.rarity === 'exotic');
        for (const it of exo.slice(1)) unequipExotic(s, it);
        s.armorV7 = true; writeSave(s);
      }
      if (!s.weaponsV10) {
        // fusion rifles got tighter spread; only one exotic weapon may be equipped
        for (const it of s.inventory) if (it.kind === 'weapon' && it.arch === 'fusion') it.stats.spread *= 0.026 / 0.035;
        const exo = ['primary', 'special', 'heavy'].map((sl) => getEquipped(s, sl)).filter((it) => it?.rarity === 'exotic');
        for (const it of exo.slice(1)) { const r = bestNonExotic(s, it); if (r) s.equipped[it.slot] = r.id; }
        s.weaponsV10 = true; writeSave(s);
      }
      return s;
    }
    console.error('Save file has an unexpected shape; ignoring it.', s);
  } catch (e) {
    console.error('Save file is corrupt; ignoring it.', e);
  }
  return null;
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.error('Failed to write save:', e); }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch (e) { console.error('Failed to clear save:', e); }
}

export function createSave(classId) {
  const gear = starterGear();
  const s = { version: 1, classId, glimmer: 250, inventory: gear, equipped: {}, cleared: {}, settings: { sens: 1, fov: 80, volume: 0.6 } };
  for (const it of gear) s.equipped[it.slot] = it.id;
  grantArmory(s);
  s.namesV3 = true;
  s.balanceV6 = true;
  s.armorV7 = true;
  s.weaponsV10 = true;
  writeSave(s);
  return s;
}

/** Rebuild owned exotics with their signature perks and handling (keeps id, power, slot equip). */
// Weapon balance pass: damage is rolled into each item when it drops, so owned
// weapons are rescaled by how much their archetype's base damage changed.
const BALANCE_V6 = { shotgun: 23 / 16, sniper: 360 / 260, fusion: 52 / 38, rocket: 900 / 560, glauncher: 380 / 260, mg: 32 / 26 };
function rebalanceWeapons(s, skipExotics) {
  for (const it of s.inventory) {
    if (it.kind !== 'weapon' || (skipExotics && it.rarity === 'exotic')) continue;
    let k = BALANCE_V6[it.arch] ?? 1;
    if (it.slot === 'heavy' && it.reserve != null) k *= 1.4 / 1.7; // heavy versions of special exotics (multiplier 1.7 -> 1.4)
    it.stats.dmg = +(it.stats.dmg * k).toFixed(1);
  }
}

function upgradeExotics(s) {
  for (let i = 0; i < s.inventory.length; i++) {
    const it = s.inventory[i];
    if (it.kind !== 'weapon' || it.rarity !== 'exotic') continue;
    const fresh = makeExotic(it.name, it.power);
    if (!fresh) continue;
    const wasEquipped = s.equipped[it.slot] === it.id;
    s.inventory[i] = { ...fresh, id: it.id, power: it.power, isNew: it.isNew };
    if (wasEquipped && fresh.slot !== it.slot) {
      const next = s.inventory.filter((x) => x.slot === it.slot && x.id !== it.id).sort((a, b) => b.power - a.power)[0];
      if (next) s.equipped[it.slot] = next.id; else delete s.equipped[it.slot];
    }
  }
}

/** Legend of Acrius and Whisper of the Worm moved to the Heavy slot. */
function migrateHeavyExotics(s) {
  const heavyNames = new Set(EXOTIC_WEAPONS.filter((e) => e.slot === 'heavy').map((e) => e.name));
  for (const it of s.inventory) {
    if (it.kind !== 'weapon' || it.slot !== 'special' || !heavyNames.has(it.name)) continue;
    const wasEquipped = s.equipped.special === it.id;
    heavyVersion(it);
    if (wasEquipped) {
      const next = s.inventory.filter((i) => i.slot === 'special').sort((a, b) => b.power - a.power)[0];
      if (next) s.equipped.special = next.id; else delete s.equipped.special;
    }
  }
}

/** Every save gets one of each weapon type exactly once (v2 armory). */
function grantArmory(s) {
  if (s.armoryV2) return;
  const owned = new Set(s.inventory.filter((i) => i.kind === 'weapon').map((i) => i.arch));
  const power = Math.max(10, playerPower(s));
  s.inventory.push(...armoryGear(owned, power));
  s.armoryV2 = true;
  writeSave(s);
}

/** The player's class + chosen subclass. */
export const activeKit = (s) => classKit(s.classId, s.subclass?.[s.classId]);

export const getItem = (s, id) => s.inventory.find((i) => i.id === id);
export const getEquipped = (s, slot) => getItem(s, s.equipped[slot]);
export const isEquipped = (s, it) => s.equipped[it.slot] === it.id;

export function playerPower(s) {
  const total = SLOTS.reduce((sum, sl) => sum + (getEquipped(s, sl)?.power ?? 0), 0);
  return Math.floor(total / SLOTS.length);
}

/**
 * Equips an item. Only one exotic armor piece and one exotic weapon can be equipped:
 * returns the exotic it replaced, if any. If that exotic weapon has no non-exotic
 * weapon to fall back to, nothing changes and it returns { ...that weapon, blocked: true }.
 */
export function equipItem(s, id) {
  const it = getItem(s, id);
  if (!it) throw new Error(`equipItem: no item ${id}`);
  let swapped = null;
  if (it.kind === 'weapon' && it.rarity === 'exotic') {
    for (const sl of ['primary', 'special', 'heavy']) {
      const other = sl !== it.slot && getEquipped(s, sl);
      if (!other || other.rarity !== 'exotic') continue;
      const r = bestNonExotic(s, other);
      if (!r) return { ...other, blocked: true };
      s.equipped[sl] = r.id; swapped = other;
    }
  }
  if (it.kind === 'armor' && it.rarity === 'exotic') {
    for (const sl of ['helmet', 'arms', 'chest', 'legs']) {
      const other = sl !== it.slot && getEquipped(s, sl);
      if (other && other.rarity === 'exotic') { unequipExotic(s, other); swapped = other; }
    }
  }
  s.equipped[it.slot] = id;
  it.isNew = false;
  writeSave(s);
  return swapped;
}

/** Highest-power non-exotic weapon for the same slot as `it`. */
function bestNonExotic(s, it) {
  return s.inventory.filter((x) => x.kind === 'weapon' && x.slot === it.slot && x.rarity !== 'exotic').sort((a, b) => b.power - a.power)[0];
}

/** Swap an equipped exotic armor piece for the best non-exotic in its slot (or leave the slot empty). */
function unequipExotic(s, it) {
  const best = s.inventory.filter((x) => x.kind === 'armor' && x.slot === it.slot && x.rarity !== 'exotic').sort((a, b) => b.power - a.power)[0];
  if (best) s.equipped[it.slot] = best.id; else delete s.equipped[it.slot];
}

export function dismantleItem(s, id) {
  const it = getItem(s, id);
  if (!it) throw new Error(`dismantleItem: no item ${id}`);
  if (isEquipped(s, it)) return 0;
  s.inventory = s.inventory.filter((i) => i.id !== id);
  const v = dismantleValue(it);
  s.glimmer += v;
  writeSave(s);
  return v;
}

export function infuseInfo(s, it) {
  const best = Math.max(...s.inventory.filter((i) => i.slot === it.slot).map((i) => i.power));
  return { target: best, cost: 100 + best * 6, possible: best > it.power };
}

export function infuseItem(s, id) {
  const it = getItem(s, id);
  const info = infuseInfo(s, it);
  if (!info.possible || s.glimmer < info.cost) return false;
  s.glimmer -= info.cost;
  it.power = info.target;
  writeSave(s);
  return true;
}

/** Adds an item; if over cap, auto-dismantles the weakest unequipped item and returns it. */
export function addItem(s, it) {
  s.inventory.push(it);
  if (s.inventory.length <= INVENTORY_CAP) return null;
  const rIdx = (x) => RARITIES.findIndex((r) => r.id === x.rarity);
  const candidates = s.inventory.filter((i) => !isEquipped(s, i) && i !== it && i.rarity !== 'exotic');
  candidates.sort((a, b) => rIdx(a) - rIdx(b) || a.power - b.power);
  const victim = candidates[0];
  if (!victim) return null;
  s.inventory = s.inventory.filter((i) => i !== victim);
  s.glimmer += dismantleValue(victim);
  return victim;
}

export const ALL_MISSIONS = LOCATIONS.flatMap((l, li) => l.missions.map((m, mi) => ({ ...m, li, mi, g: li * 3 + mi })));

export function isUnlocked(s, li, mi) {
  const g = li * 3 + mi;
  if (g === 0) return true;
  return !!s.cleared[ALL_MISSIONS[g - 1].id];
}
