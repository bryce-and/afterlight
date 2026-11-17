# U24 (optional) "Roguelike Horde": Gate B proposal

Status: approved by Bryce 2026-11-17. No code written yet. Tracker: O1 in `docs/OVERHAUL_STATUS.md`. Depends on U2 and U4 (both shipped). Proposed branch: `update/24-roguelike-horde`. Version: v5.1 (next after v5.0.2).

Note on numbering: U24 is the lowest-numbered unbuilt update, so it is proposed here. U26 "Mobile" is also planned and could go next instead if Bryce prefers.

## Objective
Turn the existing 30-wave Horde (`js/data.js` activity `horde`, run by `startActivity` in `js/game.js`) into a roguelike run: a boon choice every 5 waves, stacking buffs or weapon swaps, and a run inventory that resets on death or on finishing, while the caches still pay into real inventory.

## Scope
1. **Boon every 5 waves, per member.** At each 5-wave mark the game pauses. Each fireteam member is offered 3 random boons and picks one within 10 seconds; the first option is taken on timeout. Offers are rolled separately for each member, so teammates get different boons. Boons come from data (`BOONS` table in a new `js/boons.js`), so later boons are data-only.
2. **Boons are unlimited and stack.** There is no run cap on how many boons a player collects, and the same boon can be taken again to stack. Stacking has no cap in the proposal (Bryce, 2026-11-16).
3. **Boon list (25, Bryce asked for about 25 on 2026-11-16).** Each is one data row. Taking the same boon again adds the same amount again (two Bladefury = triple melee charge speed; two Phoenix Rite = two saves per wave). Numbers are starting values, tuned in the build.

   | # | Boon | Effect |
   |---|---|---|
   | 1 | Grenadier's Haste | Grenade charges twice as fast |
   | 2 | Bladefury | Melee charges twice as fast |
   | 3 | Lightbringer | Super charges twice as fast |
   | 4 | Second Wind | Class ability charges twice as fast |
   | 5 | Heavy Harvest | Grenade kills grant heavy ammo |
   | 6 | Fleetfoot | Sprint faster and jump higher |
   | 7 | Giantslayer | +10% damage to bosses |
   | 8 | Crown Detonation | Precision kills make the enemy's corpse explode |
   | 9 | Bloodletter | Kills restore 10% health |
   | 10 | Iron Skin | Take 10% less damage |
   | 11 | Shieldwall | +25% maximum shield |
   | 12 | Quickhands | Reload 20% faster |
   | 13 | Deep Pockets | +25% magazine size |
   | 14 | Scavenger | Enemies drop special ammo more often |
   | 15 | Arc Conductor | Precision hits chain lightning to the nearest enemy |
   | 16 | Scorched Earth | Grenades leave burning ground |
   | 17 | Momentum | Each kill gives +2% damage for 5 s, stacking to 10 |
   | 18 | Last Stand | +30% damage while below 30% health |
   | 19 | Phoenix Rite | Once per wave, survive a killing blow at 1 health |
   | 20 | Ricochet Rounds | Bullets bounce to a second enemy for 30% damage |
   | 21 | Executioner | +20% damage to enemies below 30% health |
   | 22 | Frostbite Rounds | Hits slow enemies by 15% for 2 s |
   | 23 | Grave Robber | Kills refill 5% of the magazine from reserves |
   | 24 | Duelist | +15% damage to elites and minibosses |
   | 25 | Adrenaline Rush | Kills give +20% move speed for 3 s |

   Boons 1 to 8 are Bryce's examples. Checked 2026-11-17: every special effect already exists as shared code, so no boon needs a new effect system. `dealDamage` (`js/game.js:814`) takes `burn`, `slow` and `jolt` options; burning ground reuses `scorch()` (`js/player.js:1069`); slow uses the `slow` debuff (`js/game.js:906`); chain lightning uses `chainTargets` (`js/combat.js:133`); corpse explosions use `explode` (`js/game.js:979`) as Chain Reaction does. Ricochet exists only for shields and Threaded Spike, so Ricochet Rounds needs a small bullet-side hook built on `enemiesNear` (`js/game.js:806`).
4. **Enemy scaling (Bryce, 2026-11-16).** Because boons are unlimited, enemies get denser and tougher each wave. Bosses get tougher to compensate. The curve (count, health and damage per wave, and boss health) lives in data, not in code.
4b. **Weapon-swap boons (Bryce, 2026-11-16: keep).** Some boon offers are a weapon instead of a buff: mostly legendary weapons, sometimes an exotic weapon. Several exotic weapons are allowed in one run; no exotic armor. A swap replaces the weapon in its slot for the rest of the run and asks for confirmation first, as O1 requires.
4c. **Arena rules (Bryce, 2026-11-16).** How Horde maps work today: Horde has no maps of its own. It shuffles the boss rooms of the 22 campaign missions and builds the whole mission map, but opens every door on load (`loadArena` in `js/game.js`), so players can walk out of the boss room into the rest of the map. Players start 13 m from the room's center on the entrance side; enemies spawn 7 to 19 m from the center on the side away from the host (`spawnWave`), and the boss at the center. Every 10 waves the run moves to the next boss room. Changes:
   - **Move every 10 waves (Bryce, 2026-11-16; already how Horde works, kept).** After waves 10 and 20 (each a boss wave) the 12 s move timer runs, then everyone moves to the next shuffled boss room, so a 30-wave run uses 3 rooms. Dead players respawn in the new room. Boons and run weapons carry over.
   - **Locked in.** Each boss room is sealed while the run is in it: its doors close (reusing the boss-lock doors from `syncBossLocks`), and any opening without a door gets an invisible wall at the room's `room` bounds. Players and enemies cannot leave.
   - **Respawn in the room after the wave.** A player who dies stays dead (Ghost camera) until the wave is cleared, unless a teammate revives them. When the wave clears, every dead player respawns inside the boss room.
   - **Fair spawns.** Player spawn and respawn points are chosen inside the room away from enemies: at least 15 m from any suicide unit (`suicide: true` in `ENEMY_TYPES`) and at least 8 m from any other enemy. Enemy spawns, suicide units especially, never land within 15 m of a living player (today only the host's side is checked, so a fireteam member can be next to a spawn). Distances live in data.
5. **Starting kit.** Assault rifle, shotgun and grenade launcher, as O1 requires. The run starts with those and ignores the player's own loadout.
6. **Run inventory.** Boons and swapped weapons live only in the run. They reset when the run ends (death or clear). Caches still grant real items through `grantItem`, as today.
7. **Death camera (Bryce, 2026-11-16; every mode, not just Horde).** Today a death keeps the camera first person, drops it to 0.35 m and rolls it (`js/player.js` `updateCamera`), with no body and no Ghost. New flow:
   - **Body, about 3 s.** The camera pulls back to third person behind your Guardian and watches the body fall. There is no physics ragdoll system, so this is a procedural collapse: a short tumble that ends lying on the ground, reusing the fall tumble (`ragdoll` in `player.js`) and the lay-over pose fireteam members already see (`coop.js`).
   - **Ghost.** Your Ghost appears over the body (`ghost()` model in `js/characters.js`) and the camera locks onto it. Moving the mouse orbits the camera around the Ghost; the scroll wheel zooms within limits. The camera is pushed in front of walls so it never sees through the map.
   - **Everything else stays.** The death text panel, revive and respawn timers, revive tokens, the 18 s co-op downed timer and the 1.5 s hold-E teammate revive are unchanged. Crucible's 4 s respawn shows about 1.5 s of body, then the Ghost.
   - **Co-op.** Teammates see your Ghost hovering over your body (one more flag in player state) so they know where to revive you.
   - **Falls** (off the Tower or a patrol edge): the tumble plays, then the Ghost waits at the last spot where you stood on solid ground.
8. **Hooks.** A new `js/boons.js` holds the pure rules (roll, stack, apply, reset), kept testable like `js/blitz.js`. Horde's loop in `game.js` only calls into it.

## Exclusions
- No change to campaign, Blitz, Endless, dungeons, Crucible or Mobile, apart from the death camera (scope item 7).
- No physics ragdoll. The body collapse is procedural.
- No new enemy types or bosses. The existing 30 waves and arenas stay; only their density and toughness scale with the wave number (scope item 4).
- No save format change beyond what caches already write. Run state is not saved mid-run.
- No Light, damage or health changes outside Horde. PvE numbers elsewhere are untouched.

## Open decisions for Bryce (my recommendation in brackets)
- **Player-specific boons (Bryce, 2026-11-16).** Boons belong to each player: each member rolls and picks their own, and nobody else's boons affect them. Co-op sync must replicate each player's boons only to that player's state. [Recommend: build it this way; no host pick.]
- **Weapon swaps and exotic weapons.** Decided: keep (Bryce, 2026-11-16). See scope item 4b.
- **Solo death.** Decided (Bryce, 2026-11-16): solo, a death ends the run. In co-op the run ends only when the whole fireteam is dead at once; otherwise the dead respawn in the boss room when the wave clears.
- **Scaling curve numbers.** Enemy count, health and damage per wave, and boss health growth are numbers to be set in data during the build and tuned with playcheck. [Question: any starting targets you want?]

## Dependencies
- U2 and U4 shipped. Horde, caches and `grantItem` already exist.
- Choice screen (checked 2026-11-17): reuse the overlay `openRewardMenu` (`js/rewards-ui.js:63`) and the per-Guardian `s.pendingMenus` (`js/rewards.js:55`) from Blitz. It has no pick timer and only runs at run end, so the build adds the 10 s countdown and a host-authoritative sync for a mid-run pick.

## Risks
- Unlimited stacking can outrun the scaling curve and make runs trivial or impossible. Mitigation: scaling is data-driven so it can be tuned from playcheck numbers.
- Co-op sync: each member's boons must apply only to that member and replicate correctly. Mitigation: boons are per-player state, checked in the co-op test.
- Pausing in co-op: the pick happens at the wave break, so the host holds the next wave until every member has picked or timed out, rather than freezing the game. Mitigation: host owns the timer; checked in the co-op test.
- Scope size: the death camera (item 7) touches every mode and could be split into its own hotfix if the build runs long. [Recommend: keep it in, but build it last so it can be cut without blocking Horde.]
- Boon effects that stack multiplicatively (charge speed, damage) can produce extreme values. Mitigation: each effect's formula is tested at high stack counts.

## Test plan
- Unit tests (`sh tools/run_tests.sh`): per-member boon roll, stacking, run reset, timer auto-pick, scaling curve values per wave.
- Playcheck: `sh tools/playcheck.sh <location> <missions>` on a Horde run with a meta loadout (Legendary), clear times and no console errors.
- Visual check in the preview browser: boon choice screen at 1280x720 and phone width; the death camera in a mission, in a tight corridor (wall push) and in Crucible.
- Co-op check (two `?localtest` tabs): one player dies, the other sees the Ghost over the body and revives it.
- Save check: a pre-update save loads and a new save starts.

## Acceptance criteria
- A Horde run offers each member a boon choice every 5 waves, with a 10-second timer that auto-picks.
- Boons are unlimited and stack; each member's boons are their own.
- Enemy density and toughness rise per wave; boss toughness rises to match.
- Solo: a death ends the run. Co-op: the run ends when the whole fireteam is dead at once.
- Players cannot leave the boss room. Dead players respawn inside it when the wave clears. No player spawns within 15 m of a suicide unit, and no enemy spawns within 15 m of a living player.
- On death, in every mode: about 3 s of third-person body, then an orbitable Ghost camera that never clips through walls. Teammates see the Ghost over a downed player. Revive and respawn timings are unchanged.
- The run inventory resets on death or clear; caches still add real items.
- All unit tests pass; playcheck of Horde shows no errors.
- Title screen shows "Roguelike Horde", "Version 5.1" and new artwork (U24 is a major update); Update Log and Roadmap updated at release.
