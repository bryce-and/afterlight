// U24 death camera: pure rules (no DOM, no Three.js) so tools/tests.html can check them.
// A death shows the Guardian's body from behind for a few seconds, then the Ghost hovers over it and the camera orbits the Ghost.
export const DEATH_CAM = {
  bodySecs: 3,          // third person on the falling body (every mode)
  bodySecsCrucible: 1.5, // Crucible's 4 s respawn: a short look at the body, then the Ghost
  startDist: 3.6, minDist: 1.6, maxDist: 8,
  pitchStart: 0.38, pitchMin: -0.15, pitchMax: 1.3,
  drift: 0.18,          // rad/s the camera slowly circles the body before the Ghost takes over
  wheelStep: 0.7, wall: 0.3, floor: 0.25, // wall margin and the lowest the camera sits above the ground (m)
  collapse: 0.7,        // seconds the body takes to fall into its lying pose
};

/** 'body' for the first bodySecs, then 'ghost'. */
export const deathPhase = (t, bodySecs = DEATH_CAM.bodySecs) => (t < bodySecs ? 'body' : 'ghost');
/** 0 to 1 over the collapse: how far the body has gone from standing to lying (eased). */
export const collapseK = (t, dur = DEATH_CAM.collapse) => { const k = Math.min(1, Math.max(0, t / dur)); return 1 - (1 - k) * (1 - k); };

/** A fresh orbit state behind a Guardian who faces `yaw` (the camera sits at +sin/+cos, the opposite side to getForward). */
export const newOrbit = (yaw) => ({ yaw, pitch: DEATH_CAM.pitchStart, dist: DEATH_CAM.startDist });
/** Applies mouse movement (dx, dy in pixels already scaled by sensitivity) and the wheel (steps; positive zooms out), within limits. */
export function orbitStep(o, dx, dy, wheel = 0, C = DEATH_CAM) {
  o.yaw -= dx;
  o.pitch = Math.min(C.pitchMax, Math.max(C.pitchMin, o.pitch + dy));
  o.dist = Math.min(C.maxDist, Math.max(C.minDist, o.dist + wheel * C.wheelStep));
  return o;
}
/** The camera's offset from the orbit target as {x,y,z} for a given distance. */
export const orbitOffset = (o, dist = o.dist) => ({
  x: Math.sin(o.yaw) * Math.cos(o.pitch) * dist, y: Math.sin(o.pitch) * dist, z: Math.cos(o.yaw) * Math.cos(o.pitch) * dist,
});
/** How far out the camera may sit when a wall is `hit` m away along the ray: in front of the wall, never closer than 0.4 m, never beyond `dist`. */
export const pushIn = (dist, hit, C = DEATH_CAM) => (hit == null ? dist : Math.min(dist, Math.max(0.4, hit - C.wall)));
