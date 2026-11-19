"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { NOISE, crownGeometry, leafTexture, rng, trunkGeometry, world } from "./ground-kit";
import { RAIL_TOP, Train } from "./vehicles";

// A monsoon gorge in the Western Ghats: a tiered waterfall pours down a cliff, under the arch of a
// mossy masonry railway bridge and on down the valley, with rainforest on every slope. Built from
// code, after the railway crossing at Dudhsagar.
//
// The bridge runs along x at z = 0 with the rail bed at y = 0. The falls come down the wall behind
// it (-z) and continue down the valley in front (+z), where the camera is.

/* ---------- Terrain ---------- */

function hash2(x: number, z: number) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function fbm(x: number, z: number, oct = 5) {
  let s = 0;
  let a = 0.5;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x, z);
    x = x * 2.03 + 17.1;
    z = z * 2.03 + 9.7;
    a *= 0.5;
  }
  return s;
}
const ss = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Water courses: [centre x as a function of z, half width, groove depth, z range].
type Course = { cx: (z: number) => number; w: (z: number) => number; depth: number; from: number; to: number };
const MAIN: Course = {
  cx: (z) => (z < -14 ? Math.sin(z * 0.02) * 6 : 0),
  w: (z) => (z < -14 ? 40 - 22 * ss(-185, -20, z) : 10 + 0.05 * z),
  depth: 9,
  from: -200,
  to: 260,
};
const LEFT: Course = { cx: (z) => -62 + (z + 120) * 0.08, w: () => 9, depth: 5, from: -190, to: -36 };
const RIGHT: Course = { cx: (z) => 56 + (z + 60) * 0.14, w: () => 10, depth: 5, from: -160, to: -24 };
const COURSES = [MAIN, LEFT, RIGHT];

const BACK_TOP = 290;

export function heightAt(x: number, z: number) {
  const ax = Math.abs(x);
  // Amphitheatre wall behind the bridge, climbing in tiers.
  const tb = Math.min(Math.max((-z - 14) / 175, 0), 1);
  const tiers = 6;
  const k = tb * tiers + (fbm(x * 0.01, 3.1) - 0.5) * 0.6;
  const stepped = (Math.floor(k) + ss(0.5, 0.92, k - Math.floor(k))) / tiers;
  const back = -6 + (BACK_TOP + 6) * Math.min(Math.max(THREE.MathUtils.lerp(tb, stepped, 0.85), 0), 1);
  // Valley falling away in front of the bridge.
  const front = -6 - 160 * ss(0, 240, z);
  let h = z < -14 ? back : z > 0 ? front : -6;
  // Gorge walls either side, steep near the bridge, opening out down the valley.
  const half = z < -14 ? 95 : 20 + z * 0.22;
  h += Math.max(0, ax - half) * (z < -14 ? 0.9 : 1.25);
  // Rock and forest relief.
  h += (fbm(x * 0.012, z * 0.012) - 0.5) * 36 + (fbm(x * 0.05, z * 0.05) - 0.5) * 7;
  // Grooves cut by the water.
  for (const c of COURSES) {
    if (z < c.from - 20 || z > c.to + 20) continue;
    const fade = ss(c.from - 20, c.from, z) * (1 - ss(c.to, c.to + 20, z));
    const d = (x - c.cx(z)) / (c.w(z) * 1.3);
    h -= c.depth * Math.exp(-d * d) * fade;
  }
  // Rail bench cut into the hillside; under the bridge the ground keeps clear of the deck.
  const bench = 1 - ss(6, 11, Math.abs(z));
  if (bench > 0) {
    const level = THREE.MathUtils.lerp(Math.min(h, -5), 0, ss(44, 56, ax));
    h = THREE.MathUtils.lerp(h, level, bench);
  }
  return h;
}

function slopeAt(x: number, z: number) {
  const e = 2;
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

function terrainGeometry() {
  const size = 1100;
  const seg = 280;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -120);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  return g;
}

// Surface relief without extra geometry: perturb the shading normal by the screen-space slope of a
// height function (the same construction as three's bump mapping).
const BUMP = /* glsl */ `
  vec3 bumpNormal(vec3 surfPos, vec3 n, float h, float strength, float faceDirection) {
    vec3 sx = dFdx(surfPos);
    vec3 sy = dFdy(surfPos);
    vec3 r1 = cross(sy, n);
    vec3 r2 = cross(n, sx);
    float det = dot(sx, r1) * faceDirection;
    vec3 grad = sign(det) * (dFdx(h) * strength * r1 + dFdy(h) * strength * r2);
    return normalize(abs(det) * n - grad);
  }
`;

// Wet basalt where it is steep, rainforest canopy where it is not, moss and water stains on the rock.
function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vW;
        varying vec3 vWN;
        ${NOISE}
        ${BUMP}
        float forestMask() {
          float n = gFbm(vW.xz / 18.0, 1e5);
          return smoothstep(0.4, 0.66, vWN.y + (n - 0.5) * 0.3);
        }
        // Rock: blocky columnar joints and vertical runnels. Forest: a crowd of rounded crowns.
        float relief(float forest) {
          float face = abs(vWN.x) > abs(vWN.z) ? vW.z : vW.x;
          float rock = gFbm(vec2(face / 3.0, vW.y / 1.4), 1e5) + 0.35 * gNoise(vec2(face * 1.3, vW.y * 0.25), 1e6);
          float crowns = 1.0 - abs(gNoise(vW.xz / 2.6, 1e6) * 2.0 - 1.0);
          crowns = crowns * 0.65 + gNoise(vW.xz / 0.9, 1e6) * 0.35;
          return mix(rock * 1.6, crowns * 1.3, forest);
        }
        vec3 terrainColor(float forest) {
          vec2 q = vW.xz;
          float n = gFbm(q / 18.0, 1e5);
          float face = abs(vWN.x) > abs(vWN.z) ? vW.z : vW.x;
          vec3 rock = mix(vec3(0.12, 0.12, 0.11), vec3(0.27, 0.25, 0.21), gFbm(vec2(face / 6.0, vW.y / 2.0), 1e5));
          rock *= 0.75 + 0.45 * gNoise(vec2(face * 0.8, vW.y * 0.12), 1e6);
          float moss = smoothstep(0.42, 0.66, gFbm(vec2(face, vW.y) / 9.0 + 5.0, 1e5) + vWN.y * 0.35);
          rock = mix(rock, vec3(0.13, 0.22, 0.07) * (0.7 + 0.6 * gNoise(vec2(face, vW.y) / 2.0, 1e6)), moss * 0.9);
          float crown = gNoise(q / 2.6, 1e6);
          vec3 canopy = mix(vec3(0.05, 0.12, 0.035), vec3(0.17, 0.3, 0.08), crown * 0.75 + n * 0.25);
          canopy = mix(canopy, vec3(0.24, 0.36, 0.11), smoothstep(0.75, 0.95, gNoise(q / 9.0 + 3.0, 1e6)) * 0.5);
          return toLinear(mix(rock, canopy, forest));
        }`,
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        "float forest = forestMask();\nvec4 diffuseColor = vec4( terrainColor(forest), opacity );",
      )
      .replace(
        "#include <normal_fragment_begin>",
        "#include <normal_fragment_begin>\nnormal = bumpNormal(-vViewPosition, normal, relief(forest), mix(1.6, 0.45, forest), faceDirection);",
      );
  };
  m.customProgramCacheKey = () => "falls-terrain";
  return m;
}

/* ---------- Water ---------- */

// A ribbon laid over the terrain along a water course, a little proud of the rock.
function ribbon(c: Course, step = 2.5, lift = 0.9) {
  const pos: number[] = [];
  const uv: number[] = [];
  const steep: number[] = [];
  const idx: number[] = [];
  const across = 9;
  let dist = 0;
  let prev: THREE.Vector3 | null = null;
  let row = 0;
  for (let z = c.from; z <= c.to; z += step) {
    const cx = c.cx(z);
    const w = c.w(z);
    const centre = new THREE.Vector3(cx, heightAt(cx, z), z);
    let s = 0;
    if (prev) {
      const seg = centre.distanceTo(prev);
      dist += seg;
      s = Math.abs(centre.y - prev.y) / Math.max(seg, 1e-3);
    }
    prev = centre;
    for (let i = 0; i < across; i++) {
      const u = i / (across - 1);
      const x = cx + (u - 0.5) * 2 * w;
      pos.push(x, heightAt(x, z) + lift, z);
      uv.push(u, dist);
      steep.push(s);
    }
    if (row > 0) {
      for (let i = 0; i < across - 1; i++) {
        const a = (row - 1) * across + i;
        const b = row * across + i;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    row++;
  }
  // Strands thin out where they start and end rather than stopping square.
  const fade = uv.filter((_, i) => i % 2 === 1).map((v) => Math.min(1, v / 14, (dist - v) / 14));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aSteep", new THREE.Float32BufferAttribute(steep, 1));
  g.setAttribute("aFade", new THREE.Float32BufferAttribute(fade, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const waterVertex = /* glsl */ `
  attribute float aSteep;
  attribute float aFade;
  varying vec2 vUv;
  varying float vSteep;
  varying float vFade;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vSteep = aSteep;
    vFade = aFade;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  varying float vSteep;
  varying float vFade;
  #include <fog_pars_fragment>
  ${NOISE}
  void main() {
    // Steep drops run fast and break into curtains; runs over the ledges churn and spread.
    float fall = smoothstep(0.25, 1.2, vSteep);
    float speed = mix(3.0, 12.0, fall);
    float x = vUv.x + uSeed * 0.37;
    float y = vUv.y + uSeed * 31.0;
    float streak = gFbm(vec2(x * 30.0, y * 0.12 - uTime * speed * 0.12), 1e5);
    float sheets = gFbm(vec2(x * 7.0, y * 0.035 - uTime * speed * 0.035), 1e5);
    float churn = gFbm(vec2(x * 12.0, y * 0.5 - uTime * speed * 0.5), 1e5);
    float strands = gNoise(vec2(x * 46.0, y * 0.015 - uTime * 0.05), 1e6);
    float body = mix(sheets, streak, 0.55) + churn * 0.25 * (1.0 - fall) + (strands - 0.5) * 0.35;
    float edge = min(vUv.x, 1.0 - vUv.x) * 2.0 + (gNoise(vec2(uSeed * 7.0, y * 0.06), 1e6) - 0.5) * 0.5;
    float cover = body + smoothstep(0.0, 0.6, edge) * 0.3 - 0.62 + fall * 0.08 + (1.0 - fall) * 0.22;
    float alpha = smoothstep(0.0, 0.16, cover) * smoothstep(0.0, 0.14, edge) * clamp(vFade, 0.0, 1.0);
    float foam = smoothstep(0.35, 0.8, streak + churn * 0.3 + (1.0 - fall) * 0.25);
    vec3 col = mix(vec3(0.68, 0.74, 0.75), vec3(0.98, 0.985, 0.99), foam * 0.8 + 0.2);
    gl_FragColor = vec4(toLinear(col), alpha * mix(0.78, 0.96, fall));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// Each course gets two layers of water at different heights over the rock, for depth.
function useWater() {
  return useMemo(() => {
    const layer = (seed: number) =>
      new THREE.ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSeed: { value: seed } }]),
        transparent: true,
        depthWrite: false,
        fog: true,
        side: THREE.DoubleSide,
      });
    const layers = [
      { mat: layer(0), lift: 0.8 },
      { mat: layer(1), lift: 2.4 },
    ];
    return layers.flatMap(({ mat, lift }) => COURSES.map((c) => ({ mat, geo: ribbon(c, 2.5, lift) })));
  }, []);
}

// Spray: soft billboards that swell and drift up from where the water lands.
const sprayVertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  varying float vAlpha;
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    float life = fract(uTime * (0.05 + aSeed.w * 0.05) + aSeed.z);
    float size = aSeed.x * (0.6 + life * 0.9);
    vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    centre.y += life * aSeed.y;
    vec4 mvPosition = viewMatrix * vec4(centre, 1.0);
    mvPosition.xy += position.xy * size;
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = sin(life * 3.14159);
    vUv = uv;
    #include <fog_vertex>
  }
`;
const sprayFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    gl_FragColor = vec4(vec3(0.93, 0.95, 0.96), a * a * a * vAlpha * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function Spray() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const kit = useMemo(() => {
    const rnd = rng(77);
    const spots: [number, number, number, number, number][] = [];
    const add = (x: number, z: number, n: number, size: number, rise: number, spread: number) => {
      for (let i = 0; i < n; i++) {
        const px = x + (rnd() - 0.5) * spread;
        const pz = z + (rnd() - 0.5) * spread * 0.5;
        spots.push([px, heightAt(px, pz) + rnd() * 6, pz, size * (0.6 + rnd() * 0.8), rise * (0.5 + rnd())]);
      }
    };
    add(0, -18, 22, 60, 34, 46); // where the upper falls land behind the bridge
    add(0, 8, 10, 40, 24, 24); // through the arch
    add(0, 40, 12, 56, 28, 30); // the lower falls
    add(0, -70, 10, 70, 34, 60); // upper tiers
    add(0, -130, 10, 80, 34, 70);
    add(-58, -60, 6, 40, 20, 16);
    add(56, -40, 6, 40, 20, 16);
    const geo = new THREE.PlaneGeometry(1, 1);
    const seeds = new Float32Array(spots.length * 4);
    spots.forEach((s, i) => seeds.set([s[3], s[4], rnd(), rnd()], i * 4));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
    const mat = new THREE.ShaderMaterial({
      vertexShader: sprayVertex,
      fragmentShader: sprayFragment,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uOpacity: { value: 0.26 } }]),
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    return { spots, geo, mat };
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    kit.spots.forEach((s, i) => {
      o.position.set(s[0], s[1], s[2]);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [kit]);
  useFrame((state) => {
    const m = ref.current;
    if (m) (m.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.elapsedTime;
  });
  return <instancedMesh ref={ref} args={[kit.geo, kit.mat, kit.spots.length]} frustumCulled={false} renderOrder={2} />;
}

/* ---------- Bridge and track ---------- */

function stoneMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vW;
        varying vec3 vWN;
        ${NOISE}
        vec3 stoneColor() {
          // Coursed masonry, darkened by spray, with moss thick on the upper courses and ledges.
          float face = abs(vWN.z) > 0.5 ? vW.x : vW.z;
          float row = floor(vW.y / 0.55);
          float bx = fract((face + mod(row, 2.0) * 0.6) / 1.2);
          float by = fract(vW.y / 0.55);
          float mortar = smoothstep(0.0, 0.05, bx) * smoothstep(1.0, 0.95, bx) * smoothstep(0.0, 0.08, by) * smoothstep(1.0, 0.92, by);
          float block = gHash(vec2(floor((face + mod(row, 2.0) * 0.6) / 1.2), row));
          vec3 c = vec3(0.27, 0.26, 0.23) * (0.75 + 0.4 * block) * (0.55 + 0.45 * mortar);
          c *= 0.8 + 0.35 * gFbm(vec2(face, vW.y) / 3.0, 1e5);
          float mossy = gFbm(vec2(face, vW.y) / 4.0 + 3.0, 1e5) + smoothstep(-22.0, 0.0, vW.y) * 0.35 + smoothstep(0.3, 0.8, vWN.y) * 0.6;
          c = mix(c, vec3(0.17, 0.29, 0.08) * (0.7 + 0.5 * gNoise(vec2(face, vW.y) * 3.0, 1e6)), smoothstep(0.62, 0.85, mossy));
          return toLinear(c);
        }`,
      )
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( stoneColor(), opacity );");
  };
  m.customProgramCacheKey = () => "falls-stone";
  return m;
}

const SPAN = 50;
const DECK = 2.6;
const HALF_W = 3.6;

function bridgeGeometry() {
  // Spandrel wall with the main arch over the falls and a smaller relieving arch to the left.
  const wall = new THREE.Shape();
  wall.moveTo(-SPAN, -95);
  wall.lineTo(SPAN, -95);
  wall.lineTo(SPAN, -DECK);
  wall.lineTo(-SPAN, -DECK);
  wall.closePath();
  const arch = (cx: number, r: number, spring: number) => {
    const h = new THREE.Path();
    h.moveTo(cx - r, -92);
    h.lineTo(cx - r, spring);
    h.absarc(cx, spring, r, Math.PI, 0, true);
    h.lineTo(cx + r, -92);
    h.closePath();
    return h;
  };
  wall.holes.push(arch(0, 13, -17), arch(-34, 6.5, -16));
  const g = new THREE.ExtrudeGeometry(wall, { depth: HALF_W * 2 - 0.6, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, -(HALF_W * 2 - 0.6) / 2);
  return g;
}

function Track() {
  const sleepers = useRef<THREE.InstancedMesh>(null);
  const kit = useMemo(() => {
    const s = new THREE.Shape([new THREE.Vector2(-2.6, 0), new THREE.Vector2(2.6, 0), new THREE.Vector2(1.75, 0.36), new THREE.Vector2(-1.75, 0.36)]);
    const ballast = new THREE.ExtrudeGeometry(s, { depth: 900, bevelEnabled: false });
    ballast.rotateY(Math.PI / 2);
    ballast.translate(-450, 0, 0);
    return {
      ballast,
      gravel: new THREE.MeshStandardMaterial({ color: "#5b564f", roughness: 1 }),
      concrete: new THREE.MeshStandardMaterial({ color: "#7d786f", roughness: 0.9 }),
      rail: new THREE.MeshStandardMaterial({ color: "#77736e", roughness: 0.32, metalness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: "#23262a", roughness: 0.6, metalness: 0.6 }),
      count: 1200,
    };
  }, []);
  useLayoutEffect(() => {
    const m = sleepers.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < kit.count; i++) {
      o.position.set(-360 + i * 0.6, 0.44, 0);
      o.scale.set(0.26, 0.17, 2.7);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [kit]);
  return (
    <group>
      <mesh geometry={kit.ballast} material={kit.gravel} receiveShadow />
      <instancedMesh ref={sleepers} args={[undefined, kit.concrete, kit.count]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {[-0.84, 0.84].map((z) => (
        <mesh key={z} material={kit.rail} position={[0, RAIL_TOP - 0.08, z]}>
          <boxGeometry args={[900, 0.16, 0.08]} />
        </mesh>
      ))}
      {/* Parapet railings along the deck */}
      {[-HALF_W + 0.1, HALF_W - 0.1].map((z) => (
        <group key={z}>
          <mesh material={kit.steel} position={[0, 1.15, z]}>
            <boxGeometry args={[SPAN * 2, 0.07, 0.07]} />
          </mesh>
          <mesh material={kit.steel} position={[0, 0.6, z]}>
            <boxGeometry args={[SPAN * 2, 0.05, 0.05]} />
          </mesh>
          {Array.from({ length: 41 }).map((_, i) => (
            <mesh key={i} material={kit.steel} position={[-SPAN + i * 2.5, 0.58, z]}>
              <boxGeometry args={[0.07, 1.16, 0.07]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Bridge() {
  const kit = useMemo(() => ({ wall: bridgeGeometry(), stone: stoneMaterial() }), []);
  return (
    <group>
      <mesh geometry={kit.wall} material={kit.stone} castShadow receiveShadow />
      {/* Deck slab with a projecting cornice */}
      <mesh material={kit.stone} position={[0, -DECK / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[SPAN * 2 + 2, DECK, HALF_W * 2]} />
      </mesh>
      <mesh material={kit.stone} position={[0, -DECK + 0.25, 0]}>
        <boxGeometry args={[SPAN * 2 + 2.4, 0.5, HALF_W * 2 + 0.6]} />
      </mesh>
      {/* Pilasters at the ends of the main arch */}
      {[-16.5, 16.5].map((x) => (
        <mesh key={x} material={kit.stone} position={[x, -40, 0]} castShadow>
          <boxGeometry args={[3, 76, HALF_W * 2 + 1.2]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Rainforest ---------- */

function Jungle() {
  const broadRef = useRef<THREE.InstancedMesh>(null);
  const tallRef = useRef<THREE.InstancedMesh>(null);
  const kit = useMemo(() => {
    const map = leafTexture();
    const leaves = new THREE.MeshLambertMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true });
    const broad = crownGeometry({ seed: 13, cards: 34, center: [0, 5.5, 0], radius: [4.2, 3.2, 4.2], size: 3.0 });
    const tall = crownGeometry({ seed: 17, cards: 30, center: [0, 10, 0], radius: [3.4, 4.6, 3.4], size: 2.8 });
    const rnd = rng(101);
    const spots: { x: number; y: number; z: number; s: number; r: number; tall: boolean; tint: number }[] = [];
    let tries = 0;
    while (spots.length < 5200 && tries < 120000) {
      tries++;
      // Most of the forest where the camera looks: the gorge walls and the cliff around the falls.
      const wide = rnd() < 0.25;
      const x = (rnd() - 0.5) * (wide ? 900 : 420);
      const z = wide ? -560 + rnd() * 860 : -260 + rnd() * 420;
      if (Math.abs(z) < 12 && Math.abs(x) < 120) continue; // the line and the bridge
      if (COURSES.some((c) => z > c.from - 10 && z < c.to + 10 && Math.abs(x - c.cx(z)) < c.w(z) * 1.25 + 4)) continue;
      const slope = slopeAt(x, z);
      if (slope > 1.25 + rnd() * 0.5) continue; // bare cliff
      const y = heightAt(x, z);
      spots.push({ x, y: y - 0.8, z, s: 0.7 + rnd() * 0.6, r: rnd() * Math.PI * 2, tall: rnd() < 0.3, tint: rnd() });
    }
    return {
      leaves,
      broad,
      tall,
      trunk: trunkGeometry(6.5, 0.38, 3, 31),
      bark: new THREE.MeshStandardMaterial({ color: "#3d3328", roughness: 0.95 }),
      spots,
    };
  }, []);
  const groups = useMemo(() => ({ broad: kit.spots.filter((s) => !s.tall), tall: kit.spots.filter((s) => s.tall) }), [kit]);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    const greens = ["#7fae4f", "#6c9c42", "#8cb85a", "#5f8e3b", "#97be62", "#77a64a"];
    for (const [ref, list] of [
      [broadRef, groups.broad],
      [tallRef, groups.tall],
    ] as const) {
      const m = ref.current;
      if (!m) continue;
      list.forEach((t, i) => {
        o.position.set(t.x, t.y, t.z);
        o.rotation.set(0, t.r, 0);
        o.scale.setScalar(t.s);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, c.set(greens[Math.floor(t.tint * greens.length) % greens.length]));
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [groups]);

  return (
    <group>
      <instancedMesh ref={broadRef} args={[kit.broad, kit.leaves, groups.broad.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={tallRef} args={[kit.tall, kit.leaves, groups.tall.length]} castShadow receiveShadow frustumCulled={false} />
    </group>
  );
}

/* ---------- Set ---------- */

export const TRAIN_CARS = 16;
const LOOP = 700;

export function FallsSet({ reduce }: { reduce: boolean }) {
  const root = useRef<THREE.Group>(null);
  const train = useRef<THREE.Group>(null);
  const kit = useMemo(() => ({ terrain: terrainGeometry(), ground: terrainMaterial() }), []);
  const water = useWater();
  const waterMeshes = useRef<THREE.Mesh[]>([]);
  const keepWater = (m: THREE.Mesh | null) => {
    if (m && !waterMeshes.current.includes(m)) waterMeshes.current.push(m);
  };

  useFrame((state) => {
    if (root.current) root.current.visible = world.set === "falls";
    for (const m of waterMeshes.current) (m.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.elapsedTime;
    // The moment the gorge clears, the locomotive is already on the bridge, a fifth of the way
    // across with its coaches behind it, and crawling forward; it wraps round well out of frame.
    if (train.current) {
      const front = -SPAN * 0.6 + (world.d - world.trainStart);
      train.current.position.x = ((((front + 150) % LOOP) + LOOP) % LOOP) - 150;
    }
  });

  return (
    <group ref={root}>
      <mesh geometry={kit.terrain} material={kit.ground} receiveShadow castShadow />
      {water.map((w, i) => (
        <mesh key={i} ref={keepWater} geometry={w.geo} material={w.mat} renderOrder={1} />
      ))}
      <Spray />
      <Bridge />
      <Track />
      <Jungle />
      <group ref={train}>
        <Train reduce={reduce} cars={TRAIN_CARS} />
      </group>
    </group>
  );
}
