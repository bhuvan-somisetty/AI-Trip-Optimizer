"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, Plane, User } from "lucide-react";
import { actions } from "@/lib/store";
import * as api from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

export type AuthMode = "signin" | "signup";
type SessionLike = Awaited<ReturnType<typeof api.login>>;

// The obsidian panel's outline for each mode, and the thin tangerine edge just outside it. Same
// four points in both, so the diagonal sweeps across the card when the mode changes.
const BRAND: Record<AuthMode, string> = {
  signin: "polygon(56% 0, 100% 0, 100% 100%, 45% 100%)",
  signup: "polygon(0 0, 55% 0, 44% 100%, 0 100%)",
};
const EDGE: Record<AuthMode, string> = {
  signin: "polygon(55.6% 0, 100% 0, 100% 100%, 44.6% 100%)",
  signup: "polygon(0 0, 55.4% 0, 44.4% 100%, 0 100%)",
};
const PATH: Record<AuthMode, string> = { signin: "/login", signup: "/signup" };

const INK = "text-[#17120d]";
const LINK =
  "font-medium text-[#a9411a] underline decoration-[#ff6a3d] decoration-2 underline-offset-4 transition-colors hover:text-[#17120d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a3d]/60 rounded-sm";

/**
 * Sign in and create account on one card: a porcelain form panel and an obsidian panel with a
 * tangerine horizon, split by a diagonal. Switching modes sweeps the diagonal across and swaps
 * the two sides, and the address bar follows (/login, /signup) without reloading the page.
 */
export function AuthCard({ initial }: { initial: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchTo(next: AuthMode) {
    setMode(next);
    setError(null);
    window.history.replaceState(null, "", PATH[next] + window.location.search);
  }

  function finish(session: SessionLike) {
    actions.login(session);
    toast(`Welcome${session.name ? `, ${session.name.split(" ")[0]}` : ""}!`, {
      description: session.mode === "api" ? "Signed in with the API." : "Signed in to your workspace.",
    });
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") ? next : "/dashboard");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      finish(mode === "signin" ? await api.login(email, password) : await api.register(name, email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  const props = { loading, error, onSubmit: submit, onSession: finish, onError: setError };
  return (
    <main className="hero-obsidian grain relative isolate flex h-dvh flex-col overflow-hidden bg-[#06080d] text-[#ece6da]">
      <header className="relative z-10 flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 [@media(max-height:700px)]:py-2.5">
        <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a3d]/60">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#ff6a3d] text-[#170803]">
            <Plane className="size-4" />
          </span>
          <span className="font-editorial text-xl">Trip Optimizer</span>
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#ece6da]/60 transition-colors hover:text-[#ece6da]">
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-5 sm:px-6 sm:pb-8">
        <section
          aria-label={mode === "signin" ? "Sign in" : "Create account"}
          className="relative flex max-h-full w-full max-w-[920px] flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f3ede3] to-[#e8e0d2] shadow-[0_50px_100px_-40px_rgba(0,0,0,0.95)] ring-1 ring-white/10 md:block md:h-full md:max-h-[640px]"
        >
          {/* Thin tangerine edge along the diagonal (desktop only). */}
          <div
            aria-hidden
            className="absolute inset-0 hidden bg-gradient-to-b from-[#ffb08f] via-[#ff6a3d] to-[#c2491f] transition-[clip-path] duration-[900ms] ease-[cubic-bezier(.7,0,.2,1)] motion-reduce:transition-none md:block"
            style={{ clipPath: EDGE[mode] }}
          />

          {/* The obsidian panel: a header band on phones, one side of the diagonal from md up. */}
          <div
            className="auth-brand relative shrink-0 overflow-hidden max-md:[@media(max-height:600px)]:hidden bg-[#06080d] px-7 py-6 max-md:[@media(max-height:760px)]:py-4 transition-[clip-path] duration-[900ms] ease-[cubic-bezier(.7,0,.2,1)] motion-reduce:transition-none md:absolute md:inset-0 md:p-0 md:[clip-path:var(--brand)]"
            style={{ "--brand": BRAND[mode] } as React.CSSProperties}
          >
            {/* The tangerine horizon sits low in whichever side the panel covers. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(110% 70% at ${mode === "signin" ? "85%" : "18%"} 115%, rgba(255,106,61,0.38), transparent 60%), radial-gradient(70% 60% at ${mode === "signin" ? "60%" : "10%"} 0%, rgba(111,143,179,0.16), transparent 60%)`,
              }}
            />
            <BrandText active={mode === "signin"} side="right" eyebrow="Trip Optimizer" first="Welcome" second="back." note="Your trips, reviews and savings are exactly where you left them." />
            <BrandText active={mode === "signup"} side="left" eyebrow="Trip Optimizer" first="Plan the" second="first trip." note="One account for every trip, every review and every decision." />
          </div>

          <FormSide active={mode === "signin"} side="left">
            <SignInForm {...props} onSwitch={() => switchTo("signup")} />
          </FormSide>
          <FormSide active={mode === "signup"} side="right">
            <SignUpForm {...props} onSwitch={() => switchTo("signin")} />
          </FormSide>
        </section>
      </div>
    </main>
  );
}

/** The serif headline on the obsidian panel; only the active mode's shows, on its side of the diagonal. */
function BrandText({ active, side, eyebrow, first, second, note }: { active: boolean; side: "left" | "right"; eyebrow: string; first: string; second: string; note: string }) {
  return (
    <div
      aria-hidden={!active}
      className={cn(
        "relative transition-all duration-700 motion-reduce:transition-none md:absolute md:top-1/2 md:w-[38%] md:-translate-y-1/2",
        side === "right" ? "md:right-[6%]" : "md:left-[6%]",
        active ? "opacity-100 delay-300" : "pointer-events-none hidden opacity-0 md:block",
        !active && (side === "right" ? "md:translate-x-8" : "md:-translate-x-8")
      )}
    >
      <p className="text-[11px] font-medium tracking-[0.32em] text-[#ff8a5c] uppercase max-md:[@media(max-height:660px)]:hidden">{eyebrow}</p>
      <h2 className="font-editorial mt-3 text-[2.1rem] leading-[0.95] text-[#ece6da] max-md:[@media(max-height:760px)]:mt-1.5 max-md:[@media(max-height:760px)]:text-[1.7rem] md:mt-4 md:text-[clamp(2.6rem,5vw,3.6rem)]">
        {first}
        <br />
        <em className="bg-gradient-to-r from-[#ffd2bd] via-[#ff9a72] to-[#ff6a3d] bg-clip-text text-transparent">{second}</em>
      </h2>
      <p className="mt-5 hidden max-w-xs text-sm leading-relaxed text-[#ece6da]/60 md:block">{note}</p>
    </div>
  );
}

/** One form's half of the card. The other mode's form is hidden and inert, so focus can't reach it. */
function FormSide({ active, side, children }: { active: boolean; side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div
      inert={!active}
      aria-hidden={!active}
      className={cn(
        "relative min-h-0 px-7 py-6 max-md:overflow-y-auto max-md:[@media(max-height:760px)]:py-4 max-md:[@media(max-height:660px)]:py-2 transition-all duration-700 motion-reduce:transition-none sm:px-10 md:absolute md:top-0 md:bottom-0 md:flex md:w-[46%] md:flex-col md:justify-center md:px-12 md:py-0",
        side === "left" ? "md:left-0" : "md:right-0",
        active ? "opacity-100 delay-300" : "pointer-events-none hidden opacity-0 md:flex",
        !active && (side === "left" ? "md:-translate-x-10" : "md:translate-x-10")
      )}
    >
      {children}
    </div>
  );
}

type FormProps = {
  loading: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onSession: (s: SessionLike) => void;
  onError: (m: string | null) => void;
  onSwitch: () => void;
};

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className={cn("text-[1.7rem] font-semibold tracking-tight [@media(max-height:820px)]:text-[1.45rem]", INK)}>{children}</h1>
      <span aria-hidden className="mt-2 block h-[3px] w-10 rounded-full bg-[#ff6a3d]" />
    </div>
  );
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl border border-[#c0392b]/25 bg-[#c0392b]/[0.08] px-3 py-2 text-sm text-[#9b2c1f]">
      {error}
    </p>
  );
}

function Submit({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full [@media(max-height:820px)]:h-11 bg-[#0c1018] text-[15px] font-medium text-[#ece6da] shadow-[0_16px_30px_-14px_rgba(12,16,24,0.9)] transition-all duration-300 hover:-translate-y-px hover:bg-[#161c28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a3d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#efe8dc] active:translate-y-0 disabled:opacity-70 motion-reduce:transition-none"
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** An underlined field whose label floats up when the field is focused or filled. */
function Field({
  id,
  label,
  type = "text",
  autoComplete,
  icon,
  value,
  onValue,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete: string;
  icon: React.ReactNode;
  value?: string;
  onValue?: (v: string) => void;
}) {
  return (
    <div className="relative pt-4">
      <input
        id={id}
        name={id.split("-")[1]}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder=" "
        value={value}
        onChange={onValue ? (e) => onValue(e.target.value) : undefined}
        className={cn(
          "peer w-full rounded-none border-0 border-b border-[#17120d]/20 bg-transparent pt-1.5 pr-9 pb-2 text-[15px] outline-none transition-colors placeholder:text-transparent focus:border-[#17120d]/20",
          INK
        )}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-[1.35rem] left-0 text-[15px] text-[#17120d]/55 transition-all duration-200 peer-focus:top-0 peer-focus:text-[11px] peer-focus:text-[#a9411a] peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[11px]"
      >
        {label}
      </label>
      <span className="absolute top-[1.2rem] right-0 text-[#17120d]/45">{icon}</span>
      <span aria-hidden className="absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-[#ff6a3d] transition-transform duration-300 peer-focus:scale-x-100 motion-reduce:transition-none" />
    </div>
  );
}

function PasswordField({ id, autoComplete, value, onValue }: { id: string; autoComplete: string; value?: string; onValue?: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      id={id}
      label="Password"
      type={show ? "text" : "password"}
      autoComplete={autoComplete}
      value={value}
      onValue={onValue}
      icon={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="rounded-sm transition-colors hover:text-[#17120d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a3d]/60"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}

function SignInForm({ loading, error, onSubmit, onSession, onError, onSwitch }: FormProps) {
  return (
    <div className="space-y-6 [@media(max-height:820px)]:space-y-4">
      <Heading>Sign in</Heading>
      <form className="space-y-5 [@media(max-height:820px)]:space-y-3" onSubmit={onSubmit} noValidate={false}>
        <ErrorNote error={error} />
        <Field id="signin-email" label="Email address" type="email" autoComplete="email" icon={<Mail className="size-4" />} />
        <PasswordField id="signin-password" autoComplete="current-password" />
        <div className="flex items-center justify-between text-sm">
          <label className={cn("flex items-center gap-2", "text-[#17120d]/70")}>
            <input type="checkbox" defaultChecked className="size-4 rounded accent-[#0c1018]" />
            Keep me signed in
          </label>
          <Link href="/forgot-password" className={LINK}>
            Forgot password?
          </Link>
        </div>
        <Submit loading={loading}>Sign in</Submit>
      </form>
      <Google onSession={onSession} onError={onError} />
      <p className="text-sm text-[#17120d]/65">
        New to Trip Optimizer?{" "}
        <button type="button" onClick={onSwitch} className={LINK}>
          Create an account
        </button>
      </p>
    </div>
  );
}

/** How strong a new password is, 0 to 4: length 6+, length 10+, a digit, and a capital or symbol. */
export function strength(password: string): number {
  if (!password) return 0;
  return [password.length >= 6, password.length >= 10, /\d/.test(password), /[A-Z]|[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
}
const STRENGTH = ["Use 6 characters or more.", "Weak", "Fair", "Good", "Strong"];

function SignUpForm({ loading, error, onSubmit, onSession, onError, onSwitch }: FormProps) {
  const [password, setPassword] = useState("");
  const score = strength(password);
  return (
    <div className="space-y-6 [@media(max-height:820px)]:space-y-4">
      <Heading>Create account</Heading>
      <form className="space-y-5 [@media(max-height:820px)]:space-y-3" onSubmit={onSubmit}>
        <ErrorNote error={error} />
        <Field id="signup-name" label="Full name" autoComplete="name" icon={<User className="size-4" />} />
        <Field id="signup-email" label="Email address" type="email" autoComplete="email" icon={<Mail className="size-4" />} />
        <div>
          <PasswordField id="signup-password" autoComplete="new-password" value={password} onValue={setPassword} />
          <div className="mt-2 flex items-center gap-3">
            <div aria-hidden className="flex flex-1 gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", n <= score ? "bg-[#ff6a3d]" : "bg-[#17120d]/12")} />
              ))}
            </div>
            <span aria-live="polite" className="text-xs text-[#17120d]/60">
              {password ? STRENGTH[score] : STRENGTH[0]}
            </span>
          </div>
        </div>
        <Submit loading={loading}>Create account</Submit>
      </form>
      <Google onSession={onSession} onError={onError} />
      <p className="text-sm text-[#17120d]/65">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} className={LINK}>
          Sign in
        </button>
      </p>
    </div>
  );
}

/** Google sign-in, on the porcelain panel's own colours. */
function Google({ onSession, onError }: { onSession: (s: SessionLike) => void; onError: (m: string | null) => void }) {
  return (
    <div className="space-y-3 text-[#17120d]/60 [&_.bg-border]:bg-[#17120d]/15 [&_.text-muted-foreground]:text-[#17120d]/55 [@media(max-height:820px)]:space-y-2 [&>p]:text-[11px] max-md:[@media(max-height:760px)]:[&>p]:hidden">
      <GoogleSignIn onSession={onSession} onError={onError} />
    </div>
  );
}
