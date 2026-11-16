// U25 Crucible: the pure PvP rules (no DOM, no Three.js) so tools/tests.html can check them.
// PvP numbers are fully separate from PvE: nothing here reads Light, weaponTierMult or playerDmgMult, and nothing in the PvE damage path
// changes. A hit only comes here when the activity has `pvp: true` (G.mission.pvp). See docs/U25_PROPOSAL.md.
import { shieldMax } from './armor.js';
import { falloffMult } from './combat.js';
import { ARCHETYPES, DEFAULT_FALLOFF, CLASSES } from './data.js';
import { LOOKS, SHADER_IDS, encodeAppearance } from './style.js';

// ---------- health ----------
export const PVP_HEALTH = 100;
/** Light off: 100 health plus the shield the armor's Resilience gives (armor.js shieldMax). */
export const pvpPool = (res = 0) => PVP_HEALTH + shieldMax(res);
/** The reference Resilience the TTK numbers are tuned for (a mid-build Guardian). */
export const PVP_REF_RES = 30;
export const PVP_REF_POOL = pvpPool(PVP_REF_RES);
/** The most health and shield any Guardian can have (Resilience 100): one-hit damage is sized to beat it. */
export const PVP_MAX_POOL = pvpPool(100);

// ---------- the one switch ----------
/** Can combatant `a` hurt combatant `b`? Only when the activity is PvP (`pvp: true`) and they are on opposite teams. Everything else can never hurt a teammate. */
export const pvpHurts = (mission, teamA, teamB) => !!(mission && mission.pvp === true && teamA && teamB && teamA !== teamB);

// ---------- weapons ----------
/**
 * Body damage per shot, precision multiplier and one-hit rules per archetype (the family; a frame scales damage by its own ratio).
 * `prec`: precision multiplier. `oneHit`: 'crit' (a precision hit kills), 'range' (a clean hit inside `range` m kills: `pellets` is how many
 * of a volley must land) or null. Primaries are tuned so their optimal-range time to kill (all body shots) lands inside TTK_BAND.
 */
export const PVP_WEAPONS = {
  auto: { dmg: 14, prec: 1.5 },
  hand: { dmg: 50, prec: 1.9 },
  pulse: { dmg: 18, prec: 1.6 },
  scout: { dmg: 40, prec: 1.7 },
  smg: { dmg: 10, prec: 1.4 },
  sidearm: { dmg: 22, prec: 1.6 },
  // specials: one-hit rules
  shotgun: { dmg: 22, prec: 1.0, oneHit: 'range', range: 6, pellets: 6 },
  fusion: { dmg: 36, prec: 1.0, oneHit: 'range', range: 10, pellets: 6 },
  sniper: { dmg: 70, prec: 2.6, oneHit: 'crit' },
  trace: { dmg: 4, prec: 1.3 },
  glaive: { dmg: 40, prec: 1.4 },
  forerunner: { dmg: 62, prec: 1.7 },
  // heavies: PvP direct hits (rockets and grenades also splash through the explosion rules below)
  linear: { dmg: 170, prec: 1.4 },
  rocket: { dmg: 140, prec: 1.0 },
  glauncher: { dmg: 100, prec: 1.0 },
  mg: { dmg: 22, prec: 1.3 },
  xenophage: { dmg: 50, prec: 1.3 },
  sword: { dmg: 90, prec: 1.0 },
};
/** The time to kill window, in seconds, every primary lands in at optimal range with every shot on the body (a reference Guardian). */
export const TTK_BAND = [0.9, 1.5];
/** Precision hits cannot cut the time to kill below this (it keeps a hand cannon from deleting a player in two shots). */
export const PRIMARIES = ['auto', 'hand', 'pulse', 'scout', 'smg', 'sidearm'];

/** A frame's damage ratio against its archetype, kept to +-20% so a frame trades damage for rate of fire without breaking the TTK. */
export const frameRatio = (frameDmg, archDmg) => (archDmg > 0 && frameDmg > 0 ? Math.min(1.2, Math.max(0.8, frameDmg / archDmg)) : 1);

/**
 * One shot's PvP damage. `arch`: archetype id. `o`: { crit, dist, range (the weapon's own range), ratio (frameRatio) }.
 * Returns { dmg, oneHit }: `oneHit` means the shot kills whatever pool it hits (apply with killDamage).
 * Pellet weapons call it once per pellet; the shotgun and fusion rules size each pellet so `pellets` of the volley landing inside the range kill.
 */
export function weaponDamage(arch, o = {}) {
  const W = PVP_WEAPONS[arch];
  if (!W) throw new Error(`pvp: no PvP numbers for weapon ${arch}`);
  const A = ARCHETYPES[arch], dist = o.dist ?? 0, ratio = o.ratio ?? 1;
  const range = o.range ?? A.range;
  const fall = falloffMult(A.falloff || DEFAULT_FALLOFF, dist, range);
  if (W.oneHit === 'crit') return { dmg: o.crit ? PVP_MAX_POOL : W.dmg * ratio * fall, oneHit: !!o.crit };
  if (W.oneHit === 'range') {
    if (dist <= W.range) return { dmg: Math.ceil(PVP_MAX_POOL / W.pellets), oneHit: false }; // inside the range: `pellets` of the volley kill anyone
    const k = Math.max(0.1, 1 - (dist - W.range) / W.range); // past it, the numbers fall away fast and the volley cannot kill
    return { dmg: W.dmg * ratio * fall * k * 0.5, oneHit: false };
  }
  return { dmg: W.dmg * ratio * fall * (o.crit ? W.prec : 1), oneHit: false };
}
/** Damage that kills a pool of `pool` (health plus shield) in one hit. */
export const killDamage = (pool) => Math.max(pool, PVP_MAX_POOL);

/** Seconds to kill the reference Guardian with every shot on the body at point-blank-to-optimal range. Pellet weapons count volleys. */
export function bodyTtk(arch, pool = PVP_REF_POOL) {
  const A = ARCHETYPES[arch], W = PVP_WEAPONS[arch];
  const per = (A.pellets || 1) * W.dmg;
  const shots = Math.ceil(pool / per);
  const gap = (n) => { // time of shot n (0-based) from the first
    if (A.mode === 'burst') { const b = Math.floor(n / A.burst), i = n % A.burst, step = 60 / A.rpm; return b * ((A.burst - 1) * step + A.burstDelay) + i * step; }
    return n * (60 / A.rpm);
  };
  return gap(shots - 1) + (A.charge || 0);
}

// ---------- ammo ----------
/** Reserve ammo a weapon starts every life with (anything above it is lost on death). Heavy weapons, swords included, start empty. */
export const SPAWN_AMMO = { sniper: 2, fusion: 2, shotgun: 2, glauncher: 2, trace: 40, glaive: 2, forerunner: 6, sidearm: 6 };
/** `slot`: the weapon's slot; a sidearm carries spawn ammo only as a special (primaries have infinite ammo). */
export function spawnAmmo(arch, slot) {
  if (slot === 'primary') return Infinity;
  if (slot === 'heavy' && arch !== 'glauncher') return 0;
  return SPAWN_AMMO[arch] ?? SPECIAL_DEFAULT_AMMO;
}
/** A family carried in the special slot that the list does not name (a frame can move a pulse rifle or scout rifle there) starts with this many rounds. */
export const SPECIAL_DEFAULT_AMMO = 6;
/**
 * What a weapon holds when a life starts: always the start amount in total, magazine first (anything above it is lost on death, and a spent
 * special is topped up to it). Returns { ammo (in the magazine), reserve }. A primary keeps its full magazine and infinite reserve.
 */
export function startLoad(arch, slot, mag) {
  if (slot === 'primary') return { ammo: mag, reserve: Infinity };
  const total = spawnAmmo(arch, slot), ammo = Math.min(mag, total);
  return { ammo, reserve: total - ammo };
}
/** A heavy crate gives 25% of the magazine, rounded up, at least 1; a sword pickup is about 10 swings. */
export function heavyCrateAmount(arch, mag) {
  if (arch === 'sword') return 10;
  return Math.max(1, Math.ceil(mag * 0.25));
}
/** Crate timings and sizes (data, so a later map can tune them). */
export const CRATES = { heavyEvery: 60, heavyFirst: 45, specialEvery: 30, specialFirst: 10, specialShare: 0.5, pickupR: 1.6 };
/** A small special crate gives half a brick (rounded up, at least 1) of the special's reserve. */
export const specialCrateAmount = (brick) => Math.max(1, Math.ceil(brick * CRATES.specialShare));

// ---------- abilities and supers ----------
/**
 * PvP numbers for ability, melee, super and explosion damage. The PvE number a site passes is scaled and capped, so each source has its own PvP
 * ceiling. `kind` (when a site names it) gets its own row first. A throwing knife precision hit still one-shots.
 */
export const PVP_ABILITY = {
  ability: { scale: 0.22, min: 12, max: 80 }, // grenades and class abilities (per hit or tick)
  melee: { scale: 0.4, min: 40, max: 90 },
  super: { scale: 0.08, min: 12, max: 60 }, // per hit or tick of a roaming or burst super
  explosion: { scale: 0.2, min: 10, max: 95 },
  perk: { scale: 0.2, min: 5, max: 40 },
  knife: { oneHitCrit: true, dmg: 70 },
  goldenGun: { dmg: 140, oneHitCrit: true },
  rocket: { dmg: 120 },
};
export function abilityDamage(source, raw, o = {}) {
  const T = (o.kind && PVP_ABILITY[o.kind]) || PVP_ABILITY[source] || PVP_ABILITY.ability;
  if (T.oneHitCrit && o.crit) return { dmg: PVP_MAX_POOL, oneHit: true };
  if (T.dmg != null) return { dmg: T.dmg, oneHit: false };
  return { dmg: Math.min(T.max, Math.max(T.min, raw * T.scale)), oneHit: false };
}

// ---------- Control ----------
export const CONTROL = {
  teamSize: 6,
  scoreLimit: 100,
  time: 600, // seconds
  killBase: 1, // points for a kill with no zone held
  killPerZone: 1, // plus this per zone the killer's team holds
  zones: 3,
  captureTime: 8, // seconds for one Guardian to take a neutral zone; more Guardians are faster
  captureMax: 3, // Guardians that add speed
  respawn: 4, // seconds
  radius: 7, // capture ring radius (m)
};
/** A kill's points: 1 plus 1 per zone the killer's team holds (so 1 to 4 on a three-zone map). */
export const killPoints = (zonesHeld, C = CONTROL) => C.killBase + C.killPerZone * Math.max(0, Math.min(C.zones, zonesHeld));
/**
 * Advances one capture zone. z: { owner: 'red'|'blue'|null, prog: -1..1 (negative leans red, positive blue), cap: 'red'|'blue'|null }.
 * `red`/`blue`: Guardians standing in the ring. The side with more present pushes; ties hold. Returns the same object, updated.
 * An owned zone must first be pushed back to neutral by the other team, then the other way.
 */
export function zoneStep(z, red, blue, dt, C = CONTROL) {
  const lead = Math.min(C.captureMax, Math.abs(red - blue));
  if (!lead) return z;
  const dir = red > blue ? -1 : 1; // -1 pushes toward red, +1 toward blue
  const k = (dt / C.captureTime) * (0.6 + 0.4 * lead);
  z.prog = Math.max(-1, Math.min(1, (z.prog ?? 0) + dir * k));
  if (z.prog <= -1) z.owner = 'red';
  else if (z.prog >= 1) z.owner = 'blue';
  else if (z.owner === 'red' && z.prog > -1 && dir > 0 && z.prog >= 0) z.owner = null;
  else if (z.owner === 'blue' && z.prog < 1 && dir < 0 && z.prog <= 0) z.owner = null;
  return z;
}
export const zonesHeld = (zones, team) => zones.filter((z) => z.owner === team).length;
/** The match result: 'red', 'blue' or 'draw'. `over` is true once someone reached the limit or the time ran out. */
export function controlResult(score, timeLeft, C = CONTROL) {
  const lead = score.red >= C.scoreLimit || score.blue >= C.scoreLimit;
  if (!lead && timeLeft > 0) return { over: false, winner: null };
  const winner = score.red === score.blue ? 'draw' : score.red > score.blue ? 'red' : 'blue';
  return { over: true, winner };
}

// ---------- AI Guardians (data; the behavior is js/guardian-ai.js) ----------
/** Deliberately "not too strong": slower to react, imperfect aim, and few precision hits. Bryce tunes these by feel. */
export const GUARDIAN_AI = {
  reaction: 0.45, // seconds before a newly seen enemy is engaged
  aimError: 0.02, // radians of miss at 20 m (grows with range)
  headshotChance: 0.2, // share of hits that count as precision hits, at most
  fireGap: 0.12, // extra seconds between bursts
  sight: 55, // m
  strafe: 2.2, // seconds per strafe direction
  regroupHp: 0.35, // pool share under which it retreats to a zone it holds
  abilityEvery: 14, // seconds between ability uses
  abilityDmg: 40, // what a thrown ability does in PvP
  loadouts: ['auto', 'hand', 'pulse', 'scout', 'smg', 'sidearm'], // the primaries AI Guardians carry
  specials: ['shotgun', 'sniper', 'fusion', 'glaive'], // every AI Guardian carries one special (U29)
  heavies: ['rocket', 'mg', 'linear'], // heavy picks: empty until the Guardian reaches a heavy crate (U29)
  // U29: movement and kits
  jumpV: 10.4, // take-off speed (reaches a ~2.2 m ledge with gravity 24)
  jumpReach: 2.4, // tallest obstacle top (above the feet) an AI Guardian jumps onto
  hopChance: 0.25, // chance per strafe flip of a combat hop
  classEvery: 18, // seconds between class ability uses (barricade, rift, dodge)
  superTime: 110, // seconds for a super to charge from empty with no kills
  superPerKill: 8, // super energy (of 100) per kill
  superDR: 0.5, // damage taken while a roaming super is up
};

// ---------- AI Guardian kits (U29) ----------
/** What each class's Light subclass brings, by element: the super an AI Guardian casts and its name for the HUD. */
export const BOT_SUPERS = {
  vanguard: { solar: { id: 'hammers', name: 'Hammer of Sol' }, arc: { id: 'fists', name: 'Fists of Havoc' }, void: { id: 'sentinel', name: 'Sentinel Shield' } },
  stalker: { solar: { id: 'goldengun', name: 'Golden Gun' }, arc: { id: 'staff', name: 'Arc Staff' }, void: { id: 'tether', name: 'Shadowshot' } },
  arcanist: { solar: { id: 'well', name: 'Well of Radiance' }, arc: { id: 'stormtrance', name: 'Stormtrance' }, void: { id: 'nova', name: 'Nova Bomb' } },
};
/** The grenades an AI Guardian can roll per element. `fx` names the shape it plays (js/guardian-ai.js). */
export const BOT_GRENADES = {
  solar: [{ id: 'solar', name: 'Solar Grenade', fx: 'pulse' }, { id: 'swarm', name: 'Swarm Grenade', fx: 'burst' }],
  arc: [{ id: 'pulse', name: 'Pulse Grenade', fx: 'pulse' }, { id: 'storm', name: 'Storm Grenade', fx: 'storm' }, { id: 'flux', name: 'Flux Grenade', fx: 'burst' }],
  void: [{ id: 'vortex', name: 'Vortex Grenade', fx: 'vortex' }, { id: 'axion', name: 'Axion Bolt', fx: 'burst' }, { id: 'suppressor', name: 'Suppressor Grenade', fx: 'burst' }],
};
/** The class abilities an AI Guardian can roll. */
export const BOT_CLASS = {
  vanguard: [{ id: 'barricade', name: 'Towering Barricade' }, { id: 'rally', name: 'Rally Barricade' }],
  stalker: [{ id: 'marksman', name: "Marksman's Dodge" }, { id: 'gambler', name: "Gambler's Dodge" }],
  arcanist: [{ id: 'rift', name: 'Healing Rift' }, { id: 'empower', name: 'Empowering Rift' }],
};
/** PvP numbers for AI Guardian abilities and supers (per hit, or per tick where it ticks). */
export const BOT_ABILITY = {
  grenade: { pulse: { r: 3.5, tick: 14, n: 4, first: 30 }, burst: { r: 3.5, dmg: 75 }, storm: { r: 4.5, tick: 16, n: 5 }, vortex: { r: 4.5, tick: 10, n: 8, last: 40 } },
  melee: 60,
  hammers: { n: 5, every: 1.2, r: 3.2, dmg: 75, range: 35 },
  fists: { n: 4, every: 1.6, r: 4, dmg: 90, lunge: 9 },
  sentinel: { n: 4, every: 1.3, dmg: 70, range: 30 },
  goldengun: { n: 3, every: 0.9, dmg: 140, range: 60 },
  staff: { n: 6, every: 1.1, dmg: 65, reach: 3.2, lunge: 8 },
  tether: { r: 5, dmg: 45, range: 40 },
  well: { r: 6, life: 18, blast: 70, burn: 8 },
  stormtrance: { t: 7, every: 0.3, dmg: 12, range: 14 },
  nova: { r: 6, dmg: 150, range: 40 },
};
/** Roaming supers last a while and cut the damage the caster takes; burst supers fire and end. */
export const ROAMING_SUPERS = ['hammers', 'fists', 'sentinel', 'staff', 'stormtrance'];

/** The Light subclass of `classId` with `element` ({ id, name }). */
export function subclassFor(classId, element) {
  const subs = CLASSES[classId]?.subclasses || {};
  const id = Object.keys(subs).find((k) => subs[k].element === element);
  return id ? { id, name: subs[id].name } : null;
}

/**
 * One AI Guardian's whole kit, rolled once for a match and kept every life (U29): class, subclass, grenade, class ability, super,
 * primary, special, heavy, and a look with a random shader (encoded the same way a human's appearance travels). `rng` returns [0, 1).
 */
export function rollKit(rng = Math.random) {
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const cls = pick(AI_CLASS_IDS), el = pick(AI_ELEMENT_IDS);
  const sub = subclassFor(cls, el), su = BOT_SUPERS[cls][el];
  const looks = Object.keys(LOOKS), shader = rng() < 0.85 ? pick(SHADER_IDS) : null;
  const look = { helmet: pick(looks), arms: pick(looks), chest: pick(looks), legs: pick(looks), shader };
  return {
    cls, el, sc: sub?.id || null, scName: sub?.name || '',
    gr: pick(BOT_GRENADES[el]).id, ca: pick(BOT_CLASS[cls]).id, su: su.id,
    arch: pick(GUARDIAN_AI.loadouts), special: pick(GUARDIAN_AI.specials), heavy: pick(GUARDIAN_AI.heavies),
    lk: encodeAppearance(look),
  };
}
export const grenadeDef = (el, id) => (BOT_GRENADES[el] || []).find((g) => g.id === id) || BOT_GRENADES[el]?.[0] || BOT_GRENADES.arc[0];
export const classDef = (cls, id) => (BOT_CLASS[cls] || []).find((c) => c.id === id) || BOT_CLASS[cls]?.[0] || null;
export const superName = (cls, el) => BOT_SUPERS[cls]?.[el]?.name || 'Super';

// ---------- Crucible modes ----------
/** The Crucible node's activities. `pvp: true` is the one switch that lets players hurt each other. */
export const CRUCIBLE_MODES = [
  { id: 'control', name: 'Control', pvp: true, map: 'bannerfall', teamSize: 6, desc: 'Two teams of six fight for three zones. Every kill scores more for each zone your team holds. First to 100 or the higher score at ten minutes wins.' },
  { id: 'duel', name: 'Duel', pvp: true, map: 'bannerfall', teamSize: 1, desc: 'One on one, in rounds. A kill wins the round; the clock ends it for whoever has more health left. First to 5 rounds. Same special ammo rules and crates as Control; supers charge as usual.' },
];
/** Duel: first to `toWin` rounds; a round lasts `roundTime` s (the higher pool wins it on the clock), with `between` s before the next starts. */
export const DUEL = { toWin: 5, roundTime: 120, between: 4 };
export const modeOf = (id) => CRUCIBLE_MODES.find((m) => m.id === id);
/** Who wins a Duel round on the clock: the team with the higher health pool; a tie gives no round. `pools`: { blue, red }. */
export const roundOnClock = (pools) => (pools.blue === pools.red ? null : pools.blue > pools.red ? 'blue' : 'red');

// AI Guardian classes and elements, handed out by slot (js/guardian-ai.js re-exports them).
export const AI_CLASS_IDS = ['vanguard', 'stalker', 'arcanist'];
export const AI_ELEMENT_IDS = ['arc', 'solar', 'void'];

/**
 * Can this lobby launch `modeId`? Control: at least one human is not required (a spectated match is a dev tool), at most 6 humans a team.
 * Duel: one or two humans (a second human goes to the other side automatically). `members`: [{ id, team }].
 */
export function launchCheck(members, modeId) {
  const mode = modeOf(modeId);
  if (!mode) return { ok: false, why: `Unknown mode ${modeId}` };
  if (!members.length) return { ok: false, why: 'Nobody is in the lobby' };
  if (modeId === 'duel') return members.length <= 2 ? { ok: true } : { ok: false, why: `A Duel is one on one: ${members.length} Guardians are in the lobby, so send some back to Control` };
  const blue = members.filter((m) => m.team !== 'red').length, red = members.length - blue;
  if (blue > mode.teamSize || red > mode.teamSize) return { ok: false, why: `A team holds ${mode.teamSize}: ${blue} on Blue, ${red} on Red` };
  return { ok: true };
}

/**
 * The match roster the host sends to everyone: humans first (their picked team; in a Duel the first is Blue, the second Red), AI Guardians fill
 * the rest. A slot: { gid (the member id, or 'g<n>' for an AI), human, name, team, slot (index within the team), cls, el, arch, special }.
 * `names` supplies the AI gamer tags (a fresh list every match).
 */
export function buildRoster(members, modeId, names = gamerTags(12), rng = Math.random) {
  const mode = modeOf(modeId);
  if (!mode) throw new Error(`Unknown Crucible mode ${modeId}`);
  const per = mode.teamSize, slots = [], used = { blue: 0, red: 0 };
  members.forEach((m, i) => {
    const team = modeId === 'duel' ? (i === 0 ? 'blue' : 'red') : m.team === 'red' ? 'red' : 'blue';
    slots.push({ gid: m.id, human: true, name: m.name, team, slot: used[team]++, cls: m.cls });
  });
  let n = 0;
  for (const team of ['blue', 'red']) {
    for (let i = used[team]; i < per; i++, n++) {
      // U29: a random kit per AI Guardian, kept for the whole match (every life), so its subclass and guns can be read and learned
      slots.push({ gid: `g${n}`, human: false, name: names[n % names.length] || `Bot${n}`, team, slot: i, ...rollKit(rng) });
    }
  }
  return { mode: modeId, slots };
}

/**
 * Should a `pvh` message be applied? It names the hit's `by` (the sender), the victim's team and the shooter's team. Player damage exists only
 * in a `pvp: true` activity, only between opposite teams, only from a sender who really is `by`, and never as more than a one-hit kill.
 */
export function acceptPvpHit(mission, from, by, shooterTeam, victimTeam, dmg) {
  if (!pvpHurts(mission, shooterTeam, victimTeam)) return false;
  if (from !== by) return false; // a member can only report its own shots
  return Number.isFinite(dmg) && dmg > 0 && dmg <= PVP_MAX_POOL;
}

/** The XP a finished match pays (a win pays more); the legendary comes from the normal pool. */
export const CRUCIBLE_REWARD = { xpWin: 600, xpLoss: 350, rarity: 3 };

// ---------- AI Guardian names ----------
// Random gamer tags with a Destiny flavour (never the game's own characters), made fresh for every match.
const TAG_DESTINY = ['Titan', 'Hunter', 'Warlock', 'Crota', 'Oryx', 'Thorn', 'Gjally', 'Sunshot', 'Nova', 'Void', 'Arc', 'Solar', 'Stasis', 'Strand', 'Pulse', 'Scout', 'Sniper', 'Shotty', 'Hammer', 'Golden', 'Gun', 'Traveler', 'Wellmaker', 'Raid', 'Hive', 'Thrall', 'Ogre', 'Warmind', 'Ahamkara', 'Exo', 'Awoken', 'Cabal', 'Fallen', 'Vex', 'Taken', 'Blink', 'Shadowshot', 'Hawkmoon', 'Eyasluna', 'Mida', 'Ace', 'Dawnblade', 'Sentinel', 'Striker', 'Stormcaller', 'Revenant', 'Lorentz', 'Whisper', 'Gally', 'Chaperone'];
const TAG_GAMER = ['Sweaty', 'Tryhard', 'Toxic', 'Salty', 'Clutch', 'Noscope', 'Lag', 'Zero', 'Dark', 'Shadow', 'Epic', 'Pro', 'Big', 'Xtreme', 'Daddy', 'Mommy', 'Ghost', 'Sniped', 'Rekt', 'Bot', 'Meta', 'Cracked', 'Rizz', 'Legend', 'Slayer', 'Reaper', 'Killer', 'Ninja', 'Wolf', 'Dragon', 'Sad', 'Angry', 'Tilted', 'Based', 'Cringe', 'Lowkey'];
const TAG_NOUN = ['Main', 'Gaming', 'Enjoyer', 'Andy', 'Kid', 'Lord', 'King', 'God', 'Boy', 'Gamer', 'Sweat', 'Diff', 'Gap', 'Merchant', 'Farmer', 'Enthusiast', 'Mains', 'Hours', 'Energy', 'Vibes', 'Truther', 'Hater', 'Simp'];
const TAG_NUM = ['69', '420', '1337', '07', '99', '2014', '123', 'xD', '2k', '777', '9000', '1', '88', '360', '2017'];
const LEET = { e: '3', o: '0', a: '4', i: '1', s: '5', t: '7' };
/** One random gamer tag, for example xX_ThornEnjoyer_Xx, SweatyTitan69, N0Land_Hunter, Crota_Is_Life. `rng` returns [0, 1). */
export function gamerTag(rng = Math.random) {
  const pick = (a) => a[Math.floor(rng() * a.length)];
  let t;
  switch (Math.floor(rng() * 7)) {
    case 0: t = `xX_${pick(TAG_DESTINY)}${pick(TAG_NOUN)}_Xx`; break;
    case 1: t = `${pick(TAG_GAMER)}${pick(TAG_DESTINY)}${pick(TAG_NUM)}`; break;
    case 2: t = `${pick(TAG_DESTINY)}${pick(TAG_NOUN)}${pick(TAG_NUM)}`; break;
    case 3: t = `${pick(TAG_DESTINY)}_Is_${pick(['Life', 'Love', 'Broken', 'Meta', 'Mid', 'Peak', 'Bae'])}`; break;
    case 4: t = `The${pick(TAG_GAMER)}${pick(TAG_DESTINY)}`; break;
    case 5: t = `${pick(TAG_GAMER)}_${pick(TAG_DESTINY)}`; break;
    default: t = `${pick(TAG_DESTINY)}${pick(TAG_NUM)}`;
  }
  if (rng() < 0.3) t = t.replace(/[eoaist]/gi, (c, i) => (i > 1 && rng() < 0.5 ? LEET[c.toLowerCase()] : c)); // a little leetspeak
  return t.slice(0, 20);
}
/** `n` different tags. */
export function gamerTags(n, rng = Math.random) {
  const out = new Set();
  for (let guard = 0; out.size < n && guard < n * 50; guard++) out.add(gamerTag(rng));
  return [...out];
}
