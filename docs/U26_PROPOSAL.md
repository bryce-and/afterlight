# U26 Mobile: Gate B proposal (target: v5.2)

Requested by Bryce 2026-11-17: works when installed as a web app (Add to Home Screen) on iPhone, optimized for iPhone 18 Pro. Desktop stays exactly as it is.

## Objective
Make Afterlight fully playable on a phone: touch controls, a phone HUD and menus, and a "Mobile mode" (calmer AI strafing, bigger enemy hitboxes). The installed PWA must launch standalone, landscape, full screen, and run without Safari chrome.

## What the code has today (verified by grep)
- Input is keyboard, mouse and Pointer Lock only (`js/main.js:58-115`, `js/state.js:20`). iOS has no Pointer Lock and no `mousemove` look, so the game currently cannot be played on a phone.
- Gameplay reads canonical `G.input.keys.*` / `inp.mouse.*` (`js/keybinds.js`), so touch can plug in as another source with no gameplay changes.
- PWA basics exist: `manifest.webmanifest` (standalone), `sw.js` (network first), `apple-touch-icon`. Missing: `viewport-fit=cover`, `apple-mobile-web-app-*` meta, manifest `orientation`, safe-area CSS, install hint.
- Enemy strafing lives in `js/enemies.js` (about lines 207, 367-413); hit radii are per enemy type.

## Scope
1. **Mobile detect** (`js/mobile.js`, pure + small DOM glue): `isMobile()` = touch primary (`pointer: coarse`) or `?mobile` override for desktop testing. Everything below is gated on it; desktop code paths untouched.
2. **Touch controls** (`js/touch-controls.js`): left floating stick = move; right-screen drag = look (own sensitivity slider, feeds `inp.mouse.dx/dy`); buttons: fire, aim (hold or toggle), jump, crouch/slide, reload, melee, grenade, class ability, super, weapon swap, interact, pause, inventory. Multi-touch, `touch-action: none`, no text selection, no long-press callout, no pinch zoom, no double-tap zoom. Buttons are layout-editable (move/resize, saved in settings). Optional aim assist: slight slowdown over enemies.
3. **iPhone 18 Pro layout**: landscape only; `env(safe-area-inset-*)` on HUD, controls and menus so the Dynamic Island and home indicator never cover anything; thumb-reach button zones; HUD scaled up (min 44 pt tap targets); menus (Director, inventory, vendors, pause, boons, loadout) get a phone layout. Exact screen size and refresh rate of the 18 Pro are not in this repo and I cannot verify them: I'll build to safe-area insets and a 19.5:9 class viewport rather than hard-coded numbers, and ask you to confirm on the real device.
4. **Installed web app**: viewport `viewport-fit=cover, user-scalable=no`; `apple-mobile-web-app-capable`, `-status-bar-style` black-translucent, title; manifest `orientation: landscape`, `display: standalone`; first-run "Add to Home Screen" hint on iOS Safari (not shown when already standalone); rotate-to-landscape overlay in portrait; audio unlock on first tap; wake lock to keep the screen on while playing; pause on `visibilitychange` (app switch / lock); service worker cache bump so installed copies update.
5. **Mobile mode** (setting, default on for phones): enemy strafe speed x0.6 and longer strafe interval, enemy hit radius x1.35 (head and body), no change in damage numbers. Crucible rivals get the same calming. Implemented as a data table (`MOBILE_TUNING`) read by `enemies.js`, so desktop reads identity values.
6. **Performance**: phone render budget (lower pixel ratio cap 2.0, shadows off or cheaper, fewer particles) behind the same gate; `?perf` readout used to check.

## Exclusions
No gamepad support, no gyro aiming, no desktop HUD/menu/AI/hitbox changes, no native app, no new content, no co-op protocol change (a phone joins the same lobbies). Android is not targeted but should work as a side effect; untested.

## Dependencies and risks
- Depends on U2 (HUD/menus). Save change: one new settings block (touch layout, look sensitivity, mobile mode); old saves load with defaults. No reset.
- Risk: iOS Safari quirks (no Fullscreen API on iPhone, so standalone is the route), WebGL memory limits, audio unlock, 8 menus needing layout work. Biggest risk is performance on heavy levels; mitigated by item 6.
- Risk: I cannot test on a real iPhone from here. I can test in the preview browser with `?mobile` at an emulated phone viewport and touch events, and the iOS Simulator is available for Safari and installed-PWA-like checks, but home-screen install behavior and feel on the 18 Pro need you on the device.

## Test plan
- `sh tools/run_tests.sh` green, new unit tests for `mobile.js` (detect, tuning table, stick math, layout save/load, desktop identity values).
- `sh tools/playcheck.sh` on one campaign mission and one Crucible map with Mobile mode on and off (no console errors; compare clear times).
- Preview browser at iPhone-class landscape viewport: title, Director, inventory, pause, HUD, controls with synthetic touches; screenshots of each.
- iOS Simulator: load in Safari, Add to Home Screen, confirm standalone launch, safe areas, landscape lock, no browser chrome.
- Desktop regression: keyboard and mouse play unchanged, desktop screenshots identical.
- Not covered: real 18 Pro device feel, thermals, battery.

## Acceptance criteria
1. On a phone viewport a player can start, fight, use all abilities, open the inventory and finish a mission with touch only.
2. Installed from Home Screen: opens full screen, landscape, nothing under the Dynamic Island or home indicator, audio works after first tap, app switch pauses.
3. Mobile mode measurably calms AI (strafe) and widens hitboxes; off restores exact current values.
4. Desktop behavior and tests unchanged; no save reset.

## Suggested chunks (one build session)
A: `mobile.js`, meta/manifest/SW, safe-area CSS. B: touch controls and layout editor. C: phone menus and HUD. D: Mobile mode tuning and perf gate. E: tests and checks.
