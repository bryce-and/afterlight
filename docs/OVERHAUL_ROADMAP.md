# Overhaul Roadmap (internal)

The living plan. The audit snapshot that produced it is `OVERHAUL_AUDIT.md`. The player-facing roadmap is `js/releases.js` and is deliberately curated, not a copy of this.
Every update needs Bryce's explicit approval before work starts.

| # | Version | Public name | Contents | Depends on | Status |
|---|---|---|---|---|---|
| U1 | v1.1 | **First Light** | Save v2 + full reset with backup; levels 1 to 40; reward track; rarity by level; starter subclasses + level 10 unlock; Light cap 200; title Update Log + Roadmap; test page | none | Released |
| U2 | v1.2 | **Clear Sight** | Status-effect registry; buff HUD with timers; yellow super bar; enemy health bars and names; side-floating damage numbers; ADS spread; stagger; balance pass (weapon tier scaling, super gain, Song of Flame, Stormtrance 4, Storm Grenade, Nighthawk) | U1 | Released |
| U3 | v1.3 | **Paths of Light** | Ability registry; elemental grenades shared per element; class ability choice; class-unique aspects; fragments; reward-track gating for the level 10 subclasses' last aspect and two new fragments; D2-style subclass screen; enemy debuffs (plus jolt) on the status registry; super camera/aim check; Hunter Triple Jump; Dawnblade shown as Sunsinger; save v3 | U2 | Released |
| H1 | v1.3.1 | **Hotfix** | Co-op health-check bugs (zone/wave clears early with enemies alive; members don't see host debuffs, stagger, boss banner). V4 bugs and tuning: Ionic Trace super regen (investigate; tune super-related armor perks), Celestial Nighthawk nerf (Nova Bomb / Golden Gun), far fewer drops and 2 to 3 items per cache, top-right feed shows item drops only, thrown hammer clipping into the ground, Rally Barricade wider and passable by players (not enemies), bigger enemy and player health bars tied to HUD scale (up to 200%). Co-op: auto-revive downed players when an activity ends, downed bodies fall to the ground, Arc Soul tracking | U3 | Released |
| U4 | v1.4 | **Arsenal** | Destiny weapon archetypes per family with archetype-fixed stats and named legendaries (fixed archetype and element); diagonal weapon icons with element symbols; Stasis/Strand weapon elements; particle seekers; Ready Up in the Director. Plus the former H2 items: traits for the 6 subclasses missing one; thrown hammer explodes after 7s; Hammer of Sol Sunspots (every Sunspot burns); Healing Grenade orb; "You Died" downed screen and co-op REVIVE Ghost; topbar "AFTERLIGHT" to title; title shows update name, version and artwork. Save v4 | U2 | Released |
| U5 | v1.5 | **Armor 2.0** | Perks replaced by mods: 4 sockets per piece, 10 energy, slot 1 stat mods only, a mod set per armor slot (existing perks become mods, Destiny 2 style, no raid mods). Six stats (Destiny's newer names) including ones that drive ability cooldowns. Mods screen: an arrow on the character screen's right edge slides to your character and 4 armor pieces with sockets, energy and hover-to-pick. Added in the proposal: mods unlock at level 5, orbs of power and armor charge, Arc Soul and jolt nerfs, vitals stay on top at narrow widths | U3 | Released |
| U6 | v1.6 | **Fashion Is Endgame** | Visible armor on the character; destination armor sets; 3-piece set bonus; shaders; armor icons. Added during the update: three Guardians with a character select screen and separate inventories (vault shared), class-bound armor, class exotics with Destiny perks, stats on the Mods screen only | U5 | Released |
| U7 | v1.7 | **Exotic Hunt** | 12 new class exotics (8 per class, two per slot) with Destiny perks; exotic duplicate protection (unfound exotics favored until all are found; weapons shared, armor per class); save v7. Added during the update: Lunafaction rifts reload the whole fireteam; ability cooldowns up (grenade and melee 1.5x, class 1.3x, kill refund halved); health and shield regen 25% slower; Nova Bomb void field; base Golden Gun cut, Nighthawk 5x, Knock 'Em Down shots 15% weaker | U6 | Released |
| U8 | v1.8 | **Light Ascendant** | Every Light subclass to 4 aspects and 8 fragments per element; 12 missing Destiny 2 Light supers (selectable, reward-track unlocks at 14/17/23/26); 7 more class jumps including Blink (Arcstrider and Voidwalker only). No Prismatic | U3 | Released |
| U9 | | Resonance | Audio overhaul: ambient, tense and orchestral music in place of lo-fi; weightier gun and ability SFX; restrained enemy sounds (Destiny 2 as reference) | none | Planned |
| U10 | | Hostile Intent | Enemy navigation with verticality; faction behaviors; every non-melee unit melees at very close range, with an animation; suicide units (Cursed Thrall, Explosive Shanks); temporary shields and grenades; boss push/hold; 3-player difficulty retune | U2 | Planned |
| U11 | | New Factions | Taken and Scorn as real factions: unique models, units, abilities and behaviors | U10 | Planned |
| U12 | | The Ghost's Story | Objective system; Ghost dialogue; Calus story; planet Director with gating; lighting, collision, verticality | U10, U1 | Planned |
| U13 | | The Last City *(working)* | Tower social space, Postmaster, hangout, shooting range | U12 | Planned |
| U14 | | Open Frontier | Patrol space, beacons, public events with heroics, sparrow | U10, U12 | Planned |
| U15 | | Legend and Ultimate | Legendary/Ultimate campaign, Light 300/350, multi-exotic switch, activity and fireteam Light scaling | U12 | Planned |
| U16 | | Exotic Missions | Timed exotic mission framework, first at level 30 | U12, U4 | Planned |
| U17 | | Darkness | Stasis and Strand subclasses for every class, each with two supers (its Destiny 2 super plus a new original one: a burst super if the D2 one roams, a roaming super if it's burst); Darkness enemy abilities | U8, U10 | Planned |
| U18 | | The Emperor's Shadow *(working)* | Leviathan dungeon, Calus | U10, U12, U15 | Planned |
| U19 | | *(optional)* Roguelike Horde | Boons, run inventory | U2, U4 | Planned |
| U20 | | *(optional)* Crucible | PvP maps, Control, Duel, AI Guardians | U10, U3 | Planned |
| U21 | | *(optional)* Mobile | Phones only: touch controls; HUD and menus for mobile; "Mobile mode" with calmer AI strafing and bigger enemy hitboxes. Desktop HUD, menus, AI and hitboxes stay exactly as they are | U2 | Planned |
| U22 | | *(optional)* Prismatic | Prismatic subclasses and features (kept out of U8 by Bryce) | U8, U17 | Planned |

V4 (2026-10-14) superseded V3's armor perks with mods (U5), split armor into Armor 2.0 and Style, and added Light Ascendant, Resonance, New Factions and Mobile. Later updates were renumbered.

## Release checklist

1. Work on `update/<n>-<slug>`. Keep the diff to the approved scope.
2. Run `tools/tests.html` in the preview browser: all tests pass.
3. Co-op connection check: two `?localtest` tabs connect, launch together and see each other (a full co-op QA run only when Bryce asks).
4. Play-check in the preview browser: no console errors; a mission start to finish (`tools/leveltest.js` plus opening the cache); every touched screen.
5. Save check: a pre-update save loads correctly (or, for a reset, is backed up), and a new save starts correctly.
6. **Title screen:** open the Update Log (the new entry is on top, with version, name, date and notes) and the Roadmap (the shipped update is removed, the remaining teasers are accurate and undated). Back and Esc return to the title. Check at 1280×720 and at phone width.
7. Update `OVERHAUL_STATUS.md`, this table, `DECISIONS.md` and the README.
8. Run `python3 tools/stamp_version.py`, then review the full diff.
9. Merge to `main`, push, tag `vX.Y`, and create a GitHub release named after the update.
10. Verify that `origin/main` has the commit and that the GitHub Pages site serves the new version (check the import map tag in the live `index.html`).
