# Overhaul Requirement Tracker

Source: `Afterlight Update V3`. Baseline `09e02dc` (v1.0). "Current" for unstarted rows is from code reading only.
Statuses: Not assessed · Planned · In progress · Implemented · Tested · Complete and published · Blocked.

## Core

| ID | Requirement | Current (code) | Update | Status |
|---|---|---|---|---|
| R01 | Social space: the Tower, hangout | Missing | U12 | Planned |
| R02 | Postmaster | Missing (overflow auto-dismantles) | U12 | Planned |
| R03 | Shooting range at-light | Missing | U12 | Planned |
| R04 | Director screen with planets, locked until campaign progress | Partial: list + 3D planet, linear mission unlock | U11 | Planned |
| R05 | Campaign story, Ghost narrates, no player voice | Missing (one-line mission descriptions) | U11 | Planned |
| R06 | Calus antagonist | Missing | U11 | Planned |
| R07 | Leviathan dungeon: one evolving mechanic, multiple bosses, scales to 1 to 3 players (HP and mechanics) | Missing | U17 | Planned |
| R08 | Player level 1 to 40 | XP curve in `progression.js`; kills shared by fireteam, mission and cache XP; HUD XP bar; Level tab | U1 | Complete and published (v1.1) |
| R09 | Third subclass drops at level 10 | `unlockLevel: 10` on Sentinel, Arcstrider, Stormcaller; unlock message mid-mission | U1 | Complete and published (v1.1) |
| R10 | Starters: Titan Sunbreaker+Fists of Havoc, Warlock Nova+Dawnblade, Hunter Golden Gun+Shadowshot | Gated in class select and the subclass panel; unit-tested | U1 | Complete and published (v1.1) |
| R11 | Drop quality scales with level; legendary rare at 15, near-exclusive at 40 | `RARITY_CURVE` by level (legendary ~5% at 15, ~90% at 40); unit-tested over 10k rolls | U1 | Complete and published (v1.1) |
| R12 | Leveling screen: reward track, legendary every 3 levels, exotic at 20 and 40 | Level tab: 40-node track, claim once, refuses when inventory is full | U1 | Complete and published (v1.1) |
| R13 | Modeled armor; unique exotic looks; destination sets that drop in all levels | Missing (armor not shown on model) | U6 | Planned |
| R14 | Armor perk counts by rarity (superseded by V4: perks become mods) | Legendary 1, others 0 | U5 | Planned |
| R15 | New destination adds new perks | Missing (one global pool) | U6 | Planned |
| R16 | Shaders recolor armor | Missing | U6 | Planned |
| R17 | Subclasses with working aspects, fragments, melee, supers, grenades | Registry `js/subclass.js`: 9 grenades shared by element, 2 class abilities per class, 27 aspects, 14 fragments; behaviors in `player.js` / `abilities.js`. All 18 test loadouts (every aspect and fragment) fired in a mission with no errors | U3 | Complete and published (v1.3) |
| R18 | Super framework: animations, first vs third person check, aim check, subclass effects | Each super declares `camera` in `data.js`; all 9 checked in browser: camera matches and the enemy under the crosshair takes the damage. Super animations not done | U3 (camera, aim) | In progress |
| R19 | Exotic weapons/armor: unique perk and model | Weapons: perks + models exist. Armor: perks only, no visuals | U4/U6 | Planned |
| R20 | Legendary armor: perks, matching sets, destination tie, 3-piece set bonus, character-screen icons | Missing (generic slot SVGs) | U6 | Planned |
| R21 | Weapon archetypes, models, diagonal D2-style icons, Arc/Solar/Void/Stasis/Strand symbols | `js/frames.js`: Destiny archetypes (frames) for all 12 families, stats fixed by archetype; 74 named legendaries with fixed archetype and element (Destinypedia-sourced); diagonal square icons; a symbol per element; Stasis and Strand weapon elements (no verbs yet). Legendary model variety not done | U4 | Complete and published (v1.4) |
| R22 | Enemies up to standard: names, unique model per type, attacks | Faction models; 5 shared types | U9 | Planned |
| R23 | Stagger when shot | Non-boss enemies flinch 0.15 to 0.35 s on hits above a share of max HP (lower for crits, higher for captains and heavies), with a cooldown; `combat.js` `staggerFor` | U2 | Complete and published (v1.2) |
| R24 | VFX: tracking rounds are particles that track, not lightning; supers with cool factor | Swarm, Axion Bolt, Parasitic Nanites and Wolfpack Rounds are homing particle swarms (`swarm` projectile) that deal damage on arrival. Super VFX not done | U4 (seekers) | In progress |
| R25 | Bosses avoid cover; alternate push and hold | Bosses don't use cover; no push/hold logic | U9 | Planned |
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
| R37 | Subclass screen like D2: aspects (class-unique), fragments and grenades (shared per element), super/melee/class/jump choices, unique icons | Subclass screen: slots for super, class, jump, melee, grenade, 2 aspects, up to 4 fragments; option picker, detail pane, phone layout; generated icon per ability/aspect/fragment (`js/ability-icons.js`). Grenade and class choices done; alternate supers, melees and jumps not built | U3 (part) | In progress |
| R38 | New locations and reworked levels | 6 destinations, 18 hand-built maps | U11/U13 | Planned |
| R39 | Objectives within missions | Only travel / clear / boss | U11 | Planned |
| R40 | Patrol spaces, working beacons, public events, heroic on mechanic, multiple factions | Missing | U13 | Planned |
| R41 | Sparrow usable on all levels | Missing | U13 | Planned |
| R42 | More verticality in missions | Player can stand on boxes; enemies locked to y=0 | U9/U11 | Planned |
| R43 | Properly lit dark interiors | Max 6 lights per map | U11 | Planned |
| R44 | Map collision fix | AABB only; specific bugs not yet reproduced | U11 | Not assessed |
| R45 | Legendary campaign after all base missions (current count 18): unlock animation, 25 light under | Missing | U14 | Planned |
| R46 | Ultimate after Legendary: better animation, 50 under, no revives (death restarts) | Missing | U14 | Planned |
| R47 | Same base campaign, harder (not a new campaign) | n/a | U14 | Planned |
| R48 | Light past 100: base 200, Legendary 300, Ultimate 350 | Base cap 200 and missions rescaled to 10 to 180 (v1.1). 300/350 pending | U1 (200), U14 (300/350) | In progress |
| R49 | Ultimate unlocks a switch to equip unlimited exotics | Missing (one exotic weapon + one armor enforced) | U14 | Planned |
| R50 | Non-campaign activities scale to your Light; fireteam brought to leader's Light; loot by own Light | Partial: Horde starts at the player's power | U14 | Planned |
| R51 | Exotic missions: timed, unique mechanics, exclusive exotic, first at player level 30 | Missing | U15 | Planned |
| R52 | New enemy types: temporary shields (some), grenades, distinct models and names | Missing | U9 | Planned |
| R53 | Distinct faction behaviors | Missing (names and models only) | U9 | Planned |
| R54 | Darkness supers and abilities | Missing | U16 | Planned |
| R55 | Aspects and fragments | 3 aspects per subclass (2 slots, each opens 1 or 2 fragment slots); 4 Solar, 5 Arc, 5 Void fragments. Level 10 subclasses earn their third aspect at 13/16/19; Spark of Ions (22) and Echo of Instability (25) on the reward track | U3 | Complete and published (v1.3) |
| R56 | Armor mods | Missing | U5 | Planned |
| R57 | Armor stats affect ability cooldowns, Destiny-style (added by Bryce, not in V3) | Stats only affect speed/jump, shield, and regen; nothing touches cooldowns | U5 | Planned |
| R58 | Hunter Triple Jump is the ground jump + 2 (added by Bryce) | Two air jumps, the second at 85% height. Peak 4.2 m, below Titan Catapult Lift (4.8 m) | U3 | Complete and published (v1.3) |
| R59 | Enemy debuffs on the status registry (weaken, slow, suppress, burn, poison) | `Enemy.status` with `ENEMY_STATUS`; all applied through `dealDamage` and sent to the enemy's owner; plate shows them. Jolt added for Arc | U3 | Complete and published (v1.3) |

## Optional (nice to have)

| ID | Requirement | Current | Update | Status |
|---|---|---|---|---|
| O1 | Roguelike Horde: boons every 5 rounds, game paused, 10 s choice, stacking buffs or weapon swaps (with confirmation), mostly legendaries and some exotics, multiple exotic weapons OK, no exotic armor, AR/shotgun/GL start, run inventory resets but caches pay into real inventory | A 30-wave Horde exists (not roguelike) | U18 | Planned |
| O2 | PvP: 3 to 5 maps | Missing | U19 | Planned |
| O3 | Control and Duel | Missing | U19 | Planned |
| O4 | AI Guardians (not too strong) | Missing | U19 | Planned |

## Master-prompt requirements

| ID | Requirement | Update | Status |
|---|---|---|---|
| M1 | Title screen Update Log (released only) | U1 | Complete and published (v1.1) |
| M2 | Title screen Roadmap (curated teasers) | U1 | Complete and published (v1.1) |
| M3 | Requirement tracking, docs, decision log | U1 | Complete and published (v1.1) |
| M4 | Test and validation tooling | U1 | Complete and published (v1.1): `tools/tests.html`; 65 tests as of v1.4 |
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
| V18 | Armor mods replace perks: 4 sockets, 10 energy, slot 1 stat mods, a mod pool per armor slot, D2-style (no raid mods) | U5 | Planned |
| V19 | Mods screen with slide-in from the character screen's right-edge arrow | U5 | Planned |
| V20 | Six armor stats (D2 new names) incl. cooldown stats | U5 | Planned |
| V21 | Every non-melee unit can melee at very close range, with an animation | U9 | Planned |
| V22 | Suicide units: Cursed Thrall (Hive), Explosive Shanks (Fallen) | U9 | Planned |
| V23 | Harder with 3 players (retune) | U9 | Planned |
| V24 | Taken and Scorn as full factions | U10 | Planned |
| V25 | Music and SFX overhaul: ambient/tense/orchestral music, weightier guns and abilities, light enemy SFX | U8 | Planned |
| V26 | 4 aspects per subclass, 8 fragments per element | U7 | Planned |
| V27 | Missing Destiny 2 Light supers | U7 | Planned |
| V28 | More class jumps, including Blink | U7 | Planned |
| V29 | Stasis and Strand subclasses for all classes, each with a second, original super of the opposite type | U16 | Planned |
| V30 | End every update session with a co-op connection check | Process | In place |
| V31 | Mobile only: touch controls, mobile HUD/menus, Mobile mode (calmer AI, bigger hitboxes). Desktop unchanged | U20 (optional) | Planned |
| V32 | Subclass traits for the 6 subclasses without one | U4 | Complete and published (v1.4): Sunbreaker burn, Striker Amplified, Gunslinger melee energy, Nightstalker weaken, Voidwalker detonation, Stormcaller jolt (`TRAITS` in `subclass.js`) |
| V34 | Weapon archetypes per family (D2 frames); stats fixed by archetype; named legendaries always the same archetype and element; archetype shown on the item (added by Bryce for U4) | U4 | Complete and published (v1.4) |
| V35 | Ready Up bar in the Director for fireteams; the last Guardian to ready launches the leader's pick; solo launches directly (added by Bryce for U4) | U4 | Complete and published (v1.4) |
