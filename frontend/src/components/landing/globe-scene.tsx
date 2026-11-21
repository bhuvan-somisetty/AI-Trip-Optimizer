"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

// A real Earth: NASA Blue Marble imagery with relief and shiny oceans, an atmosphere rim, and the
// routes the optimizer plans drawn over it. Drag to turn it; click anywhere to see which country
// (or ocean) is there. Borders are Natural Earth 1:50m.

const R = 1.6;
const DEG = Math.PI / 180;

type Country = Feature<Geometry, { name: string }>;

function toVec(lat: number, lon: number, r = R) {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function toLatLon(p: THREE.Vector3) {
  const r = p.length();
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(p.y / r, -1, 1)) / DEG;
  let lon = Math.atan2(p.z, -p.x) / DEG - 180;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

// Rough ocean names for clicks that land on water.
function oceanAt(lat: number, lon: number) {
  if (lat > 66) return "Arctic Ocean";
  if (lat < -60) return "Southern Ocean";
  if (lon > 20 && lon < 120 && lat < 30) return "Indian Ocean";
  if (lon >= -70 && lon <= 20) return "Atlantic Ocean";
  if (lon > -100 && lon < -70 && lat > 8) return "Atlantic Ocean";
  return "Pacific Ocean";
}

function formatCoord(lat: number, lon: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}° ${ns}, ${Math.abs(lon).toFixed(1)}° ${ew}`;
}

/* ---------- Routes ---------- */

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
  mid.setLength(R * (1 + a.distanceTo(b) * 0.22));
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

function Routes() {
  const planes = useRef<THREE.Mesh[]>([]);
  const curves = useMemo(() => ROUTES.map(([a, b]) => arc(toVec(...CITIES[a], R * 1.004), toVec(...CITIES[b], R * 1.004))), []);
  const lines = useMemo(() => curves.map((c) => new THREE.BufferGeometry().setFromPoints(c.getPoints(64))), [curves]);
  const cities = useMemo(() => Object.values(CITIES).map(([la, lo]) => toVec(la, lo, R * 1.006)), []);
  useFrame((state) => {
    planes.current.forEach((m, i) => {
      if (!m) return;
      const t = (((state.clock.elapsedTime * 0.1 + i * 0.37) % 1) + 1) % 1;
      m.position.copy(curves[i].getPoint(t));
    });
  });
  return (
    <group>
      {lines.map((geo, i) => (
        <line key={i}>
          <primitive object={geo} attach="geometry" />
          <lineBasicMaterial color="#ff8a62" transparent opacity={0.85} />
        </line>
      ))}
      {cities.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshBasicMaterial color="#ffd2c0" />
        </mesh>
      ))}
      {curves.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) planes.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.026, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Earth ---------- */

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const atmosphereFragment = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Thin haze that only shows towards the limb, like the atmosphere seen from orbit.
    float rim = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), 3.5);
    gl_FragColor = vec4(vec3(0.45, 0.68, 1.0) * rim * 0.85, 1.0);
  }
`;

function ringPositions(rings: Position[][], out: number[]) {
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = toVec(ring[i][1], ring[i][0], R * 1.003);
      const b = toVec(ring[i + 1][1], ring[i + 1][0], R * 1.003);
      out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
}

function Outline({ country }: { country: Country }) {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const g = country.geometry;
    if (g.type === "Polygon") ringPositions(g.coordinates, pts);
    else if (g.type === "MultiPolygon") for (const poly of g.coordinates) ringPositions(poly, pts);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geometry;
  }, [country]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#ffb08f" transparent opacity={0.95} />
    </lineSegments>
  );
}

type Pick = { pos: THREE.Vector3; normal: THREE.Vector3; lat: number; lon: number; name: string; kind: "country" | "ocean"; country?: Country };

function Pin({ pick, earth }: { pick: Pick; earth: React.RefObject<THREE.Mesh | null> }) {
  const ring = useRef<THREE.Mesh>(null);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pick.normal), [pick]);
  useFrame((state) => {
    const m = ring.current;
    if (!m) return;
    const t = (state.clock.elapsedTime * 0.8) % 1;
    m.scale.setScalar(0.6 + t * 1.8);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
  });
  return (
    <group position={pick.pos}>
      <mesh>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial color="#ff693d" />
      </mesh>
      <mesh ref={ring} quaternion={q}>
        <ringGeometry args={[0.04, 0.05, 40]} />
        <meshBasicMaterial color="#ff693d" transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Html center distanceFactor={3.6} occlude={[earth as React.RefObject<THREE.Object3D>]} position={pick.normal.clone().multiplyScalar(0.3)} style={{ pointerEvents: "none" }}>
        <div className="min-w-[11rem] -translate-y-1/2 rounded-2xl border border-[#e9f0f5]/15 bg-[#172c45]/80 px-4 py-3 text-left shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)] backdrop-blur-md">
          <p className="text-[10px] font-semibold tracking-[0.26em] text-[#ff8a62] uppercase">{pick.kind === "country" ? "Country" : "Open water"}</p>
          <p className="font-display mt-1 text-[1.35rem] leading-tight whitespace-nowrap text-[#f6efe3]">{pick.name}</p>
          <p className="mt-1 font-mono text-[11px] text-[#e9f0f5]/70">{formatCoord(pick.lat, pick.lon)}</p>
        </div>
      </Html>
    </group>
  );
}

function Earth({ countries, pick, onPick }: { countries: Country[]; pick: Pick | null; onPick: (p: Pick) => void }) {
  const earth = useRef<THREE.Mesh>(null);
  const [map, bump, water] = useTexture(["/globe/earth-blue-marble.jpg", "/globe/earth-topology.png", "/globe/earth-water.png"], (textures) => {
    const list = Array.isArray(textures) ? textures : [textures];
    list[0].colorSpace = THREE.SRGBColorSpace;
    for (const t of list) t.anisotropy = 8;
  });

  function handleClick(e: ThreeEvent<MouseEvent>) {
    // A drag that ends on the globe is a turn, not a pick.
    if (e.delta > 6 || !earth.current) return;
    e.stopPropagation();
    const local = earth.current.worldToLocal(e.point.clone());
    const { lat, lon } = toLatLon(local);
    const country = countries.find((c) => geoContains(c, [lon, lat]));
    const normal = local.clone().normalize();
    onPick({
      pos: normal.clone().multiplyScalar(R * 1.002),
      normal,
      lat,
      lon,
      name: country ? country.properties.name : oceanAt(lat, lon),
      kind: country ? "country" : "ocean",
      country,
    });
  }

  return (
    <group>
      <mesh ref={earth} onClick={handleClick}>
        <sphereGeometry args={[R, 128, 96]} />
        <meshPhongMaterial map={map} bumpMap={bump} bumpScale={6} specularMap={water} specular="#4b6a8f" shininess={22} />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[R, 64, 48]} />
        <shaderMaterial vertexShader={atmosphereVertex} fragmentShader={atmosphereFragment} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <Routes />
      {pick?.country && <Outline country={pick.country} />}
      {pick && <Pin pick={pick} earth={earth} />}
    </group>
  );
}

// Keeps the sun over the viewer's shoulder, so whichever side is turned to the camera is in daylight.
const sunOffset = new THREE.Vector3();

function Sunlight() {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame((state) => {
    const l = light.current;
    if (!l) return;
    sunOffset.set(-2.4, 1.8, 3.2);
    l.position.copy(state.camera.localToWorld(sunOffset));
  });
  return <directionalLight ref={light} intensity={2.6} color="#fff6ea" />;
}

function useCountries() {
  const [countries, setCountries] = useState<Country[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/globe/countries-50m.json")
      .then((r) => r.json())
      .then((topology: Topology) => {
        if (cancelled) return;
        const fc = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>;
        setCountries(fc.features);
      })
      .catch(() => setCountries([]));
    return () => {
      cancelled = true;
    };
  }, []);
  return countries;
}

function Controls({ spinning }: { spinning: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    // Let a vertical swipe still scroll the page on touch screens; sideways drags turn the globe.
    const el = controls.current?.domElement;
    if (el) el.style.touchAction = "pan-y";
  }, []);
  return (
    <OrbitControls
      ref={controls}
      enableZoom={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      autoRotate={spinning}
      autoRotateSpeed={0.45}
      minPolarAngle={0.45}
      maxPolarAngle={Math.PI - 0.45}
    />
  );
}

export default function GlobeScene({ active }: { active: boolean }) {
  const countries = useCountries();
  const [pick, setPick] = useState<Pick | null>(null);
  // Start with India facing the viewer.
  const start = useMemo(() => toVec(18, 78, 6.6).toArray(), []);
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: start, fov: 38 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent", cursor: "grab" }}
      onPointerMissed={() => setPick(null)}
    >
      <ambientLight intensity={0.45} color="#c9d6ea" />
      <Sunlight />
      <Suspense fallback={null}>
        <Earth countries={countries} pick={pick} onPick={setPick} />
      </Suspense>
      <Controls spinning={!pick} />
    </Canvas>
  );
}
