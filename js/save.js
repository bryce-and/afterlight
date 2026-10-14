import { SLOTS, LOCATIONS, RARITIES, CLASSES, EXOTIC_ARMOR } from './data.js';
import { resolveKit, sanitizeLoadout } from './subclass.js';
import { starterGear, dismantleValue, armoryGear, rollItem } from './loot.js';
import { levelInfo, rewardAt, subclassLevel, LIGHT_CAP } from './progression.js';
import { randInt } from './util.js';
import { frameFor, weaponStats } from './frames.js';
import { MODS, blankMods, migrateArmorStats } from './armor.js';
import { setForLegacy, appearance, shaderFor, SHADERS } from './style.js';

const KEY = 'afterlight_save_v2';
// First Light (v1.1) started every Guardian over: a pre-overhaul save is copied
// to BACKUP_KEY once, then cleared. Only its settings carry over.
const LEGACY_KEY = 'afterlight_save_v1';
export const BACKUP_KEY = 'afterlight_backup_v1';
export const SAVE_VERSION = 6;
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
  // Armor 2.0 (v1.5): six stats and four mod sockets. A legendary's perk becomes the matching mod in socket 1 when it
  // belongs to that armor slot; otherwise it is dropped (the mod is still unlocked for the player). Names, rarity, power kept.
  4: (s) => {
    s.armorNote = { dropped: 0 }; // the character screen explains the change once, then clears this
    for (const it of [...(s.inventory || []), ...(s.vault || [])]) {
      if (it.kind !== 'armor') continue;
      it.stats = migrateArmorStats(it, OLD_ARMOR_PTS);
      it.mods = blankMods();
      if (it.perk && MODS[it.perk]?.slot === it.slot) it.mods[1] = it.perk;
      else if (it.perk) s.armorNote.dropped++;
      delete it.perk;
    }
  },
  // Fashion Is Endgame (v1.6): legendary armor joins a destination set (stable from its id); shaders start empty.
  // One Guardian per class: everything owned belongs to the class being played, and armor becomes class-bound.
  // Exotic armor becomes that class's exotic for the slot (Armamentarium, say, becomes Starfire Protocol on a Warlock).
  // Power, stats, mods and rarity are kept; other names are kept too.
  5: (s) => {
    for (const it of [...(s.inventory || []), ...(s.vault || [])]) {
      if (it.kind !== 'armor') continue;
      if (it.rarity === 'legendary' && !it.set) it.set = setForLegacy(it);
      it.classId = s.classId;
      if (it.rarity === 'exotic') it.name = EXOTIC_ARMOR[s.classId][it.slot];
    }
    s.shaders = { owned: [], applied: {} };
    s.chars = {};
  },
};
const OLD_ARMOR_PTS = { common: 6, uncommon: 8, rare: 10, legendary: 13, exotic: 17 }; // v1.4 stat totals

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
  const kit = starterKit(classId);
  const s = {
    version: SAVE_VERSION, classId, glimmer: 250, inventory: kit.inventory, vault: [], equipped: kit.equipped, cleared: {}, subclass: {}, loadout: {},
    shaders: { owned: [], applied: {} }, chars: {},
    progression: { xp: 0, claimed: [] },
    settings: { ...DEFAULT_SETTINGS, ...backupSettings() },
  };
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
  const item = rollItem(power, rewardAt(level) === 'exotic' ? 4 : 3, undefined, null, s.classId);
  s.inventory.push(item);
  s.progression.claimed.push(level);
  writeSave(s);
  return { item };
}

/** The player's class + chosen subclass, with that subclass's loadout applied. */
export function activeKit(s) {
  const sid = subclassFor(s, s.classId);
  return resolveKit(s.classId, sid, s.loadout?.[s.classId]?.[sid], playerLevel(s));
}

/** The subclass a class plays: its stored choice if unlocked, otherwise its first starter. */
export function subclassFor(s, classId) {
  const sub = s.subclass?.[classId];
  return sub && CLASSES[classId].subclasses[sub] && isSubclassUnlocked(s, classId, sub) ? sub : Object.keys(CLASSES[classId].subclasses)[0];
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

// ---------- characters ----------
// One Guardian per class, like Destiny 2. The active one's gear is s.inventory and s.equipped; the others wait in
// s.chars[classId] = { inventory, equipped }. Items move between Guardians only through the shared vault, and armor
// (exotics too) only ever sits with its own class. Level, glimmer, shaders owned and the vault are account-wide;
// Light comes from each Guardian's own gear.

/** True when this Guardian can hold or wear the item (armor belongs to one class). */
export const usableBy = (it, classId) => it.kind !== 'armor' || !it.classId || it.classId === classId;
/** Guardians that have been played (the active one included). */
export const playedClasses = (s) => Object.keys(CLASSES).filter((c) => c === s.classId || s.chars?.[c]);

/** A Guardian's Light from its own equipped gear. */
export function charPower(s, classId) {
  const ch = classId === s.classId ? s : s.chars?.[classId];
  if (!ch) return 0;
  const total = SLOTS.reduce((sum, sl) => sum + (ch.inventory.find((i) => i.id === ch.equipped[sl])?.power ?? 0), 0);
  return Math.floor(total / SLOTS.length);
}

/** A new Guardian's kit: starter weapons and armor for its class, plus one common of every other weapon type. */
export function starterKit(classId, power = 10) {
  const gear = starterGear(classId);
  const equipped = Object.fromEntries(gear.map((it) => [it.slot, it.id]));
  const owned = new Set(gear.filter((i) => i.kind === 'weapon').map((i) => i.arch));
  return { inventory: [...gear, ...armoryGear(owned, power)], equipped };
}

/** Switches the active Guardian (creating it with a starter kit the first time). */
export function switchCharacter(s, classId) {
  if (!CLASSES[classId]) throw new Error(`switchCharacter: no class ${classId}`);
  if (classId === s.classId) return;
  s.chars = s.chars || {};
  s.chars[s.classId] = { inventory: s.inventory, equipped: s.equipped };
  const next = s.chars[classId] || starterKit(classId);
  delete s.chars[classId];
  s.classId = classId;
  s.inventory = next.inventory;
  s.equipped = next.equipped;
  writeSave(s);
}
/** What the Guardian looks like: the equipped armor's looks and the class's shader (style.js). */
export const wornAppearance = (s) => appearance(['helmet', 'arms', 'chest', 'legs'].map((sl) => getEquipped(s, sl)), shaderFor(s.shaders, s.classId));

/** Applies an owned shader to every armor piece of the current class (null = none). Returns an error or null. */
export function applyShader(s, id) {
  if (id !== null && (!SHADERS[id] || !s.shaders.owned.includes(id))) return 'You have not found that shader yet.';
  if (id === null) delete s.shaders.applied[s.classId]; else s.shaders.applied[s.classId] = id;
  writeSave(s);
  return null;
}

export function playerPower(s) {
  const total = SLOTS.reduce((sum, sl) => sum + (getEquipped(s, sl)?.power ?? 0), 0);
  return Math.floor(total / SLOTS.length);
}

/**
 * Equips an item. Only one exotic armor piece and one exotic weapon can be equipped:
 * equipping a second one is refused, and this returns the exotic already equipped
 * in another slot (null when the item was equipped). Armor of another class returns the reason as a string.
 */
export function equipItem(s, id) {
  const it = getItem(s, id);
  if (!it) throw new Error(`equipItem: no item ${id}`);
  if (!usableBy(it, s.classId)) return `Only a ${CLASSES[it.classId].name} can wear ${it.name}.`;
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
  if (!usableBy(it, s.classId)) return `${it.name} is ${CLASSES[it.classId].name} armor. Switch to your ${CLASSES[it.classId].name} to take it out.`;
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
