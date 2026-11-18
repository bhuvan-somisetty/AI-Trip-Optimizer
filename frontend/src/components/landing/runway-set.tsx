"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { AirlinerModel, GEAR_DROP } from "./airliner-model";
import { GROUND_COLOR, crownGeometry, leafTexture, patternMaterial, rng, trunkGeometry, world } from "./ground-kit";

// The airliner's landing: out of the cloud on a long final, over the approach lights, a flare,
// touchdown with a puff of tyre smoke and a rollout down the runway, filmed from a chase position
// beside it. Everything here is driven by scroll (`u`, vh into this set), so the landing plays
// forwards and backwards with the page.
//
// The runway runs along +x on z = 0, threshold at x = 0.

export const RUNWAY_END = 400;
const TOUCHDOWN_X = 430;
const GLIDE = Math.tan((3 * Math.PI) / 180);

const smooth = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

// Aircraft on the approach and the runway: wheel height above the ground, position and pitch.
export function planeAt(u: number) {
  let x: number;
  let h: number;
  if (u < 200) {
    x = lerp(-1700, TOUCHDOWN_X, clamp01(u / 200));
    h = GLIDE * (TOUCHDOWN_X - x);
    // Flare: the descent flattens over the last few metres.
    if (h < 14) h = 14 * Math.pow(h / 14, 1.7);
  } else {
    const t = clamp01((u - 200) / 130);
    x = TOUCHDOWN_X + 700 * (1 - (1 - t) * (1 - t));
    h = 0;
  }
  // Nose up on the approach, a little more in the flare, then the nose wheel comes down.
  const pitch = u < 200 ? lerp(0.045, 0.1, smooth(u, 150, 200)) : lerp(0.1, 0, smooth(u, 200, 228));
  return { x, h, pitch };
}

const CHASE: [number, number[], number[]][] = [
  // [u, camera offset from the jet, look-at offset from the jet]
  [0, [-80, 26, 46], [90, -22, 0]],
  [120, [-46, 8, 46], [45, -7, 0]],
  [190, [-12, 0, 58], [6, -2, 0]],
  [260, [-14, 1, 58], [12, -1, 0]],
  [330, [-18, 2, 60], [8, 0, 0]],
  [RUNWAY_END, [-18, 6, 60], [160, 150, -60]],
];

const off = new THREE.Vector3();
const look = new THREE.Vector3();

// Chase camera for a scroll position: writes into `pos` and `target`.
export function runwayCamera(u: number, pos: THREE.Vector3, target: THREE.Vector3) {
  const { x, h } = planeAt(u);
  const jet = new THREE.Vector3(x, h + GEAR_DROP, 0);
  let i = 1;
  while (i < CHASE.length - 1 && u > CHASE[i][0]) i++;
  const [u0, o0, l0] = CHASE[i - 1];
  const [u1, o1, l1] = CHASE[i];
  const t = clamp01((u - u0) / (u1 - u0));
  const e = t * t * t * (t * (t * 6 - 15) + 10);
  off.set(lerp(o0[0], o1[0], e), lerp(o0[1], o1[1], e), lerp(o0[2], o1[2], e));
  look.set(lerp(l0[0], l1[0], e), lerp(l0[1], l1[1], e), lerp(l0[2], l1[2], e));
  pos.copy(jet).add(off);
  pos.y = Math.max(pos.y, 2.4);
  target.copy(jet).add(look);
}

/* ---------- Airfield ---------- */

// Runway paint, worked out from world position so it stays sharp: edge lines, threshold stripes,
// centreline dashes, touchdown zone bars, aiming point blocks and rubber laid down by landings.
const RUNWAY_COLOR = /* glsl */ `
  float bar(float v, float a, float b) { return step(a, v) * step(v, b); }
  vec3 surfaceColor(vec2 q) {
    float x = q.x;
    float z = abs(q.y);
    float n = gFbm(q / 2.0, 1e5);
    float fine = gNoise(q * 6.0, 1e6);
    vec3 col = vec3(0.31, 0.31, 0.32) * (0.82 + 0.3 * n + 0.1 * (fine - 0.5));
    // Slab joints.
    col *= 1.0 - 0.18 * (bar(fract(x / 7.5), 0.0, 0.004) + bar(fract((q.y + 22.5) / 7.5), 0.0, 0.006));
    float rubber = smoothstep(13.0, 2.0, z) * smoothstep(250.0, 440.0, x) * (1.0 - smoothstep(650.0, 1150.0, x));
    col *= 1.0 - 0.5 * rubber * (0.55 + 0.45 * gFbm(q / 3.0 + 7.0, 1e5));
    float paint = bar(z, 21.1, 22.0) * step(0.0, x);
    if (x > 6.0 && x < 36.0 && z > 3.0 && z < 20.0) paint = max(paint, step(fract((z - 3.0) / 2.15), 0.66));
    if (x > 70.0 && z < 0.45) paint = max(paint, step(fract((x - 70.0) / 50.0), 0.6));
    paint = max(paint, bar(x, 400.0, 460.0) * bar(z, 6.0, 15.0));
    for (int i = 0; i < 4; i++) {
      float x0 = 150.0 + float(i) * 150.0;
      if (i == 2) continue;
      float rows = i == 0 ? 3.0 : i == 1 ? 2.0 : 1.0;
      float k = (z - 6.0) / 3.0;
      paint = max(paint, bar(x, x0, x0 + 22.5) * step(0.0, k) * step(k, rows) * step(fract(k), 0.6));
    }
    paint *= 0.82 + 0.18 * fine;
    col = mix(col, vec3(0.93, 0.93, 0.9), paint * (1.0 - rubber * 0.5));
    return toLinear(col);
  }
`;

function Airfield() {
  const kit = useMemo(() => {
    const concrete = new THREE.MeshStandardMaterial({ color: "#8d8b86", roughness: 0.9 });
    return {
      ground: patternMaterial("runway-ground", GROUND_COLOR, { roughness: 0.96 }),
      runway: patternMaterial("runway", RUNWAY_COLOR, { roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      taxi: new THREE.MeshStandardMaterial({ color: "#45464a", roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      yellow: new THREE.MeshStandardMaterial({ color: "#e2b53a", roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      concrete,
      glass: new THREE.MeshPhysicalMaterial({ color: "#1b2a3a", roughness: 0.08, metalness: 0.4, clearcoat: 1 }),
      white: new THREE.MeshStandardMaterial({ color: "#e8e5de", roughness: 0.6 }),
      hangar: new THREE.MeshStandardMaterial({ color: "#a9adb2", roughness: 0.55, metalness: 0.4 }),
      lamp: new THREE.MeshStandardMaterial({ color: "#fffbe8", emissive: "#fff3cc", emissiveIntensity: 2.4 }),
      green: new THREE.MeshStandardMaterial({ color: "#7dffa0", emissive: "#3dff7a", emissiveIntensity: 2 }),
      mast: new THREE.MeshStandardMaterial({ color: "#d9d4c9", roughness: 0.8 }),
    };
  }, []);
  const lights = useRef<THREE.InstancedMesh>(null);
  const masts = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    // Approach light bars every 30 m out to 900 m, with a wide crossbar at 300 m.
    for (let x = -900; x <= -30; x += 30) {
      const span = x === -300 ? 15 : 2.4;
      for (let z = -span; z <= span + 0.01; z += x === -300 ? 1.5 : 1.2) out.push([x, z, x]);
    }
    // Runway edge lights.
    for (let x = 0; x <= 3300; x += 60) for (const z of [-23, 23]) out.push([x, z, 0]);
    return out;
  }, []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const l = lights.current;
    const m = masts.current;
    spots.forEach(([x, z, approach], i) => {
      const height = approach < 0 ? Math.max(0.4, -approach * 0.05 * 0.6) : 0.35;
      o.position.set(x, height, z);
      o.scale.set(0.35, 0.22, 0.35);
      o.updateMatrix();
      l?.setMatrixAt(i, o.matrix);
      o.position.set(x, height / 2, z);
      o.scale.set(0.12, height, 0.12);
      o.updateMatrix();
      m?.setMatrixAt(i, o.matrix);
    });
    if (l) l.instanceMatrix.needsUpdate = true;
    if (m) m.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <group>
      <mesh material={kit.ground} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9000, 9000, 1, 1]} />
      </mesh>
      <mesh material={kit.runway} rotation={[-Math.PI / 2, 0, 0]} position={[1600, 0.04, 0]} receiveShadow>
        <planeGeometry args={[3400, 45]} />
      </mesh>
      {/* Parallel taxiway with link taxiways and its yellow centreline */}
      <mesh material={kit.taxi} rotation={[-Math.PI / 2, 0, 0]} position={[1600, 0.03, -170]} receiveShadow>
        <planeGeometry args={[3300, 23]} />
      </mesh>
      <mesh material={kit.yellow} rotation={[-Math.PI / 2, 0, 0]} position={[1600, 0.035, -170]}>
        <planeGeometry args={[3300, 0.3]} />
      </mesh>
      {[200, 1300, 2300, 3150].map((x) => (
        <mesh key={x} material={kit.taxi} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, -96]} receiveShadow>
          <planeGeometry args={[23, 148]} />
        </mesh>
      ))}
      {/* Apron, terminal, control tower and hangars along the far side */}
      <mesh material={kit.concrete} rotation={[-Math.PI / 2, 0, 0]} position={[1500, 0.02, -260]} receiveShadow>
        <planeGeometry args={[900, 150]} />
      </mesh>
      <group position={[1500, 0, -350]}>
        <mesh material={kit.white} position={[0, 7, 0]} castShadow receiveShadow>
          <boxGeometry args={[420, 14, 44]} />
        </mesh>
        <mesh material={kit.glass} position={[0, 7.5, 22.1]}>
          <boxGeometry args={[410, 9, 0.3]} />
        </mesh>
        <mesh material={kit.hangar} position={[0, 15.2, 0]} castShadow>
          <boxGeometry args={[426, 2.4, 50]} />
        </mesh>
      </group>
      <group position={[1050, 0, -300]}>
        <mesh material={kit.white} position={[0, 21, 0]} castShadow>
          <cylinderGeometry args={[2.6, 3.4, 42, 16]} />
        </mesh>
        <mesh material={kit.glass} position={[0, 45, 0]}>
          <cylinderGeometry args={[6.4, 5.4, 5, 12]} />
        </mesh>
        <mesh material={kit.white} position={[0, 48.2, 0]}>
          <cylinderGeometry args={[6.8, 6.8, 1.4, 12]} />
        </mesh>
      </group>
      {[2350, 2480, 2610].map((x) => (
        <mesh key={x} material={kit.hangar} position={[x, 11, -330]} rotation={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[110, 22, 80]} />
        </mesh>
      ))}
      <instancedMesh ref={lights} args={[undefined, kit.lamp, spots.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={masts} args={[undefined, kit.mast, spots.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* Green threshold bar */}
      {Array.from({ length: 16 }).map((_, i) => (
        <mesh key={i} material={kit.green} position={[-1.5, 0.3, -22 + i * 2.93]}>
          <boxGeometry args={[0.35, 0.22, 0.35]} />
        </mesh>
      ))}
    </group>
  );
}

// Trees well clear of the runway strip, thicker beyond the airfield fence.
function FieldTrees() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const kit = useMemo(() => {
    const rnd = rng(211);
    const spots: THREE.Matrix4[] = [];
    while (spots.length < 900) {
      const x = -2600 + rnd() * 7000;
      const z = (rnd() < 0.5 ? -1 : 1) * (130 + Math.pow(rnd(), 1.6) * 900);
      if (z < -120 && z > -420 && x > 900 && x < 2800) continue; // terminal and hangars
      if (z < -130 && z > -200) continue; // taxiway
      const s = 0.75 + rnd() * 0.7;
      spots.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.3), new THREE.Vector3(s, s, s)));
    }
    return {
      spots,
      crown: crownGeometry({ seed: 3, cards: 60, center: [0, 5.6, 0], radius: [3.7, 2.9, 3.7], size: 2.4 }),
      trunk: trunkGeometry(4.6, 0.3, 3, 21),
      leaves: new THREE.MeshLambertMaterial({ map: leafTexture(), alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, color: "#c3d59c" }),
      bark: new THREE.MeshStandardMaterial({ color: "#4b3d30", roughness: 0.95 }),
    };
  }, []);
  useLayoutEffect(() => {
    for (const m of [ref.current, trunks.current]) {
      if (!m) continue;
      kit.spots.forEach((mat, i) => m.setMatrixAt(i, mat));
      m.instanceMatrix.needsUpdate = true;
    }
  }, [kit]);
  return (
    <>
      <instancedMesh ref={ref} args={[kit.crown, kit.leaves, kit.spots.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={trunks} args={[kit.trunk, kit.bark, kit.spots.length]} castShadow frustumCulled={false} />
    </>
  );
}

/* ---------- Touchdown smoke ---------- */

function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, "rgba(235,235,232,0.9)");
  grad.addColorStop(0.5, "rgba(225,225,222,0.45)");
  grad.addColorStop(1, "rgba(220,220,218,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function TouchdownSmoke() {
  const puffs = useRef<THREE.Sprite[]>([]);
  const keep = (s: THREE.Sprite | null) => {
    if (s && !puffs.current.includes(s)) puffs.current.push(s);
  };
  const kit = useMemo(() => {
    const map = smokeTexture();
    const rnd = rng(5);
    return Array.from({ length: 10 }, (_, i) => ({
      material: new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }),
      side: i % 2 ? 1 : -1,
      dx: rnd() * 6,
      lift: 0.6 + rnd() * 1.4,
      grow: 5 + rnd() * 6,
    }));
  }, []);
  useFrame(() => {
    const u = world.u;
    const age = clamp01((u - 199) / 70);
    puffs.current.forEach((s, i) => {
      const k = kit[i];
      const a = u > 199 ? Math.sin(Math.min(age * 1.15, 1) * Math.PI) * (1 - age) : 0;
      (s.material as THREE.SpriteMaterial).opacity = a * 0.85;
      s.position.set(TOUCHDOWN_X + 3 + k.dx - age * 6, 0.8 + age * k.lift * 3, k.side * (2.9 + age * 1.5));
      const size = 1.5 + age * k.grow;
      s.scale.set(size, size * 0.7, 1);
    });
  });
  return (
    <>
      {kit.map((k, i) => (
        <sprite key={i} ref={keep} material={k.material} />
      ))}
    </>
  );
}

/* ---------- Set ---------- */

export function RunwaySet() {
  const root = useRef<THREE.Group>(null);
  const jet = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (root.current) root.current.visible = world.set === "runway";
    const g = jet.current;
    if (!g) return;
    const { x, h, pitch } = planeAt(world.u);
    const time = state.clock.elapsedTime;
    const airborne = 1 - smooth(world.u, 190, 200);
    // Nose-up attitude about the main gear, so the main wheels touch first.
    g.position.set(x, h + GEAR_DROP + 1.6 * Math.sin(pitch) + Math.sin(time * 0.9) * 0.15 * airborne, Math.sin(time * 0.35) * 0.6 * airborne);
    g.rotation.set(pitch, -Math.PI / 2, Math.sin(time * 0.5) * 0.02 * airborne, "YXZ");
  });
  return (
    <group ref={root} visible={false}>
      <Airfield />
      <FieldTrees />
      <TouchdownSmoke />
      <group ref={jet}>
        <AirlinerModel gear shadows />
      </group>
    </group>
  );
}
