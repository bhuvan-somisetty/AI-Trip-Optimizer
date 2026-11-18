"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgeCheck, BarChart3, FileCheck2, History, Plane, ShieldCheck, Sparkles } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

function Rise({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

function Logo({ dark = true }: { dark?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-[#ff693d] text-[#0a1220] shadow-[0_10px_28px_-8px_rgba(255,105,61,0.7)]">
        <Plane className="size-[18px]" />
      </span>
      <span className={`font-display text-2xl font-medium ${dark ? "text-[#f6f0e4]" : "text-[#0f1b2d]"}`}>Trip Optimizer</span>
    </Link>
  );
}

const rows = [
  { airline: "IndiGo 6E 2041", meta: "06:05 to 08:15, nonstop", price: "₹5,420", tag: "Chosen", chosen: true },
  { airline: "Air India AI 887", meta: "07:30 to 09:40, nonstop", price: "₹6,980", tag: "Over budget", chosen: false },
  { airline: "Vistara UK 981", meta: "09:10 to 11:25, nonstop", price: "₹6,150", tag: "Breaks cabin policy", chosen: false },
];

function RouteCard() {
  return (
    <div className="relative w-full max-w-md">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-[#ff693d]/20 blur-3xl" aria-hidden />
      <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-[#0d1626]/70 p-5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="flex items-center justify-between text-[11px] tracking-[0.18em] text-white/45 uppercase">
          <span>Example itinerary</span>
          <span className="flex items-center gap-1.5 text-[#ff8a62]">
            <Sparkles className="size-3" /> Optimized
          </span>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="font-display text-4xl text-[#f6f0e4]">DEL</p>
            <p className="text-xs text-white/45">New Delhi</p>
          </div>
          <div className="relative mx-3 mb-3 h-10 flex-1">
            <svg viewBox="0 0 200 40" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
              <path id="route-arc" d="M2 36 Q100 -18 198 36" fill="none" stroke="rgba(246,240,228,0.35)" strokeWidth="1.2" strokeDasharray="3 5" />
              <circle r="3.2" fill="#ff693d">
                <animateMotion dur="5.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.2 1">
                  <mpath href="#route-arc" />
                </animateMotion>
              </circle>
            </svg>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl text-[#f6f0e4]">BOM</p>
            <p className="text-xs text-white/45">Mumbai</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {rows.map((r) => (
            <div
              key={r.airline}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${r.chosen ? "border-[#ff693d]/50 bg-[#ff693d]/10" : "border-white/8 bg-white/[0.03]"}`}
            >
              <div>
                <p className={`text-sm font-medium ${r.chosen ? "text-[#f6f0e4]" : "text-white/70"}`}>{r.airline}</p>
                <p className="text-xs text-white/40">{r.meta}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold tabular-nums ${r.chosen ? "text-[#ffb59b]" : "text-white/60"}`}>{r.price}</p>
                <p className={`text-[11px] ${r.chosen ? "text-[#ff8a62]" : "text-white/35"}`}>{r.tag}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] text-white/35">Every option comes with a reason. A reviewer makes the final call.</p>
      </div>
    </div>
  );
}

const features = [
  { icon: Plane, title: "Plan with real constraints", text: "Dates, budget, cabin, traveler preferences and company policy go in. Live fares and stays come back." },
  { icon: FileCheck2, title: "Every option, explained", text: "Chosen, over budget, breaks policy, slower. Each alternative carries a plain-language reason." },
  { icon: BadgeCheck, title: "A human decides", text: "Reviewers approve or reject with a written reason. Nothing is ever booked automatically." },
  { icon: History, title: "A full audit trail", text: "Who optimized, edited, approved or rejected, and when. Exportable for finance and compliance." },
  { icon: ShieldCheck, title: "Policy built in", text: "Hotel caps, cabin rules and approval limits are set once by admins and enforced on every trip." },
  { icon: BarChart3, title: "Spend you can see", text: "Approved spend, optimizer savings and decision trends in one calm dashboard." },
];

const steps = [
  { n: "01", title: "Describe the trip", text: "Pick the traveler, route, dates and budget." },
  { n: "02", title: "Let the optimizer rank", text: "Flights and hotels are scored against price, time and policy." },
  { n: "03", title: "Review and decide", text: "Approve the winner or reject with a reason. It is all logged." },
];

export function Landing() {
  const reduce = useReducedMotion();
  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="aurora grain relative isolate flex min-h-dvh flex-col overflow-hidden text-[#f6f0e4]">
        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-10">
          <Logo />
          <nav className="flex items-center gap-2 text-sm">
            <a href="#features" className="hidden px-3 py-2 text-white/65 transition-colors hover:text-white sm:block">Features</a>
            <a href="#how" className="hidden px-3 py-2 text-white/65 transition-colors hover:text-white sm:block">How it works</a>
            <Link href="/login" className="rounded-full px-4 py-2 text-white/85 transition-colors hover:text-white">Sign in</Link>
            <Link href="/signup" className="rounded-full bg-[#f6f0e4] px-4 py-2 font-medium text-[#0a1220] transition-transform hover:-translate-y-0.5">Get started</Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-14 px-6 pt-6 pb-20 md:px-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs tracking-wide text-white/75 backdrop-blur"
            >
              <span className="size-1.5 rounded-full bg-[#ff693d]" /> Decision support for business travel
            </motion.p>
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease }}
              className="font-display mt-6 text-[clamp(3rem,8vw,6.5rem)] leading-[0.98] font-light text-balance"
            >
              Smarter travel.
              <br />
              <em className="font-normal text-[#ff8a62]">Better decisions.</em>
            </motion.h1>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease }}
              className="mt-7 max-w-xl text-lg leading-relaxed text-white/65"
            >
              AI Trip Optimizer ranks real flights and hotels against your company policy, explains every choice, and leaves the final call to a person.
            </motion.p>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link href="/signup" className="group inline-flex items-center gap-2 rounded-full bg-[#ff693d] px-6 py-3.5 text-sm font-semibold text-[#0a1220] shadow-[0_18px_40px_-14px_rgba(255,105,61,0.8)] transition-transform hover:-translate-y-0.5">
                Start planning <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/login" className="rounded-full border border-white/20 px-6 py-3.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10">
                Sign in
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.35, ease }}
            className="flex justify-center lg:justify-end"
          >
            <RouteCard />
          </motion.div>
        </div>
      </section>

      {/* Principles strip */}
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-8 text-center md:grid-cols-4 md:px-10">
          {["Policy checked", "Every option explained", "Human final decision", "Complete audit trail"].map((t) => (
            <p key={t} className="font-display text-lg text-foreground/80 md:text-xl">{t}</p>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24 md:px-10">
        <Rise>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">What it does</p>
          <h2 className="font-display mt-3 max-w-2xl text-4xl leading-tight font-light md:text-6xl">
            From a request to a <em className="font-normal text-primary">defensible</em> decision.
          </h2>
        </Rise>
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }, i) => (
            <Rise key={title} delay={(i % 3) * 0.08}>
              <div className="group h-full rounded-3xl border bg-card p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(15,27,45,0.3)]">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-display mt-6 text-2xl font-medium">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </Rise>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-[#0a1220] text-[#f6f0e4]">
        <div className="mx-auto max-w-7xl px-6 py-24 md:px-10">
          <Rise>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#ff8a62] uppercase">How it works</p>
            <h2 className="font-display mt-3 text-4xl font-light md:text-6xl">Three calm steps.</h2>
          </Rise>
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-white/10 md:grid-cols-3">
            {steps.map((st, i) => (
              <Rise key={st.n} delay={i * 0.1} className="bg-[#0a1220]">
                <div className="p-9">
                  <p className="font-display text-6xl font-light text-[#ff693d]">{st.n}</p>
                  <h3 className="font-display mt-6 text-2xl font-medium">{st.title}</h3>
                  <p className="mt-2 text-white/55">{st.text}</p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-10">
        <Rise>
          <div className="aurora grain relative overflow-hidden rounded-[2rem] px-8 py-16 text-center text-[#f6f0e4] md:px-16 md:py-24">
            <h2 className="font-display relative z-10 mx-auto max-w-3xl text-4xl leading-tight font-light text-balance md:text-6xl">
              Make the next business trip <em className="font-normal text-[#ff8a62]">an easy decision.</em>
            </h2>
            <div className="relative z-10 mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="rounded-full bg-[#ff693d] px-7 py-3.5 text-sm font-semibold text-[#0a1220] transition-transform hover:-translate-y-0.5">Create your workspace</Link>
              <Link href="/login" className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-medium transition-colors hover:bg-white/10">Sign in</Link>
            </div>
          </div>
        </Rise>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row md:px-10">
          <Logo dark={false} />
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
