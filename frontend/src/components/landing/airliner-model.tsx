"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A twin-engine narrow-body airliner in Trip Optimizer colours, built from code: lathed fuselage,
// swept wings with sharklets, turbofans, tail, painted livery and optional landing gear. Nose at -z,
// wheels touching y = -GEAR_DROP when the gear is down. Used over the clouds and on the runway.

const RED = "#d8322a";

// Fuselage titles and registration, drawn once into a texture the livery shader samples.
function titleTexture() {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.textBaseline = "middle";
  g.font = "italic 900 132px Arial, Helvetica, sans-serif";
  const a = "AI TRIP ";
  const b = "OPTIMIZER";
  const wa = g.measureText(a).width;
  const wb = g.measureText(b).width;
  const x0 = (2048 - wa - wb) / 2;
  g.fillStyle = "#13213a";
  g.fillText(a, x0, 72);
  g.fillStyle = RED;
  g.fillText(b, x0 + wa, 72);
  // A swoosh under OPTIMIZER, ending in an arrowhead.
  g.strokeStyle = RED;
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(x0 + wa + wb * 0.25, 150);
  g.quadraticCurveTo(x0 + wa + wb * 0.7, 118, x0 + wa + wb + 40, 140);
  g.stroke();
  g.fillStyle = RED;
  g.beginPath();
  g.moveTo(x0 + wa + wb + 70, 146);
  g.lineTo(x0 + wa + wb + 22, 120);
  g.lineTo(x0 + wa + wb + 30, 160);
  g.closePath();
  g.fill();
  // Registration, bottom row.
  g.font = "italic 700 64px Arial, Helvetica, sans-serif";
  g.fillStyle = "#1d1f24";
  g.fillText("VT-ATO", 40, 214);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Livery painted in the fuselage shader from object-space position, so it stays crisp and wraps
// the curved skin: red belly sweeping up to the tail, titles, cabin windows, doors, flight deck
// windows and a small tricolour by the forward door.
const FUSELAGE_PAINT = /* glsl */ `
  uniform sampler2D uTitles;
  float box(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  vec3 paint(vec3 p, vec3 base) {
    vec3 red = vec3(0.85, 0.2, 0.16);
    vec3 c = base;
    // Belly, sweeping up towards the tail.
    float line = -1.42 + smoothstep(6.0, 19.0, p.z) * 1.9;
    c = mix(c, red, smoothstep(line + 0.03, line - 0.03, p.y));

    float side = step(1.0, abs(p.x));
    // Titles: read left to right from either side.
    float u = p.x < 0.0 ? (p.z + 11.5) / 17.0 : (5.5 - p.z) / 17.0;
    float v = (p.y - 0.62) / 1.0;
    if (side > 0.5 && u > 0.0 && u < 1.0 && v > 0.0 && v < 1.0) {
      vec4 t = texture2D(uTitles, vec2(u, 0.5 + v * 0.5));
      c = mix(c, t.rgb, t.a);
    }
    // Registration aft.
    float ru = p.x < 0.0 ? (p.z - 9.6) / 6.0 : (15.6 - p.z) / 6.0;
    float rv = (p.y - 0.48) / 0.75;
    if (side > 0.5 && ru > 0.0 && ru < 1.0 && rv > 0.0 && rv < 1.0) {
      vec4 t = texture2D(uTitles, vec2(ru * 0.33, rv * 0.5));
      c = mix(c, t.rgb, t.a);
    }
    // Cabin windows.
    if (side > 0.5 && p.z > -14.0 && p.z < 12.4) {
      float k = fract((p.z + 14.0) / 0.82) - 0.5;
      float w = box(vec2(k * 0.82, p.y - 0.18), vec2(0.12, 0.17), 0.1);
      c = mix(c, vec3(0.06, 0.08, 0.11), smoothstep(0.01, -0.01, w));
    }
    // Door outlines.
    for (int i = 0; i < 2; i++) {
      float dz = i == 0 ? -14.85 : 8.8;
      float d = abs(box(vec2(p.z - dz, p.y + 0.05), vec2(0.46, 0.93), 0.12));
      c = mix(c, vec3(0.55, 0.56, 0.58), side * smoothstep(0.02, 0.0, d));
    }
    // Tricolour by the forward door.
    vec2 f = vec2(p.x < 0.0 ? p.z + 13.75 : -13.75 - p.z, p.y - 0.55);
    if (side > 0.5 && abs(f.x) < 0.33 && abs(f.y) < 0.22) {
      vec3 flag = f.y > 0.073 ? vec3(1.0, 0.6, 0.2) : f.y < -0.073 ? vec3(0.07, 0.53, 0.03) : vec3(1.0);
      flag = mix(flag, vec3(0.0, 0.0, 0.5), smoothstep(0.05, 0.035, length(f)) * smoothstep(0.02, 0.035, length(f)));
      c = flag;
    }
    // Flight deck windows: a band round the nose split into panes.
    if (p.z < -16.2) {
      float a = atan(p.x, p.y + 0.4);
      float band = smoothstep(0.02, 0.0, abs(p.y - 0.78 - (p.z + 17.0) * 0.12) - 0.2);
      float frames = smoothstep(0.03, 0.06, abs(fract(a / 0.42 + 0.5) - 0.5) * 0.42);
      c = mix(c, vec3(0.04, 0.06, 0.09), band * frames * step(abs(a), 1.25));
    }
    return c;
  }
`;

const FIN_PAINT = /* glsl */ `
  uniform sampler2D uTitles;
  vec3 paint(vec3 p, vec3 base) {
    vec3 c = base;
    // Brand mark: a white ring and a dot, set high on the fin.
    vec2 q = vec2(p.z - 16.4, p.y - 5.4);
    float r = length(q);
    float ring = smoothstep(0.09, 0.0, abs(r - 1.05) - 0.08) * step(-0.6, q.y + q.x * 0.2);
    float dot1 = smoothstep(0.32, 0.26, length(q - vec2(-0.15, 0.1)));
    return mix(c, vec3(0.98), max(ring, dot1));
  }
`;

function livery(glsl: string, params: THREE.MeshPhysicalMaterialParameters, key: string, titles: THREE.Texture) {
  const m = new THREE.MeshPhysicalMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTitles = { value: titles };
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObj;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vObj;\n${glsl}`)
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( paint(vObj, diffuse), opacity );");
  };
  m.customProgramCacheKey = () => key;
  return m;
}

function lathe(profile: [number, number][], segments = 72) {
  return new THREE.LatheGeometry(
    profile.map(([r, s]) => new THREE.Vector2(r, s)),
    segments,
  );
}

// Planform in the x/z plane, given thickness downwards.
function planform(points: [number, number][], thickness: number) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z))), {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.4,
    bevelSize: thickness * 0.35,
    bevelSegments: 3,
  });
  g.rotateX(Math.PI / 2);
  g.translate(0, thickness / 2, 0);
  g.computeVertexNormals();
  return g;
}

function useAirframe() {
  return useMemo(() => {
    const titles = titleTexture();
    // Fuselage: lathed along the length, nose at -z, the tail cone swept up underneath.
    const body = lathe([
      [0, 0],
      [0.55, 0.18],
      [1.05, 0.7],
      [1.5, 1.6],
      [1.85, 3.0],
      [2.0, 4.6],
      [2.02, 8],
      [2.02, 27],
      [1.9, 30],
      [1.55, 32.6],
      [1.05, 35],
      [0.55, 37],
      [0.18, 38],
    ]);
    body.rotateX(Math.PI / 2);
    body.translate(0, 0, -19);
    const pos = body.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const k = Math.pow(Math.max(0, (z - 6) / 13), 2);
      pos.setY(i, y + k * 1.25 * (1 - y / 2.1) * 0.55);
    }
    body.computeVertexNormals();

    const wing = planform(
      [
        [1.6, -3.4],
        [17.2, 3.9],
        [17.2, 5.5],
        [1.6, 3.6],
      ],
      0.34,
    );
    const sharklet = planform(
      [
        [0, 0],
        [1.3, 0.9],
        [1.3, 1.6],
        [0, 1.5],
      ],
      0.08,
    );
    sharklet.rotateZ(Math.PI / 2);
    const stab = planform(
      [
        [0.4, -1.6],
        [6.4, 1.9],
        [6.4, 3.0],
        [0.4, 2.0],
      ],
      0.18,
    );
    const fin = new THREE.ExtrudeGeometry(
      new THREE.Shape(
        [
          [12.0, 1.0],
          [16.9, 8.4],
          [18.8, 8.4],
          [18.6, 0.6],
        ].map(([z, y]) => new THREE.Vector2(z, y)),
      ),
      {
        depth: 0.3,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 3,
      },
    );
    fin.rotateY(-Math.PI / 2);
    fin.translate(0.15, 0, 0);
    fin.computeVertexNormals();

    const nacelle = lathe([
      [0.9, 0],
      [1.08, 0.12],
      [1.14, 1.2],
      [1.08, 2.8],
      [0.82, 3.9],
      [0.5, 4.5],
    ]);
    nacelle.rotateX(Math.PI / 2);
    nacelle.translate(0, 0, -2.25);
    nacelle.computeVertexNormals();

    const mats = {
      fuselage: livery(
        FUSELAGE_PAINT,
        {
          color: "#f5f3ee",
          roughness: 0.28,
          metalness: 0.06,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
        },
        "fuselage",
        titles,
      ),
      fin: livery(FIN_PAINT, { color: RED, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }, "fin", titles),
      red: new THREE.MeshPhysicalMaterial({
        color: RED,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        side: THREE.DoubleSide,
      }),
      wing: new THREE.MeshPhysicalMaterial({
        color: "#d3d6da",
        roughness: 0.32,
        metalness: 0.45,
        clearcoat: 0.6,
      }),
      lip: new THREE.MeshStandardMaterial({
        color: "#d4d7da",
        roughness: 0.15,
        metalness: 1,
      }),
      fan: new THREE.MeshStandardMaterial({
        color: "#121417",
        roughness: 0.4,
        metalness: 0.7,
        side: THREE.DoubleSide,
      }),
      spinner: new THREE.MeshStandardMaterial({
        color: "#e7e9ec",
        roughness: 0.2,
        metalness: 0.9,
      }),
      redLight: new THREE.MeshStandardMaterial({
        color: "#ff2a1a",
        emissive: "#ff2a1a",
        emissiveIntensity: 3,
      }),
      greenLight: new THREE.MeshStandardMaterial({
        color: "#22ff66",
        emissive: "#22ff66",
        emissiveIntensity: 3,
      }),
      strobe: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#ffffff",
        emissiveIntensity: 0,
      }),
    };
    return { body, wing, sharklet, stab, fin, nacelle, mats };
  }, []);
}

// Distance from the fuselage axis down to the bottom of the tyres with the gear down.
export const GEAR_DROP = 4.25;

function Gear({ x, z, wheels, m }: { x: number; z: number; wheels: number; m: ReturnType<typeof useAirframe>["mats"] }) {
  const tyre = 0.56;
  const top = x === 0 ? -1.7 : -1.5;
  const axle = -GEAR_DROP + tyre;
  return (
    <group position={[x, 0, z]}>
      <mesh material={m.lip} position={[0, (top + axle) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, top - axle, 10]} />
      </mesh>
      <mesh material={m.lip} position={[0, axle, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, wheels > 1 ? 1.25 : 0.2, 8]} />
      </mesh>
      {(wheels > 1 ? [-0.55, 0.55] : [0]).map((dx) => (
        <group key={dx} position={[dx, axle, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={m.fan} castShadow>
            <cylinderGeometry args={[tyre, tyre, 0.38, 24]} />
          </mesh>
          <mesh material={m.spinner} position={[0, Math.sign(dx || 1) * 0.2, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.02, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function AirlinerModel({ gear = false, shadows = false }: { gear?: boolean; shadows?: boolean }) {
  const f = useAirframe();
  const fans = useRef<THREE.Group[]>([]);
  const strobes = useRef<THREE.Mesh[]>([]);
  const keepFan = (m: THREE.Group | null) => {
    if (m && !fans.current.includes(m)) fans.current.push(m);
  };
  const keepStrobe = (m: THREE.Mesh | null) => {
    if (m && !strobes.current.includes(m)) strobes.current.push(m);
  };
  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    for (const fan of fans.current) fan.rotation.z += delta * 26;
    for (const s of strobes.current) (s.material as THREE.MeshStandardMaterial).emissiveIntensity = time % 1.3 < 0.06 ? 7 : 0;
  });

  const m = f.mats;
  return (
    <group>
      <mesh geometry={f.body} material={m.fuselage} castShadow={shadows} />
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <group position={[0, -1.15, -1.2]} rotation={[0, 0, 0.09]}>
            <mesh geometry={f.wing} material={m.wing} castShadow={shadows} />
            <mesh geometry={f.sharklet} material={m.red} position={[17.1, 0.1, 4.0]} />
            <mesh material={s > 0 ? m.greenLight : m.redLight} position={[17.25, 0.05, 3.95]}>
              <sphereGeometry args={[0.09, 8, 8]} />
            </mesh>
            <mesh ref={keepStrobe} material={m.strobe} position={[17.25, 0, 5.45]}>
              <sphereGeometry args={[0.08, 8, 8]} />
            </mesh>
            {/* Engine on its pylon */}
            <group position={[5.9, -1.25, -1.6]}>
              <mesh geometry={f.nacelle} material={m.red} castShadow={shadows} />
              <mesh material={m.lip} position={[0, 0, -2.2]}>
                <torusGeometry args={[0.98, 0.11, 12, 48]} />
              </mesh>
              <group ref={keepFan} position={[0, 0, -1.85]}>
                <mesh material={m.fan}>
                  <circleGeometry args={[0.92, 28]} />
                </mesh>
                {Array.from({ length: 18 }).map((_, i) => (
                  <mesh key={i} material={m.fan} position={[0, 0, -0.05]} rotation={[0.35, 0, (i * Math.PI * 2) / 18]}>
                    <boxGeometry args={[0.06, 1.72, 0.02]} />
                  </mesh>
                ))}
              </group>
              <mesh material={m.spinner} position={[0, 0, -2.0]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.26, 0.55, 20]} />
              </mesh>
              <mesh material={m.fan} position={[0, 0, 2.2]}>
                <circleGeometry args={[0.52, 20]} />
              </mesh>
              <mesh material={m.lip} position={[0, 0, 2.45]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.3, 0.7, 16]} />
              </mesh>
              <mesh material={m.wing} position={[0, 1.05, 0.6]}>
                <boxGeometry args={[0.32, 0.8, 3.4]} />
              </mesh>
            </group>
          </group>
          <mesh geometry={f.stab} material={m.wing} position={[0, 0.55, 14.6]} rotation={[0, 0, 0.06]} castShadow={shadows} />
        </group>
      ))}
      <mesh geometry={f.fin} material={m.fin} castShadow={shadows} />
      <mesh material={m.redLight} position={[0, -2.05, 2]}>
        <sphereGeometry args={[0.12, 8, 8]} />
      </mesh>
      {gear && (
        <>
          <Gear x={0} z={-14.6} wheels={2} m={m} />
          <Gear x={-2.9} z={1.6} wheels={2} m={m} />
          <Gear x={2.9} z={1.6} wheels={2} m={m} />
        </>
      )}
    </group>
  );
}
