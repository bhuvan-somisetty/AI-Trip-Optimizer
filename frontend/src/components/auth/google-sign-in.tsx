"use client";

import { useState } from "react";
import Link from "next/link";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { Loader2 } from "lucide-react";
import * as api from "@/lib/api";
import type { Session } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/auth/google-icon";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * "Sign in with Google" for the login and signup pages. With NEXT_PUBLIC_GOOGLE_CLIENT_ID set it
 * shows Google's own button and trades its ID token for an API session (POST /auth/google).
 * Without it, demo mode keeps the old button that opens the demo workspace; otherwise nothing shows.
 */
export function GoogleSignIn({
  onSession,
  onError,
}: {
  onSession: (session: Session) => void;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!GOOGLE_CLIENT_ID && !api.DEMO_ENABLED) return null;

  async function signIn(credential: string | undefined) {
    if (!credential) {
      onError("Google sign-in didn't return an account. Please try again.");
      return;
    }
    onError(null);
    setBusy(true);
    try {
      onSession(await api.loginWithGoogle(credential));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Google sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <div className="relative flex min-h-11 justify-center" aria-busy={busy}>
            <GoogleLogin
              onSuccess={({ credential }) => signIn(credential)}
              onError={() => onError("Google sign-in was cancelled or failed. Please try again.")}
              text="continue_with"
              shape="pill"
              size="large"
              width="320"
            />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80" role="status">
                <Loader2 className="size-5 animate-spin" aria-hidden />
                <span className="sr-only">Signing in with Google…</span>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            See our{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              privacy policy
            </Link>{" "}
            for what Google sign-in shares.
          </p>
        </GoogleOAuthProvider>
      ) : (
        // Opens the demo workspace (generated data); only reachable when demo mode is enabled.
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full transition-transform active:scale-[0.98]"
          onClick={() => onSession({ name: "Workspace Admin", email: "admin@acmecorp.in", role: "admin", mode: "demo" })}
        >
          <GoogleIcon className="size-4" />
          Continue with Google
        </Button>
      )}
    </>
  );
}
