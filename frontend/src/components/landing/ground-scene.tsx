"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

import { FallsSet } from "./falls-set";
import { ASPHALT_COLOR, GROUND_COLOR, NOISE, PERIOD, ROAD_Z, crownGeometry, leafTexture, patternMaterial, scatter, trunkGeometry, world, type TreeSpot } from "./ground-kit";
import { Bus } from "./vehicles";

// Ground leg of the landing story, in two places. First a monsoon gorge where a train crosses a
// stone bridge in front of a waterfall; the camera then pushes into the spray and comes out on a
// country highway beside an intercity coach.
//
// `progress` is the scroll position inside this leg in vh: 0 is the moment the clouds clear,
// SWITCH is the hand-over inside the spray, END is the hand-off to the next section.

const SWITCH = 470;
const END = 820;

const TRAIN_SPEED = 9; // m/s: trains take the gorge slowly
const BUS_SPEED = 22; // m/s, about 80 km/h
const BUS_Z = ROAD_Z - 1.9; // keep-left lane
const BUS_X = -32;
const SUN = new THREE.Vector3(0.72, 0.5, 0.48).normalize();
const CLEAR = [0.76, 0.85, 0.95] as const;
const MONSOON = [0.8, 0.83, 0.85] as const;

// Scratch values for the frame loop.
const p = new THREE.Vector3();
const l = new THREE.Vector3();
const focus = new THREE.Vector3();
const fogColor = new THREE.Color();

type Path = { keys: [number[], number[]][]; knots: [number, number][] };

// Camera paths as [position, look-at] keys, and the scroll (vh) at which each held key is reached.
const FALLS: Path = {
  keys: [
    [[0, 430, 400], [0, 60, -80]],
    [[40, 150, 260], [0, 40, -60]],
    [[0, 14, 112], [0, 26, -60]], // the classic view: bridge, train and falls
    [[10, 6, 74], [-3, 10, -40]],
    [[0, 1, 26], [0, -2, -30]], // into the spray
  ],
  knots: [
    [0, 0],
    [150, 1],
    [240, 2],
    [400, 3],
    [SWITCH, 4],
  ],
};
const ROAD: Path = {
  keys: [
    [[-18, 5, ROAD_Z + 18], [-34, 2, BUS_Z]],
    [[-24, 2.2, ROAD_Z + 6.7], [-36, 1.8, BUS_Z]], // beside the coach
    [[-30, 2.1, ROAD_Z + 6.4], [-42, 1.9, BUS_Z]],
    [[-31, 4, ROAD_Z + 8], [-45, 3, ROAD_Z - 1]],
  ],
  knots: [
    [SWITCH, 0],
    [540, 1],
    [720, 2],
    [END, 3],
  ],
};

function keyAt(path: Path, u: number) {
  const { knots } = path;
  if (u <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    const [u1, k1] = knots[i];
    if (u <= u1) {
      const [u0, k0] = knots[i - 1];
      const t = (u - u0) / (u1 - u0);
      const e = t * t * t * (t * (t * 6 - 15) + 10);
      return k0 + (k1 - k0) * e;
    }
  }
  return knots[knots.length - 1][1];
}

function curves(path: Path) {
  return {
    pos: new THREE.CatmullRomCurve3(path.keys.map(([q]) => new THREE.Vector3(...q)), false, "centripetal"),
    look: new THREE.CatmullRomCurve3(path.keys.map(([, q]) => new THREE.Vector3(...q)), false, "centripetal"),
    last: path.keys.length - 1,
  };
}

function Rig({ progress, reduce }: { progress: MotionValue<number>; reduce: boolean }) {
  const paths = useMemo(() => ({ falls: curves(FALLS), road: curves(ROAD) }), []);
  const k = useRef(-1);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const u = progress.get();
    const set = u < SWITCH ? "falls" : "road";
    if (set !== world.set) {
      // The hand-over happens inside the spray: snap the camera to the other path, and bring the
      // train back to the near end of the bridge for the next time the gorge is shown.
      world.set = set;
      k.current = -1;
      if (set === "falls") world.trainStart = world.d;
    }
    world.u = u;
    world.d += (reduce ? 0 : set === "falls" ? TRAIN_SPEED : BUS_SPEED) * dt;
    // While the gorge is still hidden in cloud, hold the train at the near end of the bridge so it
    // is crossing when the view opens up.
    if (set === "falls" && u < 60) world.trainStart = world.d;

    const path = set === "falls" ? FALLS : ROAD;
    const c = paths[set];
    const target = keyAt(path, u);
    k.current = k.current < 0 ? target : k.current + (target - k.current) * (1 - Math.exp(-dt * 5));
    const t = k.current / c.last;
    c.pos.getPoint(t, p);
    c.look.getPoint(t, l);
    // A little ride vibration when the camera is down beside the coach.
    if (set === "road" && !reduce) {
      const near = 1 - THREE.MathUtils.smoothstep(p.y, 3, 9);
      const time = state.clock.elapsedTime;
      p.y += (Math.sin(time * 11.0) * 0.005 + Math.sin(time * 4.7) * 0.008) * near;
    }
    const camera = state.camera as THREE.PerspectiveCamera;
    camera.position.copy(p);
    camera.lookAt(l);
    // Near plane scales with height so distant ground keeps its depth precision.
    camera.near = THREE.MathUtils.clamp(p.y * 0.04, 0.25, 6);
    camera.updateProjectionMatrix();
    focus.copy(l);

    const fog = state.scene.fog as THREE.FogExp2 | null;
    if (fog) {
      if (set === "falls") {
        // Thick in the cloud, then thin enough that what the camera looks at keeps about two
        // thirds of its contrast however far away it is.
        const clear = Math.min(0.0034, 0.62 / Math.max(p.distanceTo(l), 1));
        fog.density = THREE.MathUtils.lerp(0.02, clear, THREE.MathUtils.smoothstep(u, 10, 110));
        fogColor.setRGB(MONSOON[0], MONSOON[1], MONSOON[2], THREE.SRGBColorSpace);
      } else {
        fog.density = 0.0021;
        fogColor.setRGB(CLEAR[0], CLEAR[1], CLEAR[2], THREE.SRGBColorSpace);
      }
      fog.color.copy(fogColor);
    }
  }, -1);
  return null;
}

/* ---------- Sky ---------- */

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;
const skyFragment = /* glsl */ `
  uniform vec3 uSun;
  uniform float uTime;
  uniform float uOvercast;
  varying vec3 vDir;
  ${NOISE}
  void main() {
    vec3 d = normalize(vDir);
    vec3 top = mix(vec3(0.10, 0.33, 0.74), vec3(0.62, 0.67, 0.72), uOvercast);
    vec3 mid = mix(vec3(0.36, 0.60, 0.90), vec3(0.72, 0.76, 0.79), uOvercast);
    vec3 hor = mix(vec3(${CLEAR.join(", ")}), vec3(${MONSOON.join(", ")}), uOvercast);
    float sy = clamp(d.y * 2.4 + 0.02, 0.0, 1.0);
    vec3 col = mix(mix(hor, mid, smoothstep(0.0, 0.3, sy)), top, smoothstep(0.25, 1.0, sy));
    float sun = max(dot(d, uSun), 0.0);
    col += vec3(1.0, 0.95, 0.85) * pow(sun, 10.0) * 0.12 * (1.0 - uOvercast);
    // The cloud deck we just came down through, seen from underneath.
    if (d.y > 0.0) {
      vec2 p = d.xz / (d.y + 0.06) * 0.9 + vec2(uTime * 0.006, 0.0);
      float c = gFbm(p, 1e4);
      float cover = smoothstep(mix(0.5, 0.3, uOvercast), 0.74, c) * smoothstep(0.0, 0.14, d.y);
      float lit = smoothstep(0.35, 0.8, gFbm(p * 1.7 + 4.0, 1e4));
      vec3 cloud = mix(vec3(0.72, 0.76, 0.83), vec3(0.98, 0.98, 0.99), lit);
      col = mix(col, cloud, cover * 0.92);
    }
    col = mix(col, hor, exp(-abs(d.y) * 40.0) * 0.6);
    if (d.y < 0.0) col = hor;
    gl_FragColor = vec4(toLinear(col), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const [uniforms] = useState(() => ({ uSun: { value: SUN.clone() }, uTime: { value: 0 }, uOvercast: { value: 1 } }));
  useFrame((state) => {
    const m = mat.current;
    if (m) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uOvercast.value = world.set === "falls" ? 1 : 0;
    }
    mesh.current?.position.copy(state.camera.position);
  });
  return (
    <mesh ref={mesh} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[4000, 48, 24]} />
      <shaderMaterial ref={mat} vertexShader={skyVertex} fragmentShader={skyFragment} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

/* ---------- Road set: farmland, highway, coach ---------- */

function Land() {
  const mats = useMemo(
    () => ({
      ground: patternMaterial("ground", GROUND_COLOR, { roughness: 0.96 }),
      asphalt: patternMaterial("asphalt", ASPHALT_COLOR, { roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    }),
    [],
  );
  const surfaces = useRef<THREE.Mesh[]>([]);
  const keep = (m: THREE.Mesh | null) => {
    if (m && !surfaces.current.includes(m)) surfaces.current.push(m);
  };
  useFrame(() => {
    const offset = world.d % PERIOD;
    for (const m of surfaces.current) (m.material as THREE.Material).userData.offset.value = offset;
  });
  return (
    <group>
      <mesh ref={keep} material={mats.ground} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9000, 9000, 1, 1]} />
      </mesh>
      <mesh ref={keep} material={mats.asphalt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, ROAD_Z]} receiveShadow>
        <planeGeometry args={[6000, 7.6]} />
      </mesh>
    </group>
  );
}

function Instances({ geometry, material, items, castShadow = true }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: THREE.Matrix4[]; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow frustumCulled={false} />;
}

function line(count: number, step: number, start: number, at: (x: number) => THREE.Matrix4) {
  return Array.from({ length: count }, (_, i) => at(start + i * step));
}

// Lane markings and the roadside power line.
function Roadside() {
  const dashes = useRef<THREE.Group>(null);
  const poles = useRef<THREE.Group>(null);
  const kit = useMemo(() => {
    const m = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    return {
      wire: new THREE.MeshStandardMaterial({ color: "#3a3631", roughness: 0.5, metalness: 0.6 }),
      paint: new THREE.MeshStandardMaterial({ color: "#ece8de", roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      pole: new THREE.MeshStandardMaterial({ color: "#a8a39a", roughness: 0.85 }),
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      dashes: line(140, 7.5, -420, (x) => m(x, 0.065, ROAD_Z, 3, 0.002, 0.14)),
      roadPoles: line(24, 45, -420, (x) => m(x, 4.5, ROAD_Z - 6.4, 0.24, 9, 0.24)),
      crossArms: line(24, 45, -420, (x) => m(x, 8.6, ROAD_Z - 6.4, 0.12, 0.12, 1.8)),
    };
  }, []);
  useFrame(() => {
    if (dashes.current) dashes.current.position.x = -(world.d % 7.5);
    if (poles.current) poles.current.position.x = -(world.d % 45);
  });
  return (
    <group>
      <group ref={dashes}>
        <Instances geometry={kit.box} material={kit.paint} items={kit.dashes} castShadow={false} />
      </group>
      {[-3.55, 3.55].map((z) => (
        <mesh key={z} material={kit.paint} position={[0, 0.062, ROAD_Z + z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6000, 0.15]} />
        </mesh>
      ))}
      <group ref={poles}>
        <Instances geometry={kit.cyl} material={kit.pole} items={kit.roadPoles} />
        <Instances geometry={kit.box} material={kit.pole} items={kit.crossArms} />
      </group>
      {[-0.7, 0, 0.7].map((dz) => (
        <mesh key={dz} material={kit.wire} position={[0, 8.75 - Math.abs(dz) * 0.1, ROAD_Z - 6.4 + dz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 6000, 4]} />
        </mesh>
      ))}
    </group>
  );
}

const TREE_PERIOD = 400;
const BROAD_GREENS = ["#c9d9a6", "#b7cf95", "#d5dfae", "#a9c288", "#c4d39a"];
const TALL_GREENS = ["#c2d3a8", "#b3c79c", "#d0d9b2"];
const BUSH_GREENS = ["#c9d49c", "#bccc92", "#d9d6a2"];

function TreeKind({ spots, crown, trunk, leaves, bark, palette }: { spots: TreeSpot[]; crown: THREE.BufferGeometry; trunk: THREE.BufferGeometry | null; leaves: THREE.Material; bark: THREE.Material; palette: string[] }) {
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(
    () => spots.map((t) => new THREE.Matrix4().compose(new THREE.Vector3(t.x, 0, t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.r), new THREE.Vector3(t.s, t.s * (0.9 + t.tint * 0.25), t.s))),
    [spots],
  );
  useLayoutEffect(() => {
    const m = crownRef.current;
    if (!m) return;
    const c = new THREE.Color();
    spots.forEach((t, i) => {
      m.setMatrixAt(i, items[i]);
      m.setColorAt(i, c.set(palette[Math.floor(t.tint * palette.length) % palette.length]));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [spots, items, palette]);
  return (
    <>
      <instancedMesh ref={crownRef} args={[crown, leaves, items.length]} castShadow receiveShadow frustumCulled={false} />
      {trunk && <Instances geometry={trunk} material={bark} items={items} />}
    </>
  );
}

// Roadside trees, from the verges out to the horizon. The camera sits on the near shoulder, so the
// near side keeps a clear strip around it.
function Trees() {
  const group = useRef<THREE.Group>(null);
  const kit = useMemo(() => {
    const leaves = new THREE.MeshLambertMaterial({ map: leafTexture(), alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true });
    return {
      leaves,
      bark: new THREE.MeshStandardMaterial({ color: "#4b3d30", roughness: 0.95 }),
      paleBark: new THREE.MeshStandardMaterial({ color: "#a59a8a", roughness: 0.9 }),
      broad: crownGeometry({ seed: 3, cards: 80, center: [0, 5.6, 0], radius: [3.7, 2.9, 3.7], size: 2.3 }),
      tall: crownGeometry({ seed: 5, cards: 60, center: [0, 9.2, 0], radius: [2.3, 4.3, 2.3], size: 2.0 }),
      bush: crownGeometry({ seed: 9, cards: 22, center: [0, 0.9, 0], radius: [1.5, 0.95, 1.5], size: 1.3 }),
      broadTrunk: trunkGeometry(4.6, 0.3, 3, 21),
      tallTrunk: trunkGeometry(8.8, 0.22, 2, 23),
    };
  }, []);
  const spots = useMemo(() => {
    const r = ROAD_Z;
    return {
      broad: scatter(
        41,
        [
          { z: [r + 22, r + 50], count: 18, clump: 3 },
          { z: [r - 13, r - 40], count: 30, clump: 3 },
          { z: [r + 50, r + 320], count: 44, clump: 6 },
          { z: [r - 40, r - 320], count: 56, clump: 6 },
        ],
        TREE_PERIOD,
      ),
      tall: scatter(
        43,
        [
          { z: [r + 24, r + 55], count: 8, clump: 4 },
          { z: [r - 15, r - 60], count: 20, clump: 4 },
          { z: [r + 55, r + 300], count: 20, clump: 6 },
          { z: [r - 60, r - 300], count: 26, clump: 6 },
        ],
        TREE_PERIOD,
      ),
      bush: scatter(
        47,
        [
          { z: [r + 9, r + 16], count: 22, clump: 3 },
          { z: [r - 6.5, r - 14], count: 20, clump: 3 },
          { z: [r + 16, r + 40], count: 14, clump: 3 },
        ],
        TREE_PERIOD,
      ),
    };
  }, []);
  useFrame(() => {
    if (group.current) group.current.position.x = -(world.d % TREE_PERIOD);
  });
  return (
    <group ref={group}>
      <TreeKind spots={spots.broad} crown={kit.broad} trunk={kit.broadTrunk} leaves={kit.leaves} bark={kit.bark} palette={BROAD_GREENS} />
      <TreeKind spots={spots.tall} crown={kit.tall} trunk={kit.tallTrunk} leaves={kit.leaves} bark={kit.paleBark} palette={TALL_GREENS} />
      <TreeKind spots={spots.bush} crown={kit.bush} trunk={null} leaves={kit.leaves} bark={kit.bark} palette={BUSH_GREENS} />
    </group>
  );
}

function RoadSet({ reduce }: { reduce: boolean }) {
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    if (root.current) root.current.visible = world.set === "road";
  });
  return (
    <group ref={root} visible={false}>
      <Land />
      <Roadside />
      <Trees />
      <group position={[BUS_X, 0.06, BUS_Z]}>
        <Bus reduce={reduce} />
      </group>
    </group>
  );
}

/* ---------- Light ---------- */

function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const [target] = useState(() => new THREE.Object3D());
  useFrame((state) => {
    const s = light.current;
    if (!s) return;
    const falls = world.set === "falls";
    // Diffuse monsoon light in the gorge, clear sun on the plains.
    s.intensity = falls ? 1.25 : 2.7;
    if (hemi.current) {
      hemi.current.intensity = falls ? 1.05 : 0.55;
      hemi.current.color.set(falls ? "#dde5ec" : "#b9d0ee");
    }
    // Keep the shadow map around what the camera is looking at.
    const dist = state.camera.position.distanceTo(focus);
    target.position.copy(focus);
    s.position.copy(focus).addScaledVector(SUN, 260);
    const ext = THREE.MathUtils.clamp(dist * 0.55, 30, 180);
    const cam = s.shadow.camera;
    if (cam.right !== ext) {
      cam.left = -ext;
      cam.right = ext;
      cam.top = ext;
      cam.bottom = -ext;
      cam.updateProjectionMatrix();
    }
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.7}
        color="#fff0dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
        shadow-camera-near={10}
        shadow-camera-far={700}
      />
      <hemisphereLight ref={hemi} args={["#b9d0ee", "#4a5230", 0.55]} />
    </>
  );
}

export default function GroundScene({ progress, live, reduce }: { progress: MotionValue<number>; live: boolean; reduce: boolean }) {
  const fog = useMemo(() => new THREE.Color().setRGB(MONSOON[0], MONSOON[1], MONSOON[2], THREE.SRGBColorSpace), []);
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      frameloop={live ? "always" : "demand"}
      camera={{ fov: 40, near: 0.3, far: 9000, position: [0, 430, 400] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <fogExp2 attach="fog" args={[fog, 0.02]} />
      <Rig progress={progress} reduce={reduce} />
      <SkyDome />
      <Sun />
      <Environment resolution={128} frames={1} environmentIntensity={0.4}>
        <color attach="background" args={["#9fbde0"]} />
        <Lightformer form="rect" intensity={2.4} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 20, 1]} color="#e9f1ff" />
        <Lightformer form="rect" intensity={1.2} position={[0, -4, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[20, 20, 1]} color="#6f7a4a" />
        <Lightformer form="rect" intensity={3} position={[4, 4, 6]} scale={[6, 3, 1]} color="#fff2df" />
      </Environment>
      <FallsSet reduce={reduce} />
      <RoadSet reduce={reduce} />
    </Canvas>
  );
}
