// U20b Legend and Ultimate II: the unlock reward menus (pick exotics), the Legendary/Ultimate mission exotics and Skip Campaign.
// Pure rules (no DOM, no Three.js) so tools/tests.html can check them. See docs/DECISIONS.md.
import { EXOTIC_RANDOM_WEAPONS, exoticArmorFor, WEAPON_SLOTS, ARMOR_SLOTS, LOCATIONS } from './data.js';
import { pickExotic, makeExotic, makeArmor, makeWeapon, rollItem, newId } from './loot.js';
import { tierOf, tierClears, anyBaseClear, campaignDone } from './campaign.js';
import { XP, LIGHT_CAP } from './progression.js';
import { addItem, addXp, playerPower, writeSave, ALL_MISSIONS, enforceSlotCap } from './save.js';

/** What each unlock offers: `armor` and `weapons` exotics are shown, the player keeps exactly `keepArmor` and `keepWeapons`. */
export const REWARD_MENUS = {
  legendary: { name: 'Legendary', armor: 3, weapons: 3, keepArmor: 1, keepWeapons: 1 },
  ultimate: { name: 'Ultimate', armor: 5, weapons: 5, keepArmor: 2, keepWeapons: 2 },
};

/** Picks `n` distinct names from `names`, each draw favoring ones not found yet (loot.js duplicate protection). */
export function pickDistinct(names, n, found = [], rnd = Math.random) {
  const left = [...names], out = [];
  while (out.length < n && left.length) {
    const name = pickExotic(left, found, rnd);
    out.push(name);
    left.splice(left.indexOf(name), 1);
  }
  return out;
}

/** Rolls a reward menu for this Guardian at their current Light. The rolled items are stored on the menu so they never reroll. */
export function rollMenu(s, tier, rnd = Math.random) {
  const def = REWARD_MENUS[tier];
  if (!def) throw new Error(`rollMenu: no reward menu for tier ${tier}`);
  const power = Math.max(1, Math.min(tierOf(tier).cap, playerPower(s)));
  const found = s.exoticsFound || [];
  const armorPool = exoticArmorFor(s.classId);
  const armor = pickDistinct(armorPool.map((x) => x.name), def.armor, found, rnd)
    .map((name) => { const a = makeArmor(armorPool.find((x) => x.name === name).slot, power, 4, null, s.classId, name); a.isNew = true; return a; });
  const weapons = pickDistinct(EXOTIC_RANDOM_WEAPONS.map((e) => e.name), def.weapons, found, rnd).map((name) => makeExotic(name, power));
  return { id: newId(), tier, armor, weapons };
}

/** Rolls a menu and stores it in this Guardian's save until it is claimed. */
export function queueMenu(s, tier, rnd = Math.random) {
  const menu = rollMenu(s, tier, rnd);
  s.pendingMenus = s.pendingMenus || [];
  s.pendingMenus.push(menu);
  writeSave(s);
  return menu;
}
export const pendingMenus = (s) => s.pendingMenus || [];

/** Why a pick is not a valid claim (not the exact counts, a repeat, or not in the menu), or null when it is. */
export function validateClaim(menu, armorIds, weaponIds) {
  const def = REWARD_MENUS[menu.tier];
  const dupe = (ids) => new Set(ids).size !== ids.length;
  if (dupe(armorIds) || dupe(weaponIds)) return 'Pick each item only once.';
  if (!armorIds.every((id) => menu.armor.some((x) => x.id === id)) || !weaponIds.every((id) => menu.weapons.some((x) => x.id === id))) return 'That item is not in this menu.';
  if (armorIds.length !== def.keepArmor) return `Choose exactly ${def.keepArmor} exotic armor piece${def.keepArmor === 1 ? '' : 's'}.`;
  if (weaponIds.length !== def.keepWeapons) return `Choose exactly ${def.keepWeapons} exotic weapon${def.keepWeapons === 1 ? '' : 's'}.`;
  return null;
}

/**
 * Claims a pending menu. Items go to the inventory; over the cap they go to the Postmaster (addItem). The menu is then gone.
 * Returns { items, sentToPostmaster } or { error }.
 */
export function claimMenu(s, menuId, armorIds, weaponIds) {
  const menu = pendingMenus(s).find((m) => m.id === menuId);
  if (!menu) return { error: 'That reward menu is gone.' };
  const error = validateClaim(menu, armorIds, weaponIds);
  if (error) return { error };
  const items = [...menu.armor.filter((x) => armorIds.includes(x.id)), ...menu.weapons.filter((x) => weaponIds.includes(x.id))];
  let sent = 0;
  for (const it of items) if (addItem(s, it)) sent++;
  s.pendingMenus = s.pendingMenus.filter((m) => m !== menu);
  writeSave(s);
  return { items, sentToPostmaster: sent };
}

/**
 * True when a clear earns the tier's extra exotic: Legendary drops one on every clear of the campaign's final mission,
 * Ultimate on the first clear of any mission.
 */
export const tierExoticDue = (tierId, isFinalMission, first) => (tierId === 'legendary' && isFinalMission) || (tierId === 'ultimate' && first);
/** That exotic: a random one at the mission's Light, favoring ones this Guardian has not found. */
export const rollTierExotic = (s, power, dest) => rollItem(power, 4, null, dest, s.classId, s.exoticsFound || []);

/**
 * What a clear's recordClear result sets off, in play order: the Legendary unlock (3+3 menu), the Ultimate unlock (5+5 menu), and the
 * first full Ultimate clear (no menu: it reveals the Inventory switch). Queues each menu in the save. Returns [{ kind, menu? }].
 */
export function unlockEvents(s, opened, rnd = Math.random) {
  const out = [];
  if (opened.legendary) out.push({ kind: 'legendary', menu: queueMenu(s, 'legendary', rnd) });
  if (opened.ultimate) out.push({ kind: 'ultimate', menu: queueMenu(s, 'ultimate', rnd) });
  if (opened.all) out.push({ kind: 'all' });
  return out;
}

// ---------- Skip Campaign ----------
/**
 * The XP a full base-campaign clear is worth: the Loot 2.0 note in progression.js puts one clean solo run at about 53,000 XP.
 * The missions' share is exact (each pays XP.mission plus XP.firstClear); the rest is kill XP, so this stays right if missions are added.
 */
export const SKIP_RUN_XP = 53000;
export const missionsXp = () => ALL_MISSIONS.length * (XP.mission + XP.firstClear);
export const skipXp = () => Math.max(SKIP_RUN_XP, missionsXp());
export const SKIP_LIGHT = LIGHT_CAP;

/** True when this Guardian may skip the base campaign: not cleared, not skipped before, and some Guardian on the account has cleared it for real. */
export const skipAvailable = (s) => !campaignDone(s, 'base') && !s.skipped && anyBaseClear(s);
/** The same for any Guardian class of the account: the active one, a stored one, or one not created yet. */
export function skipAvailableFor(s, classId) {
  if (!anyBaseClear(s)) return false;
  const g = classId === s.classId ? s : s.chars?.[classId] || { cleared: {}, skipped: false };
  return !campaignDone(g, 'base') && !g.skipped;
}

/**
 * Skip Campaign: every base mission counts as cleared (no mission drops), the account's XP is raised to a full clear's
 * (addXp, so levels and their unlocks come through the normal level track), the Guardian is outfitted with a full set of
 * Legendary gear at Light 200 (equipped), and the Legendary reward menu is queued. Returns { levelUp, gear, menu }.
 */
export function skipCampaign(s, rnd = Math.random) {
  if (!skipAvailable(s)) throw new Error('skipCampaign: not available for this Guardian');
  for (const m of ALL_MISSIONS) tierClears(s, 'base')[m.id] = true;
  const target = skipXp();
  const levelUp = s.progression.xp < target ? addXp(s, target - s.progression.xp) : null;
  const dest = LOCATIONS[LOCATIONS.length - 1].id; // one destination's set, so the four armor pieces share a set bonus
  const gear = [
    ...WEAPON_SLOTS.map((slot) => makeWeapon(slot, SKIP_LIGHT, 3)),
    ...ARMOR_SLOTS.map((slot) => makeArmor(slot, SKIP_LIGHT, 3, dest, s.classId)),
  ];
  for (const it of gear) { // equipped straight away; whatever it replaces must still fit the slot (the extras go to the Postmaster)
    it.isNew = false;
    s.inventory.push(it);
    s.equipped[it.slot] = it.id;
  }
  enforceSlotCap(s);
  s.skipped = true;
  const menu = queueMenu(s, 'legendary', rnd);
  writeSave(s);
  return { levelUp, gear, menu };
}
