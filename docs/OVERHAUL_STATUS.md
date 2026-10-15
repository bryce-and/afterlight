# Overhaul Requirement Tracker

Source: `Afterlight Update V3`. Baseline `09e02dc` (v1.0). "Current" for unstarted rows is from code reading only.
Statuses: Not assessed · Planned · In progress · Implemented · Tested · Complete and published · Blocked.

## Core

| ID | Requirement | Current (code) | Update | Status |
|---|---|---|---|---|
| R01 | Social space: the Tower, hangout | Missing | U13 | Planned |
| R02 | Postmaster | Missing (overflow auto-dismantles) | U13 | Planned |
| R03 | Shooting range at-light | Missing | U13 | Planned |
| R04 | Director screen with planets, locked until campaign progress | Partial: list + 3D planet, linear mission unlock | U12 | Planned |
| R05 | Campaign story, Ghost narrates, no player voice | Missing (one-line mission descriptions) | U12 | Planned |
| R06 | Calus antagonist | Missing | U12 | Planned |
| R07 | Leviathan dungeon: one evolving mechanic, multiple bosses, scales to 1 to 3 players (HP and mechanics) | Missing | U18 | Planned |
| R08 | Player level 1 to 40 | XP curve in `progression.js`; kills shared by fireteam, mission and cache XP; HUD XP bar; Level tab | U1 | Complete and published (v1.1) |
| R09 | Third subclass drops at level 10 | `unlockLevel: 10` on Sentinel, Arcstrider, Stormcaller; unlock message mid-mission | U1 | Complete and published (v1.1) |
| R10 | Starters: Titan Sunbreaker+Fists of Havoc, Warlock Nova+Dawnblade, Hunter Golden Gun+Shadowshot | Gated in class select and the subclass panel; unit-tested | U1 | Complete and published (v1.1) |
| R11 | Drop quality scales with level; legendary rare at 15, near-exclusive at 40 | `RARITY_CURVE` by level (legendary ~5% at 15, ~90% at 40); unit-tested over 10k rolls | U1 | Complete and published (v1.1) |
| R12 | Leveling screen: reward track, legendary every 3 levels, exotic at 20 and 40 | Level tab: 40-node track, claim once, refuses when inventory is full | U1 | Complete and published (v1.1) |
| R13 | Modeled armor; unique exotic looks; destination sets that drop in all levels | Armor shows on the Guardian (Character screen, third-person body, fireteam avatars) from each piece's look (`js/style.js`, `js/characters.js`). Six destination sets drop as that destination's legendary armor. Exotics share one gold exotic look (Bryce: no per-exotic models) | U6 | Complete and published (v1.6) |
| R14 | Armor perk counts by rarity (superseded by V4: perks become mods) | Superseded: no perks. Four sockets on every piece, energy by rarity (4/6/8/10/10) | U5 | Complete and published (v1.5) |
| R15 | New destination adds new perks | Each destination's set brings its own 3-piece bonus (armor mods stay one pool) | U6 | Complete and published (v1.6) |
| R16 | Shaders recolor armor | 10 shaders, dropped from mission caches (never duplicates); one per class recolors all armor | U6 | Complete and published (v1.6) |
| R17 | Subclasses with working aspects, fragments, melee, supers, grenades | Registry `js/subclass.js`: 9 grenades shared by element, 2 class abilities per class, 36 aspects (4 per subclass), 24 fragments (8 per element), 21 supers, 11 class jumps; behaviors in `player.js` / `abilities.js`. v1.8: all 18 test loadouts (every aspect, fragment and jump) exercised in a mission with no errors | U3, U8 | Complete and published (v1.8) |
| R18 | Super framework: animations, first vs third person check, aim check, subclass effects | Each super declares `camera` in `data.js`; all 9 checked in browser: camera matches and the enemy under the crosshair takes the damage. Super animations not done | U3 (camera, aim) | In progress |
| R19 | Exotic weapons/armor: unique perk and model | Weapons: perks + models. Armor: class exotics (8 per class, two per slot, since v1.7) with Destiny perks, one shared exotic look. Exotic drops favor ones not found yet (`pickExotic` in `loot.js`, `exoticsFound` in the save) | U4/U6/U7 | Complete and published (v1.7) |
| R20 | Legendary armor: perks, matching sets, destination tie, 3-piece set bonus, character-screen icons | Destination sets with any-3-of-4 bonuses; armor icons rendered from the piece in the current shader | U6 | Complete and published (v1.6) |
| R21 | Weapon archetypes, models, diagonal D2-style icons, Arc/Solar/Void/Stasis/Strand symbols | `js/frames.js`: Destiny archetypes (frames) for all 12 families, stats fixed by archetype; 74 named legendaries with fixed archetype and element (Destinypedia-sourced); diagonal square icons; a symbol per element; Stasis and Strand weapon elements (no verbs yet). Legendary model variety not done | U4 | Complete and published (v1.4) |
| R22 | Enemies up to standard: names, unique model per type, attacks | Faction models; 5 shared types | U10 | Planned |
| R23 | Stagger when shot | Non-boss enemies flinch 0.15 to 0.35 s on hits above a share of max HP (lower for crits, higher for captains and heavies), with a cooldown; `combat.js` `staggerFor` | U2 | Complete and published (v1.2) |
| R24 | VFX: tracking rounds are particles that track, not lightning; supers with cool factor | Swarm, Axion Bolt, Parasitic Nanites and Wolfpack Rounds are homing particle swarms (`swarm` projectile) that deal damage on arrival. Super VFX not done | U4 (seekers) | In progress |
| R25 | Bosses avoid cover; alternate push and hold | Bosses don't use cover; no push/hold logic | U10 | Planned |
| R26 | Tight ADS spread | Primary ADS cones 40 to 50% tighter, specials tighter; aimed movement no longer widens the cone; hip fire unchanged | U2 | Complete and published (v1.2) |
| R27 | Damage numbers drift from the hit to the side | Numbers pop at the hit, drift out to alternating sides and ease down (`combat.js` `dmgDrift`) | U2 | Complete and published (v1.2) |
| R28 | Buff HUD: general effects above abilities, weapon effects below, with timers; exotic effects visible | Status registry (`js/status.js`) drives the HUD: name, timer bar, seconds, stacks; exotic effects gold-bordered. Enemy debuffs moved to the registry in v1.3 | U2 | Complete and published (v1.2) |
| R29 | Visible super-charged animation; yellow bar when charged | Charging keeps the element color; when full the bar turns gold, pops, glows and sweeps | U2 | Complete and published (v1.2) |
| R30 | Enemy health bars and names when aimed at, opacity fade | Plate above the aimed enemy's head (tracks it) with faction emblem, name, HP and shield; fades over ~1 s after looking away; bosses keep the boss bar | U2 | Complete and published (v1.2) |
| R31 | Primary weapon / enemy HP rebalance; slight ability tune-back | Weapons scale with mission tier at 75% of enemy HP growth, primaries +10%, ability power 1.4 to 1.3. Auto Rifle on a Vandal at matched Light: 7/12/18 body shots in missions 1/9/18 before, 6/7/7 after | U2 | Complete and published (v1.2) |
| R32 | Super gain and damage nerf; less super energy from kills | Passive 0.75 to 0.5%/s, kills 3 to 10% down to 2 to 6%, Hands-On 4 to 3, super damage -9% (`SUPER_POWER` 2.2 to 2.0) | U2 | Complete and published (v1.2) |
| R33 | Song of Flame uptime too high | No energy leak found (gain is blocked during supers). Duration 12 to 10 s, ability regen 8x to 4x. Modeled uptime with a kill every 2 s: 21% to 13% | U2 | Complete and published (v1.2) |
| R34 | Stormtrance initially hits up to 4 from the caster | Primary + 3 chains; verified in browser (4 of 5 clustered enemies per tick) | U2 | Complete and published (v1.2) |
| R35 | Celestial Nighthawk double-buffs Golden Gun? | Cause: the splash re-hit the shot's target. Splash now skips it; verified the 6x applies once and the target takes no splash | U2 | Complete and published (v1.2) |
| R36 | Storm Grenade hits multiple enemies; slight damage nerf OK | Every enemy under the cloud each 0.3 s tick, 40 to 30 per strike; verified 5 of 5 hit | U2 | Complete and published (v1.2) |
| R37 | Subclass screen like D2: aspects (class-unique), fragments and grenades (shared per element), super/melee/class/jump choices, unique icons | Subclass screen: slots for super, class, jump, melee, grenade, 2 aspects, up to 4 fragments; option picker, detail pane, phone layout; generated icon per ability/aspect/fragment (`js/ability-icons.js`). Grenade, class, super (v1.8) and jump (v1.8) choices done; alternate melees not built | U3, U8 | In progress |
| R38 | New locations and reworked levels | 6 destinations, 18 hand-built maps | U12/U14 | Planned |
| R39 | Objectives within missions | Only travel / clear / boss | U12 | Planned |
| R40 | Patrol spaces, working beacons, public events, heroic on mechanic, multiple factions | Missing | U14 | Planned |
| R41 | Sparrow usable on all levels | Missing | U14 | Planned |
| R42 | More verticality in missions | Player can stand on boxes; enemies locked to y=0 | U10/U12 | Planned |
| R43 | Properly lit dark interiors | Max 6 lights per map | U12 | Planned |
| R44 | Map collision fix | AABB only; specific bugs not yet reproduced | U12 | Not assessed |
| R45 | Legendary campaign after all base missions (current count 18): unlock animation, 25 light under | Missing | U15 | Planned |
| R46 | Ultimate after Legendary: better animation, 50 under, no revives (death restarts) | Missing | U15 | Planned |
| R47 | Same base campaign, harder (not a new campaign) | n/a | U15 | Planned |
| R48 | Light past 100: base 200, Legendary 300, Ultimate 350 | Base cap 200 and missions rescaled to 10 to 180 (v1.1). 300/350 pending | U1 (200), U15 (300/350) | In progress |
| R49 | Ultimate unlocks a switch to equip unlimited exotics | Missing (one exotic weapon + one armor enforced) | U15 | Planned |
| R50 | Non-campaign activities scale to your Light; fireteam brought to leader's Light; loot by own Light | Partial: Horde starts at the player's power | U15 | Planned |
| R51 | Exotic missions: timed, unique mechanics, exclusive exotic, first at player level 30 | Missing | U16 | Planned |
| R52 | New enemy types: temporary shields (some), grenades, distinct models and names | Missing | U10 | Planned |
| R53 | Distinct faction behaviors | Missing (names and models only) | U10 | Planned |
| R54 | Darkness supers and abilities | Missing | U17 | Planned |
| R55 | Aspects and fragments | 4 aspects per subclass since v1.8 (2 slots, each opens 1 or 2 fragment slots); 8 fragments per element. Level 10 subclasses earn their third aspect at 13/16/19; Spark of Ions (22) and Echo of Instability (25) on the reward track | U3 | Complete and published (v1.3) |
| R56 | Armor mods | 57 mods (12 stat, 10 helmet, 12 gauntlet, 11 chest, 12 leg) in `js/armor.js`; Mods screen in `js/mods-ui.js`; unit-tested rules; every orb and hit mod exercised in a mission | U5 | Complete and published (v1.5) |
| R57 | Armor stats affect ability cooldowns, Destiny-style (added by Bryce, not in V3) | Discipline (grenade), Strength (melee) and each class's own stat (Titan Resilience, Hunter Mobility, Warlock Recovery) scale cooldowns 1.3x at tier 0, 1.0x at 5, 0.65x at 10; floor 0.4x. Checked in a mission: cdMax matches the formula | U5 | Complete and published (v1.5) |
| R58 | Hunter Triple Jump is the ground jump + 2 (added by Bryce) | Two air jumps, the second at 85% height. Peak 4.2 m, below Titan Catapult Lift (4.8 m) | U3 | Complete and published (v1.3) |
| R59 | Enemy debuffs on the status registry (weaken, slow, suppress, burn, poison) | `Enemy.status` with `ENEMY_STATUS`; all applied through `dealDamage` and sent to the enemy's owner; plate shows them. Jolt added for Arc | U3 | Complete and published (v1.3) |

## Optional (nice to have)

| ID | Requirement | Current | Update | Status |
|---|---|---|---|---|
| O1 | Roguelike Horde: boons every 5 rounds, game paused, 10 s choice, stacking buffs or weapon swaps (with confirmation), mostly legendaries and some exotics, multiple exotic weapons OK, no exotic armor, AR/shotgun/GL start, run inventory resets but caches pay into real inventory | A 30-wave Horde exists (not roguelike) | U19 | Planned |
| O2 | PvP: 3 to 5 maps | Missing | U20 | Planned |
| O3 | Control and Duel | Missing | U20 | Planned |
| O4 | AI Guardians (not too strong) | Missing | U20 | Planned |

## Master-prompt requirements

| ID | Requirement | Update | Status |
|---|---|---|---|
| M1 | Title screen Update Log (released only) | U1 | Complete and published (v1.1) |
| M2 | Title screen Roadmap (curated teasers) | U1 | Complete and published (v1.1) |
| M3 | Requirement tracking, docs, decision log | U1 | Complete and published (v1.1) |
| M4 | Test and validation tooling | U1 | Complete and published (v1.1): `tools/tests.html`; 93 tests as of v1.8 |
| M5 | Versioned GitHub releases | U1 | Complete and published (v1.1) |

## V4 additions (2026-10-14)

| ID | Requirement | Update | Status |
|---|---|---|---|
| V01 | Ionic Trace refunds super too fast: investigate, nerf; tune super-related armor perks | H1 | Complete and published (v1.3.1): cause was a loop (uncapped Ionic Trace cooldown refunds on every Arc ability kill, jolt chains included, feeding Hands-On super per kill). Electrostatic 15 to 8%, Spark of Ions 10 to 5%, one trace per 0.5 s, none from jolt chains, Hands-On 3 to 1.5%/piece, Dynamo 12 to 8%. Scripted loop, empty to full super: Electrostatic + 3 Hands-On 5.8 s to 34.3 s; with Spark of Ions 1.1 s to 34.3 s; plain 77.8 s unchanged |
| V02 | Nerf Celestial Nighthawk (Nova Bomb, Golden Gun) | H1 | Complete and published (v1.3.1): Golden Gun 6x to 4x, other supers 4x to 2.5x (`combat.js` `NIGHTHAWK`) |
| V03 | Far fewer drops; caches give 2 to 3 items | H1 | Complete and published (v1.3.1): kill engrams grunt 2%, rusher 2%, captain 5%, heavy 8% (were 6/5/30/45%); bosses still drop 3; caches already gave 2 to 3 (unchanged) |
| V04 | Top-right feed shows item drops only | H1 | Complete and published (v1.3.1): feed keeps drops, auto-dismantle, inventory full, level up, Underpowered, arena moving, co-op notices, reinforcements, ammo. Buff duplicates removed; one-off procs are 1.5 s buff HUD entries |
| V05 | Thrown hammer clips into the ground | H1 | Complete and published (v1.3.1): rests on the surface it hits (`restHeight`); wall hits step back along the throw |
| V06 | Rally Barricade wider; players pass through, enemies don't | H1 | Complete and published (v1.3.1): Rally 2.6 to 4 m; both barricades are `pass` colliders (players and their shots pass; enemies and enemy shots blocked) and take the subclass color |
| V07 | Bigger enemy and player health bars; enemy bars follow HUD scale; HUD scale up to 200% | H1 | Complete and published (v1.3.1): plates and player bars about 1.5x; plate sizes use `--hud-scale`; slider 70 to 200% |
| V08 | Co-op: auto-revive downed players when an activity ends, even with no lives | H1 | Complete and published (v1.3.1): revived in place on boss defeat and on the final activity cache; no damage after completion; a wipe before completion still fails |
| V09 | Co-op: a player downed mid-jump drops to the ground | H1 | Complete and published (v1.3.1) |
| V33 | Co-op health check: zone/wave cleared with enemies alive; members missing host debuffs, stagger, zone and boss banners | H1 | Complete and published (v1.3.1): `waveStep` never clears on the check that spawns a wave (solo too); snapshot carries debuff bits and stagger; banners broadcast |
| V10 | Co-op: Arc Soul tracks correctly | H1 | Complete and published (v1.3.1): companion replays follow the caster's avatar (caster id on ability fx) |
| V11 | Thrown hammer glows and explodes after 7s if not picked up | U4 | Complete and published (v1.4): glows and pulses brighter, explodes (4 m Solar) at 7 s; picking it up first works as before |
| V12 | Hammer of Sol creates Sunspots; enemies inside burn | U4 | Complete and published (v1.4): every super hammer impact leaves a Sunspot. Every Sunspot (Sol Invictus too) burns enemies inside; the caster deals the damage |
| V13 | Healing Grenade places a white orb: heal + Restoration on touch | U4 | Complete and published (v1.4): white burst, then a white orb for 10 s; client-side, every Guardian can pick it up once on their own screen |
| V14 | Downed screen: skull animation, "You Died", "Reviving in X" | U4 | Complete and published (v1.4): solo and co-op |
| V15 | Co-op: Ghost glows over the downed body with "REVIVE" | U4 | Complete and published (v1.4) |
| V16 | Topbar "AFTERLIGHT" returns to the title screen | U4 | Complete and published (v1.4): in a fireteam it asks first, then leaves the fireteam |
| V17 | Title shows the current update name, "Version X.Y", and unique artwork | U4 (then every update) | Complete and published (v1.4): card from the newest `RELEASES` entry (`art` SVG); refresh every update |
| V18 | Armor mods replace perks: 4 sockets, 10 energy, slot 1 stat mods, a mod pool per armor slot, D2-style (no raid mods) | U5 | Complete and published (v1.5): energy is 4/6/8/10/10 by rarity (Bryce) |
| V19 | Mods screen with slide-in from the character screen's right-edge arrow | U5 | Complete and published (v1.5): arrow turns into a vertical tab under 900 px; locked below level 5 |
| V20 | Six armor stats (D2 new names) incl. cooldown stats | U5 | Complete and published (v1.5): the classic names (Bryce chose them over the new ones) |
| V21 | Every non-melee unit can melee at very close range, with an animation | U10 | Planned |
| V22 | Suicide units: Cursed Thrall (Hive), Explosive Shanks (Fallen) | U10 | Planned |
| V23 | Harder with 3 players (retune) | U10 | Planned |
| V24 | Taken and Scorn as full factions | U11 | Planned |
| V25 | Music and SFX overhaul: ambient/tense/orchestral music, weightier guns and abilities, light enemy SFX | U9 | Planned |
| V26 | 4 aspects per subclass, 8 fragments per element | U8 | Complete and published (v1.8): D2 fourth aspects where they exist (Unbreakable, On the Prowl, Ionic Sentry, Hellion, Crackshot), D1 names for the rest (Tempered Metal, Aftershocks, Fast Twitch, Angel of Light); 10 new D2 fragments |
| V27 | Missing Destiny 2 Light supers | U8 | Complete and published (v1.8): 12 selectable supers (Burning Maul, Thundercrash, Ward of Dawn, Twilight Arsenal, Blade Barrage, Spectral Blades, Gathering Storm, Storm's Edge, Well of Radiance, Nova Warp, Chaos Reach, Daybreak), each fired in a mission with camera and damage checked; unlocked at levels 14/17/23/26 |
| V28 | More class jumps, including Blink | U8 | Complete and published (v1.8): High/Strafe Lift, High/Strafe Jump, Balanced/Strafe Glide; Blink on Arcstrider and Voidwalker only, moved in steps so it stops at walls |
| V29 | Stasis and Strand subclasses for all classes, each with a second, original super of the opposite type | U17 | Planned |
| V30 | End every update session with a co-op connection check | Process | In place |
| V31 | Mobile only: touch controls, mobile HUD/menus, Mobile mode (calmer AI, bigger hitboxes). Desktop unchanged | U21 (optional) | Planned |
| V32 | Subclass traits for the 6 subclasses without one | U4 | Complete and published (v1.4): Sunbreaker burn, Striker Amplified, Gunslinger melee energy, Nightstalker weaken, Voidwalker detonation, Stormcaller jolt (`TRAITS` in `subclass.js`) |
| V34 | Weapon archetypes per family (D2 frames); stats fixed by archetype; named legendaries always the same archetype and element; archetype shown on the item (added by Bryce for U4) | U4 | Complete and published (v1.4) |
| V35 | Ready Up bar in the Director for fireteams; the last Guardian to ready launches the leader's pick; solo launches directly (added by Bryce for U4) | U4 | Complete and published (v1.4) |
| V36 | Orbs of Power and armor charge (added by Bryce for U5) | U5 | Complete and published (v1.5): shared orbs claimed by the first Guardian to touch one (verified across two `?localtest` tabs); charge on the buff HUD |
| V37 | Nerf Arc Soul (too much super, too much damage) and jolt (added by Bryce for U5) | U5 | Complete and published (v1.5). Measured, 4 clustered enemies, 10 s: Arc Soul damage 3,791 to 533 (73% of the old total was jolt chains from a trait bug: companion hits counted as grenade or melee hits and jolted). An Arc Soul kill gave 7.5% super with 3 Hands-On, now 2%. Jolt chains on a jolted group 4,586 to 892 (a crowd no longer multiplies it), single target 1,147 to 892 |
| V38 | Health bar and lives stay on top (added by Bryce during U5) | U5 | Complete and published (v1.5): a v1.0 rule moved them to the bottom under 900 px wide |
| V39 | Character select screen and character switch on the Character screen (added by Bryce during U6) | U6 | Complete and published (v1.6) |
| V40 | Separate inventories per Guardian, Destiny-style: own gear, inventory and Light; vault, level, glimmer and shaders shared; armor class-bound (added by Bryce during U6) | U6 | Complete and published (v1.6) |
| V41 | Exotic armor per class with Destiny-accurate perks (added by Bryce during U6) | U6 | Complete and published (v1.6): Liar's Handshake, Raiden Flux and Starfire Protocol added; Actium War Rig, Armamentarium and Ophidian Aspect retired; Nighthawk Golden Gun only, Nezarec's and Contraverse Void only |
| V42 | Stats shown only on the Mods screen (added by Bryce during U6) | U6 | Complete and published (v1.6): the Mods screen opens at any level as a stats view |
| V43 | 4 more exotic armor pieces per class (added by Bryce, U7) | U7 | Complete and published (v1.7): Mask of the Quiet One, Ursa Furiosa, Hallowfire Heart, Peacekeepers; Graviton Forfeit, Young Ahamkara's Spine, Lucky Raspberry, Orpheus Rig; Skull of Dire Ahamkara, Sunbracers, Stormdancer's Brace, Lunafaction Boots. Each perk exercised on the live player in the preview |
| V44 | Exotic duplicate protection until all are found (weapons and armor) | U7 | Complete and published (v1.7): found exotics weigh 0.15, unfound 1, equal again once a pool is complete; unit-tested |
| V45 | Lunafaction Boots reload every Guardian in the rift | U7 | Complete and published (v1.7): the rift effect carries a flag each screen applies to its own player; verified with a replayed ally rift (one browser, not a two-tab co-op run) |
| V46 | Ability cooldowns longer: abilities strong, weapons still needed | U7 | Complete and published (v1.7): grenade and melee 1.5x, class 1.3x, kill refund 0.6 s to 0.3 s |
| V47 | Nova Bomb leaves a 6 s void field that damages, weakens and suppresses | U7 | Complete and published (v1.7) |
| V48 | Golden Gun base damage down, Nighthawk worth it, Knock 'Em Down's extra shots slightly weaker | U7 | Complete and published (v1.7): 1100 to 850 per shot (splash 350 to 270), Nighthawk 4x to 5x (one shot about the same as v1.6), Knock 'Em Down 0.85x |
| V49 | Health and shield regen a bit slower | U7 | Complete and published (v1.7): 25% slower rate, same delay |
