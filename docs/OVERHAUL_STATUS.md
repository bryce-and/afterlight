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
| R25 | Bosses avoid cover; alternate push and hold | Bosses don't use cover; no push/hold logic | U13b | Complete and published (v2.4) |
| R37 | Subclass screen like D2: aspects (class-unique), fragments and grenades (shared per element), super/melee/class/jump choices, unique icons | Subclass screen: slots for super, class, jump, melee, grenade, 2 aspects, up to 5 fragments (v1.9); option picker, detail pane, phone layout; generated icon per ability/aspect/fragment (`js/ability-icons.js`). Grenade, class, super (v1.8) and jump (v1.8) choices done; Modify screen done in v1.9 (melee is the only option for now); alternate melees not built | U3, U8, U9 (Modify screen); alternate melees unplanned | In progress |
| R38 | New locations and reworked levels | 6 destinations, 18 hand-built maps | U15/U17 | Planned |
| R39 | Objectives within missions | Only travel / clear / boss | U15 | Planned |
| R40 | Patrol spaces, working beacons, public events, heroic on mechanic, multiple factions | Missing | U17 | Planned |
| R41 | Sparrow usable on all levels | Missing | U17 | Planned |
| R42 | More verticality in missions | Player can stand on boxes. Since v2.3 enemies hop onto crates and low walls (up to 1.6 m) as firing positions and use steps; levels still have no ramps or stairs to build on | U13a (enemies, done), U15 (level content) | In progress |
| R43 | Properly lit dark interiors | Max 6 lights per map | U15 | Planned |
| R44 | Map collision fix | AABB only; specific bugs not yet reproduced | U15 | Not assessed |
| R45 | Legendary campaign after all base missions (current count 18): unlock animation, 25 light under | Missing | U19 | Planned |
| R46 | Ultimate after Legendary: better animation, 50 under, no revives (death restarts) | Missing | U19 | Planned |
| R47 | Same base campaign, harder (not a new campaign) | n/a | U19 | Planned |
| R48 | Light past 100: base 200, Legendary 300, Ultimate 350 | Base cap 200 and missions rescaled to 10 to 180 (v1.1). 300/350 pending | U1 (200), U19 (300/350) | In progress |
| R49 | Ultimate unlocks a switch to equip unlimited exotics | Missing (one exotic weapon + one armor enforced) | U19 | Planned |
| R50 | Non-campaign activities scale to your Light; fireteam brought to leader's Light; loot by own Light | Partial: Horde starts at the player's power | U18 | Planned |
| R51 | Exotic missions: timed, unique mechanics, exclusive exotic, first at player level 30 | Missing | U20 | Planned |
| R52 | New enemy types: temporary shields (some), grenades, distinct models and names | Missing | U13b (permanent elemental shields, see DECISIONS 2026-10-20; grenades), U14 (models) | Complete and published (v2.4) |
| R53 | Distinct faction behaviors | Missing (names and models only) | U13b | Complete and published (v2.4) |
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
| V23 | Harder with 3 players (retune) | U13b | Complete and published (v2.4) |
| V29 | Stasis and Strand subclasses for all classes, each with a second, original super of the opposite type | U21 | Planned |
| V30 | End every update session with a co-op connection check | Process | In place |
| V31 | Mobile only: touch controls, mobile HUD/menus, Mobile mode (calmer AI, bigger hitboxes). Desktop unchanged | U25 (optional) | Planned |

## Future Update Implementation (Bryce, 2026-10-15)

| ID | Requirement | Update | Status |
|---|---|---|---|
| F02 | Legendary unlock animation opens a reward menu: 3 exotic armor (your class) and 3 exotic weapons, keep 1 of each | U19 | Planned |
| F03 | Legendary: a random exotic after the final mission's boss | U19 | Planned |
| F04 | Ultimate unlock opens a reward menu: 5 exotic armor and 5 exotic weapons, keep 2 of each | U19 | Planned |
| F05 | Ultimate: an exotic on each mission's first clear only; Ultimate tuned so those drops feel earned | U19 | Planned |
| F06 | Light rework: enemies up to 60 above you are beatable but extremely hard; 61 or more above, attacks kill almost instantly (today the delta is clamped to -40..+10, `game.js`) | U18 | Planned |
| F07 | 61 or more under: enemies immune, "?" in place of the faction emblem, scrambled names, immune damage marker (none exists today) | U18 | Planned |
| F08 | Campaign progress per Guardian (today `cleared` is one account-wide map in the save); lands with the campaign reset | U15 | Planned |
| F09 | Skip Campaign button on character select after the first Guardian's base clear; warning text; hold Yes to skip; no mission drops, but the base-clear menu and later unlock menus are still claimable | U19 | Planned |
| F10 | An Ultimate campaign clear on any Guardian unlocks Legendary and Ultimate for all; Base/Legendary/Ultimate toggle in the Director | U19 | Planned |
| F14 | A patrol zone on every destination | U17 | Planned |
| F16 | Exotic Kiosk in the Tower: retrieve earned exotics at your current Light; armor rolls random stats, exotic weapons have fixed stats | U16 | Planned |
| F17 | Minor (red) and major (orange) variant of every enemy, Destiny 2 style: majors have more health; at low difficulty mostly captains and heavies spawn as majors, at high difficulty more of every unit | U13b (variants), U19 (difficulty scaling) | Complete and published (v2.4) |
| F18 | Mission Blitz: 5 Legendary missions without dying (any fireteam death ends the run), guaranteed exotic; rewards and difficulty scale with fireteam size; unlocks after a Legendary campaign clear (optional) | U27 (optional) | Planned |
| F23 | Skip Campaign awards a gear set at a Light ready for the Legendary campaign; Ultimate still has to be earned | U19 | Planned |
| F24 | Split Legend and Ultimate: Light and Scaling (Light rework, fireteam scaling) first | U18, U19 | Planned |
| F25 | Full progress reset for everyone when the campaign launches; old save backed up, settings kept | U15 | Planned |
