# Overhaul Requirement Tracker

Source: `Afterlight Update V3`. Baseline `09e02dc` (v1.0). "Current" for unstarted rows is from code reading only.
Statuses: Not assessed · Planned · In progress · Implemented · Tested · Complete and published · Blocked.
Rows that reached "Complete and published" live in `docs/archive/STATUS_SHIPPED.md`.

## Core

| ID | Requirement | Current (code) | Update | Status |
|---|---|---|---|---|
| R01 | Social space: the Tower, hangout | Missing | U16 | Planned |
| R02 | Postmaster | Missing (overflow auto-dismantles) | U16 | Planned |
| R03 | Shooting range at-light | Missing | U16 | Planned |
| R04 | Director screen with planets, locked until campaign progress | Partial: list + 3D planet, linear mission unlock | U15 | Planned |
| R05 | Campaign story, Ghost narrates, no player voice | Missing (one-line mission descriptions) | U15 | Planned |
| R06 | Calus antagonist | Missing | U15 | Planned |
| R07 | Leviathan dungeon: one evolving mechanic, multiple bosses, scales to 1 to 3 players (HP and mechanics) | Missing | U22 | Planned |
| R18 | Super framework: animations, first vs third person check, aim check, subclass effects | Each super declares `camera` in `data.js`; all 9 checked in browser: camera matches and the enemy under the crosshair takes the damage. Super animations not done | U3 (camera, aim), U9 (animations, hover) | In progress |
| R22 | Enemies up to standard: names, unique model per type, attacks | Faction models; 5 shared types | U13 | Planned |
| R24 | VFX: tracking rounds are particles that track, not lightning; supers with cool factor | Swarm, Axion Bolt, Parasitic Nanites and Wolfpack Rounds are homing particle swarms (`swarm` projectile) that deal damage on arrival. Super VFX not done | U4 (seekers), U9 (Void VFX) | In progress |
| R25 | Bosses avoid cover; alternate push and hold | Bosses don't use cover; no push/hold logic | U13 | Planned |
| R37 | Subclass screen like D2: aspects (class-unique), fragments and grenades (shared per element), super/melee/class/jump choices, unique icons | Subclass screen: slots for super, class, jump, melee, grenade, 2 aspects, up to 4 fragments; option picker, detail pane, phone layout; generated icon per ability/aspect/fragment (`js/ability-icons.js`). Grenade, class, super (v1.8) and jump (v1.8) choices done; alternate melees not built | U3, U8, U9 (Modify screen) | In progress |
| R38 | New locations and reworked levels | 6 destinations, 18 hand-built maps | U15/U17 | Planned |
| R39 | Objectives within missions | Only travel / clear / boss | U15 | Planned |
| R40 | Patrol spaces, working beacons, public events, heroic on mechanic, multiple factions | Missing | U17 | Planned |
| R41 | Sparrow usable on all levels | Missing | U17 | Planned |
| R42 | More verticality in missions | Player can stand on boxes; enemies locked to y=0 | U13/U15 | Planned |
| R43 | Properly lit dark interiors | Max 6 lights per map | U15 | Planned |
| R44 | Map collision fix | AABB only; specific bugs not yet reproduced | U15 | Not assessed |
| R45 | Legendary campaign after all base missions (current count 18): unlock animation, 25 light under | Missing | U19 | Planned |
| R46 | Ultimate after Legendary: better animation, 50 under, no revives (death restarts) | Missing | U19 | Planned |
| R47 | Same base campaign, harder (not a new campaign) | n/a | U19 | Planned |
| R48 | Light past 100: base 200, Legendary 300, Ultimate 350 | Base cap 200 and missions rescaled to 10 to 180 (v1.1). 300/350 pending | U1 (200), U19 (300/350) | In progress |
| R49 | Ultimate unlocks a switch to equip unlimited exotics | Missing (one exotic weapon + one armor enforced) | U19 | Planned |
| R50 | Non-campaign activities scale to your Light; fireteam brought to leader's Light; loot by own Light | Partial: Horde starts at the player's power | U18 | Planned |
| R51 | Exotic missions: timed, unique mechanics, exclusive exotic, first at player level 30 | Missing | U20 | Planned |
| R52 | New enemy types: temporary shields (some), grenades, distinct models and names | Missing | U13 | Planned |
| R53 | Distinct faction behaviors | Missing (names and models only) | U13 | Planned |
| R54 | Darkness supers and abilities | Missing | U21 | Planned |

## Optional (nice to have)

| ID | Requirement | Current | Update | Status |
|---|---|---|---|---|
| O1 | Roguelike Horde: boons every 5 rounds, game paused, 10 s choice, stacking buffs or weapon swaps (with confirmation), mostly legendaries and some exotics, multiple exotic weapons OK, no exotic armor, AR/shotgun/GL start, run inventory resets but caches pay into real inventory | A 30-wave Horde exists (not roguelike) | U23 | Planned |
| O2 | PvP: 3 to 5 maps | Missing | U24 | Planned |
| O3 | Control and Duel | Missing | U24 | Planned |
| O4 | AI Guardians (not too strong) | Missing | U24 | Planned |

## Master-prompt requirements

| ID | Requirement | Update | Status |
|---|---|---|---|

## V4 additions (2026-10-14)

| ID | Requirement | Update | Status |
|---|---|---|---|
| V21 | Every non-melee unit can melee at very close range, with an animation | U13 | Planned |
| V22 | Suicide units: Cursed Thrall (Hive), Explosive Shanks (Fallen) | U13 | Planned |
| V23 | Harder with 3 players (retune) | U13 | Planned |
| V24 | Taken and Scorn as full factions | U14 | Planned |
| V25 | Music and SFX overhaul: ambient/tense/orchestral music, weightier guns and abilities, light enemy SFX | U12 | Planned |
| V29 | Stasis and Strand subclasses for all classes, each with a second, original super of the opposite type | U21 | Planned |
| V30 | End every update session with a co-op connection check | Process | In place |
| V31 | Mobile only: touch controls, mobile HUD/menus, Mobile mode (calmer AI, bigger hitboxes). Desktop unchanged | U25 (optional) | Planned |
| V54 | Roaming supers 70% damage reduction (burst supers 85% during the U9 hover) | H3 (roaming), U9 (burst) | Roaming: complete and published (v1.8.2), measured 100 damage lands as 30. Burst: planned |
| V67 | All supers third person with animations, hover hold on burst supers, Well/Ward ground slam, co-op VFX test | U9 | Planned |
| V68 | Sentinel Shield barrier that blocks shots and blinds | U9 | Planned |
| V69 | Twilight Arsenal axe model and third-person hold | U9 | Planned |
| V70 | Hellion follows the player, lobs burning bolts, procs on any class ability; Phoenix Dive a Dawnblade class ability; Icarus Dash aspect | U9 (Phoenix Dive and Icarus Dash shipped early in H4) | Partly published (v1.8.3): Phoenix Dive is a Dawnblade-only class ability (13 s base, 17 s after scaling; air dive or ground burst), Icarus Dash replaces the Phoenix Dive aspect (Shift in the air, 2 charges, 6 s each). Hellion part still Planned for U9 |
| V71 | Void VFX rework | U9 | Planned |
| V72 | Slower leveling; rarity gates for use and drops | U10 | Planned |
| V73 | Orbs: armor charge only with charge mods, own counter; missing Font mods | U9 | Planned |
| V74 | UI pass: Modify screen, more fragment slots, weapon silhouettes, wider character layout | U9 | Planned |
| V75 | Enemy cover AI: heavies never, smaller units only when not outnumbered and no heavy is near, peek and return | U9 | Planned |

## Future Update Implementation (Bryce, 2026-10-15)

| ID | Requirement | Update | Status |
|---|---|---|---|
| F01 | Destination exotics replaced by level-appropriate drops (today each destination's third mission guarantees an exotic on first clear, `openChest` in `game.js`); the base-clear menu is the campaign's exotic reward | U10 | Planned |
| F02 | Legendary unlock animation opens a reward menu: 3 exotic armor (your class) and 3 exotic weapons, keep 1 of each | U19 | Planned |
| F03 | Legendary: a random exotic after the final mission's boss | U19 | Planned |
| F04 | Ultimate unlock opens a reward menu: 5 exotic armor and 5 exotic weapons, keep 2 of each | U19 | Planned |
| F05 | Ultimate: an exotic on each mission's first clear only; Ultimate tuned so those drops feel earned | U19 | Planned |
| F06 | Light rework: enemies up to 60 above you are beatable but extremely hard; 61 or more above, attacks kill almost instantly (today the delta is clamped to -40..+10, `game.js`) | U18 | Planned |
| F07 | 61 or more under: enemies immune, "?" in place of the faction emblem, scrambled names, immune damage marker (none exists today) | U18 | Planned |
| F08 | Campaign progress per Guardian (today `cleared` is one account-wide map in the save); lands with the campaign reset | U15 | Planned |
| F09 | Skip Campaign button on character select after the first Guardian's base clear; warning text; hold Yes to skip; no mission drops, but the base-clear menu and later unlock menus are still claimable | U19 | Planned |
| F10 | An Ultimate campaign clear on any Guardian unlocks Legendary and Ultimate for all; Base/Legendary/Ultimate toggle in the Director | U19 | Planned |
| F11 | Swords, Sidearms, special Grenade Launchers, Glaives (shield; glaive melee replaces B while equipped, with its own behavior), Trace Rifles, each with distinct behavior | U11 | Planned |
| F12 | Role balance pass before adding them; ammo type by archetype (Rocket-Assisted Sidearms and Rocket-Assisted Pulse Rifles special) | U11 | Planned |
| F13 | More exotic weapons with unique perks and models (24 today) | U11 | Planned |
| F14 | A patrol zone on every destination | U17 | Planned |
| F15 | Collection screen for every exotic weapon found | U10 | Planned |
| F16 | Exotic Kiosk in the Tower: retrieve earned exotics at your current Light; armor rolls random stats, exotic weapons have fixed stats | U16 | Planned |
| F17 | Minor (red) and major (orange) variant of every enemy, Destiny 2 style: majors have more health; at low difficulty mostly captains and heavies spawn as majors, at high difficulty more of every unit | U13 (variants), U19 (difficulty scaling) | Planned |
| F18 | Mission Blitz: 5 Legendary missions without dying (any fireteam death ends the run), guaranteed exotic; rewards and difficulty scale with fireteam size; unlocks after a Legendary campaign clear (optional) | U27 (optional) | Planned |
| F19 | Legendary perk columns: Magazine or Reload, Damage, Effect (enemy effects, explosions and kill payoffs); a 9-perk pool per named weapon, 3 per column; uncommon rolls column 1, rare adds one Damage or Effect perk, legendary all three; new Destiny 2 perks (today one pool per ammo slot, `PERK_POOL`) | U10 | Planned |
| F20 | Reward-track engram rarity matches what is usable at that level (today a legendary every 3 levels, below U9's level 10 legendary gate) | U10 | Planned |
| F21 | Named weapons at every rarity, not only legendary (today commons to rares get generated names) | U10 | Planned |
| F22 | D2-style weapon inspect screen on right-click: the model behind, the perks that dropped | U10 | Planned |
| F23 | Skip Campaign awards a gear set at a Light ready for the Legendary campaign; Ultimate still has to be earned | U19 | Planned |
| F24 | Split Legend and Ultimate: Light and Scaling (Light rework, fireteam scaling) first | U18, U19 | Planned |
| F25 | Full progress reset for everyone when the campaign launches; old save backed up, settings kept | U15 | Planned |
| F26 | Split Loot 2.0 out of Arsenal II; U9's leveling, rarity gate and reward-track work moves into it | U10 | Planned |
| F27 | Steady Hands and Snapshot Sights leave the random rolls (no column fits them); Vampire Touch, Demolitionist and Killing Wind join the Effect column | U10 | Planned |
