# Overhaul Requirement Tracker

Source: `Afterlight Update V3`. Baseline `09e02dc` (v1.0). "Current" for unstarted rows is from code reading only.
Statuses: Not assessed · Planned · In progress · Implemented · Tested · Complete and published · Blocked.
Rows that reached "Complete and published" live in `docs/archive/STATUS_SHIPPED.md`.

## Core

| ID | Requirement | Current (code) | Update | Status |
|---|---|---|---|---|
| R07 | Leviathan dungeon: one evolving mechanic, multiple bosses, scales to 1 to 3 players (HP and mechanics) | Missing | U23 | Planned |
| R25 | Bosses avoid cover; alternate push and hold | Bosses don't use cover; no push/hold logic | U13b | Complete and published (v2.4) |
| R37 | Subclass screen like D2: aspects (class-unique), fragments and grenades (shared per element), super/melee/class/jump choices, unique icons | Subclass screen: slots for super, class, jump, melee, grenade, 2 aspects, up to 5 fragments (v1.9); option picker, detail pane, phone layout; generated icon per ability/aspect/fragment (`js/ability-icons.js`). Grenade, class, super (v1.8) and jump (v1.8) choices done; Modify screen done in v1.9 (melee is the only option for now); alternate melees not built | U3, U8, U9 (Modify screen); alternate melees unplanned | In progress |
| R41 | Sparrow usable on all levels | Sparrow works in patrol zones (v3.3). Off in campaign missions by design ("Unable to summon.", DECISIONS 2026-10-24) | U17 | Complete and published (v3.3) for patrol zones |
| R44 | Map collision fix | Oriented colliders since v2.3; partly assessed in v2.6, no new collision bugs reproduced | U15 | Not assessed |
| R52 | New enemy types: temporary shields (some), grenades, distinct models and names | Missing | U13b (permanent elemental shields, see DECISIONS 2026-10-20; grenades), U14 (models) | Complete and published (v2.4) |
| R53 | Distinct faction behaviors | Missing (names and models only) | U13b | Complete and published (v2.4) |
| R54 | Darkness supers and abilities | Missing | U22 | Planned |

## Optional (nice to have)

| ID | Requirement | Current | Update | Status |
|---|---|---|---|---|
| O1 | Roguelike Horde: boons every 5 rounds, game paused, 10 s choice, stacking buffs or weapon swaps (with confirmation), mostly legendaries and some exotics, multiple exotic weapons OK, no exotic armor, AR/shotgun/GL start, run inventory resets but caches pay into real inventory | A 30-wave Horde exists (not roguelike) | U24 | Planned |
| O2 | PvP: 3 to 5 maps | Missing | U25 | Planned |
| O3 | Control and Duel | Missing | U25 | Planned |
| O4 | AI Guardians (not too strong) | Missing | U25 | Planned |

## Master-prompt requirements

| ID | Requirement | Update | Status |
|---|---|---|---|

## V4 additions (2026-10-14)

| ID | Requirement | Update | Status |
|---|---|---|---|
| V23 | Harder with 3 players (retune) | U13b | Complete and published (v2.4) |
| V29 | Stasis and Strand subclasses for all classes, each with a second, original super of the opposite type | U22 | Planned |
| V30 | End every update session with a co-op connection check | Process | In place |
| V31 | Mobile only: touch controls, mobile HUD/menus, Mobile mode (calmer AI, bigger hitboxes). Desktop unchanged | U26 (optional) | Planned |

## Future Update Implementation (Bryce, 2026-10-15)

| ID | Requirement | Update | Status |
|---|---|---|---|
| F17 | Minor (red) and major (orange) variant of every enemy, Destiny 2 style: majors have more health; at low difficulty mostly captains and heavies spawn as majors, at high difficulty more of every unit | U13b (variants), U20 (difficulty scaling) | Complete and published (v2.4) |
| F18 | Mission Blitz: 5 Legendary missions without dying (any fireteam death ends the run), guaranteed exotic; rewards and difficulty scale with fireteam size; unlocks after a Legendary campaign clear (optional) | U28 (optional) | Planned |
| F24 | Split Legend and Ultimate: Light and Scaling (Light rework, fireteam scaling) first | U19, U20a, U20b | Complete |