// U31: weapon sights. Hand cannons, shotguns and sidearms roll a sight; every other weapon uses its iron sights (fusions included).
// A sight changes how fast you aim down (`ads`), a little of the zoom (`zoom`), and the reticle drawn while aimed (`ret`, styled in style.css).
export const SIGHTS = {
  iron: { id: 'iron', name: 'Iron Sights', desc: 'The weapon\'s own sights.', ads: 1, zoom: 1, ret: null },
  reddot: { id: 'reddot', name: 'Red Dot', desc: 'A small red dot. Aim down sights 20% faster.', ads: 1.2, zoom: 1, ret: 'reddot' },
  holo: { id: 'holo', name: 'Holographic Ring', desc: 'A ring and dot. A little more zoom.', ads: 1, zoom: 1.12, ret: 'holo' },
  reflex: { id: 'reflex', name: 'Micro Reflex', desc: 'A tiny bright chevron. Aim down sights 10% faster with a touch more zoom.', ads: 1.1, zoom: 1.06, ret: 'reflex' },
};
/** Families that roll a sight, and the sights each can roll (weights repeat an id). */
export const SIGHT_POOLS = {
  hand: ['iron', 'reddot', 'reddot', 'holo', 'reflex'],
  shotgun: ['iron', 'reddot', 'reddot', 'holo', 'reflex'],
  sidearm: ['iron', 'reddot', 'reddot', 'holo', 'reflex'],
  forerunner: ['reddot', 'holo'],
};
export const sightFor = (item) => SIGHTS[item?.sight] || SIGHTS.iron;
export const rollSight = (arch, rnd = Math.random) => { const p = SIGHT_POOLS[arch]; return p ? p[Math.floor(rnd() * p.length)] : 'iron'; };
