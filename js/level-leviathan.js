// Hand-built Leviathan finale map (see makeKit in world.js). Placeholder until the real map lands.
export default {
  lev1: {
    spawn: [0, 70],
    bounds: [-60, 60, -250, 90],
    zones: ['Docking Bay', 'The Pleasure Gardens', 'The Royal Pools', 'The Gauntlet', 'The Throne Room'].map((n, i) => ({ name: n, x: 0, z: 30 - i * 55, boss: i === 4 })),
    build(K) { K.light(0, 6, 60, K.C.accent, 6, 30); },
  },
};
