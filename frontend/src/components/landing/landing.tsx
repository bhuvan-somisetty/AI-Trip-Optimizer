"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Lenis from "lenis";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, FileCheck2, History, Plane, ShieldCheck } from "lucide-react";

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
  return { ref, p: scrollYProgress };
}

/* ---------- Fixed chrome ---------- */

function Chrome() {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 text-white mix-blend-difference md:px-10">
        <nav className="hidden items-center gap-7 text-[13px] tracking-wide md:flex">
          <a href="#story">About</a>
          <a href="#jet">Optimizer</a>
          <a href="#features">Features</a>
          <a href="#global">Global</a>
        </nav>
        <Link href="/" className="font-display text-xl tracking-tight md:absolute md:left-1/2 md:-translate-x-1/2">
          Trip Optimizer
        </Link>
        <Link href="/login" className="text-[13px] tracking-wide">
          Sign in
        </Link>
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

/* ---------- 1. Airplane window opening into the clouds ---------- */

function Clouds() {
  const blobs = [
    { top: "12%", left: "-10%", w: "70%", h: "22%", d: 22, o: 0.75 },
    { top: "34%", left: "30%", w: "80%", h: "26%", d: 28, o: 0.6 },
    { top: "58%", left: "-20%", w: "90%", h: "30%", d: 26, o: 0.85 },
    { top: "72%", left: "20%", w: "90%", h: "34%", d: 32, o: 0.9 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#7fa9e0_0%,#bcd5ee_38%,#efd4d2_72%,#e2aeb0_100%)]">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-[50%] bg-white blur-2xl"
          style={{ top: b.top, left: b.left, width: b.w, height: b.h, opacity: b.o }}
          animate={{ x: [0, i % 2 ? 40 : -40, 0] }}
          transition={{ duration: b.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function WindowHero() {
  const { ref, p } = useSection();
  const scale = useTransform(p, [0, 0.45, 0.78], [1, 3.4, 9.5]);
  const side = useTransform(p, [0, 0.16], [1, 0]);
  const sideY = useTransform(p, [0, 0.16], [0, -40]);
  const shade = useTransform(p, [0, 0.14], ["36%", "0%"]);
  const brand = useTransform(p, [0.58, 0.72, 0.92, 1], [0, 1, 1, 0]);
  const warm = useTransform(p, [0.5, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative h-[340vh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-[#1a100b]">
        <motion.div
          style={{ opacity: warm }}
          className="absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_45%,#d6a577_0%,#8a5a3a_38%,#2b1a12_75%,#140b07_100%)]"
        />
        <div className="grain pointer-events-none absolute inset-0" />

        <motion.div style={{ opacity: side, y: sideY }} className="pointer-events-none absolute inset-0 z-10">
          <h1 className="font-display absolute top-[22%] left-[6%] text-[clamp(2.6rem,6.4vw,6rem)] leading-[0.95] font-normal text-[#f6efe3]">
            Smarter
            <br />
            travel.
          </h1>
          <h1 className="font-display absolute right-[6%] bottom-[24%] text-right text-[clamp(2.6rem,6.4vw,6rem)] leading-[0.95] font-normal text-[#f6efe3]">
            Better
            <br />
            decisions.
          </h1>
          <div className="absolute bottom-[14%] left-[6%] max-w-[15rem] text-[#f6efe3]/80">
            <p className="font-display text-2xl leading-tight">Your decisions, made clear.</p>
            <p className="mt-3 text-[12px] leading-relaxed text-[#f6efe3]/55">
              Every flight and stay is ranked against your policy. A reviewer makes the final call.
            </p>
          </div>
          <p className="absolute right-[6%] bottom-[7%] text-[10px] tracking-[0.25em] text-[#f6efe3]/60 uppercase">Scroll down to begin</p>
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            style={{ scale }}
            className="relative h-[60dvh] w-[39.6dvh] rounded-[50%/42%] bg-gradient-to-b from-[#fbf4e8] via-[#e8dac4] to-[#cdb89b] p-[3.4%] shadow-[0_0_120px_30px_rgba(255,214,160,0.35),inset_0_2px_6px_rgba(255,255,255,0.8)]"
          >
            <div className="relative h-full w-full overflow-hidden rounded-[50%/42%] shadow-[inset_0_0_40px_rgba(60,40,20,0.45)]">
              <Clouds />
              <motion.div
                style={{ height: shade }}
                className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-[#f1e6d3] to-[#dcc9ab] shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
              />
            </div>
          </motion.div>
        </div>

        <motion.div style={{ opacity: brand }} className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center text-center text-white">
          <p className="mb-4 text-[11px] tracking-[0.3em] uppercase opacity-80">Welcome aboard</p>
          <p className="font-display text-[clamp(3rem,8vw,7.5rem)] leading-none font-light">Trip Optimizer</p>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- 2. Statement with scroll-linked word reveal ---------- */

const STATEMENT =
  "AI Trip Optimizer is decision support for business travel. It compares real flights and hotels, checks every option against company policy and explains each choice, so reviewers can approve with confidence, every single time.";

function Word({ word, range, p }: { word: string; range: [number, number]; p: MotionValue<number> }) {
  const opacity = useTransform(p, range, [0.14, 1]);
  const blur = useTransform(p, range, ["blur(6px)", "blur(0px)"]);
  return (
    <motion.span style={{ opacity, filter: blur }} className="mr-[0.28em] inline-block">
      {word}
    </motion.span>
  );
}

function Statement() {
  const { ref, p } = useSection();
  const words = STATEMENT.split(" ");
  const cols = useTransform(p, [0.62, 0.8], [0, 1]);
  const colsY = useTransform(p, [0.62, 0.8], [30, 0]);
  return (
    <section id="story" ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden bg-[linear-gradient(180deg,#bcd2f2_0%,#5d8fe0_45%,#2f63c9_100%)] px-6 text-white md:px-16">
        <div className="grain pointer-events-none absolute inset-0" />
        <p className="font-display relative mx-auto max-w-6xl text-[clamp(1.9rem,4.6vw,4.2rem)] leading-[1.08] font-light">
          {words.map((w, i) => {
            const a = (i / words.length) * 0.6;
            return <Word key={i} word={w} range={[a, a + 0.08]} p={p} />;
          })}
        </p>
        <motion.div style={{ opacity: cols, y: colsY }} className="relative mx-auto mt-14 grid w-full max-w-6xl gap-8 text-sm text-white/85 md:grid-cols-3">
          {[
            ["Live fares and stays", "Real options from live search, never a canned list."],
            ["Your policy, enforced", "Cabin rules and hotel caps are checked on every itinerary."],
            ["A person decides", "Approve or reject with a written reason. Nothing books itself."],
          ].map(([t, d]) => (
            <div key={t} className="border-t border-white/35 pt-4">
              <p className="font-display text-2xl">{t}</p>
              <p className="mt-2 max-w-xs text-white/70">{d}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- 3. Rotating 3D jet ---------- */

function JetSection() {
  const { ref, p } = useSection();
  const headOpacity = useTransform(p, [0, 0.12, 0.56, 0.7], [0, 1, 1, 0]);
  const leftX = useTransform(p, [0, 0.2], [-60, 0]);
  const rightX = useTransform(p, [0, 0.2], [60, 0]);
  const spec = useTransform(p, [0.62, 0.8], [0, 1]);
  const specY = useTransform(p, [0.62, 0.8], [40, 0]);
  const jetProgress = useTransform(p, [0.1, 0.85], [0, 1]);

  return (
    <section id="jet" ref={ref} className="relative h-[380vh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-[radial-gradient(70%_60%_at_50%_40%,#f7f0e3_0%,#e8dcc8_60%,#d9c9ae_100%)] text-[#2a211b]">
        <div className="absolute inset-0 z-0">
          <JetScene progress={jetProgress} />
        </div>

        <motion.div style={{ opacity: headOpacity }} className="pointer-events-none absolute inset-0 z-10">
          <motion.h2 style={{ x: leftX }} className="font-display absolute top-1/2 left-[5%] -translate-y-1/2 text-[clamp(3rem,9vw,8.5rem)] leading-none font-normal">
            Plan in
          </motion.h2>
          <motion.h2 style={{ x: rightX }} className="font-display absolute top-1/2 right-[5%] -translate-y-1/2 text-[clamp(3rem,9vw,8.5rem)] leading-none font-normal">
            Clarity
          </motion.h2>
          <p className="font-display absolute bottom-[16%] left-[5%] max-w-[12rem] text-xl leading-snug opacity-80">Decisions that move with you</p>
          <p className="absolute right-[5%] bottom-[14%] hidden max-w-[17rem] text-[12px] leading-relaxed opacity-70 md:block">
            Dates, budget, cabin and traveler preferences go in. The optimizer returns a ranked itinerary and a plain reason for every alternative it set aside.
          </p>
        </motion.div>

        <motion.div style={{ opacity: spec, y: specY }} className="pointer-events-none absolute inset-0 z-10 grid items-center px-6 md:grid-cols-[1fr_auto_1fr] md:px-16">
          <div>
            <p className="text-[11px] tracking-[0.25em] uppercase opacity-60">Example trip</p>
            <p className="font-display mt-2 text-[clamp(3rem,8vw,7rem)] leading-none">DEL to BOM</p>
          </div>
          <div className="hidden w-[22vw] md:block" />
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 text-sm md:mt-0">
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
    <section id="features" className="bg-[#f3eee4] text-[#0f1b2d]">
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
  const { ref, p } = useSection();
  const textY = useTransform(p, [0, 1], ["8%", "-6%"]);
  const globeProgress = useTransform(p, [0, 1], [0, 1]);
  const cta = useTransform(p, [0.55, 0.8], [0, 1]);
  const ctaY = useTransform(p, [0.55, 0.8], [30, 0]);
  return (
    <section id="global" ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-[linear-gradient(180deg,#2c1d17_0%,#120b09_55%,#07090d_100%)] text-[#f6efe3]">
        <motion.p
          style={{ y: textY }}
          className="font-display pointer-events-none absolute inset-x-0 top-[6%] text-center text-[clamp(7rem,26vw,26rem)] leading-none font-medium tracking-tighter [mask-image:linear-gradient(180deg,#000_30%,transparent_85%)]"
        >
          Global
        </motion.p>
        <div className="absolute inset-0 z-10">
          <GlobeScene progress={globeProgress} />
        </div>
        <p className="font-display absolute bottom-[22%] left-[6%] z-20 max-w-[14rem] text-xl leading-snug text-[#f6efe3]/85">Plan anywhere with total clarity and control.</p>
        <motion.div style={{ opacity: cta, y: ctaY }} className="absolute inset-x-0 bottom-[16%] z-20 flex flex-col items-center gap-5 text-center md:bottom-[12%]">
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
  return (
    <div className="bg-[#07090d] text-foreground">
      <Chrome />
      <WindowHero />
      <Statement />
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
