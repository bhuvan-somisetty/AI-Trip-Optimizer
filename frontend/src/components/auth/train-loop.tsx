"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

// Enters off-screen left, crosses the bottom edge, and exits off-screen right —
// then loops back to the start and does it again. Never reverses. The margins
// are kept tight so it reappears on the left almost the instant it leaves the right.
const TRACK_START = { x: -4, y: 95 };
const TRACK_END = { x: 104, y: 95 };
const TRACK_DURATION = 8;

function SteamPuff({ delay, color }: { delay: number; color: "white" | "black" }) {
  return (
    <motion.span
      className={`absolute size-2.5 rounded-full blur-[2px] ${color === "white" ? "bg-white/85" : "bg-black/80"}`}
      initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
      animate={{ opacity: [0, 0.9, 0], scale: [0.3, 2, 2.8], x: [0, 8, 18], y: [0, -20, -38] }}
      transition={{ duration: 1.8, delay, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

export function TrainLoop() {
  const [smokeColor, setSmokeColor] = useState<"white" | "black">("white");
  const smokeColorRef = useRef<"white" | "black">("white");

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        initial={{ left: `${TRACK_START.x}%`, top: `${TRACK_START.y}%` }}
        animate={{ left: `${TRACK_END.x}%`, top: `${TRACK_END.y}%` }}
        transition={{ duration: TRACK_DURATION, ease: "linear", repeat: Infinity }}
        onUpdate={(latest) => {
          const x = parseFloat(String(latest.left));
          const next = x < 50 ? "white" : "black";
          if (smokeColorRef.current !== next) {
            smokeColorRef.current = next;
            setSmokeColor(next);
          }
        }}
      >
        {/* Smoke — stays screen-up regardless of the train's own rotation below */}
        <div className="absolute -top-3 left-[62%]">
          <SteamPuff delay={0} color={smokeColor} />
          <SteamPuff delay={0.4} color={smokeColor} />
          <SteamPuff delay={0.8} color={smokeColor} />
          <SteamPuff delay={1.2} color={smokeColor} />
          <SteamPuff delay={1.6} color={smokeColor} />
        </div>

        {/* Locomotive + two wagons, always facing right (direction of travel) */}
        <svg
          width="92"
          height="33"
          viewBox="0 0 96 34"
          className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
        >
          {/* couplers */}
          <line x1="4" y1="22" x2="12" y2="22" stroke="#3f3f46" strokeWidth="2" />
          <line x1="32" y1="22" x2="40" y2="22" stroke="#3f3f46" strokeWidth="2" />
          <line x1="60" y1="20" x2="66" y2="20" stroke="#3f3f46" strokeWidth="2" />

          {/* wagon 1 (rear) */}
          <rect x="2" y="10" width="28" height="14" rx="2" fill="#78350f" stroke="#3f2a0d" strokeWidth="1" />
          {/* wagon 2 */}
          <rect x="34" y="10" width="24" height="14" rx="2" fill="#92400e" stroke="#3f2a0d" strokeWidth="1" />

          {/* locomotive body */}
          <rect x="62" y="8" width="26" height="16" rx="2" fill="#27272a" stroke="#111113" strokeWidth="1" />
          {/* cab */}
          <rect x="62" y="2" width="12" height="8" rx="1.5" fill="#3f3f46" />
          {/* chimney */}
          <rect x="72" y="-2" width="6" height="9" rx="1.5" fill="#18181b" />
          {/* nose / cow-catcher */}
          <path d="M88 10 L96 17 L88 24 Z" fill="#27272a" stroke="#111113" strokeWidth="1" />
          {/* headlamp */}
          <circle cx="90" cy="17" r="1.6" fill="#fde68a" />

          {/* wheels */}
          {[8, 22, 42, 52, 68, 82].map((cx, i) => (
            <circle key={i} cx={cx} cy="26" r="3.2" fill="#111113" stroke="#52525b" strokeWidth="0.8" />
          ))}
        </svg>
      </motion.div>
    </div>
  );
}
