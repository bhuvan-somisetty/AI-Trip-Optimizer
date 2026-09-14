"use client";

import { motion } from "framer-motion";
import { Plane, FileCheck2, BadgeCheck, BarChart3 } from "lucide-react";
import { TrainLoop } from "@/components/auth/train-loop";

const features = [
  { icon: Plane, label: "Plan" },
  { icon: FileCheck2, label: "Compare" },
  { icon: BadgeCheck, label: "Decide" },
  { icon: BarChart3, label: "Optimize" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-2">
      <TrainLoop />

      {/* Left — brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex xl:p-14">
        <div
          className="absolute inset-0 bg-[linear-gradient(160deg,#0a1f33_0%,#0b3b52_35%,#0e5a63_65%,#0f3d3a_100%)]"
          aria-hidden
        />
        <motion.div
          animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.15, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-15%] left-[5%] size-[28rem] rounded-full bg-cyan-400/10 blur-[110px]"
          aria-hidden
        />
        <motion.div
          animate={{ opacity: [0.35, 0.6, 0.35], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          className="absolute right-[-10%] bottom-[-15%] size-[26rem] rounded-full bg-blue-500/10 blur-[110px]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.08),transparent_45%)]"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/30" aria-hidden />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="flex items-baseline gap-2 text-black">
            <span className="text-5xl font-extrabold tracking-tight xl:text-6xl">AI</span>
            <span className="text-5xl font-extrabold tracking-tight xl:text-6xl">
              Trip Optimizer
            </span>
          </div>
          <div className="mt-3 h-px w-12 bg-gradient-to-r from-amber-300 to-transparent" />
        </motion.div>

        <div className="relative z-10 space-y-10">
          <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0.15}>
            <p className="text-3xl font-semibold tracking-tight">Smarter Travel.</p>
            <p className="text-3xl font-semibold tracking-tight">Better Decisions.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={0.35}
            className="flex gap-8"
          >
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-transform hover:scale-110">
                  <Icon className="size-5" />
                </div>
                <span className="text-xs text-white/70">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.blockquote
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={0.5}
          className="relative z-10 border-l-2 border-white/25 pl-4 text-lg font-medium text-white/90 italic"
        >
          &ldquo;Turn travel planning into smarter business decisions.&rdquo;
        </motion.blockquote>
      </div>

      {/* Right — form panel */}
      <div className="relative flex items-center justify-center overflow-hidden bg-background p-6 sm:p-10">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,var(--color-primary)_0%,transparent_35%)] opacity-[0.06]"
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-sm space-y-7"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
