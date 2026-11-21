# U34 "Indoor Arrivals" (v5.9): Gate B proposal

Status: waiting on Bryce's approval. Nothing is built.

## Objective
U32 put dropships in the open. Ships need 18 m of open sky (`skyClear`, `DROP.clearHeight`), so in interiors, tunnels and arena rooms enemies still just appear. U34 gives every faction an indoor arrival that fits the room, so every fight has an entrance. It is the one teaser on the in-game Roadmap ("Indoor Arrivals").

## Scope
1. **Indoor arrival kinds**, picked per drop point when `skyClear` fails (extend `js/dropship-plan.js`, pure logic, unit-tested):
   - Cabal: drop pod slams through the floor line from a ceiling hatch or a boarding tube. Small thruster flare, dust ring.
   - Fallen: skiff-borne scrappers swap for a ceiling vent or wall breach: units drop in on cables or kick the grate out.
   - Hive: Thrall and Acolytes crawl out of a wall crack, Ogres burst through a door. A short Hive-green seep before they emerge.
   - Vex, Taken and Scorn keep their existing mist gates (they already work indoors).
2. **Spawn anchors**: levels mark optional `arrivalPoints` (vent, hatch, breach positions). If a room has none, the system picks a point from existing spawn positions along a wall. Data-driven, so new maps need no code.
3. **Telegraph**: 1.5 s audio and visual cue before units appear, using existing effects and audio (no new music or voice). Units are never placed inside player collision.
4. **Models**: `js/dropship-models.js` gets pod, vent and breach props (low-poly, same style as the three ships).
5. Existing "Dropship entrances" setting also controls indoor arrivals. Co-op: the host decides the kind, clients replay it (same pattern as `showRemoteShip`).

## Exclusions
No new enemies, missions, weapons or balance changes. No outdoor ship changes. No save changes. No new voice or music.

## Dependencies
U32 modules (`dropship-plan.js`, `dropship-models.js`, `dropships.js`). Needs a quick pass over which existing levels have indoor combat zones (Tower is excluded: no combat; likely Leviathan, Tangled Shore interiors, dungeons, Whisper).

## Risks
- Units stuck in geometry: mitigate by validating each arrival point against colliders and falling back to the old spawn.
- Dungeon and raid timing: arrivals must not delay encounters or boss DPS gates (`docs/ENDGAME_RULES.md`). Keep total arrival under 2.5 s and never apply it to boss or mechanic adds.
- Co-op desync: test with two `?localtest` tabs.

## Test plan
- Unit tests: arrival-kind choice (open sky vs indoor), point validation, timing caps, faction table.
- `sh tools/run_tests.sh` all pass. `sh tools/playcheck.sh` on at least one indoor mission per touched location (meta loadout), no console errors.
- Preview browser screenshots of each of the three indoor arrivals.
- Co-op check offered at the end of the session.

## Acceptance criteria
- In a room with no open sky, Cabal, Fallen and Hive waves each arrive with their own visible entrance, never inside walls.
- No outdoor behavior change. Setting off restores the old behavior.
- Playchecks clear every zone with no new errors. Roadmap teaser removed on release.

## Size
One build session, about one major update (v5.9).
