"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

// Raymarched volumetric cumulus from cruising altitude: deep blue sky, bright white tops,
// blue-grey undersides and a few taller towers, all drifting past the window.
const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uDrift;
  uniform float uTravel;
  uniform float uPitch;
  uniform float uAlt;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p, int oct) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      if (i >= oct) break;
      s += a * noise(p);
      p = p * 2.03 + vec3(3.1, 1.7, 5.3);
      a *= 0.5;
    }
    return s;
  }

  const float TOP = 2.6;
  float density(vec3 p, int oct) {
    float h = clamp(p.y / TOP, 0.0, 1.0);
    vec3 q = p * vec3(0.27, 0.42, 0.27) + vec3(0.0, -uTime * 0.01, 0.0);
    float n = fbm(q, oct);
    // Large-scale field: where it is high the clouds bunch up and tower, elsewhere blue gaps open.
    float field = noise(p * vec3(0.05, 0.0, 0.05) + vec3(3.0, 0.0, 9.0));
    float thr = mix(0.64, 0.34, field) + 0.34 * h * h;
    float d = n - thr + 0.16 * (1.0 - smoothstep(0.0, 0.22, h));
    d *= smoothstep(0.0, 0.06, h);
    return clamp(d * 4.0, 0.0, 1.0);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    vec3 ro = vec3(uDrift, uAlt, uTravel);
    vec3 fw = normalize(vec3(0.0, sin(uPitch), cos(uPitch)));
    vec3 rt = vec3(1.0, 0.0, 0.0);
    vec3 up = cross(fw, rt);
    vec3 rd = normalize(fw * 1.5 + uv.x * rt + uv.y * up);

    vec3 sunDir = normalize(vec3(0.35, 0.42, 1.0));
    float sun = clamp(dot(rd, sunDir), 0.0, 1.0);

    // Sky: deep blue overhead, softening to a pale blue-white haze at the horizon.
    vec3 skyTop = vec3(0.10, 0.33, 0.74);
    vec3 skyMid = vec3(0.36, 0.60, 0.90);
    vec3 skyHor = vec3(0.76, 0.85, 0.95);
    float sy = clamp(rd.y * 2.4 + 0.02, 0.0, 1.0);
    vec3 sky = mix(mix(skyHor, skyMid, smoothstep(0.0, 0.3, sy)), skyTop, smoothstep(0.25, 1.0, sy));
    sky += vec3(1.0, 0.95, 0.85) * pow(sun, 10.0) * 0.12;

    // Thin high cirrus.
    if (rd.y > 0.0) {
      float tc = (9.0 - ro.y) / rd.y;
      vec2 c = (ro + rd * tc).xz * 0.04 + vec2(uTime * 0.003, 0.0);
      float ci = fbm(vec3(c.x, c.y * 4.0, 0.0), 4);
      ci = smoothstep(0.55, 0.88, ci) * smoothstep(0.0, 0.3, rd.y) * 0.45;
      sky = mix(sky, vec3(0.97, 0.98, 1.0), ci);
    }

    vec4 acc = vec4(0.0);
    if (rd.y < -0.001) {
      float t0 = max((TOP - ro.y) / rd.y, 0.0);
      float t1 = min(-ro.y / rd.y, t0 + 70.0);
      const int N = 44;
      float dt = (t1 - t0) / float(N);
      float t = t0 + dt * 0.5 * hash(vec3(gl_FragCoord.xy, fract(uTime)));
      for (int i = 0; i < N; i++) {
        vec3 p = ro + rd * t;
        float d = density(p, 5);
        if (d > 0.004) {
          float l1 = density(p + sunDir * 0.35, 3);
          float l2 = density(p + sunDir * 0.9, 2);
          float light = exp(-(l1 * 2.2 + l2 * 1.6));
          float h = clamp(p.y / TOP, 0.0, 1.0);
          float ao = mix(0.6, 1.0, smoothstep(0.0, 0.6, h));
          vec3 lit = vec3(1.0, 0.985, 0.96);
          vec3 shade = vec3(0.47, 0.56, 0.71);
          vec3 col = mix(shade, lit, light) * ao + skyTop * 0.05;
          col += vec3(1.0, 0.96, 0.9) * pow(sun, 5.0) * light * 0.35;
          col = mix(col, skyHor, 1.0 - exp(-t * 0.024));
          float a = 1.0 - exp(-d * dt * 6.0);
          acc.rgb += (1.0 - acc.a) * a * col;
          acc.a += (1.0 - acc.a) * a;
          if (acc.a > 0.985) break;
        }
        t += dt;
      }
    }
    vec3 col = acc.rgb + (1.0 - acc.a) * (rd.y < 0.0 ? skyHor : sky);
    // Atmospheric haze band so the cloud deck melts into the sky instead of ending in a hard line.
    col = mix(col, skyHor, exp(-abs(rd.y) * 70.0) * 0.45);
    col = pow(col, vec3(0.94));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function CloudPlane({ progress }: { progress: MotionValue<number> }) {
  const time = useRef(0);
  const drift = useRef(0);
  const travel = useRef(0);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const [uniforms] = useState(() => ({
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uDrift: { value: 0 },
    uTravel: { value: 0 },
    uPitch: { value: -0.06 },
    uAlt: { value: 3.2 },
  }));

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05);
    const p = progress.get();
    // Cruising drift, then the camera surges forward as you leave the window, and lifts to the sky.
    const surge = THREE.MathUtils.smoothstep(p, 0.08, 0.34) * (1 - THREE.MathUtils.smoothstep(p, 0.6, 0.9));
    time.current += d;
    drift.current += d * 0.55 * (1 - surge * 0.7);
    travel.current += d * (0.05 + surge * 1.8);
    const m = mat.current;
    if (!m) return;
    const u = m.uniforms;
    state.gl.getDrawingBufferSize(u.uRes.value);
    u.uTime.value = time.current;
    u.uDrift.value = drift.current;
    u.uTravel.value = travel.current;
    // Horizon through the middle of the window at rest, dips as you fly out, then lifts to open sky.
    const dip = THREE.MathUtils.lerp(-0.06, -0.09, THREE.MathUtils.smoothstep(p, 0.05, 0.3));
    u.uPitch.value = THREE.MathUtils.lerp(dip, 0.42, THREE.MathUtils.smoothstep(p, 0.36, 0.7));
    u.uAlt.value = THREE.MathUtils.lerp(3.2, 2.85, THREE.MathUtils.smoothstep(p, 0.1, 0.4));
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} depthTest={false} depthWrite={false} />
    </mesh>
  );
}

export default function CloudScene({ progress, active }: { progress: MotionValue<number>; active: boolean }) {
  return (
    <Canvas
      dpr={0.62}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CloudPlane progress={progress} />
    </Canvas>
  );
}
