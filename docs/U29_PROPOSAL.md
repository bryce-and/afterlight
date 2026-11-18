# U29 Boss Redesign: Gate B proposal (target: v5.4)

**Approved by Bryce 2026-11-17 with the defaults:** old `calus` builder deleted, `baron` rebuilt as a Scorn Baron, Aurix redone with his preview sheet shown first. H32 has shipped as v5.3.1 (`main` at `38dab77`), so the branch base is ready.

Requested by Bryce 2026-11-17. Not on the roadmap table yet (last row is U28), so the build session adds a U29 row. Branch `update/29-boss-redesign`, cut from `main` **after H32 ships** (H32 touches `bosses.js` for Calus, so branching earlier would conflict). Version assumes v5.3 is the latest tag; confirm if U28 (v4.8) is released first.

## Objective
Rebuild every boss model in `js/bosses.js` with a new, distinct silhouette that reads as its faction at a glance (Fallen, Hive, Cabal, Vex, Taken, Scorn) and as its Destiny archetype, while hit boxes, weak points and fight scripts behave exactly as they do today.

## What exists today (verified by grep)
- `BOSS_MODELS` (`bosses.js:156`) has **26 entries**: the 25 below plus `takenMind` (Aurix, listed first with shorthand syntax). With the unused old `calus` retired that is **25 live bosses**, which matches the request. Each takes the `buildModel` kit (`enemies.js:80-90`), must set `c.torso` and `c.height`, and tags weak-point meshes `crit` (`c.add(..., crit=true)`). Shared helpers (`legs`, `arm`, `gun`, `fallenBody`, `hiveKnight`, `cabalBody`, `takenMind`, ...) at lines 19-150 give most bosses of one faction the same body, which is the silhouette problem.
- Models are built about 2 m tall and scaled at runtime: campaign bosses use the `boss` unit def (`data.js:524`, `scale: 2.6`, so `radius = 0.45 * scale = 1.17`). Exceptions set in code: `emperorCalus` 0.8 / 1.4 (`enemies.js:255`), dungeon bosses `anointedBather` 0.8 / 1.1 and `huntmaster` 0.75 / 1.0 (`dungeon-rules.js:99,128`).
- **Radius is never derived from the model**, only from `scale`. Height is `model.height * scale`. So if each rebuilt model keeps its `c.height` and footprint, hit capsules, nav "large" status and arena fit do not change.
- Hit meshes are every mesh the builder adds (`hit` list). Mobile mode widens them (`widenHitMeshes`). `enemy-merge.js` folds same-material parts, but crit and non-crit never merge, and builders that set `c.onDeath` or `c.deathStep` skip merging.

## Scope
1. Rebuild all 25 live boss models (table below, includes Aurix) as new silhouettes. Each keeps: same `c.height` (within 5%), same footprint (bounding box inside the old XZ extent plus 10%), same `crit` mesh region (head, eye, core, gem), `c.torso`, `c.muzzle` at the point shots leave, `c.legs` / `c.arms` pivots for animation, and the runtime fields it sets today (`c.hover`, `c.head`, `c.visor`, `c.lens`, `c.gobletArm`, `c.goblet`, `c.onDeath`, `c.deathStep`).
2. Faction kits: replace the shared helpers with per-faction part libraries so bosses of one faction share a visual language but not a body (Fallen: four-arm and ether tanks; Hive: chitin, ribs, ritual blades; Cabal: heavy plate and thrusters; Vex: milk-white and gold geometry, floating; Taken: black-gold bodies with void tendrils; Scorn: stitched, corroded, scavenged).
3. **Aurix gets a full new pass** (Bryce: "he looks bad"). Today he is a flat hexagonal head plate (black, bronze inner plate, white edge ring) around one red eye, with no body to speak of. New design: a Taken Vex-Mind silhouette with a real mass, void tendrils, and a clearly readable eye, still ~5 m tall, hovering, with the eye as the only precision region. His rebuild lives in `buildTakenMind()` in `models-taken.js`, so that file is touched too, and the 3 damage-gate segments and exotic scripts stay as they are. A preview sheet for Aurix alone goes to Bryce first, before the other 24.
4. Keep it low-poly and cheap: merge-friendly (few materials, rigid parts), no more meshes than the old model by more than 25%.
5. `tools/tests.js` coverage for every builder (see test plan). `tools/unitshot.sh` before/after sheets.

## Boss list and what must carry over
Build values are `c.height` from `bosses.js`; runtime scale / radius are the campaign default (2.6 / 1.17) unless noted. "Crit" is the current precision region, to be re-verified with `unitshot.sh ... 1` (magenta crit tint) on the old model before it is replaced.

| Model | Faction | Where | c.height | Scale / radius | Crit to keep | Script hooks |
|---|---|---|---|---|---|---|
| takenMind (Aurix, Hollowed Mind) | Taken | exotic mission The Whisper (`exotic-rules.js:24`, 3 damage-gate segments) | 5 | boss default 2.6 / 1.17 (not overridden; unverified how it reads at 13 m) | the `eye` subtree (red orb plus white ring, `models-taken.js:486+`, found by `getObjectByName('eye')`) | hover; `c.muzzle` at (0, 3.2, 1.4); built in `buildTakenMind()` in `models-taken.js`, baked into the kit by the wrapper at `bosses.js:138` |
| servitor | Fallen | e2 Sepiks Prime | 2.1 | 2.6 / 1.17 | eye (accent sphere, ~`bosses.js:170`) | hover (floats) |
| archon | Fallen | e1 Riksis, e_patrol | 2.6 | 2.6 / 1.17 | head | none |
| kell | Fallen | e3 Draksis | 2.3 | 2.6 / 1.17 | head | none |
| baron | Scorn (per `factions.js:253`) | ts1 Araskes, ts_patrol | 2.1 | 2.6 / 1.17 | head | none |
| mindbender | Scorn | ts2 | 2.2 | 2.6 / 1.17 | head | none |
| fanatic | Scorn | ts3 | 2.3 | 2.6 / 1.17 | head | none |
| knight | Hive | m1 Sardok, m_patrol | 2.2 | 2.6 / 1.17 | head | none |
| swordbearer | Hive | t1 Kathok | 2.3 | 2.6 / 1.17 | head | sword arm (blade tip as melee reach) |
| crota | Hive | m3 Crota | 3.0 | 2.6 / 1.17 | head | none |
| wizard | Hive | m2 Omnigul | 2.2 | 2.6 / 1.17 | head gem (`:472`) | none |
| broodwizard | Hive | t2 Ir Halak, i_patrol, t_patrol | 2.15 | 2.6 / 1.17 | head gem (`:514`) | none |
| shrieker | Hive | t3 Sedrak | 2.6 | 2.6 / 1.17 | head and core (`:554`) | hover |
| valus | Cabal | r1, r_patrol | 2.45 | 2.6 / 1.17 | head | none |
| bracus | Cabal | r2 | 2.4 | 2.6 / 1.17 | head | none |
| ghaul | Cabal | r3 Dominus Ghaul | 2.9 | 2.6 / 1.17 | head | none |
| psionflayer | Cabal (Psion) | io2 | 2.2 | 2.6 / 1.17 | head (`:736`) | pieces scaled in a loop (`:726`) |
| takencaptain | Taken | io1 Malok-Ra | 2.4 | 2.6 / 1.17 | head | none |
| vexmind | Vex | io3 Protheon | 2.6 | 2.6 / 1.17 | red core (`:772`) | hover |
| takenchampion | Taken | dc1, dc_patrol | 2.5 | 2.6 / 1.17 | head | none |
| morgeth | Taken | dc2 | 3.4 | 2.6 / 1.17 | head | none |
| veshra | Taken | dc3 Riven's Brood | 1.6 | 2.6 / 1.17 | head / eye | none |
| calus (old) | Cabal | **no data row uses it** (grep) | 3.1 | n/a | head | `c.onDeath`, `c.deathStep` (`:1059,1068`) |
| anointedBather | Cabal (Loyalist) | dungeon Vhorrak | 4.6 | 0.8 / 1.1 | helm (`:1230` region) | dungeon `melee: true` |
| huntmaster | Cabal (Loyalist) | dungeon Kathrax | 4.3 | 0.75 / 1.0 | helm and harpoon eye | harpoon cannon at `c.muzzle` |
| emperorCalus | Cabal (Loyalist) | l1 campaign and dungeon | 4.6 | 0.8 / 1.4 | whole head (skull, jowls, chins, brow gem) | `c.head`, `c.gobletArm`, `c.goblet` (Feast orbs leave the bowl at `c.muzzle`) |

Faction count: Fallen 3, Scorn 3, Hive 6, Cabal 8 (counting old `calus`), Taken 5 (with Aurix), Vex 1 = 26 entries, 25 live.

**Questions for Bryce before build** (defaults in brackets):
- The old `calus` builder is not referenced by any mission or dungeon; H32 moved the campaign to `emperorCalus`. [Retire it and redo the other 24, or redo it as a plain Cabal throne-room Calus variant? Default: delete it and say so in the release notes.]
- `baron` (Araskes) sits in a Scorn mission per `factions.js:253` but the model is a Fallen Baron. [Make it a Scorn Baron.]

## Exclusions
`blightEdge` (a weapon model, not a boss). No stat, HP, damage, phase, arena, AI, loot or music changes. No new fight mechanics. Enemy (non-boss) models, Guardian models and weapon models are untouched. No save changes. No new textures or assets: geometry only.

## Dependencies
H32 merged to `main` (it edits `bosses.js` and `enemies.js:255`). Faction palettes come from `factions.js` `enemyColors`; bosses with a model keep returning the raw palette (`factions.js:42`), so no palette work is needed.

## Risks
- **Hit-box drift** (a taller head or wider shoulders changes how shots land and how the capsule feels). Mitigation: the bounds test below and keeping crit regions at the old height.
- **Crit area balance**: a bigger weak point makes bosses die faster. Cap the crit volume at the old value (+10%) and test it.
- **Death and Feast scripts** depend on named parts (`c.onDeath`, `c.deathStep`, `c.gobletArm`, `c.goblet`); rebuilding Calus must keep them or the Feast and death break silently.
- **Merge and perf**: more materials or non-merging parts raise draw calls on boss arenas. Budget: draw calls per boss no more than +25% (`tools/perfbench.js`).
- Faction differentiation is a taste call. Mitigate with one preview sheet per faction (A/B), approved by Bryce before the whole set is finished.
- Scope is large (25 models). Build in four chunks by faction (Fallen + Scorn, Hive, Cabal, Taken + Vex); each chunk is committed on green tests.

## Test plan
1. `tools/tests.js`: for each of the builders, build it and assert `c.torso` set, at least one crit mesh, height within 5% of the baseline recorded now, XZ bounds within the old extent +10%, crit bounding volume within +10%, total mesh count within +25%, and the script-hook fields (`hover`, `head`, `goblet`, `onDeath`, ...) present exactly where the table says. Record baselines from the old models in step 0 before any edit.
2. `sh tools/run_tests.sh` passes.
3. `sh tools/unitshot.sh` sheets: before/after of all bosses, normal and `crit=1`, one sheet per faction; checked visually.
4. `sh tools/playcheck.sh <location> <missions> [tier]` with the meta loadout on every boss-bearing mission (e1-e3, m1-m3, r1-r3, io1-io3, t1-t3, ts1-ts3, dc1-dc3, l1) with no console errors and boss clear times within the normal spread of the pre-change run (compare, do not treat as absolute).
5. Preview browser: the three dungeon bosses and Calus (Feast, death) by eye, since the bot does not use abilities. Dungeon and exotic runs only as far as the playcheck can reach; say plainly what was not checked.
6. `tools/perfbench.js` on one large arena before and after.

## Acceptance criteria
- All 25 live builders replaced, Aurix included (and `calus` removed with Bryce's approval), each visibly distinct from every other boss and clearly of its faction on a `unitshot` sheet.
- Every test above passes; Aurix's `eye` is still the only crit region and his hover and segment gates work in the Whisper; no new console errors in the playcheck.
- Boss height, radius, `scale`, HP and fight scripts unchanged; crit hits still register on the same region (verified by test and one manual shot per faction).
- Calus Feast and death sequences still run; hover bosses still hover.
- Release follows the checklist in `docs/OVERHAUL_ROADMAP.md`: Update Log and in-game Roadmap, new title artwork (major update), docs by `docs-keeper`, `release.sh prep 5.4` and `ship 5.4`.
