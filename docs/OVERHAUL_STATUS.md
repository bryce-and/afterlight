# Overhaul Requirement Tracker

Source: `Afterlight Update V3`. Baseline `09e02dc` (v1.0). "Current" for unstarted rows is from code reading only.
Statuses: Not assessed · Planned · In progress · Implemented · Tested · Complete and published · Blocked.

## Core

| ID | Requirement | Current (code) | Update | Status |
|---|---|---|---|---|
| R01 | Social space: the Tower, hangout | Missing | U8 | Planned |
| R02 | Postmaster | Missing (overflow auto-dismantles) | U8 | Planned |
| R03 | Shooting range at-light | Missing | U8 | Planned |
| R04 | Director screen with planets, locked until campaign progress | Partial: list + 3D planet, linear mission unlock | U7 | Planned |
| R05 | Campaign story, Ghost narrates, no player voice | Missing (one-line mission descriptions) | U7 | Planned |
| R06 | Calus antagonist | Missing | U7 | Planned |
| R07 | Leviathan dungeon: one evolving mechanic, multiple bosses, scales to 1 to 3 players (HP and mechanics) | Missing | U13 | Planned |
| R08 | Player level 1 to 40 | XP curve in `progression.js`; kills shared by fireteam, mission and cache XP; HUD XP bar; Level tab | U1 | Complete and published (v1.1) |
| R09 | Third subclass drops at level 10 | `unlockLevel: 10` on Sentinel, Arcstrider, Stormcaller; unlock message mid-mission | U1 | Complete and published (v1.1) |
| R10 | Starters: Titan Sunbreaker+Fists of Havoc, Warlock Nova+Dawnblade, Hunter Golden Gun+Shadowshot | Gated in class select and the subclass panel; unit-tested | U1 | Complete and published (v1.1) |
| R11 | Drop quality scales with level; legendary rare at 15, near-exclusive at 40 | `RARITY_CURVE` by level (legendary ~5% at 15, ~90% at 40); unit-tested over 10k rolls | U1 | Complete and published (v1.1) |
| R12 | Leveling screen: reward track, legendary every 3 levels, exotic at 20 and 40 | Level tab: 40-node track, claim once, refuses when inventory is full | U1 | Complete and published (v1.1) |
| R13 | Modeled armor; unique exotic looks; destination sets that drop in all levels | Missing (armor not shown on model) | U5 | Planned |
| R14 | Armor perk counts: Legendary 2, Rare/Uncommon 1, Common 0 | Legendary 1, others 0 | U5 | Planned |
| R15 | New destination adds new perks | Missing (one global pool) | U5 | Planned |
| R16 | Shaders recolor armor | Missing | U5 | Planned |
| R17 | Subclasses with working aspects, fragments, melee, supers, grenades | Supers, grenades, melees exist; no aspects or fragments | U3 | Planned |
| R18 | Super framework: animations, first vs third person check, aim check, subclass effects | Partial: third person for roaming supers | U3 | Planned |
| R19 | Exotic weapons/armor: unique perk and model | Weapons: perks + models exist. Armor: perks only, no visuals | U4/U5 | Planned |
| R20 | Legendary armor: perks, matching sets, destination tie, 3-piece set bonus, character-screen icons | Missing (generic slot SVGs) | U5 | Planned |
| R21 | Weapon archetypes, models, diagonal D2-style icons, Arc/Solar/Void/Stasis/Strand symbols | 12 archetypes; side-profile rectangular icons; no symbols; no Stasis/Strand | U4 | Planned |
| R22 | Enemies up to standard: names, unique model per type, attacks | Faction models; 5 shared types | U6 | Planned |
| R23 | Stagger when shot | Non-boss enemies flinch 0.15 to 0.35 s on hits above a share of max HP (lower for crits, higher for captains and heavies), with a cooldown; `combat.js` `staggerFor` | U2 | Complete and published (v1.2) |
| R24 | VFX: tracking rounds are particles that track, not lightning; supers with cool factor | Seekers are homing meshes; many effects are lightning | U4 | Planned |
| R25 | Bosses avoid cover; alternate push and hold | Bosses don't use cover; no push/hold logic | U6 | Planned |
| R26 | Tight ADS spread | Primary ADS cones 40 to 50% tighter, specials tighter; aimed movement no longer widens the cone; hip fire unchanged | U2 | Complete and published (v1.2) |
| R27 | Damage numbers drift from the hit to the side | Numbers pop at the hit, drift out to alternating sides and ease down (`combat.js` `dmgDrift`) | U2 | Complete and published (v1.2) |
| R28 | Buff HUD: general effects above abilities, weapon effects below, with timers; exotic effects visible | Status registry (`js/status.js`) drives the HUD: name, timer bar, seconds, stacks; exotic effects gold-bordered. Enemy debuffs move to the registry in U3 | U2 | Complete and published (v1.2) |
| R29 | Visible super-charged animation; yellow bar when charged | Charging keeps the element color; when full the bar turns gold, pops, glows and sweeps | U2 | Complete and published (v1.2) |
| R30 | Enemy health bars and names when aimed at, opacity fade | Plate above the aimed enemy's head (tracks it) with faction emblem, name, HP and shield; fades over ~1 s after looking away; bosses keep the boss bar | U2 | Complete and published (v1.2) |
| R31 | Primary weapon / enemy HP rebalance; slight ability tune-back | Weapons scale with mission tier at 75% of enemy HP growth, primaries +10%, ability power 1.4 to 1.3. Auto Rifle on a Vandal at matched Light: 7/12/18 body shots in missions 1/9/18 before, 6/7/7 after | U2 | Complete and published (v1.2) |
| R32 | Super gain and damage nerf; less super energy from kills | Passive 0.75 to 0.5%/s, kills 3 to 10% down to 2 to 6%, Hands-On 4 to 3, super damage -9% (`SUPER_POWER` 2.2 to 2.0) | U2 | Complete and published (v1.2) |
| R33 | Song of Flame uptime too high | No energy leak found (gain is blocked during supers). Duration 12 to 10 s, ability regen 8x to 4x. Modeled uptime with a kill every 2 s: 21% to 13% | U2 | Complete and published (v1.2) |
| R34 | Stormtrance initially hits up to 4 from the caster | Primary + 3 chains; verified in browser (4 of 5 clustered enemies per tick) | U2 | Complete and published (v1.2) |
| R35 | Celestial Nighthawk double-buffs Golden Gun? | Cause: the splash re-hit the shot's target. Splash now skips it; verified the 6x applies once and the target takes no splash | U2 | Complete and published (v1.2) |
| R36 | Storm Grenade hits multiple enemies; slight damage nerf OK | Every enemy under the cloud each 0.3 s tick, 40 to 30 per strike; verified 5 of 5 hit | U2 | Complete and published (v1.2) |
| R37 | Subclass screen like D2: aspects (class-unique), fragments and grenades (shared per element), super/melee/class/jump choices, unique icons | Panel lists fixed abilities only | U3 | Planned |
| R38 | New locations and reworked levels | 6 destinations, 18 hand-built maps | U7/U9 | Planned |
| R39 | Objectives within missions | Only travel / clear / boss | U7 | Planned |
| R40 | Patrol spaces, working beacons, public events, heroic on mechanic, multiple factions | Missing | U9 | Planned |
| R41 | Sparrow usable on all levels | Missing | U9 | Planned |
| R42 | More verticality in missions | Player can stand on boxes; enemies locked to y=0 | U6/U7 | Planned |
| R43 | Properly lit dark interiors | Max 6 lights per map | U7 | Planned |
| R44 | Map collision fix | AABB only; specific bugs not yet reproduced | U7 | Not assessed |
| R45 | Legendary campaign after all base missions (current count 18): unlock animation, 25 light under | Missing | U10 | Planned |
| R46 | Ultimate after Legendary: better animation, 50 under, no revives (death restarts) | Missing | U10 | Planned |
| R47 | Same base campaign, harder (not a new campaign) | n/a | U10 | Planned |
| R48 | Light past 100: base 200, Legendary 300, Ultimate 350 | Base cap 200 and missions rescaled to 10 to 180 (v1.1). 300/350 pending | U1 (200), U10 (300/350) | In progress |
| R49 | Ultimate unlocks a switch to equip unlimited exotics | Missing (one exotic weapon + one armor enforced) | U10 | Planned |
| R50 | Non-campaign activities scale to your Light; fireteam brought to leader's Light; loot by own Light | Partial: Horde starts at the player's power | U10 | Planned |
| R51 | Exotic missions: timed, unique mechanics, exclusive exotic, first at player level 30 | Missing | U11 | Planned |
| R52 | New enemy types: temporary shields (some), grenades, distinct models and names | Missing | U6 | Planned |
| R53 | Distinct faction behaviors | Missing (names and models only) | U6 | Planned |
| R54 | Darkness supers and abilities | Missing | U12 | Planned |
| R55 | Aspects and fragments | Missing | U3 | Planned |
| R56 | Armor mods | Missing | U5 | Planned |

## Optional (nice to have)

| ID | Requirement | Current | Update | Status |
|---|---|---|---|---|
| O1 | Roguelike Horde: boons every 5 rounds, game paused, 10 s choice, stacking buffs or weapon swaps (with confirmation), mostly legendaries and some exotics, multiple exotic weapons OK, no exotic armor, AR/shotgun/GL start, run inventory resets but caches pay into real inventory | A 30-wave Horde exists (not roguelike) | U14 | Planned |
| O2 | PvP: 3 to 5 maps | Missing | U15 | Planned |
| O3 | Control and Duel | Missing | U15 | Planned |
| O4 | AI Guardians (not too strong) | Missing | U15 | Planned |

## Master-prompt requirements

| ID | Requirement | Update | Status |
|---|---|---|---|
| M1 | Title screen Update Log (released only) | U1 | Complete and published (v1.1) |
| M2 | Title screen Roadmap (curated teasers) | U1 | Complete and published (v1.1) |
| M3 | Requirement tracking, docs, decision log | U1 | Complete and published (v1.1) |
| M4 | Test and validation tooling | U1 | Complete and published (v1.1): `tools/tests.html`; 35 tests as of v1.2 |
| M5 | Versioned GitHub releases | U1 | Complete and published (v1.1) |
