import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The vehicles stay near the origin and the world slides under them (a treadmill), so float
// precision never drifts however long the page stays open. Every surface pattern is periodic
// along x with this period, which keeps the slide seamless.
export const PERIOD = 1024;

// Shared state of the ground scene, advanced by the camera rig every frame. One landing page
// renders one ground scene, so a module-level object is enough.
//   d: distance travelled in metres, u: scroll inside the leg in vh, g: scroll inside the gorge
//   and highway part in vh, set: which location is on screen, trainStart: d when the gorge view
//   last opened.
export const world = { d: 0, u: 0, g: 0, set: "runway" as "runway" | "falls" | "road", trainStart: 0 };

// Centre line of the highway in the road set.
export const ROAD_Z = 0;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise that repeats every `period` cells along x. Octaves double the frequency and the
// period together, so the sum stays periodic.
export const NOISE = /* glsl */ `
  float gHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float gNoise(vec2 x, float period) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float i0 = mod(i.x, period);
    float i1 = mod(i.x + 1.0, period);
    float a = gHash(vec2(i0, i.y));
    float b = gHash(vec2(i1, i.y));
    float c = gHash(vec2(i0, i.y + 1.0));
    float d = gHash(vec2(i1, i.y + 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float gFbm(vec2 x, float period) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      s += a * gNoise(x, period);
      x *= 2.0;
      period *= 2.0;
      a *= 0.5;
    }
    return s;
  }
  vec3 toLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }
`;

// Farmland seen from the air and from the track: a patchwork of crops, ploughed and dry plots
// with bunds between them, and grass verges along the railway and the road.
export const GROUND_COLOR = /* glsl */ `
  vec3 surfaceColor(vec2 q) {
    float jitter = 7.0 * gNoise(vec2(q.x / 64.0, 3.7), 16.0);
    vec2 cell = vec2(q.x / 64.0, (q.y + jitter) / 40.0);
    vec2 id = floor(cell);
    float h = gHash(vec2(mod(id.x, 16.0), id.y) + 7.31);
    vec3 col;
    if (h < 0.26) col = vec3(0.33, 0.44, 0.17);
    else if (h < 0.46) col = vec3(0.42, 0.49, 0.21);
    else if (h < 0.62) col = vec3(0.64, 0.57, 0.34);
    else if (h < 0.78) col = vec3(0.47, 0.37, 0.26);
    else col = vec3(0.25, 0.37, 0.15);

    float big = gFbm(q / 64.0, 16.0);
    float mid = gFbm(q / 4.0, 256.0);
    float fine = gNoise(q * 4.0, 4096.0);
    col *= 0.78 + 0.34 * big + 0.16 * (mid - 0.5) + 0.1 * (fine - 0.5);

    // Crop rows, faded out where they would alias.
    float rowCoord = h < 0.46 ? q.y / 0.85 : q.x / 0.85;
    float aa = 1.0 - smoothstep(0.15, 0.45, fwidth(rowCoord));
    if (h < 0.46 || (h > 0.62 && h < 0.78)) col *= 1.0 - 0.09 * aa * (0.5 + 0.5 * sin(rowCoord * 6.2832));

    // Earth bunds between plots.
    vec2 f = fract(cell);
    float edge = min(min(f.x, 1.0 - f.x) * 64.0, min(f.y, 1.0 - f.y) * 40.0);
    col = mix(col, vec3(0.36, 0.38, 0.2) * (0.8 + 0.4 * mid), 1.0 - smoothstep(0.4, 1.4, edge));

    // Grass verges along the railway and the road, a dusty shoulder beside the tarmac.
    float dRoad = abs(q.y - (${ROAD_Z}.0));
    float dry = smoothstep(0.42, 0.68, gFbm(q / 8.0 + 11.0, 128.0));
    float blades = gNoise(vec2(q.x * 3.0, q.y * 14.0), 3072.0);
    vec3 grass = mix(vec3(0.33, 0.4, 0.19), vec3(0.55, 0.5, 0.31), dry * 0.75);
    grass *= 0.7 + 0.45 * mid + 0.22 * (fine - 0.5) + 0.14 * (blades - 0.5);
    col = mix(col, grass, 1.0 - smoothstep(9.0, 12.0 + 3.0 * big, dRoad));
    col = mix(col, vec3(0.55, 0.46, 0.33) * (0.85 + 0.3 * mid), (1.0 - smoothstep(5.2, 6.4, dRoad)) * smoothstep(3.6, 4.0, dRoad));
    return toLinear(col);
  }
`;

export const ASPHALT_COLOR = /* glsl */ `
  vec3 surfaceColor(vec2 q) {
    float z = q.y - (${ROAD_Z}.0);
    float m = gFbm(q / 2.0, 512.0);
    float fine = gNoise(q * 8.0, 8192.0);
    vec3 col = vec3(0.23, 0.23, 0.24) * (0.8 + 0.35 * m + 0.12 * (fine - 0.5));
    // Wheel tracks are polished a little darker.
    float lane = abs(abs(z) - 1.9);
    col *= 1.0 - 0.1 * (1.0 - smoothstep(0.35, 0.8, abs(lane - 0.75)));
    return toLinear(col);
  }
`;

// MeshStandardMaterial whose base color comes from a GLSL function of world position, offset by
// the treadmill so the pattern slides under the vehicles. Lighting, shadows and fog stay intact.
// The live offset uniform is kept in material.userData.offset.
export function patternMaterial(key: string, colorFn: string, params: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  m.userData.offset = { value: 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uOffset = m.userData.offset;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vW;\nuniform float uOffset;\n${NOISE}\n${colorFn}`)
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( surfaceColor(vec2(vW.x + uOffset, vW.z)), opacity );");
  };
  m.customProgramCacheKey = () => key;
  return m;
}

/* ---------- Trees ---------- */

// A cluster of painted leaves on a transparent card. Many cards make one crown.
export function leafTexture() {
  const s = 512;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const rnd = rng(11);
  for (let i = 0; i < 2600; i++) {
    const a = rnd() * Math.PI * 2;
    const edge = 0.8 + 0.2 * Math.sin(a * 5 + 1.3) * Math.cos(a * 3);
    const r = Math.sqrt(rnd()) * s * 0.45 * edge;
    const x = s / 2 + Math.cos(a) * r;
    const y = s / 2 + Math.sin(a) * r;
    const light = 20 + rnd() * 30 - (1 - r / (s * 0.45)) * 10;
    g.fillStyle = `hsl(${78 + rnd() * 30}, ${30 + rnd() * 26}%, ${light}%)`;
    g.save();
    g.translate(x, y);
    g.rotate(rnd() * Math.PI);
    g.beginPath();
    g.ellipse(0, 0, 6 + rnd() * 8, 2.6 + rnd() * 3, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

type CrownSpec = { seed: number; cards: number; center: [number, number, number]; radius: [number, number, number]; size: number };

// Leaf cards scattered through an ellipsoid. Normals point out from the crown centre so the
// whole crown shades like one soft volume, and vertex colours darken the underside and core.
export function crownGeometry({ seed, cards, center, radius, size }: CrownSpec) {
  const rnd = rng(seed);
  const base = new THREE.PlaneGeometry(1, 1);
  const parts: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  for (let i = 0; i < cards; i++) {
    const th = rnd() * Math.PI * 2;
    const ph = Math.acos(2 * rnd() - 1);
    const rr = 0.5 + 0.5 * Math.cbrt(rnd());
    p.set(Math.sin(ph) * Math.cos(th) * radius[0] * rr + center[0], Math.cos(ph) * radius[1] * rr + center[1], Math.sin(ph) * Math.sin(th) * radius[2] * rr + center[2]);
    e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
    const s = size * (0.7 + 0.6 * rnd());
    m.compose(p, q.setFromEuler(e), sc.set(s, s, s));
    parts.push(base.clone().applyMatrix4(m));
  }
  const geo = mergeGeometries(parts)!;
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const col = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set((pos.getX(i) - center[0]) / radius[0], (pos.getY(i) - center[1]) / radius[1], (pos.getZ(i) - center[2]) / radius[2]);
    const depth = Math.min(v.length(), 1);
    const n = v.clone().normalize();
    n.y += 0.25;
    n.normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
    const shade = (0.5 + 0.5 * THREE.MathUtils.smoothstep(v.y, -1, 1)) * (0.62 + 0.38 * depth);
    col[i * 3] = shade;
    col[i * 3 + 1] = shade;
    col[i * 3 + 2] = shade;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

export function trunkGeometry(height: number, radius: number, branches: number, seed: number) {
  const rnd = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.CylinderGeometry(radius * 0.6, radius, height, 7).translate(0, height / 2, 0));
  for (let i = 0; i < branches; i++) {
    const len = height * (0.35 + 0.2 * rnd());
    const b = new THREE.CylinderGeometry(radius * 0.25, radius * 0.45, len, 5).translate(0, len / 2, 0);
    b.rotateZ(0.5 + 0.4 * rnd());
    b.rotateY(rnd() * Math.PI * 2);
    b.translate(0, height * (0.55 + 0.3 * rnd()), 0);
    parts.push(b);
  }
  return mergeGeometries(parts)!;
}

export type TreeSpot = { x: number; z: number; s: number; r: number; tint: number };

// Tree positions inside one period of the treadmill, copied once ahead and once behind.
export function scatter(seed: number, bands: { z: [number, number]; count: number; clump?: number }[], period: number) {
  const rnd = rng(seed);
  const base: TreeSpot[] = [];
  for (const band of bands) {
    let cx = rnd() * period;
    let cz = band.z[0] + rnd() * (band.z[1] - band.z[0]);
    for (let i = 0; i < band.count; i++) {
      // Trees grow in loose clumps rather than an even sprinkle.
      if (!band.clump || rnd() < 1 / band.clump) {
        cx = rnd() * period;
        cz = band.z[0] + rnd() * (band.z[1] - band.z[0]);
      }
      const x = (cx + (rnd() - 0.5) * 18 + period) % period;
      const z = THREE.MathUtils.clamp(cz + (rnd() - 0.5) * 14, band.z[0], band.z[1]);
      base.push({ x, z, s: 0.72 + rnd() * 0.6, r: rnd() * Math.PI * 2, tint: rnd() });
    }
  }
  return [-1, 0, 1].flatMap((k) => base.map((t) => ({ ...t, x: t.x + k * period })));
}
