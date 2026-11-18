"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

// Raymarched volumetric cloud sea seen from cruising altitude, lit by a low warm sun.
const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime;
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

  const float TOP = 1.4;
  float density(vec3 p, int oct) {
    float h = clamp(p.y / TOP, 0.0, 1.0);
    float shape = smoothstep(0.0, 0.25, h) * (1.0 - smoothstep(0.55, 1.0, h));
    vec3 q = p * vec3(0.22, 0.5, 0.22) + vec3(uTime * 0.03, 0.0, 0.0);
    float gaps = noise(p * vec3(0.05, 0.0, 0.05) + vec3(7.0, 0.0, 3.0));
    float d = fbm(q, oct) - (0.42 + 0.16 * gaps) + 0.26 * (1.0 - h);
    return clamp(d * shape * 2.8, 0.0, 1.0);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    vec3 ro = vec3(0.0, uAlt, uTravel);
    vec3 fw = normalize(vec3(0.0, sin(uPitch), cos(uPitch)));
    vec3 rt = vec3(1.0, 0.0, 0.0);
    vec3 up = cross(fw, rt);
    vec3 rd = normalize(fw * 1.5 + uv.x * rt + uv.y * up);

    vec3 sunDir = normalize(vec3(0.55, 0.16, 1.0));
    float sun = clamp(dot(rd, sunDir), 0.0, 1.0);

    // Sky: pale peach at the horizon into clear blue overhead.
    vec3 skyTop = vec3(0.17, 0.42, 0.82);
    vec3 skyMid = vec3(0.52, 0.70, 0.92);
    vec3 skyHor = vec3(0.93, 0.85, 0.85);
    float sy = clamp(rd.y * 2.2 + 0.03, 0.0, 1.0);
    vec3 sky = mix(mix(skyHor, skyMid, smoothstep(0.0, 0.35, sy)), skyTop, smoothstep(0.3, 1.0, sy));
    sky += vec3(1.0, 0.86, 0.74) * pow(sun, 12.0) * 0.08;

    // Thin high cirrus streaks.
    if (rd.y > 0.0) {
      float tc = (7.0 - ro.y) / rd.y;
      vec2 c = (ro + rd * tc).xz * 0.045 + vec2(uTime * 0.004, 0.0);
      float ci = fbm(vec3(c.x, c.y * 4.0, 0.0), 4);
      ci = smoothstep(0.52, 0.85, ci) * smoothstep(0.0, 0.3, rd.y) * 0.55;
      sky = mix(sky, vec3(1.0, 0.98, 0.97), ci);
    }

    vec4 acc = vec4(0.0);
    if (rd.y < -0.001) {
      float t0 = max((TOP - ro.y) / rd.y, 0.0);
      float t1 = min(-ro.y / rd.y, t0 + 40.0);
      const int N = 36;
      float dt = (t1 - t0) / float(N);
      float t = t0 + dt * hash(vec3(gl_FragCoord.xy, fract(uTime)));
      for (int i = 0; i < N; i++) {
        vec3 p = ro + rd * t;
        float d = density(p, 5);
        if (d > 0.004) {
          float l = density(p + sunDir * 0.35, 3);
          float light = exp(-l * 4.6);
          float hgt = clamp(p.y / TOP, 0.0, 1.0);
          vec3 lit = vec3(1.0, 0.92, 0.89);
          vec3 shade = vec3(0.44, 0.53, 0.72);
          vec3 col = mix(shade, lit, clamp(light * 0.9 + hgt * 0.15, 0.0, 1.0));
          col += vec3(1.0, 0.72, 0.62) * pow(sun, 3.0) * light * 0.18;
          col = mix(col, skyHor, 1.0 - exp(-t * 0.032));
          float a = 1.0 - exp(-d * dt * 4.5);
          acc.rgb += (1.0 - acc.a) * a * col;
          acc.a += (1.0 - acc.a) * a;
          if (acc.a > 0.985) break;
        }
        t += dt;
      }
    }
    vec3 col = acc.rgb + (1.0 - acc.a) * (rd.y < 0.0 ? skyHor * 0.97 : sky);
    col = pow(col, vec3(0.96));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function CloudPlane({ progress }: { progress: MotionValue<number> }) {
  const time = useRef(0);
  const travel = useRef(0);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const [uniforms] = useState(() => ({
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uTravel: { value: 0 },
    uPitch: { value: -0.05 },
    uAlt: { value: 2.3 },
  }));

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05);
    const p = progress.get();
    // Cruising drift, then the camera surges forward as you leave the window, and lifts to the sky.
    const surge = THREE.MathUtils.smoothstep(p, 0.08, 0.34) * (1 - THREE.MathUtils.smoothstep(p, 0.6, 0.9));
    time.current += d;
    travel.current += d * (0.14 + surge * 1.6);
    const m = mat.current;
    if (!m) return;
    const u = m.uniforms;
    state.gl.getDrawingBufferSize(u.uRes.value);
    u.uTime.value = time.current;
    u.uTravel.value = travel.current;
    u.uPitch.value = THREE.MathUtils.lerp(-0.05, 0.42, THREE.MathUtils.smoothstep(p, 0.36, 0.7));
    u.uAlt.value = THREE.MathUtils.lerp(2.3, 1.95, THREE.MathUtils.smoothstep(p, 0.1, 0.4));
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
