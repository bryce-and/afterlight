# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `archive/OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

Older shipped rows are in `archive/ROADMAP_SHIPPED.md`. Keep only the three newest shipped rows here; move older ones there at each release.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| H39 | v5.4.5 | **Hotfix** | Roguelike Horde and Endless: a weapon swap is 25% of boon options again (`WEAPON_OFFER_CHANCE` in `js/boons.js`; v5.4.3 had raised it to 40% by mistake). The exotic share of weapon options stays at 40% (`EXOTIC_SHARE`; was 10% before v5.4.3), so exotics still show up far more often. No save change. | None | Released |
| H38 | v5.4.4 | **Hotfix** | Roguelike Horde and Endless: a weapon swap taken from the boon pick updates the weapon list in the bottom right of the HUD at once (`ui.renderWeaponRows` called from `showBoonMenu` in `js/game.js`; it kept showing the old gun). No save change. | None | Released |
| H37 | v5.4.3 | **Hotfix** | Crota's End (Moon), campaign and Horde: spawns and caches stay inside the round Throne of Crota and the round inscribed circle of the Deathsinger's Ward. A zone may carry `round: {x, z, r}` (`js/level-moon.js`, `js/world.js`); `findSpawn`, `chestSpot` and `hordeRespawnSpot` keep spawns inside it (`inRoundRoom` in `js/game.js`). Horde caches use `chestSpot` (open floor, not inside a wall or the dais). Roguelike weapon swap was 40% of offers (was 25%; back to 25% in v5.4.5), and 40% of those are exotic (was 10%) (`WEAPON_OFFER_CHANCE`, `EXOTIC_SHARE` in `js/boons.js`). Roguelike boon pick: hover or focus a weapon card to see its full roll before picking (`tipHTML` side `boon` in `js/ui.js`). | None | Released |
| H30 | | **Hotfix** (candidate) | Remote-shield ticker in `js/player.js` line 1455 throws "Cannot set properties of null (setting 't')" with some exotics. Pre-existing, found during U26, not scheduled | None | Planned |


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
