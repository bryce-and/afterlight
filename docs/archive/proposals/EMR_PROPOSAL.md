# EMR Enemy model rework *(working name "Know Your Enemy")*, v4.0: Gate B proposal

Status: drafted 2026-11-04; approved by Bryce on 2026-11-05 as U18 (Light and Scaling and every later row moved down one number). Roadmap row EMR (Bryce, 2026-11-02: every enemy model gets reworked from references after the Io patrol zone; U17d was the pilot). Branch: `update/18-enemy-model-rework`. Built one faction at a time (Bryce, 2026-11-05): Fallen, then Hive, Cabal, Scorn, with references supplied per faction and a review pause after the Fallen line-up.

## Objective

Bring the four remaining factions, Fallen, Hive, Cabal and Scorn, up to Bryce's references the way U17d did the Vex and Taken, so every faction in the game reads at the same quality. Models only: rosters, stats, skills and colours stay as they are.

## What I need from Bryce before building

**Reference images**, about two per unit, saved to `docs/reference/enemies/` as `<faction>-<unit>-<n>` (for example `fallen-dreg-1.webp`), the same scheme U17d used. None exist in the repo yet for these four factions. The units:

| Faction | Units (in-game name, id) | Count |
|---|---|---|
| Fallen | Dreg (`scrappers:rusher`), Vandal (`scrappers:grunt`), Captain (`scrappers:captain`), Brig (`scrappers:heavy`), Explosive Shank (`scrappers:suicide`), Shank (`fl_shank`), Servitor (`fl_servitor`) | 7 |
| Hive | Thrall (`hollow:rusher`), Acolyte (`hollow:grunt`), Knight (`hollow:captain`), Ogre (`hollow:heavy`), Cursed Thrall (`hollow:suicide`), Shrieker (`hv_shrieker`, rebuilt in H12; gets a new model too, Bryce 2026-11-05) | 6 |
| Cabal | Legionary (`legion:grunt`), War Beast (`legion:rusher`), Centurion (`legion:captain`), Colossus (`legion:heavy`), Incendior (`lg_incendior`), Gladiator (`lg_gladiator`) | 6 |
| Scorn | Screeb, Wraith, Stalker, Raider, Lurker, Ravager, Chieftain, Abomination (`sc_*`) | 8 |

27 units. If references for a unit are missing, I build it from Destiny 2 knowledge and flag it in the report.

## Scope

1. **New models** for the 27 units above, from the references. Low-poly, silhouette first, so each unit reads at range. Colour stays on the faction default (DECISIONS 2026-11-02: Fallen Earth blue, Hive Moon bone, Cabal Mars red, Loyalist Cabal gold on the Leviathan, Scorn unchanged); reference images in other colours are built in the default.
2. **Model files per faction**, following U17d: `js/models-fallen.js`, `js/models-hive.js`, `js/models-cabal.js`, with the builders moved out of `js/enemies.js` (`fallen`, `hive`, `cabal`, `legionary`, `centurion`, `colossus`, `cursedThrall`, `shank`, lines 109 to 460). `buildModel` keeps its dispatch; the extra units (`fl_*`, `hv_*`, `lg_*`) stop living in `models-vex.js`'s `EXTRA` table. Scorn stays in `js/models-scorn.js`, rebuilt in place.
3. **Shared faction parts**, the way the Taken wisps are shared: the Fallen cloak and four-arm rig, Hive chitin plates and eye glow, Cabal armour plates and jump-pack. One part per faction, used by every unit of it, so the faction reads as one set.
4. **Contract kept for every model:** crit (head) meshes, hit boxes, `legs`, `arms`, `torso`, `muzzle`, `height`, `hover`, and whatever animation hooks the unit uses today (Dreg and Thrall run, War Beast lope, Servitor float, Shrieker spin, Colossus and Incendior heavy arms). Major (orange) variants keep using the same model.
5. **Release:** Update Log entry, Roadmap check, version stamp v4.0, title artwork (a major update), docs.

## Exclusions

- Bosses and their own models (Riksis, Sepiks, Crota, the Barons, Calus and the rest), and the generic `boss` shape per faction.
- Vex and Taken (done in U17d), patrol NPCs, the Scorn totem object.
- New units, new skills, stat or AI changes, roster changes.
- Colour rule changes.
- The LQC level pass (separate row).
- No save change (SAVE_VERSION stays as it is). No full co-op QA unless Bryce asks.

## Dependencies

U17d (faction colours in `enemyColors`, `tools/unitshot.sh`, the reference-image workflow) and the current rosters in `js/factions.js`. Bryce's reference images (above).

## Risks

1. **Size.** 27 models, more than U17d's 22, plus moving three builders out of `enemies.js`. Build one faction at a time (Fallen, Hive, Cabal, Scorn), commit each, and line each up with `tools/unitshot.sh` before the next. Checkpoint (approved): send the Fallen line-up and pause for Bryce's look before the other three.
2. **Breaking hit detection or animation.** A model that drops a crit mesh or an animation hook fails quietly (no headshots, a unit that slides). The `crit=1` line-up tints precision meshes, and a unit test checks every unit's model returns crit meshes and the hooks its type needs.
3. **Size changes move gameplay.** A taller or wider model changes how easy it is to hit and how it fits through doors and cover. Keep `height` and footprint within about 10% of today's unless Bryce wants otherwise, and list any that change.
4. **Moving code out of `enemies.js`.** A pure move first (no shape changes), tests and a mission run, then the rebuilds, so a regression is traceable to one commit.
5. **Performance.** More detail per unit times big patrol camps. Watch mesh counts per unit against today's and keep the new ones in the same range; check frame time in a busy patrol camp.

## Test plan

- `sh tools/run_tests.sh`, plus new tests: every unit of the four factions builds a model with at least one crit mesh, `muzzle` and `height`; walkers have `legs`; the builders resolve from the new files.
- **Line-ups:** `tools/unitshot.sh` per faction, normal and `crit=1`, compared against the references; screenshots sent to Bryce.
- **In game:** one mission each on Earth (Fallen), the Moon (Hive), Mars (Cabal), the Leviathan (Loyalist gold), the Tangled Shore (Scorn); one patrol camp per faction. Headshots land, deaths and ragdolls play, Servitor and Shrieker float, Shank and Cursed Thrall explode. No console errors.
- Pre-update save loads. Co-op check: ask Bryce before ending the session.

## Acceptance criteria

- All 27 units have models recognisable from their references (or flagged where references were missing), in their faction's default colours.
- Precision hits, deaths, skills and animations work on every one of them.
- No unit's height or footprint moves more than about 10% without being listed and agreed.
- No boss, Vex, Taken or NPC model changed.
- All tests pass; no console errors; no save change.
