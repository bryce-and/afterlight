# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `archive/OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

Older shipped rows are in `archive/ROADMAP_SHIPPED.md`. Keep only the three newest shipped rows here; move older ones there at each release.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| H33 | v5.3.2 | **Hotfix** | The Strand grapple pulls hard: a midair pivot launches you off the floor and accelerates you toward it (up to 26 m/s) and you keep your swing; a surface hit lifts you off the floor so the pull does not drag you along it. Jump lets go and keeps your speed; arriving at the pivot ends it with your speed kept. Khvostov 7G-02 is a military black rifle. No save change. | None | Released |
| H32 | v5.3.1 | **Hotfix** | Cyclops sit on the ground, stationary, at scale 1.1 to 1.5 (no longer flying). Taken Goblin uses the Vex Goblin model in black Taken plating with an orb eye. Emperor Calus (Leviathan campaign boss) uses the dungeon Calus model, with no automaton reveal on death. Every exotic armor piece and exotic class item has its own look. Every gun has its own color scheme from its name; sights chosen per weapon family and frame; Sunshot's floating sun shape removed. Imp suicide blasts at a quarter damage (blastMul applied below 1). Scorn Abomination scale 1.65 to 1.3. Glaive bolt speed 95 to 135; Rocket-Assisted rounds on pulse rifles and sidearms 80 to 115. Strand grapple fires as a line (38 m): pulls you on a hit, hangs a midair pivot on a miss; jump releases. No save change. | None | Released |
| H31 | v5.2.1 | **Hotfix** | Phones only: the star map (planet labels and tap targets) lines up with the planets again, since v5.2 they were drawn at 62 percent of the correct position because of the phone UI zoom. Aim on phones toggles by default (tap AIM to zoom in, tap again to zoom out); players who set this option themselves keep their choice. Drag the thumb holding Fire to aim while shooting. Save: one added flag `aimToggleSet` in `settings.mobile`. | U26 | Released |
| H30 | | **Hotfix** (candidate) | Remote-shield ticker in `js/player.js` line 1455 throws "Cannot set properties of null (setting 't')" with some exotics. Pre-existing, found during U26, not scheduled | None | Planned |
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
