# Afterlight: working rules

Low-poly Destiny-inspired browser FPS. Three.js 0.160, plain ES modules, no build step. Run: `python3 -m http.server 8123` (launch config `afterlight`).
Overhaul spec: "Afterlight Update V3". The plan, status and decisions live in `docs/`. Read those instead of re-auditing the code.

## Process (every update)
1. **Propose before building.** Give a Gate B proposal: objective, scope, exclusions, dependencies, risks, test plan, acceptance criteria. Then stop until Bryce explicitly approves *that* update. Approving the roadmap or an earlier update is not approval.
2. **Build only the approved scope** on `update/<n>-<slug>`. Pause and ask before any major replacement, destructive save change, or scope change.
3. **Verify for real:** `tools/tests.html` passes, the game runs in the preview browser with no console errors, touched screens and a mission are checked. Never call something tested, done or published without evidence; say plainly what wasn't checked.
4. **Release:** follow the release checklist in `docs/OVERHAUL_ROADMAP.md`. That includes updating the in-game Update Log and Roadmap (`js/releases.js`), the docs, `tools/stamp_version.py`, merging to `main` (pushing to main is the release, live on GitHub Pages), tagging `vX.Y` and creating a GitHub release. Verify the push and the Pages build.
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

## Rules
- Reproduce suspected bugs before fixing them. Don't invent test results.
- Prefer data-driven, reusable systems: new weapons, enemies, abilities and missions should plug into shared systems.
- Never force-push, overwrite Bryce's uncommitted work, or expose secrets.
- The in-game Roadmap is curated and undated; never copy the internal plan into it.
- Keep Destiny names. Versions: v1.0 baseline, +0.1 per update.
