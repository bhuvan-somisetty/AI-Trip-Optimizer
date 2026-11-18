"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Lenis from "lenis";
import { motion, useInView, useReducedMotion, useScroll } from "framer-motion";
import { SkyJourney } from "./sky-journey";
import { useScrollRange } from "./scroll-range";
import { ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, FileCheck2, History, Plane, ShieldCheck, Volume2, VolumeX } from "lucide-react";

const JetScene = dynamic(() => import("./jet-scene"), { ssr: false });
const GlobeScene = dynamic(() => import("./globe-scene"), { ssr: false });

const ease = [0.22, 1, 0.36, 1] as const;

function useSmoothScroll() {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [reduce]);
}

function useSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const active = useInView(ref, { margin: "200px" });
  return { ref, p: scrollYProgress, active };
}

/* ---------- Fixed chrome ---------- */

// Nav text switches between light and dark depending on the section underneath it.
function useNavTone() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = document.elementsFromPoint(window.innerWidth / 2, 40).find((e) => e.closest("[data-nav]"));
      setDark(el?.closest("[data-nav]")?.getAttribute("data-nav") === "dark");
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  return dark;
}

function Chrome({ sound, onSound }: { sound: boolean; onSound: () => void }) {
  const dark = useNavTone();
  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 transition-colors duration-500 md:px-10 ${dark ? "text-[#1d1712]" : "text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.25)]"}`}
      >
        <nav className="hidden items-center gap-7 text-[13px] tracking-wide md:flex">
          <a href="#story">About</a>
          <a href="#jet">Optimizer</a>
          <a href="#features">Features</a>
          <a href="#global">Global</a>
        </nav>
        <Link href="/" className="font-display text-xl tracking-tight md:absolute md:left-1/2 md:-translate-x-1/2">
          Trip Optimizer
        </Link>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={onSound}
            aria-pressed={sound}
            aria-label={sound ? "Turn sound off" : "Turn sound on"}
            className="flex items-center gap-1.5 text-[13px] tracking-wide"
          >
            {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            <span className="hidden sm:inline">Sound {sound ? "on" : "off"}</span>
          </button>
          <Link href="/login" className="text-[13px] tracking-wide">
            Sign in
          </Link>
        </div>
      </header>
      <Link
        href="/signup"
        className="group fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#f4ecdf]/95 py-1.5 pr-1.5 pl-5 text-[13px] font-medium text-[#0f1b2d] shadow-[0_14px_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur transition-transform hover:-translate-y-0.5"
      >
        Plan a trip
        <span className="flex size-8 items-center justify-center rounded-full bg-[#ff693d] text-[#0a1220] transition-transform group-hover:rotate-45">
          <ArrowUpRight className="size-4" />
        </span>
      </Link>
    </>
  );
}

/* ---------- 3. Rotating 3D jet ---------- */

function JetSection() {
  const { ref, p, active } = useSection();
  const headOpacity = useScrollRange(p, [0, 0.12, 0.56, 0.7], [0, 1, 1, 0]);
  const leftX = useScrollRange(p, [0, 0.2], [-60, 0]);
  const rightX = useScrollRange(p, [0, 0.2], [60, 0]);
  const spec = useScrollRange(p, [0.62, 0.8], [0, 1]);
  const specY = useScrollRange(p, [0.62, 0.8], [40, 0]);
  const jetProgress = useScrollRange(p, [0.1, 0.85], [0, 1]);

  return (
    <section id="jet" ref={ref} data-nav="dark" className="relative h-[380vh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-[radial-gradient(70%_60%_at_50%_40%,#f7f0e3_0%,#e8dcc8_60%,#d9c9ae_100%)] text-[#2a211b]">
        <div className="absolute inset-0 z-0">
          <JetScene progress={jetProgress} active={active} />
        </div>

        <motion.div style={{ opacity: headOpacity }} className="pointer-events-none absolute inset-0 z-10">
          <motion.h2 style={{ x: leftX }} className="font-display absolute top-[14%] left-[6%] text-[clamp(3rem,9vw,8.5rem)] leading-none font-normal md:top-1/2 md:left-[5%] md:-translate-y-1/2">
            Plan in
          </motion.h2>
          <motion.h2 style={{ x: rightX }} className="font-display absolute right-[6%] bottom-[24%] text-[clamp(3rem,9vw,8.5rem)] leading-none font-normal md:top-1/2 md:right-[5%] md:bottom-auto md:-translate-y-1/2">
            Clarity
          </motion.h2>
          <p className="font-display absolute bottom-[16%] left-[5%] hidden max-w-[12rem] text-xl leading-snug opacity-80 md:block">Decisions that move with you</p>
          <p className="absolute right-[5%] bottom-[14%] hidden max-w-[17rem] text-[12px] leading-relaxed opacity-70 md:block">
            Dates, budget, cabin and traveler preferences go in. The optimizer returns a ranked itinerary and a plain reason for every alternative it set aside.
          </p>
        </motion.div>

        <motion.div style={{ opacity: spec, y: specY }} className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between px-6 pt-24 pb-28 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:px-16 md:py-0">
          <div>
            <p className="text-[11px] tracking-[0.25em] uppercase opacity-60">Example trip</p>
            <p className="font-display mt-2 text-[clamp(3rem,8vw,7rem)] leading-none">DEL to BOM</p>
          </div>
          <div className="hidden w-[22vw] md:block" />
          <dl className="grid grid-cols-2 gap-x-8 gap-y-6 text-sm">
            {[
              ["Budget", "₹8,000"],
              ["Chosen", "₹5,420"],
              ["Saved", "32%"],
              ["Policy checks", "6 of 6 passed"],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-[#2a211b]/25 pt-3">
                <dt className="text-[11px] tracking-[0.2em] uppercase opacity-60">{k}</dt>
                <dd className="font-display mt-1 text-3xl">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- 4. Features and steps ---------- */

const features = [
  { icon: Plane, title: "Plan with real constraints", text: "Dates, budget, cabin, traveler preferences and company policy go in. Live fares and stays come back." },
  { icon: FileCheck2, title: "Every option, explained", text: "Chosen, over budget, breaks policy, slower. Each alternative carries a plain-language reason." },
  { icon: BadgeCheck, title: "A human decides", text: "Reviewers approve or reject with a written reason. Nothing is ever booked automatically." },
  { icon: History, title: "A full audit trail", text: "Who optimized, edited, approved or rejected, and when. Exportable for finance and compliance." },
  { icon: ShieldCheck, title: "Policy built in", text: "Hotel caps, cabin rules and approval limits are set once by admins and enforced on every trip." },
  { icon: BarChart3, title: "Spend you can see", text: "Approved spend, optimizer savings and decision trends in one calm dashboard." },
];

function Features() {
  return (
    <section id="features" data-nav="dark" className="bg-[#f3eee4] text-[#0f1b2d]">
      <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.9, ease }}>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#e04e22] uppercase">What it does</p>
          <h2 className="font-display mt-4 max-w-3xl text-[clamp(2.4rem,6vw,5.5rem)] leading-[1.02] font-light">
            From a request to a <em className="font-normal text-[#e04e22]">defensible</em> decision.
          </h2>
        </motion.div>
        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl bg-[#0f1b2d]/12 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: (i % 3) * 0.1, ease }}
              className="group bg-[#f3eee4] p-8 transition-colors duration-500 hover:bg-[#0a1220] hover:text-[#f6f0e4]"
            >
              <Icon className="size-6 text-[#e04e22] transition-transform duration-500 group-hover:-translate-y-1" />
              <h3 className="font-display mt-10 text-[1.7rem] leading-tight">{title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed opacity-65">{text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. Global ---------- */

function GlobalSection() {
  const { ref, p, active } = useSection();
  const textY = useScrollRange(p, [0, 1], ["8%", "-6%"]);
  const globeProgress = useScrollRange(p, [0, 1], [0, 1]);
  const cta = useScrollRange(p, [0.55, 0.8], [0, 1]);
  const ctaY = useScrollRange(p, [0.55, 0.8], [30, 0]);
  const lede = useScrollRange(p, [0.1, 0.25, 0.45, 0.55], [0, 1, 1, 0]);
  const globeY = useScrollRange(p, [0.45, 0.8], ["0%", "-12%"]);
  return (
    <section id="global" ref={ref} data-nav="light" className="relative h-[300vh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-[linear-gradient(180deg,#2c1d17_0%,#120b09_55%,#07090d_100%)] text-[#f6efe3]">
        <motion.p
          style={{ y: textY }}
          className="font-display pointer-events-none absolute inset-x-0 top-[6%] text-center text-[clamp(7rem,26vw,26rem)] leading-none font-medium tracking-tighter [mask-image:linear-gradient(180deg,#000_30%,transparent_85%)]"
        >
          Global
        </motion.p>
        <motion.div style={{ y: globeY }} className="absolute inset-0 z-10">
          <GlobeScene progress={globeProgress} active={active} />
        </motion.div>
        <motion.p style={{ opacity: lede }} className="font-display absolute top-1/2 left-[6%] z-20 max-w-[14rem] text-xl leading-snug text-[#f6efe3]/85">
          Plan anywhere with total clarity and control.
        </motion.p>
        <motion.div style={{ opacity: cta, y: ctaY }} className="absolute inset-x-0 bottom-[17%] z-20 flex flex-col items-center gap-5 px-6 text-center">
          <h3 className="font-display text-[clamp(1.8rem,4vw,3.4rem)] leading-tight">
            Make the next trip <em className="text-[#ff8a62]">an easy decision.</em>
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="group inline-flex items-center gap-2 rounded-full bg-[#ff693d] px-7 py-3.5 text-sm font-semibold text-[#0a1220] transition-transform hover:-translate-y-0.5">
              Create your workspace <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-medium transition-colors hover:bg-white/10">
              Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function Landing() {
  useSmoothScroll();
  const [sound, setSound] = useState(false);
  return (
    <div className="bg-[#07090d] text-foreground">
      <Chrome sound={sound} onSound={() => setSound((s) => !s)} />
      <SkyJourney sound={sound} />
      <JetSection />
      <Features />
      <GlobalSection />
      <footer className="border-t border-white/10 bg-[#07090d] text-[#f6efe3]/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 pb-24 text-sm md:flex-row md:px-10">
          <span className="font-display text-lg text-[#f6efe3]">Trip Optimizer</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
