"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

const noop = () => () => {};

export function AuthGate({ children }: { children: React.ReactNode }) {
  // undefined = still checking, null = signed out.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "bad-code">(
    "idle",
  );

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

  return (
    <main className="mx-auto w-full max-w-sm px-4 pb-16 pt-20">
      <h1 className="headline text-[clamp(3rem,15vw,4.5rem)]">Tripsy</h1>
      <p className="headline-light mt-1 text-[clamp(1.5rem,7vw,2rem)]">
        <span className="rounded-full bg-accent px-3">Sign in</span>
      </p>
      <p className="mt-6 text-[15px] font-light leading-snug text-muted">
        Use the email your trip is shared with.
      </p>
      <form onSubmit={sendLink} className="mt-6 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-full bg-panel px-5 py-3.5 text-[16px] outline-none ring-ink focus:ring-2"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded-full bg-ink px-5 py-3.5 text-[13px] font-semibold uppercase tracking-wider text-white disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {(status === "sent" || status === "bad-code") && (
        <form onSubmit={verifyCode} className="mt-8 space-y-3">
          <p className="flex items-center gap-2 text-[14px]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent ring-2 ring-ink" aria-hidden />
            Check your email. Tap the link, or type the code here.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.trim())}
            placeholder="Code from the email"
            className="w-full rounded-full bg-panel px-5 py-3.5 font-mono text-[16px] tracking-widest outline-none ring-ink focus:ring-2"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-accent px-5 py-3.5 text-[13px] font-semibold uppercase tracking-wider text-ink"
          >
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
