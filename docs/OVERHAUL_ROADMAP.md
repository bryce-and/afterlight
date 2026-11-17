# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `archive/OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

Older shipped rows are in `archive/ROADMAP_SHIPPED.md`. Keep only the three newest shipped rows here; move older ones there at each release.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| H31 | v5.2.1 | **Hotfix** | Phones only: the star map (planet labels and tap targets) lines up with the planets again, since v5.2 they were drawn at 62 percent of the correct position because of the phone UI zoom. Aim on phones toggles by default (tap AIM to zoom in, tap again to zoom out); players who set this option themselves keep their choice. Drag the thumb holding Fire to aim while shooting. Save: one added flag `aimToggleSet` in `settings.mobile`. | U26 | Released |
| U26 | v5.2 | *(optional)* Mobile | Phones only: touch controls; HUD and menus for mobile; "Mobile mode" with calmer AI strafing and bigger enemy hitboxes. Desktop HUD, menus, AI and hitboxes stay exactly as they are | U2 | Released |
| U24 | v5.1 | **Roguelike Horde** | Two new roguelike modes beside the unchanged classic Horde and Endless: Roguelike Horde (`horde_rogue`, 30 waves) and Roguelike Endless (`endless_rogue`, no end, ENDLESS_SCALE uncapped health and damage, own best-wave record, exotic every 10 waves past 30). Boons after every 5th wave (25 boons, 3 options, 10 s pick, weapon swaps with confirm), run-only state, caches pay real items. Rifle, shotgun and grenade launcher start kit. Sealed boss rooms, fair spawns (`SPAWN_RULES`, 15/15/15/8 m), solo death or co-op full wipe ends a run. Death camera in every mode (`js/deathcam.js`, 3 s body, 1.5 s in the Crucible). `js/boons.js` pure rules, `js/boon-run.js` wiring. No save change. | U2, U4 | Released |
| H30 | | **Hotfix** (candidate) | Remote-shield ticker in `js/player.js` line 1455 throws "Cannot set properties of null (setting 't')" with some exotics. Pre-existing, found during U26, not scheduled | None | Planned |
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
