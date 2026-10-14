# Architecture notes

The module map is in the README. These notes cover systems added during the overhaul and the rules for extending them.

## Save (`js/save.js`)
- Key `afterlight_save_v2`, `version: SAVE_VERSION` (currently 5: v3 added loadouts, v4 weapon archetypes, v5 armor stats and mods).
- Changing the save shape means: add `MIGRATIONS[n]` (upgrades version n to n + 1 in place), bump `SAVE_VERSION`, and add a fixture test in `tools/tests.js`. `loadSave` runs the steps in order and refuses saves from a newer version without touching them.
- Pre-overhaul saves (`afterlight_save_v1`) are copied once to `afterlight_backup_v1`, then removed. A new Guardian takes only its settings.
- Storage is swappable (`useStorage`) so tests never touch the real save.

## Progression (`js/progression.js`)
- Pure data and functions: `XP` values, `xpToNext` curve, `levelInfo`, `rewardAt`, `RARITY_CURVE` + `rollRarity`, `LIGHT_CAP`.
- Level is derived from total XP (`save.progression.xp`) and never stored, so it can't drift. Claimed rewards are `save.progression.claimed` (level numbers).
- Level is account-wide (shared by every class, like the shared inventory). Subclass gating reads `unlockLevel` on the subclass in `data.js`; `activeKit` falls back to a starter if the stored choice is locked.
- XP is awarded through `gainXp` in `game.js`. Kills award it on every fireteam member's machine (host via `killEnemy`, members via the `kill` message in `coop.js`). Mission and cache XP go to whoever opens the cache.
- Drop rarity reads the player's level. Boss caches read a few levels higher (`bonus`), and the first item keeps its rare floor.

## Armor, mods and orbs (`js/armor.js`, `js/mods-ui.js`)
- `js/armor.js` is pure data and rules. `STAT_KEYS` (six stats, 0 to 100, tier = stat / 10), `CLASS_BASE`, `CLASS_STAT`, tier functions (`cooldownMult`, `superRateMult`) and the calibrated `speedMult`, `shieldMax`, `regenDelay`, `regenRate`. `MODS` holds all 57 mods (`slot`: `any` for stat mods in socket 0, or one armor slot; `cost`; `unlock` level). `ORB`, `CHARGE`, `MODS_TUNE` hold the numbers.
- An armor piece is `{ stats: { mob, res, rec, dis, int, str }, mods: [socket0..socket3] }`. `activeMods(item, level)` is the one rule for what works (right socket, unlocked, within energy, level 5 or above); `setMod` validates a change. `armorStats(classId, items, level)` gives the six stats and `modCounts` the mod counts that `Player.ap` reads (the former perks kept their ids, so `ap.handson`, `ap.dynamo` and the rest still work).
- `Player.applyStats` derives speed, shield, regen and `cdMax` from the stats (plus Fonts while armor is charged); change a stat source and call it. `statBase` is the stats without charge.
- Orbs: `Player.spawnOrb` sends an `orb` ability fx; every screen replays it (`abilities.js`), whoever touches it first calls `pickupOrb` and sends `orbc`, which removes it elsewhere. Armor charge is `armorCharge` / `armorChargeT` (not `charge`, which is the shoulder-charge state) mirrored to the `charge` status for the buff HUD.
- Kill mods go through `Player.modsOnKill` and hit mods through `Player.modOnHit`. They match grenade, melee and class ability use by time windows (`grenadeWin`, `meleeWin`, `classWin`). Anything with `companion: true` or `jolted: true` is a chain: no orbs, no Hands-On, no traces, weapon-kill super.
- Enemy melee and splash damage go through `damagePlayer(amount, from, 'melee' | 'splash')` so the resistance mods apply.
- The Mods screen (`mods-ui.js`) is a `.cs-mods` overlay inside the character screen; hovering a socket shows the list (CSS), clicking pins it.

## Status effects (`js/status.js`)
- `STATUS` defines every player-visible timed effect once: name, HUD group (`general` above the abilities, `weapon` below), glyph, color, default duration, max stacks. `StatusSet` (on `Player.status`) holds the live ones: `apply`, `has`, `remaining`, `stacks`, `consume`, `remove`, `clearScope`, `tick`, `list`.
- Weapon effects pass `scope: w.idx` (the weapon slot). Heart of Inmost Light uses the ability name as its scope.
- The buff HUD (`updateBuffs` in `ui.js`) renders whatever is in the set, so a new effect needs only a `STATUS` entry and an `apply` call. `Player.update` ticks the set once per frame while alive.
- Enemy debuffs use the same class with `ENEMY_STATUS` (`Enemy.status`): weaken, slow, suppress, burn, poison, jolt. Pass them as `dealDamage` options (`{ weaken: 4 }`); members' hits carry them to the owner over the network (`hit` message). `explode` takes `debuffs`. The enemy plate lists them.
- Not on the registry: internal arming windows (Kill Clip and Voltshot reload windows), cooldowns.

## Subclasses (`js/subclass.js`)
- Pure data and rules. `GRENADES` (shared by element, `kind` names the behavior), `CLASS_ABILITIES` (shared by class), `ASPECTS` (one subclass each; `slots` = fragment slots opened, optional `unlockLevel`, `cd` multipliers, `classAs` to replace the class ability), `FRAGMENTS` (shared by element, optional `unlockLevel`). Melees and supers stay on the subclass in `data.js`, with `defaults` for the loadout and `camera` on each super.
- Save v3: `save.loadout[classId][subId] = { grenade, class, aspects, fragments }`; missing means defaults. `sanitizeLoadout` is the single rule for validity (element, class, subclass, level, slots); `getLoadout` / `setLoadout` in `save.js` always go through it, and `activeKit` returns the kit with `resolveKit` applied, so the Player only reads `cls.abilities`, `cls.aspects`, `cls.fragments`.
- Behaviors: `Player` keeps `asp` and `frag` sets and checks them where the effect happens (`buildOnKill`, `buildRegen`, `buildMult`, `detonateGrenade` upgrades, `dodge`, `useClass`). Shared FX live in `abilities.js` (`sunspot`, `companion`, upgrade flags on `pulse`, `storm`, `vortex`, `healburst`, `barricade`).
- A new aspect or fragment: add the data entry, then a check in the Player method where it acts. The subclass screen, the reward track and the tests pick it up from the data.
- Icons: `js/ability-icons.js` draws a frame per slot type around a glyph generated from the id; a test checks they are distinct.

## Weapons and archetypes (`js/frames.js`)
- `ARCHETYPES` (`data.js`) is the weapon family (Auto Rifle, Pulse Rifle...). `FRAMES[family]` holds Destiny's archetypes for it: `stats` multiply the family's base stats; `handling.mult` multiplies handling, `handling.set` replaces it (burst, charge, pellets, `move`, `tracking`, `wave`, `chargeBurst`), `handling.projectile` multiplies projectile values.
- `weaponStats(item)` is the only place stats are computed: family x archetype x rarity (exotics x their own `mods`), plus the heavy-slot bonus. There is no random roll, so every copy of a weapon is identical; only perks roll. `weaponHandling(item)` is what the Player fires with and what the tooltip reads.
- `LEGENDARY_WEAPONS` fixes each named legendary's family, archetype and element. Lower rarities roll an archetype once at drop (`item.frame`). Exotics have no `frame`.
- A new archetype: add a `FRAMES` entry (and its behavior in `Player.fire` / `weaponExplosion` if it needs one); a test keeps each family's damage per second within 15%.
- Elements: `ELEMENTS` carries a `symbol` (SVG) used by `elementIcon` (`icons.js`). `ENERGY` (what weapons roll) includes Stasis and Strand; `SHIELD_ELEMENTS` (enemy shields) stays Light-only.
- Icons: `weaponIcon` renders the viewmodel at a diagonal into a square, cached per family, rarity, element (and exotic name).
- Tracking rounds use the `swarm` projectile kind (a cluster of particles that homes on `target`); `Player.seekerSwarm` spawns one.

## Combat rules (`js/combat.js`)
- Pure tuning and rules shared by the game and the tests: super gain, Song of Flame, weapon tier scaling (`weaponTierMult`), primary boost, ability power, ADS spread (`spreadFor`), chain targets, Storm Grenade, stagger thresholds (`staggerFor`), damage-number drift.
- `dealDamage` applies weapon tier scaling to `weapon` and `perk` sources and decides stagger on the owner's side.

## Traits and shared ability effects (`js/subclass.js` numbers, `player.js` behavior)
- Every subclass has a `passive` (trait) shown on the subclass screen. Hit traits (Sunbreaker, Nightstalker, Stormcaller) go through `Player.traitHitOpts`, called from `dealDamage` for this player's own grenade and melee hits only (never `raw` relayed hits or jolt chains). Kill traits (Striker, Gunslinger, Voidwalker) are in `Player.traitOnKill`. Tuning is `TRAITS`.
- Sunspots (`castFx('sunspot')`) burn enemies inside on the caster's screen (`SUNSPOT`); Hammer of Sol impacts and Sol Invictus both make them.
- Healing Grenade orb (`healburst`): replayed on every screen; each player picks it up once on their own screen (`HEAL_ORB`). The thrown hammer explodes after `HAMMER_FUSE.fuse` seconds on the caster's screen (the blast syncs as an explosion).

## Ready Up (`js/net.js`)
- The host owns `net.ready` (member ids) and sends it in the `lobby` message. Members send `{ t: 'ready', on }`. `readyState(members, ready, sel)` is the rule: a pick and every current member ready. The last ready calls `net.onAllReady(sel)`, which launches through the existing `launchFireteam` / `launchActivity`. Readiness resets on a new pick (`setSelection`) or a roster change.

## Feed vs buff HUD (`ui.feed`, `js/status.js`)
- The top-right feed is for drops and notices only (items, level up, Underpowered, arena moving, co-op notices, reinforcements, ammo). An effect with a duration goes on the status registry only. A one-off proc (White Nail, Skullfort, hammer recovered...) is a `STATUS` entry with `t: 1.5`.

## Colliders that Guardians pass
- A collider with `pass: true` (barricades) blocks enemies (`pushOutCircle`) and enemy shots (`pointInColliders`), but `moveBody` skips it and player projectiles use `pointInColliders(p, 0, true)`. Enemy cover search skips it.

## Zones and waves (`combat.js` `waveStep`)
- Missions and activities ask `waveStep(alive, waveIdx, waveCount, isBoss)` each check: it spawns the next wave at 2 or fewer alive and only clears when every wave has spawned and none are alive, never on the check that spawned a wave.

## Update Log / Roadmap (`js/releases.js`)
- `RELEASES` holds shipped updates only, newest first. `ROADMAP` holds curated teasers with a status from `ROADMAP_STATUSES` and no dates. The title screen renders both; adding an entry needs no UI change. Tests check ordering, statuses and the absence of dates.

## Known limitations
- The in-mission HUD is built for keyboard and mouse. Under about 500 px wide the ability block overlaps the weapon list and vitals (true since v1.0).
- Companions (Child of the Old Gods, Arc Soul) follow the caster on every screen (ability fx carry the caster's id); only the caster's copy deals damage. Jolt arcs are drawn on every screen; jolt damage is dealt by the enemy's owner.
- Co-op sync: the host snapshot (15/s) carries each enemy's debuff bitmask and stagger time; members refresh debuffs for 0.3 s per snapshot. Zone, area-cleared and boss banners go out as `bn` messages.
- HUD scale reaches 200%. At 200% on a 1280×720 screen the ability block and weapon list grow large enough to crowd the center of the screen.
- Celestial Nighthawk's 2.5× (4× for Golden Gun) applies to the first super hit while the super is active. Nova Bomb's projectile can land after the 0.8 s super ends, losing the 4× (unchanged from v1.1).
- `afterlight.html` (an older single-file entry) is stale and not maintained. `index.html` is the game.
- After a deploy, a browser can briefly pair a cached `index.html` with new modules. `tools/stamp_version.py` cache-busts every release; run it before each push.
