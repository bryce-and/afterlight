// Global mutable game state shared across modules.
export const G = {
  state: 'title', // title | classes | orbit | playing | paused | complete | failed
  save: null,
  time: 0,
  renderer: null, camera: null, scene: null, level: null, menu: null,
  nav: null, navBudget: 0,
  colliders: [], staticMeshes: [], hitTargets: [], hitDirty: true,
  enemies: [], projectiles: [], enemyShots: [], pickups: [], tickers: [],
  player: null, mission: null,
  input: {
    keys: {}, pressed: {},
    mouse: { left: false, right: false, leftPressed: false, rightPressed: false, dx: 0, dy: 0, wheel: 0 },
    locked: false, wasLocked: false,
  },
};

export function lockPointer() {
  const canvas = document.getElementById('game');
  if (document.pointerLockElement === canvas) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch((e) => console.warn('Pointer lock request failed:', e.message));
  } catch (e) {
    console.warn('Pointer lock request failed:', e.message);
  }
}

export function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}
