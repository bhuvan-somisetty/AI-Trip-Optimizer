"use client";

import { useEffect, useRef } from "react";
import { useMotionValueEvent, type MotionValue } from "framer-motion";

// Soundtrack for the landing story, mixed from scroll position.
//
// Each layer loops a recording from /sounds/<name>.mp3 when one is present and otherwise falls back
// to a synthesised stand-in, so the page always has sound and real recordings can be dropped in
// later without code changes. Nothing plays until the visitor turns sound on (browsers only allow
// audio after a click), and every layer fades with the scene it belongs to.

type Layer = { name: string; level: number; gain: (y: number) => number };

const ramp = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const span = (inA: number, inB: number, outA: number, outB: number) => (y: number) => ramp(inA, inB, y) * (1 - ramp(outA, outB, y));

// Scroll positions (vh into the story) match the timeline in sky-journey.tsx.
const LAYERS: Layer[] = [
  { name: "cabin", level: 0.5, gain: span(-1, 0, 160, 300) },
  { name: "wind", level: 0.45, gain: span(150, 300, 900, 960) },
  { name: "jet", level: 0.7, gain: span(260, 400, 1250, 1330) },
  { name: "waterfall", level: 0.55, gain: (y) => span(1330, 1400, 2010, 2045)(y) * (0.75 + 0.45 * ramp(1900, 2000, y)) },
  { name: "train", level: 0.55, gain: span(1400, 1520, 1960, 2020) },
  { name: "road", level: 0.55, gain: span(2020, 2090, 2290, 2370) },
];
const HORN_AT = 1550;

function noiseBuffer(ctx: AudioContext, seconds: number, color: "white" | "brown") {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "white") d[i] = w;
    else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

function loopSource(ctx: AudioContext, buffer: AudioBuffer) {
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  s.loop = true;
  s.start();
  return s;
}

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

// Synthesised stand-ins, connected into `out`.
function synth(ctx: AudioContext, name: string, out: AudioNode) {
  const brown = noiseBuffer(ctx, 4, "brown");
  const white = noiseBuffer(ctx, 4, "white");
  const chain = (src: AudioNode, ...nodes: AudioNode[]) => {
    let n = src;
    for (const next of nodes) {
      n.connect(next);
      n = next;
    }
    n.connect(out);
  };
  const gain = (v: number) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  switch (name) {
    case "cabin": {
      // Cabin hum: low broadband roar with a faint engine tone.
      chain(loopSource(ctx, brown), filter(ctx, "lowpass", 380), gain(0.9));
      const o = ctx.createOscillator();
      o.frequency.value = 118;
      o.start();
      chain(o, filter(ctx, "lowpass", 300), gain(0.03));
      break;
    }
    case "wind": {
      // Air rush with a slow swell.
      const g = gain(0.5);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const depth = gain(0.25);
      lfo.connect(depth).connect(g.gain);
      lfo.start();
      chain(loopSource(ctx, white), filter(ctx, "bandpass", 650, 0.4), g);
      break;
    }
    case "jet": {
      // Turbofan: deep roar plus a thin fan whine.
      chain(loopSource(ctx, brown), filter(ctx, "lowpass", 900), gain(1.0));
      chain(loopSource(ctx, white), filter(ctx, "bandpass", 2400, 6), gain(0.05));
      break;
    }
    case "waterfall": {
      chain(loopSource(ctx, white), filter(ctx, "bandpass", 1100, 0.35), gain(0.6));
      chain(loopSource(ctx, brown), filter(ctx, "lowpass", 500), gain(0.8));
      break;
    }
    case "train": {
      // Rumble, and the double clack of each bogie over a rail joint, looped.
      chain(loopSource(ctx, brown), filter(ctx, "lowpass", 420), gain(0.8));
      const seconds = 2.4;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (const t of [0, 0.16, 1.2, 1.36]) {
        const start = Math.floor(t * ctx.sampleRate);
        for (let i = 0; i < ctx.sampleRate * 0.07; i++) d[start + i] += (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
      }
      chain(loopSource(ctx, buf), filter(ctx, "bandpass", 900, 0.8), gain(0.7));
      break;
    }
    case "road": {
      // Diesel engine note and tyre roar.
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = 46;
      o.start();
      chain(o, filter(ctx, "lowpass", 180), gain(0.18));
      chain(loopSource(ctx, brown), filter(ctx, "lowpass", 700), gain(0.7));
      break;
    }
  }
}

// public/sounds/manifest.json lists the recordings that exist, so missing ones are never requested.
async function availableRecordings() {
  try {
    const res = await fetch("/sounds/manifest.json");
    return res.ok ? new Set<string>(await res.json()) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

async function tryRecording(ctx: AudioContext, name: string, available: Set<string>) {
  if (!available.has(name)) return null;
  try {
    const res = await fetch(`/sounds/${name}.mp3`);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function hornSynth(ctx: AudioContext, out: AudioNode) {
  // Two-tone horn, a little over a second.
  const g = ctx.createGain();
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.16, now + 0.08);
  g.gain.setValueAtTime(0.16, now + 1.1);
  g.gain.linearRampToValueAtTime(0, now + 1.5);
  const lp = filter(ctx, "lowpass", 1800);
  lp.connect(g).connect(out);
  for (const f of [311, 370]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(lp);
    o.start(now);
    o.stop(now + 1.6);
  }
}

type Engine = { ctx: AudioContext; master: GainNode; gains: GainNode[]; horn: AudioBuffer | null };

export function useJourneySound(y: MotionValue<number>, enabled: boolean) {
  const engine = useRef<Engine | null>(null);
  const lastY = useRef(0);

  const mix = (v: number) => {
    const e = engine.current;
    if (!e) return;
    const t = e.ctx.currentTime;
    LAYERS.forEach((layer, i) => e.gains[i].gain.setTargetAtTime(layer.gain(v) * layer.level, t, 0.25));
    // The horn sounds once as the bridge comes into view, scrolling down.
    if (lastY.current < HORN_AT && v >= HORN_AT) {
      if (e.horn) {
        const s = e.ctx.createBufferSource();
        s.buffer = e.horn;
        const g = e.ctx.createGain();
        g.gain.value = 0.6;
        s.connect(g).connect(e.master);
        s.start();
      } else hornSynth(e.ctx, e.master);
    }
    lastY.current = v;
  };

  useMotionValueEvent(y, "change", mix);

  useEffect(() => {
    if (!enabled) {
      const e = engine.current;
      if (e) {
        e.master.gain.setTargetAtTime(0, e.ctx.currentTime, 0.15);
        const ctx = e.ctx;
        const id = window.setTimeout(() => void ctx.suspend(), 400);
        return () => window.clearTimeout(id);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      if (!engine.current) {
        const ctx = new AudioContext();
        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        const gains = LAYERS.map(() => {
          const g = ctx.createGain();
          g.gain.value = 0;
          g.connect(master);
          return g;
        });
        engine.current = { ctx, master, gains, horn: null };
        const available = await availableRecordings();
        const [recordings, horn] = await Promise.all([Promise.all(LAYERS.map((l) => tryRecording(ctx, l.name, available))), tryRecording(ctx, "horn", available)]);
        recordings.forEach((buf, i) => (buf ? loopSource(ctx, buf).connect(gains[i]) : synth(ctx, LAYERS[i].name, gains[i])));
        engine.current.horn = horn;
      }
      if (cancelled) return;
      const e = engine.current;
      await e.ctx.resume();
      lastY.current = y.get();
      mix(y.get());
      e.master.gain.setTargetAtTime(0.9, e.ctx.currentTime, 0.4);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, y]);

  useEffect(
    () => () => {
      void engine.current?.ctx.close();
      engine.current = null;
    },
    [],
  );
}
