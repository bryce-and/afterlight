# Decision Log

| Date | Decision | By |
|---|---|---|
| 2026-10-13 | `Afterlight Update V3` is the overhaul spec (the master prompt's "Overhaul V2" refers to it). | Bryce |
| 2026-10-13 | Pushing to `main` (live on GitHub Pages) is the release flow. No beta channel for now; revisit around U5. | Bryce |
| 2026-10-13 | Overhaul is a new experience: every player is fully reset at U1 (gear, vault, glimmer, progress, subclasses). The old save is kept in `afterlight_backup_v1`; settings carry over. | Bryce |
| 2026-10-13 | Versioning: live game tagged `v1.0` as the baseline; each update bumps the minor version (U1 = `v1.1`). | Bryce |
| 2026-10-13 | Keep Destiny names (exotics, bosses, Calus, the Leviathan, places). | Bryce |
| 2026-10-13 | Unit tests run in the browser (`tools/tests.html`); no Node install. | Bryce |
| 2026-10-13 | Guardian level is account-wide, shared by all three classes (matching the shared inventory). | Claude (U1) |
| 2026-10-13 | Reward-track items are claimed manually on the Level tab, so a full inventory never destroys a reward. The level 10 subclass unlocks automatically. | Claude (U1) |
| 2026-10-13 | Kill XP is shared by the whole fireteam; mission and cache XP go to whoever opens the cache. | Claude (U1) |
| 2026-10-13 | Mission recommended Light = 10 × mission number (10 to 180) under the base cap of 200. | Claude (U1) |
| 2026-10-13 | Public update names: v1.0 "Kindling" (the pre-overhaul baseline), v1.1 "First Light". | Claude (U1) |
| 2026-10-13 | U2 public name: "Clear Sight". | Bryce |
| 2026-10-13 | Primaries were weak because weapon damage never scaled with mission tier while enemy health grows 10% per tier. Weapons (and their perks) now scale at 75% of that pace, plus +10% for primaries; ability power 1.4 to 1.3. Enemy health unchanged. | Bryce (U2) |
| 2026-10-13 | Enemy debuffs (weaken, slow, suppress, burn, poison) stay on their own fields in U2 and move to the status registry in U3. | Bryce (U2) |
| 2026-10-13 | Status effects are runtime only (no save change). Weapon effects are scoped to the weapon slot and cleared when that slot's weapon is swapped. A re-applied effect keeps the longer timer unless the caller sets it. | Claude (U2) |
| 2026-10-13 | Stagger is decided by the enemy's owner (host), never applies to bosses, and has a cooldown so it can't chain. Fireteam members see the enemy stop but not the tilt. | Claude (U2) |
