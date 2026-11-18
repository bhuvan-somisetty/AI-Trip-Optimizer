import * as THREE from "three";

const smooth = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// Camera pitch over the sky leg, in radians (positive looks up). Shared by the cloud shader and the
// airliner canvas drawn on top of it, so the jet sits in the same view as the clouds.
//   p: progress of the window and statement part, cruise: the chase over the clouds (0 to 1),
//   down: the dive into the cloud deck (0 to 1).
export function cameraPitch(p: number, cruise: number, down: number) {
  // Horizon through the middle of the window at rest, dips as you fly out, then lifts to open sky.
  const dip = lerp(-0.06, -0.09, smooth(p, 0.05, 0.3));
  const lifted = lerp(dip, 0.42, smooth(p, 0.36, 0.7));
  // Tilts down over the jet and the broken cloud far below, then noses over into the deck.
  const chase = lerp(lifted, -0.45, smooth(cruise, 0, 1));
  return lerp(chase, -0.78, smooth(down, 0, 0.75));
}
