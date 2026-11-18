# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `archive/OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

Older shipped rows are in `archive/ROADMAP_SHIPPED.md`. Keep only the three newest shipped rows here; move older ones there at each release.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| H30 | v5.4.6 | **Hotfix** | Mars: the boss-gate ramp into the Sunken Plaza (The Buried City) and the palace ramp up to the courtyard gate (Dust Palace) floated 2 to 3 m above the ground. Their slabs and light rails were written with absolute heights, while `vbox()` in `js/level-mars.js` measures from the ground under the box (U16e terrain lift); they now use offsets from the ground, so the paving sits on the terrain and meets the plaza and courtyard paving. Edge of Action remote shield: the v5.3 fix (U27 B2) now has regression tests in `tools/tests.js`. No save change, no balance change. | None | Released |
| H39 | v5.4.5 | **Hotfix** | Roguelike Horde and Endless: a weapon swap is 25% of boon options again (`WEAPON_OFFER_CHANCE` in `js/boons.js`; v5.4.3 had raised it to 40% by mistake). The exotic share of weapon options stays at 40% (`EXOTIC_SHARE`; was 10% before v5.4.3), so exotics still show up far more often. No save change. | None | Released |
| H38 | v5.4.4 | **Hotfix** | Roguelike Horde and Endless: a weapon swap taken from the boon pick updates the weapon list in the bottom right of the HUD at once (`ui.renderWeaponRows` called from `showBoonMenu` in `js/game.js`; it kept showing the old gun). No save change. | None | Released |


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
