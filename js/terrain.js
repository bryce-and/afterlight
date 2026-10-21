// Terrain (U16e): a per-map ground height function built from plain-data features. No rendering dependency, so
// tools/tests.js can import it. A map with no `terrain` list stays flat (y = 0), exactly as before.
//
//   terrain: [
//     { type: 'plateau', x, z, w, d, h, ry, edge },                  // flat top at height h, skirt of `edge` m
//     { type: 'ramp', x0, z0, x1, z1, width, h0, h1, edge },        // a path that climbs h0 -> h1 along the segment
//     { type: 'mound', x, z, r, h },                                // smooth hill added on top of what is there
//     { type: 'basin', x, z, r, flat, depth, rim, rimW },           // bowl: flat floor of radius r*flat, walls out to r; optional raised rim
//   ]
//
// plateau and ramp REPLACE the ground inside them (later features win); mound and basin ADD to it.
// Every feature fades out smoothly over `edge` metres. Ground steeper than MAX_SLOPE is a wall to the player (a cliff): a ramp's centre
// line, and any slope meant to be walked, must stay under it (routeSlope checks a path; the tests check each map's routes).

/** tan of the steepest ground a Guardian walks up (about 29 degrees). Steeper ground is a wall to the player. */
export const MAX_SLOPE = 0.55;

const smooth = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

/** Distance outside an oriented rectangle (0 inside). Local frame follows ry like colliders.js. */
function rectOutside(f, x, z) {
  const c = Math.cos(f.ry || 0), s = Math.sin(f.ry || 0), dx = x - f.x, dz = z - f.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const ox = Math.max(0, Math.abs(lx) - f.w / 2), oz = Math.max(0, Math.abs(lz) - f.d / 2);
  return Math.hypot(ox, oz);
}

const FEATURES = {
  plateau(f, x, z, g) {
    const e = f.edge ?? 6; // the skirt: a short one is a cliff (steeper than MAX_SLOPE it is a wall), a long one (rise / 0.32 or more) is walkable
    const w = 1 - smooth(rectOutside(f, x, z) / e);
    return w > 0 ? g + (f.h - g) * w : g;
  },
  ramp(f, x, z, g) {
    const dx = f.x1 - f.x0, dz = f.z1 - f.z0, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
    const px = x - f.x0, pz = z - f.z0;
    const along = px * ux + pz * uz, side = Math.abs(-px * uz + pz * ux);
    const t = Math.max(0, Math.min(1, along / len)), h = f.h0 + (f.h1 - f.h0) * t;
    const e = f.edge ?? 5;
    const past = along < 0 ? -along : along > len ? along - len : 0; // beyond either end the ramp lands on its flat and fades out
    const out = Math.hypot(Math.max(0, side - f.width / 2), past);
    const w = 1 - smooth(out / e);
    return w > 0 ? g + (h - g) * w : g;
  },
  mound(f, x, z, g) {
    const d = Math.hypot(x - f.x, z - f.z);
    return d >= f.r ? g : g + f.h * (0.5 + 0.5 * Math.cos(Math.PI * d / f.r));
  },
  basin(f, x, z, g) {
    const d = Math.hypot(x - f.x, z - f.z), flat = f.r * (f.flat ?? 0.5);
    let y = g;
    if (d < f.r) y -= f.depth * (1 - smooth((d - flat) / Math.max(0.001, f.r - flat)));
    if (f.rim) { const rw = f.rimW ?? 8, k = (d - f.r) / rw; if (k > -0.25 && k < 1.25) y += f.rim * Math.max(0, Math.cos(Math.PI * (k - 0.5) / 1.5)) ** 2; }
    return y;
  },
};

/** Compile a feature list. Returns { at(x, z), slope(x, z) } or null for a flat map. */
export function buildTerrain(features) {
  if (!features?.length) return null;
  for (const f of features) if (!FEATURES[f.type]) throw new Error(`Unknown terrain feature ${f.type}`);
  // Ground never dips below 0 (the nav grid reserves negative heights for 'blocked'): sink an area by raising its surroundings.
  const at = (x, z) => { let g = 0; for (const f of features) g = FEATURES[f.type](f, x, z, g); return g < 0 ? 0 : g; };
  const slope = (x, z, e = 0.5) => Math.hypot(at(x + e, z) - at(x - e, z), at(x, z + e) - at(x, z - e)) / (2 * e); // rise per metre
  return { at, slope, features };
}

/** Steepest rise per metre along a polyline of [x, z] points (a route a Guardian or a heavy unit is meant to walk). */
export function routeSlope(terrain, pts, step = 0.5) {
  let worst = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / step));
    let prev = terrain.at(x0, z0);
    for (let k = 1; k <= n; k++) {
      const h = terrain.at(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n);
      worst = Math.max(worst, Math.abs(h - prev) / (len / n)); prev = h;
    }
  }
  return worst;
}

/** Steepest rise per metre found on a coarse sample of the play area; the tests keep it under MAX_SLOPE. */
export function steepest(terrain, bounds, step = 1) {
  let worst = 0, at = null;
  for (let x = bounds.minX; x <= bounds.maxX; x += step) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += step) {
      const s = terrain.slope(x, z);
      if (s > worst) { worst = s; at = { x, z }; }
    }
  }
  return { slope: worst, at };
}
