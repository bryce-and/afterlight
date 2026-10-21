# Architecture notes

The module map is in the README. These notes cover systems added during the overhaul and the rules for extending them.

## Save (`js/save.js`)
- Key `afterlight_save_v2`, `version: SAVE_VERSION` (currently 8: v3 added loadouts, v4 weapon archetypes, v5 armor stats and mods, v6 sets, shaders and characters, v7 `exoticsFound`, v8 XP on the v2.0 curve).
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

## Characters (`js/save.js`)
- One Guardian per class. The active one's gear is `s.inventory` / `s.equipped`; the others wait in `s.chars[classId] = { inventory, equipped }`. `switchCharacter` swaps them (a first-time class gets `starterKit`). Everything that reads the inventory keeps working on the active Guardian.
- Shared: XP/level, glimmer, `s.shaders.owned`, `s.vault`, `s.cleared`. Per Guardian: Light (`playerPower` / `charPower`), subclass and loadouts (already keyed by class), applied shader.
- Armor carries `classId` (exotics too). `usableBy(it, classId)` is the rule: `equipItem` refuses other-class armor and `fromVault` won't hand it out. Drops pass the class being played to `rollItem` / `makeArmor`.
- Exotic armor: `EXOTIC_ARMOR[classId][slot]` is a list (two per slot since v1.7; the first is the v1.6 piece), `exoticArmorFor(classId)` flattens it (`data.js`). Perks in `EXOTIC_ARMOR_PERKS` with ids the Player checks in `this.exo`; their numbers live in `combat.js`.
- Exotic duplicate protection: `rollItem(..., found)` with `save.exoticsFound` picks exotics through `pickExotic` (`loot.js`). `noteExotic` (`save.js`) records one whenever it reaches the player (`addItem`, reward claims, auto-dismantle). The list is shared by every Guardian.

## Style: looks, sets, shaders (`js/style.js`, `js/characters.js`)
- `style.js` is pure data and rules. `LOOKS` (palette or null for class colors, plus a variant per slot: visor, crest, cuff, plate, shoulder, knee, shin), `SETS` (one per destination id: piece names, bonus text, look), `SET_TUNE`, `SHADERS`, `lookOf(item)`, `activeSets(items)` (any `SET_PIECES` of one set, exotics never count), `rollShader`, `shaderFor`, `appearance` / `encodeAppearance` / `decodeAppearance`.
- `buildCharacter(classId, elementId, appearance)` builds the class silhouette and each slot from its look; the shader replaces the colors, glows keep the subclass color. Armor meshes carry `userData.slot`. The skeleton exposes `hip.userData.knee` and `shoulder.userData.elbow`.
- Appearance reaches fireteams as `lk` in the player state (`"helmet,arms,chest,legs|shader"`); a change rebuilds the avatar.
- Armor icons (`icons.js` `armorIconURL`) render the slot's meshes of the item's class in the current shader (`setArmorIconContext`), cached.
- A new set: add a `SETS` entry keyed by a location id, a look, a bonus, and its check in the Player (`sets.has(id)`). A new look variant: handle it in `body` / `helmet` in `characters.js`.

## Status effects (`js/status.js`)
- `STATUS` defines every player-visible timed effect once: name, HUD group (`general` above the abilities, `weapon` below), glyph, color, default duration, max stacks. `StatusSet` (on `Player.status`) holds the live ones: `apply`, `has`, `remaining`, `stacks`, `consume`, `remove`, `clearScope`, `tick`, `list`.
- Weapon effects pass `scope: w.idx` (the weapon slot). Heart of Inmost Light uses the ability name as its scope.
- The buff HUD (`updateBuffs` in `ui.js`) renders whatever is in the set, so a new effect needs only a `STATUS` entry and an `apply` call. `Player.update` ticks the set once per frame while alive.
- Enemy debuffs use the same class with `ENEMY_STATUS` (`Enemy.status`): weaken, slow, suppress, burn, poison, jolt. Pass them as `dealDamage` options (`{ weaken: 4 }`); members' hits carry them to the owner over the network (`hit` message). `explode` takes `debuffs`. The enemy plate lists them.
- Not on the registry: internal arming windows (Kill Clip and Voltshot reload windows), cooldowns.

## Subclasses (`js/subclass.js`)
- Pure data and rules. `GRENADES` (shared by element, `kind` names the behavior), `CLASS_ABILITIES` (shared by class), `ASPECTS` (one subclass each; `slots` = fragment slots opened, optional `unlockLevel`, `cd` multipliers, `classAs` to replace the class ability), `FRAGMENTS` (shared by element, optional `unlockLevel`). Melees and each subclass's original super stay on the subclass in `data.js`, with `defaults` for the loadout and `camera` on each super.
- Supers (v1.8): `SUPERS` holds the 12 Light Ascendant supers (`cls`, `sub`, `camera`, `unlockLevel`). `supersFor` lists a subclass's supers (original first), `superDef` returns the definition, `superLevel` the unlock. Durations are `SUPER_TIME` and numbers `SUPER_TUNE` in `combat.js`. In the Player, `startSuper` runs once at cast, `updateSuperMove` owns movement (Thundercrash flight, Daybreak hover, Nova Warp warps) and `updateAscendantSuper` runs each frame. Shared effects in `abilities.js`: `tornado`, `voidaxe` (claimed like an orb), `gatherstorm`, `well`, `blink`, and `ward` with `life` and `wol` (Ward of Dawn).
- Jumps (v1.8): `JUMPS[classId]` (optional `sub` limits one to a subclass, as Blink) and `JUMP_TUNE`. `Player.blink` moves in small `moveBody` steps so it cannot pass through a wall.
- Light Ascendant aspect and fragment numbers are `ASPECT_TUNE` and `FRAGMENT_TUNE`. Hellion and Ionic Sentry are `companion` effects with `fixed: true` (they stay where summoned). Aftershocks is called from `dealDamage` for this player's own Arc ability and super hits.
- Save v3: `save.loadout[classId][subId] = { super, jump, grenade, class, aspects, fragments }` (`super` and `jump` since v1.8, no version bump); missing means defaults. `sanitizeLoadout` is the single rule for validity (element, class, subclass, level, slots); `getLoadout` / `setLoadout` in `save.js` always go through it, and `activeKit` returns the kit with `resolveKit` applied, so the Player only reads `cls.abilities`, `cls.aspects`, `cls.fragments`.
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
- U11 families: `sword` (`mode: 'sword'`), `glaive` (hitscan bolts plus `w.energy`), `trace` (`mode: 'beam'`), `sidearm`. The behavior is in the Arsenal block of `Player` (`updateSword`, `swordSwing`, `guardReduce`, `glaiveMelee`, `fireBeam`/`beamHold`, `rocketRound`, `blightZone`, `plantTurret`); `ARSENAL` (top of `player.js`) holds the exotic numbers. `wGuard` is the weapon guard (the older `guarding` getter is the Sentinel super).
- Ammo slot per frame: `frameSlot(arch, frame)`; a `FRAMES` entry with `slot` and ammo set in `handling.set` (`reserve`, `brick`). `archesForSlot(slot)` and `makeWeapon` only draw named weapons that sit in the asked slot. `ARCHETYPES[x].noPerks` keeps perks that do not fit a family out of its pools.
- Exotic `mods`: dmg, rpm, mag, reload, spread and range multiply the roll; every other key replaces the handling value (reserve, brick, pellets, rocketRound, projectile, fan...). An exotic can also set `slot`.
- Hit perks must go through `Player.lootPerksOnHit`: `applyHit` calls it for bullets, `weaponExplosion` for explosions, and swings and beams use `applyHit`.
- `refreshWeapons` (`save.js`) recomputes derived weapon stats on load so balance changes reach owned weapons.
- Dev check: in the preview console, `(await import('/tools/arsenaltest.js')).run()` fires every new family and exotic at a dummy and reports errors, ammo and damage; `env(make)` gives scripted scenarios.
- Tracking rounds use the `swarm` projectile kind (a cluster of particles that homes on `target`); `Player.seekerSwarm` spawns one.

## Combat rules (`js/combat.js`)
- Pure tuning and rules shared by the game and the tests: super gain, Song of Flame, weapon tier scaling (`weaponTierMult`), primary boost, ability power, ADS spread (`spreadFor`), chain targets, Storm Grenade, stagger thresholds (`staggerFor`), damage-number drift.
- `dealDamage` applies weapon tier scaling to `weapon` and `perk` sources and decides stagger on the owner's side.

## Former traits and shared ability effects (`js/subclass.js` numbers, `player.js` behavior)
- Since v1.8.2 there are no subclass traits: each former trait is an aspect (`pyre`, `amplitude`, `resolve`, `chainofwoe`, `abyssal`, `crackling`, `bloom`, `unlimitedpower`, `giftsun`; tuning in `ASPECT_TUNE`) and each subclass's `defaults.aspects` equips its own. Hit effects go through `Player.traitHitOpts`, called from `dealDamage` for this player's own grenade and melee hits only (never `raw` relayed hits or jolt chains). Kill effects are in `Player.traitOnKill`. Grenade, powered melee and class ability use call `Player.abilityAspects` (Defender's Resolve). Gift of the Sun's Firesprites (`Player.firesprite`, from `buildOnKill` on Solar ability kills) are local tickers tracked in `Player.spriteTk`; the cap filters that list against `G.tickers` because a mission reset drops tickers without calling `dispose`.
- Class abilities can carry `sub` to limit them to one subclass (Phoenix Dive, Dawnblade); `classAbilitiesFor(classId, subId)` and `sanitizeLoadout` respect it. Phoenix Dive runs through `useClass` like the others (`Player.phoenixDive`, landing burst `Player.phoenixBurst`). Icarus Dash keeps its charges in `Player.icarus` and is triggered by Shift while airborne. Bloom's drain is one ticker per enemy (`Player.bloom`) that detonates if the enemy dies while unstable.
- Rift and barricade lifetimes are `CLASS_FX_LIFE` (combat.js); the caster gets a `riftup` / `barricadeup` status for the timer.
- Hits on a weakened enemy pass `weak` to `ui.hitmarker` and `ui.damageNumber` (yellow).
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
- `RELEASES` holds shipped updates only, newest first. The title card shows `titleRelease()`, the newest major update (x.y); hotfixes (x.y.z) only add an Update Log entry and need no `art`. `ROADMAP` holds curated teasers with a status from `ROADMAP_STATUSES` and no dates. The title screen renders both; adding an entry needs no UI change. Tests check ordering, statuses and the absence of dates.

## Loot 2.0 (v2.0)
- `js/loot-ui.js` holds the Inspect and Exotic Collection screens.
- `js/frames.js` holds `NAMED_WEAPONS`, `perkPoolFor` and `rollPerks`.
- `js/data.js` holds `PERK_COLUMNS`, `PERK_SLOTS` and `perkColumn`.
- `js/progression.js` holds `RARITY_GATE`, `canUseRarity`, `capRarity`, `maxRarityIndex` and `convertXp`.
- `js/save.js` has `enforceGates` and `canEquipLevel`. Save version is 8.

## Audio (`js/audio.js`, `js/music.js`) (v2.2)
- `js/audio.js` is synthesis only. `SHOT_RECIPES` (per archetype), `ELEMENT_TINT`, `ABILITY_RECIPES` and `FACTION_SOUND` are data; new weapons, elements and factions plug into them. Group buses (weapons 22, abilities 14, enemies 8, ui 10 voice caps) feed a shared room reverb and a compressor limiter. `spatial()` gives stereo pan and distance falloff from the camera.
- `sfx` takes an optional world position and element or faction: `sfx.shot(arch, at, el)`, `enemyShot(at, faction)`, `enemyDie`, `step` (heavy units at scale 1.35 or more), `explosion(r, at, el)`, `sword(kind)`, `reload(arch)`. Calls are safe before audio starts.
- `js/music.js` has four sections (explore, tense, combat, boss) chosen by the pure `musicSectionFor(prev, nearest, bossDist)` with hysteresis: combat enters under 35 m and stays under 50 m; tense enters under 70 m and stays under 95 m; boss enters under 70 m and stays under 85 m. A motif variant plays every 8 bars. `stinger(kind)` covers start, clear, boss and complete. Layers only schedule while audible. Music routes through the ducking gain `musicDest`, which `duck()` drives.
- `setEffectsVolume` drives `settings.effectsVolume` (pause menu, default 1, read with `??`, so no save version change).
- Co-op: teammates' gunfire is placed in the world and paced by archetype rpm (capped at 600).

## Enemy AI systems (v2.3, `js/colliders.js`, `js/nav.js`, `js/ai.js`)
- `js/colliders.js` holds the collider math with no rendering dependency (`moveBody`, `pushOutCircle`, `pointInColliders`, `footprintHit`, `orientedCollider`); `js/physics.js` re-exports it and adds `hasLOS`. A collider is `{ min, max }` (the world-axis bounding box, still used by every broad-phase user) plus an optional `rot` for a box yawed about Y. In a level kit use `K.obox(x, z, w, h, d, ry)` or `K.ocollider(...)`; `K.mesh` on a box with only a yaw and `collide: true` gets one automatically.
- `js/nav.js` builds `G.nav` per level (`buildNav`, in `startMission` and the arena swap). A cell is -1 (blocked or off the map) or its standable height. Colliders up to `NAV.ledgeMax` (2.2 m) are surfaces, taller ones are walls, overhead ones are ignored. `findPath` (A*, string-pulled, partial path when the goal is sealed off), `lineClear`, `floodReach`, `ledgeSpots` (`from` is the floor point a unit hops up from). Path requests are capped per frame by `G.navBudget`.
- `js/ai.js` is pure rules: leash (`LEASH`, `leashTarget`, `pastLeash`, `insideLeash`), cover (`COVER`, `coverAllowed`), close-range melee (`CLOSE_MELEE`), suicide blast (`SUICIDE`, `blastDamage`). New enemy types plug in through `ENEMY_TYPES` flags: `closeMelee: true`, `suicide: true`.
- `Enemy.steer` moves straight when the grid line is clear, otherwise follows a path; `updatePost` picks a ledge; `closeMeleeStep`, `suicideStep` and `detonate` are the new attacks; `flush` drives a unit out of cover (called from `explode`, suppression and the flank check). Enemy `pos.y` follows the nav height (it is no longer always 0). The co-op snapshot entry carries `y` and a flag byte (1 swing, 2 fuse lit).
- Dev: `/gamerule NavDebug true` draws the grid, paths and leash (`js/navdebug.js`); `tools/navtest.js` in the console runs `testNav(li, mi, seconds)`.

## Tiers, shields, grenades and the ammo meter (v2.4, `js/tiers.js`)
- `js/tiers.js` is pure data and rules with no rendering dependency, covered by tests in `tools/tests.js`. `TIERS` defines minor (red bar, base health) and major (orange bar, more health, damage and size, more XP); both keep the same abilities. `majorChance` and `rollTier` decide the tier (captains and heavies are majors most often). `FIRETEAM_SCALE` holds the count, health, damage and boss multipliers per fireteam size.
- `SHIELD` gives elemental shields per faction (captains on every faction); a burst of the matching element breaks one and hurts only enemies nearby. `GRENADE` lets grunt-type units throw grenades that hurt Guardians only. `FACTION_PROFILES` is the faction behavior data (Fallen strafe and short bursts, Hive cover use and rushing Cursed Thralls, Cabal long volleys and jetpacks). `JET` drives the Cabal Centurion (crouch, rise, hover, land, rocket leap), `ENRAGE` the Hive heavy and Ogre below 30% health, `SUICIDE_BLAST` the blast damage (capped so it is never a one-shot), and `BOSS_PHASE` the boss hold and push cycle.
- `AMMO_METER` is a hidden per-player meter that kills fill (by tier, and more for bosses); a full meter drops a special or heavy brick on the next kill. Ammo Finder mods fill it faster. It replaces the random ammo drops.
- `Enemy` (`js/enemies.js`) holds `tier`, its faction profile, `jetStep` and `jetPose`, `enrageStep`, `escortStep`, `grenadeStep` and the boss phase state. Co-op: the spawn message carries the tier, snapshot flag bits 4 (enraged) and 8 (Centurion airborne), and the `gr` message sends enemy grenades (each member simulates and damages itself, like enemy shots).

## Known limitations
- The in-mission HUD is built for keyboard and mouse. Under about 500 px wide the ability block overlaps the weapon list and vitals (true since v1.0).
- Companions (Child of the Old Gods, Arc Soul) follow the caster on every screen (ability fx carry the caster's id); only the caster's copy deals damage. Jolt arcs are drawn on every screen; jolt damage is dealt by the enemy's owner.
- Co-op sync: the host snapshot (15/s) carries each enemy's debuff bitmask and stagger time; members refresh debuffs for 0.3 s per snapshot. Zone, area-cleared and boss banners go out as `bn` messages.
- Sentinel Shield guard (v1.8.1): `S.guard` follows right-click; `takeDamage` cuts `SENTINEL_GUARD.cut` and counts `guardHits`. The character's `update` pose takes `guard` (blends to `GUARD_POSE`) and `blockHit()` flashes the shield. Each player's state packet carries `gd` and `gh`; a remote avatar flashes when `gh` goes up.
- HUD scale reaches 200%. At 200% on a 1280×720 screen the ability block and weapon list grow large enough to crowd the center of the screen.
- Celestial Nighthawk's 2.5× (4× for Golden Gun) applies to the first super hit while the super is active. Nova Bomb's projectile can land after the 0.8 s super ends, losing the 4× (unchanged from v1.1).
- `afterlight.html` (an older single-file entry) is stale and not maintained. `index.html` is the game.
- After a deploy, a browser can briefly pair a cached `index.html` with new modules. `tools/stamp_version.py` cache-busts every release; run it before each push.
- No current level has ramps or stairs, so units reach ledges only by hopping (up to 1.6 m). Dynamic colliders (Guardian barricades) are not on the nav grid; units path into them and are pushed out. Fireteam members see the leader's close-range swing as a raised arm and the suicide fuse as a blink, not the full animation.
