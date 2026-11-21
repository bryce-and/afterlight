# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `archive/OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

Older shipped rows are in `archive/ROADMAP_SHIPPED.md`. Keep only the three newest shipped rows here; move older ones there at each release.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| H44 | v5.9.1 | **Hotfix** | Dropships and indoor arrivals no longer clip through ceilings. Rooms with a solid or glass roof overhead (including ceilings that are only visual) use indoor arrivals instead of a ship. Cabal arrive on the floor with the grow-in indoors; only the Fallen (ceiling vent) and the Hive (floor crack, Ogres included) keep special indoor arrivals. Roof check in `js/dropships.js` (`roofHeight`, `roofRay`); indoor kinds in `js/dropship-plan.js` (`INDOOR`). Dev tool: `tools/arrivalshow.html`. | None | Released |
| U34 | v5.9 | **Indoor Arrivals** | Where there is no open sky, enemies arrive indoors: Cabal by drop pod, Fallen through a ceiling vent, Hive out of a floor crack. Each has a 1.5 s warning, and the last unit of a wave is out within 2.5 s. Vex, Taken and Scorn keep their gates, and bosses are unchanged. Units are never placed inside walls; if no spot is clear they get the old spawn. Levels can optionally list `arrivalPoints`. The "Dropship entrances" setting also controls these. Sound effects for dropships, teleport gates and indoor arrivals (`js/audio.js`). Code: `js/dropship-plan.js`, `js/dropship-models.js`, `js/dropships.js`. | None | Released |
| H43 | v5.8.4 | **Hotfix** | Hand cannons, shotguns, sidearms and the Forerunner carry a real optic on the gun (Red Dot, Holographic Ring or Micro Reflex) that matches the rolled sight. The optic is the point of aim at screen centre. The old floating dot sights and the red overlay drawn over them are gone. Every weapon of those types rolls one of the new sights (no Iron Sights roll); saved weapons without a sight get one automatically, always the same one per weapon. The tooltip shows the sight (`js/models.js`, `js/sights.js`, `js/ui.js`). | None | Released |


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
