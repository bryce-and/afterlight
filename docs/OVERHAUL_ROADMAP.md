# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `archive/OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

Older shipped rows are in `archive/ROADMAP_SHIPPED.md`. Keep only the three newest shipped rows here; move older ones there at each release.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| U24 | | *(optional)* Roguelike Horde | Boons, run inventory | U2, U4 | Planned |
| U25 | v4.9 | **Crucible** | PvP maps, Control, Duel, AI Guardians | U13, U3 | Released |
| U29 | v5.0 | **Rival Guardians** | Crucible AI Guardians: per-match random kits (rollKit in js/pvp.js: class, Light subclass, grenade, class ability, super, primary/special/heavy, armor look and shader), range-based weapon choice and heavy crates, jumping onto obstacles, element grenades, class abilities, nine supers; team-only rifts and wells, team barricades (moveBody team arg, G.pvpWalls in the hit list); kill feed names the weapon | U25 | Released |
| U26 | | *(optional)* Mobile | Phones only: touch controls; HUD and menus for mobile; "Mobile mode" with calmer AI strafing and bigger enemy hitboxes. Desktop HUD, menus, AI and hitboxes stay exactly as they are | U2 | Planned |
| U27 | | *(optional)* Prismatic | Prismatic subclasses and features (kept out of U8 by Bryce) | U8, U22 | Planned |
| U28 | v4.8 | **Mission Blitz** | Five different campaign missions back to back on Legendary numbers with no Light floor (enemies are always your combat Light + 25) and no revives; any death ends the run. Opens account-wide after a Legendary campaign clear. Run reward: an exotic pick menu (unfound exotics, or 3 exotic armor when all are found), plus 1 legendary per extra fireteam member. `js/blitz.js` (pure rules), Activities screen rebuilt as Ops nodes (Vanguard Ops, Endgame Ops), armor stat bands by campaign tier cleared (`armorBand`, `ARMOR_BANDS`) | U20a | Built, awaiting play-check and release |


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
