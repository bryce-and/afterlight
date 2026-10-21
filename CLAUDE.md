# Afterlight: working rules

Low-poly Destiny-inspired browser FPS. Three.js 0.160, plain ES modules, no build step. Run: `python3 -m http.server 8123` (launch config `afterlight`).
Overhaul specs: "Afterlight Update V3" and "V4". The plan, status and decisions live in `docs/`; use them instead of re-auditing the code. Read the table in `docs/OVERHAUL_ROADMAP.md` first. Grep `OVERHAUL_STATUS.md`, `DECISIONS.md` and `ARCHITECTURE.md` for the IDs and systems you need; don't read them whole. `docs/archive/` is history: open it only when asked.

## Process (every update)
0. **At session start, ask Bryce whether he's applying several updates this session.** If yes, chain them: make title-screen artwork only for the last one, and write any handoff prompt for the whole chain.
1. **Propose before building.** Give a Gate B proposal: objective, scope, exclusions, dependencies, risks, test plan, acceptance criteria. Then stop until Bryce explicitly approves *that* update. Approving the roadmap or an earlier update is not approval.
2. **Build only the approved scope** on `update/<n>-<slug>`. Pause and ask before any major replacement, destructive save change, or scope change.
3. **Verify for real:** `sh tools/run_tests.sh` passes (headless `tools/tests.html`), the game runs in the preview browser with no console errors, touched screens and a mission are checked. Never call something tested, done or published without evidence; say plainly what wasn't checked.
4. **Release:** follow the release checklist in `docs/OVERHAUL_ROADMAP.md`. That includes updating the in-game Update Log and Roadmap (`js/releases.js`) and the docs, then `sh tools/release.sh prep X.Y` and, after the commits, `sh tools/release.sh ship X.Y` (merge to `main`, push, which is the release on GitHub Pages, tag, GitHub release, Pages check). Before ending the session, ask Bryce whether he wants a co-op check (two `?localtest` tabs join and launch together). If a co-op check already ran this session (for example while testing or checking desync), don't run another. Run a full co-op QA only when Bryce asks; otherwise he reports co-op bugs himself.
5. **Report and stop:** end every update with the short report below, then wait for approval.

## End-of-update report (always include, keep it this short)
```
Afterlight vX.Y "<Name>" is live ([release](<GitHub release URL>); `<code commit>` code, `<docs commit>` docs).

* New modules / architecture: <what was added and what it enables next>. <Save changes, or "No save changes.">
* <Player-facing area>: <what changed, one line>
* Balance: <changes, if any>
* Fixes: <bugs fixed>
* Tests: <N of N unit tests pass>, <what was play-checked>. <What is untested.>
* Next: U<n> "<Name>", waiting on approval.
```
Use 4 to 7 bullets, one line each, plain language. Only claim what was verified.

## Keeping usage down
- Match the model to the job: Opus for Gate B proposals and hard multi-system bugs, Sonnet for building, Haiku agents for mechanical work (`scout` to find code, `docs-keeper` for release records).
- Read big files (`js/player.js`, `js/ui.js`, `js/game.js`) by grep plus line ranges, never whole.
- Verify with `tools/run_tests.sh`, console logs and `read_page`; take screenshots only for visual changes.
- Batch small fixes into one hotfix instead of a release each.

## Rules
- Reproduce suspected bugs before fixing them. Don't invent test results.
- Prefer data-driven, reusable systems: new weapons, enemies, abilities and missions should plug into shared systems.
- Never force-push, overwrite Bryce's uncommitted work, or expose secrets.
- The in-game Roadmap is curated and undated; never copy the internal plan into it.
- The title screen shows the current major update's name, "Version X.Y" and its own artwork; refresh them on every major update (U8, U9, ...). Hotfixes (H1, H2, vX.Y.Z) get no artwork and leave the title card alone; they only add an entry to the in-game Update Log.
- Specs: "Afterlight Update V3" plus "V4" (2026-10-14). Where they conflict, V4 wins (for example, armor mods replace armor perks).
- Keep Destiny names. Versions: v1.0 baseline, +0.1 per update.
