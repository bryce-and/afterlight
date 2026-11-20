# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `archive/OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

Older shipped rows are in `archive/ROADMAP_SHIPPED.md`. Keep only the three newest shipped rows here; move older ones there at each release.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| U31 | v5.6 | **Exotic Arsenal** | 15 new exotic armor pieces. The % recharge exotics (percent kept, raised) are reworked. Sights: Red Dot, Holo Ring and Micro Reflex on shotguns, sidearms and hand cannons (`js/sights.js`); fusion rifles use normal sights; linear fusion zoom 1.5 with less shake. Arbalest moves to the special slot (mods dmg 0.62); Lord of Wolves reserve 80, brick 15; Dead Messenger `mag` 0.25 (numeric `mods` multiply archetype stats, `STAT_KEYS`). 24 new legendaries and 30 new perks (`js/weapon-perks-u31.js`); `perkPoolFor` is planned for the whole table (`POOL_SEED` 'u31'). Crucible supers: `superDamage` in `js/pvp.js`; burst supers one-shot in the 75% core, edge hits use the 0.85 pool, ticks scaled; Well of Radiance (`superSoft`) exempt; bot supers unchanged. Needlestorm radius 7 to 11. Boon drops are a % rising with the wave (`dropRate`, `newDropPlan` in `js/boons.js`). Phoenix Rite grace period (root cause unconfirmed); Multishot primary only; seven elemental rounds boons; `/give <boon> [count]`. Veshra's classic model (`js/boss-veshra.js`). Golden Gun kicks like a hand cannon. Tests: 469 pass. No save change. Not played live yet: sight reticles, new armor and perk effects, Crucible supers, Veshra in the Wishing Chamber. | U28, H23, U22, U27, U23 | Released |
| U30 | v5.5 | **Boon Drops** | Roguelike Horde and Endless: clearing a wave no longer gives a boon. Kills leave 2 to 5 boon orbs a round (elites and bosses likelier). E opens an orb and offers three boons; solo the game pauses while you choose, and Esc closes the pick with the orb kept. Co-op: each player gets their own orbs from the host's kills, and the opener is in stasis (cannot be hurt or targeted, 12 s limit) while the world runs. Offers are seeded, so a reopened orb shows the same three. Eleven new boons (36 total), including Beacon (+1 orb a round, up to +3) and Multishot (`shotCount` in `js/boons.js`; extra bullets at half damage, 4 stacks, normal bullet guns only). Drop rules are pure functions in `js/boons.js` (`rollDropBudget`, `newDropPlan`, `shouldDropBoon`, `offerSeed`, `rollOrbOffer`); orbs are in `js/game.js` (`spawnBoonOrb`, `updateBoonOrbs`, `openBoonOrb`). Co-op kill message carries `bd`; `bnst` and `bnend` removed, `bnok` is now {id, ch}. No save change. Co-op two-tab check not run this release. | U24 | Released |
| H30 | v5.4.6 | **Hotfix** | Mars: the boss-gate ramp into the Sunken Plaza (The Buried City) and the palace ramp up to the courtyard gate (Dust Palace) floated 2 to 3 m above the ground. Their slabs and light rails were written with absolute heights, while `vbox()` in `js/level-mars.js` measures from the ground under the box (U16e terrain lift); they now use offsets from the ground, so the paving sits on the terrain and meets the plaza and courtyard paving. Edge of Action remote shield: the v5.3 fix (U27 B2) now has regression tests in `tools/tests.js`. No save change, no balance change. | None | Released |


## Release checklist

1. Work on `update/<n>-<slug>`. Keep the diff to the approved scope.
2. Run `sh tools/run_tests.sh` (headless `tools/tests.html`): all tests pass.
3. Co-op connection check: two `?localtest` tabs connect, launch together and see each other (a full co-op QA run only when Bryce asks).
4. Play-check: `sh tools/playcheck.sh <location> <missions>` on every touched mission (meta loadout by default, no errors, every zone clears). Use the preview browser only for touched screens and visual changes.
5. Save check: a pre-update save loads correctly (or, for a reset, is backed up), and a new save starts correctly.
6. **Title screen:** open the Update Log (the new entry is on top, with version, name, date and notes) and the Roadmap (the shipped update is removed, the remaining teasers are accurate and undated). Back and Esc return to the title. Check at 1280×720 and at phone width.
7. Update `js/releases.js`, `OVERHAUL_STATUS.md` (move rows that reach "Complete and published" to `archive/STATUS_SHIPPED.md`), this table, `DECISIONS.md` and the README. The `docs-keeper` agent (Haiku) can do this from a finished summary.
8. Run `sh tools/release.sh prep X.Y` (checks the Update Log entry, runs the tests, stamps the version), then review the full diff and commit code and docs.
9. Run `sh tools/release.sh ship X.Y`: fast-forwards `main`, pushes, tags `vX.Y`, creates the GitHub release from the Update Log entry, and waits until GitHub Pages serves the new stamp.
