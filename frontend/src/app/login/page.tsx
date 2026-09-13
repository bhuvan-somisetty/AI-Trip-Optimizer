"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plane,
  FileCheck2,
  BadgeCheck,
  BarChart3,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Backend auth isn't wired up yet — go straight to the dashboard for now.
    router.push("/dashboard");
  }

  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-2">
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
          className="relative z-10 flex items-center gap-2"
        >
          <span className="text-2xl font-bold">AI Trip Optimizer</span>
        </motion.div>

        <div className="relative z-10 space-y-10">
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={0.15}
          >
            <p className="text-3xl font-semibold tracking-tight">
              Smarter Travel.
            </p>
            <p className="text-3xl font-semibold tracking-tight">
              Better Decisions.
            </p>
            <p className="text-3xl font-semibold tracking-tight text-white/60">
              For Your Business.
            </p>
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
        <Link
          href="/"
          className="absolute top-6 left-6 z-10 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:top-10 sm:left-10"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-sm space-y-7"
        >
          <div className="space-y-1.5 text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
            <p className="text-sm text-muted-foreground">
              Log in to your account to continue.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="pl-9 transition-shadow focus-visible:shadow-[0_0_0_4px_var(--color-primary)]/10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="pr-9 pl-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox id="remember" defaultChecked />
                Remember me
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
            >
              Login
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full transition-transform active:scale-[0.98]"
            onClick={() => router.push("/dashboard")}
          >
            <GoogleIcon className="size-4" />
            Continue with Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            New to AI Trip Optimizer?{" "}
            <Link href="/contact" className="font-medium text-primary hover:underline">
              Contact your admin.
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.08 3.56-5.14 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
