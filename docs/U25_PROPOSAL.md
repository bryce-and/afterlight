# U25 v4.9 "Crucible": approved scope and build contract

Gate B approved by Bryce on 2026-11-16 with these answers: 6v6 Control, 1v1 Duel, real PvP between players is the goal, one map (Bannerfall). Branch: `update/25-crucible`. Built in two chunks (A, B), released once as v4.9 after B. Title artwork only in chunk B. Tracker: O2 (maps, one of 3 to 5 for now), O3 (Control and Duel), O4 (AI Guardians).

References (gitignored, this machine only): `docs/reference/bannerfall/` (callout map, Courtyard wall, Market alley, Depot street).

## Rules (Bryce, 2026-11-16)
- **Player vs player damage exists only in Crucible.** One switch decides it: the activity's `pvp: true` flag. Everything else (campaign, strikes, Blitz, dungeons, co-op) can never hurt a teammate. A later Gambit or campaign invasion mode would set the same flag; not built now.
- **PvP numbers are fully separate from PvE.** PvE numbers do not change. Time to kill is the main target; primaries land close together.
- Light off: health 100 plus the existing `shieldMax(resilience)`. No `weaponTierMult`, no Light, no `playerDmgMult`. Exotics use their frame's PvP numbers.
- One-hit rules: sniper on a headshot only; shotgun inside a set range; fusion only with the full volley inside a set range. Abilities and supers have their own PvP numbers (a throwing knife precision hit still one-shots).
- Spawn ammo, always the start amount (anything above it is lost on death): sniper, fusion, shotgun, grenade launcher 2; trace rifle 40; glaive 2; special sidearm 6; Forerunner 6. Heavy (swords included) always starts empty. Heavy crates on a timer give 25% of the magazine, rounded up, at least 1 (a sword pickup is about 10 swings). Small special ammo crates around the map. `AMMO_METER` off.
- AI Guardians use the same PvP numbers and ammo rules as players, and are deliberately "not too strong" (reaction delay, aim error, headshot cap, all data).

## Modes
- **Control, 6v6.** Three capture zones (A, B, C). A kill scores points; the more zones your team holds, the more each kill is worth (default 1 point plus 1 per zone held; numbers in data). First to the score limit, or the higher score when the timer ends. Humans fill teams first, AI Guardians fill the rest.
- **Duel, 1v1.** Rounds, no special ammo crates, no supers, first to 5 rounds. Human vs human, or human vs AI Guardian.

## Map: Bannerfall (The Last City, Earth)
Our own low-poly layout following the callout map: mirrored west (Market) and east (Depot) halves around a central Plaza with the dead tree stump (Stump) on the south edge. Zones: **A Assembly Hall** (west), **B Courtyard** (north centre, under the big buttressed wall with the vertical patterned pillars), **C Depot Bay** (east). Callouts to build: Market, Top Market, Market Balcony, Depot, Top Depot, Depot Balcony, Passage (north), Plaza, Stump. Initial spawns west by Market and east by Depot. Look: sun-bleached cream plaster and concrete, arched doorways, red City banners and awnings, overhead cables, moss and grass, green-trimmed crates. Sized for 6v6 at our movement speed (scale lanes to sprint time, not to Destiny's metres). Heavy crate spot at Plaza; special crate spots in each half.

## Networking
- Crucible lobbies take up to 12 players (`MAX_CRUCIBLE`); the PvE fireteam cap stays 3.
- A `pvphit` message: the shooter's client resolves the hit (the same trust model as the existing `hit`), the host relays it to the victim, who applies damage and reports a kill. The host owns AI Guardians, zone capture, score, spawns and the timer. Same star topology over PeerJS.

## Exclusions
Other maps, Crucible-exclusive loot, ranks (Glory, Valor), Trials, Iron Banner, other modes, matchmaking with strangers (room code only), per-exotic PvP tuning, any PvE balance change, Gambit or invasions. No save change. Reward per match completed: XP and one legendary from the normal pool.

## Chunks
- **A:** `js/pvp.js` (pure rules: PvP damage per frame, one-hit rules, ability and super PvP numbers, TTK, ammo rules, Control scoring), the PvP lookup in `dealDamage`, `damagePlayer` and the ability damage sites behind `pvp: true`, AI Guardians (`js/guardian-ai.js` on `buildCharacter`), Control 6v6 vs AI on Bannerfall (`js/level-bannerfall.js`), ammo crates, the Crucible Ops node, match HUD (score, zones, timer, kill feed) and end screen.
- **B:** networked PvP (`pvphit`, 12-player Crucible lobby, team pick, host-synced score, zones, spawns and timer), Duel, title artwork, docs ready for release.

## Risks
- Client-resolved hits: lag can show as hits around corners. Acceptable for friends; flagged, not solved.
- 12 player bodies plus a full map: frame-rate check at 6v6.
- A 12-peer star: the host relays every player's 20 Hz state; measure bandwidth with 4+ tabs.
- Ability numbers are inline in `js/abilities.js` and `js/darkness.js`; each damage site needs the PvP hook.

## Test plan
- Unit tests: primaries' optimal-range TTK within a set band; each one-hit rule only inside its constraint; spawn ammo, loss above the start amount, heavy rounding; Control kill points by zones held; **PvE damage for sample weapons and abilities identical to before**; no player damage when `pvp` is false.
- Headless: an AI vs AI Control match on Bannerfall finishes, no console errors, both teams score.
- Preview browser: Ops node, match HUD, end screen, and the map at 1280x720 and phone width.
- Co-op: two `?localtest` tabs on opposite teams (Control and Duel): hits, kills, score and zones agree on both screens; then one tab per team plus AI fill.

## Acceptance
Control (6v6) and Duel launch from the Crucible node solo and with friends and finish with a winner; players on opposite teams can kill each other only in Crucible; all tests pass; PvE numbers unchanged; AI Guardians fight, capture and use abilities without dominating a meta-loadout player (Bryce's call on feel).

## Chunk A status note (branch `update/25-crucible`)

Built: `js/pvp.js` (rules, TTK/one-hit/ammo/Control scoring, gamer-tag generator), PvP hooks in `dealDamage` / `explode` / `damagePlayer` / player hit and death (all behind `mission.pvp`), `js/guardian-ai.js`, `js/crucible.js`, `js/crucible-hud.js`, `js/level-bannerfall.js`, Crucible Ops node.
Evidence: `sh tools/run_tests.sh` 413 passed, 0 failed (includes PvE golden numbers and a source guard on the untouched PvE `dealDamage` lines). `sh tools/playcheck.sh earth 0` no errors. A spectate AI-vs-AI Control match in the preview ran to the score limit (101 to 57 in 275 s), no errors, about 0.7 ms per step, 235 colliders. Screenshots of the map overview and match HUD taken at 1280x720.
Changes from feedback: AI names are randomly generated gamer tags (no NPC names); Bannerfall was re-cut into walled courts, roofed passages, a kiosk, terrace, pergola and pens (Tower-like) and the AI paths around them.
Notes and gaps:
- Headless stepping must call `G.scene.updateMatrixWorld()` every step (hit boxes are read from world matrices). Do this in the chunk B check script.
- Not verified: render frame rate at 6v6, phone-width screenshots, Ops node and end-screen screenshots at the final map, crate pickups in play, no `tools/cruciblecheck` script yet.
- Ability and super PvP numbers: fallback table by source; only knife, golden gun and rocket are keyed; most ability sites carry no `kind` tag.
- `enemiesNear` chain perks do not chain to guardians.
- Special-slot default ammo is 6 and a sword crate gives 10 (my choices).
- AI guardians do not jump, have no class abilities or super, and keep one weapon (primary plus optional special).
- Fireteam Crucible is disabled until chunk B. Aim error was lowered to 0.02 rad and AI now paths in to trading range.

## Chunk B prompt
Afterlight U25 "Crucible" chunk B on `update/25-crucible`. Read `docs/U25_PROPOSAL.md` (incl. the chunk A note). Build: networked PvP (`pvphit` messages), 12-player lobby with team pick, host-synced score, zones, spawns and timer, Duel mode, AI jump and weapon swaps if cheap, a `tools/cruciblecheck` headless script, title artwork, release docs via the usual process.
