# U17d Vex and Taken rework *(working name)*, v3.6: Gate B proposal

Status: drafted 2026-11-02 with Bryce's Vex and Taken references and enemy-look rules; approved by Bryce on 2026-11-02. Split on 2026-11-02 (Bryce): this update is the enemy rework; the Io patrol zone is U17e (`docs/U17e_PROPOSAL.md`) and is built after it. Branch when approved: `update/17d-vex-taken-rework`.

## Objective

Bring the Vex and Taken up to Bryce's references before the Io patrol zone, where both show up most. Three parts:

1. **Vex and Taken rework:** new models from the references, a shared sniper behaviour, two new or repurposed snipers, two units retired.
2. **One default look per faction** on every destination.
3. **The Tangled Shore switches from Fallen to Scorn.**

## References

`docs/reference/enemies/` (43 images), indexed in `docs/reference/README.md`, section "Vex and Taken units". They set the shape; colour follows Part 2.

## Part 1: Vex and Taken rework

**New models** in `models-vex.js` and `models-taken.js`, one per unit, from the references. Low-poly as always, with the silhouette that makes each unit readable at range.
- **Vex (bronze and black, red eye):** Harpy, Goblin (with its glowing chest core), Hobgoblin, Minotaur, Cyclops, Imp Swarm, Fanatic, Wyvern, Hydra. The white, gold and blue references are built in the standard bronze.
- **Taken (black body, white glowing limbs, a bright eye, dark wisps):** Thrall, Shadow Thrall, Acolyte, Vandal, Psion, Goblin, Wizard, Captain, Centurion, Phalanx, Knight, Ogre.
- **The Taken wisps** (the black flame shapes off heads and shoulders) are a shared part, so every Taken unit gets them the same way.

**Sniper behaviour (shared skill):** a visible aim line that tracks you, then a charged high-damage shot. It breaks if the sniper loses line of sight. One reusable skill in `enemy-skills.js`, used by:
- **Vex Hobgoblin** (already long-range; it gets the aim line and charged shot);
- **Taken Vandal** (the sniper replaces its current ward skill);
- **Taken Hobgoblin**, a new unit: the Vex Hobgoblin frame in the Taken style (no reference).

**Retired**
- **Vex Supplicant:** removed; the Fanatic takes its slot in the Vex roster.
- **Taken Incendior:** removed from the Taken roster; the Taken Hobgoblin takes its slot. The Cabal Incendior (`lg_incendior`) stays.

## Part 2: One default look per faction

Today the Fallen, Hive, Cabal and Vex take their body and eye colours from the destination (`colors.enemy`, `enemy2`, `eye` in `js/data.js`, used in `js/enemies.js:525`). Only the Taken and Scorn carry their own colours.

The rule (Bryce, 2026-11-02): every faction has one default look on every destination; a different look only for a different faction or a subtype.
- **Fallen:** the Earth blue.
- **Hive:** the Moon bone white.
- **Cabal (Red Legion):** the Mars red.
- **Vex:** bronze and black, red eyes.
- **Loyalist Cabal (subtype):** gold, on the Leviathan.
- **Taken and Scorn:** unchanged.

The colours move onto the factions. The destinations keep their other colours (sky, ground and so on). The H16 cross-destination palette (`pal`) is no longer needed for colour, so patrol data stops passing it. Bosses with their own models keep their current look.

## Part 3: Tangled Shore becomes Scorn

The three Tangled Shore campaign missions (The Trickster, The Mindbender, Scorned) spawn Scorn instead of Fallen, and the destination's faction becomes Scorn. The Barons keep their boss models. The Tangled Shore patrol zone (U17f) will use the Scorn too.

**Release:** Update Log entry, version stamp, docs. Title artwork: decide at release whether this update gets its own card (it is a major update by number) or keeps the Open Frontier card.

## Exclusions
- The Io patrol zone (U17e) and the Tangled Shore and Dreaming City patrol zones (U17f).
- New models for the Fallen, Hive, Cabal or Scorn: they only change colour (Part 2).
- New boss models.
- No save change. No full co-op QA unless Bryce asks.

## Dependencies
U17c (released v3.5). The existing Vex, Taken and Scorn rosters, skills and model files (`factions.js`, `enemy-skills.js`, `models-vex.js`, `models-taken.js`, `models-scorn.js`).

## Risks
1. **Size.** Twenty-two unit models. Every model has to keep its crit (head) meshes, its hit boxes and its animation hooks working. Build in batches, starting with the units Io uses most, and check each batch in the preview.
2. **Default looks change every mission.** Enemies on Io, Titan, the Tangled Shore and the Dreaming City look different after this. Some may clash with their destination (for example, Hive bone white against Titan's pale decks). Screenshot one mission per destination and flag any clash to Bryce rather than quietly tinting it.
3. **The sniper skill is new damage at range.** The aim line must be visible and fair. Tune charge time and damage in the preview and list the numbers in the report.
4. **Removing two units.** Anything that names `vx_supplicant` or `tk_incendior` (rosters in `factions.js`, `models-vex.js:136` and `:387`, tests) must be updated, or the game spawns a unit with no definition. A unit test checks that every roster entry resolves.

## Test plan
- `sh tools/run_tests.sh`, plus unit tests for: every roster entry resolving to a defined unit, the default faction colours, the sniper skill, and Tangled Shore missions spawning Scorn.
- **Units:** a preview line-up of every reworked Vex and Taken unit (dev command spawn), checking the model, the crit hit on the head, the death and the skill. Sniper fights checked against the Vex Hobgoblin, Taken Vandal and Taken Hobgoblin.
- **Colours:** one mission per destination, checking the faction's default look; the patrol zones checked for the same.
- No console errors. Screenshots of the unit line-ups sent to Bryce at the end. Co-op: ask Bryce before ending the session.

## Acceptance criteria
- Every Vex and Taken unit has a model recognisable from its reference, with working crits, deaths and skills.
- The Vex Hobgoblin, Taken Vandal and Taken Hobgoblin snipe with a visible aim line.
- The Supplicant and Taken Incendior no longer spawn anywhere.
- Each faction looks the same on every destination, except the Loyalist Cabal subtype.
- The Tangled Shore missions are fought against the Scorn.
- All tests pass; no save change (SAVE_VERSION stays 10).
