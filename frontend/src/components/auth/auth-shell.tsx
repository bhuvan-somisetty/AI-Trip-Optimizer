"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plane, FileCheck2, BadgeCheck, BarChart3 } from "lucide-react";

const features = [
  { icon: Plane, label: "Plan" },
  { icon: FileCheck2, label: "Compare" },
  { icon: BadgeCheck, label: "Decide" },
  { icon: BarChart3, label: "Optimize" },
];

const ease = [0.22, 1, 0.36, 1] as const;
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (delay = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay, ease } }),
};

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="aurora grain relative hidden flex-col justify-between overflow-hidden p-10 text-[#f6f0e4] lg:flex xl:p-14">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }} className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#ff693d] text-[#0a1220] shadow-[0_10px_30px_-8px_rgba(255,105,61,0.7)]">
              <Plane className="size-5" />
            </span>
            <span className="font-display text-3xl font-medium">Trip Optimizer</span>
          </Link>
        </motion.div>

        <div className="relative z-10 space-y-10">
          <motion.h2
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={0.15}
            className="font-display text-5xl leading-[1.05] font-light xl:text-6xl"
          >
            Smarter travel.
            <br />
            <em className="font-normal text-[#ff8a62]">Better decisions.</em>
          </motion.h2>

          <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0.35} className="flex gap-6">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md transition-colors hover:border-[#ff693d]/60 hover:bg-[#ff693d]/10">
                  <Icon className="size-5" />
                </div>
                <span className="text-xs tracking-wide text-white/60">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.blockquote
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={0.5}
          className="font-display relative z-10 max-w-md border-l border-[#ff693d]/70 pl-4 text-xl text-white/85 italic"
        >
          &ldquo;Turn travel planning into smarter business decisions.&rdquo;
        </motion.blockquote>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center overflow-hidden bg-background p-6 sm:p-10">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,var(--color-primary)_0%,transparent_38%)] opacity-[0.07]"
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="relative w-full max-w-sm space-y-7"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
