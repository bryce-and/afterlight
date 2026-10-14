# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| U1 | v1.1 | **First Light** | Save v2 + full reset with backup; levels 1 to 40; reward track; rarity by level; starter subclasses + level 10 unlock; Light cap 200; title Update Log + Roadmap; test page | none | Released |
| U2 | v1.2 | Clear Sight *(working)* | Status-effect registry; buff HUD with timers; yellow super bar; enemy health bars and names; side-floating damage numbers; ADS spread; stagger; balance pass (super gain, Song of Flame, Stormtrance 4, Storm Grenade, Nighthawk) | U1 | Proposed next |
| U3 | | Paths of Light *(working)* | Ability registry; elemental grenades shared per element; class-unique aspects; fragments; D2-style subclass screen | U2 | Planned |
| U4 | | Arsenal | Diagonal weapon icons with element symbols; archetype pass; Stasis/Strand weapon elements; particle seekers | U2 | Planned |
| U5 | | Armor and Style | Visible armor; destination sets; perk counts by rarity; 3-piece set bonus; shaders; armor icons; mods | U1, U3 | Planned |
| U6 | | Hostile Intent | Enemy navigation with verticality; faction behaviors; shields and grenades; boss push/hold | U2 | Planned |
| U7 | | The Ghost's Story | Objective system; Ghost dialogue; Calus story; planet Director with gating; lighting, collision, verticality | U6, U1 | Planned |
| U8 | | The Last City *(working)* | Tower social space, Postmaster, hangout, shooting range | U7 | Planned |
| U9 | | Open Frontier | Patrol space, beacons, public events with heroics, sparrow | U6, U7 | Planned |
| U10 | | Legend and Ultimate | Legendary/Ultimate campaign, Light 300/350, multi-exotic switch, activity and fireteam Light scaling | U7 | Planned |
| U11 | | Exotic Missions | Timed exotic mission framework, first at level 30 | U7, U4 | Planned |
| U12 | | Darkness | Stasis and Strand subclasses, Darkness enemy abilities | U3, U6 | Planned |
| U13 | | The Emperor's Shadow *(working)* | Leviathan dungeon, Calus | U6, U7, U10 | Planned |
| U14 | | *(optional)* Roguelike Horde | Boons, run inventory | U2, U4 | Planned |
| U15 | | *(optional)* Crucible | PvP maps, Control, Duel, AI Guardians | U6, U3 | Planned |

## Release checklist

1. Work on `update/<n>-<slug>`. Keep the diff to the approved scope.
2. Run `tools/tests.html` in the preview browser: all tests pass.
3. Play-check in the preview browser: no console errors; a mission start to finish (`tools/leveltest.js` plus opening the cache); every touched screen.
4. Save check: a pre-update save loads correctly (or, for a reset, is backed up), and a new save starts correctly.
5. **Title screen:** open the Update Log (the new entry is on top, with version, name, date and notes) and the Roadmap (the shipped update is removed, the remaining teasers are accurate and undated). Back and Esc return to the title. Check at 1280×720 and at phone width.
6. Update `OVERHAUL_STATUS.md`, this table, `DECISIONS.md` and the README.
7. Run `python3 tools/stamp_version.py`, then review the full diff.
8. Merge to `main`, push, tag `vX.Y`, and create a GitHub release named after the update.
9. Verify that `origin/main` has the commit and that the GitHub Pages site serves the new version (check the import map tag in the live `index.html`).
