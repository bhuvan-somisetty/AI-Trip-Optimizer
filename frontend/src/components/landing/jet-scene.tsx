"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

// A hand-built business jet (no model files): capsule fuselage, swept wings, tail fin, twin engines.
function Jet({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null);

  const wing = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(2.9, -1.5);
    s.lineTo(2.9, -2.05);
    s.lineTo(0, -1.1);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 });
  }, []);
  const tailWing = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1.2, -0.7);
    s.lineTo(1.2, -0.95);
    s.lineTo(0, -0.55);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  }, []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const p = progress.get();
    // Starts nose-up seen from above, then banks and turns to show its profile as the section scrolls.
    const targetX = THREE.MathUtils.lerp(-1.25, -0.25, p);
    const targetY = THREE.MathUtils.lerp(0, Math.PI * 1.35, p);
    const targetZ = THREE.MathUtils.lerp(0, -0.35, p);
    g.rotation.x += (targetX - g.rotation.x) * 0.08;
    g.rotation.y += (targetY - g.rotation.y) * 0.08;
    g.rotation.z += (targetZ - g.rotation.z) * 0.08;
    const sc = THREE.MathUtils.lerp(0.78, 1.05, p);
    g.scale.setScalar(sc);
    g.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.06;
  });

  const gold = (
    <meshPhysicalMaterial color="#e3be8a" metalness={1} roughness={0.22} clearcoat={1} clearcoatRoughness={0.12} envMapIntensity={1.4} />
  );
  const pearl = (
    <meshPhysicalMaterial color="#f4ece0" metalness={0.35} roughness={0.28} clearcoat={1} clearcoatRoughness={0.1} envMapIntensity={1.1} />
  );
  const dark = <meshStandardMaterial color="#1a1612" metalness={0.6} roughness={0.35} />;

  return (
    <group ref={group} rotation={[-1.25, 0, 0]}>
      {/* fuselage along Z: nose toward +Z */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.36, 4.1, 24, 48]} />
        {pearl}
      </mesh>
      {/* nose cone */}
      <mesh position={[0, 0, 2.55]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.36, 1.1, 48]} />
        {gold}
      </mesh>
      {/* cockpit glass */}
      <mesh position={[0, 0.2, 2.15]} rotation={[0.55, 0, 0]} scale={[1, 0.55, 1.2]}>
        <sphereGeometry args={[0.24, 24, 24]} />
        {dark}
      </mesh>
      {/* cabin windows */}
      {Array.from({ length: 9 }).map((_, i) => (
        <group key={i}>
          <mesh position={[0.355, 0.05, 1.4 - i * 0.38]} scale={[0.4, 1, 1]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            {dark}
          </mesh>
          <mesh position={[-0.355, 0.05, 1.4 - i * 0.38]} scale={[0.4, 1, 1]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            {dark}
          </mesh>
        </group>
      ))}
      {/* wings */}
      <mesh geometry={wing} position={[0.28, -0.1, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        {gold}
      </mesh>
      <mesh geometry={wing} position={[-0.28, -0.1, 0.9]} rotation={[Math.PI / 2, 0, 0]} scale={[-1, 1, 1]}>
        {gold}
      </mesh>
      {/* tail plane + fin */}
      <mesh geometry={tailWing} position={[0.2, 0.55, -2.3]} rotation={[Math.PI / 2, 0, 0]}>
        {gold}
      </mesh>
      <mesh geometry={tailWing} position={[-0.2, 0.55, -2.3]} rotation={[Math.PI / 2, 0, 0]} scale={[-1, 1, 1]}>
        {gold}
      </mesh>
      <mesh position={[0, 0.85, -2.2]} rotation={[0, 0, 0]} scale={[0.1, 1, 0.9]}>
        <boxGeometry args={[1, 1.3, 1]} />
        {pearl}
      </mesh>
      {/* engines */}
      {[-0.52, 0.52].map((x) => (
        <group key={x} position={[x, 0.38, -2.15]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.17, 1.1, 32]} />
            {gold}
          </mesh>
          <mesh position={[0, 0, -0.56]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.15, 32]} />
            <meshStandardMaterial color="#ff693d" emissive="#ff693d" emissiveIntensity={1.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function JetScene({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 5.2, 0.01], fov: 32 }} gl={{ alpha: true, antialias: true }} style={{ background: "transparent" }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 3]} intensity={2.2} color="#fff1dc" />
      <directionalLight position={[-5, 2, -3]} intensity={0.8} color="#cfe0ff" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 2]} scale={[8, 3, 1]} color="#fff3e2" />
        <Lightformer form="rect" intensity={2} position={[-5, 1, -2]} scale={[3, 6, 1]} color="#ffd6b0" />
        <Lightformer form="rect" intensity={1.4} position={[5, -1, 3]} scale={[3, 5, 1]} color="#bcd6ff" />
        <Lightformer form="ring" intensity={2} position={[0, 2, -6]} scale={5} color="#ffffff" />
      </Environment>
      <Jet progress={progress} />
    </Canvas>
  );
}
