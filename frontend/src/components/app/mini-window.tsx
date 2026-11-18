"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// A small airplane window with drifting clouds, the same motif as the landing page.
export function MiniWindow({ className, children }: { className?: string; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const clouds = [
    { top: "54%", left: "-30%", w: "120%", h: "24%", o: 0.9, d: 26 },
    { top: "60%", left: "-10%", w: "140%", h: "32%", o: 0.95, d: 32 },
    { top: "40%", left: "10%", w: "70%", h: "10%", o: 0.5, d: 22 },
  ];
  return (
    <div
      className={cn(
        "relative aspect-[0.72] rounded-[42%/32%] bg-gradient-to-b from-[#fbf4e8] via-[#ece0cc] to-[#d2bd9e] p-[7%] shadow-[0_24px_50px_-18px_rgba(0,0,0,0.55),inset_0_2px_4px_rgba(255,255,255,0.9)]",
        className
      )}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[42%/32%] bg-[linear-gradient(180deg,#3f78d4_0%,#8db4e8_38%,#efd9d4_70%,#e4b8b4_100%)] shadow-[inset_0_0_18px_rgba(40,25,10,0.45)]">
        {clouds.map((c, i) => (
          <motion.span
            key={i}
            className="absolute rounded-[50%] bg-white blur-md"
            style={{ top: c.top, left: c.left, width: c.w, height: c.h, opacity: c.o }}
            animate={reduce ? undefined : { x: ["0%", "-18%", "0%"] }}
            transition={{ duration: c.d, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <div className="absolute inset-x-0 top-0 h-[16%] bg-gradient-to-b from-[#efe4d2] to-[#d9c6a8] shadow-[0_4px_10px_rgba(0,0,0,0.2)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_45%)]" />
        {children && <div className="absolute inset-x-0 top-[18%] flex flex-col items-center p-3 text-center text-white [text-shadow:0_1px_6px_rgba(15,40,90,0.55)]">{children}</div>}
      </div>
    </div>
  );
}
