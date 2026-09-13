"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plane } from "lucide-react";

const FLIGHT_DURATION = 2.4;
const REDIRECT_AT_MS = 5400;

export function PlaneIntro() {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), REDIRECT_AT_MS - 500);
    const navTimer = setTimeout(() => router.replace("/login"), REDIRECT_AT_MS);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(navTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skip() {
    setExiting(true);
    setTimeout(() => router.replace("/login"), 450);
  }

  return (
    <AnimatePresence>
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

          {/* Flight trail */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <motion.path
              d="M -5 78 Q 40 60 55 48 T 108 15"
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

          {/* Plane */}
          <motion.div
            className="absolute text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.35)]"
            initial={{ left: "-5%", top: "78%", rotate: -18, opacity: 0, scale: 0.7 }}
            animate={{
              left: "88%",
              top: "10%",
              rotate: -18,
              opacity: [0, 1, 1, 0],
              scale: [0.7, 1, 1.05, 0.6],
            }}
            transition={{ duration: FLIGHT_DURATION, ease: "easeInOut", delay: 0.2 }}
          >
            <Plane className="size-9 -rotate-45 sm:size-12" strokeWidth={1.5} />
          </motion.div>

          {/* Wordmark */}
          <div className="relative z-10 flex flex-col items-center px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: FLIGHT_DURATION - 0.4, ease: "easeOut" }}
              className="text-4xl font-bold tracking-tight text-white sm:text-6xl"
            >
              AI Trip Optimizer
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: FLIGHT_DURATION - 0.1, ease: "easeOut" }}
              className="mt-4 text-sm font-medium tracking-[0.3em] text-white/60 uppercase sm:text-base"
            >
              Smarter Travel. Better Decisions.
            </motion.p>
          </div>

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
