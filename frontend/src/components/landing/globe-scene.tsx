"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

const R = 1.6;

function toVec(lat: number, lon: number, r = R) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

const CITIES: Record<string, [number, number]> = {
  Delhi: [28.6, 77.2],
  Mumbai: [19.07, 72.87],
  Dubai: [25.2, 55.27],
  London: [51.5, -0.12],
  Singapore: [1.35, 103.82],
  "New York": [40.7, -74],
  Tokyo: [35.68, 139.69],
  Sydney: [-33.86, 151.2],
};
const ROUTES: [string, string][] = [
  ["Delhi", "Mumbai"],
  ["Delhi", "Dubai"],
  ["Mumbai", "London"],
  ["Delhi", "Singapore"],
  ["London", "New York"],
  ["Singapore", "Sydney"],
  ["Delhi", "Tokyo"],
];

function arc(a: THREE.Vector3, b: THREE.Vector3) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const lift = 1 + a.distanceTo(b) * 0.22;
  mid.setLength(R * lift);
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

function Globe({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null);
  const planes = useRef<THREE.Mesh[]>([]);

  const dots = useMemo(() => {
    const pts: number[] = [];
    const n = 5200;
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = i * 2.399963229728653;
      pts.push(Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R);
    }
    return new Float32Array(pts);
  }, []);

  const curves = useMemo(() => ROUTES.map(([a, b]) => arc(toVec(...CITIES[a]), toVec(...CITIES[b]))), []);
  const lines = useMemo(
    () => curves.map((c) => new THREE.BufferGeometry().setFromPoints(c.getPoints(60))),
    [curves]
  );
  const cityPos = useMemo(() => Object.values(CITIES).map(([la, lo]) => toVec(la, lo, R * 1.005)), []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const p = progress.get();
    const target = -1.3 + p * Math.PI * 1.6 + state.clock.elapsedTime * 0.06;
    g.rotation.y += (target - g.rotation.y) * 0.06;
    g.rotation.x = 0.35;
    g.scale.setScalar(Math.min(1, (state.size.width / state.size.height) * 1.35));
    planes.current.forEach((m, i) => {
      if (!m) return;
      const t = ((state.clock.elapsedTime * 0.12 + i * 0.37) % 1 + 1) % 1;
      m.position.copy(curves[i].getPoint(t));
    });
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[R * 0.985, 64, 64]} />
        <meshBasicMaterial color="#0b0f16" />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dots, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#e9dfcf" size={0.014} sizeAttenuation transparent opacity={0.85} />
      </points>
      {lines.map((geo, i) => (
        <line key={i}>
          <primitive object={geo} attach="geometry" />
          <lineBasicMaterial color="#ff693d" transparent opacity={0.9} />
        </line>
      ))}
      {cityPos.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.028, 16, 16]} />
          <meshBasicMaterial color="#ffb59b" />
        </mesh>
      ))}
      {curves.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) planes.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

export default function GlobeScene({ progress, active }: { progress: MotionValue<number>; active: boolean }) {
  return (
    <Canvas dpr={[1, 1.75]} frameloop={active ? "always" : "never"} camera={{ position: [0, -0.4, 6.6], fov: 38 }} gl={{ alpha: true, antialias: true }} style={{ background: "transparent" }}>
      <Globe progress={progress} />
    </Canvas>
  );
}
