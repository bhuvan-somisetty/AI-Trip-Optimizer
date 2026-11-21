"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { world } from "./ground-kit";

function usePaint() {
  return useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({ color: "#efe9df", roughness: 0.32, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
      navy: new THREE.MeshPhysicalMaterial({ color: "#13213a", roughness: 0.35, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
      accent: new THREE.MeshPhysicalMaterial({ color: "#ff693d", roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#0a0e13", roughness: 0.05, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.4 }),
      door: new THREE.MeshStandardMaterial({ color: "#d6cfc3", roughness: 0.4 }),
      seam: new THREE.MeshStandardMaterial({ color: "#2c2a28", roughness: 0.6 }),
      under: new THREE.MeshStandardMaterial({ color: "#1e1f21", roughness: 0.75, metalness: 0.3 }),
      steel: new THREE.MeshStandardMaterial({ color: "#5c5d5f", roughness: 0.4, metalness: 0.85 }),
      roof: new THREE.MeshStandardMaterial({ color: "#c9c4bb", roughness: 0.55, metalness: 0.2 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.9 }),
      hub: new THREE.MeshStandardMaterial({ color: "#a9adb2", roughness: 0.3, metalness: 0.9 }),
      lamp: new THREE.MeshStandardMaterial({ color: "#fff8e8", emissive: "#fff3d6", emissiveIntensity: 2.2 }),
      tail: new THREE.MeshStandardMaterial({ color: "#ff3b1f", emissive: "#ff2a10", emissiveIntensity: 1.2 }),
    }),
    [],
  );
}
type Paint = ReturnType<typeof usePaint>;

// Soft dark pad under a vehicle: the ambient occlusion where it meets the ground.
function useContactShadow(strength: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.6)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const alphaMap = new THREE.CanvasTexture(c);
    return new THREE.MeshBasicMaterial({ color: "#0d0b08", alphaMap, transparent: true, opacity: strength, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  }, [strength]);
}

/* ---------- Train ---------- */

const CAR = 20.5;
const GAP = 1.0;
const NOSE = 4.6;
const CARS = 6;
const BOTTOM = 1.3;
const TOP = 4.7;
const WIDTH = 3.2;
const SIDE = WIDTH / 2 + 0.006;
export const RAIL_TOP = 0.69;
const WHEEL_R = 0.46;

// Side profile of the cab, from the cab joint (u = 0) to the tip of the nose.
function noseOutline() {
  const curve = new THREE.SplineCurve(
    [
      [3.5, BOTTOM],
      [4.3, 1.42],
      [4.6, 1.85],
      [4.52, 2.45],
      [4.12, 3.08],
      [3.2, 3.78],
      [2.05, 4.42],
      [0.95, 4.68],
      [0, TOP],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  return [new THREE.Vector2(0, BOTTOM), ...curve.getPoints(48)];
}

function offsetPolyline(pts: THREE.Vector2[], by: number, closed: boolean) {
  return pts.map((p, i) => {
    const a = pts[closed ? (i - 1 + pts.length) % pts.length : Math.max(i - 1, 0)];
    const b = pts[closed ? (i + 1) % pts.length : Math.min(i + 1, pts.length - 1)];
    const d = b.clone().sub(a).normalize();
    return new THREE.Vector2(p.x + d.y * by, p.y - d.x * by);
  });
}

// Solid body from a closed side profile, extruded across the width with rounded edges.
function extrudeProfile(outer: THREE.Vector2[], width: number, bevel: number) {
  const inner = offsetPolyline(outer, -bevel, true);
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(inner), {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 4,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.deleteAttribute("uv");
  const smooth = mergeVertices(g, 1e-3);
  smooth.computeVertexNormals();
  return smooth;
}

// A strip of the profile (a windscreen), standing proud of the paint by a couple of centimetres.
function profileBand(outer: THREE.Vector2[], keep: (p: THREE.Vector2) => boolean, width: number) {
  const strip = outer.filter(keep);
  const out = offsetPolyline(strip, 0.025, false);
  const inn = offsetPolyline(strip, -0.3, false).reverse();
  const g = new THREE.ExtrudeGeometry(new THREE.Shape([...out, ...inn]), { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2);
  return g;
}

function useNoseGeometry() {
  return useMemo(() => {
    const outer = noseOutline();
    return {
      shell: extrudeProfile(outer, WIDTH, 0.28),
      screen: profileBand(outer, (p) => p.x > 1.35 && p.x < 3.45 && p.y > 3.6, 2.5),
    };
  }, []);
}

function Wheelset({ x, paint, spin }: { x: number; paint: Paint; spin: (g: THREE.Group | null) => void }) {
  return (
    <group position={[x, RAIL_TOP + WHEEL_R, 0]} ref={spin}>
      {[-0.8, 0.8].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh material={paint.under} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.13, 24]} />
          </mesh>
          <mesh material={paint.hub} position={[0, 0, Math.sign(z) * 0.07]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
          </mesh>
          <mesh material={paint.hub} position={[0.3, 0, Math.sign(z) * 0.07]}>
            <boxGeometry args={[0.08, 0.08, 0.02]} />
          </mesh>
        </group>
      ))}
      <mesh material={paint.steel} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 1.9, 10]} />
      </mesh>
    </group>
  );
}

function Bogie({ x, paint, spin }: { x: number; paint: Paint; spin: (g: THREE.Group | null) => void }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh material={paint.under} position={[0, 1.08, 0]} castShadow>
        <boxGeometry args={[3.1, 0.42, 2.25]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={paint.steel} position={[s * 1.1, RAIL_TOP + WHEEL_R, 1.16]}>
          <boxGeometry args={[0.36, 0.32, 0.22]} />
        </mesh>
      ))}
      <Wheelset x={-1.1} paint={paint} spin={spin} />
      <Wheelset x={1.1} paint={paint} spin={spin} />
    </group>
  );
}

// One coach: body shell, livery bands, windows, doors, roof gear and running gear.
function Coach({ front, paint, spin, lead }: { front: number; paint: Paint; spin: (g: THREE.Group | null) => void; lead?: boolean }) {
  const cx = front - CAR / 2;
  const band = CAR - 5.4;
  const mullions = Math.floor(band / 1.9);
  return (
    <group>
      <RoundedBox args={[CAR, TOP - BOTTOM, WIDTH]} radius={0.3} smoothness={4} position={[cx, (TOP + BOTTOM) / 2, 0]} material={paint.body} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * SIDE]}>
          <mesh material={paint.navy} position={[cx, 2.03, 0]}>
            <boxGeometry args={[CAR - 0.6, 0.82, 0.01]} />
          </mesh>
          <mesh material={paint.accent} position={[cx, 2.62, 0]}>
            <boxGeometry args={[CAR - 0.6, 0.12, 0.01]} />
          </mesh>
          <mesh material={paint.glass} position={[cx, 3.46, 0]}>
            <boxGeometry args={[band, 0.98, 0.012]} />
          </mesh>
          {Array.from({ length: mullions + 1 }).map((_, i) => (
            <mesh key={i} material={paint.body} position={[cx - band / 2 + (i * band) / mullions, 3.46, s * 0.006]}>
              <boxGeometry args={[0.13, 1.0, 0.012]} />
            </mesh>
          ))}
          {[front - 1.5, front - CAR + 1.5].map((dx) => (
            <group key={dx} position={[dx, 2.98, 0]}>
              <mesh material={paint.seam} position={[0, 0, s * 0.002]}>
                <boxGeometry args={[1.18, 2.58, 0.012]} />
              </mesh>
              <mesh material={paint.door} position={[0, 0, s * 0.006]}>
                <boxGeometry args={[1.1, 2.5, 0.012]} />
              </mesh>
              <mesh material={paint.glass} position={[0, 0.55, s * 0.011]}>
                <boxGeometry args={[0.7, 0.8, 0.012]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <mesh material={paint.roof} position={[cx, TOP + 0.14, 0]} castShadow>
        <boxGeometry args={[3.6, 0.3, 1.9]} />
      </mesh>
      <mesh material={paint.under} position={[cx, 1.05, 0]}>
        <boxGeometry args={[CAR - 9, 0.55, 2.6]} />
      </mesh>
      <Bogie x={front - 3.1} paint={paint} spin={spin} />
      <Bogie x={front - CAR + 3.1} paint={paint} spin={spin} />
      {!lead && (
        <mesh material={paint.seam} position={[front + GAP / 2, 2.95, 0]}>
          <boxGeometry args={[GAP + 0.3, 3.0, 2.7]} />
        </mesh>
      )}
    </group>
  );
}

function Pantograph({ x, paint }: { x: number; paint: Paint }) {
  const h = 6.1 - TOP - 0.3;
  return (
    <group position={[x, TOP + 0.3, 0]}>
      <mesh material={paint.steel} position={[0, -0.08, 0]}>
        <boxGeometry args={[1.6, 0.16, 1.4]} />
      </mesh>
      <mesh material={paint.steel} position={[0.45, h * 0.3, 0]} rotation={[0, 0, -0.95]}>
        <boxGeometry args={[0.07, 1.25, 0.07]} />
      </mesh>
      <mesh material={paint.steel} position={[0.45, h * 0.78, 0]} rotation={[0, 0, 0.75]}>
        <boxGeometry args={[0.05, 0.95, 0.05]} />
      </mesh>
      <mesh material={paint.steel} position={[0.1, h, 0]}>
        <boxGeometry args={[0.12, 0.06, 1.9]} />
      </mesh>
    </group>
  );
}

export function Train({ reduce, cars = CARS }: { reduce: boolean; cars?: number }) {
  const paint = usePaint();
  const { shell, screen } = useNoseGeometry();
  const group = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group[]>([]);
  const spin = (g: THREE.Group | null) => {
    if (g && !wheels.current.includes(g)) wheels.current.push(g);
  };

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const a = -world.d / WHEEL_R;
    for (const w of wheels.current) w.rotation.z = a;
    const g = group.current;
    if (!g || reduce) return;
    // Gentle sway and bounce from the track.
    g.rotation.x = Math.sin(t * 1.3) * 0.0025 + Math.sin(t * 3.1) * 0.001;
    g.position.y = Math.sin(t * 9.0) * 0.004 + Math.sin(t * 2.3) * 0.006;
  });

  const shadow = useContactShadow(0.55);
  const length = NOSE + cars * (CAR + GAP);

  return (
    <group ref={group}>
      <mesh material={shadow} position={[-length / 2 + 0.6, 0.37, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.04, 1, 1]}>
        <planeGeometry args={[length, 4.4]} />
      </mesh>
      {/* Cab */}
      <mesh geometry={shell} material={paint.body} position={[-NOSE, 0, 0]} castShadow receiveShadow />
      <mesh geometry={screen} material={paint.glass} position={[-NOSE, 0, 0]} />
      {[-1, 1].map((s) => (
        <group key={s} position={[-NOSE, 0, s * SIDE]}>
          <mesh material={paint.navy} position={[1.85, 2.03, 0]}>
            <boxGeometry args={[3.7, 0.82, 0.01]} />
          </mesh>
          <mesh material={paint.accent} position={[1.9, 2.62, 0]}>
            <boxGeometry args={[3.8, 0.12, 0.01]} />
          </mesh>
          <mesh material={paint.glass} position={[1.3, 3.55, 0]}>
            <boxGeometry args={[1.0, 0.75, 0.012]} />
          </mesh>
        </group>
      ))}
      {[-0.95, 0.95].map((z) => (
        <mesh key={z} material={paint.lamp} position={[-0.12, 2.0, z]} rotation={[0, 0, -0.45]}>
          <boxGeometry args={[0.1, 0.18, 0.55]} />
        </mesh>
      ))}
      <mesh material={paint.under} position={[-0.35, 1.32, 0]}>
        <boxGeometry args={[0.6, 0.4, 1.4]} />
      </mesh>
      <Pantograph x={-NOSE - 7} paint={paint} />

      {Array.from({ length: cars }).map((_, i) => (
        <Coach key={i} front={-NOSE - i * (CAR + GAP)} paint={paint} spin={spin} lead={i === 0} />
      ))}
      {[-0.95, 0.95].map((z) => (
        <mesh key={z} material={paint.tail} position={[-NOSE - (cars - 1) * (CAR + GAP) - CAR - 0.01, 2.0, z]}>
          <boxGeometry args={[0.04, 0.16, 0.3]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Coach bus ---------- */

const BUS_L = 12.2;
const BUS_W = 2.55;
const BUS_TOP = 3.58;
const TYRE_R = 0.52;
const ARCH_R = 0.64;
const AXLES = [-2.5, -9.2];

// Side profile of an intercity coach: raked windscreen, rounded roof line, open wheel arches.
function busOutline() {
  const pts: THREE.Vector2[] = [new THREE.Vector2(-12.05, 0.45)];
  for (const x of [AXLES[1], AXLES[0]]) {
    pts.push(new THREE.Vector2(x - ARCH_R, 0.45), new THREE.Vector2(x - ARCH_R, TYRE_R));
    for (let i = 1; i < 12; i++) {
      const a = Math.PI - (i / 12) * Math.PI;
      pts.push(new THREE.Vector2(x + Math.cos(a) * ARCH_R, TYRE_R + Math.sin(a) * ARCH_R));
    }
    pts.push(new THREE.Vector2(x + ARCH_R, TYRE_R), new THREE.Vector2(x + ARCH_R, 0.45));
  }
  const nose = new THREE.SplineCurve(
    [
      [-0.3, 0.45],
      [-0.04, 0.58],
      [0.05, 0.9],
      [0.06, 1.45],
      [-0.12, 2.5],
      [-0.3, 3.28],
      [-0.6, 3.52],
      [-1.05, BUS_TOP],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  pts.push(...nose.getPoints(30));
  const tail = new THREE.SplineCurve(
    [
      [-11.55, BUS_TOP],
      [-11.98, 3.5],
      [-12.18, 3.2],
      [-12.2, 0.9],
      [-12.16, 0.56],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  pts.push(...tail.getPoints(16));
  return pts;
}

export function Bus({ reduce }: { reduce: boolean }) {
  const paint = usePaint();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group[]>([]);
  const spin = (g: THREE.Group | null) => {
    if (g && !wheels.current.includes(g)) wheels.current.push(g);
  };
  const geo = useMemo(() => {
    const outer = busOutline();
    return {
      shell: extrudeProfile(outer, BUS_W, 0.12),
      screen: profileBand(outer, (p) => p.x > -0.36 && p.y > 1.5 && p.y < 3.3, BUS_W - 0.22),
    };
  }, []);
  const shadow = useContactShadow(0.6);
  const side = BUS_W / 2 + 0.005;
  const glassFrom = -11.7;
  const glassTo = -0.7;
  const panes = 7;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const a = -world.d / TYRE_R;
    for (const w of wheels.current) w.rotation.z = a;
    if (root.current) root.current.visible = world.set === "road";
    const b = body.current;
    if (!b || reduce) return;
    // Body rides on its suspension: a slow float with small road ripples.
    b.position.y = Math.sin(t * 1.7) * 0.012 + Math.sin(t * 6.3) * 0.004;
    b.rotation.x = Math.sin(t * 1.1) * 0.003;
  });

  return (
    <group ref={root}>
      <mesh material={shadow} position={[-BUS_L / 2, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BUS_L + 1.6, BUS_W + 1.4]} />
      </mesh>
      <group ref={body}>
        <mesh geometry={geo.shell} material={paint.body} castShadow receiveShadow />
        <mesh geometry={geo.screen} material={paint.glass} />
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 0, s * side]}>
            {/* Continuous glazing with slim dark pillars, the line of a modern coach */}
            <mesh material={paint.glass} position={[(glassFrom + glassTo) / 2, 2.53, 0]}>
              <boxGeometry args={[glassTo - glassFrom, 1.34, 0.01]} />
            </mesh>
            {Array.from({ length: panes + 1 }).map((_, i) => (
              <mesh key={i} material={paint.seam} position={[glassFrom + (i * (glassTo - glassFrom)) / panes, 2.53, s * 0.006]}>
                <boxGeometry args={[0.07, 1.34, 0.01]} />
              </mesh>
            ))}
            <mesh material={paint.accent} position={[-6.1, 1.74, 0]}>
              <boxGeometry args={[11.6, 0.08, 0.01]} />
            </mesh>
            {[
              [-12.0, -9.95],
              [-8.45, -3.25],
              [-1.75, -0.35],
            ].map(([a, b]) => (
              <mesh key={a} material={paint.navy} position={[(a + b) / 2, 1.08, 0]}>
                <boxGeometry args={[b - a, 1.12, 0.01]} />
              </mesh>
            ))}
            {[-7.0, -5.1].map((x) => (
              <mesh key={x} material={paint.seam} position={[x, 1.02, s * 0.004]}>
                <boxGeometry args={[0.025, 0.9, 0.01]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* Front: grille, lamps, bumper, destination board, wipers, mirrors */}
        <mesh material={paint.under} position={[0.07, 1.12, 0]}>
          <boxGeometry args={[0.04, 0.34, 1.3]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh material={paint.lamp} position={[0.08, 1.02, s * 0.92]}>
              <boxGeometry args={[0.03, 0.12, 0.38]} />
            </mesh>
            <mesh material={paint.accent} position={[0.08, 1.02, s * 1.15]}>
              <boxGeometry args={[0.03, 0.1, 0.08]} />
            </mesh>
          </group>
        ))}
        <mesh material={paint.under} position={[0.04, 0.56, 0]}>
          <boxGeometry args={[0.14, 0.2, BUS_W - 0.06]} />
        </mesh>
        <mesh material={paint.tail} position={[-0.27, 3.13, 0]} rotation={[0, 0, 0.19]}>
          <boxGeometry args={[0.03, 0.13, 1.3]} />
        </mesh>
        {[-0.45, 0.45].map((z) => (
          <mesh key={z} material={paint.seam} position={[0.075, 1.72, z]} rotation={[0.9, 0, 0.1]}>
            <boxGeometry args={[0.02, 0.02, 0.85]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <group key={s} position={[0.3, 2.95, s * (BUS_W / 2 + 0.22)]}>
            <mesh material={paint.under} position={[-0.18, 0.28, -s * 0.12]} rotation={[0.4 * s, 0, 0]}>
              <boxGeometry args={[0.05, 0.05, 0.42]} />
            </mesh>
            <mesh material={paint.under} position={[0, -0.05, 0]}>
              <boxGeometry args={[0.08, 0.42, 0.2]} />
            </mesh>
          </group>
        ))}
        <mesh material={paint.roof} position={[-6.2, BUS_TOP + 0.13, 0]} castShadow>
          <boxGeometry args={[3.4, 0.26, 1.7]} />
        </mesh>
        {[-0.9, 0.9].map((z) => (
          <mesh key={z} material={paint.tail} position={[-BUS_L - 0.005, 1.3, z]}>
            <boxGeometry args={[0.02, 0.4, 0.2]} />
          </mesh>
        ))}
      </group>
      {AXLES.map((x) => (
        <group key={x}>
          <mesh material={paint.under} position={[x, TYRE_R + 0.15, 0]}>
            <boxGeometry args={[1.1, 0.5, BUS_W - 0.6]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[x, TYRE_R, s * (BUS_W / 2 - 0.2)]} ref={spin}>
              <mesh material={paint.rubber} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[TYRE_R, TYRE_R, 0.32, 28]} />
              </mesh>
              <mesh material={paint.hub} position={[0, 0, s * 0.165]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.28, 0.28, 0.01, 20]} />
              </mesh>
              {Array.from({ length: 6 }).map((_, i) => (
                <mesh key={i} material={paint.under} position={[Math.cos((i * Math.PI) / 3) * 0.18, Math.sin((i * Math.PI) / 3) * 0.18, s * 0.172]}>
                  <boxGeometry args={[0.05, 0.05, 0.01]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
