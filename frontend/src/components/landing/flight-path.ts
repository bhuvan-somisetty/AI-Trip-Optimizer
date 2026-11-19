import * as THREE from "three";

const smooth = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// Camera angles over the sky leg, shared by the cloud shader and the airliner canvas drawn on top,
// so the jet sits in the same view as the clouds.
//   p: progress of the window and statement part, cruise: the turn to the jet and the formation
//   flight (0 to 1), down: the dive into the cloud deck (0 to 1).

// Pitch in radians, positive looks up.
export function cameraPitch(p: number, cruise: number, down: number) {
  // Horizon through the middle of the window at rest, dips as you fly out.
  const dip = lerp(-0.06, -0.09, smooth(p, 0.05, 0.3));
  // Levels out, just under the horizon, to look across at the jet; then follows it down.
  const across = lerp(dip, -0.1, smooth(cruise, 0, 1));
  return lerp(across, -0.62, smooth(down, 0, 0.8));
}

// Yaw in radians as three.js measures it (negative turns to the right).
export function cameraYaw(cruise: number) {
  return -0.8 * smooth(cruise, 0, 1);
}
