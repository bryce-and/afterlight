import { SLOTS, LOCATIONS, RARITIES, CLASSES } from './data.js';
import { resolveKit, sanitizeLoadout } from './subclass.js';
import { starterGear, dismantleValue, armoryGear, rollItem } from './loot.js';
import { levelInfo, rewardAt, subclassLevel, LIGHT_CAP } from './progression.js';
import { randInt } from './util.js';
import { frameFor, weaponStats } from './frames.js';

const KEY = 'afterlight_save_v2';
// First Light (v1.1) started every Guardian over: a pre-overhaul save is copied
// to BACKUP_KEY once, then cleared. Only its settings carry over.
const LEGACY_KEY = 'afterlight_save_v1';
export const BACKUP_KEY = 'afterlight_backup_v1';
export const SAVE_VERSION = 4;
export const INVENTORY_CAP = 60;
export const VAULT_CAP = 100;
const DEFAULT_SETTINGS = { sens: 1, fov: 80, volume: 0.6 };

// MIGRATIONS[n] upgrades a version n save to version n + 1, in place.
// Add one whenever the save shape changes, and bump SAVE_VERSION.
const MIGRATIONS = {
  // Paths of Light (v1.3): per-subclass loadouts (grenade, class ability, aspects, fragments). Missing = defaults.
  2: (s) => { s.loadout = s.loadout && typeof s.loadout === 'object' ? s.loadout : {}; },
  // Arsenal (v1.4): every weapon gets an archetype and archetype-fixed stats. Perks, power, element, rarity and name are kept.
  3: (s) => {
    for (const it of [...(s.inventory || []), ...(s.vault || [])]) {
      if (it.kind !== 'weapon') continue;
      if (it.rarity !== 'exotic' && !it.frame) it.frame = frameFor(it);
      it.stats = weaponStats(it);
    }
  },
};

let store = (() => { try { return globalThis.localStorage; } catch { return null; } })();
/** Swap the storage backend (tests use an in-memory one). */
export function useStorage(st) { store = st; }

let legacyArchived = false;
/** True once, right after an old save was archived (the title screen tells the player). */
export function takeLegacyNotice() { const v = legacyArchived; legacyArchived = false; return v; }

function archiveLegacy() {
  const raw = store.getItem(LEGACY_KEY);
  if (raw == null) return;
  if (store.getItem(BACKUP_KEY) == null) store.setItem(BACKUP_KEY, raw);
  store.removeItem(LEGACY_KEY);
  legacyArchived = true;
}

/** Settings from the archived pre-overhaul save, if there is one. */
function backupSettings() {
  try { return JSON.parse(store.getItem(BACKUP_KEY))?.settings ?? {}; } catch { return {}; }
}

export function loadSave() {
  if (!store) { console.error('localStorage unavailable; progress will not be saved.'); return null; }
  let raw;
  try {
    archiveLegacy();
    raw = store.getItem(KEY);
  } catch (e) { console.error('localStorage unavailable:', e); return null; }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || !Number.isInteger(s.version) || !Array.isArray(s.inventory) || !s.equipped || !s.classId) {
      console.error('Save file has an unexpected shape; ignoring it.', s);
      return null;
    }
    if (s.version > SAVE_VERSION) { console.error(`Save is from a newer version (${s.version}); ignoring it.`); return null; }
    while (s.version < SAVE_VERSION) {
      const step = MIGRATIONS[s.version];
      if (!step) throw new Error(`No save migration from version ${s.version}`);
      step(s);
      s.version++;
      writeSave(s);
    }
    s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    return s;
  } catch (e) {
    console.error('Save file is corrupt; ignoring it.', e);
  }
  return null;
}

export function writeSave(s) {
  try { store.setItem(KEY, JSON.stringify(s)); } catch (e) { console.error('Failed to write save:', e); }
}

export function resetSave() {
  try { store.removeItem(KEY); } catch (e) { console.error('Failed to clear save:', e); }
}

export function createSave(classId) {
  const gear = starterGear();
  const s = {
    version: SAVE_VERSION, classId, glimmer: 250, inventory: gear, vault: [], equipped: {}, cleared: {}, subclass: {}, loadout: {},
    progression: { xp: 0, claimed: [] },
    settings: { ...DEFAULT_SETTINGS, ...backupSettings() },
  };
  for (const it of gear) s.equipped[it.slot] = it.id;
  // one common weapon of every other type, so every archetype is there to try
  const owned = new Set(gear.filter((i) => i.kind === 'weapon').map((i) => i.arch));
  s.inventory.push(...armoryGear(owned, 10));
  writeSave(s);
  return s;
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------
export const playerLevel = (s) => levelInfo(s.progression.xp).level;

/** Adds XP. Returns { from, to } when the level went up (and saves), otherwise null. */
export function addXp(s, n) {
  const from = playerLevel(s);
  s.progression.xp += Math.max(0, Math.round(n));
  const to = playerLevel(s);
  if (to === from) return null;
  writeSave(s);
  return { from, to };
}

export const isSubclassUnlocked = (s, classId, subId) => playerLevel(s) >= subclassLevel(classId, subId);

/** 'claimed' | 'ready' | 'locked' | null (no item reward at that level). */
export function rewardState(s, level) {
  if (!rewardAt(level)) return null;
  if (s.progression.claimed.includes(level)) return 'claimed';
  return playerLevel(s) >= level ? 'ready' : 'locked';
}

/** Claims a level reward. Returns { item } or { error }. */
export function claimLevelReward(s, level) {
  const state = rewardState(s, level);
  if (state === 'claimed') return { error: 'Already claimed.' };
  if (state !== 'ready') return { error: state === 'locked' ? `Reach level ${level} first.` : 'No reward at this level.' };
  if (s.inventory.length >= INVENTORY_CAP) return { error: `Your character is full (${INVENTORY_CAP} items). Dismantle or vault something first.` };
  const power = Math.min(LIGHT_CAP, playerPower(s) + randInt(2, 5));
  const item = rollItem(power, rewardAt(level) === 'exotic' ? 4 : 3);
  s.inventory.push(item);
  s.progression.claimed.push(level);
  writeSave(s);
  return { item };
}

/** The player's class + chosen subclass, with that subclass's loadout applied. */
export function activeKit(s) {
  const sub = s.subclass?.[s.classId];
  const ids = Object.keys(CLASSES[s.classId].subclasses);
  const sid = sub && CLASSES[s.classId].subclasses[sub] && isSubclassUnlocked(s, s.classId, sub) ? sub : ids[0];
  return resolveKit(s.classId, sid, s.loadout?.[s.classId]?.[sid], playerLevel(s));
}

/** The valid loadout for a subclass right now (defaults fill anything missing or locked). */
export const getLoadout = (s, classId, subId) => sanitizeLoadout(classId, subId, s.loadout?.[classId]?.[subId], playerLevel(s));

/** Changes part of a subclass loadout ({ grenade, class, aspects, fragments }), keeps it valid, and saves. */
export function setLoadout(s, classId, subId, patch) {
  const next = sanitizeLoadout(classId, subId, { ...getLoadout(s, classId, subId), ...patch }, playerLevel(s));
  s.loadout = s.loadout || {};
  s.loadout[classId] = { ...(s.loadout[classId] || {}), [subId]: next };
  writeSave(s);
  return next;
}

export const getItem = (s, id) => s.inventory.find((i) => i.id === id);
export const getEquipped = (s, slot) => getItem(s, s.equipped[slot]);
export const isEquipped = (s, it) => s.equipped[it.slot] === it.id;

export function playerPower(s) {
  const total = SLOTS.reduce((sum, sl) => sum + (getEquipped(s, sl)?.power ?? 0), 0);
  return Math.floor(total / SLOTS.length);
}

/**
 * Equips an item. Only one exotic armor piece and one exotic weapon can be equipped:
 * equipping a second one is refused, and this returns the exotic already equipped
 * in another slot (null when the item was equipped).
 */
export function equipItem(s, id) {
  const it = getItem(s, id);
  if (!it) throw new Error(`equipItem: no item ${id}`);
  if (it.rarity === 'exotic') {
    const slots = it.kind === 'weapon' ? ['primary', 'special', 'heavy'] : ['helmet', 'arms', 'chest', 'legs'];
    const other = slots.map((sl) => sl !== it.slot && getEquipped(s, sl)).find((x) => x && x.rarity === 'exotic');
    if (other) return other;
  }
  s.equipped[it.slot] = id;
  it.isNew = false;
  writeSave(s);
  return null;
}

/** Moves an unequipped item into the vault. Returns null on success, or why it couldn't. */
export function toVault(s, id) {
  const it = getItem(s, id);
  if (!it) throw new Error(`toVault: no item ${id}`);
  if (isEquipped(s, it)) return 'Equipped gear stays on your character.';
  if (s.vault.length >= VAULT_CAP) return `The vault is full (${VAULT_CAP} items).`;
  s.inventory = s.inventory.filter((i) => i !== it);
  s.vault.push(it);
  writeSave(s);
  return null;
}

/** Moves an item from the vault back to the character. Returns null on success, or why it couldn't. */
export function fromVault(s, id) {
  const it = s.vault.find((i) => i.id === id);
  if (!it) throw new Error(`fromVault: no vault item ${id}`);
  if (s.inventory.length >= INVENTORY_CAP) return `Your character is full (${INVENTORY_CAP} items). Dismantle or vault something first.`;
  s.vault = s.vault.filter((i) => i !== it);
  s.inventory.push(it);
  writeSave(s);
  return null;
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
