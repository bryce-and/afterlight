# Afterlight Overhaul: Initial Audit (Gate A)

Audit date: 2026-10-13. Spec: `Afterlight Update V3` (confirmed by Bryce as the source of truth; the master prompt calls it "Overhaul V2").
Baseline: `main` @ `09e02dc`, clean tree, in sync with `origin/main`.

Everything below comes from reading the code. **Nothing was play-tested in this audit.** "Exists" means the code is there and looks wired up; it does not mean verified in play.

---

## 1. Architecture summary

| Area | Finding |
|---|---|
| Engine / language | Three.js 0.160.0 (jsDelivr CDN via import map), plain ES modules, no framework, no build step, no `package.json`. ~750 KB of JS across 28 modules, plus `style.css` (45 KB). |
| Entry / loop | `index.html` → `js/main.js` (renderer, input, rAF loop) → `js/game.js` (`updateGame`). Global mutable state object `G` in `js/state.js`. |
| Run | `python3 -m http.server 8123` (`.claude/launch.json` entry `afterlight`). |
| Deploy | GitHub Pages serves `main` root at the public repo `bryce-and/afterlight`. A push to `main` is a public release. `tools/stamp_version.py` cache-busts module URLs; `sw.js` serves network-first. No tags or GitHub releases exist yet. `gh` CLI is authenticated as `bryce-and`. |
| Tests | None. No test runner, no linter. Node is **not installed** on this machine. `tools/leveltest.js` is a manual in-browser smoke test for maps. |
| Content data | `js/data.js`: elements, rarities, 12 weapon archetypes, 23 legendary perks, 30 exotic weapon perks, 24 exotic weapons, 8 armor perks, 12 exotic armor, 3 classes × 3 subclasses, 5 enemy types, 6 destinations × 3 missions (18 missions), 2 activities. Fairly data-driven. |
| Behavior | Not data-driven. Abilities, supers, and perks are hardcoded branches: `switch`/`if (id === ...)` in `player.js` (1,642 lines) and `abilities.js`; perks are checked with `w.has('perk')` throughout `player.js`. |
| Damage | One central `dealDamage()` in `game.js` (good): crit, shields, elemental shield mult, weaken/slow/suppress, exotic armor mults, co-op host authority. |
| Enemies | `enemies.js`: 5 archetypes reskinned per faction (names and model style only; identical behavior). Cover AI for grunt/captain. `bosses.js`: 18 unique boss models; bosses share one AI (shield at 66/33% + adds, slam or fan volley). |
| Levels | 18 hand-built maps (`level-*.js`) on a kit in `world.js`. Enemies are ground-bound at y=0 with no pathfinding. AABB colliders only. Max 6 lights per map. |
| Save | One localStorage key, `version: 1`, with 9 boolean one-shot migration flags (`namesV3` … `weaponsV10`). No backup before migration. |
| Co-op | PeerJS WebRTC, host-authoritative, up to 3 players. Already scales enemy count and boss HP by fireteam size. Solid base for fireteam scaling and the Leviathan. |
| UI | `ui.js` (1,121 lines), template-string `innerHTML` screens: title, class select, Director, Activities, Character (with Vault, subclass panel), pause, inventory, complete/failed. |
| Other | Generative music (`music.js`), synth SFX (`audio.js`), third-person camera for roaming supers, PWA manifest and service worker. |

### Defects found while reading (unverified in play)

1. **Power cap below mission requirements.** `MAX_POWER = 100` (`loot.js`), but Tangled Shore and Io recommend 100 to 125. Players can never reach those missions' power, so they are permanently underpowered: damage dealt drops to as low as 0.5x and incoming damage rises to as high as 1.6x.
2. **Stormtrance chains to 2, not 3.** `enemiesNear(best.pos, 8, 3)` returns the primary target as one of the 3, and it is then skipped (`player.js` ~L1520).
3. **Golden Gun splash re-hits the primary target.** `enemiesNear(end, 10, 2)` does not exclude the enemy just shot. This is a likely contributor to the reported Celestial Nighthawk "double buff". Not yet reproduced.
4. **Storm Grenade hits one enemy per tick.** It picks one random target every 0.3 s (`abilities.js` `storm`). This matches the spec's complaint.
5. **README is stale.** It says 3 destinations and 9 missions; the game has 6 and 18.

---

## 2. Feature-gap assessment (summary)

The full requirement-by-requirement list is in `docs/OVERHAUL_STATUS.md`. Headline:

| Status | Count | Examples |
|---|---|---|
| Exists, keep (verify in play) | ~6 | Exotic weapons with unique perks and models, co-op to 3, third-person supers, damage numbers, ADS |
| Exists, needs modification | ~14 | Director (no planets or gating rules), super bar (element-colored, not yellow), damage numbers (float up, not to the side), legendary armor perks (1 not 2), Horde (not roguelike), boss AI, starter subclasses (all 3 unlocked from the start), balance items |
| Missing entirely | ~30 | Player level 1 to 40, XP, reward track, Tower/social space, Postmaster, shooting range, story and Ghost dialogue, Calus and the Leviathan, aspects, fragments, mods, Stasis and Strand, shaders, armor models and sets, set bonuses, enemy health bars, stagger, buff HUD with timers, patrols, beacons, public events, sparrow, mission objectives beyond "clear zone", Legendary/Ultimate campaign, light past 100, exotic missions, new enemy behaviors (shields, grenades), PvP, Update Log, Roadmap |

The current game is a strong **combat sandbox** (weapons, exotics, supers, co-op, maps). It has **no progression spine** (levels, unlocks, story, difficulty tiers) and **no world layer** (social space, patrol, objectives). Most of V3 lives in those two missing layers.

---

## 3. Retain / refactor / replace

| System | Verdict | Why |
|---|---|---|
| Three.js + no-build ES modules | **Retain** | Works, deploys free to Pages, fast iteration. A bundler adds cost with no V3 feature needing it. |
| `data.js` content (weapons, exotics, locations, bosses) | **Retain, split** | Valuable content. Split into `data/` modules as it grows (weapons, armor, abilities, enemies, destinations, progression). |
| `dealDamage` pipeline | **Retain, extend** | Correct central choke point. Stagger, status effects, and light-level scaling hook in here. |
| Level kit + 18 maps | **Retain** | Large investment and good quality. Verticality needs enemy navigation first (below). |
| Co-op net layer | **Retain** | Host-authoritative design fits dungeon and fireteam scaling. Not suitable for competitive PvP as-is (see risks). |
| Models, effects, music, audio | **Retain** | Extend for armor sets, shaders, and particle seekers. |
| Save system | **Refactor** | Move to a numbered schema with an ordered migration list, a backup copy before migrating, and new `progression` and `cosmetics` sections. Needed by almost every V3 feature. |
| Power system (`MAX_POWER` 100) | **Replace** with Light | V3 needs light up to 350, caps per difficulty, activity scaling, and fireteam scaling. The current clamp is also defect #1. |
| Abilities / supers / subclass data | **Refactor into a registry** | Aspects and fragments must modify abilities. Shared elemental grenades (Solar grenades on every Solar subclass) need abilities defined once per element, not per subclass. Behavior handlers stay hand-written; definitions, cooldowns, and modifiers become data. |
| Buffs / status effects | **Replace** | They are ad hoc fields today (`buffs.rampage`, `e.weakenT`, `nezT`, `heart.*`). A single status-effect registry (id, duration, stacks, icon, source) drives the HUD timers V3 asks for, plus aspects, fragments, mods, and Horde boons. |
| Mission model (zones of waves) | **Refactor to objectives** | V3 wants objectives inside missions, public events, dungeon mechanics, and timed exotic missions. One objective-step system (travel / clear / defend / interact / boss / timer) serves all of them. Existing missions convert to "travel + clear" steps with no gameplay change. |
| Enemy movement (y=0, no pathing) | **Replace (later)** | Verticality, the Tower, patrol spaces, and the Leviathan need enemies that can use ramps and levels. Plan: a baked waypoint/nav graph per map. Large and risky, so scheduled after the progression layers. |
| `ui.js` monolith | **Refactor incrementally** | Split by screen as screens are touched (character, subclass, director, progression, title). No big-bang rewrite. |
| Horde activity | **Rework** into roguelike Horde in the optional phase | It reuses wave and arena code. |

---

## 4. Dependency-ordered roadmap

Working titles. Each row is one approval-gated update.

| # | Working title | Contents | Depends on |
|---|---|---|---|
| **U1** | **First Light** (Progression Foundations) | Save schema v2 + migration framework + backup; player level 1 to 40 with XP; level reward track screen (legendary every 3 levels, exotics at 20 and 40); rarity scaling by level; starter subclass pairs + level 10 unlock; Light replaces the 100 power cap (base cap 200, mission power rescaled, fixes defect #1); title-screen **Update Log** and **Roadmap**; in-browser test page; docs and tracker; first tagged release. | none |
| U2 | Combat Clarity | Status-effect registry; buff HUD with timers (general above the abilities, weapon effects side by side below); yellow super bar + charged animation; enemy health bars and names on look, with fade; side-floating damage numbers; ADS spread tightening; stagger on hit; balance pass (primary damage, enemy HP, super gain, Song of Flame uptime, Stormtrance 4 targets, Storm Grenade multi-hit, Nighthawk/Golden Gun investigation). | U1 (light scaling for balance numbers) |
| U3 | Subclass framework | Ability registry; shared elemental grenades; class-specific aspects; elemental fragments; melee, class ability, jump, and super variants; D2-style subclass screen with unique icons; super checks for camera mode and aim. | U2 (status effects) |
| U4 | Arsenal | Diagonal square weapon icons with element symbols; archetype differentiation pass; Stasis and Strand as weapon elements (verbs arrive in U12); legendary weapon model variety; particle tracking for seekers (VFX overhaul part 1). | U2 |
| U5 | Armor and Style | Visible armor on the character model; destination armor sets; perk counts by rarity (Legendary 2, Rare and Uncommon 1, Common 0); 3-piece legendary set bonuses; destination perk pools; shaders; armor icons; armor mods. | U1, U3 (mods modify abilities) |
| U6 | Hostile Intent | Enemy nav graph (ramps, levels); faction behavior profiles; new enemy types with temporary shields and grenades; distinct models and names; boss AI push/hold with no cover. | U2 |
| U7 | The Ghost's Story | Objective-step mission system; Ghost dialogue/subtitle system (no player voice); campaign story with Calus as the antagonist; Director with planets and campaign gating; lighting and collision fixes; verticality pass on existing maps. | U6 (nav), U1 |
| U8 | The Tower | Social space hub: Postmaster (overflow rewards), hangout, shooting range at-light, vendors as needed. | U7 (Director), U1 |
| U9 | Open Frontier | Large patrol space with multiple factions, patrol beacons, public events with heroic triggers, sparrow on all levels. | U6, U7 |
| U10 | Legend and Ultimate | Legendary campaign (unlock animation, 25 light under, cap 300); Ultimate (better animation, 50 under, no revives so a death restarts the mission, cap 350, multi-exotic switch); activity light scaling; fireteam light scaling with per-player loot. | U7, U1 |
| U11 | Exotic Missions | Timed exotic mission framework; first mission unlocking at player level 30 with an exclusive exotic. | U7, U4 |
| U12 | Darkness | Stasis and Strand subclasses (supers, aspects, fragments, grenades), Darkness enemy abilities. | U3, U6 |
| U13 | The Leviathan | Calus dungeon: one central mechanic that evolves across several bosses, scaled for 1 to 3 players (health and mechanics). | U6, U7, U10 |
| U14 *(optional)* | Roguelike Horde | Boons every 5 rounds (paused, 10 s), stacking buffs and weapon offers with swap confirmation, run inventory, caches pay into the real inventory, AR/shotgun/GL start, multiple exotic weapons, no exotic armor. | U2 status effects, U4 |
| U15 *(optional)* | Crucible | 3 to 5 maps, Control, Duel, optional AI Guardians. | U6 nav, U3 |

**Why this order minimizes rework**
- Light and level (U1) come first because loot, balance, difficulty tiers, activity scaling, and the Tower all read them. Balancing before Light exists would be redone.
- Status effects (U2) come before aspects, fragments, mods, and Horde boons, which are all "apply effect X under condition Y".
- The ability registry (U3) comes before armor mods (U5) and Darkness (U12), which modify and extend abilities.
- Enemy navigation (U6) comes before verticality, the Tower, patrol, and the Leviathan, which all need enemies off y=0.
- The objective system (U7) comes before public events, exotic missions, and the dungeon, which are all objective sequences.
- The Leviathan comes late because it consumes nearly every system.

---

## 5. Major risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Live players' saves.** Every push to `main` ships to everyone with a localStorage save. A bad migration loses gear. | High | U1 adds a backup key written before any migration, ordered migrations, and migration tests that run on fixture saves before release. |
| **No automated tests, and no Node.** | High | U1 adds `tools/tests.html`, a dependency-free in-browser test runner for pure logic (loot, progression, migrations, data validation), run through the preview browser. Gameplay stays manually verified, and reports will say so. |
| **Enemy navigation with verticality** (U6) | High | Baked per-map waypoint graph, not runtime navmesh. Gated by `leveltest.js` reachability checks. |
| **PvP over P2P WebRTC** has no anti-cheat, the host has an advantage, and there's no relay. | Medium | Optional phase only. Recommend casual/private matches only, and say so in the UI. |
| **Scope.** V3 is many months of work. | High | Approval gates per update, the tracker, and optional items kept last. |
| **Performance.** A large patrol space and the Leviathan push the browser mesh budget (~900 meshes per map today). | Medium | Instancing and merged geometry for scenery; check the renderer's draw-call count when sign-off is near. |
| **Destiny IP.** Exotic, legendary, boss, and place names (Gjallarhorn, Crota, Calus, the Leviathan) are Bungie trademarks, used verbatim on a public site. | Medium (legal, not technical) | This is your decision (see §8). The roadmap works either way; renaming is a data-only change. |
| **Monolithic `player.js` and `ui.js`.** | Medium | Split modules when a system is touched, never as a standalone rewrite. |

---

## 6. Testing and release strategy

**Per update**
1. Work on a local branch `update/<n>-<slug>`.
2. Run `tools/tests.html` in the preview browser (unit, migration, and data-validation tests). The results go in the release report.
3. Run the game in the preview browser: console errors, the touched screens, and a mission start-to-finish where relevant. Run `leveltest.js` on any changed map.
4. Save checks: load a fixture of the pre-update save, then confirm the migration ran, the backup exists, and nothing was lost.
5. Review the diff.
6. Update the in-game Update Log and Roadmap data, then run `tools/stamp_version.py`.
7. Merge to `main`, push, and create the tag `vX.Y` and a GitHub release with the update name. Verify the Pages build loads.

**Versions:** tag the current live state as `v1.0` (baseline, "pre-overhaul"). Each update bumps the minor version (U1 = `v1.1`).

**Beta channel (you asked):** my recommendation is **not now**. Pushing to `main` is fine for the early updates, because the migration backup plus tests cover the main risk. A beta becomes worth it before risky, save-heavy updates (U6 nav, U10 difficulty). The cheap way: GitHub Pages serves one branch, but a `beta/` folder on `main` can hold a build using a separate save key, so testers never touch their real save. I'd revisit this at U5.

---

## 7. Requirement tracking

- `docs/OVERHAUL_STATUS.md`: one row per V3 requirement (ID, requirement, current state, owning update, status, test, release). Statuses follow the master prompt: Not assessed / Planned / In progress / Implemented / Tested / Complete and published / Blocked.
- `docs/DECISIONS.md`: dated decision log.
- This audit doubles as the internal roadmap (§4) until U1, when it moves to `docs/OVERHAUL_ROADMAP.md` alongside an `ARCHITECTURE.md`.
- In-game Update Log and Roadmap content lives in one data file (`js/releases.js`), separate from these internal docs. Public teasers are curated, as §7 of the master prompt requires.

---

## 8. Proposed first update: U1 "First Light"

**Objective / player result:** your Guardian now has a level from 1 to 40, a reward track to climb, starter subclasses with a level 10 unlock, gear that improves with level, and Light that grows past 100. The title screen shows what has shipped and what is coming.

**Included**
1. Save schema v2: numbered migrations, a pre-migration backup key, and a `progression` section (xp, level, claimed rewards, unlocked subclasses). Existing boolean flags fold into it.
2. XP from kills, zone clears, and mission completion (first clear bonus). Level curve 1 to 40, data-defined.
3. **Reward track screen** (new Director tab): a horizontal line of all 40 levels with rewards. A random legendary every 3 levels and a random exotic at levels 20 and 40. Claimable, with the Postmaster deferred to U8, so overflow goes to the vault and then auto-dismantles with a notice.
4. Rarity scaling by level: mostly common/uncommon/rare early, legendary rare at 15, legendary nearly exclusive at 40 (data curve).
5. Starter subclasses: Titan Sunbreaker + Striker, Hunter Gunslinger + Nightstalker, Warlock Voidwalker + Dawnblade. The third subclass drops at level 10.
6. Light: `MAX_POWER` 100 is replaced by a Light cap of 200 for the base campaign. Mission recommended Light is rescaled across 18 missions to span about 10 to 200. Fixes defect #1.
7. Title screen: **Update Log** and **Roadmap** panels, data-driven from `js/releases.js`. The log gets the `v1.0` baseline entry and the U1 entry at release. The roadmap gets 3 or 4 curated teasers.
8. `tools/tests.html` in-browser test runner, with tests for the level curve, reward track, rarity curve, migrations (fixture saves), and data validation.
9. Docs: tracker, decisions, roadmap, architecture notes; README corrected.

**Explicit exclusions:** Legendary/Ultimate difficulty and the 300/350 caps (U10), activity and fireteam light scaling (U10), balance changes and the known ability bugs (U2), the Postmaster (U8), subclass screen redesign (U3).

**Risks:** save migration on live players (backup + fixture tests); mission Light rescale changes difficulty feel (it keeps current relative ordering and the underpowered formula's band).

**Acceptance criteria**
- A fresh save starts at level 1 with exactly the two starter subclasses; reaching level 10 grants the third with a notice.
- XP visibly accrues in a mission; levels 1 to 40 are reachable; the track shows all 40 levels; rewards at 3, 6, … 39 are legendary, and at 20 and 40 exotic; each reward is claimable exactly once.
- Drop rarity follows the level curve (checked by a statistical unit test over 10k rolls).
- Gear above 100 drops; Io and Tangled missions are reachable at their recommended Light.
- A pre-U1 fixture save loads with no lost items or equips, a backup key exists, and existing subclass choices are honored.
- The title screen opens the Update Log and Roadmap and returns to title; layout works at 1280×720 and phone width.
- All `tests.html` tests pass; no console errors through a full mission run in the preview browser.

**Git:** branch `update/1-first-light` → merge to `main` → tag `v1.1` + GitHub release "First Light". Baseline tag `v1.0` on `09e02dc` first.

---

## 9. Decisions

Decided 2026-10-13 (see `DECISIONS.md`): every player is reset at U1, including subclasses; versions are `v1.0` baseline then `v1.1`, `v1.2`, and so on; Destiny names stay.

Still open:
1. **Reset scope:** progression only (level, subclasses, cleared missions, Light), or a full wipe (gear, vault, and glimmer too)?
2. **Test tooling:** in-browser test page (no installs, recommended), or install Node?
3. **Beta channel:** defer until about U5 (see §6)?
