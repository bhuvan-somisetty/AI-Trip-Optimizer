"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { animate, motion, useInView, useMotionValue, useScroll, useTransform, type MotionValue } from "framer-motion";

import { useScrollRange } from "./scroll-range";

const CloudScene = dynamic(() => import("./cloud-scene"), { ssr: false });

// Rounded-rectangle path, used for the window opening, the bezel and the shade clip.
function rr(cx: number, cy: number, w: number, h: number, r: number) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}

const C = 500;
const GLASS = { w: 300, h: 420, r: 128 };
const BEZEL = { w: 430, h: 570, r: 190 };
const WALL = `M-30000,-30000 H31000 V31000 H-30000 Z`;
const glassPath = rr(C, C, GLASS.w, GLASS.h, GLASS.r);
const bezelPath = rr(C, C, BEZEL.w, BEZEL.h, BEZEL.r);
const SHADE_OPEN = C - GLASS.h / 2 + 22; // lip resting near the top, like a real half-stowed shade
const SHADE_CLOSED = C + GLASS.h / 2 + 2;

function CabinWindow({ scale, closed, onToggle }: { scale: MotionValue<number>; closed: MotionValue<number>; onToggle: () => void }) {
  const lipY = useTransform(closed, [0, 1], [SHADE_OPEN, SHADE_CLOSED]);
  const shadeY = useTransform(lipY, (y) => y - 640);
  const dim = useTransform(closed, [0, 1], [0, 0.55]);
  const glow = useTransform(closed, [0, 1], [1, 0.35]);
  const detail = useTransform(scale, [1, 3], [1, 0]);

  return (
    <motion.g style={{ scale }}>
      <defs>
        <radialGradient id="wallGlow" cx={C} cy={C} r="1150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ecd1ac" />
          <stop offset="0.22" stopColor="#c99d71" />
          <stop offset="0.48" stopColor="#7d5539" />
          <stop offset="0.78" stopColor="#3a2416" />
          <stop offset="1" stopColor="#170d07" />
        </radialGradient>
        <radialGradient id="bezelFace" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.66" stopColor="#fffaf2" />
          <stop offset="0.8" stopColor="#f1e6d4" />
          <stop offset="0.93" stopColor="#ddcbb0" />
          <stop offset="1" stopColor="#c4ad8c" />
        </radialGradient>
        <linearGradient id="bezelLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a4330" stopOpacity="0.28" />
          <stop offset="0.35" stopColor="#5a4330" stopOpacity="0" />
          <stop offset="0.8" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="dropShadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.8" stopColor="#1a0e06" stopOpacity="0.5" />
          <stop offset="1" stopColor="#1a0e06" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shadeFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8dcc9" />
          <stop offset="0.85" stopColor="#efe5d6" />
          <stop offset="1" stopColor="#ddcdb5" />
        </linearGradient>
        <linearGradient id="lip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6eee2" />
          <stop offset="0.45" stopColor="#d9c8ad" />
          <stop offset="1" stopColor="#a68f6f" />
        </linearGradient>
        <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.75" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="glassClip">
          <path d={glassPath} />
        </clipPath>
      </defs>

      {/* Cabin wall with the window cut out, lit warmly by the light coming through it */}
      <motion.path d={`${WALL} ${bezelPath}`} fillRule="evenodd" fill="url(#wallGlow)" style={{ opacity: glow }} />
      <path d={`${WALL} ${bezelPath}`} fillRule="evenodd" fill="#1a0f08" opacity="0.35" />
      <motion.path d={`${WALL} ${bezelPath}`} fillRule="evenodd" fill="#0d0805" style={{ opacity: dim }} />

      {/* Soft contact shadow of the bezel on the wall */}
      <motion.path d={`${rr(C, C + 16, BEZEL.w + 90, BEZEL.h + 90, BEZEL.r + 45)} ${bezelPath}`} fillRule="evenodd" fill="url(#dropShadow)" style={{ opacity: detail }} />

      {/* Bezel: the moulded tunnel from the wall down to the glass */}
      <path d={`${bezelPath} ${glassPath}`} fillRule="evenodd" fill="url(#bezelFace)" />
      <path d={`${bezelPath} ${glassPath}`} fillRule="evenodd" fill="url(#bezelLight)" />
      <path d={bezelPath} fill="none" stroke="#fffaf0" strokeOpacity="0.7" strokeWidth="2.2" />
      <path d={rr(C, C, BEZEL.w + 4, BEZEL.h + 4, BEZEL.r + 2)} fill="none" stroke="#2a1a0e" strokeOpacity="0.35" strokeWidth="2" />
      <path d={rr(C, C, GLASS.w + 26, GLASS.h + 26, GLASS.r + 12)} fill="none" stroke="#bfa98a" strokeOpacity="0.45" strokeWidth="1.5" />

      {/* Glass, shade and the depth shadow, all clipped to the opening */}
      <g clipPath="url(#glassClip)" onClick={onToggle} style={{ cursor: "pointer" }}>
        <rect x={C - 200} y={C - 260} width="400" height="520" fill="transparent" />
        <path d={glassPath} fill="url(#glassSheen)" />
        <circle cx={C} cy={C + GLASS.h / 2 - 34} r="2.4" fill="#4a3f36" opacity="0.55" />
        <motion.g style={{ y: shadeY }}>
          <rect x={C - 180} y="0" width="360" height="640" fill="url(#shadeFace)" />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={C - 180} y={40 + i * 42} width="360" height="1" fill="#b9a688" opacity="0.18" />
          ))}
          <rect x={C - 180} y="618" width="360" height="22" fill="url(#lip)" />
          <rect x={C - 180} y="618" width="360" height="1.5" fill="#fffaf2" opacity="0.9" />
          <rect x={C - 34} y="626" width="68" height="8" rx="4" fill="#8d765a" opacity="0.6" />
          <rect x={C - 180} y="640" width="360" height="10" fill="#2a1a0e" opacity="0.18" />
        </motion.g>
        {[34, 20, 10].map((w, i) => (
          <path key={w} d={glassPath} fill="none" stroke="#2b1c10" strokeOpacity={[0.08, 0.12, 0.22][i]} strokeWidth={w} />
        ))}
      </g>
      <path d={glassPath} fill="none" stroke="#6b5640" strokeOpacity="0.55" strokeWidth="2" />
    </motion.g>
  );
}

const STATEMENT =
  "AI Trip Optimizer is decision support for business travel. It compares real flights and hotels, checks every option against company policy and explains each choice, so reviewers can approve with confidence, every single time.";

function Word({ word, range, p }: { word: string; range: [number, number]; p: MotionValue<number> }) {
  const opacity = useScrollRange(p, range, [0.12, 1]);
  const filter = useScrollRange(p, range, ["blur(8px)", "blur(0px)"]);
  return (
    <motion.span style={{ opacity, filter }} className="mr-[0.28em] inline-block">
      {word}
    </motion.span>
  );
}

export function SkyJourney() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const inView = useInView(ref, { margin: "200px" });
  const [box, setBox] = useState({ w: 1600, h: 900 });

  useEffect(() => {
    const update = () => setBox({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Shade starts closed, then slides open like a passenger lifting it. Click the glass to toggle it.
  const closed = useMotionValue(1);
  useEffect(() => {
    const c = animate(closed, 0, { duration: 2.4, delay: 0.9, ease: [0.65, 0, 0.35, 1] });
    return () => c.stop();
  }, [closed]);
  function toggleShade() {
    animate(closed, closed.get() > 0.5 ? 0 : 1, { duration: 1.6, ease: [0.65, 0, 0.35, 1] });
  }

  const ar = box.w / box.h;
  const fit = ar < 0.8 ? (ar * 1000 * 0.62) / BEZEL.w : Math.min(1.5, (ar * 1000 * 0.88) / BEZEL.w);
  const viewBox = `${C - 500 * ar} 0 ${1000 * ar} 1000`;

  // Fly out through the window: slow at first, then accelerating.
  const scale = useTransform(p, (v) => {
    const t = Math.min(Math.max((v - 0.05) / 0.3, 0), 1);
    const e = t * t * (3 - 2 * t);
    return fit * Math.pow(22, e * e);
  });
  const cloudScale = useScrollRange(p, [0.05, 0.35], [1.22, 1]);
  const leftX = useScrollRange(p, [0.02, 0.14], ["0vw", "-60vw"]);
  const rightX = useScrollRange(p, [0.02, 0.14], ["0vw", "60vw"]);
  const textBlur = useScrollRange(p, [0.02, 0.12], ["blur(0px)", "blur(10px)"]);
  const textOpacity = useScrollRange(p, [0.02, 0.13], [1, 0]);
  const brandScroll = useScrollRange(p, [0, 0.3, 0.42], [1, 1, 0]);
  const brand = useTransform(() => brandScroll.get() * (1 - closed.get()));
  const statementY = useScrollRange(p, [0.42, 0.88], ["72vh", "13vh"]);
  const statementOpacity = useScrollRange(p, [0.42, 0.5], [0, 1]);
  const cols = useScrollRange(p, [0.8, 0.9], [0, 1]);
  const haze = useScrollRange(p, [0.93, 1], [0, 1]);
  const words = STATEMENT.split(" ");

  return (
    <section id="story" ref={ref} data-nav="light" className="relative h-[760vh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-[linear-gradient(180deg,#5d8fd6_0%,#c9d8ee_50%,#f1dcd6_100%)]">
        <motion.div style={{ scale: cloudScale }} className="absolute inset-0">
          <CloudScene progress={p} active={inView} />
        </motion.div>

        <svg className="absolute inset-0 h-full w-full" viewBox={viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <CabinWindow scale={scale} closed={closed} onToggle={toggleShade} />
        </svg>
        <div className="grain pointer-events-none absolute inset-0 opacity-60" />

        <motion.p
          style={{ opacity: brand }}
          className="pointer-events-none absolute top-[42%] left-1/2 -translate-x-1/2 text-[13px] font-light tracking-[0.42em] whitespace-nowrap text-white/90 uppercase [text-shadow:0_1px_12px_rgba(40,60,90,0.35)]"
        >
          Trip Optimizer
        </motion.p>

        <motion.div style={{ opacity: textOpacity, filter: textBlur }} className="pointer-events-none absolute inset-0 text-[#f6efe3]">
          <motion.h1 style={{ x: leftX }} className="font-display absolute top-[10%] left-[6%] text-[clamp(2.6rem,6.6vw,6.4rem)] leading-[0.92] font-normal md:top-[17%] md:left-[5%]">
            Smarter
            <br />
            travel.
          </motion.h1>
          <motion.h1 style={{ x: rightX }} className="font-display absolute right-[6%] bottom-[13%] text-right text-[clamp(2.6rem,6.6vw,6.4rem)] leading-[0.92] font-normal md:right-[5%] md:bottom-[25%]">
            Better
            <br />
            decisions.
          </motion.h1>
          <motion.div style={{ x: leftX }} className="absolute bottom-[13%] left-[5%] hidden max-w-[15rem] md:block">
            <p className="font-display text-2xl leading-tight">Your decisions, made clear.</p>
            <div className="my-3 h-px w-8 bg-[#f6efe3]/50" />
            <p className="text-[12px] leading-relaxed text-[#f6efe3]/60">Every flight and stay is ranked against your policy. A reviewer makes the final call.</p>
          </motion.div>
          <motion.div style={{ x: rightX }} className="absolute right-[5%] bottom-[13%] hidden w-[22rem] border-t border-[#f6efe3]/40 pt-3 text-[10px] tracking-[0.25em] text-[#f6efe3]/65 uppercase md:flex md:justify-between">
            <span>Scroll down</span>
            <span>To start the journey</span>
          </motion.div>
        </motion.div>

        <motion.div style={{ y: statementY, opacity: statementOpacity }} className="pointer-events-none absolute inset-x-0 top-0 px-6 text-white md:px-16">
          <p className="font-display mx-auto max-w-6xl text-[clamp(1.9rem,4.4vw,4.1rem)] leading-[1.08] font-light [text-shadow:0_1px_2px_rgba(20,45,95,0.25),0_0_40px_rgba(20,45,95,0.25)]">
            {words.map((w, i) => {
              const a = 0.46 + (i / words.length) * 0.32;
              return <Word key={i} word={w} range={[a, a + 0.05]} p={p} />;
            })}
          </p>
          <motion.div style={{ opacity: cols }} className="mx-auto mt-14 grid max-w-6xl gap-8 text-sm md:grid-cols-3">
            {[
              ["Live fares and stays", "Real options from live search, never a canned list."],
              ["Your policy, enforced", "Cabin rules and hotel caps are checked on every itinerary."],
              ["A person decides", "Approve or reject with a written reason. Nothing books itself."],
            ].map(([t, d]) => (
              <div key={t} className="border-t border-white/50 pt-4">
                <p className="font-display text-2xl">{t}</p>
                <p className="mt-2 max-w-xs text-white/80">{d}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div style={{ opacity: haze }} className="pointer-events-none absolute inset-0 bg-[#efe6d8]" />
      </div>
    </section>
  );
}
