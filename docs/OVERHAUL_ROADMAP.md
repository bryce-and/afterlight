# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `archive/OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

Older shipped rows are in `archive/ROADMAP_SHIPPED.md`. Keep only the three newest shipped rows here; move older ones there at each release.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| H35 | v5.4.1 | **Hotfix** | Roguelike Horde and Endless: boss health uses the boss curve alone (was the wave curve times the boss curve, about 60% less boss health at wave 30). Boons after wave 1 and every 3 waves, never after the last wave (`BOON_EVERY` 3, `boonDue` in `js/boons.js`; was every 5th). Start kit is a random legendary primary, special and heavy (`HORDE_KIT` in `js/boon-run.js`). Character screen (I) locked during a run (`toggleCharacter` in `js/ui.js`). Compressed Wave Frame and Trinary Vision bursts placed above terrain per burst (`waveY` in `js/player.js`). Perched Broodweaver threadlings still go after nearby enemies when your hit kills and nothing is near the corpse (`releasePerched` in `js/darkness.js`). No save change. | None | Released |
| U29 | v5.4 | **Boss Redesign** | Every boss has a new model. Most are faction units grown into bosses with `js/boss-kit.js` `grow()` (height scaled to the old boss, crit meshes capped to the old crit volume). From scratch: Aurix, Mindbender, Fanatic (glaive in hand), Psion Flayers, Vex Mind. Taken bosses are black and white. Leviathan bosses (Calus, Vhorrak, Kathrax) untouched. Stats, AI, arenas, hit heights and hooks unchanged. Guard test in `tools/tests.js` against `tools/boss-baselines.json` | - | Released |
| H34 | v5.3.3 | **Hotfix** | Wyverns walk on the ground (no longer float). Special-ammo Grenade Launchers hit about 55% harder (Light Launcher x0.22 to x0.34, Double-Fire x0.125 to x0.19 per grenade). Strand tangles explode at double radius (4.5 m to 9 m) when shot or set off. Grenade button during a Strand grapple lets go early and keeps your speed. No save change. | None | Released |
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
