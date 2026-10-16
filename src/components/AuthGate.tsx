"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { AppMark } from "./icons";

const noop = () => () => {};

export function AuthGate({ children }: { children: React.ReactNode }) {
  // undefined = still checking, null = signed out.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Dev only: the design preview at /dev/preview renders fake data, no session needed.
  const devPreview = useSyncExternalStore(
    noop,
    () => process.env.NODE_ENV !== "production" && window.location.pathname.startsWith("/dev/"),
    () => false,
  );
  if (devPreview) {
    return <>{children}</>;
  }
  if (session === undefined) return null;
  if (session) return <>{children}</>;
  return <SignIn />;
}

/** The sign-in screen: email link, or the code from the same email. Also in the dev preview. */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "bad-code">(
    "idle",
  );

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    setStatus(error ? "error" : "sent");
  }

  // The installed iPhone app keeps its own login, apart from Safari, so a
  // link opened from email signs in Safari. Typing the code signs in here.
  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) setStatus("bad-code");
  }

  const field =
    "h-[52px] w-full rounded-full bg-panel px-5 text-[16px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ink";
  const pill =
    "flex h-[52px] w-full items-center justify-center rounded-full text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.98] disabled:opacity-60 motion-reduce:active:scale-100";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 pb-16 pt-16">
      <AppMark className="h-16 w-16" />
      <h1 className="headline mt-8 text-[clamp(3.5rem,19vw,5rem)]">Tripsy</h1>
      <p className="mt-3 text-[20px] font-light leading-snug">Your trips, live with whoever’s coming.</p>
      <p className="mt-8 text-[14px] text-muted">Use the email your trip is shared with.</p>
      <form onSubmit={sendLink} className="mt-3 space-y-2.5">
        <input
          type="email"
          required
          autoComplete="email"
          aria-label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className={field}
        />
        <button type="submit" disabled={status === "sending"} className={`${pill} bg-ink text-white`}>
          {status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {(status === "sent" || status === "bad-code") && (
        <form onSubmit={verifyCode} className="mt-8 space-y-2.5">
          <p className="flex items-center gap-2 text-[14px]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent ring-2 ring-ink" aria-hidden />
            Check your email. Tap the link, or type the code here.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Code from the email"
            value={code}
            onChange={(event) => setCode(event.target.value.trim())}
            placeholder="Code from the email"
            className={`${field} font-mono tracking-widest`}
          />
          <button type="submit" className={`${pill} bg-accent text-ink`}>
            Sign in with code
          </button>
          {status === "bad-code" && (
            <p className="text-[14px] font-medium text-ink">That code did not work. Check it, or send a new one.</p>
          )}
        </form>
      )}
      {status === "error" && (
        <p className="mt-4 text-[14px] font-medium text-ink">Could not send the link. Try again in a minute.</p>
      )}
    </main>
  );
}
