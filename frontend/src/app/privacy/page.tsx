import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy · AI Trip Optimizer",
  description: "What AI Trip Optimizer collects, why, and how to have it deleted.",
};

const UPDATED = "12 November 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <section>
          <h2>Who we are</h2>
          <p>
            AI Trip Optimizer is a student project that plans business trips by comparing real flight and hotel prices.
            This policy explains what data the app stores and how it is used.
          </p>
        </section>

        <section>
          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Account details:</strong> your email address. If you sign up with a password, only a one-way hash
              of it is stored. If you sign in with Google, we receive your name, email address and whether Google has
              verified it. We do not receive your Google password or access to your Google data.
            </li>
            <li>
              <strong>What you enter:</strong> travelers, their preferences, trips (origin, destination, dates, budget),
              generated itineraries and approval decisions.
            </li>
          </ul>
        </section>

        <section>
          <h2>How we use it</h2>
          <ul>
            <li>To sign you in and keep your workspace separate from other users.</li>
            <li>
              To search flights and hotels. Only the route, dates and city are sent to the travel data providers, never
              your name or email.
            </li>
            <li>
              To write an itinerary summary. When an AI model is enabled, trip details (not your account details) are
              sent to it to write that summary.
            </li>
          </ul>
          <p className="mt-2">We do not sell your data, show ads, or use it for anything other than running the app.</p>
        </section>

        <section>
          <h2>Where it is stored</h2>
          <p>
            Data is stored in a PostgreSQL database hosted by Neon, and the app runs on Vercel. Your sign-in token is
            kept in your browser until you log out.
          </p>
        </section>

        <section>
          <h2>Deleting your data</h2>
          <p>
            Email{" "}
            <a href="mailto:somisettybhuvan5@gmail.com" className="font-medium text-primary hover:underline">
              somisettybhuvan5@gmail.com
            </a>{" "}
            from the address on your account and we will delete your account and everything linked to it. You can also
            remove the app&apos;s access at any time from your Google Account&apos;s security settings.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>If this policy changes, the date at the top of this page is updated.</p>
        </section>
      </div>
    </main>
  );
}
