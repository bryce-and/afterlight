# U30 Boon Drops: Gate B proposal

**Approved by Bryce 2026-11-20 "as written".** Defaults taken for the open questions: (1) co-op uses personal orbs plus stasis; (2) keep the 2 to 5 range as written, and the build session reports the boon count per run from the playcheck and flags it if runs trivialise, rather than adding rarity unasked; (3) orbs persist until picked up or the run ends. Build session: confirm the U30 number and version before stamping.

Requested by Bryce 2026-11-20. Not on the roadmap table yet (confirm the number and version; the last proposal on file is U29). Branch `update/30-boon-drops` from `main`. Roguelike modes only (`horde_rogue`, `endless_rogue`).

## Objective
Replace the "pick a boon after each wave" phase with Risk of Rain style drops: killing enemies leaves boon orbs on the ground, 2 to 5 per round. Walking up and interacting opens the choice menu, which pauses the game. No boon is granted for clearing a wave. Works in co-op.

## What exists today (from scout reads, not re-audited)
- Boon rules `js/boons.js` (`BOONS` 25 entries, `rollOffer(s)` :124-148, `boonDue` :161, `BOON_EVERY` 1). Wiring `js/boon-run.js`. Pick overlay `openBoonMenu` `js/rewards-ui.js:188`.
- Boons are granted in `activityWaveCleared` -> `beginBoonPick` (`js/game.js:1484-1514`), with a dedicated `M.phase = 'boon'` that holds the wave timer (:1464).
- Kill path `killEnemy` `js/game.js:960` -> `rollDrops` :988 -> `spawnPickup` :1222 (local `G.pickups`, magnet/collect in `updatePickups` :1240). Interact key E, prompt via `ui.prompt`.
- Solo pause = `G.state = 'paused'`. Co-op pause does NOT freeze the world (`G.mpMenu`, `js/ui.js:1888-1890`).
- Co-op: PeerJS star topology, host runs the sim. Kill loot is rolled locally on every machine from the host's `kill` message (`js/coop.js:612-622`). Boon menu is opened by `bnst`/`bnend`; members send `bnok`; host only records it.

## Design
**Drop budget.** At wave start the host rolls N = 2 to 5 (scaled by enemy count of the wave) and flags that many spawns `e.dropBoon`, weighted toward elites and minibosses. A guaranteed budget avoids dry streaks and floods. Orbs on the ground persist until picked up or the run ends; wave clear no longer waits on picks.

**Orb + menu.** New `boon-orb` pickup (glowing, visible from range, beam like a cache). Within range: `[E] Open Boon`. Opening rolls 3 options (existing `rollOffer`, includes the 25% weapon swap) and opens the existing overlay. Esc cancels and the orb stays. Remove `M.phase = 'boon'`, `boonDue` and the pick timer for wave flow (keep a short idle timeout only in co-op, below).

**Solo pause.** Opening the menu sets `G.state = 'paused'` (same as the pause screen). Enemies, wave timer and cooldowns freeze.

**Co-op (recommended: personal orbs + personal stasis).**
1. Host sets `bd:1` and a drop id on the `kill` message. Every machine spawns its own local orb for itself, the same way kill loot already works. No new pickup sync, no stealing, every player gets the full 2 to 5.
2. Offers are rolled from a seed (drop id + player index), so a reconnect or reopen shows the same three choices.
3. Because co-op cannot freeze the shared sim, the opener enters stasis: invulnerable, untargetable, input locked, world keeps running, 12 s idle timeout that auto-picks (or closes and keeps the orb, to decide). Teammates see a "choosing boon" marker over them. Downed players cannot open orbs.
4. Pick sends `bnok {id, choice}`; host tallies it (extends the existing handler). Remove `bnst`/`bnend`.
Alternative: a true global freeze while anyone chooses. Rejected as default: one slow teammate stalls the whole party and the host sim would need a new pause/resume message through PeerJS.

## Scope
Orb pickup type, drop budgeting, menu open-on-interact, stasis, co-op message changes, removal of the wave-end boon phase, tests, `?localtest` two-tab check.

## Exclusions
New boons, boon rebalance, Crucible, campaign/other activities, save format (boons remain run-only).

## Dependencies and risks
- **Power budget (needs a decision).** Today 30 waves gives ~30 boons. At 2 to 5 per wave you get roughly 105. Many boons stack (`boonTotals`), so this is a large power jump. That helps with "too hard" but may trivialise runs. Options: keep stacking caps in `BOON_CONST`, add rarity so most orbs are minor, or shrink the range. The `HORDE_SCALE`/`ENDLESS_SCALE` knobs (`js/boons.js:175-190`) can offset it. Needs playcheck at Legendary.
- On-kill boons (`onKillBoons`, `js/boon-run.js:142`) run in `Player.onKill`; unverified whether members get `onKill` for host-decided kills. Check before relying on them in co-op.
- Real WebRTC across machines and 3+ player lobbies were never verified (`docs/U25_PROPOSAL.md:76`); only `?localtest`.
- Orbs left behind when a player is mid-fight: they persist, so nothing is lost, but sealed arenas (`sealArena`) must not trap an orb out of reach.

## Test plan
`sh tools/run_tests.sh` with new unit tests (budget is 2 to 5 and sums correctly, no grant on wave clear, seeded offers deterministic, orb persists across waves, stasis blocks damage). `sh tools/playcheck.sh` on both roguelike modes with a meta loadout. Preview browser: orb visuals and the menu. Two `?localtest` tabs: both see their own orbs, one opens while the other fights, both picks tallied.

## Acceptance criteria
No boon on wave clear; 2 to 5 orbs per round; menu pauses solo; in co-op the opener cannot be hurt while choosing and the other player is unaffected; no console errors; all tests pass.

## Open questions for Bryce
1. Co-op: personal stasis (recommended) or global freeze?
2. Power cap: keep ~105 boons per 30 waves, or lower the range / add rarity?
3. Orbs: persist forever, or expire after a few waves?
