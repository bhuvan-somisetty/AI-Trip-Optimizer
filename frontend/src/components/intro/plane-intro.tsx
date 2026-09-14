"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plane } from "lucide-react";

const FLIGHT_DURATION = 2.4;
const REDIRECT_AT_MS = 5400;
const WORDMARK = "AI Trip Optimizer";

// A single, strongly bowed curve: flat near the runway, then sweeping sharply
// upward — same path drives the trail, the plane, and the letters.
const CURVE_D = "M -8 85 Q 35 88 108 8";
type Point = [number, number];
const CURVE = { p0: [-8, 85] as Point, p1: [35, 88] as Point, p2: [108, 8] as Point };

function quadAt({ p0, p1, p2 }: typeof CURVE, t: number): Point {
  const mt = 1 - t;
  return [
    mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
  ];
}

const CURVE_SAMPLE_COUNT = 240;
const CURVE_SAMPLES: Point[] = Array.from({ length: CURVE_SAMPLE_COUNT + 1 }, (_, i) =>
  quadAt(CURVE, i / CURVE_SAMPLE_COUNT)
);
const CURVE_CUM_LEN: number[] = CURVE_SAMPLES.reduce<number[]>((acc, pt, i) => {
  if (i === 0) return [0];
  const [x1, y1] = CURVE_SAMPLES[i - 1];
  const [x2, y2] = pt;
  acc.push(acc[i - 1] + Math.hypot(x2 - x1, y2 - y1));
  return acc;
}, []);
const CURVE_TOTAL_LEN = CURVE_CUM_LEN[CURVE_CUM_LEN.length - 1];

function pointOnCurve(fraction: number) {
  const target = fraction * CURVE_TOTAL_LEN;
  let idx = 0;
  while (idx < CURVE_CUM_LEN.length - 2 && CURVE_CUM_LEN[idx + 1] < target) idx++;
  const [x1, y1] = CURVE_SAMPLES[idx];
  const [x2, y2] = CURVE_SAMPLES[idx + 1];
  const segLen = CURVE_CUM_LEN[idx + 1] - CURVE_CUM_LEN[idx];
  const localT = segLen > 0 ? (target - CURVE_CUM_LEN[idx]) / segLen : 0;
  return { x: x1 + (x2 - x1) * localT, y: y1 + (y2 - y1) * localT, dx: x2 - x1, dy: y2 - y1 };
}

// The lucide "Plane" glyph is drawn nose-up-right (~45°), so the heading
// that makes the nose track the tangent direction is offset by +45°.
function angleFor(dx: number, dy: number, w: number, h: number) {
  return (Math.atan2(dy * h, dx * w) * 180) / Math.PI + 45;
}

// Spacing is in curve-length units, not index — spreads the word across the full
// visible curve while keeping letters close and word gaps clearly wider.
const START_OFFSET = 11;
const LETTER_SPACING = 6.2;
const WORD_SPACING = 14;

let cumulativeOffset = START_OFFSET;
const PATH_LETTERS = WORDMARK.split("").map((ch) => {
  const fraction = cumulativeOffset / CURVE_TOTAL_LEN;
  cumulativeOffset += ch === " " ? WORD_SPACING : LETTER_SPACING;
  return { ch, fraction, ...pointOnCurve(fraction) };
});

// Sample points for the plane so it flies the exact curve instead of a straight line.
const PLANE_SAMPLE_COUNT = 16;
const PLANE_SAMPLES = Array.from({ length: PLANE_SAMPLE_COUNT + 1 }, (_, i) =>
  pointOnCurve(i / PLANE_SAMPLE_COUNT)
);

export function PlaneIntro() {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);
  const [viewport, setViewport] = useState({ w: 1600, h: 900 });

  useEffect(() => {
    function updateViewport() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    router.prefetch("/login");
    const exitTimer = setTimeout(() => setExiting(true), REDIRECT_AT_MS - 500);
    return () => clearTimeout(exitTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skip() {
    setExiting(true);
  }

  const planeKeyframes = useMemo(() => {
    const left = PLANE_SAMPLES.map((s) => `${s.x}%`);
    const top = PLANE_SAMPLES.map((s) => `${s.y}%`);
    const rotate = PLANE_SAMPLES.map((s) => angleFor(s.dx, s.dy, viewport.w, viewport.h));
    return { left, top, rotate };
  }, [viewport]);

  return (
    <AnimatePresence onExitComplete={() => router.replace("/login")}>
      {!exiting && (
        <motion.div
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950"
        >
          {/* Ambient gradient backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-[linear-gradient(160deg,#0a1f33_0%,#0b3b52_35%,#0e5a63_65%,#0f3d3a_100%)]" />
            <motion.div
              animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.15, 1] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[-10%] left-[10%] size-[40vw] rounded-full bg-cyan-400/10 blur-[100px]"
            />
            <motion.div
              animate={{ opacity: [0.4, 0.7, 0.4], scale: [1.1, 1, 1.1] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute right-[5%] bottom-[-10%] size-[35vw] rounded-full bg-blue-500/10 blur-[100px]"
            />
          </motion.div>

          {/* Background wordmark, word by word, kept clear of the flight curve below */}
          <div className="pointer-events-none absolute top-6 left-6 flex max-h-[45%] select-none flex-col items-start overflow-hidden leading-[0.9] font-bold text-black/70 sm:top-10 sm:left-12">
            {["Smarter", "Travel.", "Better", "Decisions."].map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.15, ease: "easeOut" }}
                className="text-[9vw] sm:text-[6vw]"
              >
                {word}
              </motion.span>
            ))}
          </div>

          {/* Flight trail */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <motion.path
              d={CURVE_D}
              fill="none"
              stroke="url(#trailGradient)"
              strokeWidth="0.35"
              strokeLinecap="round"
              strokeDasharray="0.6 1.2"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: FLIGHT_DURATION, ease: "easeInOut", delay: 0.2 }}
            />
            <defs>
              <linearGradient id="trailGradient" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="100%" stopColor="white" stopOpacity="0.7" />
              </linearGradient>
            </defs>
          </svg>

          {/* Plane — flies the exact curve above, sampled point by point */}
          <motion.div
            className="absolute -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.35)]"
            initial={{
              opacity: 0,
              scale: 0.7,
              left: planeKeyframes.left[0],
              top: planeKeyframes.top[0],
              rotate: planeKeyframes.rotate[0],
            }}
            animate={{
              left: planeKeyframes.left,
              top: planeKeyframes.top,
              rotate: planeKeyframes.rotate,
              opacity: [0, 1, 1, 1, 0],
              scale: [0.7, 1, 1, 1.05, 0.6],
            }}
            transition={{ duration: FLIGHT_DURATION, ease: "linear", delay: 0.2 }}
          >
            <div className="relative">
              <Plane className="size-9 sm:size-12" strokeWidth={1.5} />
              {/* Exhaust glow releasing from the tail, opposite the nose */}
              <motion.span
                className="absolute top-[62%] left-[14%] size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-100 via-white to-transparent blur-[2px] sm:size-2"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.5, 1.2, 0.5] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>

          {/* Letters dropping one by one along the actual curved flight path, spelling out as the plane passes */}
          {PATH_LETTERS.map(({ ch, fraction, x, y }, i) => (
            <motion.span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.5)] sm:text-6xl"
              style={{ left: `${x}%`, top: `${y}%` }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
                delay: 0.2 + fraction * (FLIGHT_DURATION - 0.3),
              }}
            >
              {ch === " " ? " " : ch}
            </motion.span>
          ))}

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
            onClick={skip}
            className="absolute bottom-8 right-8 z-10 text-xs font-medium tracking-wide text-white/50 transition-colors hover:text-white"
          >
            Skip intro →
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
