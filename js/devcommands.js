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
/** U19: /playerlight sets a session-only Light for combat math (null = your real Light). Never saved. */
DEV.light = null;
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
  playerlight: {
    usage: '/playerlight <0-400|off>',
    options: () => ['off'],
    run(args, ctx) {
      const v = args.trim().toLowerCase();
      if (v === 'off' || v === '') { DEV.light = null; return { ok: true, msg: `Combat Light is your own again (${playerPower(ctx.save)}). Applies from the next launch.` }; }
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 400) return { ok: false, msg: 'Light must be a whole number from 0 to 400, or "off".' };
      DEV.light = n;
      return { ok: true, msg: `Combat Light is ${n} for this session (not saved). Applies from the next launch.` };
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
  whisperlevel: {
    usage: '/whisperlevel [descent|shaft|gallery|chasm|falls]',
    options: () => ['descent', 'shaft', 'gallery', 'chasm', 'falls'],
    run(args) {
      const seg = args.trim().toLowerCase() || 'descent';
      if (!['descent', 'shaft', 'gallery', 'chasm', 'falls'].includes(seg)) return { ok: false, msg: 'Segments: descent, shaft, gallery, chasm, falls' };
      startWhisperDev(seg).catch((err) => console.error(err));
      return { ok: true, msg: `Building The Whisper at ${seg} (static level only, no mechanics).` };
    },
  },
};

/** U21 dev: builds The Whisper (js/level-whisper.js) and drops you at a segment's checkpoint to look at it and test the jumps. Falling past voidY puts you back. */
async function startWhisperDev(segId) {
  const [{ G }, ui, { buildLevel }, { buildNav }, { Player }, { initEffects }, { cleanupMission }, W, THREE] = await Promise.all([
    import('./state.js'), import('./ui.js'), import('./world.js'), import('./nav.js'), import('./player.js'), import('./effects.js'),
    import('./game.js'), import('./level-whisper.js'), import('three'),
  ]);
  cleanupMission();
  const def = { id: 'whisper', name: 'The Whisper', power: 0, boss: { name: '', model: null }, mood: null };
  const level = buildLevel(W.WHISPER_LOC, def);
  G.level = level; G.scene = level.scene; G.colliders = level.colliders; G.staticMeshes = level.staticMeshes;
  G.nav = buildNav(G.colliders, level.bounds);
  G.hitDirty = true;
  G.scene.add(G.camera);
  initEffects(G.scene);
  G.enemies = []; G.projectiles = []; G.enemyShots = []; G.enemyGrenades = []; G.pickups = []; G.tickers = [];
  const seg = W.WHISPER_LAYOUT.segments.find((x) => x.id === segId) || W.WHISPER_LAYOUT.segments[0];
  const cp = new THREE.Vector3(...seg.checkpoint);
  G.mission = {
    loc: W.WHISPER_LOC, def, li: -1, mi: -1, g: 0, phase: 'whisperdev', current: 0, zones: [],
    fireteam: 1, coop: false, remote: false, revives: 3, lives: 0, bossModel: null, kills: 0, crits: 0, deaths: 0, loot: [],
    xp: 0, startTime: performance.now(), hpMult: 1, dmgMult: 1, playerDmgMult: 1, incomingMult: 1,
    checkpoint: cp.clone(), objective: `The Whisper: ${seg.name}`, waypoint: null, chest: null, failing: false, doneT: 0,
  };
  G.time = 0;
  G.player = new Player(G.save);
  G.player.spawn(cp);
  G.tickers.push({ update() { const P = G.player; if (P && P.pos.y < W.WHISPER_LAYOUT.voidY) { P.pos.copy(cp); P.vel.set(0, 0, 0); } return true; } });
  G.state = 'playing';
  ui.enterMission();
  ui.clearSubtitles();
  ui.centerMessage('The Whisper', seg.name, 3);
}

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
