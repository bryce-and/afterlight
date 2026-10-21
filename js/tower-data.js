// U16: where things stand in the Tower (pure data, so tools/tests.js can check it; the map itself is js/level-tower.js).
// world metres. yaw 0 faces -z; forward = (-sin yaw, -cos yaw). NPC post ring tops are at y = 0.3; dummy ring tops at y = 0.25.
export const TOWER_SPOTS = {
  zavala: { x: -23, z: -41.5, yaw: Math.PI },
  cayde: { x: -17, z: -42.5, yaw: Math.PI },
  ikora: { x: -11, z: -41.5, yaw: Math.PI },
  kadi: { x: 8, z: -14.6, yaw: Math.PI },
  questKiosk: { x: -22, z: -29.5, yaw: Math.PI },
  exoticKiosk: { x: -12, z: -29.5, yaw: Math.PI },
  launchPad: { x: 40, z: 10, yaw: 0, r: 2.5 },
  rangeGate: { x: 0, z: 28.4, w: 11, d: 3 },
  rangeBox: { minX: -8.4, maxX: 8.4, minZ: 26.8, maxZ: 77.4 },
  rangeFirePoint: { x: 0, z: 32, yaw: Math.PI },
  rangeDummies: [{ x: -4.5, z: 40 }, { x: 3.5, z: 46 }, { x: -2.5, z: 52 }, { x: 4.5, z: 58 }, { x: -4, z: 64 }, { x: 2.5, z: 70 }],
  rangeBoss: { x: 0, z: 72 },
  talkRadius: 3.2,
};
