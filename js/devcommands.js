// Secret dev console: the command table, name lookup and Tab completion. Pure logic (no DOM) so
// tools/tests.html can check it. The overlay is js/devconsole.js. Deliberately absent from the Update Log.
import { EXOTIC_WEAPONS, EXOTIC_ARMOR, ARCHETYPES, ARMOR_SLOTS, rarityIndex } from './data.js';
import { LEGENDARY_WEAPONS, NAMED_WEAPONS, frameSlot } from './frames.js';
import { SETS } from './style.js';
import { makeWeapon, makeExotic, makeArmor } from './loot.js';
import { LEVEL_CAP, xpForLevel } from './progression.js';
import { playerPower, playerLevel, writeSave, UNLOCK } from './save.js';

/** Session-only rules. Never saved, so a reload clears them. */
export const DEV = { invulnerable: false, mayhem: false, infiniteammo: false, navdebug: false, destinationunlock: false };
const RULE_NAMES = { invulnerable: 'Invulnerable', mayhem: 'Mayhem', infiniteammo: 'InfiniteAmmo', navdebug: 'NavDebug', destinationunlock: 'DestinationUnlock' };

/** Every giveable item by display name: { name, kind, rarity, ... } (weapons keep their named entry, armor its slot and class). */
export function giveCatalog() {
  const out = [];
  for (const n of LEGENDARY_WEAPONS) out.push({ name: n.name, kind: 'weapon', rarity: 'legendary', named: n });
  for (const n of NAMED_WEAPONS) out.push({ name: n.name, kind: 'weapon', rarity: n.rarity, named: n });
  for (const e of EXOTIC_WEAPONS) out.push({ name: e.name, kind: 'weapon', rarity: 'exotic', exotic: true });
  for (const [classId, slots] of Object.entries(EXOTIC_ARMOR)) {
    for (const [slot, names] of Object.entries(slots)) for (const name of names) out.push({ name, kind: 'armor', rarity: 'exotic', slot, classId });
  }
  for (const [setId, set] of Object.entries(SETS)) for (const slot of ARMOR_SLOTS) out.push({ name: set.pieces[slot], kind: 'armor', rarity: 'legendary', slot, setId });
  return out;
}

/** Exact name first, then a unique prefix, then a unique substring (all case-insensitive). Returns { entry } or { error }. */
export function findGive(text, catalog = giveCatalog()) {
  const q = text.trim().toLowerCase();
  if (!q) return { error: 'Usage: /give <weapon or armor name>' };
  const exact = catalog.filter((c) => c.name.toLowerCase() === q);
  if (exact.length) return { entry: exact[0] };
  for (const test of [(n) => n.startsWith(q), (n) => n.includes(q)]) {
    const hits = catalog.filter((c) => test(c.name.toLowerCase()));
    const names = [...new Set(hits.map((h) => h.name))];
    if (names.length === 1) return { entry: hits[0] };
    if (names.length > 1) return { error: `Which one? ${names.slice(0, 6).join(', ')}${names.length > 6 ? ', ...' : ''}` };
  }
  return { error: `No weapon or armor named "${text.trim()}".` };
}

/** Builds the item for a catalog entry, marked `spawned` so it stays out of duplicate protection and the Exotic Collection. */
export function buildGiven(entry, power, classId) {
  let item;
  if (entry.kind === 'weapon') {
    if (entry.exotic) item = makeExotic(entry.name, power);
    else {
      const n = entry.named;
      item = makeWeapon(frameSlot(n.arch, n.frame), power, rarityIndex(entry.rarity), n.arch, null, n);
    }
  } else if (entry.rarity === 'exotic') item = makeArmor(entry.slot, power, 4, null, entry.classId, entry.name);
  else item = makeArmor(entry.slot, power, 3, entry.setId, classId);
  item.spawned = true;
  return item;
}

const ruleKey = (t) => Object.keys(RULE_NAMES).find((k) => k === t.toLowerCase());

/**
 * Commands. `run(args, ctx)` returns the message to show and throws nothing for bad input (it returns the error text
 * with `ok: false`). `ctx`: { save, grant(item) }.
 */
export const COMMANDS = {
  give: {
    usage: '/give <weapon or armor name>',
    options: () => [...new Set(giveCatalog().map((c) => c.name))],
    run(args, ctx) {
      const r = findGive(args);
      if (r.error) return { ok: false, msg: r.error };
      const item = buildGiven(r.entry, Math.max(1, playerPower(ctx.save)), ctx.save.classId);
      ctx.grant(item);
      return { ok: true, msg: `Gave ${item.name} (${item.rarity}${item.kind === 'armor' && r.entry.classId ? `, ${r.entry.classId} only` : ''}).` };
    },
  },
  gamerule: {
    usage: '/gamerule <Invulnerable|Mayhem|InfiniteAmmo|NavDebug|DestinationUnlock> [true|false]',
    options: () => Object.values(RULE_NAMES),
    run(args) {
      const [rule, val] = args.trim().split(/\s+/);
      const k = rule && ruleKey(rule);
      if (!k) return { ok: false, msg: `Unknown rule "${rule || ''}". Rules: ${Object.values(RULE_NAMES).join(', ')}` };
      if (val !== undefined && val !== 'true' && val !== 'false') return { ok: false, msg: `Value must be true or false, not "${val}".` };
      DEV[k] = val === undefined ? !DEV[k] : val === 'true';
      if (k === 'destinationunlock') { UNLOCK.all = DEV[k]; }
      return { ok: true, msg: `${RULE_NAMES[k]} is now ${DEV[k] ? 'ON' : 'OFF'}.` };
    },
  },
  playerlevel: {
    usage: `/playerlevel <1-${LEVEL_CAP}>`,
    options: () => [],
    run(args, ctx) {
      const n = Number(args.trim());
      if (!Number.isInteger(n) || n < 1 || n > LEVEL_CAP) return { ok: false, msg: `Level must be a whole number from 1 to ${LEVEL_CAP}.` };
      ctx.save.progression.xp = xpForLevel(n);
      writeSave(ctx.save);
      return { ok: true, msg: `Player level is now ${playerLevel(ctx.save)}.` };
    },
  },
};

/** Runs one line such as "/give Sunshot". Returns { ok, msg }. */
export function runCommand(line, ctx) {
  const m = line.trim().match(/^\/?(\S+)\s*(.*)$/);
  if (!m) return { ok: false, msg: 'Type a command, for example /gamerule Mayhem' };
  const cmd = COMMANDS[m[1].toLowerCase()];
  if (!cmd) return { ok: false, msg: `Unknown command "${m[1]}". Commands: ${Object.keys(COMMANDS).map((c) => '/' + c).join(' ')}` };
  return cmd.run(m[2], ctx);
}

/** Tab completion. Returns every full line the typed text could become (empty when nothing matches). */
export function completions(line) {
  const m = line.match(/^(\/?)(\S*)(\s+(.*))?$/s);
  if (!m) return [];
  const [, slash, word, , rest] = m;
  if (rest === undefined) {
    return Object.keys(COMMANDS).filter((c) => c.startsWith(word.toLowerCase())).map((c) => `/${c} `);
  }
  const cmd = COMMANDS[word.toLowerCase()];
  if (!cmd) return [];
  const q = rest.toLowerCase();
  const opts = cmd.options().filter((o) => o.toLowerCase().startsWith(q));
  return opts.map((o) => `${slash || '/'}${word.toLowerCase()} ${o}`);
}
