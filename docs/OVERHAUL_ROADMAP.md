# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `archive/OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

Older shipped rows are in `archive/ROADMAP_SHIPPED.md`. Keep only the three newest shipped rows here; move older ones there at each release.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| H42 | v5.8.3 | **Hotfix** | Sound effects and music no longer drop out or go silent in big fights. The audio engine recovers on its own if the browser suspends it. Sound effects have lower limits per type plus a total limit (`js/audio.js`), so a huge fight skips a few shots in the busiest moments instead of glitching. Music schedules further ahead so a long frame leaves no gap, and a failed music step no longer stops the score (`js/music.js`). | None | Released |
| H41 | v5.8.2 | **Hotfix** | When a character speaks several lines in a row in a cutscene, the camera changes instead of repeating the first line's move: a short cut to the Guardian listening, then back to the speaker in a tighter shot, then a side angle. Applies to the Vanguard debriefs, the Glimmer scene and Mara's throne room. | None | Released |
| U33 | v5.8 | **Transmissions** | Story moments as cutscenes: engine `js/cutscene.js`, sets `js/cutscene-sets.js`, scenes `js/cutscene-scenes.js`. Seven scenes, each once per Guardian (`G.save.cutscenes`, additive, no save version bump): the Ghost reviving the Guardian at a Cosmodrome wreck, the jumpship at the Tower, the Vanguard room with the Glimmer, Crota's death, Tower debriefs for Cosmodrome, Mars and the Dreaming City, Mara Sov's throne room before The Spine of Keres, and Calus falling apart after the Leviathan. Skippable with Space, Enter, Esc or click; skipped in fireteams. Voices: every NPC line voiced (175 lines, ElevenLabs, per-speaker filters baked by `tools/bake_voices.py`); `js/voice.js`, `js/voice-data.js`, `assets/voice`. Known gap: 31 patrol-conversation lines and 8 Ghost Tower prompts have no audio (`docs/U33_VOICE_SCRIPT_3.md`, ids 255 to 293); subtitles show. Music rewritten in phases, rests in silence while exploring (`js/music.js`); ambiance beds per destination (`js/ambiance.js`). Pause menu Sound tab: Master Volume, Music, Ambiance, NPC Voice, Effects. Story typo fixes. Tests 490 of 490 pass (new U33 tests for ambiance, voice data and files, music phases, cutscene scripts). Play-check earth 0 and moon 2 clean (cutscenes disabled in headless tools via `AFTERLIGHT_NO_CUTSCENES`). Not checked: audio by ear on the music change, co-op. | Not recorded | Released


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
