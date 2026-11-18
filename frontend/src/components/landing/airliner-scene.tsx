"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

import { AirlinerModel } from "./airliner-model";
import { cameraPitch, cameraYaw } from "./flight-path";

// The airliner flying alongside, over the clouds. The clouds are drawn by the canvas underneath; this
// canvas is transparent and holds only the jet. The camera shares its pitch and yaw with the cloud
// shader: once out of the window it swings round to the right and finds the jet keeping formation
// beside it, then follows it as it noses down into the cloud deck.
//
// `progress` runs 0 to 1 over the flight leg.

const smooth = THREE.MathUtils.smoothstep;

function Formation({ progress, sky, level, descend }: { progress: MotionValue<number>; sky: MotionValue<number>; level: MotionValue<number>; descend: MotionValue<number> }) {
  const jet = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = jet.current;
    if (!g) return;
    const t = progress.get();
    const time = state.clock.elapsedTime;
    state.camera.rotation.set(cameraPitch(sky.get(), level.get(), descend.get()), cameraYaw(level.get()), 0, "YXZ");

    // Off the right wing, flying the same heading as the camera, so the turn reveals it.
    const dive = smooth(t, 0.62, 1);
    const x = 50 + Math.sin(time * 0.29) * 0.9 - dive * 4;
    const y = -3 + Math.sin(time * 0.43) * 0.5 - dive * dive * 42;
    const z = -30 + Math.sin(time * 0.21) * 1.5 - dive * 30;
    g.position.set(x, y, z);
    g.rotation.set(-dive * 0.3 + Math.sin(time * 0.5) * 0.008, 0, Math.sin(time * 0.37) * 0.03 - dive * 0.12, "YXZ");
    g.visible = t > 0.001 && t < 0.999;
  });

  return (
    <group ref={jet}>
      <AirlinerModel />
    </group>
  );
}

export default function AirlinerScene({
  progress,
  sky,
  level,
  descend,
  active,
}: {
  progress: MotionValue<number>;
  sky: MotionValue<number>;
  level: MotionValue<number>;
  descend: MotionValue<number>;
  active: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 37, near: 0.5, far: 800, position: [0, 0, 0] }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {/* High sun, as in the cloud shader, with a cool fill from the sky and bounce off the cloud. */}
      <directionalLight position={[0.35, 1.1, -0.4]} intensity={2.3} color="#fff4e6" />
      <directionalLight position={[0.6, 0.3, 1]} intensity={0.5} color="#dfe9f7" />
      <hemisphereLight args={["#8fb2e3", "#c9d6e6", 0.6]} />
      <Environment resolution={128} frames={1} environmentIntensity={0.8}>
        <color attach="background" args={["#6f97d4"]} />
        <Lightformer form="rect" intensity={1.4} position={[0, -6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} color="#dbe6f2" />
        <Lightformer form="rect" intensity={1.8} position={[0, 8, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[30, 30, 1]} color="#6f9be0" />
        <Lightformer form="rect" intensity={3.2} position={[3, 6, 2]} scale={[10, 4, 1]} color="#fff4e4" />
      </Environment>
      <Formation progress={progress} sky={sky} level={level} descend={descend} />
    </Canvas>
  );
}
