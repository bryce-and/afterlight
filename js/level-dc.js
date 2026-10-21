// Hand-built Dreaming City mission maps (see makeKit in world.js). Placeholder open-field maps until the real ones land.
const open = (name, zoneNames) => ({
  spawn: [0, 70],
  bounds: [-60, 60, -150, 90],
  zones: zoneNames.map((n, i) => ({ name: n, x: 0, z: 30 - i * 55, boss: i === zoneNames.length - 1 })),
  build(K) { K.light(0, 6, 60, K.C.accent, 6, 30); },
});
export default {
  dc1: open('dc1', ['Divalian Mists', 'Rheasilvia', 'The Strand', 'Gate of the Mists']),
  dc2: open('dc2', ['The Strand', 'Gardens of Esila', 'Spine of Keres', 'Oracle Temple']),
  dc3: open('dc3', ['Harbinger\'s Seclude', 'Gardens of Esila', 'Blight Hollow', 'The Wishing Chamber']),
};
